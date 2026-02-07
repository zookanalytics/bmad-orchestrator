import chalk from 'chalk';
import { describe, it, expect, beforeAll } from 'vitest';

import type { GitState } from './types.js';

import { formatSafetyReport, getSuggestions } from './safety-report.js';

// Disable color for most tests to avoid brittle checks on ANSI codes
beforeAll(() => {
  chalk.level = 0;
});

// ─── Test helpers ────────────────────────────────────────────────────────────

function createCleanGitState(): GitState {
  return {
    hasStaged: false,
    stagedCount: 0,
    hasUnstaged: false,
    unstagedCount: 0,
    hasUntracked: false,
    untrackedCount: 0,
    stashCount: 0,
    firstStashMessage: '',
    unpushedBranches: [],
    unpushedCommitCounts: {},
    neverPushedBranches: [],
    isDetachedHead: false,
    isClean: true,
  };
}

// ─── getSuggestions tests ────────────────────────────────────────────────────

describe('getSuggestions', () => {
  it('returns empty array for clean state', () => {
    const suggestions = getSuggestions(createCleanGitState());
    expect(suggestions).toEqual([]);
  });

  it('suggests git commit for staged changes', () => {
    const suggestions = getSuggestions({ ...createCleanGitState(), hasStaged: true });
    expect(suggestions.some((s) => s.includes('git commit'))).toBe(true);
  });

  it('suggests git add for unstaged changes', () => {
    const suggestions = getSuggestions({ ...createCleanGitState(), hasUnstaged: true });
    expect(suggestions.some((s) => s.includes('git add'))).toBe(true);
  });

  it('suggests git add for untracked files', () => {
    const suggestions = getSuggestions({ ...createCleanGitState(), hasUntracked: true });
    expect(suggestions.some((s) => s.includes('git add'))).toBe(true);
  });

  it('suggests git stash pop for stashed changes', () => {
    const suggestions = getSuggestions({ ...createCleanGitState(), stashCount: 2 });
    expect(suggestions.some((s) => s.includes('git stash'))).toBe(true);
  });

  it('suggests git push for unpushed branches', () => {
    const suggestions = getSuggestions({
      ...createCleanGitState(),
      unpushedBranches: ['feature-x'],
    });
    expect(suggestions.some((s) => s.includes('git push'))).toBe(true);
  });

  it('suggests git push for never-pushed branches', () => {
    const suggestions = getSuggestions({
      ...createCleanGitState(),
      neverPushedBranches: ['new-feature'],
    });
    expect(suggestions.some((s) => s.includes('git push'))).toBe(true);
  });

  it('suggests investigating for detached HEAD', () => {
    const suggestions = getSuggestions({ ...createCleanGitState(), isDetachedHead: true });
    expect(suggestions.some((s) => s.includes('git checkout'))).toBe(true);
  });

  it('returns multiple suggestions for multiple issues', () => {
    const suggestions = getSuggestions({
      ...createCleanGitState(),
      hasStaged: true,
      unpushedBranches: ['main'],
    });
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── formatSafetyReport tests ────────────────────────────────────────────────

describe('formatSafetyReport', () => {
  it('includes instance name in header', () => {
    const report = formatSafetyReport('auth', ['1 staged file detected'], {
      ...createCleanGitState(),
      hasStaged: true,
    });
    expect(report).toContain('auth');
  });

  it('lists all blockers', () => {
    const blockers = ['1 staged file detected', '1 unstaged change detected'];
    const report = formatSafetyReport('auth', blockers, {
      ...createCleanGitState(),
      hasStaged: true,
      hasUnstaged: true,
    });
    expect(report).toContain('1 staged file detected');
    expect(report).toContain('1 unstaged change detected');
  });

  it('includes severity indicators for warnings', () => {
    const report = formatSafetyReport('auth', ['1 staged file detected'], {
      ...createCleanGitState(),
      hasStaged: true,
    });
    expect(report).toContain('[Warning]');
  });

  it('includes severity indicators for data loss risk', () => {
    const report = formatSafetyReport('auth', ['branches never pushed: new-feature'], {
      ...createCleanGitState(),
      neverPushedBranches: ['new-feature'],
    });
    expect(report).toContain('[Danger]');
  });

  it('marks never-pushed branches as highest risk', () => {
    const report = formatSafetyReport('auth', ['branches never pushed: new-feature'], {
      ...createCleanGitState(),
      neverPushedBranches: ['new-feature'],
    });
    expect(report).toContain('[Danger]');
    expect(report).toContain('new-feature');
  });

  it('marks detached HEAD as danger', () => {
    const report = formatSafetyReport('auth', ['detached HEAD state (investigate manually)'], {
      ...createCleanGitState(),
      isDetachedHead: true,
    });
    expect(report).toContain('[Danger]');
  });

  it('includes stash count', () => {
    const report = formatSafetyReport('auth', ['stashed changes detected (3 stashes)'], {
      ...createCleanGitState(),
      stashCount: 3,
    });
    expect(report).toContain('3');
  });

  it('includes unpushed branch names', () => {
    const report = formatSafetyReport(
      'auth',
      ['unpushed commits on branches: feature-x, bugfix-y'],
      { ...createCleanGitState(), unpushedBranches: ['feature-x', 'bugfix-y'] }
    );
    expect(report).toContain('feature-x');
    expect(report).toContain('bugfix-y');
  });

  it('includes actionable suggestions', () => {
    const report = formatSafetyReport('auth', ['1 staged file detected'], {
      ...createCleanGitState(),
      hasStaged: true,
    });
    expect(report).toContain('Suggestions:');
    expect(report).toContain('git commit');
  });

  it('includes --force hint', () => {
    const report = formatSafetyReport('auth', ['1 staged file detected'], {
      ...createCleanGitState(),
      hasStaged: true,
    });
    expect(report).toContain('--force');
  });

  it('handles multiple blockers with mixed severity', () => {
    const blockers = ['1 staged file detected', 'branches never pushed: new-feature'];
    const report = formatSafetyReport('auth', blockers, {
      ...createCleanGitState(),
      hasStaged: true,
      neverPushedBranches: ['new-feature'],
    });
    expect(report).toContain('[Warning]');
    expect(report).toContain('[Danger]');
    expect(report).toContain('Suggestions:');
  });

  it('formats report with real colors', () => {
    chalk.level = 1; // Enable color for this test
    try {
      const report = formatSafetyReport(
        'auth',
        ['1 staged file detected', 'branches never pushed: new-feature'],
        {
          ...createCleanGitState(),
          hasStaged: true,
          neverPushedBranches: ['new-feature'],
        }
      );

      // Use chalk API to generate expected strings (avoids brittle ANSI hardcoding)
      expect(report).toContain(chalk.yellow('[Warning]'));
      expect(report).toContain(chalk.red('[Danger]'));
      expect(report).toContain(chalk.bold('Suggestions:'));
      expect(report).toContain(
        chalk.gray('Or use --force to bypass safety checks (data loss is permanent).')
      );
    } finally {
      chalk.level = 0;
    }
  });
});
