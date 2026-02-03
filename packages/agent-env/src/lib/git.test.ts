import type { ExecuteResult } from '@zookanalytics/shared';

import { describe, it, expect, vi } from 'vitest';

import { createGitStateDetector, GIT_COMMAND_TIMEOUT } from './git.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Create a mock executor that returns specified results based on command patterns */
function mockExecutor(results: Record<string, ExecuteResult>) {
  return vi
    .fn()
    .mockImplementation(async (command: string, args: string[] = []): Promise<ExecuteResult> => {
      const key = `${command} ${args.join(' ')}`.trim();

      // Match by prefix for flexible matching
      for (const [pattern, result] of Object.entries(results)) {
        if (key.startsWith(pattern) || key.includes(pattern)) {
          return result;
        }
      }

      // Default: command not found
      return { ok: false, stdout: '', stderr: `command not found: ${command}`, exitCode: 127 };
    });
}

const okResult = (stdout: string): ExecuteResult => ({
  ok: true,
  stdout,
  stderr: '',
  exitCode: 0,
});

const failResult = (stderr: string): ExecuteResult => ({
  ok: false,
  stdout: '',
  stderr,
  exitCode: 1,
});

// ─── Staged changes detection (AC: #1) ──────────────────────────────────────

describe('staged changes detection', () => {
  it('detects staged added file', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult('A  newfile.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasStaged).toBe(true);
  });

  it('detects staged modified file', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult('M  modified.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasStaged).toBe(true);
  });

  it('detects staged deleted file', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult('D  deleted.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasStaged).toBe(true);
  });

  it('detects staged renamed file', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult('R  old.ts -> new.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasStaged).toBe(true);
  });
});

// ─── Unstaged changes detection (AC: #2) ────────────────────────────────────

describe('unstaged changes detection', () => {
  it('detects unstaged modifications', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(' M file.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasUnstaged).toBe(true);
    expect(result.state.hasStaged).toBe(false);
  });

  it('detects unstaged deletion', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(' D deleted.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasUnstaged).toBe(true);
  });

  it('detects both staged and unstaged on same file', async () => {
    // MM means staged modification + further unstaged modification
    const executor = mockExecutor({
      'git status --porcelain': okResult('MM file.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasStaged).toBe(true);
    expect(result.state.hasUnstaged).toBe(true);
  });
});

// ─── Untracked files detection (AC: #3) ─────────────────────────────────────

describe('untracked files detection', () => {
  it('detects untracked files', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult('?? newfile.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasUntracked).toBe(true);
    expect(result.state.hasStaged).toBe(false);
    expect(result.state.hasUnstaged).toBe(false);
  });

  it('detects multiple untracked files', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult('?? file1.ts\n?? file2.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasUntracked).toBe(true);
  });
});

describe('parseStatus edge cases', () => {
  it('does not treat ignored file markers as staged changes', async () => {
    // !! is the porcelain indicator for ignored files (when --ignored is used)
    const executor = mockExecutor({
      'git status --porcelain': okResult('!! ignored-dir/\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.hasStaged).toBe(false);
  });
});

// ─── Stash detection (AC: #4) ───────────────────────────────────────────────

describe('stash detection', () => {
  it('detects stashed changes', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(
        'stash@{0}: WIP on main: abc1234 some commit\nstash@{1}: WIP on feature: def5678 another\n'
      ),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.stashCount).toBe(2);
  });

  it('returns zero stash count when no stashes', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.stashCount).toBe(0);
  });

  it('returns zero stash count when stash command fails', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': failResult('not a git repo'),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.stashCount).toBe(0);
  });
});

// ─── Unpushed branches detection (AC: #5, #6) ──────────────────────────────

describe('unpushed branches detection', () => {
  it('detects branches with unpushed commits', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main [ahead 2]\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.unpushedBranches).toContain('main');
  });

  it('detects unpushed commits on non-current branch (cross-branch)', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\nfeature origin/feature [ahead 3]\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.unpushedBranches).toContain('feature');
    expect(result.state.unpushedBranches).not.toContain('main');
  });

  it('detects multiple unpushed branches', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(
        'main origin/main [ahead 1]\nfeature origin/feature [ahead 5]\nhotfix origin/hotfix [ahead 2]\n'
      ),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.unpushedBranches).toEqual(
      expect.arrayContaining(['main', 'feature', 'hotfix'])
    );
    expect(result.state.unpushedBranches).toHaveLength(3);
  });

  it('does not include branches that are behind only', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main [behind 3]\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.unpushedBranches).toHaveLength(0);
  });

  it('detects ahead in ahead+behind combination', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main [ahead 2, behind 1]\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.unpushedBranches).toContain('main');
  });
});

// ─── Never-pushed branches detection (AC: #7) ──────────────────────────────

describe('never-pushed branches detection', () => {
  it('detects branches never pushed to any remote', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\nlocal-only\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.neverPushedBranches).toContain('local-only');
    expect(result.state.neverPushedBranches).not.toContain('main');
  });

  it('detects multiple never-pushed branches', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\nexperiment\nwip-feature\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.neverPushedBranches).toEqual(
      expect.arrayContaining(['experiment', 'wip-feature'])
    );
    expect(result.state.neverPushedBranches).toHaveLength(2);
  });

  it('detects never-pushed branch even with trailing spaces from empty upstream fields', async () => {
    // Real git for-each-ref output has trailing spaces when upstream fields are empty
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\nlocal-only  \n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.neverPushedBranches).toContain('local-only');
    expect(result.state.neverPushedBranches).not.toContain('main');
  });

  it('returns empty when all branches have upstream', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\nfeature origin/feature [ahead 1]\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.neverPushedBranches).toHaveLength(0);
  });
});

