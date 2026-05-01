/**
 * Tail-N overwriting progress display for long-running subprocesses.
 *
 * Maintains a fixed-size window of the most recent output lines (default 5),
 * redrawing the block in place using ANSI cursor controls. Writes to stderr
 * so it doesn't interfere with structured stdout output.
 */

const ERASE_LINE = '\x1b[K';
const PREFIX = '⏳ ';
const PREFIX_LEN = 3;
const DEFAULT_MAX_LINES = 5;

export interface ProgressLine {
  /** Append a new line to the tail window and redraw the block. */
  update(line: string): void;
  /** Clear the entire block and restore the cursor to its top. */
  clear(): void;
}

/**
 * Create a tail-N progress display on stderr.
 *
 * Each `update()` adds a line to a ring buffer of size `maxLines` and redraws
 * the block in place. Older lines scroll out of the buffer once it fills.
 * `clear()` erases all visible lines and parks the cursor where the block began.
 *
 * @param stream - Writable stream (defaults to process.stderr)
 * @param columns - Terminal width for truncation (defaults to stderr columns or 80)
 * @param maxLines - Maximum tail lines to keep visible (defaults to 5)
 */
export function createProgressLine(
  stream: NodeJS.WriteStream = process.stderr,
  columns?: number,
  maxLines: number = DEFAULT_MAX_LINES
): ProgressLine {
  if (!stream.isTTY) {
    return { update() {}, clear() {} };
  }

  const maxWidth = columns ?? stream.columns ?? 80;
  const buffer: string[] = [];
  let drawnHeight = 0;

  function truncate(line: string): string {
    // eslint-disable-next-line no-control-regex
    const clean = line.replace(/\x1b\[[0-9;]*m/g, '');
    if (clean.length + PREFIX_LEN <= maxWidth) {
      return clean;
    }
    return clean.slice(0, maxWidth - PREFIX_LEN - 1) + '…';
  }

  function redraw(): void {
    let out = '';
    if (drawnHeight > 1) {
      out += `\x1b[${drawnHeight - 1}A`;
    }
    out += '\r';
    for (let i = 0; i < buffer.length; i++) {
      if (i > 0) out += '\n';
      out += `${ERASE_LINE}${PREFIX}${truncate(buffer[i])}`;
    }
    stream.write(out);
    drawnHeight = buffer.length;
  }

  return {
    update(line: string) {
      buffer.push(line);
      if (buffer.length > maxLines) {
        buffer.shift();
      }
      redraw();
    },

    clear() {
      if (drawnHeight === 0) return;
      let out = '';
      if (drawnHeight > 1) {
        out += `\x1b[${drawnHeight - 1}A`;
      }
      out += `\r${ERASE_LINE}`;
      for (let i = 1; i < drawnHeight; i++) {
        out += `\n${ERASE_LINE}`;
      }
      if (drawnHeight > 1) {
        out += `\x1b[${drawnHeight - 1}A\r`;
      }
      stream.write(out);
      buffer.length = 0;
      drawnHeight = 0;
    },
  };
}
