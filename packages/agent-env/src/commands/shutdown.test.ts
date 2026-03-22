import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockShutdownInstance = vi.fn();
const mockCreateShutdownDefaultDeps = vi.fn().mockReturnValue({});
const mockResolveRepo = vi.fn().mockResolvedValue({ resolved: false });

vi.mock('../lib/shutdown-instance.js', () => ({
  shutdownInstance: (...args: unknown[]) => mockShutdownInstance(...args),
  createShutdownDefaultDeps: () => mockCreateShutdownDefaultDeps(),
}));

vi.mock('../lib/workspace.js', () => ({
  resolveRepo: (...args: unknown[]) => mockResolveRepo(...args),
}));

// Import after mocks are set up
const { shutdownCommand } = await import('./shutdown.js');

// ─── Tests ───────────────────────────────────────────────────────────────────

let originalIsTTY: boolean | undefined;

beforeEach(() => {
  mockShutdownInstance.mockReset();
  mockShutdownInstance.mockResolvedValue({ ok: true, containerName: 'ae-test', tmuxSaved: true });
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

describe('shutdown command', () => {
  it('calls shutdownInstance with the instance name', async () => {
    await shutdownCommand.parseAsync(['node', 'shutdown', 'myapp']);

    expect(mockShutdownInstance).toHaveBeenCalledWith('myapp', expect.any(Object), undefined);
  });

  it('skips confirmation in non-TTY mode', async () => {
    await shutdownCommand.parseAsync(['node', 'shutdown', 'myapp']);

    expect(mockShutdownInstance).toHaveBeenCalled();
  });

  it('calls process.exit(1) on failure', async () => {
    mockShutdownInstance.mockResolvedValue({
      ok: false,
      error: { code: 'CONTAINER_NOT_RUNNING', message: 'Not running' },
    });

    await shutdownCommand.parseAsync(['node', 'shutdown', 'myapp']);

    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('passes --repo option to shutdownInstance', async () => {
    mockResolveRepo.mockResolvedValue({ resolved: true, repoSlug: 'my-repo' });

    await shutdownCommand.parseAsync(['node', 'shutdown', 'myapp', '--repo', 'my-repo']);

    expect(mockShutdownInstance).toHaveBeenCalledWith('myapp', expect.any(Object), 'my-repo');
  });
});
