/**
 * tmux-save command for agent-env
 *
 * Captures current tmux window state and saves it to session.json.
 * Designed to run inside the container. Silent on errors (used in hooks).
 */

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import {
  readPanesState,
  writePanesState,
  writeSessionState,
  pruneStaleEntries,
  resolveTmuxStateDir,
  type WindowEntry,
  type SessionState,
} from '../lib/tmux-session.js';

export async function executeTmuxSave(): Promise<void> {
  const stateDir = resolveTmuxStateDir();
  if (!stateDir) return;

  // Get tmux pane information using tab separator for reliable parsing
  let tmuxOutput: string;
  try {
    tmuxOutput = execSync(
      'tmux list-panes -a -F "#{pane_id}\t#{window_index}\t#{window_name}\t#{pane_current_path}\t#{pane_current_command}\t#{session_name}"',
      { encoding: 'utf-8', timeout: 5000 }
    );
  } catch {
    return; // tmux not running or no panes
  }

  const panes = tmuxOutput
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [paneId, indexStr, windowName, cwd, command, sessionName] = line.split('\t');
      return {
        paneId,
        windowIndex: parseInt(indexStr, 10),
        windowName,
        cwd,
        command,
        sessionName,
      };
    });

  if (panes.length === 0) return;

  // Read claude-sessions.json to get claude session IDs
  const panesPath = join(stateDir, 'claude-sessions.json');
  const panesState = await readPanesState(panesPath);

  // Get active window
  let activeWindow = 1;
  try {
    const activeOutput = execSync('tmux display-message -p "#{window_index}"', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    activeWindow = parseInt(activeOutput.trim(), 10) || 1;
  } catch {
    // Use default
  }

  // Build session state — deduplicate by window index (take first pane per window)
  const sessionName = panes[0].sessionName;
  const seenWindows = new Set<number>();
  const windows: WindowEntry[] = [];

  for (const pane of panes) {
    if (seenWindows.has(pane.windowIndex)) continue;
    seenWindows.add(pane.windowIndex);

    const paneEntry = panesState[pane.paneId];
    const hasClaudeEntry =
      typeof paneEntry === 'object' && paneEntry !== null && 'session_id' in paneEntry;
    const isClaudeCommand = pane.command === 'claude';

    const window: WindowEntry = {
      index: pane.windowIndex,
      name: pane.windowName,
      cwd: pane.cwd,
      program: hasClaudeEntry || isClaudeCommand ? 'claude' : null,
    };

    if (hasClaudeEntry) {
      window.claude_session_id = paneEntry.session_id;
    }

    windows.push(window);
  }

  // Write session state
  const sessionState: SessionState = {
    version: 1,
    saved_at: new Date().toISOString(),
    tmux_session: sessionName,
    active_window: activeWindow,
    windows,
  };

  await writeSessionState(join(stateDir, 'session.json'), sessionState);

  // Prune stale pane entries
  const activePaneIds = panes.map((p) => p.paneId);
  const pruned = pruneStaleEntries(panesState, activePaneIds);
  await writePanesState(panesPath, pruned);
}

export const tmuxSaveCommand = new Command('tmux-save')
  .description('Save current tmux session state for persistence across rebuilds (container only)')
  .action(async () => {
    try {
      await executeTmuxSave();
    } catch {
      // Silent failure — this runs in tmux hooks and must not produce output
    }
  });
