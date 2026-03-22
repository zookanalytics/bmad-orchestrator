import type { ExecuteResult } from '@zookanalytics/shared';

import {
  access,
  cp,
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
  DockerPullResult,
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

/** Create a workspace directory with state.json and optionally devcontainer config files.
 *
 * For baseline configs: files go into `.agent-env/` (the baseline config directory).
 * For repo configs: files go into `.devcontainer/` (the standard devcontainer directory).
 */
async function createTestWorkspace(
  workspaceName: string,
  state: InstanceState,
  options?: { devcontainerFiles?: string[]; dockerfileContent?: string }
): Promise<void> {
  const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, workspaceName);
  const agentEnvDir = join(wsRoot, AGENT_ENV_DIR);
  const stateFile = join(agentEnvDir, STATE_FILE);

  await mkdir(agentEnvDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');

  // Create devcontainer config files if specified
  if (options?.devcontainerFiles) {
    // Baseline configs go to .agent-env/, repo configs go to .devcontainer/
    const configDir = !state.repoConfigDetected ? agentEnvDir : join(wsRoot, '.devcontainer');
    await mkdir(configDir, { recursive: true });
    for (const file of options.devcontainerFiles) {
      if (file === 'devcontainer.json') {
        // Use a valid repo config (no build/dockerfile/image — validateRepoConfig rejects those)
        await writeFile(join(configDir, file), JSON.stringify({}), 'utf-8');
      } else if (file === 'Dockerfile') {
        await writeFile(
          join(configDir, file),
          options.dockerfileContent ?? 'FROM node:22-bookworm-slim\n',
          'utf-8'
        );
      } else {
        await writeFile(join(configDir, file), `# ${file}`, 'utf-8');
      }
    }
  }
}

function createTestState(
  workspaceName: string,
  overrides: Partial<InstanceState> = {}
): InstanceState {
  const repoSlug = overrides.repoSlug ?? 'repo';
  // Derive instance name by stripping the repoSlug prefix (matches production behavior)
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
    dockerPull: vi.fn().mockResolvedValue({ ok: true } satisfies DockerPullResult),
    containerStop: vi.fn().mockResolvedValue({ ok: true } satisfies ContainerStopResult),
    containerRemove: vi.fn().mockResolvedValue({ ok: true } satisfies ContainerRemoveResult),
    ...overrides,
  };
}

/**
 * Create devcontainer stat mock that allows baseline path and real workspace paths through.
 * Falls back to real stat for paths under tempDir (workspace files created by tests).
 * Only synthesizes a directory-like result for the `.devcontainer` directory itself.
 */
function createDevcontainerStatMock(hasExistingDevcontainer: boolean) {
  const baselinePath = getBaselineConfigPath();
  return vi.fn().mockImplementation(async (path: string) => {
    if (path.startsWith(baselinePath) || path === baselinePath) {
      return stat(path);
    }
    // Let real filesystem handle workspace paths (includes devcontainer.json, Dockerfile, etc.)
    try {
      return await stat(path);
    } catch {
      // Fall through to mock behavior
    }
    // Only synthesize a result for the .devcontainer directory itself (not files inside it)
    if (hasExistingDevcontainer && path.endsWith('.devcontainer')) {
      return { isDirectory: () => true, isFile: () => false };
    }
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  });
}

/** Baseline config fixture content for merge mocks */
const BASELINE_CONFIG_JSON = JSON.stringify({
  image: 'ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:latest',
  initializeCommand: 'bash .agent-env/init-host.sh',
  mounts: ['source=${localWorkspaceFolder}/.agent-env,target=/etc/agent-env,type=bind'],
  containerEnv: { AGENT_ENV_CONTAINER: 'true' },
});

/**
 * Create mergeDeps mock.
 *
 * - readFile returns baseline config JSON when path matches config/baseline/devcontainer.json,
 *   otherwise delegates to real readFile.
 * - access resolves for baseline paths, otherwise delegates to real access.
 * - writeFile and rename delegate to real implementations (so generated config is written to disk).
 */
