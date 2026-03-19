import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockResolveRepoOrExit = vi.fn().mockResolvedValue(undefined);
const mockResolveInstance = vi.fn();
const mockLaunchActionLoop = vi.fn().mockResolvedValue(undefined);

vi.mock('../lib/command-helpers.js', () => ({
  resolveRepoOrExit: (...args: unknown[]) => mockResolveRepoOrExit(...args),
}));

vi.mock('../lib/workspace.js', () => ({
  resolveInstance: (...args: unknown[]) => mockResolveInstance(...args),
}));

vi.mock('../lib/interactive-menu.js', () => ({
  launchActionLoop: (...args: unknown[]) => mockLaunchActionLoop(...args),
}));

// Mock all the dependency creators so the command module can import them
vi.mock('../lib/attach-instance.js', () => ({
  createAttachDefaultDeps: vi.fn().mockReturnValue({}),
  attachInstance: vi.fn(),
}));

vi.mock('../lib/code-instance.js', () => ({
  createCodeDefaultDeps: vi.fn().mockReturnValue({}),
  codeInstance: vi.fn(),
}));

vi.mock('../lib/rebuild-instance.js', () => ({
  createRebuildDefaultDeps: vi.fn().mockReturnValue({}),
  rebuildInstance: vi.fn(),
}));

vi.mock('../lib/purpose-instance.js', () => ({
  createPurposeDefaultDeps: vi.fn().mockReturnValue({}),
  setPurpose: vi.fn(),
}));

vi.mock('../lib/list-instances.js', () => ({
  getInstanceInfo: vi.fn(),
}));

vi.mock('../lib/progress-line.js', () => ({
  createProgressLine: vi.fn().mockReturnValue({ update: vi.fn(), clear: vi.fn() }),
}));

vi.mock('ink', () => ({
  render: vi.fn().mockReturnValue({
    unmount: vi.fn(),
    waitUntilExit: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('react', () => ({
  default: { createElement: vi.fn() },
  createElement: vi.fn(),
}));

vi.mock('../components/InteractiveMenu.js', () => ({
  InteractiveMenu: vi.fn(),
}));

// Import after mocks are set up
const { onCommand } = await import('./on.js');

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Parse command options without executing the action */
function parseOptions(args: string[]) {
  const cmd = onCommand.createCommand('on');
  for (const opt of onCommand.options) {
    cmd.addOption(opt);
  }
  cmd.argument('<name>');
  cmd.exitOverride();
  const parsed = cmd.parseOptions(['node', 'on', ...args]);
  return { opts: cmd.opts(), args: parsed.operands };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let originalIsTTY: boolean | undefined;

beforeEach(() => {
  mockResolveRepoOrExit.mockReset().mockResolvedValue(undefined);
  mockResolveInstance.mockReset();
  mockLaunchActionLoop.mockReset().mockResolvedValue(undefined);
  vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // Default to TTY so most tests pass the gate
  originalIsTTY = process.stdin.isTTY;
  Object.defineProperty(process.stdin, 'isTTY', {
    value: true,
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

describe('on command option parsing', () => {
  it('parses --repo option', () => {
    const { opts } = parseOptions(['--repo', 'my-repo', 'test']);
    expect(opts.repo).toBe('my-repo');
  });

  it('repo is undefined when --repo is not passed', () => {
    const { opts } = parseOptions(['test']);
    expect(opts.repo).toBeUndefined();
  });
});

describe('on command TTY gate', () => {
  it('exits with error when not a TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });

    await onCommand.parseAsync(['node', 'on', 'test-instance']);

    expect(console.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mockLaunchActionLoop).not.toHaveBeenCalled();
  });
});

describe('on command instance resolution', () => {
  it('calls launchActionLoop when instance is found', async () => {
    mockResolveInstance.mockResolvedValue({ found: true, workspaceName: 'repo-test' });

    await onCommand.parseAsync(['node', 'on', 'test']);

    expect(mockResolveInstance).toHaveBeenCalledWith('test', undefined);
    expect(mockLaunchActionLoop).toHaveBeenCalledWith('repo-test', expect.any(Object), undefined);
  });

  it('passes repo slug through to resolveInstance and launchActionLoop', async () => {
    mockResolveRepoOrExit.mockResolvedValue('my-repo');
    mockResolveInstance.mockResolvedValue({ found: true, workspaceName: 'my-repo-test' });

    await onCommand.parseAsync(['node', 'on', 'test', '--repo', 'my-repo']);

    expect(mockResolveRepoOrExit).toHaveBeenCalledWith(
      expect.objectContaining({ repo: 'my-repo' })
    );
    expect(mockResolveInstance).toHaveBeenCalledWith('test', 'my-repo');
    expect(mockLaunchActionLoop).toHaveBeenCalledWith(
      'my-repo-test',
      expect.any(Object),
      'my-repo'
    );
  });

  it('exits with error when instance is not found', async () => {
    mockResolveInstance.mockResolvedValue({
      found: false,
      error: {
        code: 'WORKSPACE_NOT_FOUND',
        message: "Instance 'nope' not found",
        suggestion: 'Use `agent-env list` to see available instances.',
      },
    });

    await onCommand.parseAsync(['node', 'on', 'nope']);

    expect(console.error).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(mockLaunchActionLoop).not.toHaveBeenCalled();
  });
});
