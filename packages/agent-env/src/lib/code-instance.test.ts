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

import { codeInstance, ensureDevcontainerSymlink } from './code-instance.js';
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

/** Create a workspace directory with state.json */
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
    workspaceFsDeps: {
      mkdir,
      readdir,
      stat,
      homedir: () => tempDir,
    },
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    codeFsDeps: { mkdir, lstat, symlink, readlink, unlink },
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

  it('starts stopped container before opening VS Code', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'stopped',
        containerId: 'abc123',
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await codeInstance('auth', deps);

    expect(result.ok).toBe(true);
    expect(mockContainer.devcontainerUp).toHaveBeenCalled();
  });

  it('passes configPath to devcontainerUp when starting stopped container', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'stopped',
        containerId: 'abc123',
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    await codeInstance('auth', deps);

    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        configPath: expect.stringContaining(join(AGENT_ENV_DIR, 'devcontainer.json')),
      })
    );
  });

  it('calls onContainerStarting callback when starting stopped container', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'stopped',
        containerId: 'abc123',
      }),
    });
    const deps = createTestDeps({ container: mockContainer });
    const onStarting = vi.fn();

    await codeInstance('auth', deps, onStarting);

    expect(onStarting).toHaveBeenCalledOnce();
  });

  it('does not call onContainerStarting for already running container', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();
    const onStarting = vi.fn();

    await codeInstance('auth', deps, onStarting);

    expect(onStarting).not.toHaveBeenCalled();
  });

  it('calls onOpening callback before launching VS Code', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();
    const onOpening = vi.fn();

    await codeInstance('auth', deps, undefined, onOpening);

    expect(onOpening).toHaveBeenCalledOnce();
  });

  it('does not call onOpening when Docker is unavailable', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      isDockerAvailable: vi.fn().mockResolvedValue(false),
    });
    const deps = createTestDeps({ container: mockContainer });
    const onOpening = vi.fn();

    await codeInstance('auth', deps, undefined, onOpening);

    expect(onOpening).not.toHaveBeenCalled();
  });

  it('does not call onOpening when container start fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'stopped',
        containerId: 'abc123',
      }),
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: false,
        status: 'not-found',
        containerId: null,
        error: { code: 'CONTAINER_ERROR', message: 'Build failed' },
      }),
    });
    const deps = createTestDeps({ container: mockContainer });
    const onOpening = vi.fn();

    await codeInstance('auth', deps, undefined, onOpening);

    expect(onOpening).not.toHaveBeenCalled();
  });

  it('returns WORKSPACE_NOT_FOUND when instance does not exist', async () => {
    const deps = createTestDeps();

    const result = await codeInstance('nonexistent', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect(result.error.message).toContain("Instance 'nonexistent' not found");
  });

  it('returns AMBIGUOUS_INSTANCE when multiple repos have same instance name', async () => {
    await createTestWorkspace('repo1-auth', createTestState('repo1-auth'));
    await createTestWorkspace('repo2-auth', createTestState('repo2-auth'));
    const deps = createTestDeps();

    const result = await codeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('AMBIGUOUS_INSTANCE');
    expect(result.error.suggestion).toContain('--repo');
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
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('ORBSTACK_REQUIRED');
  });

  it('returns error when container status check fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: false,
        status: 'not-found',
        containerId: null,
        error: { code: 'CONTAINER_ERROR', message: 'Docker connection refused' },
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await codeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
  });

  it('returns error when container start fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'stopped',
        containerId: 'abc123',
      }),
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: false,
        status: 'not-found',
        containerId: null,
        error: { code: 'CONTAINER_ERROR', message: 'Build failed' },
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await codeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
  });

  it('returns VSCODE_OPEN_FAILED with instance name when devcontainer open fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const executor = vi.fn().mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'code not found',
      exitCode: 1,
    } satisfies ExecuteResult);
    const deps = createTestDeps({ executor });

    const result = await codeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('VSCODE_OPEN_FAILED');
    expect(result.error.message).toContain("instance 'auth'");
    expect(result.error.suggestion).toContain('VS Code');
  });

  it('starts container when status is not-found (orphaned workspace)', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'not-found',
        containerId: null,
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await codeInstance('auth', deps);

    expect(result.ok).toBe(true);
    expect(mockContainer.devcontainerUp).toHaveBeenCalled();
  });

  it('updates lastAttached timestamp after successful open', async () => {
    const originalTimestamp = '2026-01-20T14:00:00.000Z';
    const state = createTestState('repo-auth', { lastAttached: originalTimestamp });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await codeInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const stateFile = join(wsRoot, AGENT_ENV_DIR, STATE_FILE);
    const content = await readFile(stateFile, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;

    expect(updatedState.lastAttached).not.toBe(originalTimestamp);
    const lastAttached = new Date(updatedState.lastAttached);
    expect(lastAttached.getTime()).toBeGreaterThan(Date.now() - 10_000);
  });

  it('preserves other state fields when updating lastAttached', async () => {
    const state = createTestState('repo-auth', {
      purpose: 'OAuth feature work',
      repoUrl: 'https://github.com/user/special.git',
    });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await codeInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const stateFile = join(wsRoot, AGENT_ENV_DIR, STATE_FILE);
    const content = await readFile(stateFile, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;

    expect(updatedState.purpose).toBe('OAuth feature work');
    expect(updatedState.repoUrl).toBe('https://github.com/user/special.git');
    expect(updatedState.instance).toBe('auth');
  });

  it('creates .devcontainer symlink when repoConfigDetected is false', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await codeInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const symlinkPath = join(wsRoot, '.devcontainer', 'devcontainer.json');
    const linkStat = await lstat(symlinkPath);
    expect(linkStat.isSymbolicLink()).toBe(true);
    const target = await readlink(symlinkPath);
    expect(target).toBe(join('..', AGENT_ENV_DIR, 'devcontainer.json'));
  });

  it('skips .devcontainer symlink when repoConfigDetected is true', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await codeInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const symlinkPath = join(wsRoot, '.devcontainer', 'devcontainer.json');
    await expect(lstat(symlinkPath)).rejects.toThrow();
  });

  it('returns SYMLINK_FAILED with underlying error when symlink creation throws', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      codeFsDeps: {
        mkdir: vi.fn().mockRejectedValue(new Error('EPERM: operation not permitted')),
        lstat,
        symlink,
        readlink,
        unlink,
      },
    });

    const result = await codeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('SYMLINK_FAILED');
    expect(result.error.message).toContain('EPERM');
  });
});

