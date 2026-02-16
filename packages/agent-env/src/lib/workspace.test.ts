import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { FsDeps } from './workspace.js';

import { AGENT_ENV_DIR, MAX_REPO_SLUG_LENGTH, STATE_FILE, WORKSPACES_DIR } from './types.js';
import {
  compressSlug,
  createWorkspace,
  deleteWorkspace,
  deriveContainerName,
  deriveRepoSlug,
  deriveWorkspaceName,
  getWorkspacePathByName,
  getWorkspacesBaseDir,
  getWorkspacePath,
  scanWorkspaces,
  workspaceExists,
} from './workspace.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Create FsDeps that use a temp directory as home */
function createTestDeps(tempHome: string): FsDeps {
  return {
    mkdir,
    readdir,
    stat,
    homedir: () => tempHome,
  };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ─── Pure function tests ─────────────────────────────────────────────────────

describe('deriveWorkspaceName', () => {
  it('combines repo and instance with dash', () => {
    expect(deriveWorkspaceName('bmad-orch', 'auth')).toBe('bmad-orch-auth');
  });

  it('handles single-word names', () => {
    expect(deriveWorkspaceName('repo', 'feature')).toBe('repo-feature');
  });

  it('rejects empty repo', () => {
    expect(() => deriveWorkspaceName('', 'auth')).toThrow('repo must not be empty');
  });

  it('rejects empty instance', () => {
    expect(() => deriveWorkspaceName('repo', '')).toThrow('instance must not be empty');
  });

  it('rejects path traversal characters', () => {
    expect(() => deriveWorkspaceName('../../etc', 'passwd')).toThrow('invalid characters');
  });

  it('rejects spaces in names', () => {
    expect(() => deriveWorkspaceName('foo bar', 'baz')).toThrow('invalid characters');
  });

  it('rejects names starting with dot', () => {
    expect(() => deriveWorkspaceName('.hidden', 'auth')).toThrow('invalid characters');
  });

  it('allows dots and underscores in names', () => {
    expect(deriveWorkspaceName('my_repo', 'v1.0')).toBe('my_repo-v1.0');
  });
});

describe('deriveRepoSlug', () => {
  it('extracts slug from HTTPS URL with .git suffix', () => {
    expect(deriveRepoSlug('https://github.com/user/bmad-orchestrator.git')).toBe(
      'bmad-orchestrator'
    );
  });

  it('extracts slug from HTTPS URL without .git suffix', () => {
    expect(deriveRepoSlug('https://github.com/user/bmad-orchestrator')).toBe('bmad-orchestrator');
  });

  it('extracts slug from SSH URL with .git suffix', () => {
    expect(deriveRepoSlug('git@github.com:user/repo.git')).toBe('repo');
  });

  it('extracts slug from SSH URL without .git suffix', () => {
    expect(deriveRepoSlug('git@github.com:user/repo')).toBe('repo');
  });

  it('handles trailing slashes', () => {
    expect(deriveRepoSlug('https://github.com/user/bmad-orchestrator/')).toBe('bmad-orchestrator');
  });

  it('handles nested paths in HTTPS URLs', () => {
    expect(deriveRepoSlug('https://gitlab.com/org/sub/repo-name.git')).toBe('repo-name');
  });

  it('handles repos with dots in the name', () => {
    expect(deriveRepoSlug('https://github.com/user/my.repo.name.git')).toBe('my.repo.name');
  });

  it('handles repos with hyphens and underscores', () => {
    expect(deriveRepoSlug('https://github.com/user/my-repo_name.git')).toBe('my-repo_name');
  });

  it('handles SSH URL with protocol prefix', () => {
    expect(deriveRepoSlug('ssh://git@github.com/user/repo.git')).toBe('repo');
  });

  it('lowercases the slug', () => {
    expect(deriveRepoSlug('https://github.com/user/My-REPO.git')).toBe('my-repo');
  });

  it('compresses slugs longer than 39 characters', () => {
    const longUrl =
      'https://github.com/user/my-extremely-long-repository-name-that-exceeds-limit.git';
    const slug = deriveRepoSlug(longUrl);
    expect(slug.length).toBeLessThanOrEqual(MAX_REPO_SLUG_LENGTH);
    expect(slug).toContain('_'); // Contains hash separator
  });

  it('passes through slugs of exactly 39 characters', () => {
    // Create a URL with exactly 39-char repo name
    const repoName = 'a'.repeat(39);
    const url = `https://github.com/user/${repoName}.git`;
    expect(deriveRepoSlug(url)).toBe(repoName);
  });

  it('throws for empty URL', () => {
    expect(() => deriveRepoSlug('')).toThrow('Cannot derive repo slug');
  });

  it('throws for URL that resolves to empty name', () => {
    expect(() => deriveRepoSlug('https://github.com/.git')).toThrow('Cannot derive repo slug');
  });

  it('is deterministic (same input → same output)', () => {
    const url = 'https://github.com/user/my-extremely-long-repository-name-that-exceeds-limit.git';
    const slug1 = deriveRepoSlug(url);
    const slug2 = deriveRepoSlug(url);
    expect(slug1).toBe(slug2);
  });
});

describe('compressSlug', () => {
  it('returns slug unchanged when within max length', () => {
    expect(compressSlug('short-slug')).toBe('short-slug');
  });

  it('returns slug unchanged when exactly at max length', () => {
    const slug = 'a'.repeat(MAX_REPO_SLUG_LENGTH);
    expect(compressSlug(slug)).toBe(slug);
  });

  it('compresses slug exceeding max length', () => {
    const slug = 'my-extremely-long-repository-name-that-exceeds-limit';
    const compressed = compressSlug(slug);
    expect(compressed.length).toBeLessThanOrEqual(MAX_REPO_SLUG_LENGTH);
  });

  it('uses underscore-delimited hash format', () => {
    const slug = 'my-extremely-long-repository-name-that-exceeds-limit';
    const compressed = compressSlug(slug);
    // Format: <prefix>_<6-char hash>_<suffix>
    const parts = compressed.split('_');
    expect(parts.length).toBe(3);
    expect(parts[1]).toHaveLength(6);
  });

  it('preserves prefix and suffix from original slug', () => {
    const slug = 'my-extremely-long-repository-name-that-exceeds-limit';
    const compressed = compressSlug(slug);
    expect(compressed.startsWith('my-extremely-lo')).toBe(true);
    expect(compressed.endsWith('ceeds-limit')).toBe(true);
  });

  it('is deterministic', () => {
    const slug = 'my-extremely-long-repository-name-that-exceeds-limit';
    expect(compressSlug(slug)).toBe(compressSlug(slug));
  });

  it('produces different outputs for different inputs', () => {
    const slug1 = 'a'.repeat(50);
    const slug2 = 'b'.repeat(50);
    expect(compressSlug(slug1)).not.toBe(compressSlug(slug2));
  });

  it('respects custom max length', () => {
    const slug = 'this-is-a-moderately-long-name';
    const compressed = compressSlug(slug, 20);
    expect(compressed.length).toBeLessThanOrEqual(20);
  });

  it('handles slug that is just one char over limit', () => {
    const slug = 'a'.repeat(MAX_REPO_SLUG_LENGTH + 1);
    const compressed = compressSlug(slug);
    expect(compressed.length).toBeLessThanOrEqual(MAX_REPO_SLUG_LENGTH);
  });
});

describe('deriveContainerName', () => {
  it('prefixes workspace name with ae-', () => {
    expect(deriveContainerName('bmad-orch-auth')).toBe('ae-bmad-orch-auth');
  });
});

describe('getWorkspacesBaseDir', () => {
  it('returns path under home directory', () => {
    const deps = { homedir: () => '/home/testuser' };
    const result = getWorkspacesBaseDir(deps);
    expect(result).toBe(join('/home/testuser', AGENT_ENV_DIR, WORKSPACES_DIR));
  });
});

describe('getWorkspacePath', () => {
  it('resolves all paths correctly', () => {
    const deps = { homedir: () => '/home/testuser' };
    const result = getWorkspacePath('bmad-orch', 'auth', deps);

    expect(result.name).toBe('bmad-orch-auth');
    expect(result.root).toBe(
      join('/home/testuser', AGENT_ENV_DIR, WORKSPACES_DIR, 'bmad-orch-auth')
    );
    expect(result.agentEnvDir).toBe(join(result.root, AGENT_ENV_DIR));
    expect(result.stateFile).toBe(join(result.root, AGENT_ENV_DIR, STATE_FILE));
  });
});

describe('getWorkspacePathByName', () => {
  it('resolves paths from workspace name', () => {
    const deps = { homedir: () => '/home/testuser' };
    const result = getWorkspacePathByName('bmad-orch-auth', deps);

    expect(result.name).toBe('bmad-orch-auth');
    expect(result.root).toContain('bmad-orch-auth');
    expect(result.stateFile).toContain(STATE_FILE);
  });
});

// ─── Filesystem operation tests ──────────────────────────────────────────────

describe('createWorkspace', () => {
  it('creates workspace folder at expected path', async () => {
    const deps = createTestDeps(tempDir);
    const wsPath = await createWorkspace('bmad-orch', 'auth', deps);

    expect(wsPath.name).toBe('bmad-orch-auth');

    // Verify directory was created
    const stats = await stat(wsPath.root);
    expect(stats.isDirectory()).toBe(true);

    // Verify .agent-env directory was created
    const agentEnvStats = await stat(wsPath.agentEnvDir);
    expect(agentEnvStats.isDirectory()).toBe(true);
  });

  it('creates workspace at ~/.agent-env/workspaces/<repo>-<instance>/', async () => {
    const deps = createTestDeps(tempDir);
    const wsPath = await createWorkspace('bmad-orch', 'auth', deps);

    const expectedPath = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'bmad-orch-auth');
    expect(wsPath.root).toBe(expectedPath);
  });

  it('throws if workspace already exists', async () => {
    const deps = createTestDeps(tempDir);

    // Create first time
    await createWorkspace('bmad-orch', 'auth', deps);

    // Second create should throw
    await expect(createWorkspace('bmad-orch', 'auth', deps)).rejects.toThrowError(/already exists/);

    // Also check for the specific error code
    const promise = createWorkspace('bmad-orch', 'auth', deps);
    await expect(promise).rejects.toHaveProperty('code', 'WORKSPACE_ALREADY_EXISTS');
  });

  it('creates intermediate directories if needed', async () => {
    const deps = createTestDeps(tempDir);
    // The .agent-env/workspaces path doesn't exist yet - should create recursively
    const wsPath = await createWorkspace('new-repo', 'test', deps);

    const stats = await stat(wsPath.agentEnvDir);
    expect(stats.isDirectory()).toBe(true);
  });
});

