import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SessionState } from '../lib/tmux-session.js';

const mockExecSync = vi.fn();
const mockReadSessionState = vi.fn();
const mockResolveTmuxStateDir = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock('../lib/tmux-session.js', () => ({
  readSessionState: (...args: unknown[]) => mockReadSessionState(...args),
  resolveTmuxStateDir: (...args: unknown[]) => mockResolveTmuxStateDir(...args),
}));

import { executeTmuxRestore } from './tmux-restore.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTmuxStateDir.mockReturnValue('/shared-data/instance/test/tmux');
  mockExecSync.mockReturnValue('');
});

describe('executeTmuxRestore', () => {
  it('returns early when no tmux state dir is resolvable', async () => {
    mockResolveTmuxStateDir.mockReturnValue(null);
    await executeTmuxRestore();
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('returns early when no session.json exists', async () => {
    mockReadSessionState.mockResolvedValue(null);
    await executeTmuxRestore();
    // Should only call resolveTmuxStateDir, not any tmux commands
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('creates windows for saved session state', async () => {
    const state: SessionState = {
      version: 1,
      saved_at: '2026-03-17T00:00:00Z',
      tmux_session: 'bugs',
      active_window: 1,
      windows: [
        { index: 1, name: 'shell', cwd: '/tmp', program: null },
        {
          index: 2,
          name: 'claude-win',
          cwd: '/workspaces/project',
          program: 'claude',
          claude_session_id: 'aaa-bbb',
        },
      ],
    };
    mockReadSessionState.mockResolvedValue(state);

    // Mock tmux list-sessions to return the target session
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('list-sessions')) return 'bugs\n';
      return '';
    });

    await executeTmuxRestore();

    // Should have created windows and sent keys
    const calls = mockExecSync.mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('new-window'))).toBe(true);
    expect(calls.some((c) => c.includes('claude --resume aaa-bbb'))).toBe(true);
  });

  it('creates tmux session if none exists', async () => {
    const state: SessionState = {
      version: 1,
      saved_at: '2026-03-17T00:00:00Z',
      tmux_session: 'bugs',
      active_window: 1,
      windows: [{ index: 1, name: 'shell', cwd: '/tmp', program: null }],
    };
    mockReadSessionState.mockResolvedValue(state);
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('list-sessions')) throw new Error('no sessions');
      return '';
    });

    await executeTmuxRestore();

    const calls = mockExecSync.mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('new-session'))).toBe(true);
  });
});
