/**
 * Create instance orchestration for agent-env
 *
 * Orchestrates the full create flow: validate → clone → copy baseline → start container → write state.
 * Uses dependency injection for all I/O operations to enable testing.
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createExecutor } from '@zookanalytics/shared';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

import type { ContainerLifecycle } from './container.js';
import type { DevcontainerFsDeps } from './devcontainer.js';
import type { StateFsDeps } from './state.js';
import type { WorkspacePath } from './types.js';
import type { FsDeps } from './workspace.js';

import { createContainerLifecycle } from './container.js';
import { copyBaselineConfig, hasDevcontainerConfig, patchContainerName } from './devcontainer.js';
import { createInitialState, writeStateAtomic } from './state.js';
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
    stateFsDeps: { readFile, writeFile, rename, mkdir },
    devcontainerFsDeps: { cp, mkdir, readFile, stat, writeFile },
    rm,
  };
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
 * @returns CreateResult with success/failure info
 */
export async function createInstance(
  instanceName: string,
  repoUrl: string,
  deps: CreateInstanceDeps
): Promise<CreateResult> {
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
  await deps.workspaceFsDeps.mkdir(dirname(wsPath.root), { recursive: true });

  const cloneResult = await deps.executor('git', ['clone', repoUrl, wsPath.root], {
    timeout: GIT_CLONE_TIMEOUT,
  });

  if (!cloneResult.ok) {
    // Clean up any partial clone
    await safeRollback(wsPath.root, deps.rm);
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
  await deps.workspaceFsDeps.mkdir(wsPath.agentEnvDir, { recursive: true });

  // Step 5: Copy baseline devcontainer config if none exists
  const hasConfig = await hasDevcontainerConfig(wsPath.root, deps.devcontainerFsDeps);
  if (!hasConfig) {
    try {
      await copyBaselineConfig(wsPath.root, deps.devcontainerFsDeps);
    } catch (err) {
      await safeRollback(wsPath.root, deps.rm);
      return {
        ok: false,
        error: {
          code: 'CONTAINER_ERROR',
          message: `Failed to copy baseline devcontainer config: ${err instanceof Error ? err.message : String(err)}`,
        },
      };
    }

    // Step 5b: Patch our baseline devcontainer.json with the container name.
    // Only done for baseline configs we control (valid JSON). Repo-provided
    // configs may use JSONC (comments/trailing commas) and shouldn't be modified.
    try {
      await patchContainerName(wsPath.root, containerName, deps.devcontainerFsDeps);
    } catch (err) {
      await safeRollback(wsPath.root, deps.rm);
      return {
        ok: false,
        error: {
          code: 'CONTAINER_ERROR',
          message: `Failed to patch devcontainer.json with container name: ${err instanceof Error ? err.message : String(err)}`,
        },
      };
    }
  }

  // Step 6: Start container
  const containerResult = await deps.container.devcontainerUp(wsPath.root, containerName);
  if (!containerResult.ok) {
    await safeRollback(wsPath.root, deps.rm);
    return {
      ok: false,
      error: containerResult.error ?? {
        code: 'CONTAINER_ERROR',
        message: 'Container startup failed for unknown reason.',
      },
    };
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
    console.warn(
      `Warning: devcontainer started successfully but no containerId returned. Using derived name '${containerName}'.`
    );
  }

  // Step 7: Write initial state
  const state = createInitialState(wsPath.name, repoUrl, actualContainerName);
  await writeStateAtomic(wsPath, state, deps.stateFsDeps);

  return {
    ok: true,
    workspacePath: wsPath,
    containerName: actualContainerName,
  };
}

// ─── Rollback ────────────────────────────────────────────────────────────────

/**
 * Safely remove a workspace directory during rollback.
 * Logs but does not throw on failure.
 */
async function safeRollback(workspacePath: string, rmFn: typeof rm): Promise<void> {
  try {
    await rmFn(workspacePath, { recursive: true, force: true });
  } catch {
    // Rollback failure is logged but not thrown - the primary error is more important
    console.warn(`Warning: Failed to clean up workspace at ${workspacePath}`);
  }
}
