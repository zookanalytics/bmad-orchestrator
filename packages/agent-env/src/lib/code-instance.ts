/**
 * Code (VS Code open) orchestration for agent-env
 *
 * Orchestrates the flow: find workspace → check Docker → check/start container → devcontainer open.
 * Uses dependency injection for all I/O operations to enable testing.
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createExecutor } from '@zookanalytics/shared';
import {
  appendFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rename,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { ContainerLifecycle } from './container.js';
import type { StateFsDeps } from './state.js';
import type { FsDeps } from './workspace.js';

import { createContainerLifecycle } from './container.js';
import { readState, writeStateAtomic } from './state.js';
import { AGENT_ENV_DIR } from './types.js';
import { getWorkspacePathByName, resolveInstance } from './workspace.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export type CodeResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export interface CodeFsDeps {
  lstat: typeof lstat;
  symlink: typeof symlink;
  readlink: typeof readlink;
  unlink: typeof unlink;
}

export interface CodeInstanceDeps {
  executor: Execute;
  container: ContainerLifecycle;
  workspaceFsDeps: FsDeps;
  stateFsDeps: StateFsDeps;
  codeFsDeps: CodeFsDeps;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create default dependencies for codeInstance.
 * Useful for production; tests inject their own.
 */
export function createCodeDefaultDeps(): CodeInstanceDeps {
  const executor = createExecutor();
  return {
    executor,
    container: createContainerLifecycle(executor),
    workspaceFsDeps: { mkdir, readdir, stat, homedir },
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    codeFsDeps: { lstat, symlink, readlink, unlink },
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Timeout for devcontainer open (30 seconds — may need to launch VS Code) */
const DEVCONTAINER_OPEN_TIMEOUT = 30_000;

// ─── Symlink Helpers ─────────────────────────────────────────────────────────

/**
 * Create a root-level .devcontainer.json symlink to .agent-env/devcontainer.json.
 *
 * The `devcontainer open` CLI requires a devcontainer config at a standard location.
 * Using .devcontainer.json at the workspace root avoids creating/deleting a directory.
 *
 * The symlink is EPHEMERAL — created before `devcontainer open` and removed
 * immediately after by `removeConfigSymlink`. This prevents readRepoConfig
 * from finding the auto-generated config through the symlink on subsequent rebuilds.
 *
 * Idempotent — skips if symlink already correct. Never overwrites real files.
 */
export async function ensureConfigSymlink(wsRoot: string, deps: CodeFsDeps): Promise<void> {
  const symlinkPath = join(wsRoot, '.devcontainer.json');
  const target = join(AGENT_ENV_DIR, 'devcontainer.json');

  try {
    const linkStat = await deps.lstat(symlinkPath);
    if (linkStat.isSymbolicLink()) {
      const existing = await deps.readlink(symlinkPath);
      if (existing === target) return;
      await deps.unlink(symlinkPath);
    } else {
      // Real file — don't touch
      return;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  await deps.symlink(target, symlinkPath);
}

/**
 * Remove the ephemeral .devcontainer.json symlink.
 *
 * Only removes symlinks (never real files). Best-effort.
 */
export async function removeConfigSymlink(wsRoot: string, deps: CodeFsDeps): Promise<void> {
  const symlinkPath = join(wsRoot, '.devcontainer.json');

  try {
    const linkStat = await deps.lstat(symlinkPath);
    if (!linkStat.isSymbolicLink()) return;
    await deps.unlink(symlinkPath);
  } catch {
    // Already gone or inaccessible
  }
}

// ─── Code Orchestration ─────────────────────────────────────────────────────

/**
 * Open VS Code attached to an existing instance's devcontainer.
 *
 * Orchestration flow:
 * 1. Resolve instance using two-phase resolution (repo-scoped → global)
 * 2. Read state to get container name
 * 3. Check Docker availability
 * 4. Check container status; start container if stopped
 * 5. Create ephemeral .devcontainer symlink (repos without own config)
 * 6. Run `devcontainer open` to launch VS Code
 * 7. Remove ephemeral symlink (always, via finally)
 * 8. Update lastAttached timestamp
 */
export async function codeInstance(
  instanceName: string,
  deps: CodeInstanceDeps,
  onContainerStarting?: () => void,
  onOpening?: () => void,
  repoSlug?: string
): Promise<CodeResult> {
  // Step 1: Resolve instance
  const lookup = await resolveInstance(instanceName, repoSlug, {
    fsDeps: deps.workspaceFsDeps,
    readFile: deps.stateFsDeps.readFile,
  });

  if (!lookup.found) {
    return { ok: false, error: lookup.error };
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

  // Step 3: Check container status
  const statusResult = await deps.container.containerStatus(containerName);

  if (!statusResult.ok) {
    return {
      ok: false,
      error: statusResult.error ?? {
        code: 'CONTAINER_ERROR',
        message: `Failed to check container status for '${containerName}'.`,
      },
    };
  }

  // Step 4: Start container if stopped or not found
  const configPath = join(wsPath.root, AGENT_ENV_DIR, 'devcontainer.json');

  if (statusResult.status === 'stopped' || statusResult.status === 'not-found') {
    onContainerStarting?.();

    const startResult = await deps.container.devcontainerUp(wsPath.root, containerName, {
      remoteEnv: { AGENT_INSTANCE: wsPath.name },
      configPath,
    });

    if (!startResult.ok) {
      return {
        ok: false,
        error: startResult.error ?? {
          code: 'CONTAINER_ERROR',
          message: `Failed to start container '${containerName}'.`,
          suggestion: 'Check Docker logs for details.',
        },
      };
    }
  }

  // Step 5-7: Ephemeral symlink + devcontainer open + cleanup
  const needsSymlink = !state.repoConfigDetected;

  if (needsSymlink) {
    try {
      await ensureConfigSymlink(wsPath.root, deps.codeFsDeps);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: {
          code: 'SYMLINK_FAILED',
          message: `Failed to create .devcontainer symlink in '${wsPath.root}': ${detail}`,
          suggestion: 'Check file permissions in the workspace directory.',
        },
      };
    }
  }

  let openResult: ExecuteResult;
  try {
    onOpening?.();
    openResult = await deps.executor(
      'devcontainer',
      ['open', wsPath.root, '--config', configPath],
      { stdio: 'inherit', timeout: DEVCONTAINER_OPEN_TIMEOUT }
    );
  } finally {
    if (needsSymlink) {
      await removeConfigSymlink(wsPath.root, deps.codeFsDeps);
    }
  }

  if (!openResult.ok) {
    return {
      ok: false,
      error: {
        code: 'VSCODE_OPEN_FAILED',
        message: `Failed to open VS Code for instance '${instanceName}'.`,
        suggestion: 'Ensure VS Code and the Dev Containers extension are installed.',
      },
    };
  }

  // Step 8: Update lastAttached timestamp
  const updatedState = {
    ...state,
    lastAttached: new Date().toISOString(),
  };
  await writeStateAtomic(wsPath, updatedState, deps.stateFsDeps);

  return { ok: true };
}
