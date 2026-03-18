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
  access,
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
import type { DevcontainerMergeDeps } from './devcontainer-merge.js';
import type { DevcontainerFsDeps } from './devcontainer.js';
import type { StateFsDeps } from './state.js';
import type { ContainerResult, InstanceState, WorkspacePath } from './types.js';
import type { FsDeps } from './workspace.js';

import { createContainerLifecycle } from './container.js';
import {
  buildManagedConfig,
  loadManagedDefaults,
  mergeDevcontainerConfigs,
  readRepoConfig,
  validateRepoConfig,
  writeGeneratedConfig,
} from './devcontainer-merge.js';
import { copyManagedAssets, parseDockerfileImages, resolveDockerfilePath } from './devcontainer.js';
import { readState, writeStateAtomic } from './state.js';
import { AGENT_ENV_DIR } from './types.js';
import { deriveContainerName, getWorkspacePathByName, resolveInstance } from './workspace.js';

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
  pull?: boolean;
  noCache?: boolean;
  onProgress?: (line: string) => void;
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
  mergeDeps: DevcontainerMergeDeps;
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
    mergeDeps: { readFile, writeFile, rename, access },
    rm,
    rename,
    logger: { warn: (msg) => console.warn(msg), info: (msg) => console.info(msg) },
  };
}

// ─── Config Refresh ──────────────────────────────────────────────────────────

type ConfigRefreshResult =
  | { ok: true; repoConfigDetected: boolean }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

/**
 * Re-merge devcontainer config before container teardown.
 *
 * Always re-runs the full merge pipeline:
 * 1. Load managed defaults from baseline config
 * 2. Read repo config (if present)
 * 3. Validate repo config
 * 4. Deep merge managed + repo
 * 5. Copy managed non-JSON assets
 * 6. Write generated config to .agent-env/devcontainer.json
 */
async function refreshMergedConfig(
  wsRoot: string,
  containerName: string,
  wsName: string,
  repoSlug: string,
  purpose: string,
  repoConfigExpected: boolean,
  deps: Pick<RebuildInstanceDeps, 'devcontainerFsDeps' | 'mergeDeps' | 'logger'>
): Promise<ConfigRefreshResult> {
  try {
    const defaults = await loadManagedDefaults(deps.mergeDeps);

    const managed = buildManagedConfig(defaults, {
      instanceName: wsName,
      containerName,
      repoSlug,
      purpose,
    });

    const repoConfig = await readRepoConfig(wsRoot, deps.mergeDeps, deps.logger);

    // AC-19: If state indicates repo config was detected at creation but config is now missing, error
    if (repoConfigExpected && !repoConfig) {
      return {
        ok: false,
        error: {
          code: 'REPO_CONFIG_MISSING',
          message: `Repo devcontainer config was present at creation but is now missing from ${wsRoot}`,
          suggestion:
            'Restore the repo config, or recreate the instance with `agent-env create` to generate a managed-only config.',
        },
      };
    }

    if (repoConfig) {
      validateRepoConfig(repoConfig, defaults.image, deps.logger);
    }

    const merged = mergeDevcontainerConfigs(managed, repoConfig);

    // Copy managed non-JSON assets (init-host.sh, status bar template)
    await copyManagedAssets(wsRoot, deps.devcontainerFsDeps);

    // Write generated config
    const configPath = join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json');
    await writeGeneratedConfig(configPath, merged, deps.mergeDeps);

    return { ok: true, repoConfigDetected: repoConfig !== undefined };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'CONFIG_REFRESH_FAILED',
        message: `Failed to refresh config: ${err instanceof Error ? err.message : String(err)}`,
        suggestion:
          'The existing container is still intact. Check that the baseline config files exist in the package.',
      },
    };
  }
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

// ─── Pre-teardown State Save ─────────────────────────────────────────────

