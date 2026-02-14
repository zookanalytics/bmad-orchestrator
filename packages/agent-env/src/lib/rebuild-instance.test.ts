import type { ExecuteResult } from '@zookanalytics/shared';

import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
  rename,
  appendFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type {
  ContainerLifecycle,
  ContainerRemoveResult,
  ContainerStopResult,
} from './container.js';
import type { RebuildInstanceDeps } from './rebuild-instance.js';
import type { InstanceState } from './types.js';

import { getBaselineConfigPath } from './devcontainer.js';
import { rebuildInstance } from './rebuild-instance.js';
import { AGENT_ENV_DIR, STATE_FILE, WORKSPACES_DIR } from './types.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-rebuild-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

/** Create a workspace directory with state.json and optionally a .devcontainer/ directory */
async function createTestWorkspace(
  workspaceName: string,
  state: InstanceState,
  options?: { devcontainerFiles?: string[] }
): Promise<void> {
  const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, workspaceName);
  const agentEnvDir = join(wsRoot, AGENT_ENV_DIR);
  const stateFile = join(agentEnvDir, STATE_FILE);

  await mkdir(agentEnvDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');

  // Create .devcontainer/ with files if specified
  if (options?.devcontainerFiles) {
    const devcontainerDir = join(wsRoot, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    for (const file of options.devcontainerFiles) {
      await writeFile(join(devcontainerDir, file), `# ${file}`, 'utf-8');
    }
  }
}

function createTestState(
  workspaceName: string,
  overrides: Partial<InstanceState> = {}
): InstanceState {
  return {
    name: workspaceName,
    repo: 'https://github.com/user/repo.git',
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
      status: 'stopped',
      containerId: 'abc123',
    }),
    getContainerNameById: vi.fn().mockResolvedValue(null),
    findContainerByWorkspaceLabel: vi.fn().mockResolvedValue(null),
    devcontainerUp: vi.fn().mockResolvedValue({
      ok: true,
      status: 'running',
      containerId: 'new123',
    }),
    containerStop: vi.fn().mockResolvedValue({ ok: true } satisfies ContainerStopResult),
    containerRemove: vi.fn().mockResolvedValue({ ok: true } satisfies ContainerRemoveResult),
    ...overrides,
  };
}

/**
 * Create devcontainer stat mock that allows baseline path through and
 * returns configurable results for workspace paths.
 */
function createDevcontainerStatMock(hasExistingDevcontainer: boolean) {
  const baselinePath = getBaselineConfigPath();
  return vi.fn().mockImplementation(async (path: string) => {
    if (path.startsWith(baselinePath) || path === baselinePath) {
      return stat(path);
    }
    if (hasExistingDevcontainer && path.includes('.devcontainer')) {
      return { isDirectory: () => true, isFile: () => false };
    }
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  });
}

function createTestDeps(overrides: Partial<RebuildInstanceDeps> = {}): RebuildInstanceDeps {
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
      mkdir: vi.fn().mockImplementation(mkdir),
      readdir: vi.fn().mockImplementation(readdir),
      stat: vi.fn().mockImplementation(stat),
      homedir: () => tempDir,
    },
    stateFsDeps: {
      readFile: vi.fn().mockImplementation(readFile),
      writeFile: vi.fn().mockImplementation(writeFile),
      rename: vi.fn().mockImplementation(rename),
      mkdir: vi.fn().mockImplementation(mkdir),
      appendFile: vi.fn().mockImplementation(appendFile),
    },
    devcontainerFsDeps: {
      cp: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockImplementation(mkdir),
      readdir: vi.fn().mockImplementation(readdir),
      readFile: vi.fn().mockResolvedValue('{}'),
      stat: createDevcontainerStatMock(true),
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
    rm: vi.fn().mockImplementation(rm),
    rename: vi.fn().mockImplementation(rename),
    logger: { warn: vi.fn(), info: vi.fn() },
    ...overrides,
  } as unknown as RebuildInstanceDeps;
}

// ─── rebuildInstance tests ────────────────────────────────────────────────────

