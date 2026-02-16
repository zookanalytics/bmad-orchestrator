/**
 * Create instance orchestration for agent-env
 *
 * Orchestrates the full create flow: validate → clone → copy baseline → start container → write state.
 * Uses dependency injection for all I/O operations to enable testing.
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createExecutor } from '@zookanalytics/shared';
import {
  appendFile,
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { ContainerLifecycle } from './container.js';
import type { DevcontainerFsDeps } from './devcontainer.js';
import type { StateFsDeps } from './state.js';
import type { ContainerError, WorkspacePath } from './types.js';
import type { FsDeps } from './workspace.js';

import { createContainerLifecycle } from './container.js';
import {
  copyBaselineConfig,
  hasDevcontainerConfig,
  patchContainerEnv,
  patchContainerName,
} from './devcontainer.js';
import { MAX_PURPOSE_LENGTH } from './purpose-instance.js';
import { createInitialState, ensureGitExclude, writeStateAtomic } from './state.js';
import { AGENT_ENV_DIR } from './types.js';
import { deriveContainerName, getWorkspacePath, workspaceExists } from './workspace.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Timeout for git clone operation (120 seconds) */
const GIT_CLONE_TIMEOUT = 120_000;

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export type CreateResult =
  | {
      ok: true;
      workspacePath: WorkspacePath;
      containerName: string;
    }
  | {
      ok: false;
      error: { code: string; message: string; suggestion?: string };
    };

export interface CreateInstanceDeps {
  executor: Execute;
  container: ContainerLifecycle;
  workspaceFsDeps: FsDeps;
  stateFsDeps: StateFsDeps;
  devcontainerFsDeps: Pick<DevcontainerFsDeps, 'cp' | 'mkdir' | 'readFile' | 'stat' | 'writeFile'>;
  rm: typeof rm;
  logger?: {
    warn: (message: string) => void;
    info: (message: string) => void;
  };
}

// ─── URL Parsing ─────────────────────────────────────────────────────────────

/**
 * Extract repository name from a git URL.
 *
 * Supports:
 * - HTTPS: https://github.com/user/repo-name.git → "repo-name"
 * - HTTPS without .git: https://github.com/user/repo-name → "repo-name"
 * - SSH: git@github.com:user/repo-name.git → "repo-name"
 * - SSH without .git: git@github.com:user/repo-name → "repo-name"
 *
 * @param url - Git repository URL (HTTPS or SSH)
 * @returns Repository name extracted from URL
 * @throws If URL cannot be parsed
 */
export function extractRepoName(url: string): string {
  // Remove trailing slashes and the .git suffix to normalize the URL
  const cleaned = url.replace(/\/+$/, '').replace(/\.git$/, '');

  // The repository name is the last segment after the final '/' or ':'
  const lastSlash = cleaned.lastIndexOf('/');
  const lastColon = cleaned.lastIndexOf(':');
  const lastSeparator = Math.max(lastSlash, lastColon);

  // If there's no separator, the URL itself might be the repo name
  if (lastSeparator === -1) {
    if (!cleaned) {
      throw new Error(`Cannot extract repository name from URL: ${url}`);
    }
    return cleaned;
  }

  const repoName = cleaned.slice(lastSeparator + 1);

  if (!repoName) {
    throw new Error(`Cannot extract repository name from URL: ${url}`);
  }

  return repoName;
}

// ─── Repo URL Resolution ──────────────────────────────────────────────────

export type ResolveResult =
  | { ok: true; url: string }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export type AttachResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

/**
 * Resolve a repo argument to a git URL.
 *
 * If repoArg is ".", detects the git remote URL of the current directory
 * using `git remote get-url origin`. Otherwise, returns the repoArg as-is.
 *
 * @param repoArg - Git repository URL or "." for current directory
 * @param executor - Subprocess executor for running git commands
 * @returns Resolved URL or error
 */
export async function resolveRepoUrl(repoArg: string, executor: Execute): Promise<ResolveResult> {
  if (repoArg !== '.') {
    return { ok: true, url: repoArg };
  }

  const result = await executor('git', ['remote', 'get-url', 'origin']);

  if (!result.ok || !result.stdout.trim()) {
    return {
      ok: false,
      error: {
        code: 'GIT_ERROR',
        message: 'No git remote found in current directory',
        suggestion:
          'Ensure you are in a git repository with an "origin" remote, or provide an explicit --repo URL.',
      },
    };
  }

  const url = result.stdout.trim();
  return { ok: true, url };
}

// ─── Attach ───────────────────────────────────────────────────────────────