function createMergeDeps() {
  const baselinePath = getBaselineConfigPath();
  return {
    readFile: vi.fn().mockImplementation(async (path: string, encoding?: string) => {
      if (path.includes('config/baseline/devcontainer.json')) {
        return BASELINE_CONFIG_JSON;
      }
      return readFile(path, encoding as BufferEncoding);
    }),
    access: vi.fn().mockImplementation(async (path: string, mode?: number) => {
      if (path.startsWith(baselinePath)) {
        return; // resolve successfully for baseline paths
      }
      return access(path, mode);
    }),
    writeFile: vi.fn().mockImplementation(writeFile),
    rename: vi.fn().mockImplementation(rename),
  };
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
      cp: vi.fn().mockImplementation(cp),
      mkdir: vi.fn().mockImplementation(mkdir),
      readdir: vi.fn().mockImplementation(readdir),
      readFile: vi.fn().mockImplementation(readFile),
      stat: createDevcontainerStatMock(true),
      writeFile: vi.fn().mockImplementation(writeFile),
    },
    mergeDeps: createMergeDeps(),
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const deps = createTestDeps();

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.containerName).toBe('ae-repo-auth');
    expect(result.wasRunning).toBe(false);
  });

  it('stops container before rebuilding', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(mockContainer.containerStop).toHaveBeenCalledWith('ae-repo-auth');
  });

  it('removes container after stopping', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(mockContainer.containerRemove).toHaveBeenCalledWith('ae-repo-auth');
  });

  it('runs devcontainer up after removing container', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(
      wsRoot,
      'ae-repo-auth',
      expect.objectContaining({
        configPath: join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'),
      })
    );
  });

  it('preserves workspace files during rebuild', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const deps = createTestDeps();

    const result = await rebuildInstance('repo-auth', deps);

    expect(result.ok).toBe(true);
  });

  it('finds workspace by instance field in state.json', async () => {
    const state = createTestState('bmad-orch-auth', {
      repoSlug: 'bmad-orch',
      repoConfigDetected: false,
    });
    await createTestWorkspace('bmad-orch-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const deps = createTestDeps();

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
  });

  // ─── Config refresh: baseline ──────────────────────────────────────────────

  it('refreshes merged config: copies managed assets into .agent-env/ and writes generated config', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const deps = createTestDeps();

    await rebuildInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const agentEnvDir = join(wsRoot, AGENT_ENV_DIR);

    // Should have ensured .agent-env/ exists (called by copyManagedAssets)
    expect(deps.devcontainerFsDeps.mkdir).toHaveBeenCalledWith(agentEnvDir, {
      recursive: true,
    });
    // Should have copied baseline assets into .agent-env/ (excluding devcontainer.json)
    expect(deps.devcontainerFsDeps.cp).toHaveBeenCalledWith(
      expect.any(String),
      agentEnvDir,
      expect.objectContaining({ recursive: true })
    );
    // Should have written the generated config via mergeDeps
    expect(deps.mergeDeps.writeFile).toHaveBeenCalled();
    expect(deps.mergeDeps.rename).toHaveBeenCalled();
  });

  it('updates state with lastRebuilt timestamp', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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

  it('does not warn about extra files during baseline refresh (copies directly into .agent-env/)', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh', 'custom-script.sh'],
    });
    const deps = createTestDeps();

    await rebuildInstance('auth', deps);

    // Baseline refresh now copies directly into .agent-env/ — no extra files detection
    const warnCalls = (deps.logger?.warn as ReturnType<typeof vi.fn>).mock.calls;
    const extraFilesWarnings = warnCalls.filter(
      (call: string[]) => typeof call[0] === 'string' && call[0].includes('Extra files')
    );
    expect(extraFilesWarnings).toHaveLength(0);
  });

  it('does not log when no extra files exist', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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

  it('refreshes merged config: verifies managed properties are applied to generated devcontainer.json', async () => {
    const state = createTestState('repo-auth', {
      repoConfigDetected: false,
      purpose: 'OAuth work',
    });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const deps = createTestDeps();

    await rebuildInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const configPath = join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json');
    const content = await readFile(configPath, 'utf-8');
    // Strip auto-generated header comment line before parsing JSON
    const jsonContent = content.replace(/^\/\/.*\n/, '');
    const config = JSON.parse(jsonContent);

    // Verify container name patch
    expect(config.runArgs).toContain('--name=ae-repo-auth');
    // Verify env vars (including purpose)
    expect(config.containerEnv.AGENT_ENV_PURPOSE).toBe('OAuth work');
    // Verify VS Code settings
    expect(config.customizations.vscode.settings['betterStatusBar.configurationFile']).toBe(
      '/etc/agent-env/statusBar.json'
    );
    // Verify filewatcher triggers status bar refresh
    expect(config.customizations.vscode.settings['filewatcher.commands']).toEqual([
      {
        match: 'statusBar.json$',
        event: 'onFolderChange',
        vscodeTask: 'betterStatusBar.refreshButtons',
      },
    ]);
  });

  // ─── Config refresh failure ───────────────────────────────────────────────

  it('returns error when config refresh fails and does NOT stop container', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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

  // ─── Repo config missing (AC-19) ──────────────────────────────────────────

  it('returns REPO_CONFIG_MISSING when state.repoConfigDetected is true but repo config is absent', async () => {
    // State says repo config was detected at creation, but .devcontainer/devcontainer.json is gone
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state, {
      // Do NOT create .devcontainer/devcontainer.json
      devcontainerFiles: ['init-host.sh'],
    });

    const mockContainer = createMockContainer();
    const deps = createTestDeps({
      container: mockContainer,
      devcontainerFsDeps: {
        cp: vi.fn().mockImplementation(cp),
        mkdir: vi.fn().mockImplementation(mkdir),
        readdir: vi.fn().mockImplementation(readdir),
        readFile: vi.fn().mockImplementation(readFile),
        stat: createDevcontainerStatMock(false), // no .devcontainer directory
        writeFile: vi.fn().mockImplementation(writeFile),
      },
    });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('REPO_CONFIG_MISSING');
    expect(result.error.message).toContain('missing');
    expect(result.error.suggestion).toContain('Restore');
    // Container should NOT be torn down when config check fails
    expect(mockContainer.containerStop).not.toHaveBeenCalled();
    expect(mockContainer.containerRemove).not.toHaveBeenCalled();
    expect(mockContainer.devcontainerUp).not.toHaveBeenCalled();
  });

  // ─── Operation ordering ───────────────────────────────────────────────────

  it('calls operations in correct order: merge config → copy assets → write config → status → stop → remove → devcontainer up', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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

    const baselinePath = getBaselineConfigPath();
    const mockMergeDeps = {
      readFile: vi.fn().mockImplementation(async (path: string) => {
        if (path.includes('config/baseline/devcontainer.json')) {
          callOrder.push('load_managed_defaults');
          return BASELINE_CONFIG_JSON;
        }
        return readFile(path, 'utf-8');
      }),
      access: vi.fn().mockImplementation(async (path: string, mode?: number) => {
        if (path.startsWith(baselinePath)) return;
        return access(path, mode);
      }),
      writeFile: vi.fn().mockImplementation(async (...args: Parameters<typeof writeFile>) => {
        callOrder.push('write_generated_config');
        return writeFile(...args);
      }),
      rename: vi.fn().mockImplementation(async (from: string, to: string) => {
        if (from.endsWith('devcontainer.json.tmp')) {
          callOrder.push('rename_generated_config');
        }
        return rename(from, to);
      }),
    };

    const deps = createTestDeps({
      container: mockContainer,
      mergeDeps: mockMergeDeps,
      rm: vi.fn().mockImplementation(async (path: string, opts?: unknown) => {
        return rm(path, opts as Parameters<typeof rm>[1]);
      }),
      rename: vi.fn().mockImplementation(async () => {
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
          callOrder.push('asset_copy');
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
      'load_managed_defaults', // step 1: load baseline config
      'asset_copy', // step 3a: copy baseline assets (excluding devcontainer.json)
      'asset_copy', // step 3b: copy status bar template
      'write_generated_config', // step 4a: write generated config to .tmp
      'rename_generated_config', // step 4b: atomic rename .tmp → devcontainer.json
      'status_check',
      'container_stop',
      'container_remove',
      'devcontainer_up',
      'state_save',
    ]);
  });

  // ─── Container running check ───────────────────────────────────────────────

  it('blocks rebuild when container is running and force=false', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'abc123',
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await rebuildInstance('auth', deps, { force: true });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.wasRunning).toBe(true);
    expect(mockContainer.containerStop).toHaveBeenCalled();
    expect(mockContainer.containerRemove).toHaveBeenCalled();
    expect(mockContainer.devcontainerUp).toHaveBeenCalled();
  });

  it('saves tmux session state before teardown when container is running', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });

    const callOrder: string[] = [];
    const mockContainer = createMockContainer({
      containerStatus: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'abc123',
      }),
      containerStop: vi.fn().mockImplementation(async () => {
        callOrder.push('containerStop');
        return { ok: true };
      }),
    });

    const mockExecutor = vi.fn().mockImplementation(async (cmd: string, args?: string[]) => {
      if (cmd === 'docker' && args?.[0] === 'exec') {
        callOrder.push('tmux-save');
      }
      return { ok: true, stdout: '', stderr: '', exitCode: 0 };
    });

    const deps = createTestDeps({
      container: mockContainer,
      executor: mockExecutor,
    });

    await rebuildInstance('auth', deps, { force: true });

    // Verify tmux-save was called with correct args
    expect(mockExecutor).toHaveBeenCalledWith(
      'docker',
      ['exec', 'ae-repo-auth', 'bash', '-lc', 'agent-env tmux-save'],
      { timeout: 30_000 }
    );

    // Verify tmux-save ran before container stop
    expect(callOrder.indexOf('tmux-save')).toBeLessThan(callOrder.indexOf('containerStop'));
  });

  // ─── Container not-found case ──────────────────────────────────────────────

  it('skips stop and remove when container is not found', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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

  it('uses derived ae-* container name for new config even when state has legacy random name', async () => {
    // Simulate a legacy instance created before the merge pipeline, where Docker
    // assigned a random name (e.g., "musing_mclaren") that got persisted in state
    const state = createTestState('repo-auth', {
      repoConfigDetected: false,
      containerName: 'musing_mclaren', // legacy random Docker name
    });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    // Should use the derived ae-* name, not the legacy random name
    expect(result.containerName).toBe('ae-repo-auth');

    // Teardown should use the OLD name from state
    expect(mockContainer.containerStop).toHaveBeenCalledWith('musing_mclaren');
    expect(mockContainer.containerRemove).toHaveBeenCalledWith('musing_mclaren');

    // The generated config should have the derived name in runArgs, not the legacy name
    const generatedConfigPath = join(
      tempDir,
      AGENT_ENV_DIR,
      WORKSPACES_DIR,
      'repo-auth',
      AGENT_ENV_DIR,
      'devcontainer.json'
    );
    const generatedContent = await readFile(generatedConfigPath, 'utf-8');
    // Skip the header comment line
    const jsonContent = generatedContent.split('\n').slice(1).join('\n');
    const generatedConfig = JSON.parse(jsonContent);
    expect(generatedConfig.runArgs).toContain('--name=ae-repo-auth');
    expect(generatedConfig.runArgs).not.toContain('--name=musing_mclaren');

    // State should be updated with the derived name
    const stateFile = join(
      tempDir,
      AGENT_ENV_DIR,
      WORKSPACES_DIR,
      'repo-auth',
      AGENT_ENV_DIR,
      STATE_FILE
    );
    const updatedState = JSON.parse(await readFile(stateFile, 'utf-8'));
    expect(updatedState.containerName).toBe('ae-repo-auth');
  });

  it('always updates state with lastRebuilt timestamp even if name unchanged', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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

  it('returns AMBIGUOUS_INSTANCE when multiple workspaces match', async () => {
    await createTestWorkspace(
      'repo1-auth',
      createTestState('repo1-auth', { repoSlug: 'repo1', repoConfigDetected: false }),
      { devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'] }
    );
    await createTestWorkspace(
      'repo2-auth',
      createTestState('repo2-auth', { repoSlug: 'repo2', repoConfigDetected: false }),
      { devcontainerFiles: ['devcontainer.json', 'Dockerfile', 'init-host.sh', 'post-create.sh'] }
    );
    const deps = createTestDeps();

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('AMBIGUOUS_INSTANCE');
    expect(result.error.message).toContain('repo1');
    expect(result.error.message).toContain('repo2');
  });

  it('returns ORBSTACK_REQUIRED when Docker is not available', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
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

    const result = await rebuildInstance('auth', deps, { force: true });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.wasRunning).toBe(true);
  });

  // ─── Pull behavior ──────────────────────────────────────────────────────

  it('default rebuild calls dockerPull for each FROM image found in Dockerfile', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile'],
      dockerfileContent: 'FROM node:22-bookworm-slim\n',
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(mockContainer.dockerPull).toHaveBeenCalledWith('node:22-bookworm-slim');
  });

  it('skips pull entirely when pull is false', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps, { pull: false });

    expect(mockContainer.dockerPull).not.toHaveBeenCalled();
  });

  it('returns IMAGE_PULL_FAILED error and does NOT stop/remove container on pull failure', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile'],
    });
    const mockContainer = createMockContainer({
      dockerPull: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'IMAGE_PULL_FAILED',
          message: "Failed to pull 'node:22-bookworm-slim': network error",
          suggestion: 'Use --no-pull to skip pulling.',
        },
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('IMAGE_PULL_FAILED');
    expect(mockContainer.containerStop).not.toHaveBeenCalled();
    expect(mockContainer.containerRemove).not.toHaveBeenCalled();
  });

  it('skips pull with info log when no Dockerfile found', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state);
    // Create a .devcontainer/ with only devcontainer.json (image-based, no Dockerfile)
    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const devcontainerDir = join(wsRoot, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(
      join(devcontainerDir, 'devcontainer.json'),
      JSON.stringify({ image: 'mcr.microsoft.com/devcontainers/base:bookworm' })
    );
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    const result = await rebuildInstance('auth', deps);

    expect(result.ok).toBe(true);
    expect(mockContainer.dockerPull).not.toHaveBeenCalled();
    expect(deps.logger?.info).toHaveBeenCalledWith(expect.stringContaining('No Dockerfile found'));
  });

  it('skips parameterized FROM lines with logger.warn', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile'],
      dockerfileContent: 'FROM node:22\nFROM ${BASE_IMAGE}\n',
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(mockContainer.dockerPull).toHaveBeenCalledWith('node:22');
    expect(mockContainer.dockerPull).toHaveBeenCalledTimes(1);
    expect(deps.logger?.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping parameterized FROM')
    );
  });

  // ─── noCache behavior ──────────────────────────────────────────────────

  it('default rebuild passes buildNoCache true to devcontainerUp', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ buildNoCache: true })
    );
  });

  it('pull false still passes buildNoCache true (flags are independent)', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps, { pull: false });

    expect(mockContainer.dockerPull).not.toHaveBeenCalled();
    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ buildNoCache: true })
    );
  });

  it('passes buildNoCache false when noCache is false', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps, { noCache: false });

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        buildNoCache: false,
        configPath: join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'),
      })
    );
  });

  it('baseline rebuild defaults to buildNoCache false (image-based, no Dockerfile after refresh)', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: false });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'init-host.sh'],
    });
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        buildNoCache: false,
        configPath: join(wsRoot, AGENT_ENV_DIR, 'devcontainer.json'),
      })
    );
  });

  it('does not pass buildNoCache when no Dockerfile exists (image-based config)', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state);
    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const devcontainerDir = join(wsRoot, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(
      join(devcontainerDir, 'devcontainer.json'),
      JSON.stringify({ image: 'node:22' })
    );
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(mockContainer.devcontainerUp).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ buildNoCache: false })
    );
  });

  // ─── Pull ordering verification ────────────────────────────────────────

  it('pull failure prevents container teardown (stop is never called)', async () => {
    const state = createTestState('repo-auth', { repoConfigDetected: true });
    await createTestWorkspace('repo-auth', state, {
      devcontainerFiles: ['devcontainer.json', 'Dockerfile'],
    });

    const callOrder: string[] = [];
    const mockContainer = createMockContainer({
      dockerPull: vi.fn().mockImplementation(async () => {
        callOrder.push('docker_pull');
        return {
          ok: false,
          error: {
            code: 'IMAGE_PULL_FAILED',
            message: 'pull failed',
          },
        };
      }),
      containerStop: vi.fn().mockImplementation(async () => {
        callOrder.push('container_stop');
        return { ok: true };
      }),
    });
    const deps = createTestDeps({ container: mockContainer });

    await rebuildInstance('auth', deps);

    expect(callOrder).toContain('docker_pull');
    expect(callOrder).not.toContain('container_stop');
    expect(mockContainer.containerStop).not.toHaveBeenCalled();
  });
});
