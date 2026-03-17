/**
 * tmux-restore command for agent-env
 *
 * Reconstructs tmux windows from saved session.json state.
 * Designed to run in postStartCommand after tmux server is created.
 */

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { readSessionState, resolveTmuxStateDir } from '../lib/tmux-session.js';

/**
 * Shell-quote a string by wrapping in single quotes and escaping embedded single quotes.
 * Prevents command injection when interpolating untrusted values into shell commands.
 */
function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function tmuxExec(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
}

function tmuxExecSafe(cmd: string): boolean {
  try {
    execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Find or create the target tmux session.
 * Returns the session name.
 */
function ensureTmuxSession(savedName: string): string {
  // Check if any session exists
  try {
    const sessions = tmuxExec('tmux list-sessions -F "#{session_name}"')
      .trim()
      .split('\n')
      .filter(Boolean);

    if (sessions.includes(savedName)) {
      return savedName;
    }
    if (sessions.length > 0) {
      return sessions[0];
    }
  } catch {
    // No sessions exist
  }

  // Create session with the saved name
  const name = savedName || 'agent-env';
  tmuxExecSafe(`tmux new-session -d -s ${shellQuote(name)}`);
  return name;
}

export async function executeTmuxRestore(): Promise<void> {
  const stateDir = resolveTmuxStateDir();
  if (!stateDir) return;

  const sessionState = await readSessionState(join(stateDir, 'session.json'));
  if (!sessionState) return;

  const sessionName = ensureTmuxSession(sessionState.tmux_session);

  const quotedSession = shellQuote(sessionName);

  // Create all windows fresh with -c (sets cwd silently, no echoed cd command).
  // The default window from session creation will be killed afterwards.
  for (const win of sessionState.windows) {
    tmuxExecSafe(
      `tmux new-window -t ${quotedSession} -n ${shellQuote(win.name)} -c ${shellQuote(win.cwd)}`
    );
  }

  // Kill the original default window. With renumber-windows on, the new
  // windows shift down to start at 1 automatically.
  tmuxExecSafe(`tmux kill-window -t ${quotedSession}:1`);

  // Launch claude in windows that had active sessions.
  // After renumbering, windows are indexed 1..N matching their creation order.
  for (let i = 0; i < sessionState.windows.length; i++) {
    const win = sessionState.windows[i];
    if (win.program === 'claude' && win.claude_session_id) {
      const windowIndex = i + 1;
      tmuxExecSafe(
        `tmux send-keys -t ${quotedSession}:${windowIndex} ${shellQuote(`claude --resume ${win.claude_session_id} || claude`)} Enter`
      );
    }
  }

  // Select the previously active window, remapping the saved index to the
  // post-renumber position (windows are now sequentially 1..N).
  if (sessionState.active_window) {
    const activeIdx = sessionState.windows.findIndex((w) => w.index === sessionState.active_window);
    if (activeIdx >= 0) {
      tmuxExecSafe(`tmux select-window -t ${quotedSession}:${activeIdx + 1}`);
    }
  }
}

export const tmuxRestoreCommand = new Command('tmux-restore')
  .description('Restore tmux session state from saved state (container only)')
  .action(async () => {
    try {
      await executeTmuxRestore();
    } catch {
      // Silent failure — this runs in postStartCommand
    }
  });