describe('workspaceExists', () => {
  it('returns true for existing workspace', async () => {
    const deps = createTestDeps(tempDir);
    await createWorkspace('bmad-orch', 'auth', deps);

    const exists = await workspaceExists('bmad-orch', 'auth', deps);
    expect(exists).toBe(true);
  });

  it('returns false for non-existing workspace', async () => {
    const deps = createTestDeps(tempDir);

    const exists = await workspaceExists('nonexistent', 'nope', deps);
    expect(exists).toBe(false);
  });

  it('returns false if path exists but is not a directory', async () => {
    const deps = createTestDeps(tempDir);

    // Create file at workspace path
    const wsPath = getWorkspacePath('test', 'file', deps);
    await mkdir(join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR), {
      recursive: true,
    });
    await writeFile(wsPath.root, 'not a directory');

    const exists = await workspaceExists('test', 'file', deps);
    expect(exists).toBe(false);
  });

  it('re-throws unexpected errors', async () => {
    const mockError = new Error('Permission denied') as NodeJS.ErrnoException;
    mockError.code = 'EACCES';
    const mockStat = vi.fn().mockRejectedValue(mockError);
    const deps = {
      homedir: () => tempDir,
      stat: mockStat,
    };

    await expect(workspaceExists('any', 'repo', deps)).rejects.toThrow('Permission denied');
  });
});

