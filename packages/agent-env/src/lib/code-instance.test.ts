import type { ExecuteResult } from '@zookanalytics/shared';

import {
  appendFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { CodeInstanceDeps } from './code-instance.js';
import type { ContainerLifecycle } from './container.js';
import type { InstanceState } from './types.js';

import { codeInstance, ensureConfigSymlink, removeConfigSymlink } from './code-instance.js';
import { AGENT_ENV_DIR, STATE_FILE, WORKSPACES_DIR } from './types.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-code-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function createTestWorkspace(workspaceName: string, state: InstanceState): Promise<void> {
  const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, workspaceName);
  const agentEnvDir = join(wsRoot, AGENT_ENV_DIR);
  const stateFile = join(agentEnvDir, STATE_FILE);

  await mkdir(agentEnvDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');
}

function createTestState(
  workspaceName: string,
  overrides: Partial<InstanceState> = {}
): InstanceState {
  const lastDashIdx = workspaceName.lastIndexOf('-');
  const instance = lastDashIdx > 0 ? workspaceName.slice(lastDashIdx + 1) : workspaceName;
  const repoSlug = lastDashIdx > 0 ? workspaceName.slice(0, lastDashIdx) : 'repo';
  return {
    instance,
    repoSlug,
    repoUrl: `https://github.com/user/${repoSlug}.git`,
    createdAt: '2026-01-15T10:00:00.000Z',
    lastAttached: '2026-01-20T14:00:00.000Z',
    purpose: null,
    containerName: `ae-${workspaceName}`,
    repoConfigDetected: false,
    ...overrides,
  };
}

function createMockContainer(overrides: Partial<ContainerLifecycle> = {}): ContainerLifecycle {
  return {
    isDockerAvailable: vi.fn().mockResolvedValue(true),
    containerStatus: vi.fn().mockResolvedValue({
      ok: true,
      status: 'running',
      containerId: 'abc123',
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

const codeFsDeps = { lstat, symlink, readlink, unlink };

function createTestDeps(overrides: Partial<CodeInstanceDeps> = {}): CodeInstanceDeps {
  const executor = vi.fn().mockResolvedValue({
    ok: true,
    stdout: '',
    stderr: '',
    exitCode: 0,
  } satisfies ExecuteResult);

  return {
    executor,
    container: createMockContainer(),
    workspaceFsDeps: { mkdir, readdir, stat, homedir: () => tempDir },
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    codeFsDeps,
    ...overrides,
  };
}

// ─── codeInstance tests ──────────────────────────────────────────────────────

describe('codeInstance', () => {
  it('opens VS Code for a running instance successfully', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const result = await codeInstance('auth', deps);
    expect(result.ok).toBe(true);
  });

  it('calls devcontainer open with workspace path and config', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await codeInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const configPath = join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json');
    expect(deps.executor).toHaveBeenCalledWith(
      'devcontainer',
      ['open', wsRoot, '--config', configPath],
      { stdio: 'inherit', timeout: 30_000 }
    );
  });

  it('removes ephemeral symlink after devcontainer open', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await codeInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    await expect(lstat(join(wsRoot, '.devcontainer.json'))).rejects.toThrow();
  });

  it('removes symlink even when devcontainer open fails', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state);
    const executor = vi.fn().mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'failed',
      exitCode: 1,
    } satisfies ExecuteResult);
    const deps = createTestDeps({ executor });

    await codeInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    await expect(lstat(join(wsRoot, '.devcontainer.json'))).rejects.toThrow();
  });

  it('skips symlink when repoConfigDetected is true', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await codeInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    await expect(lstat(join(wsRoot, '.devcontainer.json'))).rejects.toThrow();
  });

  it('starts stopped container before opening', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      containerStatus: vi
        .fn()
        .mockResolvedValue({ ok: true, status: 'stopped', containerId: 'abc123' }),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await codeInstance('auth', deps);
    expect(result.ok).toBe(true);
    expect(mockContainer.devcontainerUp).toHaveBeenCalled();
  });

  it('returns WORKSPACE_NOT_FOUND when instance does not exist', async () => {
    const deps = createTestDeps();
    const result = await codeInstance('nonexistent', deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('returns ORBSTACK_REQUIRED when Docker is not available', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      isDockerAvailable: vi.fn().mockResolvedValue(false),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await codeInstance('auth', deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ORBSTACK_REQUIRED');
  });

  it('returns VSCODE_OPEN_FAILED when devcontainer open fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const executor = vi.fn().mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'error',
      exitCode: 1,
    } satisfies ExecuteResult);
    const deps = createTestDeps({ executor });

    const result = await codeInstance('auth', deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('VSCODE_OPEN_FAILED');
  });

  it('returns SYMLINK_FAILED when symlink creation throws', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      codeFsDeps: {
        lstat: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
        symlink: vi.fn().mockRejectedValue(new Error('EPERM')),
        readlink,
        unlink,
      },
    });

    const result = await codeInstance('auth', deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SYMLINK_FAILED');
  });

  it('updates lastAttached timestamp after successful open', async () => {
    const state = createTestState('repo-auth', { lastAttached: '2026-01-20T14:00:00.000Z' });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await codeInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const content = await readFile(join(wsRoot, AGENT_ENV_DIR, STATE_FILE), 'utf-8');
    const updated = JSON.parse(content) as InstanceState;
    expect(updated.lastAttached).not.toBe('2026-01-20T14:00:00.000Z');
  });
});

