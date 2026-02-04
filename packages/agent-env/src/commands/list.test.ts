import type { JsonOutput } from '@zookanalytics/shared';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { Instance, ListError, ListSuccess } from '../lib/list-instances.js';
import type { GitStateResult } from '../lib/types.js';

// ─── Module mocks ────────────────────────────────────────────────────────────

// Mock listInstances before importing the command
const mockListInstances = vi.fn();
vi.mock('../lib/list-instances.js', () => ({
  listInstances: (...args: unknown[]) => mockListInstances(...args),
}));

// Mock ink render to prevent actual terminal rendering
const mockRender = vi.fn().mockReturnValue({
  unmount: vi.fn(),
  waitUntilExit: vi.fn().mockResolvedValue(undefined),
});
vi.mock('ink', () => ({
  render: (...args: unknown[]) => mockRender(...args),
}));

// Import after mocks are set up
const { listCommand } = await import('./list.js');

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeCleanGitState(): GitStateResult {
  return {
    ok: true,
    state: {
      hasStaged: false,
      hasUnstaged: false,
      hasUntracked: false,
      stashCount: 0,
      unpushedBranches: [],
      neverPushedBranches: [],
      isDetachedHead: false,
      isClean: true,
    },
  };
}

function makeDirtyGitState(): GitStateResult {
  return {
    ok: true,
    state: {
      hasStaged: true,
      hasUnstaged: false,
      hasUntracked: true,
      stashCount: 2,
      unpushedBranches: ['feature-x'],
      neverPushedBranches: ['new-branch'],
      isDetachedHead: false,
      isClean: false,
    },
  };
}

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    name: 'test-instance',
    status: 'running',
    lastAttached: '2026-02-03T08:30:00.000Z',
    purpose: null,
    gitState: makeCleanGitState(),
    ...overrides,
  };
}

function makeSuccessResult(instances: Instance[] = []): ListSuccess {
  return {
    ok: true,
    instances,
    dockerAvailable: true,
  };
}