describe('scanWorkspaces', () => {
  it('returns empty array when no workspaces exist', async () => {
    const deps = createTestDeps(tempDir);
    const workspaces = await scanWorkspaces(deps);
    expect(workspaces).toEqual([]);
  });

  it('returns empty array when workspaces dir does not exist', async () => {
    // Use a dir that definitely doesn't have .agent-env
    const deps = createTestDeps(join(tempDir, 'nonexistent'));
    const workspaces = await scanWorkspaces(deps);
    expect(workspaces).toEqual([]);
  });

  it('discovers all workspace directories', async () => {
    const deps = createTestDeps(tempDir);

    // Create multiple workspaces
    await createWorkspace('repo-a', 'feature', deps);
    await createWorkspace('repo-b', 'bugfix', deps);
    await createWorkspace('repo-c', 'main', deps);

    const workspaces = await scanWorkspaces(deps);
    expect(workspaces).toHaveLength(3);
    expect(workspaces).toContain('repo-a-feature');
    expect(workspaces).toContain('repo-b-bugfix');
    expect(workspaces).toContain('repo-c-main');
  });

  it('only returns directories, not files', async () => {
    const deps = createTestDeps(tempDir);

    // Create a workspace
    await createWorkspace('real', 'workspace', deps);

    // Create a file in the workspaces directory
    const baseDir = getWorkspacesBaseDir(deps);
    await writeFile(join(baseDir, 'not-a-workspace.txt'), 'file content');

    const workspaces = await scanWorkspaces(deps);
    expect(workspaces).toEqual(['real-workspace']);
  });
});

// ─── deleteWorkspace tests ──────────────────────────────────────────────────

describe('deleteWorkspace', () => {
  it('deletes an existing workspace recursively', async () => {
    const deps = createTestDeps(tempDir);
    const wsPath = await createWorkspace('repo', 'auth', deps);

    // Write a file inside to ensure recursive delete
    await writeFile(join(wsPath.root, 'some-file.txt'), 'content');

    await deleteWorkspace(wsPath, { rm });

    // Verify directory no longer exists
    const exists = await workspaceExists('repo', 'auth', deps);
    expect(exists).toBe(false);
  });

  it('succeeds when workspace does not exist (force: true is idempotent)', async () => {
    const deps = createTestDeps(tempDir);
    const wsPath = getWorkspacePath('nonexistent', 'ws', deps);

    // Should not throw — rm with force: true is idempotent
    await deleteWorkspace(wsPath, { rm });
  });

  it('re-throws unexpected errors', async () => {
    const deps = createTestDeps(tempDir);
    const wsPath = getWorkspacePath('any', 'ws', deps);

    const mockError = new Error('Permission denied') as NodeJS.ErrnoException;
    mockError.code = 'EACCES';
    const mockRm = vi.fn().mockRejectedValue(mockError);

    await expect(deleteWorkspace(wsPath, { rm: mockRm })).rejects.toThrow('Permission denied');
  });
});
