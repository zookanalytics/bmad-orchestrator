import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import type { Instance } from '../lib/list-instances.js';
import type { GitState, GitStateResult } from '../lib/types.js';

import { InteractiveMenu, buildOptionLabel } from './InteractiveMenu.js';

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

describe('InteractiveMenu', () => {
  describe('empty state (AC: #6)', () => {
    it('shows create suggestion when no instances exist', () => {
      const onAction = vi.fn();
      const { lastFrame } = render(
        <InteractiveMenu instances={[]} onAction={onAction} terminalWidth={80} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('No instances found');
      expect(output).toContain('agent-env create');
    });
  });

  describe('rendering with instances (AC: #1, #4)', () => {
    it('renders select header and instance options', () => {
      const instances = [
        makeInstance({ name: 'alpha', status: 'running', purpose: 'Auth service' }),
        makeInstance({ name: 'beta', status: 'stopped', purpose: 'Database work' }),
      ];
      const onAction = vi.fn();
      const { lastFrame } = render(
        <InteractiveMenu instances={instances} onAction={onAction} terminalWidth={100} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Select an instance:');
      expect(output).toContain('alpha');
      expect(output).toContain('beta');
    });

    it('shows git state indicators in labels', () => {
      const instances = [
        makeInstance({ name: 'clean-ws', gitState: makeCleanGitState() }),
        makeInstance({
          name: 'dirty-ws',
          gitState: {
            ok: true,
            state: { ...cleanGitState(), hasUnstaged: true, isClean: false },
          },
        }),
      ];
      const onAction = vi.fn();
      const { lastFrame } = render(
        <InteractiveMenu instances={instances} onAction={onAction} terminalWidth={100} />
      );
      const output = lastFrame() ?? '';
      // Clean state shows ✓
      expect(output).toContain('✓');
      // Dirty state shows ●
      expect(output).toContain('●');
    });
  });

  describe('user interaction (AC: #3)', () => {
    it('shows action menu after selecting an instance', async () => {
      const instances = [
        makeInstance({ name: 'alpha', status: 'running' }),
        makeInstance({ name: 'beta', status: 'stopped' }),
      ];
      const onAction = vi.fn();
      const { stdin, lastFrame } = render(
        <InteractiveMenu instances={instances} onAction={onAction} terminalWidth={80} />
      );

      // Verify initial render
      let output = lastFrame() ?? '';
      expect(output).toContain('Select an instance:');
      expect(output).toContain('alpha');

      // Select 'alpha'
      stdin.write('\r'); // Enter key

      // Wait for Ink to process the input
      await new Promise((resolve) => setTimeout(resolve, 50));

      output = lastFrame() ?? '';
      expect(output).toContain('Manage alpha:');
      expect(output).toContain('Attach to session');
      expect(output).toContain('Rebuild container');
    });

    it('calls onAction with selected action and instance name', async () => {
      const instances = [makeInstance({ name: 'alpha', status: 'running' })];
      const onAction = vi.fn();
      const { stdin } = render(
        <InteractiveMenu instances={instances} onAction={onAction} terminalWidth={80} />
      );

      // Select 'alpha'
      stdin.write('\r'); // Enter key
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Action menu is now visible, select 'rebuild' (down arrow once from 'attach')
      stdin.write('\x1B[B'); // Down arrow key
      stdin.write('\r'); // Enter key
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onAction).toHaveBeenCalledWith('rebuild', 'alpha');
    });
  });
});

describe('buildOptionLabel', () => {
  it('includes name, status symbol, and git indicator', () => {
    const instance = makeInstance({ name: 'my-ws', status: 'running' });
    const label = buildOptionLabel(instance, 100);
    expect(label).toContain('my-ws');
    expect(label).toContain('▶'); // running symbol
    expect(label).toContain('✓'); // clean git
  });

  it('includes purpose when space available', () => {
    const instance = makeInstance({ name: 'ws', status: 'running', purpose: 'OAuth work' });
    const label = buildOptionLabel(instance, 100);
    expect(label).toContain('OAuth work');
  });

  it('truncates long purpose with ellipsis (AC: #5)', () => {
    const longPurpose = 'This is a very long purpose string that exceeds available space';
    const instance = makeInstance({
      name: 'my-workspace-name',
      status: 'running',
      purpose: longPurpose,
    });
    // With a narrow width, purpose should be truncated
    const label = buildOptionLabel(instance, 50);
    expect(label).toContain('...');
    expect(label.length).toBeLessThanOrEqual(50);
  });

  it('omits purpose when terminal too narrow', () => {
    const instance = makeInstance({
      name: 'my-workspace-name',
      status: 'running',
      purpose: 'test',
    });
    // Very narrow — no room for purpose
    const label = buildOptionLabel(instance, 30);
    expect(label).not.toContain('test');
  });

  it('shows stopped symbol for stopped instance', () => {
    const instance = makeInstance({ name: 'ws', status: 'stopped' });
    const label = buildOptionLabel(instance, 80);
    expect(label).toContain('■'); // stopped symbol
  });

  it('shows orphaned symbol for orphaned instance', () => {
    const instance = makeInstance({ name: 'ws', status: 'orphaned' });
    const label = buildOptionLabel(instance, 80);
    expect(label).toContain('✗'); // orphaned symbol
  });

  it('shows unpushed indicator for unpushed branches', () => {
    const instance = makeInstance({
      name: 'ws',
      gitState: {
        ok: true,
        state: { ...cleanGitState(), unpushedBranches: ['main'], isClean: false },
      },
    });
    const label = buildOptionLabel(instance, 80);
    expect(label).toContain('↑');
  });
});
