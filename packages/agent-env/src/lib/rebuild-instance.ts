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
import type { FsDeps } from './workspace.js';

import { findWorkspaceByName } from './attach-instance.js';
import { createContainerLifecycle } from './container.js';
import {
  getBaselineConfigPath,
  hasDevcontainerConfig,
  listBaselineFiles,
  patchContainerName,
} from './devcontainer.js';
import { readState, writeStateAtomic } from './state.js';
import { getWorkspacePathByName } from './workspace.js';

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
 * For baseline configs: copies to a temp dir, patches, then swaps to ensure atomicity.
 * For repo configs: verifies the config still exists on disk.
 */
async function refreshConfig(
  wsRoot: string,
  containerName: string,
  configSource: 'baseline' | 'repo',
  deps: Pick<RebuildInstanceDeps, 'devcontainerFsDeps' | 'rm' | 'rename' | 'logger'>
): Promise<ConfigRefreshResult> {
  const devcontainerDir = join(wsRoot, '.devcontainer');
  const tempDevcontainerDir = join(wsRoot, '.devcontainer.new');

  if (configSource === 'baseline') {
    try {
      // 1. Check for extra files in existing dir (informational)
      try {
        const currentFiles = await deps.devcontainerFsDeps.readdir(devcontainerDir);
        const baselineFiles = await listBaselineFiles(deps.devcontainerFsDeps);
        const baselineSet = new Set(baselineFiles);
        const extras = currentFiles.filter((f) => !baselineSet.has(f));
        if (extras.length > 0) {
          deps.logger?.warn(`Extra files in .devcontainer/ will be deleted: ${extras.join(', ')}`);
        }
      } catch {
        // .devcontainer/ doesn't exist — fine, we'll create it
      }

      // 2. Copy fresh baseline to temp directory
      await deps.rm(tempDevcontainerDir, { recursive: true, force: true });
      await deps.devcontainerFsDeps.mkdir(tempDevcontainerDir, { recursive: true });
      await deps.devcontainerFsDeps.cp(getBaselineConfigPath(), tempDevcontainerDir, {
        recursive: true,
      });

      // 3. Patch container name in temp directory (reuses shared patchContainerName)
      await patchContainerName(wsRoot, containerName, deps.devcontainerFsDeps, '.devcontainer.new');

      // 4. Atomic swap (as atomic as it gets: rm then rename)
      await deps.rm(devcontainerDir, { recursive: true, force: true });
      await deps.rename(tempDevcontainerDir, devcontainerDir);
    } catch (err) {
      // Clean up temp dir if it exists
      await deps.rm(tempDevcontainerDir, { recursive: true, force: true });
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

// ─── Rebuild Orchestration ───────────────────────────────────────────────────

/**
 * Rebuild an instance by destroying and recreating its container.
 *
 * Orchestration flow:
 * 1. Find workspace by instance name
 * 2. Read state to get container name
 * 3. Check Docker availability
 * 4. Refresh devcontainer config (if baseline) — before teardown
 * 5. Check container status — if running and not forced, return error
 * 6. Stop container (if exists)
 * 7. Remove container (if exists)
 * 8. Start fresh container via devcontainer up
 * 9. Discover actual container name and update state
 *
 * The workspace (git repo, files) is preserved.
 * Only the container is destroyed and recreated.
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param deps - Injectable dependencies
 * @param force - If true, rebuild even if the container is currently running
 * @param overrideConfigSource - Explicit config source, used when state lacks configSource
 * @returns RebuildResult with success/failure info
 */
export async function rebuildInstance(
  instanceName: string,
  deps: RebuildInstanceDeps,
  force: boolean = false,
  overrideConfigSource?: 'baseline' | 'repo'
): Promise<RebuildResult> {
  // Step 1: Find workspace
  const lookup = await findWorkspaceByName(instanceName, deps.workspaceFsDeps);

  if (!lookup.found) {
    if (lookup.reason === 'ambiguous') {
      return {
        ok: false,
        error: {
          code: 'AMBIGUOUS_MATCH',
          message: `Multiple instances match '${instanceName}': ${lookup.matches.join(', ')}`,
          suggestion: 'Use the full workspace name to specify which instance.',
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'WORKSPACE_NOT_FOUND',
        message: `Instance '${instanceName}' not found`,
        suggestion: 'Use `agent-env list` to see available instances.',
      },
    };
  }

  const wsPath = getWorkspacePathByName(lookup.workspaceName, deps.workspaceFsDeps);
  const state = await readState(wsPath, deps.stateFsDeps);
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

  // Step 4: Check container status
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

  // Step 5: Stop container (if it exists and is running)
  if (statusResult.ok && statusResult.status !== 'not-found') {
    const stopResult = await deps.container.containerStop(containerName);
    if (!stopResult.ok) {
      return {
        ok: false,
        error: stopResult.error,
        wasRunning,
      };
    }
  }

  // Step 6: Remove container (if it exists)
  if (statusResult.ok && statusResult.status !== 'not-found') {
    const removeResult = await deps.container.containerRemove(containerName);
    if (!removeResult.ok) {
      return {
        ok: false,
        error: removeResult.error,
        wasRunning,
      };
    }
  }

  // Step 7: Start fresh container via devcontainer up
  const containerResult = await deps.container.devcontainerUp(wsPath.root, containerName);
  if (!containerResult.ok) {
    return {
      ok: false,
      error: containerResult.error,
      wasRunning,
    };
  }

  // Step 8: Discover actual container name
  let actualContainerName = containerName;
  if (containerResult.containerId) {
    const discovered = await deps.container.getContainerNameById(containerResult.containerId);
    if (discovered) {
      actualContainerName = discovered;
    }
  }

  // Step 9: Update state with actual name and rebuild timestamp
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
