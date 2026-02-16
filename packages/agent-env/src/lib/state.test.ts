import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { StateFsDeps } from './state.js';
import type { InstanceState, WorkspacePath } from './types.js';

import { createInitialState, ensureGitExclude, readState, writeStateAtomic } from './state.js';
import { AGENT_ENV_DIR, STATE_FILE, createFallbackState } from './types.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

function createWorkspacePath(base: string, name: string): WorkspacePath {
  const root = join(base, name);
  const agentEnvDir = join(root, AGENT_ENV_DIR);
  const stateFile = join(agentEnvDir, STATE_FILE);
  return { root, name, agentEnvDir, stateFile };
}

const validState: InstanceState = {
  instance: 'auth',
  repoSlug: 'bmad-orch',
  repoUrl: 'https://github.com/user/bmad-orch.git',
  createdAt: '2026-01-28T10:00:00.000Z',
  lastAttached: '2026-01-28T12:00:00.000Z',
  purpose: 'Authentication feature',
  containerName: 'ae-bmad-orch-auth',
};

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-state-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ─── readState tests ─────────────────────────────────────────────────────────

describe('readState', () => {
  it('reads valid state.json correctly', async () => {
    const wsPath = createWorkspacePath(tempDir, 'test-workspace');
    await mkdir(wsPath.agentEnvDir, { recursive: true });
    await writeFile(wsPath.stateFile, JSON.stringify(validState, null, 2));

    const state = await readState(wsPath);

    expect(state.instance).toBe('auth');
    expect(state.repoSlug).toBe('bmad-orch');
    expect(state.repoUrl).toBe('https://github.com/user/bmad-orch.git');
    expect(state.createdAt).toBe('2026-01-28T10:00:00.000Z');
    expect(state.lastAttached).toBe('2026-01-28T12:00:00.000Z');
    expect(state.purpose).toBe('Authentication feature');
    expect(state.containerName).toBe('ae-bmad-orch-auth');
  });

  it('reads state with null purpose', async () => {
    const wsPath = createWorkspacePath(tempDir, 'null-purpose');
    await mkdir(wsPath.agentEnvDir, { recursive: true });
    const stateWithNullPurpose = { ...validState, purpose: null };
    await writeFile(wsPath.stateFile, JSON.stringify(stateWithNullPurpose));

    const state = await readState(wsPath);
    expect(state.purpose).toBeNull();
  });

  it('returns fallback state when file is missing', async () => {
    const wsPath = createWorkspacePath(tempDir, 'missing-state');
    // Don't create any files

    const state = await readState(wsPath);

    expect(state.instance).toBe('missing-state');
    expect(state.repoSlug).toBe('unknown');
    expect(state.repoUrl).toBe('unknown');
    expect(state.createdAt).toBe('unknown');
    expect(state.lastAttached).toBe('unknown');
    expect(state.purpose).toBeNull();
    expect(state.containerName).toBe('ae-missing-state');
  });

  it('returns fallback state for corrupted JSON', async () => {
    const wsPath = createWorkspacePath(tempDir, 'corrupted');
    await mkdir(wsPath.agentEnvDir, { recursive: true });
    await writeFile(wsPath.stateFile, '{not valid json');

    const state = await readState(wsPath);

    expect(state.instance).toBe('corrupted');
    expect(state.repoUrl).toBe('unknown');
  });

  it('returns fallback state for invalid schema (missing fields)', async () => {
    const wsPath = createWorkspacePath(tempDir, 'invalid-schema');
    await mkdir(wsPath.agentEnvDir, { recursive: true });
    await writeFile(wsPath.stateFile, JSON.stringify({ instance: 'test', missing_fields: true }));

    const state = await readState(wsPath);

    expect(state.instance).toBe('invalid-schema');
    expect(state.repoUrl).toBe('unknown');
  });

  it('returns fallback state for non-object JSON', async () => {
    const wsPath = createWorkspacePath(tempDir, 'not-object');
    await mkdir(wsPath.agentEnvDir, { recursive: true });
    await writeFile(wsPath.stateFile, '"just a string"');

    const state = await readState(wsPath);
    expect(state.instance).toBe('not-object');
    expect(state.repoUrl).toBe('unknown');
  });

  it('returns fallback state for null JSON', async () => {
    const wsPath = createWorkspacePath(tempDir, 'null-json');
    await mkdir(wsPath.agentEnvDir, { recursive: true });
    await writeFile(wsPath.stateFile, 'null');

    const state = await readState(wsPath);
    expect(state.instance).toBe('null-json');
    expect(state.repoUrl).toBe('unknown');
  });

  it('does not throw on any error condition', async () => {
    const wsPath = createWorkspacePath(tempDir, 'no-throw');
    // No directory, no file - should still not throw
    const state = await readState(wsPath);
    expect(state).toBeDefined();
    expect(state.instance).toBe('no-throw');
  });

  it('uses injected deps for reading', async () => {
    const mockReadFile = vi.fn().mockResolvedValue(JSON.stringify(validState));
    const deps = { readFile: mockReadFile } as unknown as Pick<StateFsDeps, 'readFile'>;

    const wsPath = createWorkspacePath(tempDir, 'injected');
    const state = await readState(wsPath, deps);

    expect(mockReadFile).toHaveBeenCalledWith(wsPath.stateFile, 'utf-8');
    expect(state.instance).toBe('auth');
  });

  it('re-throws errors that are not ENOENT or SyntaxError', async () => {
    const mockError = new Error('Permission denied') as NodeJS.ErrnoException;
    mockError.code = 'EACCES';
    const mockReadFile = vi.fn().mockRejectedValue(mockError);
    const deps = { readFile: mockReadFile };

    const wsPath = createWorkspacePath(tempDir, 'permission-denied');

    await expect(readState(wsPath, deps)).rejects.toThrow('Permission denied');
  });
});

