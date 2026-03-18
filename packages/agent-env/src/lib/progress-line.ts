/**
 * Single-line overwriting progress display for long-running subprocesses.
 *
 * Writes to stderr so it doesn't interfere with structured stdout output.
 * Uses carriage return + erase-line to overwrite the current line,
 * showing only the most recent output — useful for spotting hangs.
 */

const ERASE_LINE = '\x1b[K';

export interface ProgressLine {
  /** Overwrite the current line with new text. */
  update(line: string): void;
  /** Clear the progress line and restore the cursor. */
  clear(): void;
}

/**
 * Create a single-line progress display on stderr.
 *
 * Each call to `update()` overwrites the previous line in-place.
 * Call `clear()` when done to leave the terminal clean.
 *
 * @param stream - Writable stream (defaults to process.stderr)
 * @param columns - Terminal width for truncation (defaults to stderr columns or 80)
 */
export function createProgressLine(
  stream: NodeJS.WriteStream = process.stderr,
  columns?: number
): ProgressLine {
  // When stderr is not a TTY (piped, CI, redirected), return a no-op to
  // avoid emitting raw ANSI escape codes into non-interactive output.
  if (!stream.isTTY) {
    return { update() {}, clear() {} };
  }

  const maxWidth = columns ?? stream.columns ?? 80;
  // Reserve space for the prefix "⏳ " (3 chars)
  const PREFIX = '⏳ ';
  const prefixLen = 3;
  let active = false;

  return {
    update(line: string) {
      // Strip ANSI escape codes — both for accurate length calculation and to
      // avoid garbled output when truncation would split an escape sequence.
      // eslint-disable-next-line no-control-regex
      const clean = line.replace(/\x1b\[[0-9;]*m/g, '');
      const truncated =
        clean.length + prefixLen > maxWidth
          ? clean.slice(0, maxWidth - prefixLen - 1) + '…'
          : clean;
      stream.write(`\r${ERASE_LINE}${PREFIX}${truncated}`);
      active = true;
    },

    clear() {
      if (active) {
        stream.write(`\r${ERASE_LINE}`);
        active = false;
      }
    },
  };
}
