import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Instance } from '../lib/list-instances.js';
import type { GitState, GitStateResult } from '../lib/types.js';

import { InstanceList } from './InstanceList.js';

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

function makeCleanGitState(): GitStateResult {
  return { ok: true, state: cleanGitState() };
}

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    name: 'test-instance',
    status: 'running',
    lastAttached: '2026-02-03T10:00:00.000Z',
    purpose: null,
    gitState: makeCleanGitState(),
    sshConnection: null,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

// Pin time so timeago.js produces deterministic output across all snapshot tests.
// The hardcoded lastAttached is '2026-02-03T10:00:00.000Z', so we freeze time
// 1 hour after that to get stable "1 hour ago" in snapshots.
const FROZEN_TIME = new Date('2026-02-03T11:00:00.000Z');

describe('InstanceList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  describe('empty state', () => {
    it('shows helpful message when no instances exist', () => {
      const { lastFrame } = render(<InstanceList instances={[]} dockerAvailable={true} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('table rendering (AC: #1)', () => {
    it('renders header row and data for multiple instances', () => {
      const instances = [
        makeInstance({
          name: 'alpha',
          status: 'running',
          purpose: 'Auth service',
        }),
        makeInstance({ name: 'beta', status: 'stopped', purpose: 'Database' }),
        makeInstance({
          name: 'gamma',
          status: 'orphaned',
          lastAttached: null,
        }),
      ];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('status rendering', () => {
    it('renders correct colors for all statuses (AC: #2, #3, #4)', () => {
      const instances = [
        makeInstance({ name: 'run', status: 'running' }),
        makeInstance({ name: 'stop', status: 'stopped' }),
        makeInstance({ name: 'orphan', status: 'orphaned' }),
      ];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('Docker unavailable (AC: #5)', () => {
    it('renders unknown status and warning when Docker is unavailable', () => {
      const instances = [
        makeInstance({
          name: 'my-ws',
          status: 'unknown',
          purpose: 'Auth work',
          gitState: null, // As git state might be unavailable too
        }),
      ];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={false} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('last attached formatting (AC: #6)', () => {
    it('renders relative time and dash for null', () => {
      const instances = [
        makeInstance({ name: 'recent', lastAttached: new Date().toISOString() }),
        makeInstance({ name: 'none', lastAttached: null }),
      ];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);
      // Replace dynamic time with a static value for consistent snapshots
      const output = (lastFrame() ?? '').replace(/just now/g, 'a few seconds ago');
      expect(output).toMatchSnapshot();
    });
  });

  describe('purpose column', () => {
    it('renders purpose and truncates long text', () => {
      const longPurpose = 'This is a very long purpose string that exceeds thirty characters';
      const instances = [
        makeInstance({ name: 'p1', purpose: 'OAuth' }),
        makeInstance({ name: 'p2', purpose: null }),
        makeInstance({ name: 'p3', purpose: longPurpose }),
      ];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });

  describe('git state indicators', () => {
    it('renders all git state indicators correctly (AC: #1-5)', () => {
      const instances: Instance[] = [
        makeInstance({ name: 'clean', gitState: makeCleanGitState() }),
        makeInstance({
          name: 'uncommitted',
          gitState: {
            ok: true,
            state: { ...cleanGitState(), hasUnstaged: true, isClean: false },
          },
        }),
        makeInstance({
          name: 'unpushed',
          gitState: {
            ok: true,
            state: { ...cleanGitState(), unpushedBranches: ['main'], isClean: false },
          },
        }),
        makeInstance({
          name: 'never-pushed',
          gitState: {
            ok: true,
            state: {
              ...cleanGitState(),
              neverPushedBranches: ['feat-a', 'feat-b'],
              isClean: false,
            },
          },
        }),
        makeInstance({
          name: 'combined',
          gitState: {
            ok: true,
            state: {
              ...cleanGitState(),
              hasStaged: true,
              unpushedBranches: ['main'],
              isClean: false,
            },
          },
        }),
        makeInstance({ name: 'unavailable', gitState: null }),
      ];

      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);
      expect(lastFrame()).toMatchSnapshot();
    });
  });
});
