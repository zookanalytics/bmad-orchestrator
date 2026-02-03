import type { Dirent, Stats } from 'node:fs';

import { describe, it, expect, vi } from 'vitest';

import type { ContainerLifecycle } from './container.js';
import type { ListResult, ListSuccess } from './list-instances.js';
import type { InstanceState } from './types.js';

import { listInstances } from './list-instances.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Assert result is successful and narrow type */
function assertSuccess(result: ListResult): asserts result is ListSuccess {
  if (!result.ok) {
    throw new Error(`Expected ok:true but got error: ${result.error.message}`);
  }
}

/** Create a mock Dirent for directory entries */
function mockDirent(name: string): Dirent {
  return {
    name,
    isDirectory: () => true,
    isFile: () => false,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    path: '',
    parentPath: '',
  };
}

/** Create a valid InstanceState */
function makeState(overrides: Partial<InstanceState> = {}): InstanceState {
  return {
    name: 'test-instance',
    repo: 'https://github.com/user/repo.git',
    createdAt: '2026-01-15T10:00:00.000Z',
    lastAttached: '2026-02-03T08:30:00.000Z',
    purpose: null,
    containerName: 'ae-test-instance',
    ...overrides,
  };
}

/** Create mock container lifecycle */
function mockContainer(overrides: Partial<ContainerLifecycle> = {}): ContainerLifecycle {
  return {
    isDockerAvailable: vi.fn().mockResolvedValue(true),
    containerStatus: vi.fn().mockResolvedValue({
      ok: true,
      status: 'running',
      containerId: 'abc123',
    }),
    devcontainerUp: vi.fn().mockResolvedValue({
      ok: true,
      status: 'running',
      containerId: 'abc123',
    }),
    ...overrides,
  };
}

/** Create mock FsDeps for workspace scanning */
function mockFsDeps(workspaceNames: string[]) {
  return {
    readdir: vi.fn().mockResolvedValue(workspaceNames.map(mockDirent)),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => true } as Stats),
    homedir: vi.fn().mockReturnValue('/home/testuser'),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
}

