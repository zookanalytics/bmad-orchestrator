/**
 * Unit tests for the tmux-status command handler.
 *
 * Tests the command's environment gating and output behavior
 * using injected dependencies (no filesystem or container required).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTmuxStatusCommand } from './tmux-status.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let consoleOutput: string[];
let originalLog: typeof console.log;

beforeEach(() => {
  consoleOutput = [];
  originalLog = console.log;
  console.log = (...args: unknown[]) => {
    consoleOutput.push(args.map(String).join(' '));
  };
});

afterEach(() => {
  console.log = originalLog;
});

function createDeps(overrides: {
  insideContainer?: boolean;
  tmuxOutput?: string;
  statePath?: string;
}) {
  return {
    isInsideContainer: () => overrides.insideContainer ?? false,
    getTmuxStatus: vi.fn().mockResolvedValue(overrides.tmuxOutput ?? '?'),
    statePath: overrides.statePath ?? '/test/state.json',
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('tmux-status command', () => {
  it('outputs "?" when not inside a container', async () => {
    const deps = createDeps({ insideContainer: false });
    const cmd = createTmuxStatusCommand(deps);

    await cmd.parseAsync([], { from: 'user' });

    expect(consoleOutput).toEqual(['?']);
    expect(deps.getTmuxStatus).not.toHaveBeenCalled();
  });

  it('calls getTmuxStatus with configured state path inside container', async () => {
    const deps = createDeps({
      insideContainer: true,
      tmuxOutput: 'auth | JWT authentication',
      statePath: '/etc/agent-env/state.json',
    });
    const cmd = createTmuxStatusCommand(deps);

    await cmd.parseAsync([], { from: 'user' });

    expect(deps.getTmuxStatus).toHaveBeenCalledWith('/etc/agent-env/state.json');
    expect(consoleOutput).toEqual(['auth | JWT authentication']);
  });

  it('outputs instance-only when purpose is null', async () => {
    const deps = createDeps({ insideContainer: true, tmuxOutput: 'dev' });
    const cmd = createTmuxStatusCommand(deps);

    await cmd.parseAsync([], { from: 'user' });

    expect(consoleOutput).toEqual(['dev']);
  });

  it('outputs "?" when getTmuxStatus returns fallback', async () => {
    const deps = createDeps({ insideContainer: true, tmuxOutput: '?' });
    const cmd = createTmuxStatusCommand(deps);

    await cmd.parseAsync([], { from: 'user' });

    expect(consoleOutput).toEqual(['?']);
  });
});
