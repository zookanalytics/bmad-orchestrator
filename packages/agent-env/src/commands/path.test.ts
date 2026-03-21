import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockResolveRepoOrExit = vi.fn().mockResolvedValue(undefined);
const mockResolveInstance = vi.fn();
const mockGetWorkspacePathByName = vi.fn();

vi.mock('@zookanalytics/shared', () => ({
  formatError: (err: unknown) => JSON.stringify(err),
  createError: (code: string, message: string, suggestion?: string) => ({
    code,
    message,
    suggestion,
  }),
}));

vi.mock('../lib/command-helpers.js', () => ({
  resolveRepoOrExit: (...args: unknown[]) => mockResolveRepoOrExit(...args),
}));

vi.mock('../lib/workspace.js', () => ({
  resolveInstance: (...args: unknown[]) => mockResolveInstance(...args),
  getWorkspacePathByName: (...args: unknown[]) => mockGetWorkspacePathByName(...args),
}));

// Import after mocks are set up
const { pathCommand } = await import('./path.js');

// ─── Tests ────────────────────────────────────────────────────────────────────

let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockResolveRepoOrExit.mockReset().mockResolvedValue(undefined);
  mockResolveInstance.mockReset();
  mockGetWorkspacePathByName.mockReset();
  vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('path command', () => {
  it('prints workspace root path on success', async () => {
    mockResolveInstance.mockResolvedValue({
      found: true,
      workspaceName: 'myrepo-auth',
    });
    mockGetWorkspacePathByName.mockReturnValue({
      root: '/home/user/.agent-env/workspaces/myrepo-auth',
      name: 'myrepo-auth',
      agentEnvDir: '/home/user/.agent-env/workspaces/myrepo-auth/.agent-env',
      stateFile: '/home/user/.agent-env/workspaces/myrepo-auth/.agent-env/state.json',
    });

    await pathCommand.parseAsync(['node', 'path', 'auth']);

    expect(consoleLogSpy).toHaveBeenCalledWith('/home/user/.agent-env/workspaces/myrepo-auth');
  });

  it('exits with error when instance not found', async () => {
    mockResolveInstance.mockResolvedValue({
      found: false,
      error: {
        code: 'WORKSPACE_NOT_FOUND',
        message: "Instance 'nope' not found",
        suggestion: 'Use `agent-env list` to see available instances.',
      },
    });

    await pathCommand.parseAsync(['node', 'path', 'nope']);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const errorOutput = consoleErrorSpy.mock.calls[0][0] as string;
    expect(errorOutput).toContain('WORKSPACE_NOT_FOUND');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('passes repo slug from --repo option to resolveInstance', async () => {
    mockResolveRepoOrExit.mockResolvedValue('myrepo');
    mockResolveInstance.mockResolvedValue({
      found: true,
      workspaceName: 'myrepo-auth',
    });
    mockGetWorkspacePathByName.mockReturnValue({
      root: '/home/user/.agent-env/workspaces/myrepo-auth',
      name: 'myrepo-auth',
      agentEnvDir: '/home/user/.agent-env/workspaces/myrepo-auth/.agent-env',
      stateFile: '/home/user/.agent-env/workspaces/myrepo-auth/.agent-env/state.json',
    });

    await pathCommand.parseAsync(['node', 'path', 'auth', '--repo', 'myrepo']);

    expect(mockResolveInstance).toHaveBeenCalledWith('auth', 'myrepo');
  });
});