describe('rebuildInstance', () => {
  // ─── Success cases ──────────────────────────────────────────────────────────

  it('rebuilds a stopped instance successfully', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps();

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.containerName).toBe('ae-repo-auth');
    expect(result.wasRunning).toBe(false);
  });

  it('stops container before rebuilding', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(mockContainer.containerStop).toHaveBeenCalledWith('ae-repo-auth');
  });

  it('removes container after stopping', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(mockContainer.containerRemove).toHaveBeenCalledWith('ae-repo-auth');
  });

  it('runs devcontainer up after removing container', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(wsRoot, 'ae-repo-auth');
  });

  it('preserves workspace files during rebuild', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });

    // Create an extra file to verify workspace is preserved
    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    await writeFile(join(wsRoot, 'test-file.txt'), 'preserved', 'utf-8');

    const deps = createTestDeps();
    await rebuildInstance('auth', deps);

    // Verify file still exists
    const content = await readFile(join(wsRoot, 'test-file.txt'), 'utf-8');
    expect(content).toBe('preserved');
  });

  it('finds workspace by exact name', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps();

    const result = await rebuildInstance('repo-auth', deps);

    expect(result.ok).toBe(true);
  });

  it('finds workspace by suffix match', async () => {
    const state = createTestState('bmad-orch-auth', { configSource: 'baseline' });
    await createTestWorkspace('bmad-orch-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps();

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
  });

  // ─── Config refresh: baseline ──────────────────────────────────────────────

  it('refreshes baseline config: copies to temp, patches, then swaps', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps();

    await rebuildInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const devcontainerDir = join(wsRoot, '.devcontainer');
    const tempDevcontainerDir = join(wsRoot, '.devcontainer.new');

    // Should have deleted temp dir first (cleanup from previous runs)
    expect(deps.rm).toHaveBeenCalledWith(tempDevcontainerDir, { recursive: true, force: true });
    // Should have created temp dir
    expect(deps.devcontainerFsDeps.mkdir).toHaveBeenCalledWith(tempDevcontainerDir, {
      recursive: true,
    });
    // Should have copied baseline to temp dir
    expect(deps.devcontainerFsDeps.cp).toHaveBeenCalledWith(
      expect.any(String),
      tempDevcontainerDir,
      {
        recursive: true,
      }
    );
    // Should have deleted old .devcontainer/ before rename
    expect(deps.rm).toHaveBeenCalledWith(devcontainerDir, { recursive: true, force: true });
    // Should have renamed temp dir to .devcontainer
    expect(deps.rename).toHaveBeenCalledWith(tempDevcontainerDir, devcontainerDir);
  });

  it('updates state with lastRebuilt timestamp', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps();

    await rebuildInstance('auth', deps);

    const stateFile = join(
      tempDir,
      AGENT_ENV_DIR,
      WORKSPACES_DIR,
      'repo-auth',
      AGENT_ENV_DIR,
      STATE_FILE
    );
    const updatedState = JSON.parse(await readFile(stateFile, 'utf-8'));
    expect(updatedState.lastRebuilt).toBeDefined();
    // Verify it's a valid ISO string
    expect(new Date(updatedState.lastRebuilt).getTime()).not.toBeNaN();
  });

  it('returns CONFIG_SOURCE_UNKNOWN when configSource is missing from state', async () => {
    const state = createTestState('repo-auth');
    delete (state as unknown as Record<string, unknown>).configSource;
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps();

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONFIG_SOURCE_UNKNOWN');
    expect(result.error.suggestion).toContain('state.json');
  });

  it('uses overrideConfigSource when state lacks configSource', async () => {
    const state = createTestState('repo-auth');
    delete (state as unknown as Record<string, unknown>).configSource;
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json'],
    });
    const deps = createTestDeps();

    // Override to 'repo' — should NOT refresh baseline config
    await rebuildInstance('auth', deps, false, 'repo');

    expect(deps.devcontainerFsDeps.cp).not.toHaveBeenCalled();
  });

  it('logs extra files in .devcontainer/ before deletion', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: [
        'devcontainer.json',
        'Dockerfile',
        'init-host.sh',
        'post-create.sh',
        'custom-script.sh',
      ],
    });
    const deps = createTestDeps();

    await rebuildInstance('auth', deps);

    expect(deps.logger?.warn).toHaveBeenCalledWith(expect.stringContaining('custom-script.sh'));
  });

  it('does not log when no extra files exist', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps();

    await rebuildInstance('auth', deps);

    // logger.warn should NOT be called about extra files
    // (it might be called for other reasons, so check specifically for "Extra files")
    const warnCalls = (deps.logger?.warn as ReturnType<typeof vi.fn>).mock.calls;
    const extraFilesWarnings = warnCalls.filter(
      (call: string[]) => typeof call[0] === 'string' && call[0].includes('Extra files')
    );
    expect(extraFilesWarnings).toHaveLength(0);
  });

  // ─── Config refresh: repo ─────────────────────────────────────────────────

  it('preserves config when configSource is repo', async () => {
    const state = createTestState('repo-auth', { configSource: 'repo' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json'],
    });
    const deps = createTestDeps();

    await rebuildInstance('auth', deps);

    // Should NOT delete or re-copy (except potential cleanup of temp dir)
    expect(deps.devcontainerFsDeps.cp).not.toHaveBeenCalled();
    // Top-level rename should NOT be called for config swap
    const renameCalls = (deps.rename as ReturnType<typeof vi.fn>).mock.calls;
    const configSwapCalls = renameCalls.filter((call: string[]) => call[0].endsWith('.new'));
    expect(configSwapCalls).toHaveLength(0);
  });

  it('returns CONFIG_MISSING when repo config is absent on disk', async () => {
    const state = createTestState('repo-auth', { configSource: 'repo' });
    // Create workspace WITHOUT .devcontainer/
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      devcontainerFsDeps: {
        cp: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockImplementation(mkdir),
        readdir: vi.fn().mockImplementation(readdir),
        readFile: vi.fn().mockResolvedValue('{}'),
        stat: createDevcontainerStatMock(false), // no devcontainer config
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONFIG_MISSING');
    expect(result.error.suggestion).toContain('Re-clone');
  });

  it('returns CONFIG_CORRUPT when repo config exists but devcontainer.json is missing', async () => {
    const state = createTestState('repo-auth', { configSource: 'repo' });
    // Create workspace WITH .devcontainer/ but WITHOUT devcontainer.json
    await createTestWorkspace('repo-auth', state);
    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    await mkdir(join(wsRoot, '.devcontainer'), { recursive: true });

    const deps = createTestDeps({
      devcontainerFsDeps: {
        cp: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockImplementation(mkdir),
        readdir: vi.fn().mockImplementation(readdir),
        readFile: vi.fn().mockResolvedValue('{}'),
        stat: vi.fn().mockImplementation(async (path: string) => {
          if (path.endsWith('.devcontainer')) {
            return { isDirectory: () => true, isFile: () => false };
          }
          if (path.endsWith('devcontainer.json')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          return stat(path);
        }),
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONFIG_CORRUPT');
    expect(result.error.message).toContain('missing devcontainer.json');
  });

  it('accepts root-level repo config when .devcontainer/ dir does not exist', async () => {
    const state = createTestState('repo-auth', { configSource: 'repo' });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      devcontainerFsDeps: {
        cp: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockImplementation(mkdir),
        readdir: vi.fn().mockImplementation(readdir),
        readFile: vi.fn().mockResolvedValue('{}'),
        stat: vi.fn().mockImplementation(async (path: string) => {
          // Root-level devcontainer.json exists
          if (path.endsWith('devcontainer.json') && !path.includes('.devcontainer/')) {
            return { isDirectory: () => false, isFile: () => true };
          }
          // .devcontainer/ dir does NOT exist
          if (path.endsWith('.devcontainer')) {
            throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          }
          return stat(path);
        }),
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
  });

  // ─── Config refresh failure ───────────────────────────────────────────────

  it('returns error when config refresh fails and does NOT stop container', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });

    const mockContainer = createMockContainer();
    const deps = createTestDeps({
      container: mockContainer,
      devcontainerFsDeps: {
        cp: vi.fn().mockRejectedValue(new Error('baseline config not found')),
        mkdir: vi.fn().mockImplementation(mkdir),
        readdir: vi.fn().mockImplementation(readdir),
        readFile: vi.fn().mockResolvedValue('{}'),
        stat: createDevcontainerStatMock(true),
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONFIG_REFRESH_FAILED');
    // Container should NOT be stopped or removed
    expect(mockContainer.containerStop).not.toHaveBeenCalled();
    expect(mockContainer.containerRemove).not.toHaveBeenCalled();
    expect(mockContainer.devcontainerUp).not.toHaveBeenCalled();
  });

  // ─── Operation ordering ───────────────────────────────────────────────────

  it('calls operations in correct order: config refresh → status → stop → remove → devcontainer up', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });

    const callOrder: string[] = [];
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockImplementation(async () => {
        callOrder.push('status_check');
        return { ok: true, status: 'stopped', containerId: 'abc123' };
      }),
      containerStop: vi.fn().mockImplementation(async () => {
        callOrder.push('container_stop');
        return { ok: true };
      }),
      containerRemove: vi.fn().mockImplementation(async () => {
        callOrder.push('container_remove');
        return { ok: true };
      }),
      devcontainerUp: vi.fn().mockImplementation(async () => {
        callOrder.push('devcontainer_up');
        return { ok: true, status: 'running', containerId: 'new123' };
      }),
    });

    const deps = createTestDeps({
      container: mockContainer,
      rm: vi.fn().mockImplementation(async (path: string) => {
        if (path.endsWith('.new')) callOrder.push('temp_cleanup');
        if (path.endsWith('.devcontainer')) callOrder.push('config_delete');
        return rm(path, { recursive: true, force: true });
      }),
      rename: vi.fn().mockImplementation(async (from: string) => {
        if (from.endsWith('.new')) callOrder.push('config_swap');
        return Promise.resolve();
      }),
      stateFsDeps: {
        readFile: vi.fn().mockImplementation(readFile),
        writeFile: vi.fn().mockImplementation(writeFile),
        rename: vi.fn().mockImplementation(async (from: string) => {
          if (from.endsWith('.tmp')) callOrder.push('state_save');
          return Promise.resolve();
        }),
        mkdir: vi.fn().mockImplementation(mkdir),
        appendFile: vi.fn().mockImplementation(appendFile),
      },
      devcontainerFsDeps: {
        cp: vi.fn().mockImplementation(async () => {
          callOrder.push('config_copy');
        }),
        mkdir: vi.fn().mockImplementation(mkdir),
        readdir: vi.fn().mockImplementation(readdir),
        readFile: vi.fn().mockResolvedValue('{}'),
        stat: createDevcontainerStatMock(true),
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
    });

    await rebuildInstance('auth', deps);

    expect(callOrder).toEqual([
      'temp_cleanup',
      'config_copy',
      'config_delete',
      'config_swap',
      'status_check',
      'container_stop',
      'container_remove',
      'devcontainer_up',
      'state_save',
    ]);
  });

  // ─── Container running check ───────────────────────────────────────────────

  it('blocks rebuild when container is running and force=false', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps({
      container: createMockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          containerId: 'abc123',
        }),
      }),
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_RUNNING');
    expect(result.error.suggestion).toContain('--force');
    expect(result.wasRunning).toBe(true);
  });

  it('does not stop or remove container when running check blocks', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'abc123',
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(mockContainer.containerStop).not.toHaveBeenCalled();
    expect(mockContainer.containerRemove).not.toHaveBeenCalled();
    expect(mockContainer.devcontainerUp).not.toHaveBeenCalled();
  });

  it('rebuilds running container when force=true', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'abc123',
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await rebuildInstance('auth', deps, true);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.wasRunning).toBe(true);
    expect(mockContainer.containerStop).toHaveBeenCalled();
    expect(mockContainer.containerRemove).toHaveBeenCalled();
    expect(mockContainer.devcontainerUp).toHaveBeenCalled();
  });

  // ─── Container not-found case ──────────────────────────────────────────────

  it('skips stop and remove when container is not found', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'not-found',
        containerId: null,
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
    expect(mockContainer.containerStop).not.toHaveBeenCalled();
    expect(mockContainer.containerRemove).not.toHaveBeenCalled();
    expect(mockContainer.devcontainerUp).toHaveBeenCalled();
  });

  // ─── Container name discovery ──────────────────────────────────────────────

  it('discovers actual container name from containerId', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const mockContainer = createMockContainer({
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'new123',
      }),
      getContainerNameById: vi.fn().mockResolvedValue('ae-repo-auth'),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.containerName).toBe('ae-repo-auth');
    expect(mockContainer.getContainerNameById).toHaveBeenCalledWith('new123');
  });

  it('updates state when container name changes', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const mockContainer = createMockContainer({
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'new123',
      }),
      getContainerNameById: vi.fn().mockResolvedValue('custom-container-name'),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.containerName).toBe('custom-container-name');

    // Verify state was updated
    const stateFile = join(
      tempDir,
      AGENT_ENV_DIR,
      WORKSPACES_DIR,
      'repo-auth',
      AGENT_ENV_DIR,
      STATE_FILE
    );
    const updatedState = JSON.parse(await readFile(stateFile, 'utf-8'));
    expect(updatedState.containerName).toBe('custom-container-name');
  });

  it('always updates state with lastRebuilt timestamp even if name unchanged', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const mockContainer = createMockContainer({
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'new123',
      }),
      getContainerNameById: vi.fn().mockResolvedValue('ae-repo-auth'),
    });
    const stateFsDeps = {
      readFile: vi.fn().mockImplementation(readFile),
      writeFile: vi.fn().mockImplementation(writeFile),
      rename: vi.fn().mockImplementation(rename),
      mkdir: vi.fn().mockImplementation(mkdir),
      appendFile: vi.fn().mockImplementation(appendFile),
    };
    const deps = createTestDeps({ container: mockContainer, stateFsDeps });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
    // writeFile should be called to update lastRebuilt
    expect(stateFsDeps.writeFile).toHaveBeenCalled();
  });

  // ─── Error handling ────────────────────────────────────────────────────────

  it('returns WORKSPACE_NOT_FOUND when instance does not exist', async () => {
    const deps = createTestDeps();

    const result = await rebuildInstance('nonexistent', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect(result.error.message).toContain("Instance 'nonexistent' not found");
  });

  it('returns AMBIGUOUS_MATCH when multiple workspaces match', async () => {
    await createTestWorkspace(
      'repo1-auth',
      createTestState('repo1-auth', { configSource: 'baseline' }),
      { devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'] }
    );
    await createTestWorkspace(
      'repo2-auth',
      createTestState('repo2-auth', { configSource: 'baseline' }),
      { devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'] }
    );
    const deps = createTestDeps();

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('AMBIGUOUS_MATCH');
    expect(result.error.message).toContain('repo1-auth');
    expect(result.error.message).toContain('repo2-auth');
  });

  it('returns ORBSTACK_REQUIRED when Docker is not available', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps({
      container: createMockContainer({
        isDockerAvailable: vi.fn().mockResolvedValue(false),
      }),
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('ORBSTACK_REQUIRED');
  });

  it('returns error when container stop fails', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps({
      container: createMockContainer({
        containerStop: vi.fn().mockResolvedValue({
          ok: false,
          error: {
            code: 'CONTAINER_STOP_TIMEOUT',
            message: "Failed to stop container 'ae-repo-auth': timeout",
            suggestion: 'Try manually: docker rm -f ae-repo-auth',
          },
        }),
      }),
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_STOP_TIMEOUT');
  });

  it('returns error when container remove fails', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps({
      container: createMockContainer({
        containerRemove: vi.fn().mockResolvedValue({
          ok: false,
          error: {
            code: 'CONTAINER_ERROR',
            message: "Failed to remove container 'ae-repo-auth': conflict",
          },
        }),
      }),
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
  });

  it('returns error when devcontainer up fails', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps({
      container: createMockContainer({
        devcontainerUp: vi.fn().mockResolvedValue({
          ok: false,
          status: 'not-found',
          containerId: null,
          error: {
            code: 'CONTAINER_ERROR',
            message: 'devcontainer up failed: build error',
          },
        }),
      }),
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
    expect(result.error.message).toContain('build error');
  });

  it('includes wasRunning in error result when devcontainer up fails after stopping', async () => {
    const state = createTestState('repo-auth', { configSource: 'baseline' });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'],
    });
    const deps = createTestDeps({
      container: createMockContainer({
        containerStatus: vi.fn().mockResolvedValue({
          ok: true,
          status: 'running',
          containerId: 'abc123',
        }),
        devcontainerUp: vi.fn().mockResolvedValue({
          ok: false,
          status: 'not-found',
          containerId: null,
          error: {
            code: 'CONTAINER_ERROR',
            message: 'devcontainer up failed',
          },
        }),
      }),
    });

    const result = await rebuildInstance('auth', deps, true);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.wasRunning).toBe(true);
  });
});
