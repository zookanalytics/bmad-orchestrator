import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
  appendFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { ContainerLifecycle } from './container.js';
import type { ShutdownInstanceDeps } from './shutdown-instance.js';
import type { InstanceState } from './types.js';

import { shutdownInstance } from './shutdown-instance.js';
import { AGENT_ENV_DIR, STATE_FILE, WORKSPACES_DIR } from './types.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-shutdown-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function createTestState(
  workspaceName: string,
  overrides: Partial<InstanceState> = {}
): InstanceState {
  const repoSlug = overrides.repoSlug ?? 'repo';
  const instance = workspaceName.startsWith(`${repoSlug}-`)
    ? workspaceName.slice(repoSlug.length + 1)
    : workspaceName;
  return {
    instance,
    repoSlug,
    repoUrl: 'https://github.com/user/repo.git',
    createdAt: '2026-01-15T10:00:00.000Z',
    lastAttached: '2026-01-20T14:00:00.000Z',
    purpose: null,
    containerName: `ae-${workspaceName}`,
    repoConfigDetected: false,
    ...overrides,
  };
}

async function createTestWorkspace(workspaceName: string, state: InstanceState): Promise<void> {
  const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, workspaceName);
  const agentEnvDir = join(wsRoot, AGENT_ENV_DIR);
  const stateFile = join(agentEnvDir, STATE_FILE);

  await mkdir(agentEnvDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');
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
    devcontainerUp: vi.fn().mockResolvedValue({ ok: true }),
    dockerPull: vi.fn().mockResolvedValue({ ok: true }),
    containerStop: vi.fn().mockResolvedValue({ ok: true }),
    containerRemove: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

function createTestDeps(
  containerOverrides: Partial<ContainerLifecycle> = {}
): ShutdownInstanceDeps {
  return {
    executor: vi.fn().mockResolvedValue({ ok: true, stdout: '', stderr: '' }),
    container: createMockContainer(containerOverrides),
    workspaceFsDeps: {
      mkdir,
      readdir,
      stat,
      homedir: () => tempDir,
    },
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    logger: { warn: vi.fn(), info: vi.fn() },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('shutdownInstance', () => {
  it('saves tmux state and stops a running container', async () => {
    const wsName = 'repo-myapp';
    const state = createTestState(wsName);
    await createTestWorkspace(wsName, state);

    const deps = createTestDeps();
    const result = await shutdownInstance('myapp', deps, 'repo');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.containerName).toBe(`ae-${wsName}`);
      expect(result.tmuxSaved).toBe(true);
    }
    expect(deps.container.containerStop).toHaveBeenCalledWith(`ae-${wsName}`);
  });

  it('returns error when workspace is not found', async () => {
    const deps = createTestDeps();
    const result = await shutdownInstance('nonexistent', deps, 'repo');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBeDefined();
    }
  });

  it('returns error when Docker is not available', async () => {
    const wsName = 'repo-myapp';
    const state = createTestState(wsName);
    await createTestWorkspace(wsName, state);

    const deps = createTestDeps({ isDockerAvailable: vi.fn().mockResolvedValue(false) });
    const result = await shutdownInstance('myapp', deps, 'repo');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('ORBSTACK_REQUIRED');
    }
  });

  it('returns error when container is not running', async () => {
    const wsName = 'repo-myapp';
    const state = createTestState(wsName);
    await createTestWorkspace(wsName, state);

    const deps = createTestDeps({
      containerStatus: vi.fn().mockResolvedValue({ ok: true, status: 'stopped' }),
    });
    const result = await shutdownInstance('myapp', deps, 'repo');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONTAINER_NOT_RUNNING');
    }
  });

  it('continues when tmux save fails (non-fatal)', async () => {
    const wsName = 'repo-myapp';
    const state = createTestState(wsName);
    await createTestWorkspace(wsName, state);

    const deps = createTestDeps();
    deps.executor = vi.fn().mockResolvedValue({ ok: false, stdout: '', stderr: 'tmux error' });

    const result = await shutdownInstance('myapp', deps, 'repo');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tmuxSaved).toBe(false);
    }
    expect(deps.container.containerStop).toHaveBeenCalled();
  });

  it('returns error when container stop fails', async () => {
    const wsName = 'repo-myapp';
    const state = createTestState(wsName);
    await createTestWorkspace(wsName, state);

    const deps = createTestDeps({
      containerStop: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'DOCKER_STOP_FAILED', message: 'Stop failed' },
      }),
    });
    const result = await shutdownInstance('myapp', deps, 'repo');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DOCKER_STOP_FAILED');
    }
  });
});
