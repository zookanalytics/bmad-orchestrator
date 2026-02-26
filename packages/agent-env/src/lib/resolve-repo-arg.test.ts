import { describe, it, expect, vi } from 'vitest';

import type { ListReposResult } from './list-repos.js';
import type { ResolveRepoArgResult } from './resolve-repo-arg.js';

import { isRepoUrl, resolveRepoArg } from './resolve-repo-arg.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Assert result is successful and narrow type */
function assertSuccess(
  result: ResolveRepoArgResult
): asserts result is Extract<ResolveRepoArgResult, { ok: true }> {
  if (!result.ok) {
    throw new Error(`Expected ok:true but got error: ${result.error.message}`);
  }
}

/** Create a successful listRepos result */
function makeReposSuccess(
  repos: { slug: string; url: string; instanceCount: number }[] = []
): ListReposResult {
  return { ok: true, repos };
}

/** Create a failed listRepos result */
function makeReposError(message: string): ListReposResult {
  return {
    ok: false,
    repos: null,
    error: { code: 'LIST_REPOS_ERROR', message },
  };
}

// ─── isRepoUrl tests ────────────────────────────────────────────────────────

describe('isRepoUrl', () => {
  it('returns true for HTTPS URLs', () => {
    expect(isRepoUrl('https://github.com/user/repo.git')).toBe(true);
    expect(isRepoUrl('https://gitlab.com/org/project')).toBe(true);
  });

  it('returns true for HTTP URLs', () => {
    expect(isRepoUrl('http://github.com/user/repo.git')).toBe(true);
  });

  it('returns true for SSH URLs', () => {
    expect(isRepoUrl('git@github.com:user/repo.git')).toBe(true);
    expect(isRepoUrl('git@gitlab.com:org/project.git')).toBe(true);
  });

  it('returns false for plain slugs', () => {
    expect(isRepoUrl('bmad-orchestrator')).toBe(false);
    expect(isRepoUrl('awesome-cli')).toBe(false);
    expect(isRepoUrl('my.repo')).toBe(false);
  });

  it('returns false for "."', () => {
    expect(isRepoUrl('.')).toBe(false);
  });
});

// ─── resolveRepoArg tests ───────────────────────────────────────────────────

describe('resolveRepoArg', () => {
  describe('URL pass-through (AC: #3)', () => {
    it('passes through HTTPS URL without slug lookup', async () => {
      const mockListRepos = vi.fn();
      const result = await resolveRepoArg('https://github.com/user/new-repo.git', {
        listRepos: mockListRepos,
      });

      assertSuccess(result);
      expect(result.url).toBe('https://github.com/user/new-repo.git');
      expect(result.resolvedFromSlug).toBe(false);
      expect(mockListRepos).not.toHaveBeenCalled();
    });

    it('passes through SSH URL without slug lookup', async () => {
      const mockListRepos = vi.fn();
      const result = await resolveRepoArg('git@github.com:user/new-repo.git', {
        listRepos: mockListRepos,
      });

      assertSuccess(result);
      expect(result.url).toBe('git@github.com:user/new-repo.git');
      expect(result.resolvedFromSlug).toBe(false);
      expect(mockListRepos).not.toHaveBeenCalled();
    });
  });

  describe('"." pass-through', () => {
    it('passes through "." without slug lookup', async () => {
      const mockListRepos = vi.fn();
      const result = await resolveRepoArg('.', { listRepos: mockListRepos });

      assertSuccess(result);
      expect(result.url).toBe('.');
      expect(result.resolvedFromSlug).toBe(false);
      expect(mockListRepos).not.toHaveBeenCalled();
    });
  });

  describe('slug resolution (AC: #1)', () => {
    it('resolves known slug to full URL from registry', async () => {
      const mockListRepos = vi.fn().mockResolvedValue(
        makeReposSuccess([
          {
            slug: 'bmad-orchestrator',
            url: 'https://github.com/user/bmad-orchestrator.git',
            instanceCount: 2,
          },
          {
            slug: 'awesome-cli',
            url: 'https://github.com/user/awesome-cli.git',
            instanceCount: 1,
          },
        ])
      );

      const result = await resolveRepoArg('bmad-orchestrator', { listRepos: mockListRepos });

      assertSuccess(result);
      expect(result.url).toBe('https://github.com/user/bmad-orchestrator.git');
      expect(result.resolvedFromSlug).toBe(true);
      expect(mockListRepos).toHaveBeenCalledTimes(1);
    });
  });

  describe('unknown slug (AC: #2)', () => {
    it('returns error with helpful message for unknown slug', async () => {
      const mockListRepos = vi.fn().mockResolvedValue(
        makeReposSuccess([
          {
            slug: 'bmad-orchestrator',
            url: 'https://github.com/user/bmad-orchestrator.git',
            instanceCount: 1,
          },
        ])
      );

      const result = await resolveRepoArg('unknown-repo', { listRepos: mockListRepos });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('REPO_NOT_FOUND');
        expect(result.error.message).toContain("Repository 'unknown-repo' not found.");
        expect(result.error.suggestion).toContain('agent-env repos');
      }
    });

    it('returns error when registry is empty', async () => {
      const mockListRepos = vi.fn().mockResolvedValue(makeReposSuccess([]));

      const result = await resolveRepoArg('any-slug', { listRepos: mockListRepos });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('REPO_NOT_FOUND');
      }
    });
  });

  describe('listRepos failure', () => {
    it('propagates listRepos error', async () => {
      const mockListRepos = vi.fn().mockResolvedValue(makeReposError('Permission denied'));

      const result = await resolveRepoArg('some-slug', { listRepos: mockListRepos });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('REPO_LOOKUP_ERROR');
        expect(result.error.message).toContain('Permission denied');
      }
    });
  });
});
