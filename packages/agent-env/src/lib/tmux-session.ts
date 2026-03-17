/**
 * Tmux session state management for agent-env
 *
 * Handles reading/writing claude-sessions.json and session.json files that track
 * tmux window state for persistence across container rebuilds.
 *
 * State files live at: /shared-data/instance/<id>/tmux/
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PaneEntry {
  session_id: string;
  window_name: string;
  cwd: string;
}

export interface PanesState {
  version: 1;
  [paneId: string]: PaneEntry | 1; // 1 is the version value
}

export interface WindowEntry {
  index: number;
  name: string;
  cwd: string;
  program: 'claude' | null;
  claude_session_id?: string;
}

export interface SessionState {
  version: 1;
  saved_at: string;
  tmux_session: string;
  active_window: number;
  windows: WindowEntry[];
}

// ─── Panes State ────────────────────────────────────────────────────────────

export async function readPanesState(path: string): Promise<PanesState> {
  try {
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null && parsed.version === 1) {
      return parsed as PanesState;
    }
    return { version: 1 };
  } catch {
    return { version: 1 };
  }
}

export async function writePanesState(path: string, state: PanesState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = path + '.tmp';
  await writeFile(tmpPath, JSON.stringify(state), 'utf-8');
  await rename(tmpPath, path);
}

// ─── Session State ──────────────────────────────────────────────────────────

export async function readSessionState(path: string): Promise<SessionState | null> {
  try {
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      parsed.version === 1 &&
      Array.isArray(parsed.windows)
    ) {
      return parsed as SessionState;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeSessionState(path: string, state: SessionState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = path + '.tmp';
  await writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  await rename(tmpPath, path);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function pruneStaleEntries(state: PanesState, activePaneIds: string[]): PanesState {
  const pruned: PanesState = { version: 1 };
  const activeSet = new Set(activePaneIds);
  for (const [key, value] of Object.entries(state)) {
    if (key === 'version') continue;
    if (activeSet.has(key)) {
      pruned[key] = value;
    }
  }
  return pruned;
}

/**
 * Resolve the tmux state directory for the current instance.
 * Returns /shared-data/instance/<AGENT_INSTANCE>/tmux
 */
export function resolveTmuxStateDir(agentInstance?: string): string | null {
  const instance = agentInstance || process.env.AGENT_INSTANCE;
  if (!instance) return null;
  return join('/shared-data/instance', instance, 'tmux');
}
