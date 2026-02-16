import type { ExecuteResult } from '@zookanalytics/shared';

import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { AttachInstanceDeps } from './attach-instance.js';
import type { ContainerLifecycle } from './container.js';
import type { InstanceState } from './types.js';

import { attachInstance, findWorkspaceByName } from './attach-instance.js';
import { AGENT_ENV_DIR, STATE_FILE, WORKSPACES_DIR } from './types.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-attach-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  // Derive instance name from workspace name by splitting at the LAST dash
  // e.g., "bmad-orch-auth" → instance="auth", repoSlug="bmad-orch"
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

function createTestDeps(overrides: Partial<AttachInstanceDeps> = {}): AttachInstanceDeps {
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
    ...overrides,
  };
}

// ─── findWorkspaceByName tests ───────────────────────────────────────────────

describe('findWorkspaceByName', () => {
  const fsDeps = {
    mkdir,
    readdir,
    stat,
    homedir: () => tempDir,
  };

  it('finds workspace by exact name match', async () => {
    await createTestWorkspace('repo-auth', createTestState('repo-auth'));

    const result = await findWorkspaceByName('repo-auth', fsDeps);

    expect(result).toEqual({ found: true, workspaceName: 'repo-auth' });
  });

  it('finds workspace by instance name suffix', async () => {
    await createTestWorkspace('bmad-orch-auth', createTestState('bmad-orch-auth'));

    const result = await findWorkspaceByName('auth', fsDeps);

    expect(result).toEqual({ found: true, workspaceName: 'bmad-orch-auth' });
  });

  it('returns not-found when no workspace matches', async () => {
    await createTestWorkspace('repo-auth', createTestState('repo-auth'));

    const result = await findWorkspaceByName('nonexistent', fsDeps);

    expect(result).toEqual({ found: false, reason: 'not-found' });
  });

  it('returns ambiguous when multiple workspaces match suffix', async () => {
    await createTestWorkspace('repo1-auth', createTestState('repo1-auth'));
    await createTestWorkspace('repo2-auth', createTestState('repo2-auth'));

    const result = await findWorkspaceByName('auth', fsDeps);

    expect(result.found).toBe(false);
    if (result.found) throw new Error('Expected not found');
    expect(result.reason).toBe('ambiguous');
    if (result.reason !== 'ambiguous') throw new Error('Expected ambiguous');
    expect(result.matches).toContain('repo1-auth');
    expect(result.matches).toContain('repo2-auth');
  });

  it('returns not-found when no workspaces exist', async () => {
    const result = await findWorkspaceByName('auth', fsDeps);

    expect(result).toEqual({ found: false, reason: 'not-found' });
  });
});

// ─── attachInstance tests ────────────────────────────────────────────────────

describe('attachInstance', () => {
  it('attaches to a running instance successfully', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const result = await attachInstance('auth', deps);

    expect(result.ok).toBe(true);
  });

  it('calls docker exec with correct container name for tmux attach', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await attachInstance('auth', deps);

    expect(deps.executor).toHaveBeenCalledWith(
      'docker',
      [
        'exec',
        '-it',
        'ae-repo-auth',
        'bash',
        '-c',
        'tmux attach-session -t main 2>/dev/null || tmux new-session -s main',
      ],
      { stdio: 'inherit' }
    );
  });

  it('starts stopped container before attaching', async () => {
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

    const result = await attachInstance('auth', deps);

    expect(result.ok).toBe(true);
    expect(mockContainer.devcontainerUp).toHaveBeenCalled();
  });

  it('passes configPath for baseline config when starting stopped container', async () => {
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

    await attachInstance('auth', deps);

    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        configPath: expect.stringContaining(join(AGENT_ENV_DIR, 'devcontainer.json')),
      })
    );
  });

  it('does not pass configPath for repo config when starting stopped container', async () => {
    const state = createTestState('repo-auth', { configSource: 'repo' });
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'stopped',
        containerId: 'abc123',
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    await attachInstance('auth', deps);

    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        configPath: undefined,
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

    await attachInstance('auth', deps, onStarting);

    expect(onStarting).toHaveBeenCalledOnce();
  });

  it('does not call onContainerStarting for already running container', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();
    const onStarting = vi.fn();

    await attachInstance('auth', deps, onStarting);

    expect(onStarting).not.toHaveBeenCalled();
  });

  it('returns WORKSPACE_NOT_FOUND when instance does not exist', async () => {
    const deps = createTestDeps();

    const result = await attachInstance('nonexistent', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect(result.error.message).toContain("Instance 'nonexistent' not found");
  });

  it('returns AMBIGUOUS_INSTANCE when multiple repos have same instance name', async () => {
    await createTestWorkspace('repo1-auth', createTestState('repo1-auth'));
    await createTestWorkspace('repo2-auth', createTestState('repo2-auth'));
    const deps = createTestDeps();

    const result = await attachInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('AMBIGUOUS_INSTANCE');
    expect(result.error.message).toContain('repo1');
    expect(result.error.message).toContain('repo2');
    expect(result.error.suggestion).toContain('--repo');
  });

  it('returns ORBSTACK_REQUIRED when Docker is not available', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer({
      isDockerAvailable: vi.fn().mockResolvedValue(false),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await attachInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('ORBSTACK_REQUIRED');
    expect(result.error.suggestion).toContain('OrbStack');
  });

  it('updates lastAttached timestamp after successful attach', async () => {
    const originalTimestamp = '2026-01-20T14:00:00.000Z';
    const state = createTestState('repo-auth', { lastAttached: originalTimestamp });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await attachInstance('auth', deps);

    // Read back the state file to verify update
    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const stateFile = join(wsRoot, AGENT_ENV_DIR, STATE_FILE);
    const content = await readFile(stateFile, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;

    expect(updatedState.lastAttached).not.toBe(originalTimestamp);
    // Verify the timestamp is a valid ISO string (close to now)
    const lastAttached = new Date(updatedState.lastAttached);
    expect(lastAttached.getTime()).toBeGreaterThan(Date.now() - 10_000);
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

    const result = await attachInstance('auth', deps);

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

    const result = await attachInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
  });

  it('returns error when tmux attach fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const executor = vi.fn().mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'bash: tmux: command not found',
      exitCode: 127,
    } satisfies ExecuteResult);
    const deps = createTestDeps({ executor });

    const result = await attachInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
    expect(result.error.message).toContain('tmux');
  });

  it('returns generic attach error when docker exec fails without tmux issue', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const executor = vi.fn().mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'Error response from daemon: container is not running',
      exitCode: 1,
    } satisfies ExecuteResult);
    const deps = createTestDeps({ executor });

    const result = await attachInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
    expect(result.error.message).toContain('Failed to attach');
    expect(result.error.message).not.toContain('tmux is not available');
    expect(result.error.suggestion).toContain('Ensure the container is running');
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

    const result = await attachInstance('auth', deps);

    expect(result.ok).toBe(true);
    expect(mockContainer.devcontainerUp).toHaveBeenCalled();
  });

  it('preserves other state fields when updating lastAttached', async () => {
    const state = createTestState('repo-auth', {
      purpose: 'OAuth feature work',
      repoUrl: 'https://github.com/user/special.git',
    });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await attachInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const stateFile = join(wsRoot, AGENT_ENV_DIR, STATE_FILE);
    const content = await readFile(stateFile, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;

    expect(updatedState.purpose).toBe('OAuth feature work');
    expect(updatedState.repoUrl).toBe('https://github.com/user/special.git');
    expect(updatedState.instance).toBe('auth');
  });
});
