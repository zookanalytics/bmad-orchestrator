import type { Dirent, Stats } from 'node:fs';

import { describe, it, expect, vi } from 'vitest';

import type { ContainerLifecycle } from './container.js';
import type { GitStateDetector } from './git.js';
import type { ListResult, ListSuccess } from './list-instances.js';
import type { GitStateResult, InstanceState } from './types.js';

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
    instance: 'test-instance',
    repoSlug: 'repo',
    repoUrl: 'https://github.com/user/repo.git',
    createdAt: '2026-01-15T10:00:00.000Z',
    lastAttached: '2026-02-03T08:30:00.000Z',
    purpose: null,
    containerName: 'ae-test-instance',
    ...overrides,
  };
}

/** Create a clean GitStateResult */
function makeCleanGitState(): GitStateResult {
  return {
    ok: true,
    state: {
      hasStaged: false,
      stagedCount: 0,
      hasUnstaged: false,
      unstagedCount: 0,
      hasUntracked: false,
      untrackedCount: 0,
      stashCount: 0,
      firstStashMessage: '',
      unpushedBranches: [],
      unpushedCommitCounts: {},
      neverPushedBranches: [],
      isDetachedHead: false,
      isClean: true,
    },
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
      ports: {},
      labels: {},
    }),
    getContainerNameById: vi.fn().mockResolvedValue(null),
    findContainerByWorkspaceLabel: vi.fn().mockResolvedValue(null),
    devcontainerUp: vi.fn().mockResolvedValue({
      ok: true,
      status: 'running',
      containerId: 'abc123',
    }),
    dockerPull: vi.fn().mockResolvedValue({ ok: true }),
    containerStop: vi.fn().mockResolvedValue({ ok: true }),
    containerRemove: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

