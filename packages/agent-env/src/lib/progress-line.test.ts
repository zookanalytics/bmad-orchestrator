import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { createProgressLine } from './progress-line.js';

/** Create a fake writable stream that collects written chunks. */
function createMockStream(
  columns = 80,
  isTTY = true
): { stream: NodeJS.WriteStream; chunks: string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  }) as unknown as NodeJS.WriteStream;
  stream.columns = columns;
  stream.isTTY = isTTY;
  return { stream, chunks };
}

describe('createProgressLine', () => {
  it('writes a line with prefix and erase sequence', () => {
    const { stream, chunks } = createMockStream();
    const progress = createProgressLine(stream);

    progress.update('Installing dependencies...');

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('⏳');
    expect(chunks[0]).toContain('Installing dependencies...');
    // Should start with carriage return + erase
    // eslint-disable-next-line no-control-regex
    expect(chunks[0]).toMatch(/^\r\x1b\[K/);
  });

  it('truncates lines that exceed terminal width', () => {
    const { stream, chunks } = createMockStream(30);
    const progress = createProgressLine(stream, 30);

    const longLine = 'A'.repeat(50);
    progress.update(longLine);

    // PREFIX is 3 chars "⏳ ", so max text = 30 - 3 - 1 = 26 chars + "…"
    expect(chunks[0]).toContain('…');
    // The raw text after prefix should not exceed width
    // eslint-disable-next-line no-control-regex
    const afterPrefix = chunks[0].replace(/^\r\x1b\[K⏳ /, '');
    expect(afterPrefix.length).toBeLessThanOrEqual(30 - 3);
  });

  it('clears the line on clear()', () => {
    const { stream, chunks } = createMockStream();
    const progress = createProgressLine(stream);

    progress.update('something');
    const beforeClearCount = chunks.length;

    progress.clear();
    expect(chunks.length).toBe(beforeClearCount + 1);
    expect(chunks[chunks.length - 1]).toBe('\r\x1b[K');
  });

  it('clear() is a no-op if update() was never called', () => {
    const { stream, chunks } = createMockStream();
    const progress = createProgressLine(stream);

    progress.clear();
    expect(chunks).toHaveLength(0);
  });

  it('strips ANSI codes from output to prevent garbled truncation', () => {
    const { stream, chunks } = createMockStream(30);
    const progress = createProgressLine(stream, 30);

    // 10 visible chars with ANSI color wrapping
    const ansiLine = '\x1b[32mhello12345\x1b[0m';
    progress.update(ansiLine);

    // Should not be truncated since visible text (10 chars) + prefix (3) = 13 < 30
    expect(chunks[0]).not.toContain('…');
  });

  it('returns no-op when stream is not a TTY', () => {
    const { stream, chunks } = createMockStream(80, false);
    const progress = createProgressLine(stream);

    progress.update('should not appear');
    progress.update('still nothing');
    progress.clear();

    expect(chunks).toHaveLength(0);
  });

  it('keeps the last N lines visible across multiple updates', () => {
    const { stream, chunks } = createMockStream(80, true);
    const progress = createProgressLine(stream, 80, 5);

    progress.update('line one');
    progress.update('line two');
    progress.update('line three');

    const last = chunks[chunks.length - 1];
    expect(last).toContain('line one');
    expect(last).toContain('line two');
    expect(last).toContain('line three');
  });

  it('drops the oldest line when buffer exceeds maxLines', () => {
    const { stream, chunks } = createMockStream(80, true);
    const progress = createProgressLine(stream, 80, 2);

    progress.update('first');
    progress.update('second');
    progress.update('third');

    const last = chunks[chunks.length - 1];
    expect(last).not.toContain('first');
    expect(last).toContain('second');
    expect(last).toContain('third');
  });

  it('moves the cursor up to redraw the block on subsequent updates', () => {
    const { stream, chunks } = createMockStream(80, true);
    const progress = createProgressLine(stream, 80, 5);

    progress.update('a');
    progress.update('b');
    progress.update('c');

    // Third update redraws over a 2-line block, so it must move the cursor
    // up 1 line before redrawing.
    // eslint-disable-next-line no-control-regex
    expect(chunks[2]).toMatch(/\x1b\[1A/);
  });

  it('clear() erases all visible lines after multi-line updates', () => {
    const { stream, chunks } = createMockStream(80, true);
    const progress = createProgressLine(stream, 80, 5);

    progress.update('one');
    progress.update('two');
    chunks.length = 0;

    progress.clear();

    // Single concatenated emission for clear is fine; what matters is the
    // resulting bytes contain two erase-line sequences (one per visible row).
    const combined = chunks.join('');
    // eslint-disable-next-line no-control-regex
    const eraseCount = (combined.match(/\x1b\[K/g) ?? []).length;
    expect(eraseCount).toBeGreaterThanOrEqual(2);
    // Cursor must end up on the first row (so subsequent output overwrites
    // where the block began, not below it).
    // eslint-disable-next-line no-control-regex
    expect(combined).toMatch(/\x1b\[1A/);
  });
});
