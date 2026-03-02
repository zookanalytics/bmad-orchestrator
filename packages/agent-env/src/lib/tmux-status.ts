/**
 * TMUX status line formatting for agent-env instances
 *
 * Single source of truth for reading instance + purpose from state.json
 * and formatting for the tmux status bar display.
 *
 * Output format:
 *   With purpose:    "<instance> | <purpose>"
 *   Without purpose: "<instance>"
 *   Error/missing:   "?"
 *
 * Purpose is truncated at 40 characters with "…"
 */

import { readFile } from 'node:fs/promises';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum purpose length before truncation in tmux display */
export const MAX_PURPOSE_DISPLAY_LEN = 40;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TmuxStatusDeps {
  readFile: typeof readFile;
}

const defaultDeps: TmuxStatusDeps = { readFile };

// ─── Core ────────────────────────────────────────────────────────────────────

/**
 * Format instance and purpose for tmux status bar display.
 *
 * Pure formatting function — no I/O. Truncates purpose at
 * MAX_PURPOSE_DISPLAY_LEN characters with "…" suffix.
 *
 * @param instance - Instance name (e.g., "auth")
 * @param purpose - Purpose string or null/empty
 * @returns Formatted display string
 */
export function formatTmuxStatus(instance: string, purpose: string | null): string {
  if (!instance) return '?';

  if (!purpose) return instance;

  if (purpose.length > MAX_PURPOSE_DISPLAY_LEN) {
    return `${instance} | ${purpose.slice(0, MAX_PURPOSE_DISPLAY_LEN)}…`;
  }

  return `${instance} | ${purpose}`;
}

/**
 * Read state.json and return the formatted tmux status line.
 *
 * Reads the state file, extracts instance and purpose, and formats
 * for tmux display. Returns "?" for any error condition (missing file,
 * malformed JSON, missing fields).
 *
 * @param statePath - Absolute path to state.json
 * @param deps - Injectable dependencies for testing
 * @returns Formatted display string (never throws)
 */
export async function getTmuxStatus(
  statePath: string,
  deps: TmuxStatusDeps = defaultDeps
): Promise<string> {
  let content: string;
  try {
    content = await deps.readFile(statePath, 'utf-8');
  } catch {
    return '?';
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return '?';
  }

  if (typeof parsed !== 'object' || parsed === null) return '?';

  const obj = parsed as Record<string, unknown>;
  const instance = typeof obj.instance === 'string' ? obj.instance : '';
  const purpose = typeof obj.purpose === 'string' ? obj.purpose : null;

  return formatTmuxStatus(instance, purpose);
}
