import type { Dirent, Stats } from 'node:fs';

import { describe, it, expect, vi } from 'vitest';

import type { ListReposResult, ListReposSuccess } from './list-repos.js';
import type { InstanceState } from './types.js';

import { listRepos } from './list-repos.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Assert result is successful and narrow type */
function assertSuccess(result: ListReposResult): asserts result is ListReposSuccess {
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
    containerName: 'ae-repo-test-instance',
    repoConfigDetected: false,
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

describe('listRepos', () => {
  describe('with multiple repos (AC: #1)', () => {
    it('aggregates repos from workspaces and returns sorted by slug', async () => {
      const wsFsDeps = mockFsDeps([
        'bmad-orchestrator-auth',
        'bmad-orchestrator-api',
        'awesome-cli-dev',
      ]);
      const stateFsDeps = mockStateFsDeps({
        'bmad-orchestrator-auth': makeState({
          instance: 'auth',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
        }),
        'bmad-orchestrator-api': makeState({
          instance: 'api',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
        }),
        'awesome-cli-dev': makeState({
          instance: 'dev',
          repoSlug: 'awesome-cli',
          repoUrl: 'https://github.com/user/awesome-cli.git',
        }),
      });

      const result = await listRepos({
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      assertSuccess(result);
      expect(result.repos).toHaveLength(2);

      // Sorted alphabetically by slug
      expect(result.repos[0].slug).toBe('awesome-cli');
      expect(result.repos[0].url).toBe('https://github.com/user/awesome-cli.git');
      expect(result.repos[0].instanceCount).toBe(1);

      expect(result.repos[1].slug).toBe('bmad-orchestrator');
      expect(result.repos[1].url).toBe('https://github.com/user/bmad-orchestrator.git');
      expect(result.repos[1].instanceCount).toBe(2);
    });
  });

  describe('with no workspaces (AC: #2)', () => {
    it('returns empty array when no workspaces exist', async () => {
      const wsFsDeps = mockFsDeps([]);

      const result = await listRepos({
        workspaceFsDeps: wsFsDeps,
      });

      assertSuccess(result);
      expect(result.repos).toHaveLength(0);
    });
  });

  describe('dynamic registry (AC: #3)', () => {
    it('excludes repos when all their instances are removed', async () => {
      // Only bmad-orchestrator instances exist — awesome-cli has been removed
      const wsFsDeps = mockFsDeps(['bmad-orchestrator-auth']);
      const stateFsDeps = mockStateFsDeps({
        'bmad-orchestrator-auth': makeState({
          instance: 'auth',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'https://github.com/user/bmad-orchestrator.git',
        }),
      });

      const result = await listRepos({
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      assertSuccess(result);
      expect(result.repos).toHaveLength(1);
      expect(result.repos[0].slug).toBe('bmad-orchestrator');
      // awesome-cli does NOT appear since its workspaces have been removed
    });
  });

  describe('instance count', () => {
    it('correctly counts multiple instances for the same repo', async () => {
      const wsFsDeps = mockFsDeps(['my-repo-alpha', 'my-repo-beta', 'my-repo-gamma']);
      const stateFsDeps = mockStateFsDeps({
        'my-repo-alpha': makeState({
          instance: 'alpha',
          repoSlug: 'my-repo',
          repoUrl: 'https://github.com/user/my-repo.git',
        }),
        'my-repo-beta': makeState({
          instance: 'beta',
          repoSlug: 'my-repo',
          repoUrl: 'https://github.com/user/my-repo.git',
        }),
        'my-repo-gamma': makeState({
          instance: 'gamma',
          repoSlug: 'my-repo',
          repoUrl: 'https://github.com/user/my-repo.git',
        }),
      });

      const result = await listRepos({
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      assertSuccess(result);
      expect(result.repos).toHaveLength(1);
      expect(result.repos[0].slug).toBe('my-repo');
      expect(result.repos[0].instanceCount).toBe(3);
    });
  });

  describe('corrupted/missing state files', () => {
    it('skips workspaces with unknown repoSlug (corrupted state)', async () => {
      const wsFsDeps = mockFsDeps(['good-ws', 'bad-ws']);
      const stateFsDeps = mockStateFsDeps({
        'good-ws': makeState({
          instance: 'main',
          repoSlug: 'good-repo',
          repoUrl: 'https://github.com/user/good-repo.git',
        }),
      });
      // bad-ws has no entry in states map, so readFile throws ENOENT → fallback state with 'unknown' slug

      const result = await listRepos({
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      assertSuccess(result);
      expect(result.repos).toHaveLength(1);
      expect(result.repos[0].slug).toBe('good-repo');
    });

    it('returns empty when all workspaces have corrupted state', async () => {
      const wsFsDeps = mockFsDeps(['bad-ws-1', 'bad-ws-2']);
      const stateFsDeps = {
        readFile: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
      };

      const result = await listRepos({
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      assertSuccess(result);
      expect(result.repos).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('returns error result when scanWorkspaces throws', async () => {
      const wsFsDeps = {
        readdir: vi.fn().mockRejectedValue(new Error('Permission denied')),
        stat: vi.fn(),
        homedir: vi.fn().mockReturnValue('/home/testuser'),
        mkdir: vi.fn(),
      };

      const result = await listRepos({
        workspaceFsDeps: wsFsDeps,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('LIST_REPOS_ERROR');
        expect(result.error.message).toContain('Permission denied');
      }
    });
  });

  describe('single repo single instance', () => {
    it('returns one repo with instanceCount 1', async () => {
      const wsFsDeps = mockFsDeps(['my-repo-dev']);
      const stateFsDeps = mockStateFsDeps({
        'my-repo-dev': makeState({
          instance: 'dev',
          repoSlug: 'my-repo',
          repoUrl: 'https://github.com/user/my-repo.git',
        }),
      });

      const result = await listRepos({
        workspaceFsDeps: wsFsDeps,
        stateFsDeps,
      });

      assertSuccess(result);
      expect(result.repos).toHaveLength(1);
      expect(result.repos[0]).toEqual({
        slug: 'my-repo',
        url: 'https://github.com/user/my-repo.git',
        instanceCount: 1,
      });
    });
  });
});
