import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect } from 'vitest';

import type { GitState, GitStateResult } from '../lib/types.js';

import { StatusIndicator, formatGitIndicators } from './StatusIndicator.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function cleanGitState(): GitState {
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

function makeCleanState(): GitStateResult {
  return { ok: true, state: cleanGitState() };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('StatusIndicator', () => {
  describe('clean state (AC: #1)', () => {
    it('shows ✓ for clean git state', () => {
      const { lastFrame } = render(<StatusIndicator gitState={makeCleanState()} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('uncommitted changes (AC: #2)', () => {
    it('shows ● for staged changes', () => {
      const state: GitStateResult = {
        ok: true,
        state: {
          ...cleanGitState(),
          hasStaged: true,
          isClean: false,
        },
      };
      const { lastFrame } = render(<StatusIndicator gitState={state} />);
      expect(lastFrame()).toMatchSnapshot();
    });

    it('shows ● for unstaged changes', () => {
      const state: GitStateResult = {
        ok: true,
        state: {
          ...cleanGitState(),
          hasUnstaged: true,
          isClean: false,
        },
      };
      const { lastFrame } = render(<StatusIndicator gitState={state} />);
      expect(lastFrame()).toMatchSnapshot();
    });

    it('shows ● for untracked files', () => {
      const state: GitStateResult = {
        ok: true,
        state: {
          ...cleanGitState(),
          hasUntracked: true,
          isClean: false,
        },
      };
      const { lastFrame } = render(<StatusIndicator gitState={state} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('unpushed commits (AC: #3)', () => {
    it('shows ↑ for unpushed branches', () => {
      const state: GitStateResult = {
        ok: true,
        state: {
          ...cleanGitState(),
          unpushedBranches: ['main'],
          isClean: false,
        },
      };
      const { lastFrame } = render(<StatusIndicator gitState={state} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('never-pushed branches (AC: #4)', () => {
    it('shows ⚠ with branch count for never-pushed branches', () => {
      const state: GitStateResult = {
        ok: true,
        state: {
          ...cleanGitState(),
          neverPushedBranches: ['feature-a', 'feature-b'],
          isClean: false,
        },
      };
      const { lastFrame } = render(<StatusIndicator gitState={state} />);
      expect(lastFrame()).toMatchSnapshot();
    });

    it('shows ⚠ with count 1 for single never-pushed branch', () => {
      const state: GitStateResult = {
        ok: true,
        state: {
          ...cleanGitState(),
          neverPushedBranches: ['feature-x'],
          isClean: false,
        },
      };
      const { lastFrame } = render(<StatusIndicator gitState={state} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('combined indicators (AC: #5)', () => {
    it('shows both ● and ↑ for uncommitted AND unpushed', () => {
      const state: GitStateResult = {
        ok: true,
        state: {
          ...cleanGitState(),
          hasUnstaged: true,
          unpushedBranches: ['main'],
          isClean: false,
        },
      };
      const { lastFrame } = render(<StatusIndicator gitState={state} />);
      expect(lastFrame()).toMatchSnapshot();
    });

    it('shows ●, ↑, and ⚠ when all states apply', () => {
      const state: GitStateResult = {
        ok: true,
        state: {
          ...cleanGitState(),
          hasStaged: true,
          unpushedBranches: ['main'],
          neverPushedBranches: ['feature-x'],
          isClean: false,
        },
      };
      const { lastFrame } = render(<StatusIndicator gitState={state} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('unavailable state', () => {
    it('shows ? when gitState is null', () => {
      const { lastFrame } = render(<StatusIndicator gitState={null} />);
      expect(lastFrame()).toMatchSnapshot();
    });

    it('shows ? when gitState has error', () => {
      const state: GitStateResult = {
        ok: false,
        state: null,
        error: { code: 'GIT_ERROR', message: 'git not found' },
      };
      const { lastFrame } = render(<StatusIndicator gitState={state} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });
});

describe('formatGitIndicators', () => {
  it('returns "✓" for clean state', () => {
    const result = formatGitIndicators(makeCleanState());
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ symbol: '✓', color: 'green' });
  });

  it('returns "?" for null state', () => {
    const result = formatGitIndicators(null);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ symbol: '?', color: 'gray' });
  });

  it('returns multiple indicators in order: ● ↑ ⚠', () => {
    const state: GitStateResult = {
      ok: true,
      state: {
        ...cleanGitState(),
        hasStaged: true,
        unpushedBranches: ['main'],
        neverPushedBranches: ['feat'],
        isClean: false,
      },
    };
    const result = formatGitIndicators(state);
    expect(result.length).toBe(3);
    expect(result[0].symbol).toBe('●');
    expect(result[1].symbol).toBe('↑');
    expect(result[2].symbol).toContain('⚠');
  });
});
