import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockRebuildInstance = vi.fn();
const mockCreateRebuildDefaultDeps = vi.fn().mockReturnValue({});
const mockResolveRepo = vi.fn().mockResolvedValue({ resolved: false });

vi.mock('../lib/rebuild-instance.js', () => ({
  rebuildInstance: (...args: unknown[]) => mockRebuildInstance(...args),
  createRebuildDefaultDeps: () => mockCreateRebuildDefaultDeps(),
}));

vi.mock('../lib/workspace.js', () => ({
  resolveRepo: (...args: unknown[]) => mockResolveRepo(...args),
}));

// Import after mocks are set up
const { rebuildCommand } = await import('./rebuild.js');

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Parse command options without executing the action (uses Commander's parseOptions) */
function parseOptions(args: string[]) {
  // Create a fresh copy to avoid Commander's state mutation
  const cmd = rebuildCommand.createCommand('rebuild');
  // Copy option definitions from the real command
  for (const opt of rebuildCommand.options) {
    cmd.addOption(opt);
  }
  cmd.argument('<name>');
  cmd.exitOverride(); // prevent process.exit
  const parsed = cmd.parseOptions(['node', 'rebuild', ...args]);
  return { opts: cmd.opts(), args: parsed.operands };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let originalIsTTY: boolean | undefined;

beforeEach(() => {
  mockRebuildInstance.mockReset();
  mockRebuildInstance.mockResolvedValue({ ok: true, containerName: 'ae-test', wasRunning: false });
  vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  // Force non-TTY to skip the confirmation prompt
  originalIsTTY = process.stdin.isTTY;
  Object.defineProperty(process.stdin, 'isTTY', {
    value: false,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(process.stdin, 'isTTY', {
    value: originalIsTTY,
    writable: true,
    configurable: true,
  });
});

describe('rebuild command option parsing', () => {
  it('--no-pull sets pull to false', () => {
    const { opts } = parseOptions(['--no-pull', 'test']);
    expect(opts.pull).toBe(false);
  });

  it('pull defaults to true when --no-pull is not passed', () => {
    const { opts } = parseOptions(['test']);
    expect(opts.pull).toBe(true);
  });

  it('--use-cache sets useCache to true', () => {
    const { opts } = parseOptions(['--use-cache', 'test']);
    expect(opts.useCache).toBe(true);
  });

  it('useCache is undefined when --use-cache is not passed', () => {
    const { opts } = parseOptions(['test']);
    expect(opts.useCache).toBeUndefined();
  });

  it('passes pull: false and noCache: true to rebuildInstance when --no-pull is used', async () => {
    await rebuildCommand.parseAsync(['node', 'rebuild', 'test-instance', '--no-pull', '--force']);

    expect(mockRebuildInstance).toHaveBeenCalledWith(
      'test-instance',
      expect.any(Object),
      expect.objectContaining({ pull: false, noCache: true }),
      undefined
    );
  });

  it('passes noCache: false to rebuildInstance when --use-cache is used', async () => {
    await rebuildCommand.parseAsync(['node', 'rebuild', 'test-instance', '--use-cache', '--force']);

    expect(mockRebuildInstance).toHaveBeenCalledWith(
      'test-instance',
      expect.any(Object),
      expect.objectContaining({ noCache: false }),
      undefined
    );
  });

  it('passes default pull: true and noCache: true when no flags specified', async () => {
    await rebuildCommand.parseAsync(['node', 'rebuild', 'test-instance', '--force']);

    expect(mockRebuildInstance).toHaveBeenCalledWith(
      'test-instance',
      expect.any(Object),
      expect.objectContaining({ pull: true, noCache: true }),
      undefined
    );
  });
});
