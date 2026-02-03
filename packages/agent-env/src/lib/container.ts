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

/** Timeout for devcontainer up operation (120 seconds) */
export const DEVCONTAINER_UP_TIMEOUT = 120_000;

/** Timeout for docker inspect operation (10 seconds) */
export const DOCKER_INSPECT_TIMEOUT = 10_000;

/** Timeout for docker info availability check (5 seconds) */
export const DOCKER_INFO_TIMEOUT = 5_000;

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export interface ContainerLifecycle {
  isDockerAvailable(): Promise<boolean>;
  containerStatus(containerName: string): Promise<ContainerResult>;
  devcontainerUp(workspacePath: string, containerName: string): Promise<ContainerResult>;
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
      }>;

      if (!inspectData.length) {
        return {
          ok: true,
          status: 'not-found',
          containerId: null,
        };
      }

      const container = inspectData[0];
      const containerId = container.Id ?? null;
      const dockerStatus = container.State?.Status ?? 'unknown';
      // Docker states: created, restarting, running, removing, paused, exited, dead
      // We intentionally map all non-running states to 'stopped' for simplicity
      const status: ContainerStatus = dockerStatus === 'running' ? 'running' : 'stopped';

      return {
        ok: true,
        status,
        containerId,
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
    containerName: string
  ): Promise<ContainerResult> {
    // Check Docker availability first
    const dockerOk = await isDockerAvailable();
    if (!dockerOk) {
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

    // Run devcontainer up
    const result = await executor('devcontainer', ['up', '--workspace-folder', workspacePath], {
      timeout: DEVCONTAINER_UP_TIMEOUT,
    });

    // Parse devcontainer up JSON output (it outputs JSON with outcome and containerId)
    // We parse stdout regardless of success/failure since error details are in stdout JSON.
    // The CLI may prepend log lines before the JSON, so try the last line if full parse fails.
    let parsedOutput: {
      outcome?: string;
      containerId?: string;
      message?: string;
      description?: string;
    } | null = null;
    try {
      parsedOutput = JSON.parse(result.stdout);
    } catch {
      // stdout may have log lines before JSON — try parsing the last non-empty line
      const lines = result.stdout.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          parsedOutput = JSON.parse(lines[i]);
          break;
        } catch {
          // not JSON, try previous line
        }
      }
    }

    if (!result.ok) {
      // Build detailed error message from all available sources
      const details =
        parsedOutput?.message ||
        parsedOutput?.description ||
        result.stderr ||
        result.stdout.slice(0, 500) ||
        'No error details available';

      return {
        ok: false,
        status: 'not-found',
        containerId: null,
        error: {
          code: 'CONTAINER_ERROR',
          message: `devcontainer up failed for '${containerName}':\n   ${details}`,
          suggestion: 'Check the devcontainer.json configuration and Docker logs.',
        },
      };
    }

    const containerId = parsedOutput?.containerId ?? null;

    return {
      ok: true,
      status: 'running',
      containerId,
    };
  }

  return {
    isDockerAvailable,
    containerStatus,
    devcontainerUp,
  };
}
