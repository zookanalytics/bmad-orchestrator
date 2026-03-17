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
  const name = savedName || process.env.AGENT_INSTANCE || 'main';
  tmuxExecSafe(`tmux new-session -d -s "${name}"`);
  return name;
}

export async function executeTmuxRestore(): Promise<void> {
  const stateDir = resolveTmuxStateDir();
  if (!stateDir) return;

  const sessionState = await readSessionState(join(stateDir, 'session.json'));
  if (!sessionState) return;

  const sessionName = ensureTmuxSession(sessionState.tmux_session);

  for (let i = 0; i < sessionState.windows.length; i++) {
    const win = sessionState.windows[i];

    if (i === 0) {
      // Reuse the existing first window — rename it and set its working directory
      tmuxExecSafe(`tmux rename-window -t "${sessionName}:1" "${win.name}"`);
      tmuxExecSafe(
        `tmux send-keys -t "${sessionName}:1" "cd '${win.cwd.replace(/'/g, "'\\''")}'" Enter`
      );
    } else {
      // Create a new window
      tmuxExecSafe(`tmux new-window -t "${sessionName}" -n "${win.name}" -c "${win.cwd}"`);
    }

    // Launch claude if this window had an active session
    // Target by window index (more reliable than name which may have special chars)
    if (win.program === 'claude' && win.claude_session_id) {
      tmuxExecSafe(
        `tmux send-keys -t "${sessionName}:${win.index}" "claude --resume ${win.claude_session_id}" Enter`
      );
    }
  }

  // Select the previously active window
  if (sessionState.active_window) {
    tmuxExecSafe(`tmux select-window -t "${sessionName}:${sessionState.active_window}"`);
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
