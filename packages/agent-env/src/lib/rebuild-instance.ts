/**
 * Rebuild instance orchestration for agent-env
 *
 * Orchestrates the full rebuild flow:
 *   find workspace → check Docker → refresh config → check container status → stop → remove → devcontainer up.
 * Preserves the workspace (git repo, files) and only recreates the container.
 * Uses dependency injection for all I/O operations to enable testing.
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createExecutor } from '@zookanalytics/shared';
import {
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
  appendFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { ContainerLifecycle } from './container.js';
import type { DevcontainerFsDeps } from './devcontainer.js';
import type { StateFsDeps } from './state.js';
import type { ContainerResult, InstanceState, WorkspacePath } from './types.js';
import type { FsDeps } from './workspace.js';

import { createContainerLifecycle } from './container.js';
import {
  getBaselineConfigPath,
  hasDevcontainerConfig,
  parseDockerfileImages,
  patchContainerName,
  resolveDockerfilePath,
} from './devcontainer.js';
import { readState, writeStateAtomic } from './state.js';
import { AGENT_ENV_DIR } from './types.js';
import { getWorkspacePathByName, resolveInstance } from './workspace.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export type RebuildResult =
  | {
      ok: true;
      containerName: string;
      wasRunning: boolean;
    }
  | {
      ok: false;
      error: { code: string; message: string; suggestion?: string };
      wasRunning?: boolean;
    };

export interface RebuildOptions {
  force?: boolean;
  configSource?: 'baseline' | 'repo';
  pull?: boolean;
  noCache?: boolean;
}

export interface RebuildInstanceDeps {
  executor: Execute;
  container: ContainerLifecycle;
  workspaceFsDeps: FsDeps;
  stateFsDeps: StateFsDeps;
  devcontainerFsDeps: Pick<
    DevcontainerFsDeps,
    'cp' | 'mkdir' | 'readdir' | 'readFile' | 'stat' | 'writeFile'
  >;
  rm: typeof rm;
  rename: typeof rename;
  logger?: { warn: (message: string) => void; info: (message: string) => void };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create default dependencies for rebuildInstance.
 * Useful for production; tests inject their own.
 */
export function createRebuildDefaultDeps(): RebuildInstanceDeps {
  const executor = createExecutor();
  return {
    executor,
    container: createContainerLifecycle(executor),
    workspaceFsDeps: { mkdir, readdir, stat, homedir },
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    devcontainerFsDeps: { cp, mkdir, readdir, readFile, stat, writeFile },
    rm,
    rename,
    logger: { warn: (msg) => console.warn(msg), info: (msg) => console.info(msg) },
  };
}

// ─── Config Refresh ──────────────────────────────────────────────────────────

type ConfigRefreshResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

/**
 * Refresh devcontainer config before container teardown.
 *
 * For baseline configs: copies fresh baseline files into .agent-env/ and patches
 * the container name. Uses fs.cp merge semantics to preserve state.json.
 * For repo configs: verifies the config still exists on disk.
 */
async function refreshConfig(
  wsRoot: string,
  containerName: string,
  configSource: 'baseline' | 'repo',
  deps: Pick<RebuildInstanceDeps, 'devcontainerFsDeps' | 'rm' | 'rename' | 'logger'>
): Promise<ConfigRefreshResult> {
  if (configSource === 'baseline') {
    const agentEnvDir = join(wsRoot, AGENT_ENV_DIR);
    try {
      // Copy fresh baseline files into .agent-env/ (merges, preserves state.json)
      await deps.devcontainerFsDeps.mkdir(agentEnvDir, { recursive: true });
      await deps.devcontainerFsDeps.cp(getBaselineConfigPath(), agentEnvDir, {
        recursive: true,
      });

      // Patch container name
      await patchContainerName(wsRoot, containerName, deps.devcontainerFsDeps, AGENT_ENV_DIR);
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'CONFIG_REFRESH_FAILED',
          message: `Failed to refresh baseline config: ${err instanceof Error ? err.message : String(err)}`,
          suggestion:
            'The existing container is still intact. Check that the baseline config files exist in the package.',
        },
      };
    }
  } else {
    // Repo-provided config: verify it still exists on disk
    const configExists = await hasDevcontainerConfig(wsRoot, deps.devcontainerFsDeps);
    if (!configExists) {
      return {
        ok: false,
        error: {
          code: 'CONFIG_MISSING',
          message: 'Repo-provided devcontainer config is missing.',
          suggestion: 'Re-clone the repository or provide a devcontainer config manually.',
        },
      };
    }

    // If .devcontainer/ dir exists, verify it contains devcontainer.json
    // (hasDevcontainerConfig returns true for an empty .devcontainer/ dir)
    const devcontainerDir = join(wsRoot, '.devcontainer');
    const dirExists = await deps.devcontainerFsDeps.stat(devcontainerDir).catch(() => null);
    if (dirExists) {
      const jsonExists = await deps.devcontainerFsDeps
        .stat(join(devcontainerDir, 'devcontainer.json'))
        .catch(() => null);
      if (!jsonExists) {
        return {
          ok: false,
          error: {
            code: 'CONFIG_CORRUPT',
            message: 'Repo-provided devcontainer config is incomplete (missing devcontainer.json).',
            suggestion: 'Ensure .devcontainer/devcontainer.json exists.',
          },
        };
      }
    }
  }

  return { ok: true };
}