async function saveTmuxState(
  containerName: string,
  deps: Pick<RebuildInstanceDeps, 'executor' | 'logger'>
): Promise<void> {
  const result = await deps.executor('docker', [
    'exec',
    containerName,
    'bash',
    '-lc',
    'agent-env tmux-save',
  ]);
  if (result.ok) {
    deps.logger?.info('Saved tmux session state');
  } else {
    deps.logger?.warn('Could not save tmux session state (non-fatal)');
  }
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

// ─── Container Startup ──────────────────────────────────────────────────────

type ContainerStartResult =
  | { ok: true; containerName: string }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

/**
 * Start a fresh container and discover its actual name.
 *
 * Always uses --config pointing to .agent-env/devcontainer.json (generated merged config).
 */
async function startAndDiscoverContainer(
  wsPath: WorkspacePath,
  containerName: string,
  purpose: string,
  buildNoCache: boolean,
  container: ContainerLifecycle,
  onProgress?: (line: string) => void
): Promise<ContainerStartResult> {
  const configPath = join(wsPath.root, AGENT_ENV_DIR, 'devcontainer.json');
  const containerResult = await container.devcontainerUp(wsPath.root, containerName, {
    buildNoCache,
    remoteEnv: { AGENT_INSTANCE: wsPath.name, AGENT_ENV_PURPOSE: purpose },
    configPath,
    onProgress,
  });
  if (!containerResult.ok) {
    return { ok: false, error: containerResult.error };
  }

  // Discover actual container name (repo configs may use custom --name)
  let actualName = containerName;
  if (containerResult.containerId) {
    const discovered = await container.getContainerNameById(containerResult.containerId);
    if (discovered) {
      actualName = discovered;
    }
  }

  return { ok: true, containerName: actualName };
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
 * @param options - Rebuild options (force, pull, noCache)
 * @returns RebuildResult with success/failure info
 */
export async function rebuildInstance(
  instanceName: string,
  deps: RebuildInstanceDeps,
  options?: RebuildOptions,
  repoSlug?: string
): Promise<RebuildResult> {
  const { force = false, pull = true, noCache = true, onProgress } = options ?? {};

  // Step 1: Find workspace
  const wsLookup = await lookupWorkspace(instanceName, deps, repoSlug);
  if (!wsLookup.ok) {
    return { ok: false, error: wsLookup.error };
  }
  const { wsPath, state } = wsLookup;
  // Use state's container name for teardown (the old container), but always
  // re-derive the canonical ae-* name for the new container's config.
  // This self-heals legacy instances that stored a random Docker-assigned name.
  const oldContainerName = state.containerName;
  const containerName = deriveContainerName(wsPath.name);

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

  // Step 3: Re-merge devcontainer config (before teardown — if it fails, container is still intact)
  const configResult = await refreshMergedConfig(
    wsPath.root,
    containerName,
    wsPath.name,
    state.repoSlug ?? '',
    state.purpose ?? '',
    state.repoConfigDetected,
    deps
  );
  if (!configResult.ok) {
    return { ok: false, error: configResult.error };
  }

  // Step 4: Parse Dockerfile + pull base images
  const pullStepResult = await executePullStep(wsPath.root, pull, deps);
  if (!pullStepResult.ok) {
    return { ok: false, error: pullStepResult.error };
  }
  const { hasDockerfile } = pullStepResult;

  // Step 5: Check container status (using old name — that's what's running)
  const statusResult = await deps.container.containerStatus(oldContainerName);
  const wasRunning = statusResult.ok && statusResult.status === 'running';

  if (wasRunning && !force) {
    return {
      ok: false,
      error: {
        code: 'CONTAINER_RUNNING',
        message: `Container '${oldContainerName}' is currently running`,
        suggestion:
          'Stop any active sessions first, or use --force to rebuild a running container.',
      },
      wasRunning: true,
    };
  }

  // Step 5.5: Save tmux session state before teardown (best-effort)
  if (wasRunning) {
    await saveTmuxState(oldContainerName, deps);
  }

  // Step 6-7: Stop and remove old container
  const teardownResult = await teardownContainer(oldContainerName, deps.container, statusResult);
  if (!teardownResult.ok) {
    return { ok: false, error: teardownResult.error, wasRunning };
  }

  // Step 8-9: Start fresh container and discover actual name
  // Always use --config pointing to .agent-env/devcontainer.json (the generated merged config)
  const startResult = await startAndDiscoverContainer(
    wsPath,
    containerName,
    state.purpose ?? '',
    noCache && hasDockerfile,
    deps.container,
    onProgress
  );
  if (!startResult.ok) {
    return { ok: false, error: startResult.error, wasRunning };
  }

  // Step 10: Update state with actual name, rebuild timestamp, and repo config status
  const updatedState = {
    ...state,
    containerName: startResult.containerName,
    lastRebuilt: new Date().toISOString(),
    repoConfigDetected: configResult.repoConfigDetected,
  };
  await writeStateAtomic(wsPath, updatedState, deps.stateFsDeps);

  return {
    ok: true,
    containerName: startResult.containerName,
    wasRunning,
  };
}
