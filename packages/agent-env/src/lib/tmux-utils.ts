/**
 * Shared tmux utilities for agent-env
 *
 * Provides reusable tmux operations used across multiple orchestration flows
 * (e.g., rebuild, shutdown).
 */

import type { ExecuteResult } from '@zookanalytics/shared';

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export interface TmuxSaveDeps {
  executor: Execute;
  logger?: { warn: (message: string) => void; info: (message: string) => void };
}

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Save tmux session state inside a container (best-effort).
 *
 * Executes `agent-env tmux-save` inside the container via `docker exec`.
 * Returns whether the save succeeded. Does not throw under normal conditions
 * (executor uses reject: false).
 */
export async function saveTmuxState(containerName: string, deps: TmuxSaveDeps): Promise<boolean> {
  try {
    const result = await deps.executor(
      'docker',
      ['exec', containerName, 'bash', '-lc', 'agent-env tmux-save'],
      { timeout: 30_000 }
    );
    if (result.ok) {
      deps.logger?.info('Saved tmux session state');
      return true;
    } else {
      deps.logger?.warn('Could not save tmux session state (non-fatal)');
      return false;
    }
  } catch {
    deps.logger?.warn('Could not save tmux session state (non-fatal)');
    return false;
  }
}