// ─── ensureConfigSymlink tests ───────────────────────────────────────────────

describe('ensureConfigSymlink', () => {
  it('creates .devcontainer.json symlink at workspace root', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    await mkdir(join(wsRoot, AGENT_ENV_DIR), { recursive: true });
    await writeFile(join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'), '{}');

    await ensureConfigSymlink(wsRoot, codeFsDeps);

    const symlinkPath = join(wsRoot, '.devcontainer.json');
    expect((await lstat(symlinkPath)).isSymbolicLink()).toBe(true);
    expect(await readlink(symlinkPath)).toBe(join(AGENT_ENV_DIR, 'devcontainer.json'));
  });

  it('is idempotent', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    await mkdir(join(wsRoot, AGENT_ENV_DIR), { recursive: true });
    await writeFile(join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'), '{}');

    await ensureConfigSymlink(wsRoot, codeFsDeps);
    await ensureConfigSymlink(wsRoot, codeFsDeps);

    expect((await lstat(join(wsRoot, '.devcontainer.json'))).isSymbolicLink()).toBe(true);
  });

  it('does not overwrite a real file', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    await mkdir(wsRoot, { recursive: true });
    await writeFile(join(wsRoot, '.devcontainer.json'), '{"image":"node"}');

    await ensureConfigSymlink(wsRoot, codeFsDeps);

    expect((await lstat(join(wsRoot, '.devcontainer.json'))).isSymbolicLink()).toBe(false);
    expect(await readFile(join(wsRoot, '.devcontainer.json'), 'utf-8')).toBe('{"image":"node"}');
  });
});

// ─── removeConfigSymlink tests ───────────────────────────────────────────────

describe('removeConfigSymlink', () => {
  it('removes symlink', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    await mkdir(join(wsRoot, AGENT_ENV_DIR), { recursive: true });
    await writeFile(join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'), '{}');

    await ensureConfigSymlink(wsRoot, codeFsDeps);
    await removeConfigSymlink(wsRoot, codeFsDeps);

    await expect(lstat(join(wsRoot, '.devcontainer.json'))).rejects.toThrow();
  });

  it('does not remove regular files', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    await mkdir(wsRoot, { recursive: true });
    await writeFile(join(wsRoot, '.devcontainer.json'), '{"name":"real"}');

    await removeConfigSymlink(wsRoot, codeFsDeps);

    expect(await readFile(join(wsRoot, '.devcontainer.json'), 'utf-8')).toBe('{"name":"real"}');
  });

  it('is silent when nothing exists', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    await mkdir(wsRoot, { recursive: true });
    await removeConfigSymlink(wsRoot, codeFsDeps);
  });
});