/** Create mock StateFsDeps */
function mockStateFsDeps(states: Record<string, InstanceState>) {
  return {
    readFile: vi.fn().mockImplementation(async (path: string) => {
      // Extract workspace name from path: /home/testuser/.agent-env/workspaces/<name>/.agent-env/state.json
      for (const [name, state] of Object.entries(states)) {
        if (path.includes(`/${name}/`)) {
          return JSON.stringify(state);
        }
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    }),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('listInstances', () => {
  describe('with multiple instances', () => {
    it('returns all instances with their statuses (AC: #1)', async () => {
      const container = mockContainer({
        containerStatus: vi
          .fn()
          .mockResolvedValueOnce({ ok: true, status: 'running', containerId: 'a' })
          .mockResolvedValueOnce({ ok: true, status: 'stopped', containerId: 'b' })
          .mockResolvedValueOnce({ ok: true, status: 'running', containerId: 'c' }),
      });

      const wsFsDeps = mockFsDeps(['repo-alpha', 'repo-beta', 'repo-gamma']);
      const stateFsDeps = mockStateFsDeps({
        'repo-alpha': makeState({ name: 'repo-alpha', containerName: 'ae-repo-alpha' }),
        'repo-beta': makeState({
          name: 'repo-beta',
          containerName: 'ae-repo-beta',
          purpose: 'Testing',
        }),
        'repo-gamma': makeState({ name: 'repo-gamma', containerName: 'ae-repo-gamma' }),
      });

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });

      expect(result.ok).toBe(true);
      assertSuccess(result);
      expect(result.instances).toHaveLength(3);
      expect(result.instances[0].name).toBe('repo-alpha');
      expect(result.instances[1].name).toBe('repo-beta');
      expect(result.instances[2].name).toBe('repo-gamma');
    });

    it('shows running status in green (AC: #2)', async () => {
      const container = mockContainer({
        containerStatus: vi
          .fn()
          .mockResolvedValue({ ok: true, status: 'running', containerId: 'a' }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({ name: 'my-instance', containerName: 'ae-my-instance' }),
      });

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });
      assertSuccess(result);

      expect(result.instances[0].status).toBe('running');
    });

    it('shows stopped status (AC: #3)', async () => {
      const container = mockContainer({
        containerStatus: vi
          .fn()
          .mockResolvedValue({ ok: true, status: 'stopped', containerId: 'a' }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({ name: 'my-instance', containerName: 'ae-my-instance' }),
      });

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });
      assertSuccess(result);

      expect(result.instances[0].status).toBe('stopped');
    });
  });

  describe('orphaned instances (AC: #4)', () => {
    it('shows orphaned when workspace exists but container is not found', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'not-found',
          containerId: null,
        }),
      });
      const wsFsDeps = mockFsDeps(['orphaned-ws']);
      const stateFsDeps = mockStateFsDeps({
        'orphaned-ws': makeState({ name: 'orphaned-ws', containerName: 'ae-orphaned-ws' }),
      });

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });
      assertSuccess(result);

      expect(result.instances[0].status).toBe('orphaned');
    });
  });

  describe('Docker unavailable (AC: #5)', () => {
    it('shows unknown status when Docker is not available', async () => {
      const container = mockContainer({
        isDockerAvailable: vi.fn().mockResolvedValue(false),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          name: 'my-instance',
          containerName: 'ae-my-instance',
          purpose: 'Auth work',
        }),
      });

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });
      assertSuccess(result);

      expect(result.dockerAvailable).toBe(false);
      expect(result.instances[0].status).toBe('unknown');
      // Still shows workspace-level info
      expect(result.instances[0].name).toBe('my-instance');
      expect(result.instances[0].purpose).toBe('Auth work');
      expect(result.instances[0].lastAttached).toBe('2026-02-03T08:30:00.000Z');
    });

    it('does not call containerStatus when Docker is unavailable', async () => {
      const statusFn = vi.fn();
      const container = mockContainer({
        isDockerAvailable: vi.fn().mockResolvedValue(false),
        containerStatus: statusFn,
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({ name: 'my-instance', containerName: 'ae-my-instance' }),
      });

      await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });

      expect(statusFn).not.toHaveBeenCalled();
    });
  });

  describe('last attached timestamp (AC: #6)', () => {
    it('includes lastAttached from state', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          name: 'my-instance',
          containerName: 'ae-my-instance',
          lastAttached: '2026-02-03T06:30:00.000Z',
        }),
      });

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });
      assertSuccess(result);

      expect(result.instances[0].lastAttached).toBe('2026-02-03T06:30:00.000Z');
    });

    it('sets lastAttached to null when state has unknown value', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      // State fallback returns "unknown" for lastAttached
      const stateFsDeps = mockStateFsDeps({});
      // Force readFile to throw ENOENT to get fallback state
      stateFsDeps.readFile = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });
      assertSuccess(result);

      expect(result.instances[0].lastAttached).toBeNull();
    });
  });

  describe('empty workspace list', () => {
    it('returns empty array when no workspaces exist', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps([]);

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps });

      expect(result.ok).toBe(true);
      assertSuccess(result);
      expect(result.instances).toHaveLength(0);
    });
  });

  describe('container status error handling', () => {
    it('shows unknown when container status check returns error', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: false,
          status: 'not-found',
          containerId: null,
          error: { code: 'CONTAINER_ERROR', message: 'Something went wrong' },
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({ name: 'my-instance', containerName: 'ae-my-instance' }),
      });

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });
      assertSuccess(result);

      expect(result.instances[0].status).toBe('unknown');
    });
  });

  describe('purpose field', () => {
    it('includes purpose from state when set', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          name: 'my-instance',
          containerName: 'ae-my-instance',
          purpose: 'OAuth implementation',
        }),
      });

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });
      assertSuccess(result);

      expect(result.instances[0].purpose).toBe('OAuth implementation');
    });

    it('sets purpose to null when not set in state', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          name: 'my-instance',
          containerName: 'ae-my-instance',
          purpose: null,
        }),
      });

      const result = await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });
      assertSuccess(result);

      expect(result.instances[0].purpose).toBeNull();
    });
  });

  describe('parallel execution', () => {
    it('checks container status for each instance using containerName from state', async () => {
      const statusFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'abc',
      });
      const container = mockContainer({ containerStatus: statusFn });
      const wsFsDeps = mockFsDeps(['ws-one', 'ws-two']);
      const stateFsDeps = mockStateFsDeps({
        'ws-one': makeState({ name: 'ws-one', containerName: 'ae-ws-one' }),
        'ws-two': makeState({ name: 'ws-two', containerName: 'ae-ws-two' }),
      });

      await listInstances({ container, workspaceFsDeps: wsFsDeps, stateFsDeps });

      expect(statusFn).toHaveBeenCalledTimes(2);
      expect(statusFn).toHaveBeenCalledWith('ae-ws-one');
      expect(statusFn).toHaveBeenCalledWith('ae-ws-two');
    });
  });
});
