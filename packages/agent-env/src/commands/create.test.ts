import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockResolveRepoArg = vi.fn();
vi.mock('../lib/resolve-repo-arg.js', () => ({
  resolveRepoArg: (...args: unknown[]) => mockResolveRepoArg(...args),
}));

const mockResolveRepoUrl = vi.fn();
const mockCreateInstance = vi.fn();
const mockCreateDefaultDeps = vi.fn();
const mockAttachToInstance = vi.fn();
vi.mock('../lib/create-instance.js', () => ({
  resolveRepoUrl: (...args: unknown[]) => mockResolveRepoUrl(...args),
  createInstance: (...args: unknown[]) => mockCreateInstance(...args),
  createDefaultDeps: (...args: unknown[]) => mockCreateDefaultDeps(...args),
  attachToInstance: (...args: unknown[]) => mockAttachToInstance(...args),
}));

// Import after mocks are set up
const { createCommand } = await import('./create.js');

// ─── Test helpers ────────────────────────────────────────────────────────────

const fakeDeps = { executor: vi.fn() };

function setupMocksForSuccess(repoUrl: string, resolvedFromSlug = false) {
  mockCreateDefaultDeps.mockReturnValue(fakeDeps);
  mockResolveRepoArg.mockResolvedValue({ ok: true, url: repoUrl, resolvedFromSlug });
  mockResolveRepoUrl.mockResolvedValue({ ok: true, url: repoUrl });
  mockCreateInstance.mockResolvedValue({
    ok: true,
    workspacePath: { root: '/home/user/.agent-env/workspaces/repo-test', name: 'repo-test' },
    containerName: 'ae-repo-test',
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('create command — slug resolution', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    // Reset process.argv to avoid --baseline / --no-baseline detection
    process.argv = ['node', 'agent-env', 'create', 'test-instance', '--repo', 'placeholder'];
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('slug resolved to URL (AC: #1)', () => {
    it('resolves slug and passes URL to createInstance', async () => {
      setupMocksForSuccess('https://github.com/user/bmad-orchestrator.git', true);

      await createCommand.parseAsync(['test-instance', '--repo', 'bmad-orchestrator'], {
        from: 'user',
      });

      // resolveRepoArg was called with the slug
      expect(mockResolveRepoArg).toHaveBeenCalledWith('bmad-orchestrator');

      // resolveRepoUrl was called with the resolved URL
      expect(mockResolveRepoUrl).toHaveBeenCalledWith(
        'https://github.com/user/bmad-orchestrator.git',
        fakeDeps.executor
      );

      // createInstance was called with the final URL
      expect(mockCreateInstance).toHaveBeenCalledWith(
        'test-instance',
        'https://github.com/user/bmad-orchestrator.git',
        fakeDeps,
        expect.objectContaining({})
      );

      // User sees the resolution message
      const allLogs = consoleLogSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(allLogs.some((log: string) => log.includes("Resolved repo 'bmad-orchestrator'"))).toBe(
        true
      );
    });
  });

  describe('unknown slug (AC: #2)', () => {
    it('shows error message for unknown slug', async () => {
      mockCreateDefaultDeps.mockReturnValue(fakeDeps);
      mockResolveRepoArg.mockResolvedValue({
        ok: false,
        error: {
          code: 'REPO_NOT_FOUND',
          message: "Repository 'unknown-repo' not found.",
          suggestion: 'Use a full URL or run `agent-env repos` to see tracked repos.',
        },
      });
      // process.exit doesn't stop execution in tests, so mock downstream calls
      // to prevent TypeError when code continues past the mocked exit
      mockResolveRepoUrl.mockResolvedValue({ ok: true, url: '' });
      mockCreateInstance.mockResolvedValue({
        ok: true,
        workspacePath: { root: '', name: '' },
        containerName: '',
      });

      await createCommand.parseAsync(['test-instance', '--repo', 'unknown-repo'], {
        from: 'user',
      });

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(errorOutput).toContain('REPO_NOT_FOUND');
      expect(errorOutput).toContain('not found');
    });
  });

  describe('full URL bypass (AC: #3)', () => {
    it('passes full URL through without slug resolution', async () => {
      setupMocksForSuccess('https://github.com/user/new-repo.git', false);

      await createCommand.parseAsync(
        ['test-instance', '--repo', 'https://github.com/user/new-repo.git'],
        { from: 'user' }
      );

      // resolveRepoArg was called but detected URL, so no slug lookup
      expect(mockResolveRepoArg).toHaveBeenCalledWith('https://github.com/user/new-repo.git');

      // No "Resolved repo" message should appear
      const allLogs = consoleLogSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(allLogs.some((log: string) => log.includes('Resolved repo'))).toBe(false);

      // createInstance was called with the original URL
      expect(mockCreateInstance).toHaveBeenCalled();
    });
  });
});
