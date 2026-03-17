import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SessionState } from '../lib/tmux-session.js';

// Mock dependencies
const mockExecSync = vi.fn();
const mockReadPanesState = vi.fn();
const mockWritePanesState = vi.fn();
const mockWriteSessionState = vi.fn();
const mockResolveTmuxStateDir = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock pruneStaleEntries as a passthrough that returns pruned state
const mockPruneStaleEntries = vi
  .fn()
  .mockImplementation((state: Record<string, unknown>, activeIds: string[]) => {
    const result: Record<string, unknown> = { version: 1 };
    const activeSet = new Set(activeIds);
    for (const [key, value] of Object.entries(state)) {
      if (key === 'version') continue;
      if (activeSet.has(key)) result[key] = value;
    }
    return result;
  });

vi.mock('../lib/tmux-session.js', () => ({
  readPanesState: (...args: unknown[]) => mockReadPanesState(...args),
  writePanesState: (...args: unknown[]) => mockWritePanesState(...args),
  writeSessionState: (...args: unknown[]) => mockWriteSessionState(...args),
  resolveTmuxStateDir: (...args: unknown[]) => mockResolveTmuxStateDir(...args),
  pruneStaleEntries: (...args: unknown[]) => mockPruneStaleEntries(...args),
}));

import { executeTmuxSave } from './tmux-save.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTmuxStateDir.mockReturnValue('/shared-data/instance/test/tmux');
  mockReadPanesState.mockResolvedValue({ version: 1 });
  mockWritePanesState.mockResolvedValue(undefined);
  mockWriteSessionState.mockResolvedValue(undefined);
});

describe('executeTmuxSave', () => {
  it('returns early when no tmux state dir is resolvable', async () => {
    mockResolveTmuxStateDir.mockReturnValue(null);
    await executeTmuxSave();
    expect(mockWriteSessionState).not.toHaveBeenCalled();
  });

  it('saves session state from tmux list-panes output', async () => {
    // Simulate tmux list-panes output (tab-separated): pane_id window_index window_name pane_current_path pane_current_command session_name
    mockExecSync.mockReturnValue(
      '%0\t1\tshell\t/workspaces/project\tzsh\tbugs\n' +
        '%1\t2\tclaude-win\t/workspaces/project\tclaude\tbugs\n'
    );
    mockReadPanesState.mockResolvedValue({
      version: 1,
      '%1': { session_id: 'aaa-bbb', window_name: 'claude-win', cwd: '/workspaces/project' },
    });

    await executeTmuxSave();

    expect(mockWriteSessionState).toHaveBeenCalledTimes(1);
    const savedState: SessionState = mockWriteSessionState.mock.calls[0][1];
    expect(savedState.windows).toHaveLength(2);
    expect(savedState.windows[0].program).toBeNull();
    expect(savedState.windows[1].program).toBe('claude');
    expect(savedState.windows[1].claude_session_id).toBe('aaa-bbb');
  });

  it('detects claude from tmux command even without panes.json entry', async () => {
    mockExecSync.mockReturnValue('%0\t1\twin\t/tmp\tclaude\tbugs\n');
    mockReadPanesState.mockResolvedValue({ version: 1 }); // no entry for %0

    await executeTmuxSave();

    const savedState: SessionState = mockWriteSessionState.mock.calls[0][1];
    expect(savedState.windows[0].program).toBe('claude');
    expect(savedState.windows[0].claude_session_id).toBeUndefined();
  });
});
