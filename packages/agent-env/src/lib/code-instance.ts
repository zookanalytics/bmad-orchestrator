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
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';

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
  mkdir: typeof mkdir;
  lstat: typeof lstat;
  symlink: typeof symlink;
  readlink: typeof readlink;
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
    codeFsDeps: { mkdir, lstat, symlink, readlink },
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Timeout for devcontainer open (30 seconds — may need to launch VS Code) */
const DEVCONTAINER_OPEN_TIMEOUT = 30_000;

// ─── Symlink Helper ─────────────────────────────────────────────────────────

/**
 * Ensure .devcontainer/devcontainer.json exists as a symlink to .agent-env/devcontainer.json.
 *
 * The `devcontainer open` CLI ignores `--config` for its gate check — it requires
 * `.devcontainer/devcontainer.json` to exist in the workspace folder. This symlink
 * satisfies that check while keeping the real config in `.agent-env/`.
 *
 * Only creates the symlink for repos without their own .devcontainer config
 * (repoConfigDetected: false). Idempotent — skips if symlink already exists and
 * points to the right target.
 */
export async function ensureDevcontainerSymlink(wsRoot: string, deps: CodeFsDeps): Promise<void> {
  const devcontainerDir = join(wsRoot, '.devcontainer');
  const symlinkPath = join(devcontainerDir, 'devcontainer.json');
  const target = relative(devcontainerDir, join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'));

  // Check if symlink already exists and points to the right place
  try {
    const linkStat = await deps.lstat(symlinkPath);
    if (linkStat.isSymbolicLink()) {
      const existing = await deps.readlink(symlinkPath);
      if (existing === target) return; // Already correct
    }
    // Exists but is not a symlink (user's real file) — don't touch it
    if (!linkStat.isSymbolicLink()) return;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    // Doesn't exist — create it below
  }

  await deps.mkdir(devcontainerDir, { recursive: true });
  await deps.symlink(target, symlinkPath);
}

// ─── Code Orchestration ─────────────────────────────────────────────────────

/**
 * Open VS Code attached to an existing instance's devcontainer.
 *
 * Orchestration flow:
 * 1. Resolve instance using two-phase resolution (repo-scoped → global)
 * 2. Read state to get container name
 * 3. Check Docker availability
 * 4. Check container status
 * 5. If stopped → start container via devcontainerUp
 * 6. Run `devcontainer open` to launch VS Code
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param deps - Injectable dependencies
 * @param onContainerStarting - Optional callback for progress output
 * @param onOpening - Optional callback when opening VS Code
 * @param repoSlug - Optional repo slug from --repo flag or cwd inference
 * @returns CodeResult with success/failure info
 */
export async function codeInstance(
  instanceName: string,
  deps: CodeInstanceDeps,
  onContainerStarting?: () => void,
  onOpening?: () => void,
  repoSlug?: string
): Promise<CodeResult> {
  // Step 1: Resolve instance using two-phase resolution
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

  // Step 5: Ensure .devcontainer/devcontainer.json symlink for repos without their own config.
  // devcontainer open ignores --config for its gate check and requires this file to exist.
  if (!state.repoConfigDetected) {
    await ensureDevcontainerSymlink(wsPath.root, deps.codeFsDeps);
  }

  // Step 6: Open VS Code via devcontainer open
  onOpening?.();
  const openResult = await deps.executor(
    'devcontainer',
    ['open', wsPath.root, '--config', configPath],
    { stdio: 'inherit', timeout: DEVCONTAINER_OPEN_TIMEOUT }
  );

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

  // Step 6: Update lastAttached timestamp
  const updatedState = {
    ...state,
    lastAttached: new Date().toISOString(),
  };
  await writeStateAtomic(wsPath, updatedState, deps.stateFsDeps);

  return { ok: true };
}