// ─── Workspace Lookup ────────────────────────────────────────────────────

type WorkspaceLookupResult =
  | { ok: true; wsPath: WorkspacePath; state: InstanceState }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

async function lookupWorkspace(
  instanceName: string,
  deps: Pick<RebuildInstanceDeps, 'workspaceFsDeps' | 'stateFsDeps'>,
  repoSlug?: string
): Promise<WorkspaceLookupResult> {
  const lookup = await resolveInstance(instanceName, repoSlug, {
    fsDeps: deps.workspaceFsDeps,
    readFile: deps.stateFsDeps.readFile,
  });

  if (!lookup.found) {
    return { ok: false, error: lookup.error };
  }

  const wsPath = getWorkspacePathByName(lookup.workspaceName, deps.workspaceFsDeps);
  const state = await readState(wsPath, deps.stateFsDeps);
  return { ok: true, wsPath, state };
}

// ─── Pull Step ───────────────────────────────────────────────────────────

type PullStepResult =
  | { ok: true; hasDockerfile: boolean }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

/**
 * Resolve Dockerfile, parse FROM images, and pull base images.
 *
 * Returns hasDockerfile for use by buildNoCache logic.
 * When pull is false, still resolves the Dockerfile path but skips pulling.
 */
async function executePullStep(
  wsRoot: string,
  pull: boolean,
  deps: Pick<RebuildInstanceDeps, 'devcontainerFsDeps' | 'container' | 'logger'>
): Promise<PullStepResult> {
  let dockerfilePath: string | null;
  try {
    dockerfilePath = await resolveDockerfilePath(wsRoot, deps.devcontainerFsDeps);
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'CONFIG_PARSE_FAILED',
        message: err instanceof Error ? err.message : String(err),
        suggestion: 'Check that your devcontainer.json is valid JSON or JSONC.',
      },
    };
  }

  const hasDockerfile = dockerfilePath !== null;

  if (!pull) {
    return { ok: true, hasDockerfile };
  }

  if (dockerfilePath === null) {
    deps.logger?.info('No Dockerfile found — skipping image pull.');
    return { ok: true, hasDockerfile: false };
  }

  let dockerfileContent: string;
  try {
    dockerfileContent = await deps.devcontainerFsDeps.readFile(dockerfilePath, 'utf-8');
  } catch {
    return {
      ok: false,
      error: {
        code: 'DOCKERFILE_MISSING',
        message: `Dockerfile not found at ${dockerfilePath}`,
        suggestion:
          'Ensure the Dockerfile exists at the configured path, or use --no-pull to skip.',
      },
    };
  }

  const images = parseDockerfileImages(dockerfileContent, deps.logger);
  if (images.length === 0) {
    deps.logger?.info('No pullable FROM images found.');
    return { ok: true, hasDockerfile };
  }

  // Pull images in parallel for better performance
  const results = await Promise.allSettled(
    images.map(async (image) => {
      deps.logger?.info(`Pulling ${image}...`);
      const pullResult = await deps.container.dockerPull(image);
      if (!pullResult.ok) {
        throw pullResult.error;
      }
      deps.logger?.info(`Pulled ${image}`);
    })
  );

  const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (firstFailure) {
    return {
      ok: false,
      error: firstFailure.reason as { code: string; message: string; suggestion?: string },
    };
  }

  return { ok: true, hasDockerfile };
}

// ─── Container Teardown ──────────────────────────────────────────────────

type TeardownResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

/**
 * Stop and remove an existing container if it exists.
 * Skips both operations if the container is not found.
 */
async function teardownContainer(
  containerName: string,
  container: ContainerLifecycle,
  statusResult: ContainerResult
): Promise<TeardownResult> {
  if (!statusResult.ok || statusResult.status === 'not-found') {
    return { ok: true };
  }

  const stopResult = await container.containerStop(containerName);
  if (!stopResult.ok) {
    return { ok: false, error: stopResult.error };
  }

  const removeResult = await container.containerRemove(containerName);
  if (!removeResult.ok) {
    return { ok: false, error: removeResult.error };
  }

  return { ok: true };
}

