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
});
