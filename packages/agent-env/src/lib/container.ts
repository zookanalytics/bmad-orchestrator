/**
 * Container lifecycle management for agent-env
 *
 * Handles starting containers via devcontainer CLI and checking
 * container status via docker inspect. Uses dependency injection
 * for the subprocess executor to enable testing.
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createExecutor } from '@zookanalytics/shared';

import type { ContainerResult, ContainerStatus } from './types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Timeout for devcontainer up operation (300 seconds — includes post-create with network I/O) */
export const DEVCONTAINER_UP_TIMEOUT = 300_000;

/** Timeout for devcontainer up with --build-no-cache (300 seconds — full rebuilds are slow) */
export const DEVCONTAINER_UP_NO_CACHE_TIMEOUT = 300_000;

/**
 * Timeout for docker pull operation (15 minutes). The managed image pull is
 * mandatory in create/rebuild and the image is multi-GB — a first download on
 * a slow link can legitimately exceed 5 minutes.
 */
export const DOCKER_PULL_TIMEOUT = 900_000;

/** Timeout for docker inspect operation (10 seconds) */
export const DOCKER_INSPECT_TIMEOUT = 10_000;

/** Timeout for docker info availability check (5 seconds) */
export const DOCKER_INFO_TIMEOUT = 5_000;

/** Timeout for docker stop operation (30 seconds) */
export const DOCKER_STOP_TIMEOUT = 30_000;

/** Timeout for docker rm operation (10 seconds) */
export const DOCKER_RM_TIMEOUT = 10_000;

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export interface ContainerLifecycle {
  isDockerAvailable(): Promise<boolean>;
  isDevcontainerCliAvailable(): Promise<boolean>;
  containerStatus(containerName: string): Promise<ContainerResult>;
  getContainerNameById(containerId: string): Promise<string | null>;
  findContainerByWorkspaceLabel(workspacePath: string): Promise<string | null>;
  devcontainerUp(
    workspacePath: string,
    containerName: string,
    options?: {
      buildNoCache?: boolean;
      remoteEnv?: Record<string, string>;
      configPath?: string;
      onProgress?: (line: string) => void;
      interactive?: boolean;
    }
  ): Promise<ContainerResult>;
  dockerPull(image: string): Promise<DockerPullResult>;
  containerStop(containerName: string): Promise<ContainerStopResult>;
  containerRemove(containerName: string): Promise<ContainerRemoveResult>;
}

/** Result from a Docker CLI operation (stop, remove, pull) */
export type DockerOperationResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export type ContainerStopResult = DockerOperationResult;
export type ContainerRemoveResult = DockerOperationResult;
export type DockerPullResult = DockerOperationResult;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse JSON from devcontainer CLI stdout, trying last line if full parse fails */
function parseDevcontainerOutput(stdout: string): {
  outcome?: string;
  containerId?: string;
  message?: string;
  description?: string;
} | null {
  try {
    return JSON.parse(stdout);
  } catch {
    const lines = stdout.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        // not JSON, try previous line
      }
    }
  }
  return null;
}

/** Extract non-JSON lines from devcontainer CLI stdout (lifecycle command output).
 *  The devcontainer CLI may write postCreateCommand output as text lines
 *  before the final JSON result object. */
function extractLifecycleOutput(stdout: string): string {
  if (!stdout) return '';
  const lines = stdout.trim().split('\n');
  const nonJsonLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      JSON.parse(trimmed);
      // JSON line (result object), skip it
    } catch {
      nonJsonLines.push(line);
    }
  }
  return nonJsonLines.join('\n');
}

/** Maximum number of output lines to include in error messages. */
const MAX_OUTPUT_LINES = 100;

/** Truncate output to last N lines, adding an omission notice if truncated. */
function truncateOutput(output: string, maxLines: number): string[] {
  const outputLines = output.trimEnd().split('\n');
  if (outputLines.length > maxLines) {
    return [
      `[... ${outputLines.length - maxLines} earlier lifecycle output lines omitted]`,
      outputLines.slice(-maxLines).join('\n'),
    ];
  }
  return [output];
}