// ─── Detached HEAD detection (AC: #8) ───────────────────────────────────────

describe('detached HEAD detection', () => {
  it('detects detached HEAD when symbolic-ref fails', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': failResult('fatal: ref HEAD is not a symbolic ref'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isDetachedHead).toBe(true);
  });

  it('detects non-detached HEAD when symbolic-ref succeeds', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isDetachedHead).toBe(false);
  });
});

// ─── Clean repository detection (AC: #9) ────────────────────────────────────

describe('clean repository detection', () => {
  it('reports isClean when repository is fully clean', async () => {
    // main has upstream tracking (space after name = up-to-date with tracking)
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isClean).toBe(true);
  });

  it('reports not clean when staged changes exist', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult('A  file.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isClean).toBe(false);
  });

  it('reports not clean when unstaged changes exist', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(' M file.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isClean).toBe(false);
  });

  it('reports not clean when untracked files exist', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult('?? newfile.ts\n'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isClean).toBe(false);
  });

  it('reports not clean when stashes exist', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult('stash@{0}: WIP on main: abc commit\n'),
      'git for-each-ref': okResult('main origin/main\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isClean).toBe(false);
  });

  it('reports not clean when unpushed branches exist', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main [ahead 1]\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isClean).toBe(false);
  });

  it('reports not clean when never-pushed branches exist', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult('main origin/main\nlocal-branch\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isClean).toBe(false);
  });

  it('reports not clean when HEAD is detached', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': failResult('fatal: ref HEAD is not a symbolic ref'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.isClean).toBe(false);
  });
});

// ─── Error handling ─────────────────────────────────────────────────────────

describe('error handling', () => {
  it('returns GIT_ERROR when git status fails', async () => {
    const executor = mockExecutor({
      'git status --porcelain': failResult('fatal: not a git repository'),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('GIT_ERROR');
    expect(result.error.message).toContain('not a git repository');
  });

  it('handles gracefully when for-each-ref fails', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': failResult('error'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.unpushedBranches).toHaveLength(0);
    expect(result.state.neverPushedBranches).toHaveLength(0);
  });

  it('returns null state on error', async () => {
    const executor = mockExecutor({
      'git status --porcelain': failResult('fatal: not a git repository'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.state).toBeNull();
  });
});

// ─── Command execution verification ─────────────────────────────────────────

describe('command execution', () => {
  it('passes unique opts object to each git command (no shared reference)', async () => {
    const capturedOpts: Record<string, unknown>[] = [];
    const executor = vi
      .fn()
      .mockImplementation(
        async (_cmd: string, _args: string[] = [], opts?: Record<string, unknown>) => {
          if (opts) capturedOpts.push(opts);
          return okResult('refs/heads/main');
        }
      );
    const detector = createGitStateDetector(executor);

    await detector.getGitState('/workspace');

    // Each call should get its own opts object, not a shared reference
    expect(capturedOpts).toHaveLength(4);
    for (let i = 0; i < capturedOpts.length; i++) {
      for (let j = i + 1; j < capturedOpts.length; j++) {
        expect(capturedOpts[i]).not.toBe(capturedOpts[j]);
      }
    }
  });

  it('passes cwd option to all git commands', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    await detector.getGitState('/my/workspace');

    // Verify all 4 calls used the workspace path as cwd
    for (const call of executor.mock.calls) {
      expect(call[2]).toEqual(
        expect.objectContaining({
          cwd: '/my/workspace',
          timeout: GIT_COMMAND_TIMEOUT,
        })
      );
    }
  });

  it('runs 4 git commands in parallel', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    await detector.getGitState('/workspace');

    // Should have called executor exactly 4 times
    expect(executor).toHaveBeenCalledTimes(4);
  });

  it('calls git status with --porcelain flag', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    await detector.getGitState('/workspace');

    expect(executor).toHaveBeenCalledWith(
      'git',
      ['status', '--porcelain'],
      expect.objectContaining({ timeout: GIT_COMMAND_TIMEOUT })
    );
  });

  it('calls git for-each-ref with correct format and refs/heads', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    await detector.getGitState('/workspace');

    expect(executor).toHaveBeenCalledWith(
      'git',
      [
        'for-each-ref',
        '--format=%(refname:short) %(upstream:short) %(upstream:track)',
        'refs/heads',
      ],
      expect.objectContaining({ timeout: GIT_COMMAND_TIMEOUT })
    );
  });
});

// ─── Combined state scenarios ───────────────────────────────────────────────

describe('combined state scenarios', () => {
  it('detects mixed dirty state (staged + untracked + stash + unpushed)', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult('M  staged.ts\n?? newfile.ts\n'),
      'git stash list': okResult('stash@{0}: WIP on main: abc commit\n'),
      'git for-each-ref': okResult('main origin/main [ahead 2]\nfeature\n'),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    expect(result.state.hasStaged).toBe(true);
    expect(result.state.hasUntracked).toBe(true);
    expect(result.state.stashCount).toBe(1);
    expect(result.state.unpushedBranches).toContain('main');
    expect(result.state.neverPushedBranches).toContain('feature');
    expect(result.state.isClean).toBe(false);
  });

  it('handles empty for-each-ref output (no branches)', async () => {
    const executor = mockExecutor({
      'git status --porcelain': okResult(''),
      'git stash list': okResult(''),
      'git for-each-ref': okResult(''),
      'git symbolic-ref': okResult('refs/heads/main'),
    });
    const detector = createGitStateDetector(executor);

    const result = await detector.getGitState('/workspace');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.state.unpushedBranches).toHaveLength(0);
    expect(result.state.neverPushedBranches).toHaveLength(0);
    expect(result.state.isClean).toBe(true);
  });
});