// ─── ensureDevcontainerSymlink tests ─────────────────────────────────────────

describe('ensureDevcontainerSymlink', () => {
  const codeFsDeps = { mkdir, lstat, symlink, readlink, unlink };

  it('creates symlink when .devcontainer does not exist', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    await mkdir(join(wsRoot, AGENT_ENV_DIR), { recursive: true });
    await writeFile(join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'), '{}', 'utf-8');

    await ensureDevcontainerSymlink(wsRoot, codeFsDeps);

    const symlinkPath = join(wsRoot, '.devcontainer', 'devcontainer.json');
    const linkStat = await lstat(symlinkPath);
    expect(linkStat.isSymbolicLink()).toBe(true);
    const target = await readlink(symlinkPath);
    expect(target).toBe(join('..', AGENT_ENV_DIR, 'devcontainer.json'));
  });

  it('is idempotent — does nothing if symlink already correct', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    await mkdir(join(wsRoot, AGENT_ENV_DIR), { recursive: true });
    await writeFile(join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'), '{}', 'utf-8');

    await ensureDevcontainerSymlink(wsRoot, codeFsDeps);
    await ensureDevcontainerSymlink(wsRoot, codeFsDeps); // second call should not throw

    const symlinkPath = join(wsRoot, '.devcontainer', 'devcontainer.json');
    const linkStat = await lstat(symlinkPath);
    expect(linkStat.isSymbolicLink()).toBe(true);
  });

  it('does not overwrite a real file (user-owned .devcontainer config)', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    const devcontainerDir = join(wsRoot, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(join(devcontainerDir, 'devcontainer.json'), '{"image":"node"}', 'utf-8');

    await ensureDevcontainerSymlink(wsRoot, codeFsDeps);

    // Should still be a regular file, not a symlink
    const fileStat = await lstat(join(devcontainerDir, 'devcontainer.json'));
    expect(fileStat.isSymbolicLink()).toBe(false);
    const content = await readFile(join(devcontainerDir, 'devcontainer.json'), 'utf-8');
    expect(content).toBe('{"image":"node"}');
  });

  it('replaces stale symlink pointing to wrong target', async () => {
    const wsRoot = join(tempDir, 'test-ws');
    const devcontainerDir = join(wsRoot, '.devcontainer');
    await mkdir(join(wsRoot, AGENT_ENV_DIR), { recursive: true });
    await writeFile(join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'), '{}', 'utf-8');
    await mkdir(devcontainerDir, { recursive: true });
    // Create a symlink pointing to a wrong target
    await symlink('../wrong/path.json', join(devcontainerDir, 'devcontainer.json'));

    await ensureDevcontainerSymlink(wsRoot, codeFsDeps);

    const symlinkPath = join(devcontainerDir, 'devcontainer.json');
    const linkStat = await lstat(symlinkPath);
    expect(linkStat.isSymbolicLink()).toBe(true);
    const target = await readlink(symlinkPath);
    expect(target).toBe(join('..', AGENT_ENV_DIR, 'devcontainer.json'));
  });
});