/**
 * Build a detailed error message from devcontainer up failure output.
 * Combines parsed JSON output, lifecycle output, and stderr.
 */
function buildDevcontainerErrorDetails(
  stdout: string,
  stderr: string,
  parsedOutput: ReturnType<typeof parseDevcontainerOutput>
): string {
  const parts: string[] = [];
  if (parsedOutput?.message) parts.push(parsedOutput.message);
  if (parsedOutput?.description) parts.push(parsedOutput.description);

  const lifecycleOutput = extractLifecycleOutput(stdout);
  if (lifecycleOutput) {
    parts.push(...truncateOutput(lifecycleOutput, MAX_OUTPUT_LINES));
  }

  if (stderr) {
    const stderrLines = stderr.trimEnd().split('\n');
    if (stderrLines.length > MAX_OUTPUT_LINES) {
      parts.push(`[... ${stderrLines.length - MAX_OUTPUT_LINES} earlier stderr lines omitted]`);
      parts.push(stderrLines.slice(-MAX_OUTPUT_LINES).join('\n'));
    } else {
      parts.push(stderr);
    }
  }

  return parts.join('\n   ') || 'No error details available';
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a container lifecycle manager with injectable executor.
 *
 * @param executor - Subprocess executor (defaults to shared createExecutor)
 * @returns ContainerLifecycle with devcontainerUp, containerStatus, isDockerAvailable
 */
export function createContainerLifecycle(executor: Execute = createExecutor()): ContainerLifecycle {
  /**
   * Check if Docker/OrbStack is available and running
   */
  async function isDockerAvailable(): Promise<boolean> {
    const result = await executor('docker', ['info'], { timeout: DOCKER_INFO_TIMEOUT });
    return result.ok;
  }

  /**
   * Check whether the `devcontainer` CLI is resolvable on PATH.
   *
   * agent-env shells out to a bare `devcontainer` command but does not bundle
   * it as a hard dependency — VS Code's Dev Containers extension ships its own
   * copy, and many users install it globally. When it is missing entirely the
   * spawn fails with ENOENT and produces no stdout/stderr, so we probe for it
   * up front to surface an actionable message instead of an empty error.
   */
  async function isDevcontainerCliAvailable(): Promise<boolean> {
    const result = await executor('devcontainer', ['--version'], { timeout: DOCKER_INFO_TIMEOUT });
    return result.ok;
  }

  /**
   * Verify the prerequisites for `devcontainer up` are present.
   *
   * @returns A failed ContainerResult describing the missing prerequisite, or
   *   `null` when both Docker and the devcontainer CLI are available.
   */
  async function checkDevcontainerPrerequisites(): Promise<ContainerResult | null> {
    if (!(await isDockerAvailable())) {
      return {
        ok: false,
        status: 'not-found',
        containerId: null,
        error: {
          code: 'ORBSTACK_REQUIRED',
          message: 'Docker is not available. OrbStack or Docker Desktop must be running.',
          suggestion: 'Start OrbStack or Docker Desktop, then try again.',
        },
      };
    }

    // We don't bundle the devcontainer CLI (VS Code's Dev Containers extension
    // provides one, and users may install it globally). When it is missing the
    // spawn fails with an empty ENOENT, so surface an actionable message here.
    if (!(await isDevcontainerCliAvailable())) {
      return {
        ok: false,
        status: 'not-found',
        containerId: null,
        error: {
          code: 'DEVCONTAINER_CLI_MISSING',
          message: 'The `devcontainer` CLI was not found on your PATH.',
          suggestion:
            'Install it with `npm install -g @devcontainers/cli`, or — if you use VS Code — run the ' +
            '"Dev Containers: Install devcontainer CLI" command and ensure the resulting binary is on your PATH.',
        },
      };
    }

    return null;
  }

  /**
   * Get the current status of a container by name.
   *
   * @param containerName - Container name (e.g., "ae-bmad-orch-auth")
   * @returns ContainerResult with status, containerId, and optional error
   */
  async function containerStatus(containerName: string): Promise<ContainerResult> {
    const result = await executor('docker', ['inspect', containerName], {
      timeout: DOCKER_INSPECT_TIMEOUT,
    });

    if (!result.ok) {
      // "No such container" is a normal not-found case
      if (result.stderr.includes('No such') || result.stderr.includes('not found')) {
        return {
          ok: true,
          status: 'not-found',
          containerId: null,
          ports: {},
          labels: {},
        };
      }

      // Other failures (Docker unavailable, etc.)
      return {
        ok: false,
        status: 'not-found',
        containerId: null,
        error: {
          code: 'CONTAINER_ERROR',
          message: `Failed to inspect container '${containerName}': ${result.stderr}`,
        },
      };
    }

    // Parse docker inspect JSON output
    try {
      const inspectData = JSON.parse(result.stdout) as Array<{
        Id?: string;
        State?: { Status?: string };
        Config?: {
          Labels?: Record<string, string>;
        };
        NetworkSettings?: {
          Ports?: Record<string, Array<{ HostPort: string }> | null>;
        };
      }>;

      if (!inspectData.length) {
        return {
          ok: true,
          status: 'not-found',
          containerId: null,
          ports: {},
          labels: {},
        };
      }

      const container = inspectData[0];
      const containerId = container.Id ?? null;
      const dockerStatus = container.State?.Status ?? 'unknown';
      // Docker states: created, restarting, running, removing, paused, exited, dead
      // We intentionally map all non-running states to 'stopped' for simplicity
      const status: ContainerStatus = dockerStatus === 'running' ? 'running' : 'stopped';

      // Extract ports — includes exposed-but-not-published ports (empty string value)
      // so callers can distinguish "port exists" from "port is published"
      const ports: Record<string, string> = {};
      const dockerPorts = container.NetworkSettings?.Ports;
      if (dockerPorts) {
        for (const [key, mappings] of Object.entries(dockerPorts)) {
          if (mappings && mappings.length > 0) {
            ports[key] = mappings[0].HostPort;
          } else {
            // Port is exposed but not published (e.g., OrbStack direct networking)
            ports[key] = '';
          }
        }
      }

      // Extract labels
      const labels: Record<string, string> = container.Config?.Labels ?? {};

      return {
        ok: true,
        status,
        containerId,
        ports,
        labels,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        status: 'not-found',
        containerId: null,
        error: {
          code: 'CONTAINER_ERROR',
          message: `Failed to parse docker inspect output for '${containerName}': ${errorMessage}`,
        },
      };
    }
  }

  /**
   * Get the container name from a container ID.
   *
   * Used to discover the actual container name after devcontainer up,
   * which may differ from the expected ae-* name if the repo has a
   * custom --name in its devcontainer.json runArgs.
   *
   * @param containerId - Docker container ID (full or short)
   * @returns Container name without leading slash, or null if not found
   */
  async function getContainerNameById(containerId: string): Promise<string | null> {
    const result = await executor('docker', ['inspect', containerId, '--format', '{{.Name}}'], {
      timeout: DOCKER_INSPECT_TIMEOUT,
    });

    if (!result.ok) {
      return null;
    }

    // Docker returns "/name", strip the leading slash
    const name = result.stdout.trim().replace(/^\//, '');
    return name || null;
  }

  /**
   * Find an existing container created from a given workspace folder.
   *
   * Uses the `devcontainer.local_folder` label that the devcontainer CLI
   * automatically applies to containers it creates.
   *
   * @param workspacePath - Absolute path to workspace folder
   * @returns Container name if found, null otherwise (returns first match if multiple)
   */
  async function findContainerByWorkspaceLabel(workspacePath: string): Promise<string | null> {
    const result = await executor(
      'docker',
      [
        'ps',
        '-a',
        '--filter',
        // Quote the label value to prevent parsing issues with special characters like commas
        `label=devcontainer.local_folder="${workspacePath}"`,
        '--format',
        '{{.Names}}',
      ],
      { timeout: DOCKER_INSPECT_TIMEOUT }
    );

    if (!result.ok) {
      return null;
    }

    const name = result.stdout.trim().split('\n')[0]?.trim();
    return name || null;
  }

  /**
   * Start a devcontainer from a workspace folder.
   *
   * Checks Docker availability first, then runs `devcontainer up`
   * with the workspace folder path.
   *
   * @param workspacePath - Absolute path to workspace folder
   * @param containerName - Expected container name (for error messages)
   * @returns ContainerResult with status and containerId
   */
  async function devcontainerUp(
    workspacePath: string,
    containerName: string,
    options?: {
      buildNoCache?: boolean;
      remoteEnv?: Record<string, string>;
      configPath?: string;
      onProgress?: (line: string) => void;
      interactive?: boolean;
    }
  ): Promise<ContainerResult> {
    // Verify Docker and the devcontainer CLI are both available up front.
    const prereqError = await checkDevcontainerPrerequisites();
    if (prereqError) {
      return prereqError;
    }

    // Run devcontainer up
    // --log-level debug causes the devcontainer CLI to write lifecycle command
    // output (including postCreateCommand) as timestamped text lines on stdout,
    // before the final JSON result. This is the primary diagnostic channel.
    // Using debug instead of trace to avoid the verbose userEnvProbe env dump.
    // If postCreateCommand output disappears at debug level, switch back to trace.
    const buildNoCache = options?.buildNoCache === true;
    const remoteEnvArgs = Object.entries(options?.remoteEnv ?? {}).flatMap(([key, value]) => [
      '--remote-env',
      `${key}=${value}`,
    ]);
    const configArgs = options?.configPath ? ['--config', options.configPath] : [];
    const args = [
      'up',
      '--workspace-folder',
      workspacePath,
      ...configArgs,
      '--log-level',
      'debug',
      ...remoteEnvArgs,
      ...(buildNoCache ? ['--build-no-cache'] : []),
    ];
    const inheritStdin = options?.interactive === true && process.stdin.isTTY === true;
    const result = await executor('devcontainer', args, {
      timeout: buildNoCache ? DEVCONTAINER_UP_NO_CACHE_TIMEOUT : DEVCONTAINER_UP_TIMEOUT,
      onLine: options?.onProgress,
      ...(inheritStdin && { stdin: 'inherit' }),
    });

    // Parse devcontainer up JSON output (it outputs JSON with outcome and containerId)
    // We parse stdout regardless of success/failure since error details are in stdout JSON.
    const parsedOutput = parseDevcontainerOutput(result.stdout);

    if (!result.ok) {
      const details = buildDevcontainerErrorDetails(result.stdout, result.stderr, parsedOutput);

      // Detect container name conflict for a targeted suggestion
      const combined = `${result.stderr} ${result.stdout}`;
      const isNameConflict =
        combined.includes('is already in use') ||
        combined.includes('name is already in use') ||
        combined.includes('Conflict.') ||
        combined.includes('conflict');

      return {
        ok: false,
        status: 'not-found',
        containerId: null,
        error: {
          code: 'CONTAINER_ERROR',
          message: `devcontainer up failed for '${containerName}':\n   ${details}`,
          suggestion: isNameConflict
            ? 'A container with this name already exists. Use `docker ps -a` to find it, then `docker rm -f <name>` to remove it and retry.'
            : 'Check the devcontainer.json configuration and Docker logs.',
        },
      };
    }

    const containerId = parsedOutput?.containerId ?? null;

    return {
      ok: true,
      status: 'running',
      containerId,
      ports: {},
      labels: {},
    };
  }

  /**
   * Stop a running container gracefully.
   *
   * Uses `docker stop` with a 30-second timeout. If the container
   * is already stopped or not found, this is treated as success.
   *
   * @param containerName - Container name (e.g., "ae-bmad-orch-auth")
   * @returns ContainerStopResult with success/failure info
   */
  async function containerStop(containerName: string): Promise<ContainerStopResult> {
    const result = await executor('docker', ['stop', containerName], {
      timeout: DOCKER_STOP_TIMEOUT,
    });

    if (result.ok) {
      return { ok: true };
    }

    // Container already stopped or not found — treat as success
    if (
      result.stderr.includes('No such') ||
      result.stderr.includes('not found') ||
      result.stderr.includes('is not running')
    ) {
      return { ok: true };
    }

    return {
      ok: false,
      error: {
        code: 'CONTAINER_STOP_TIMEOUT',
        message: `Failed to stop container '${containerName}': ${result.stderr}`,
        suggestion: `Try manually: docker rm -f ${containerName}`,
      },
    };
  }

  /**
   * Remove a stopped container.
   *
   * Uses `docker rm` to remove the container. If the container
   * is not found, this is treated as success (already cleaned up).
   *
   * @param containerName - Container name (e.g., "ae-bmad-orch-auth")
   * @returns ContainerRemoveResult with success/failure info
   */
  async function containerRemove(containerName: string): Promise<ContainerRemoveResult> {
    const result = await executor('docker', ['rm', containerName], {
      timeout: DOCKER_RM_TIMEOUT,
    });

    if (result.ok) {
      return { ok: true };
    }

    // Container not found — treat as success (already cleaned up)
    if (result.stderr.includes('No such') || result.stderr.includes('not found')) {
      return { ok: true };
    }

    return {
      ok: false,
      error: {
        code: 'CONTAINER_ERROR',
        message: `Failed to remove container '${containerName}': ${result.stderr}`,
      },
    };
  }

  /**
   * Pull a Docker image from a registry.
   *
   * @param image - Image reference (e.g., "node:22-bookworm-slim")
   * @returns DockerPullResult with success/failure info
   */
  async function dockerPull(image: string): Promise<DockerPullResult> {
    const result = await executor('docker', ['pull', image], {
      timeout: DOCKER_PULL_TIMEOUT,
    });

    if (result.ok) {
      return { ok: true };
    }

    // Detect registry "not-yet-published" errors so we can return an actionable
    // suggestion pointing to the agent-env / image-publish version mismatch.
    // Note: `pull access denied` is intentionally NOT a trigger — it surfaces
    // for genuine auth failures against private registries, which is a
    // different problem class than "image tag hasn't shipped yet".
    const stderr = result.stderr ?? '';
    const stderrLower = stderr.toLowerCase();
    const isManifestUnknown =
      stderrLower.includes('manifest unknown') ||
      (stderrLower.includes('manifest for') && stderrLower.includes('not found'));

    if (isManifestUnknown) {
      return {
        ok: false,
        error: {
          code: 'IMAGE_VERSION_NOT_PUBLISHED',
          message: `Image '${image}' is not available in the registry: ${stderr.trim()}`,
          suggestion:
            `The container image for this agent-env version may not be published yet. ` +
            `Image publishes complete shortly after each release; check workflow status to estimate readiness.\n` +
            `   • Workflow runs: https://github.com/ZookAnalytics/bmad-orchestrator/actions/workflows/publish-image.yml\n` +
            `   • Available tags: https://github.com/ZookAnalytics/bmad-orchestrator/pkgs/container/bmad-orchestrator%2Fdevcontainer\n` +
            `   • Emergency unblock (ONLY if you already have a previously cached image): ` +
            `retry with --no-pull. The container will start with the locally cached image, which may not match agent-env's current version. ` +
            `If no image is cached, you must wait for the registry tag to publish.`,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: 'IMAGE_PULL_FAILED',
        message: `Failed to pull '${image}': ${stderr}`,
        suggestion:
          'Check network connectivity and image name. ' +
          'Use --no-pull ONLY if you already have a previously cached image — ' +
          'the container will start with whatever is cached locally and may not match the current agent-env version.',
      },
    };
  }

  return {
    isDockerAvailable,
    isDevcontainerCliAvailable,
    containerStatus,
    getContainerNameById,
    findContainerByWorkspaceLabel,
    devcontainerUp,
    dockerPull,
    containerStop,
    containerRemove,
  };
}
