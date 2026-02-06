/**
 * Remove instance orchestration for agent-env
 *
 * Orchestrates the full removal flow: find workspace → run safety checks → stop container → remove container → delete workspace.
 * Uses dependency injection for all I/O operations to enable testing.
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createExecutor } from '@zookanalytics/shared';
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';

import type { ContainerLifecycle } from './container.js';
import type { GitStateDetector } from './git.js';
import type { StateFsDeps } from './state.js';
import type { GitState } from './types.js';
import type { DeleteFsDeps, FsDeps } from './workspace.js';

import { findWorkspaceByName } from './attach-instance.js';
import { createContainerLifecycle } from './container.js';
import { createGitStateDetector } from './git.js';
import { readState } from './state.js';
import { deleteWorkspace, getWorkspacePathByName } from './workspace.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export type RemoveResult =
  | { ok: true }
  | {
      ok: false;
      error: { code: string; message: string; suggestion?: string };
      gitState?: GitState;
      blockers?: string[];
    };

export interface RemoveInstanceDeps {
  executor: Execute;
  container: ContainerLifecycle;
  gitDetector: GitStateDetector;
  workspaceFsDeps: FsDeps;
  stateFsDeps: Pick<StateFsDeps, 'readFile'>;
  deleteFsDeps: DeleteFsDeps;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create default dependencies for removeInstance.
 * Useful for production; tests inject their own.
 */
export function createRemoveDefaultDeps(): RemoveInstanceDeps {
  const executor = createExecutor();
  return {
    executor,
    container: createContainerLifecycle(executor),
    gitDetector: createGitStateDetector(executor),
    workspaceFsDeps: { mkdir, readdir, stat, homedir },
    stateFsDeps: { readFile },
    deleteFsDeps: { rm },
  };
}

// ─── Safety Check Evaluation ─────────────────────────────────────────────────

/**
 * Evaluate git state and return list of safety blockers.
 * Each blocker is a human-readable string describing what blocks removal.
 */
export function evaluateSafetyChecks(gitState: GitState): string[] {
  const blockers: string[] = [];

  if (gitState.hasStaged) {
    blockers.push('staged changes detected');
  }

  if (gitState.hasUnstaged) {
    blockers.push('unstaged changes detected');
  }

  if (gitState.hasUntracked) {
    blockers.push('untracked files detected');
  }

  if (gitState.stashCount > 0) {
    blockers.push(
      `stashed changes detected (${gitState.stashCount} stash${gitState.stashCount === 1 ? '' : 'es'})`
    );
  }

  if (gitState.unpushedBranches.length > 0) {
    blockers.push(`unpushed commits on branches: ${gitState.unpushedBranches.join(', ')}`);
  }

  if (gitState.neverPushedBranches.length > 0) {
    blockers.push(`branches never pushed: ${gitState.neverPushedBranches.join(', ')}`);
  }

  if (gitState.isDetachedHead) {
    blockers.push('detached HEAD state (investigate manually)');
  }

  return blockers;
}

// ─── Remove Orchestration ────────────────────────────────────────────────────

/**
 * Remove an instance after passing safety checks.
 *
 * Orchestration flow:
 * 1. Find workspace by instance name
 * 2. Read state to get container name
 * 3. Check Docker availability
 * 4. Run git safety checks inside the workspace
 * 5. If any blockers → return SAFETY_CHECK_FAILED with details
 * 6. Stop container (if running)
 * 7. Remove container
 * 8. Delete workspace folder
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param deps - Injectable dependencies
 * @returns RemoveResult with success/failure info
 */
export async function removeInstance(
  instanceName: string,
  deps: RemoveInstanceDeps,
  force: boolean = false
): Promise<RemoveResult> {
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

  // Step 3: Run git safety checks (if not forced)
  if (!force) {
    // We need to check git state inside the workspace, which may be inside the container.
    // For safety checks, we run git commands against the workspace path on the host filesystem.
    const gitResult = await deps.gitDetector.getGitState(wsPath.root);

    if (!gitResult.ok) {
      return {
        ok: false,
        error: {
          code: 'GIT_ERROR',
          message: `Failed to check git state: ${gitResult.error.message}`,
          suggestion: 'Ensure the workspace contains a valid git repository.',
        },
      };
    }

    // Step 4: Evaluate safety checks
    const blockers = evaluateSafetyChecks(gitResult.state);

    if (blockers.length > 0) {
      return {
        ok: false,
        error: {
          code: 'SAFETY_CHECK_FAILED',
          message: 'Safety checks failed',
          suggestion: 'Resolve the issues above, or use --force to bypass safety checks.',
        },
        gitState: gitResult.state,
        blockers,
      };
    }
  }

  // Step 5: Stop container
  const stopResult = await deps.container.containerStop(containerName);
  if (!stopResult.ok) {
    return {
      ok: false,
      error: stopResult.error,
    };
  }

  // Step 6: Remove container
  const removeResult = await deps.container.containerRemove(containerName);
  if (!removeResult.ok) {
    return {
      ok: false,
      error: removeResult.error,
    };
  }

  // Step 7: Delete workspace folder
  await deleteWorkspace(wsPath, deps.deleteFsDeps);

  return { ok: true };
}