/**
 * Attach to an instance's tmux session inside its container.
 *
 * Uses `docker exec -it` to connect to the container and attach to
 * (or create) a tmux session named "main". Uses stdio: 'inherit'
 * so the user's terminal is replaced by the tmux session.
 *
 * @param containerName - Docker container name (e.g., "ae-bmad-orch-auth")
 * @param executor - Subprocess executor
 * @returns Result indicating success or failure
 */
export async function attachToInstance(
  containerName: string,
  executor: Execute
): Promise<AttachResult> {
  // Use docker exec with -it to attach to tmux session
  // The command tries to attach to existing session, or creates one
  // 2>/dev/null suppresses stderr noise when no existing session (normal first-attach)
  const result = await executor(
    'docker',
    [
      'exec',
      '-it',
      containerName,
      'bash',
      '-c',
      'tmux attach-session -t main 2>/dev/null || tmux new-session -s main',
    ],
    { stdio: 'inherit' }
  );

  if (!result.ok) {
    const stderr = result.stderr.toLowerCase();
    const isTmuxIssue = stderr.includes('tmux') || stderr.includes('command not found');
    return {
      ok: false,
      error: {
        code: 'CONTAINER_ERROR',
        message: isTmuxIssue
          ? `tmux is not available in container '${containerName}': ${result.stderr}`
          : `Failed to attach to container '${containerName}': ${result.stderr}`,
        suggestion: isTmuxIssue
          ? 'Ensure tmux is installed in the container image.'
          : 'Ensure the container is running. Use `agent-env list` to check status.',
      },
    };
  }

  return { ok: true };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create default dependencies for createInstance.
 * Useful for production; tests inject their own.
 */
export function createDefaultDeps(): CreateInstanceDeps {
  const executor = createExecutor();
  return {
    executor,
    container: createContainerLifecycle(executor),
    workspaceFsDeps: { mkdir, readdir, stat, homedir },
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    devcontainerFsDeps: { cp, mkdir, readFile, stat, writeFile },
    rm,
    logger: {
      warn: (msg) => console.warn(msg),
      info: (msg) => console.info(msg),
    },
  };
}

/**
 * Set up the devcontainer configuration for the workspace.
 * Returns the config source ('baseline' or 'repo') on success, or a CreateResult error on failure.
 */
async function setupDevcontainerConfig(
  wsPath: WorkspacePath,
  containerName: string,
  repoName: string,
  purposeText: string,
  deps: CreateInstanceDeps
): Promise<{ ok: true; configSource: 'baseline' | 'repo' } | (CreateResult & { ok: false })> {
  const hasConfig = await hasDevcontainerConfig(wsPath.root, deps.devcontainerFsDeps);
  if (hasConfig) {
    return { ok: true, configSource: 'repo' };
  }

  try {
    await copyBaselineConfig(wsPath.root, deps.devcontainerFsDeps);
  } catch (err) {
    await safeRollback(wsPath.root, deps.rm, deps.logger);
    return {
      ok: false,
      error: {
        code: 'CONTAINER_ERROR',
        message: `Failed to copy baseline devcontainer config: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  try {
    await patchContainerName(wsPath.root, containerName, deps.devcontainerFsDeps, AGENT_ENV_DIR);
    await patchContainerEnv(
      wsPath.root,
      {
        AGENT_ENV_INSTANCE: wsPath.name,
        AGENT_ENV_REPO: repoName,
        AGENT_ENV_PURPOSE: purposeText,
      },
      deps.devcontainerFsDeps,
      AGENT_ENV_DIR
    );
  } catch (err) {
    await safeRollback(wsPath.root, deps.rm, deps.logger);
    return {
      ok: false,
      error: {
        code: 'CONTAINER_ERROR',
        message: `Failed to patch baseline devcontainer.json: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  return { ok: true, configSource: 'baseline' };
}

/**
 * Create a new instance from a git repository.
 *
 * Orchestration flow:
 * 1. Extract repo name from URL
 * 2. Check if workspace already exists (error if duplicate)
 * 3. Create workspace directory
 * 4. Clone repo into workspace
 * 5. Copy baseline devcontainer if none exists
 * 6. Start container via devcontainer up
 * 7. Write initial state.json
 *
 * On failure at any step after workspace creation, rolls back by removing
 * the workspace directory.
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param repoUrl - Git repository URL (HTTPS or SSH)
 * @param deps - Injectable dependencies
 * @param options - Optional parameters (purpose)
 * @returns CreateResult with success/failure info
 */
export async function createInstance(
  instanceName: string,
  repoUrl: string,
  deps: CreateInstanceDeps,
  options?: { purpose?: string }
): Promise<CreateResult> {
  const purposeText = options?.purpose ?? '';
  const purposeState = options?.purpose ?? null;

  // Validate purpose length before any I/O
  if (purposeText.length > MAX_PURPOSE_LENGTH) {
    return {
      ok: false,
      error: {
        code: 'PURPOSE_TOO_LONG',
        message: `Purpose must be ${MAX_PURPOSE_LENGTH} characters or fewer (got ${purposeText.length})`,
      },
    };
  }

  // Step 1: Extract repo name from URL
  let repoName: string;
  try {
    repoName = extractRepoName(repoUrl);
  } catch {
    return {
      ok: false,
      error: {
        code: 'GIT_ERROR',
        message: `Invalid repository URL: ${repoUrl}`,
        suggestion: 'Provide a valid HTTPS or SSH git URL.',
      },
    };
  }

  // Step 2: Derive workspace path and check for duplicates
  const wsPath = getWorkspacePath(repoName, instanceName, deps.workspaceFsDeps);
  const containerName = deriveContainerName(wsPath.name);

  const exists = await workspaceExists(repoName, instanceName, deps.workspaceFsDeps);
  if (exists) {
    return {
      ok: false,
      error: {
        code: 'INSTANCE_EXISTS',
        message: `Instance '${instanceName}' already exists for repo '${repoName}'`,
        suggestion: `Choose a different instance name or remove the existing one first.`,
      },
    };
  }

  // Step 3: Clone repo into workspace path
  // Create parent directories first
  try {
    await deps.workspaceFsDeps.mkdir(dirname(wsPath.root), { recursive: true });
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'WORKSPACE_ERROR',
        message: `Failed to create workspace directory: ${err instanceof Error ? err.message : String(err)}`,
        suggestion: 'Check filesystem permissions for the ~/.agent-env directory.',
      },
    };
  }

  const cloneResult = await deps.executor('git', ['clone', repoUrl, wsPath.root], {
    timeout: GIT_CLONE_TIMEOUT,
  });

  if (!cloneResult.ok) {
    // Clean up any partial clone
    await safeRollback(wsPath.root, deps.rm, deps.logger);
    return {
      ok: false,
      error: {
        code: 'GIT_ERROR',
        message: `Git clone failed: ${cloneResult.stderr}`,
        suggestion: 'Check the repository URL and your access permissions.',
      },
    };
  }

  // Step 4: Create .agent-env directory in workspace
  try {
    await deps.workspaceFsDeps.mkdir(wsPath.agentEnvDir, { recursive: true });
  } catch (err) {
    await safeRollback(wsPath.root, deps.rm, deps.logger);
    return {
      ok: false,
      error: {
        code: 'WORKSPACE_ERROR',
        message: `Failed to create .agent-env directory: ${err instanceof Error ? err.message : String(err)}`,
        suggestion: 'Check filesystem permissions in the cloned workspace directory.',
      },
    };
  }

  // Step 5: Copy baseline devcontainer config if none exists, patch with instance env vars
  const configResult = await setupDevcontainerConfig(
    wsPath,
    containerName,
    repoName,
    purposeText,
    deps
  );
  if (!configResult.ok) {
    return configResult;
  }
  const { configSource } = configResult;

  // Step 5c: Pre-flight check for existing containers at this workspace path
  const existingContainer = await deps.container.findContainerByWorkspaceLabel(wsPath.root);
  if (existingContainer) {
    await safeRollback(wsPath.root, deps.rm, deps.logger);
    return {
      ok: false,
      error: {
        code: 'CONTAINER_EXISTS',
        message: `A container '${existingContainer}' already exists for this workspace path.`,
        suggestion: `Remove it first with: docker rm -f ${existingContainer}`,
      },
    };
  }

  // Step 6: Start container
  // Pass AGENT_INSTANCE so the image's postCreateCommand can set up per-instance
  // isolation (shared credentials + per-instance history/state).
  // For baseline configs (in .agent-env/), pass --config so the devcontainer CLI
  // finds the config instead of looking in the default .devcontainer/ location.
  const baselineConfigPath =
    configSource === 'baseline' ? join(wsPath.root, AGENT_ENV_DIR, 'devcontainer.json') : undefined;
  const containerResult = await deps.container.devcontainerUp(wsPath.root, containerName, {
    remoteEnv: {
      AGENT_INSTANCE: wsPath.name,
      AGENT_ENV_PURPOSE: purposeText,
    },
    configPath: baselineConfigPath,
  });
  if (!containerResult.ok) {
    return rollbackContainerFailure(containerName, wsPath, containerResult, deps);
  }

  // Step 6b: Discover actual container name
  // The repo's devcontainer.json may have its own --name in runArgs, so the actual
  // container name may differ from our derived ae-* name. Query Docker to find out.
  let actualContainerName = containerName;
  if (containerResult.containerId) {
    const discovered = await deps.container.getContainerNameById(containerResult.containerId);
    if (discovered) {
      actualContainerName = discovered;
    }
  } else {
    // Container started but no containerId returned - unusual state, log for debugging
    deps.logger?.warn(
      `Warning: devcontainer started successfully but no containerId returned. Using derived name '${containerName}'.`
    );
  }

  // Step 7: Write initial state
  const state = createInitialState(wsPath.name, repoUrl, {
    containerName: actualContainerName,
    configSource,
    purpose: purposeState,
  });
  await writeStateAtomic(wsPath, state, deps.stateFsDeps);

  // Step 8: Ensure .agent-env/ is in .git/info/exclude so state files don't show as untracked
  await ensureGitExclude(wsPath.root, deps.stateFsDeps);

  return {
    ok: true,
    workspacePath: wsPath,
    containerName: actualContainerName,
  };
}

// ─── Rollback ────────────────────────────────────────────────────────────────

/**
 * Handle container startup failure: capture logs, clean up, and return error.
 */
async function rollbackContainerFailure(
  containerName: string,
  wsPath: WorkspacePath,
  containerResult: ContainerError,
  deps: CreateInstanceDeps
): Promise<CreateResult> {
  deps.logger?.warn(`Rolling back workspace at ${wsPath.root} due to container startup failure.`);

  // Best-effort: capture docker logs before cleanup destroys the container.
  const dockerLogs = await safeCaptureDockerLogs(containerName, wsPath.root, deps);

  // Clean up the Docker container (may have been created before post-create failed)
  await safeContainerCleanup(containerName, wsPath.root, deps.container, deps.logger);
  await safeRollback(wsPath.root, deps.rm, deps.logger);

  // Build error with docker logs appended if available
  const baseError = containerResult.error ?? {
    code: 'CONTAINER_ERROR',
    message: 'Container startup failed for unknown reason.',
  };
  const error = dockerLogs
    ? { ...baseError, message: `${baseError.message}\n   --- docker logs ---\n   ${dockerLogs}` }
    : baseError;

  return { ok: false, error };
}

/** Timeout for docker logs capture (5 seconds — we don't want to delay error reporting) */
const DOCKER_LOGS_TIMEOUT = 5_000;

/**
 * Best-effort capture of docker logs before container cleanup.
 * Returns the last 100 lines of container logs, or null if unavailable.
 */
async function safeCaptureDockerLogs(
  containerName: string,
  workspacePath: string,
  deps: Pick<CreateInstanceDeps, 'executor' | 'container'>
): Promise<string | null> {
  // Try expected container name, then fall back to workspace label lookup
  const candidates = [containerName];
  try {
    const labelMatch = await deps.container.findContainerByWorkspaceLabel(workspacePath);
    if (labelMatch && labelMatch !== containerName) candidates.push(labelMatch);
  } catch {
    // Best-effort
  }

  for (const name of candidates) {
    try {
      const result = await deps.executor('docker', ['logs', '--tail', '100', name], {
        timeout: DOCKER_LOGS_TIMEOUT,
      });
      if (result.ok) {
        // Combine stdout and stderr — container diagnostics can appear on either stream
        const combined = [result.stdout.trim(), result.stderr.trim()]
          .filter(Boolean)
          .join('\n--- stderr ---\n');
        if (combined) return combined;
      }
    } catch {
      // Best-effort — continue to next candidate
    }
  }
  return null;
}

/**
 * Safely stop and remove a Docker container during rollback.
 *
 * The container may have been created by `devcontainer up` before the
 * postCreateCommand failed. Try both the expected name and a workspace-label
 * lookup (the repo's devcontainer.json may override the container name).
 */
async function safeContainerCleanup(
  containerName: string,
  workspacePath: string,
  container: ContainerLifecycle,
  logger?: { warn: (msg: string) => void }
): Promise<void> {
  // Try the expected name first, then fall back to workspace label lookup
  const candidates = new Set<string>([containerName]);
  try {
    const labelMatch = await container.findContainerByWorkspaceLabel(workspacePath);
    if (labelMatch) candidates.add(labelMatch);
  } catch {
    // Best-effort lookup
  }

  for (const name of candidates) {
    try {
      await container.containerStop(name);
      await container.containerRemove(name);
    } catch {
      logger?.warn(`Warning: Failed to clean up container '${name}'`);
    }
  }
}

/**
 * Safely remove a workspace directory during rollback.
 * Logs but does not throw on failure.
 */
async function safeRollback(
  workspacePath: string,
  rmFn: typeof rm,
  logger?: { warn: (msg: string) => void }
): Promise<void> {
  try {
    await rmFn(workspacePath, { recursive: true, force: true });
  } catch {
    // Rollback failure is logged but not thrown - the primary error is more important
    logger?.warn(`Warning: Failed to clean up workspace at ${workspacePath}`);
  }
}