// ─── writeStateAtomic tests ─────────────────────────────────────────────────

describe('writeStateAtomic', () => {
  it('writes state to state.json', async () => {
    const wsPath = createWorkspacePath(tempDir, 'write-test');
    await mkdir(wsPath.agentEnvDir, { recursive: true });

    await writeStateAtomic(wsPath, validState);

    // Read back and verify
    const content = await readFile(wsPath.stateFile, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.instance).toBe('auth');
    expect(parsed.repoSlug).toBe('bmad-orch');
    expect(parsed.repoUrl).toBe('https://github.com/user/bmad-orch.git');
    expect(parsed.purpose).toBe('Authentication feature');
  });

  it('uses tmp+rename pattern for atomicity', async () => {
    const wsPath = createWorkspacePath(tempDir, 'atomic-test');

    const writeFileCalls: string[] = [];
    const renameCalls: Array<{ from: string; to: string }> = [];

    const mockDeps: StateFsDeps = {
      readFile,
      mkdir,
      appendFile,
      writeFile: async (path, content, _encoding) => {
        writeFileCalls.push(String(path));
        await writeFile(path as string, content as string, 'utf-8');
      },
      rename: async (from, to) => {
        renameCalls.push({ from: String(from), to: String(to) });
        await rename(from, to);
      },
    };

    await writeStateAtomic(wsPath, validState, mockDeps);

    // Verify tmp file was written first
    expect(writeFileCalls).toHaveLength(1);
    expect(writeFileCalls[0]).toContain('state.json.tmp');

    // Verify rename was called from tmp to final
    expect(renameCalls).toHaveLength(1);
    expect(renameCalls[0].from).toContain('state.json.tmp');
    expect(renameCalls[0].to).toContain('state.json');
    expect(renameCalls[0].to).not.toContain('.tmp');
  });

  it('creates .agent-env directory if it does not exist', async () => {
    const wsPath = createWorkspacePath(tempDir, 'no-dir-test');
    // Don't create the directory - writeStateAtomic should handle it

    await writeStateAtomic(wsPath, validState);

    // Verify file was written successfully
    const content = await readFile(wsPath.stateFile, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.instance).toBe('auth');
  });

  it('writes formatted JSON with trailing newline', async () => {
    const wsPath = createWorkspacePath(tempDir, 'format-test');
    await mkdir(wsPath.agentEnvDir, { recursive: true });

    await writeStateAtomic(wsPath, validState);

    const content = await readFile(wsPath.stateFile, 'utf-8');
    // Should be indented JSON
    expect(content).toContain('  "instance"');
    // Should end with newline
    expect(content.endsWith('\n')).toBe(true);
  });

  it('roundtrips correctly with readState', async () => {
    const wsPath = createWorkspacePath(tempDir, 'roundtrip');
    await mkdir(wsPath.agentEnvDir, { recursive: true });

    await writeStateAtomic(wsPath, validState);
    const readBack = await readState(wsPath);

    expect(readBack).toEqual(validState);
  });

  it('overwrites existing state file', async () => {
    const wsPath = createWorkspacePath(tempDir, 'overwrite');
    await mkdir(wsPath.agentEnvDir, { recursive: true });

    // Write initial state
    await writeStateAtomic(wsPath, validState);

    // Write updated state
    const updatedState = { ...validState, purpose: 'Updated purpose' };
    await writeStateAtomic(wsPath, updatedState);

    const readBack = await readState(wsPath);
    expect(readBack.purpose).toBe('Updated purpose');
  });

  it('leaves original state untouched if rename fails', async () => {
    const wsPath = createWorkspacePath(tempDir, 'atomic-fail');
    await mkdir(wsPath.agentEnvDir, { recursive: true });

    // 1. Write initial, valid state
    await writeFile(wsPath.stateFile, JSON.stringify(validState));

    // 2. Attempt to write new state, but make rename fail
    const error = new Error('Disk full');
    const mockDeps: StateFsDeps = {
      readFile,
      mkdir,
      appendFile,
      writeFile, // Use real writeFile
      rename: vi.fn().mockRejectedValue(error),
    };

    const newState = { ...validState, purpose: 'This should not be saved' };
    await expect(writeStateAtomic(wsPath, newState, mockDeps)).rejects.toThrow('Disk full');

    // 3. Verify original file is unchanged
    const finalContent = await readFile(wsPath.stateFile, 'utf-8');
    const finalState = JSON.parse(finalContent);
    expect(finalState.purpose).toBe('Authentication feature'); // Original purpose

    // 4. Verify tmp file was left behind
    const tmpPath = join(wsPath.agentEnvDir, 'state.json.tmp');
    await expect(stat(tmpPath)).resolves.toBeDefined();
  });
});