/** Create mock git state detector */
function mockGitDetector(result: GitStateResult = makeCleanGitState()): GitStateDetector {
  return {
    getGitState: vi.fn().mockResolvedValue(result),
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
          .mockResolvedValueOnce({
            ok: true,
            status: 'running',
            containerId: 'a',
            ports: {},
            labels: {},
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 'stopped',
            containerId: 'b',
            ports: {},
            labels: {},
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 'running',
            containerId: 'c',
            ports: {},
            labels: {},
          }),
      });

      const wsFsDeps = mockFsDeps(['repo-alpha', 'repo-beta', 'repo-gamma']);
      const stateFsDeps = mockStateFsDeps({
        'repo-alpha': makeState({
          instance: 'repo-alpha',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-repo-alpha',
        }),
        'repo-beta': makeState({
          instance: 'repo-beta',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-repo-beta',
          purpose: 'Testing',
        }),
        'repo-gamma': makeState({
          instance: 'repo-gamma',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-repo-gamma',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      expect(result.ok).toBe(true);
      assertSuccess(result);
      expect(result.instances).toHaveLength(3);
      expect(result.instances[0].name).toBe('repo-alpha');
      expect(result.instances[1].name).toBe('repo-beta');
      expect(result.instances[2].name).toBe('repo-gamma');
    });

    it('shows running status in green (AC: #2)', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          containerId: 'a',
          ports: {},
          labels: {},
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].status).toBe('running');
    });

    it('shows stopped status (AC: #3)', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'stopped',
          containerId: 'a',
          ports: {},
          labels: {},
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
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
        'orphaned-ws': makeState({
          instance: 'orphaned-ws',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-orphaned-ws',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
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
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
          purpose: 'Auth work',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
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
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      expect(statusFn).not.toHaveBeenCalled();
    });

    it('still detects git state when Docker is unavailable', async () => {
      const cleanState = makeCleanGitState();
      const gitDetector = mockGitDetector(cleanState);
      const container = mockContainer({
        isDockerAvailable: vi.fn().mockResolvedValue(false),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector,
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].gitState).toEqual(cleanState);
      expect(gitDetector.getGitState).toHaveBeenCalledTimes(1);
    });
  });

  describe('last attached timestamp (AC: #6)', () => {
    it('includes lastAttached from state', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
          lastAttached: '2026-02-03T06:30:00.000Z',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
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

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].lastAttached).toBeNull();
    });
  });

  describe('empty workspace list', () => {
    it('returns empty array when no workspaces exist', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps([]);

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
      });

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
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
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
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
          purpose: 'OAuth implementation',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].purpose).toBe('OAuth implementation');
    });

    it('sets purpose to null when not set in state', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
          purpose: null,
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].purpose).toBeNull();
    });
  });

  describe('SSH connection string', () => {
    it('shows SSH connection for running instances with port 22 mapped', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          containerId: 'abc',
          ports: { '22/tcp': '22' },
          labels: {},
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].sshConnection).toBe('node@ae-my-instance.orb.local');
    });

    it('shows SSH connection for exposed-but-not-published port 22 (OrbStack)', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          containerId: 'abc',
          ports: { '22/tcp': '' },
          labels: {},
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({ name: 'my-instance', containerName: 'ae-my-instance' }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].sshConnection).toBe('node@ae-my-instance.orb.local');
    });

    it('uses dev.orbstack.domains label for SSH hostname when present', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          containerId: 'abc',
          ports: { '22/tcp': '' },
          labels: { 'dev.orbstack.domains': 'my-instance.repo.local' },
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({ name: 'my-instance', containerName: 'ae-my-instance' }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].sshConnection).toBe('node@my-instance.repo.local');
    });

    it('uses first domain when dev.orbstack.domains contains comma-separated list', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          containerId: 'abc',
          ports: { '22/tcp': '' },
          labels: { 'dev.orbstack.domains': 'primary.local,secondary.local' },
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({ name: 'my-instance', containerName: 'ae-my-instance' }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].sshConnection).toBe('node@primary.local');
    });

    it('includes localhost port fallback when mapped to non-standard port', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          containerId: 'abc',
          ports: { '22/tcp': '49152' },
          labels: {},
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].sshConnection).toBe(
        'node@ae-my-instance.orb.local (localhost:49152)'
      );
    });

    it('shows null SSH connection for stopped instances', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'stopped',
          containerId: 'abc',
          ports: {},
          labels: {},
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].sshConnection).toBeNull();
    });

    it('shows null SSH connection when no SSH port is exposed', async () => {
      const container = mockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          containerId: 'abc',
          ports: { '3000/tcp': '3000' },
          labels: {},
        }),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].sshConnection).toBeNull();
    });

    it('shows null SSH connection when Docker is unavailable', async () => {
      const container = mockContainer({
        isDockerAvailable: vi.fn().mockResolvedValue(false),
      });
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].sshConnection).toBeNull();
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
        'ws-one': makeState({
          instance: 'ws-one',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-ws-one',
        }),
        'ws-two': makeState({
          instance: 'ws-two',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-ws-two',
        }),
      });

      await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      expect(statusFn).toHaveBeenCalledTimes(2);
      expect(statusFn).toHaveBeenCalledWith('ae-ws-one');
      expect(statusFn).toHaveBeenCalledWith('ae-ws-two');
    });
  });

  describe('git state detection', () => {
    it('includes git state for each instance when Docker is available', async () => {
      const cleanState = makeCleanGitState();
      const gitDetector = mockGitDetector(cleanState);
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector,
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].gitState).toEqual(cleanState);
      expect(gitDetector.getGitState).toHaveBeenCalledTimes(1);
    });

    it('calls getGitState with workspace root path', async () => {
      const gitDetector = mockGitDetector();
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-ws']);
      const stateFsDeps = mockStateFsDeps({
        'my-ws': makeState({
          instance: 'my-ws',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-ws',
        }),
      });

      await listInstances({
        container,
        gitDetector,
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      expect(gitDetector.getGitState).toHaveBeenCalledWith(expect.stringContaining('/my-ws'));
    });

    it('detects git state in parallel for multiple instances', async () => {
      const gitFn = vi.fn().mockResolvedValue(makeCleanGitState());
      const gitDetector: GitStateDetector = { getGitState: gitFn };
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['ws-a', 'ws-b', 'ws-c']);
      const stateFsDeps = mockStateFsDeps({
        'ws-a': makeState({
          instance: 'ws-a',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-ws-a',
        }),
        'ws-b': makeState({
          instance: 'ws-b',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-ws-b',
        }),
        'ws-c': makeState({
          instance: 'ws-c',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-ws-c',
        }),
      });

      await listInstances({
        container,
        gitDetector,
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      expect(gitFn).toHaveBeenCalledTimes(3);
    });

    it('includes dirty git state in instance info', async () => {
      const dirtyState: GitStateResult = {
        ok: true,
        state: {
          hasStaged: true,
          stagedCount: 1,
          hasUnstaged: false,
          unstagedCount: 0,
          hasUntracked: true,
          untrackedCount: 1,
          stashCount: 0,
          firstStashMessage: '',
          unpushedBranches: ['main'],
          unpushedCommitCounts: { main: 1 },
          neverPushedBranches: [],
          isDetachedHead: false,
          isClean: false,
        },
      };
      const gitDetector = mockGitDetector(dirtyState);
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector,
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].gitState).toEqual(dirtyState);
      expect(result.instances[0].gitState?.ok).toBe(true);
      if (result.instances[0].gitState?.ok) {
        expect(result.instances[0].gitState.state.hasStaged).toBe(true);
        expect(result.instances[0].gitState.state.unpushedBranches).toEqual(['main']);
      }
    });

    it('includes git error state gracefully', async () => {
      const errorState: GitStateResult = {
        ok: false,
        state: null,
        error: { code: 'GIT_ERROR', message: 'Not a git repo' },
      };
      const gitDetector = mockGitDetector(errorState);
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({
        'my-instance': makeState({
          instance: 'my-instance',
          repoSlug: 'repo',
          repoUrl: 'https://github.com/user/repo.git',
          containerName: 'ae-my-instance',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector,
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      // List should still succeed even if git state detection fails
      expect(result.instances[0].gitState).toEqual(errorState);
      expect(result.instances[0].gitState?.ok).toBe(false);
    });
  });

  describe('repo fields (Story 7.4)', () => {
    it('includes repoSlug and repoUrl from state', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['bmad-orch-auth']);
      const stateFsDeps = mockStateFsDeps({
        'bmad-orch-auth': makeState({
          instance: 'auth',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
          containerName: 'ae-bmad-orchestrator-auth',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances[0].repoSlug).toBe('bmad-orchestrator');
      expect(result.instances[0].repoUrl).toBe('https://github.com/user/bmad-orchestrator.git');
    });

    it('includes fallback repoSlug/repoUrl for missing state', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['my-instance']);
      const stateFsDeps = mockStateFsDeps({});
      stateFsDeps.readFile = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      // Fallback state has 'unknown' for repoSlug and repoUrl
      expect(result.instances[0].repoSlug).toBe('unknown');
      expect(result.instances[0].repoUrl).toBe('unknown');
    });

    it('includes different repoSlugs for instances from different repos', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['bmad-orch-auth', 'awesome-cli-dev']);
      const stateFsDeps = mockStateFsDeps({
        'bmad-orch-auth': makeState({
          instance: 'auth',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
          containerName: 'ae-bmad-orchestrator-auth',
        }),
        'awesome-cli-dev': makeState({
          instance: 'dev',
          repoSlug: 'awesome-cli',
          repoUrl: 'https://github.com/user/awesome-cli.git',
          containerName: 'ae-awesome-cli-dev',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances).toHaveLength(2);
      expect(result.instances[0].repoSlug).toBe('bmad-orchestrator');
      expect(result.instances[1].repoSlug).toBe('awesome-cli');
    });
  });

  describe('repo filter (Story 7.4)', () => {
    it('filters instances by repoSlug when repoFilter is provided', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['bmad-orch-auth', 'awesome-cli-dev', 'bmad-orch-api']);
      const stateFsDeps = mockStateFsDeps({
        'bmad-orch-auth': makeState({
          instance: 'auth',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
          containerName: 'ae-bmad-orchestrator-auth',
        }),
        'awesome-cli-dev': makeState({
          instance: 'dev',
          repoSlug: 'awesome-cli',
          repoUrl: 'https://github.com/user/awesome-cli.git',
          containerName: 'ae-awesome-cli-dev',
        }),
        'bmad-orch-api': makeState({
          instance: 'api',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
          containerName: 'ae-bmad-orchestrator-api',
        }),
      });

      const result = await listInstances(
        {
          container,
          gitDetector: mockGitDetector(),
          workspaceFsDeps: wsFsDeps,
          stateFsDeps,
        },
        { repoFilter: 'bmad-orchestrator' }
      );
      assertSuccess(result);

      expect(result.instances).toHaveLength(2);
      expect(result.instances[0].repoSlug).toBe('bmad-orchestrator');
      expect(result.instances[1].repoSlug).toBe('bmad-orchestrator');
    });

    it('returns empty array when no instances match repoFilter', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['bmad-orch-auth']);
      const stateFsDeps = mockStateFsDeps({
        'bmad-orch-auth': makeState({
          instance: 'auth',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
          containerName: 'ae-bmad-orchestrator-auth',
        }),
      });

      const result = await listInstances(
        {
          container,
          gitDetector: mockGitDetector(),
          workspaceFsDeps: wsFsDeps,
          stateFsDeps,
        },
        { repoFilter: 'nonexistent-repo' }
      );
      assertSuccess(result);

      expect(result.instances).toHaveLength(0);
    });

    it('performs case-insensitive repoFilter matching', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['bmad-orch-auth']);
      const stateFsDeps = mockStateFsDeps({
        'bmad-orch-auth': makeState({
          instance: 'auth',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
          containerName: 'ae-bmad-orchestrator-auth',
        }),
      });

      const result = await listInstances(
        {
          container,
          gitDetector: mockGitDetector(),
          workspaceFsDeps: wsFsDeps,
          stateFsDeps,
        },
        { repoFilter: 'BMAD-ORCHESTRATOR' }
      );
      assertSuccess(result);

      expect(result.instances).toHaveLength(1);
      expect(result.instances[0].repoSlug).toBe('bmad-orchestrator');
    });

    it('returns all instances when repoFilter is undefined', async () => {
      const container = mockContainer();
      const wsFsDeps = mockFsDeps(['bmad-orch-auth', 'awesome-cli-dev']);
      const stateFsDeps = mockStateFsDeps({
        'bmad-orch-auth': makeState({
          instance: 'auth',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
          containerName: 'ae-bmad-orchestrator-auth',
        }),
        'awesome-cli-dev': makeState({
          instance: 'dev',
          repoSlug: 'awesome-cli',
          repoUrl: 'https://github.com/user/awesome-cli.git',
          containerName: 'ae-awesome-cli-dev',
        }),
      });

      const result = await listInstances({
        container,
        gitDetector: mockGitDetector(),
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });
      assertSuccess(result);

      expect(result.instances).toHaveLength(2);
    });
  });
});
