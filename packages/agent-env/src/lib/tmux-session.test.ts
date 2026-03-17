import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  readPanesState,
  readSessionState,
  writeSessionState,
  pruneStaleEntries,
  type PaneEntry,
  type PanesState,
  type SessionState,
} from './tmux-session.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `tmux-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('readPanesState', () => {
  it('returns empty state when file does not exist', async () => {
    const result = await readPanesState(join(tempDir, 'nonexistent.json'));
    expect(result).toEqual({ version: 1 });
  });

  it('reads valid panes state', async () => {
    const state: PanesState = {
      version: 1,
      '%0': { session_id: 'aaa-bbb', window_name: 'test', cwd: '/tmp' },
    };
    await writeFile(join(tempDir, 'claude-sessions.json'), JSON.stringify(state));
    const result = await readPanesState(join(tempDir, 'claude-sessions.json'));
    const entry = result['%0'];
    expect(entry).not.toBe(1);
    expect((entry as PaneEntry).session_id).toBe('aaa-bbb');
  });

  it('returns empty state for corrupted JSON', async () => {
    await writeFile(join(tempDir, 'claude-sessions.json'), 'not json');
    const result = await readPanesState(join(tempDir, 'claude-sessions.json'));
    expect(result).toEqual({ version: 1 });
  });
});

describe('writeSessionState', () => {
  it('writes session state atomically', async () => {
    const state: SessionState = {
      version: 1,
      saved_at: '2026-03-17T00:00:00Z',
      tmux_session: 'bugs',
      active_window: 1,
      windows: [{ index: 1, name: 'shell', cwd: '/tmp', program: null }],
    };
    const path = join(tempDir, 'session.json');
    await writeSessionState(path, state);
    const read = JSON.parse(await readFile(path, 'utf-8'));
    expect(read.tmux_session).toBe('bugs');
    expect(read.windows).toHaveLength(1);
  });
});

describe('readSessionState', () => {
  it('returns null when file does not exist', async () => {
    const result = await readSessionState(join(tempDir, 'nonexistent.json'));
    expect(result).toBeNull();
  });

  it('reads valid session state', async () => {
    const state: SessionState = {
      version: 1,
      saved_at: '2026-03-17T00:00:00Z',
      tmux_session: 'bugs',
      active_window: 1,
      windows: [{ index: 1, name: 'shell', cwd: '/tmp', program: null }],
    };
    await writeFile(join(tempDir, 'session.json'), JSON.stringify(state));
    const result = await readSessionState(join(tempDir, 'session.json'));
    expect(result?.tmux_session).toBe('bugs');
    expect(result?.windows).toHaveLength(1);
  });

  it('returns null for corrupted JSON', async () => {
    await writeFile(join(tempDir, 'session.json'), 'not json');
    const result = await readSessionState(join(tempDir, 'session.json'));
    expect(result).toBeNull();
  });
});

describe('pruneStaleEntries', () => {
  it('removes pane entries not in active pane list', () => {
    const state: PanesState = {
      version: 1,
      '%0': { session_id: 'aaa', window_name: 'a', cwd: '/tmp' },
      '%1': { session_id: 'bbb', window_name: 'b', cwd: '/tmp' },
      '%2': { session_id: 'ccc', window_name: 'c', cwd: '/tmp' },
    };
    const activePanes = ['%0', '%2'];
    const pruned = pruneStaleEntries(state, activePanes);
    expect(pruned['%0']).toBeDefined();
    expect(pruned['%1']).toBeUndefined();
    expect(pruned['%2']).toBeDefined();
  });

  it('preserves version field', () => {
    const state: PanesState = { version: 1, '%0': { session_id: 'a', window_name: 'x', cwd: '/' } };
    const pruned = pruneStaleEntries(state, ['%0']);
    expect(pruned.version).toBe(1);
  });
});