function makeErrorResult(code: string, message: string): ListError {
  return {
    ok: false,
    instances: null,
    dockerAvailable: null,
    error: { code, message },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('list command --json', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset exitCode before each test
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
  function getCapturedJson(): JsonOutput<Instance[]> {
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const jsonStr = consoleLogSpy.mock.calls[0][0] as string;
    return JSON.parse(jsonStr) as JsonOutput<Instance[]>;
  }

  describe('success output (AC: #1)', () => {
    it('returns { ok: true, data: [...], error: null } with instances', async () => {
      const instances = [
        makeInstance({ name: 'alpha', status: 'running', purpose: 'Auth work' }),
        makeInstance({ name: 'beta', status: 'stopped', purpose: null }),
      ];
      mockListInstances.mockResolvedValue(makeSuccessResult(instances));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      expect(output.ok).toBe(true);
      expect(output.data).toHaveLength(2);
      expect(output.error).toBeNull();
    });

    it('returns empty data array when no instances exist', async () => {
      mockListInstances.mockResolvedValue(makeSuccessResult([]));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      expect(output.ok).toBe(true);
      expect(output.data).toEqual([]);
      expect(output.error).toBeNull();
    });

    it('does not set a failure exitCode on success', async () => {
      mockListInstances.mockResolvedValue(makeSuccessResult([]));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      expect(process.exitCode).toBe(0);
    });
  });

  describe('instance fields in JSON (AC: #2)', () => {
    it('includes name, status, lastAttached, purpose, gitState for each instance', async () => {
      const instances = [
        makeInstance({
          name: 'my-project',
          status: 'running',
          lastAttached: '2026-02-03T10:00:00.000Z',
          purpose: 'Feature development',
          gitState: makeDirtyGitState(),
        }),
      ];
      mockListInstances.mockResolvedValue(makeSuccessResult(instances));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      const instance = output.data?.[0];
      expect(instance).toBeDefined();

      expect(instance).toHaveProperty('name', 'my-project');
      expect(instance).toHaveProperty('status', 'running');
      expect(instance).toHaveProperty('lastAttached', '2026-02-03T10:00:00.000Z');
      expect(instance).toHaveProperty('purpose', 'Feature development');
      expect(instance).toHaveProperty('gitState');
      expect(instance?.gitState).toBeDefined();
    });

    it('preserves null values for optional fields', async () => {
      const instances = [
        makeInstance({
          name: 'no-purpose',
          lastAttached: null,
          purpose: null,
          gitState: null,
        }),
      ];
      mockListInstances.mockResolvedValue(makeSuccessResult(instances));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      const instance = output.data?.[0];
      expect(instance).toBeDefined();

      expect(instance?.lastAttached).toBeNull();
      expect(instance?.purpose).toBeNull();
      expect(instance?.gitState).toBeNull();
    });

    it('includes gitState fields when git state is available', async () => {
      const dirtyGit = makeDirtyGitState();
      const instances = [makeInstance({ name: 'dirty-ws', gitState: dirtyGit })];
      mockListInstances.mockResolvedValue(makeSuccessResult(instances));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      const gitState = output.data?.[0]?.gitState as GitStateResult;

      expect(gitState.ok).toBe(true);
      if (gitState.ok) {
        expect(gitState.state.hasStaged).toBe(true);
        expect(gitState.state.hasUntracked).toBe(true);
        expect(gitState.state.stashCount).toBe(2);
        expect(gitState.state.unpushedBranches).toEqual(['feature-x']);
        expect(gitState.state.neverPushedBranches).toEqual(['new-branch']);
      }
    });

    it('does not include extra fields beyond the contract', async () => {
      const instances = [makeInstance({ name: 'clean-ws' })];
      mockListInstances.mockResolvedValue(makeSuccessResult(instances));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      const firstItem = output.data?.[0];
      expect(firstItem).toBeDefined();
      const keys = Object.keys(firstItem as unknown as Record<string, unknown>);

      expect(keys).toEqual(
        expect.arrayContaining(['name', 'status', 'lastAttached', 'purpose', 'gitState'])
      );
      expect(keys).toHaveLength(5);
    });
  });

  describe('error output (AC: #3)', () => {
    it('returns { ok: false, data: null, error: { code, message, suggestion } } on error', async () => {
      mockListInstances.mockResolvedValue(
        makeErrorResult('LIST_ERROR', 'Failed to list instances: permission denied')
      );

      await listCommand.parseAsync(['--json'], { from: 'user' });

      const output = getCapturedJson();
      expect(output.ok).toBe(false);
      expect(output.data).toBeNull();
      expect(output.error).toEqual({
        code: 'LIST_ERROR',
        message: 'Failed to list instances: permission denied',
        suggestion: 'Check if ~/.agent-env/workspaces/ is accessible.',
      });
    });

    it('sets process.exitCode = 1 on error', async () => {
      mockListInstances.mockResolvedValue(makeErrorResult('LIST_ERROR', 'Something went wrong'));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      expect(process.exitCode).toBe(1);
    });

    it('does not write to stderr when --json is used for errors', async () => {
      mockListInstances.mockResolvedValue(makeErrorResult('LIST_ERROR', 'Something went wrong'));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      // JSON error goes to stdout via console.log, not stderr
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('valid JSON output (AC: #4)', () => {
    it('produces valid JSON parseable by JSON.parse', async () => {
      const instances = [
        makeInstance({ name: 'alpha', purpose: 'Testing "quotes" and special chars' }),
      ];
      mockListInstances.mockResolvedValue(makeSuccessResult(instances));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      const jsonStr = consoleLogSpy.mock.calls[0][0] as string;
      expect(() => JSON.parse(jsonStr)).not.toThrow();
    });

    it('produces pretty-printed JSON (indented)', async () => {
      mockListInstances.mockResolvedValue(makeSuccessResult([makeInstance()]));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      const jsonStr = consoleLogSpy.mock.calls[0][0] as string;
      // Pretty-printed JSON has newlines
      expect(jsonStr).toContain('\n');
      // And indentation
      expect(jsonStr).toMatch(/^\{\n\s{2}/);
    });
  });

  describe('output suppression with --json', () => {
    it('does not render Ink components when --json is used', async () => {
      mockListInstances.mockResolvedValue(makeSuccessResult([makeInstance()]));

      await listCommand.parseAsync(['--json'], { from: 'user' });

      expect(mockRender).not.toHaveBeenCalled();
    });
  });

  describe('non-JSON error path', () => {
    it('writes formatted error to stderr when --json is not used', async () => {
      mockListInstances.mockResolvedValue(makeErrorResult('LIST_ERROR', 'Permission denied'));

      await listCommand.parseAsync([], { from: 'user' });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const stderrOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(stderrOutput).toContain('LIST_ERROR');
      expect(stderrOutput).toContain('Permission denied');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('sets process.exitCode = 1 on non-JSON error', async () => {
      mockListInstances.mockResolvedValue(makeErrorResult('LIST_ERROR', 'Something went wrong'));

      await listCommand.parseAsync([], { from: 'user' });

      expect(process.exitCode).toBe(1);
    });
  });
});