// ─── createInitialState tests ────────────────────────────────────────────────

describe('createInitialState', () => {
  it('creates state with provided instance, repoSlug, and repoUrl', () => {
    const state = createInitialState('auth', 'bmad-orch', 'https://github.com/user/repo.git');

    expect(state.instance).toBe('auth');
    expect(state.repoSlug).toBe('bmad-orch');
    expect(state.repoUrl).toBe('https://github.com/user/repo.git');
  });

  it('sets createdAt and lastAttached to current time', () => {
    const before = new Date().toISOString();
    const state = createInitialState('test', 'repo', 'repo-url');
    const after = new Date().toISOString();

    expect(state.createdAt >= before).toBe(true);
    expect(state.createdAt <= after).toBe(true);
    expect(state.lastAttached).toBe(state.createdAt);
  });

  it('sets purpose to null', () => {
    const state = createInitialState('test', 'repo', 'repo-url');
    expect(state.purpose).toBeNull();
  });

  it('derives container name from repoSlug and instance', () => {
    const state = createInitialState('auth', 'bmad-orch', 'repo-url');
    expect(state.containerName).toBe('ae-bmad-orch-auth');
  });

  it('accepts custom container name', () => {
    const state = createInitialState('test', 'repo', 'repo-url', {
      containerName: 'custom-container',
    });
    expect(state.containerName).toBe('custom-container');
  });

  it('sets configSource when provided', () => {
    const state = createInitialState('test', 'repo', 'repo-url', { configSource: 'repo' });
    expect(state.configSource).toBe('repo');
  });

  it('defaults configSource to baseline when not provided', () => {
    const state = createInitialState('test', 'repo', 'repo-url');
    expect(state.configSource).toBe('baseline');
  });

  it('sets both containerName and configSource via options', () => {
    const state = createInitialState('test', 'repo', 'repo-url', {
      containerName: 'custom',
      configSource: 'repo',
    });
    expect(state.containerName).toBe('custom');
    expect(state.configSource).toBe('repo');
  });

  it('sets purpose when provided as string', () => {
    const state = createInitialState('test', 'repo', 'repo-url', {
      purpose: 'JWT authentication',
    });
    expect(state.purpose).toBe('JWT authentication');
  });

  it('sets purpose to null when provided as null', () => {
    const state = createInitialState('test', 'repo', 'repo-url', { purpose: null });
    expect(state.purpose).toBeNull();
  });

  it('defaults purpose to null when not provided', () => {
    const state = createInitialState('test', 'repo', 'repo-url', { containerName: 'custom' });
    expect(state.purpose).toBeNull();
  });

  it('sets purpose alongside containerName and configSource', () => {
    const state = createInitialState('test', 'repo', 'repo-url', {
      containerName: 'custom',
      configSource: 'repo',
      purpose: 'OAuth integration',
    });
    expect(state.containerName).toBe('custom');
    expect(state.configSource).toBe('repo');
    expect(state.purpose).toBe('OAuth integration');
  });
});

// ─── isValidState: rejects old-format state ─────────────────────────────────

