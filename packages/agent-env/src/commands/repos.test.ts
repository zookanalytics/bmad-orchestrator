import type { JsonOutput } from '@zookanalytics/shared';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { RepoInfo, ListReposError, ListReposSuccess } from '../lib/list-repos.js';

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockListRepos = vi.fn();
vi.mock('../lib/list-repos.js', () => ({
  listRepos: (...args: unknown[]) => mockListRepos(...args),
}));

// Import after mocks are set up
const { reposCommand } = await import('./repos.js');

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeSuccessResult(repos: RepoInfo[] = []): ListReposSuccess {
  return {
    ok: true,
    repos,
  };
}

function makeErrorResult(code: string, message: string): ListReposError {
  return {
    ok: false,
    repos: null,
    error: { code, message },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('repos command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = 0;
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.exitCode = undefined;
  });

  /** Parse the JSON string that was passed to console.log */
  function getCapturedJson(): JsonOutput<RepoInfo[]> {
    expect(consoleLogSpy).toHaveBeenCalled();
    const jsonStr = consoleLogSpy.mock.calls[0][0] as string;
    return JSON.parse(jsonStr) as JsonOutput<RepoInfo[]>;
  }

  describe('plain text output (AC: #1)', () => {
    it('outputs table with repo slug, instance count, and URL', async () => {
      const repos: RepoInfo[] = [
        { slug: 'awesome-cli', url: 'https://github.com/user/awesome-cli.git', instanceCount: 1 },
        {
          slug: 'bmad-orchestrator',
          url: 'https://github.com/user/bmad-orchestrator.git',
          instanceCount: 2,
        },
      ];
      mockListRepos.mockResolvedValue(makeSuccessResult(repos));

      await reposCommand.parseAsync([], { from: 'user' });

      // Header + 2 data rows
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);

      // Header contains column names
      const header = consoleLogSpy.mock.calls[0][0] as string;
      expect(header).toContain('REPO');
      expect(header).toContain('INSTANCES');
      expect(header).toContain('URL');

      // First data row
      const row1 = consoleLogSpy.mock.calls[1][0] as string;
      expect(row1).toContain('awesome-cli');
      expect(row1).toContain('1');
      expect(row1).toContain('https://github.com/user/awesome-cli.git');

      // Second data row
      const row2 = consoleLogSpy.mock.calls[2][0] as string;
      expect(row2).toContain('bmad-orchestrator');
      expect(row2).toContain('2');
      expect(row2).toContain('https://github.com/user/bmad-orchestrator.git');
    });
  });

  describe('empty repos message (AC: #2)', () => {
    it('displays "No repositories tracked" message when no repos exist', async () => {
      mockListRepos.mockResolvedValue(makeSuccessResult([]));

      await reposCommand.parseAsync([], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0] as string;
      expect(output).toContain('No repositories tracked');
      expect(output).toContain('agent-env create <name> --repo <url|slug>');
    });
  });

  describe('--json output (AC: #4)', () => {
    it('returns JSON with repos array when repos exist', async () => {
      const repos: RepoInfo[] = [
        { slug: 'awesome-cli', url: 'https://github.com/user/awesome-cli.git', instanceCount: 1 },
        {
          slug: 'bmad-orchestrator',
          url: 'https://github.com/user/bmad-orchestrator.git',
          instanceCount: 3,
        },
      ];
      mockListRepos.mockResolvedValue(makeSuccessResult(repos));

      await reposCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      expect(output.ok).toBe(true);
      expect(output.error).toBeNull();
      expect(output.data).toHaveLength(2);
      expect(output.data?.[0]).toEqual({
        slug: 'awesome-cli',
        url: 'https://github.com/user/awesome-cli.git',
        instanceCount: 1,
      });
      expect(output.data?.[1]).toEqual({
        slug: 'bmad-orchestrator',
        url: 'https://github.com/user/bmad-orchestrator.git',
        instanceCount: 3,
      });
    });

    it('returns empty data array when no repos exist', async () => {
      mockListRepos.mockResolvedValue(makeSuccessResult([]));

      await reposCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      expect(output.ok).toBe(true);
      expect(output.data).toEqual([]);
      expect(output.error).toBeNull();
    });

    it('produces valid pretty-printed JSON', async () => {
      mockListRepos.mockResolvedValue(
        makeSuccessResult([
          { slug: 'test', url: 'https://github.com/user/test.git', instanceCount: 1 },
        ])
      );

      await reposCommand.parseAsync(['--json'], { from: 'user' });

      const jsonStr = consoleLogSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(jsonStr)).not.toThrow();
      expect(jsonStr).toContain('\n');
    });
  });

  describe('error handling', () => {
    it('outputs formatted error to stderr in plain text mode', async () => {
      mockListRepos.mockResolvedValue(
        makeErrorResult('LIST_REPOS_ERROR', 'Failed to list repos: permission denied')
      );

      await reposCommand.parseAsync([], { from: 'user' });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const stderrOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(stderrOutput).toContain('LIST_REPOS_ERROR');
      expect(stderrOutput).toContain('permission denied');
      expect(process.exitCode).toBe(1);
    });

    it('outputs JSON error when --json is used', async () => {
      mockListRepos.mockResolvedValue(
        makeErrorResult('LIST_REPOS_ERROR', 'Failed to list repos: permission denied')
      );

      await reposCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      expect(output.ok).toBe(false);
      expect(output.data).toBeNull();
      expect(output.error?.code).toBe('LIST_REPOS_ERROR');
      expect(output.error?.message).toContain('permission denied');
      expect(process.exitCode).toBe(1);
    });

    it('does not write to stderr when --json error occurs', async () => {
      mockListRepos.mockResolvedValue(makeErrorResult('LIST_REPOS_ERROR', 'Something went wrong'));

      await reposCommand.parseAsync(['--json'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('exit codes', () => {
    it('does not set failure exitCode on success', async () => {
      mockListRepos.mockResolvedValue(makeSuccessResult([]));

      await reposCommand.parseAsync([], { from: 'user' });

      expect(process.exitCode).toBe(0);
    });

    it('sets exitCode to 1 on error', async () => {
      mockListRepos.mockResolvedValue(makeErrorResult('LIST_REPOS_ERROR', 'Something went wrong'));

      await reposCommand.parseAsync([], { from: 'user' });

      expect(process.exitCode).toBe(1);
    });
  });
});