// ─── Rebuild Orchestration ───────────────────────────────────────────────────

/**
 * Rebuild an instance by destroying and recreating its container.
 *
 * Orchestration flow:
 *  1. Find workspace by instance name
 *  2. Read state to get container name
 *  3. Check Docker availability
 *  4. Refresh devcontainer config (if baseline) — before teardown
 *  5. Parse Dockerfile + pull base images (if pull enabled)
 *  6. Check container status — if running and not forced, return error
 *  7. Stop container (if exists)
 *  8. Remove container (if exists)
 *  9. Start fresh container via devcontainer up (with --build-no-cache if noCache)
 * 10. Discover actual container name and update state
 *
 * The workspace (git repo, files) is preserved.
 * Only the container is destroyed and recreated.
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param deps - Injectable dependencies
 * @param options - Rebuild options (force, pull, noCache, configSource)
 * @returns RebuildResult with success/failure info
 */
export async function rebuildInstance(
  instanceName: string,
  deps: RebuildInstanceDeps,
  options?: RebuildOptions,
  repoSlug?: string
): Promise<RebuildResult> {
  const {
    force = false,
    configSource: overrideConfigSource,
    pull = true,
    noCache = true,
  } = options ?? {};

  // Step 1: Find workspace
  const wsLookup = await lookupWorkspace(instanceName, deps, repoSlug);
  if (!wsLookup.ok) {
    return { ok: false, error: wsLookup.error };
  }
  const { wsPath, state } = wsLookup;
  const containerName = state.containerName;

  // Step 2: Check Docker availability
  const dockerAvailable = await deps.container.isDockerAvailable();
  if (!dockerAvailable) {
    return {
      ok: false,
      error: {
        code: 'ORBSTACK_REQUIRED',
        message: 'Docker is not available. OrbStack or Docker Desktop must be running.',
        suggestion: 'Start OrbStack or Docker Desktop, then try again.',
      },
    };
  }

  // Step 3: Refresh devcontainer config (before teardown — if it fails, container is still intact)
  const configSource = overrideConfigSource ?? state.configSource;
  if (!configSource) {
    return {
      ok: false,
      error: {
        code: 'CONFIG_SOURCE_UNKNOWN',
        message: `Instance '${instanceName}' was created before config tracking was added.`,
        suggestion:
          'Set configSource manually in .agent-env/state.json ("baseline" or "repo"), then retry.',
      },
    };
  }
  const configResult = await refreshConfig(wsPath.root, containerName, configSource, deps);
  if (!configResult.ok) {
    return { ok: false, error: configResult.error };
  }

  // Step 4: Parse Dockerfile + pull base images
  const pullStepResult = await executePullStep(wsPath.root, pull, deps);
  if (!pullStepResult.ok) {
    return { ok: false, error: pullStepResult.error };
  }
  const { hasDockerfile } = pullStepResult;

  // Step 5: Check container status
  const statusResult = await deps.container.containerStatus(containerName);
  const wasRunning = statusResult.ok && statusResult.status === 'running';

  if (wasRunning && !force) {
    return {
      ok: false,
      error: {
        code: 'CONTAINER_RUNNING',
        message: `Container '${containerName}' is currently running`,
        suggestion:
          'Stop any active sessions first, or use --force to rebuild a running container.',
      },
      wasRunning: true,
    };
  }

  // Step 6-7: Stop and remove container
  const teardownResult = await teardownContainer(containerName, deps.container, statusResult);
  if (!teardownResult.ok) {
    return { ok: false, error: teardownResult.error, wasRunning };
  }

  // Step 8: Start fresh container via devcontainer up
  const buildNoCache = noCache && hasDockerfile;
  const baselineConfigPath =
    configSource === 'baseline' ? join(wsPath.root, AGENT_ENV_DIR, 'devcontainer.json') : undefined;
  const containerResult = await deps.container.devcontainerUp(wsPath.root, containerName, {
    buildNoCache,
    remoteEnv: { AGENT_INSTANCE: wsPath.name },
    configPath: baselineConfigPath,
  });
  if (!containerResult.ok) {
    return {
      ok: false,
      error: containerResult.error,
      wasRunning,
    };
  }

  // Step 9: Discover actual container name
  let actualContainerName = containerName;
  if (containerResult.containerId) {
    const discovered = await deps.container.getContainerNameById(containerResult.containerId);
    if (discovered) {
      actualContainerName = discovered;
    }
  }

  // Step 10: Update state with actual name and rebuild timestamp
  const updatedState = {
    ...state,
    containerName: actualContainerName,
    lastRebuilt: new Date().toISOString(),
  };
  await writeStateAtomic(wsPath, updatedState, deps.stateFsDeps);

  return {
    ok: true,
    containerName: actualContainerName,
    wasRunning,
  };
}