describe('isValidState rejects old-format state', () => {
  it('returns fallback for old-format state with name/repo instead of instance/repoSlug/repoUrl', async () => {
    const wsPath = createWorkspacePath(tempDir, 'old-format');
    await mkdir(wsPath.agentEnvDir, { recursive: true });
    // Write old-format state — should NOT pass isValidState
    const oldFormatState = {
      name: 'test',
      repo: 'https://github.com/user/repo.git',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastAttached: '2026-01-01T00:00:00.000Z',
      purpose: null,
      containerName: 'ae-test',
    };
    await writeFile(wsPath.stateFile, JSON.stringify(oldFormatState, null, 2));

    const state = await readState(wsPath);

    // Should return fallback, not the old state
    expect(state.instance).toBe('old-format');
    expect(state.repoUrl).toBe('unknown');
  });

  it('accepts new-format state without configSource field', async () => {
    const wsPath = createWorkspacePath(tempDir, 'no-config-source');
    await mkdir(wsPath.agentEnvDir, { recursive: true });
    // Write new-format state WITHOUT configSource
    const newState = {
      instance: 'auth',
      repoSlug: 'bmad-orch',
      repoUrl: 'https://github.com/user/repo.git',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastAttached: '2026-01-01T00:00:00.000Z',
      purpose: null,
      containerName: 'ae-bmad-orch-auth',
    };
    await writeFile(wsPath.stateFile, JSON.stringify(newState, null, 2));

    const state = await readState(wsPath);

    expect(state.instance).toBe('auth');
    expect(state.repoSlug).toBe('bmad-orch');
    expect(state.containerName).toBe('ae-bmad-orch-auth');
    // configSource should be undefined (not present)
    expect(state.configSource).toBeUndefined();
  });
});

// ─── createFallbackState tests ───────────────────────────────────────────────

describe('createFallbackState', () => {
  it('creates state with "unknown" values', () => {
    const fallback = createFallbackState('test-workspace');

    expect(fallback.instance).toBe('test-workspace');
    expect(fallback.repoSlug).toBe('unknown');
    expect(fallback.repoUrl).toBe('unknown');
    expect(fallback.createdAt).toBe('unknown');
    expect(fallback.lastAttached).toBe('unknown');
    expect(fallback.purpose).toBeNull();
    expect(fallback.containerName).toBe('ae-test-workspace');
  });
});

// ─── ensureGitExclude tests ──────────────────────────────────────────────────

describe('ensureGitExclude', () => {
  it('adds .agent-env/ to .git/info/exclude when not present', async () => {
    // Create a mock git repo structure
    const gitInfoDir = join(tempDir, '.git', 'info');
    await mkdir(gitInfoDir, { recursive: true });
    const excludePath = join(gitInfoDir, 'exclude');
    await writeFile(excludePath, '# existing excludes\n*.log\n');

    await ensureGitExclude(tempDir);

    const content = await readFile(excludePath, 'utf-8');
    expect(content).toContain('.agent-env/');
  });

  it('does not duplicate if .agent-env/ already present', async () => {
    const gitInfoDir = join(tempDir, '.git', 'info');
    await mkdir(gitInfoDir, { recursive: true });
    const excludePath = join(gitInfoDir, 'exclude');
    await writeFile(excludePath, '# excludes\n.agent-env/\n');

    await ensureGitExclude(tempDir);

    const content = await readFile(excludePath, 'utf-8');
    // Count occurrences - should be exactly 1
    const matches = content.match(/\.agent-env\//g);
    expect(matches).toHaveLength(1);
  });

  it('handles file without trailing newline', async () => {
    const gitInfoDir = join(tempDir, '.git', 'info');
    await mkdir(gitInfoDir, { recursive: true });
    const excludePath = join(gitInfoDir, 'exclude');
    await writeFile(excludePath, '# no trailing newline'); // No newline at end

    await ensureGitExclude(tempDir);

    const content = await readFile(excludePath, 'utf-8');
    // Should have newline before .agent-env/
    expect(content).toBe('# no trailing newline\n.agent-env/\n');
  });

  it('silently skips if .git/info/exclude does not exist', async () => {
    // tempDir has no .git directory
    await expect(ensureGitExclude(tempDir)).resolves.not.toThrow();
  });

  it('re-throws non-ENOENT errors', async () => {
    const mockError = new Error('Permission denied') as NodeJS.ErrnoException;
    mockError.code = 'EACCES';
    const mockDeps = {
      readFile: vi.fn().mockRejectedValue(mockError),
      appendFile: vi.fn(),
    };

    await expect(ensureGitExclude(tempDir, mockDeps)).rejects.toThrow('Permission denied');
  });

  it('uses injected deps', async () => {
    const mockReadFile = vi.fn().mockResolvedValue('# existing\n');
    const mockAppendFile = vi.fn().mockResolvedValue(undefined);
    const deps = { readFile: mockReadFile, appendFile: mockAppendFile };

    await ensureGitExclude('/test/workspace', deps);

    expect(mockReadFile).toHaveBeenCalledWith('/test/workspace/.git/info/exclude', 'utf-8');
    expect(mockAppendFile).toHaveBeenCalledWith(
      '/test/workspace/.git/info/exclude',
      '.agent-env/\n',
      'utf-8'
    );
  });
});
