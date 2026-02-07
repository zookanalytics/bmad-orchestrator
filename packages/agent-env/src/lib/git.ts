/**
 * Git state detection for agent-env workspaces
 *
 * Provides comprehensive git state analysis including working tree status,
 * stash count, unpushed branches, never-pushed branches, and detached HEAD.
 * Uses dependency injection for the subprocess executor to enable testing.
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createExecutor } from '@zookanalytics/shared';

import type { GitState, GitStateResult } from './types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Timeout for individual git commands (5 seconds) */
export const GIT_COMMAND_TIMEOUT = 5_000;

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export interface GitStateDetector {
  getGitState(workspacePath: string): Promise<GitStateResult>;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a git state detector with injectable executor.
 *
 * @param executor - Subprocess executor (defaults to shared createExecutor)
 * @returns GitStateDetector with getGitState method
 */
export function createGitStateDetector(executor: Execute = createExecutor()): GitStateDetector {
  /**
   * Detect comprehensive git state for a workspace.
   *
   * Runs multiple git commands in parallel for performance, then
   * combines results into a single GitState object.
   *
   * @param workspacePath - Absolute path to the workspace root (containing .git)
   * @returns GitStateResult with detected state or error
   */
  async function getGitState(workspacePath: string): Promise<GitStateResult> {
    const makeOpts = () => ({ timeout: GIT_COMMAND_TIMEOUT, cwd: workspacePath });

    // Run independent git commands in parallel
    const [statusResult, stashResult, branchResult, headResult] = await Promise.allSettled([
      executor('git', ['status', '--porcelain'], makeOpts()),
      executor('git', ['stash', 'list'], makeOpts()),
      executor(
        'git',
        [
          'for-each-ref',
          '--format=%(refname:short) %(upstream:short) %(upstream:track)',
          'refs/heads',
        ],
        makeOpts()
      ),
      executor('git', ['symbolic-ref', 'HEAD'], makeOpts()),
    ]);

    // Extract results (allSettled never rejects, but handle defensively)
    const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
    const stash = stashResult.status === 'fulfilled' ? stashResult.value : null;
    const branch = branchResult.status === 'fulfilled' ? branchResult.value : null;
    const head = headResult.status === 'fulfilled' ? headResult.value : null;

    // If git status fails, the workspace likely isn't a git repo
    if (!status || !status.ok) {
      const stderr = status?.stderr ?? 'git status command failed';
      return {
        ok: false,
        state: null,
        error: {
          code: 'GIT_ERROR',
          message: `Failed to read git status: ${stderr}`,
        },
      };
    }

    // Parse working tree status
    const { hasStaged, stagedCount, hasUnstaged, unstagedCount, hasUntracked, untrackedCount } =
      parseStatus(status.stdout);

    // Parse stash info
    const { stashCount, firstStashMessage } = parseStash(stash);

    // Parse branch information
    const { unpushedBranches, unpushedCommitCounts, neverPushedBranches } = parseBranches(branch);

    // Detect detached HEAD: symbolic-ref fails when HEAD is detached
    const isDetachedHead = !head || !head.ok;

    // Compute isClean: no local changes and all branches pushed
    const isClean =
      !hasStaged &&
      !hasUnstaged &&
      !hasUntracked &&
      stashCount === 0 &&
      unpushedBranches.length === 0 &&
      neverPushedBranches.length === 0 &&
      !isDetachedHead;

    const state: GitState = {
      hasStaged,
      stagedCount,
      hasUnstaged,
      unstagedCount,
      hasUntracked,
      untrackedCount,
      stashCount,
      firstStashMessage,
      unpushedBranches,
      unpushedCommitCounts,
      neverPushedBranches,
      isDetachedHead,
      isClean,
    };

    return { ok: true, state };
  }

  return { getGitState };
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parse `git status --porcelain` output.
 *
 * Porcelain format uses two-character status codes:
 * - Column 1: staged status (index)
 * - Column 2: working tree status
 * - `??` means untracked
 */
function parseStatus(stdout: string): {
  hasStaged: boolean;
  stagedCount: number;
  hasUnstaged: boolean;
  unstagedCount: number;
  hasUntracked: boolean;
  untrackedCount: number;
} {
  let stagedCount = 0;
  let unstagedCount = 0;
  let untrackedCount = 0;

  if (!stdout.trim()) {
    return {
      hasStaged: false,
      stagedCount: 0,
      hasUnstaged: false,
      unstagedCount: 0,
      hasUntracked: false,
      untrackedCount: 0,
    };
  }

  for (const line of stdout.split('\n')) {
    if (!line || line.length < 2) continue;

    if (line.startsWith('??')) {
      untrackedCount++;
      continue;
    }

    // Skip ignored files (!! prefix, only appears with --ignored flag)
    if (line.startsWith('!!')) {
      continue;
    }

    const indexStatus = line[0];
    const workTreeStatus = line[1];

    // Staged: valid index status chars are M, A, D, R, C (modified, added, deleted, renamed, copied)
    // Note: U (unmerged/conflict) is intentionally excluded — conflicts are counted as unstaged
    // to ensure dirty state blocks removal. Precise conflict detection is a future enhancement.
    if ('MADRC'.includes(indexStatus)) {
      stagedCount++;
    }
    // Unstaged: non-space in column 2 indicates working tree changes
    if (workTreeStatus !== ' ') {
      unstagedCount++;
    }
  }

  return {
    hasStaged: stagedCount > 0,
    stagedCount,
    hasUnstaged: unstagedCount > 0,
    unstagedCount,
    hasUntracked: untrackedCount > 0,
    untrackedCount,
  };
}

/**
 * Parse `git stash list` output — each line is a stash entry.
 * Returns count and first stash message.
 */
function parseStash(result: ExecuteResult | null): {
  stashCount: number;
  firstStashMessage: string;
} {
  if (!result || !result.ok || !result.stdout.trim()) {
    return { stashCount: 0, firstStashMessage: '' };
  }
  const lines = result.stdout.trim().split('\n');
  // Format: "stash@{0}: WIP on branch: hash message" or "stash@{0}: On branch: message"
  // Extract message after the first ": " following the stash ref
  let firstStashMessage = '';
  if (lines[0]) {
    const colonIndex = lines[0].indexOf(': ');
    firstStashMessage = colonIndex !== -1 ? lines[0].slice(colonIndex + 2) : lines[0];
  }
  return { stashCount: lines.length, firstStashMessage };
}

/**
 * Parse `git for-each-ref` output for unpushed and never-pushed branches.
 *
 * Format: `branchname upstream_ref [ahead N]`
 * - Branch with upstream and [ahead N]: has unpushed commits
 * - Branch with no upstream: never pushed
 */
function parseBranches(result: ExecuteResult | null): {
  unpushedBranches: string[];
  unpushedCommitCounts: Record<string, number>;
  neverPushedBranches: string[];
} {
  const unpushedBranches: string[] = [];
  const unpushedCommitCounts: Record<string, number> = {};
  const neverPushedBranches: string[] = [];

  if (!result || !result.ok || !result.stdout.trim()) {
    return { unpushedBranches, unpushedCommitCounts, neverPushedBranches };
  }

  for (const line of result.stdout.trim().split('\n')) {
    if (!line.trim()) continue;

    // Format: `%(refname:short) %(upstream:short) %(upstream:track)`
    // When upstream is empty, git produces empty fields — filter them out
    const parts = line.split(' ').filter(Boolean);
    const branchName = parts[0];
    const trackInfo = parts.slice(1).join(' ');

    if (parts.length === 1) {
      // Only branch name, no upstream fields — never pushed
      neverPushedBranches.push(branchName);
    } else if (trackInfo.includes('[ahead')) {
      // Has upstream with unpushed commits — extract count from "[ahead N]" or "[ahead N, behind M]"
      const aheadMatch = trackInfo.match(/\[ahead (\d+)/);
      const count = aheadMatch ? parseInt(aheadMatch[1], 10) : 0;
      unpushedBranches.push(branchName);
      unpushedCommitCounts[branchName] = count;
    }
    // else: has upstream, up-to-date or behind only — not relevant
  }

  return { unpushedBranches, unpushedCommitCounts, neverPushedBranches };
}
