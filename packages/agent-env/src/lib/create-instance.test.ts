import type { ExecuteResult } from '@zookanalytics/shared';

import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { ContainerLifecycle } from './container.js';
import type { CreateInstanceDeps } from './create-instance.js';

import {
  extractRepoName,
  createInstance,
  resolveRepoUrl,
  attachToInstance,
} from './create-instance.js';
import { getBaselineConfigPath } from './devcontainer.js';
import { AGENT_ENV_DIR, WORKSPACES_DIR } from './types.js';

// ─── extractRepoName tests ──────────────────────────────────────────────────

describe('extractRepoName', () => {
  it('extracts name from HTTPS URL with .git suffix', () => {
    expect(extractRepoName('https://github.com/user/bmad-orch.git')).toBe('bmad-orch');
  });

  it('extracts name from HTTPS URL without .git suffix', () => {
    expect(extractRepoName('https://github.com/user/bmad-orch')).toBe('bmad-orch');
  });

  it('extracts name from SSH URL with .git suffix', () => {
    expect(extractRepoName('git@github.com:user/repo.git')).toBe('repo');
  });

  it('extracts name from SSH URL without .git suffix', () => {
    expect(extractRepoName('git@github.com:user/repo')).toBe('repo');
  });

  it('handles trailing slashes in HTTPS URLs', () => {
    expect(extractRepoName('https://github.com/user/bmad-orch/')).toBe('bmad-orch');
  });

  it('handles nested paths in HTTPS URLs', () => {
    expect(extractRepoName('https://gitlab.com/org/sub/repo-name.git')).toBe('repo-name');
  });

  it('handles repos with dots in the name', () => {
    expect(extractRepoName('https://github.com/user/my.repo.name.git')).toBe('my.repo.name');
  });

  it('handles repos with hyphens and underscores', () => {
    expect(extractRepoName('https://github.com/user/my-repo_name.git')).toBe('my-repo_name');
  });

  it('extracts name from SSH URL with protocol', () => {
    expect(extractRepoName('ssh://git@github.com/user/repo.git')).toBe('repo');
  });

  it('throws for empty URL', () => {
    expect(() => extractRepoName('')).toThrow('Cannot extract repository name');
  });

  it('throws for URL that resolves to empty name', () => {
    expect(() => extractRepoName('https://github.com/.git')).toThrow(
      'Cannot extract repository name'
    );
  });
});

// ─── createInstance tests ───────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-create-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const gitCloneSuccess: ExecuteResult = { ok: true, stdout: '', stderr: '', exitCode: 0 };
const gitCloneFailure: ExecuteResult = {
  ok: false,
  stdout: '',
  stderr: 'fatal: repository not found',
  exitCode: 128,
};

/** Create a mock container lifecycle */
function createMockContainer(overrides: Partial<ContainerLifecycle> = {}): ContainerLifecycle {
  return {
    isDockerAvailable: vi.fn().mockResolvedValue(true),
    containerStatus: vi
      .fn()
      .mockResolvedValue({ ok: true, status: 'running', containerId: 'abc', error: null }),
    getContainerNameById: vi.fn().mockResolvedValue(null), // Default: no name discovery
    findContainerByWorkspaceLabel: vi.fn().mockResolvedValue(null), // Default: no existing container
    devcontainerUp: vi.fn().mockResolvedValue({
      ok: true,
      status: 'running',
      containerId: 'container-123',
      error: null,
    }),
    dockerPull: vi.fn().mockResolvedValue({ ok: true }),
    containerStop: vi.fn().mockResolvedValue({ ok: true }),
    containerRemove: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

/**
 * Create a mock stat function that:
 * - Returns real stat for the baseline config path (so copyBaselineConfig can verify it exists)
 * - Returns custom behavior for devcontainer detection in workspace paths
 */
function createDevcontainerStatMock(hasExistingDevcontainer: boolean) {
  const baselinePath = getBaselineConfigPath();
  return vi.fn().mockImplementation(async (path: string) => {
    // Allow baseline config path to use real stat
    if (path.startsWith(baselinePath) || path === baselinePath) {
      return stat(path);
    }
    // For workspace paths (.devcontainer checks)
    if (hasExistingDevcontainer) {
      return { isDirectory: () => true, isFile: () => false };
    }
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  });
}

/**
 * Create test deps with a mock executor that simulates git clone
 * by creating the target directory on success.
 */
function createTestDeps(
  cloneResult: ExecuteResult,
  containerOverrides: Partial<ContainerLifecycle> = {},
  hasExistingDevcontainer = false
): CreateInstanceDeps {
  const executor = vi
    .fn()
    .mockImplementation(async (command: string, args: string[] = []): Promise<ExecuteResult> => {
      if (command === 'git' && args[0] === 'clone') {
        if (cloneResult.ok) {
          // Simulate successful clone by creating target directory
          const targetDir = args[2];
          if (targetDir) {
            await mkdir(targetDir, { recursive: true });
          }
        }
        return cloneResult;
      }
      return { ok: false, stdout: '', stderr: `command not found: ${command}`, exitCode: 127 };
    });

  // Mock readFile to return a valid devcontainer.json for patchContainerName
  const devcontainerReadFile = vi.fn().mockResolvedValue('{}') as unknown as typeof readFile;
  const devcontainerWriteFile = vi.fn().mockResolvedValue(undefined) as unknown as typeof writeFile;

  return {
    executor,
    container: createMockContainer(containerOverrides),
    workspaceFsDeps: {
      mkdir,
      readdir: vi.fn() as unknown as typeof import('node:fs/promises').readdir,
      stat,
      homedir: () => tempDir,
    },
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    devcontainerFsDeps: {
      cp: vi.fn().mockResolvedValue(undefined),
      mkdir,
      readFile: devcontainerReadFile,
      stat: createDevcontainerStatMock(hasExistingDevcontainer),
      writeFile: devcontainerWriteFile,
    },
    rm,
    logger: {
      warn: vi.fn(),
      info: vi.fn(),
    },
  };
}

describe('createInstance', () => {
  it('creates instance successfully with HTTPS URL', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    expect(result.workspacePath).not.toBeNull();
    expect(result.workspacePath.name).toBe('bmad-orch-auth');
    expect(result.containerName).toBe('ae-bmad-orch-auth');
  });

  it('creates instance successfully with SSH URL', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    const result = await createInstance('feature', 'git@github.com:user/repo.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    expect(result.workspacePath.name).toBe('repo-feature');
    expect(result.containerName).toBe('ae-repo-feature');
  });

  it('calls git clone with correct arguments and timeout', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(deps.executor).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['clone', 'https://github.com/user/bmad-orch.git']),
      expect.objectContaining({ timeout: 120_000 })
    );
  });

  it('calls devcontainerUp after successful clone with AGENT_INSTANCE and AGENT_ENV_PURPOSE', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps, {
      purpose: 'JWT authentication',
    });

    expect(deps.container.devcontainerUp).toHaveBeenCalledWith(
      expect.stringContaining('bmad-orch-auth'),
      'ae-bmad-orch-auth',
      expect.objectContaining({
        remoteEnv: {
          AGENT_INSTANCE: 'bmad-orch-auth',
          AGENT_ENV_PURPOSE: 'JWT authentication',
        },
        configPath: expect.stringContaining(join('.agent-env', 'devcontainer.json')),
      })
    );
  });

  it('passes empty string AGENT_ENV_PURPOSE in devcontainerUp remoteEnv when no purpose', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(deps.container.devcontainerUp).toHaveBeenCalledWith(
      expect.stringContaining('bmad-orch-auth'),
      'ae-bmad-orch-auth',
      expect.objectContaining({
        remoteEnv: {
          AGENT_INSTANCE: 'bmad-orch-auth',
          AGENT_ENV_PURPOSE: '',
        },
      })
    );
  });

  it('writes state.json after successful create', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    const stateContent = await readFile(result.workspacePath.stateFile, 'utf-8');
    const state = JSON.parse(stateContent);
    expect(state.name).toBe('bmad-orch-auth');
    expect(state.repo).toBe('https://github.com/user/bmad-orch.git');
    expect(state.containerName).toBe('ae-bmad-orch-auth');
    expect(state.createdAt).toBeDefined();
  });

  it('returns INSTANCE_EXISTS when workspace already exists', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    // First create succeeds
    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    // Second create should fail with INSTANCE_EXISTS
    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');

    expect(result.error).not.toBeNull();
    expect(result.error.code).toBe('INSTANCE_EXISTS');
    expect(result.error.message).toContain("Instance 'auth' already exists");
  });

  it('returns GIT_ERROR when clone fails', async () => {
    const deps = createTestDeps(gitCloneFailure);

    const result = await createInstance('auth', 'https://github.com/user/nonexistent.git', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');

    expect(result.error.code).toBe('GIT_ERROR');
    expect(result.error.message).toContain('repository not found');
  });

  it('cleans up workspace on git clone failure', async () => {
    const deps = createTestDeps(gitCloneFailure);

    await createInstance('auth', 'https://github.com/user/nonexistent.git', deps);

    // Workspace should not exist after rollback
    const wsDir = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'nonexistent-auth');
    let exists = false;
    try {
      await stat(wsDir);
      exists = true;
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  it('returns WORKSPACE_ERROR and rolls back when .agent-env mkdir fails', async () => {
    const deps = createTestDeps(gitCloneSuccess);
    // Override mkdir to fail only for the workspace's .agent-env directory (exact path)
    const realMkdir = mkdir;
    const agentEnvPath = join(
      tempDir,
      AGENT_ENV_DIR,
      WORKSPACES_DIR,
      'bmad-orch-auth',
      AGENT_ENV_DIR
    );
    deps.workspaceFsDeps.mkdir = vi.fn().mockImplementation(async (path: string, opts?: object) => {
      if (path === agentEnvPath) {
        throw new Error('EACCES: permission denied');
      }
      return realMkdir(path, opts);
    }) as unknown as typeof mkdir;

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_ERROR');
    expect(result.error.message).toContain('.agent-env');
    expect(result.error.message).toContain('EACCES');

    // Workspace should not exist after rollback
    const wsDir = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'bmad-orch-auth');
    let exists = false;
    try {
      await stat(wsDir);
      exists = true;
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  it('returns WORKSPACE_ERROR when parent directory mkdir fails', async () => {
    const deps = createTestDeps(gitCloneSuccess);
    // Override mkdir to always fail (simulates permission denied on parent dirs)
    deps.workspaceFsDeps.mkdir = vi
      .fn()
      .mockRejectedValue(new Error('EACCES: permission denied')) as unknown as typeof mkdir;

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_ERROR');
    expect(result.error.message).toContain('workspace directory');
    expect(result.error.message).toContain('EACCES');
    expect(result.error.suggestion).toContain('~/.agent-env');
  });

  it('returns CONTAINER_ERROR when devcontainerUp fails', async () => {
    const deps = createTestDeps(gitCloneSuccess, {
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: false,
        status: 'not-found',
        containerId: null,
        error: { code: 'CONTAINER_ERROR', message: 'Build failed' },
      }),
    });

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
  });

  it('cleans up workspace on container startup failure', async () => {
    const deps = createTestDeps(gitCloneSuccess, {
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: false,
        status: 'not-found',
        containerId: null,
        error: { code: 'CONTAINER_ERROR', message: 'Build failed' },
      }),
    });

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    // Workspace should be cleaned up
    const wsDir = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'bmad-orch-auth');
    let exists = false;
    try {
      await stat(wsDir);
      exists = true;
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);

    // Logger should have been called
    expect(deps.logger?.warn).toHaveBeenCalledWith(expect.stringContaining('Rolling back'));
  });

  it('includes docker logs in returned error on startup failure', async () => {
    const deps = createTestDeps(gitCloneSuccess, {
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: false,
        status: 'not-found',
        containerId: null,
        error: { code: 'CONTAINER_ERROR', message: 'post-create failed' },
      }),
    });
    // Mock executor to return docker logs (stdout + stderr) when asked
    const originalExecutor = deps.executor;
    deps.executor = vi.fn().mockImplementation(async (command: string, args: string[] = []) => {
      if (command === 'docker' && args[0] === 'logs') {
        return {
          ok: true,
          stdout: '[1/12] Fixing SSH...',
          stderr: 'ERROR: step 6 failed',
          exitCode: 0,
        };
      }
      return originalExecutor(command, args);
    });

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    // Docker logs should be included in the returned error message
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain('docker logs');
    expect(result.error.message).toContain('[1/12] Fixing SSH');
    expect(result.error.message).toContain('ERROR: step 6 failed');
  });

  it('returns CONTAINER_EXISTS when a container already exists for workspace path', async () => {
    const deps = createTestDeps(gitCloneSuccess, {
      findContainerByWorkspaceLabel: vi.fn().mockResolvedValue('agenttools-bmad-orch-auth'),
    });

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_EXISTS');
    expect(result.error.message).toContain('agenttools-bmad-orch-auth');
    expect(result.error.suggestion).toContain('docker rm -f agenttools-bmad-orch-auth');
  });

  it('cleans up workspace when pre-flight container check finds conflict', async () => {
    const deps = createTestDeps(gitCloneSuccess, {
      findContainerByWorkspaceLabel: vi.fn().mockResolvedValue('stale-container'),
    });

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    // Workspace should be cleaned up
    const wsDir = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'bmad-orch-auth');
    let exists = false;
    try {
      await stat(wsDir);
      exists = true;
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  it('returns CONTAINER_ERROR with name conflict details when pre-flight passes but devcontainerUp hits name conflict', async () => {
    const deps = createTestDeps(gitCloneSuccess, {
      findContainerByWorkspaceLabel: vi.fn().mockResolvedValue(null),
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: false,
        status: 'not-found',
        containerId: null,
        error: {
          code: 'CONTAINER_ERROR',
          message: "devcontainer up failed for 'ae-bmad-orch-auth':\n   name is already in use",
          suggestion:
            'A container with this name already exists. Use `docker ps -a` to find it, then `docker rm -f <name>` to remove it and retry.',
        },
      }),
    });

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
    expect(result.error.message).toContain('name is already in use');
    expect(result.error.suggestion).toContain('docker ps -a');
  });

  it('proceeds normally when no existing container is found', async () => {
    const deps = createTestDeps(gitCloneSuccess, {
      findContainerByWorkspaceLabel: vi.fn().mockResolvedValue(null),
    });

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    expect(deps.container.devcontainerUp).toHaveBeenCalled();
  });

  it('returns GIT_ERROR for invalid URL', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    const result = await createInstance('auth', '', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');

    expect(result.error.code).toBe('GIT_ERROR');
    expect(result.error.message).toContain('Invalid repository URL');
  });

  it('copies baseline config when no devcontainer exists in cloned repo', async () => {
    const deps = createTestDeps(gitCloneSuccess, {}, false);

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(deps.devcontainerFsDeps.cp).toHaveBeenCalled();
  });

  it('skips baseline config copy and name patch when devcontainer already exists', async () => {
    const deps = createTestDeps(gitCloneSuccess, {}, true);

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    // Should not copy or patch since .devcontainer already exists
    expect(deps.devcontainerFsDeps.cp).not.toHaveBeenCalled();
    expect(deps.devcontainerFsDeps.readFile).not.toHaveBeenCalled();
    expect(deps.devcontainerFsDeps.writeFile).not.toHaveBeenCalled();
  });

  it('patches devcontainer.json with container name runArgs', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    // Should have read the devcontainer.json from .agent-env/ (baseline config dir)
    expect(deps.devcontainerFsDeps.readFile).toHaveBeenCalledWith(
      expect.stringContaining('.agent-env/devcontainer.json'),
      'utf-8'
    );

    // Should have written back with --name runArg
    expect(deps.devcontainerFsDeps.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.agent-env/devcontainer.json'),
      expect.stringContaining('"--name=ae-bmad-orch-auth"')
    );
  });

  it('discovers actual container name from Docker when repo has custom --name', async () => {
    const containerOverrides = {
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'container-abc123',
        error: null,
      }),
      // Simulate repo's devcontainer.json having --name=agenttools-*
      getContainerNameById: vi.fn().mockResolvedValue('agenttools-bmad-orch'),
    };

    // Use existing devcontainer (so we don't patch it)
    const deps = createTestDeps(gitCloneSuccess, containerOverrides, true);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    // The returned containerName should be the discovered one, not the derived ae-* one
    expect(result.containerName).toBe('agenttools-bmad-orch');
    // Should have called getContainerNameById with the containerId
    expect(deps.container.getContainerNameById).toHaveBeenCalledWith('container-abc123');
  });

  it('falls back to derived container name when discovery returns null', async () => {
    const containerOverrides = {
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'container-abc123',
        error: null,
      }),
      // Discovery fails or returns null
      getContainerNameById: vi.fn().mockResolvedValue(null),
    };

    const deps = createTestDeps(gitCloneSuccess, containerOverrides);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    // Falls back to derived name
    expect(result.containerName).toBe('ae-bmad-orch-auth');
  });

  it('writes discovered container name to state.json', async () => {
    const containerOverrides = {
      devcontainerUp: vi.fn().mockResolvedValue({
        ok: true,
        status: 'running',
        containerId: 'container-abc123',
        error: null,
      }),
      getContainerNameById: vi.fn().mockResolvedValue('custom-container-name'),
    };

    // Use existing devcontainer (so we don't patch it)
    const deps = createTestDeps(gitCloneSuccess, containerOverrides, true);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    // Verify state.json contains the discovered name, not the derived one
    const stateContent = await readFile(result.workspacePath.stateFile, 'utf-8');
    const state = JSON.parse(stateContent);
    expect(state.containerName).toBe('custom-container-name');
  });

  it('sets configSource to baseline when repo has no devcontainer config', async () => {
    const deps = createTestDeps(gitCloneSuccess, {}, false);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    const stateContent = await readFile(result.workspacePath.stateFile, 'utf-8');
    const state = JSON.parse(stateContent);
    expect(state.configSource).toBe('baseline');
  });

  it('sets configSource to repo when repo has its own devcontainer config', async () => {
    const deps = createTestDeps(gitCloneSuccess, {}, true);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    const stateContent = await readFile(result.workspacePath.stateFile, 'utf-8');
    const state = JSON.parse(stateContent);
    expect(state.configSource).toBe('repo');
  });

  it('adds .agent-env/ to .git/info/exclude after writing state', async () => {
    // Override the default executor to also create .git/info/exclude (simulating real git clone)
    const deps = createTestDeps(gitCloneSuccess);
    const originalExecutor = deps.executor;
    deps.executor = vi
      .fn()
      .mockImplementation(async (command: string, args: string[] = []): Promise<ExecuteResult> => {
        const result = await originalExecutor(command, args);
        if (command === 'git' && args[0] === 'clone' && result.ok) {
          const targetDir = args[2];
          if (targetDir) {
            const gitInfoDir = join(targetDir, '.git', 'info');
            await mkdir(gitInfoDir, { recursive: true });
            await writeFile(join(gitInfoDir, 'exclude'), '# git exclude\n');
          }
        }
        return result;
      });

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    // Verify .git/info/exclude contains .agent-env/
    const excludePath = join(result.workspacePath.root, '.git', 'info', 'exclude');
    const content = await readFile(excludePath, 'utf-8');
    expect(content).toContain('.agent-env/');
  });

  it('writes purpose to state.json when --purpose is provided', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps, {
      purpose: 'JWT authentication',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    const stateContent = await readFile(result.workspacePath.stateFile, 'utf-8');
    const state = JSON.parse(stateContent);
    expect(state.purpose).toBe('JWT authentication');
  });

  it('writes purpose as null to state.json when --purpose is not provided', async () => {
    const deps = createTestDeps(gitCloneSuccess);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');

    const stateContent = await readFile(result.workspacePath.stateFile, 'utf-8');
    const state = JSON.parse(stateContent);
    expect(state.purpose).toBeNull();
  });

  it('includes AGENT_ENV_PURPOSE in patchContainerEnv call for baseline config', async () => {
    const deps = createTestDeps(gitCloneSuccess, {}, false);

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps, {
      purpose: 'JWT authentication',
    });

    // patchContainerEnv is called via devcontainerFsDeps.writeFile
    // The second writeFile call (after patchContainerName) should contain AGENT_ENV_PURPOSE
    const writeFileCalls = (deps.devcontainerFsDeps.writeFile as ReturnType<typeof vi.fn>).mock
      .calls;
    // Find the call that contains AGENT_ENV_PURPOSE
    const envPatchCall = writeFileCalls.find(
      (call: unknown[]) =>
        typeof call[1] === 'string' && (call[1] as string).includes('AGENT_ENV_PURPOSE')
    );
    expect(envPatchCall).toBeDefined();
    const writtenContent = JSON.parse((envPatchCall as unknown[])[1] as string);
    expect(writtenContent.containerEnv.AGENT_ENV_PURPOSE).toBe('JWT authentication');
  });

  it('returns PURPOSE_TOO_LONG when purpose exceeds MAX_PURPOSE_LENGTH', async () => {
    const deps = createTestDeps(gitCloneSuccess);
    const tooLongPurpose = 'x'.repeat(201);

    const result = await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps, {
      purpose: tooLongPurpose,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('PURPOSE_TOO_LONG');
    expect(result.error.message).toContain('200');
    expect(result.error.message).toContain('201');
    // Should not have attempted clone
    expect(deps.executor).not.toHaveBeenCalled();
  });

  it('sets AGENT_ENV_PURPOSE to empty string in patchContainerEnv when no purpose', async () => {
    const deps = createTestDeps(gitCloneSuccess, {}, false);

    await createInstance('auth', 'https://github.com/user/bmad-orch.git', deps);

    const writeFileCalls = (deps.devcontainerFsDeps.writeFile as ReturnType<typeof vi.fn>).mock
      .calls;
    const envPatchCall = writeFileCalls.find(
      (call: unknown[]) =>
        typeof call[1] === 'string' && (call[1] as string).includes('AGENT_ENV_PURPOSE')
    );
    expect(envPatchCall).toBeDefined();
    const writtenContent = JSON.parse((envPatchCall as unknown[])[1] as string);
    expect(writtenContent.containerEnv.AGENT_ENV_PURPOSE).toBe('');
  });
});

// ─── resolveRepoUrl tests ───────────────────────────────────────────────────

describe('resolveRepoUrl', () => {
  it('returns the URL as-is when not "."', async () => {
    const executor = vi.fn();
    const result = await resolveRepoUrl('https://github.com/user/repo.git', executor);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.url).toBe('https://github.com/user/repo.git');
    expect(executor).not.toHaveBeenCalled();
  });

  it('resolves "." to the git remote origin URL', async () => {
    const executor = vi.fn().mockResolvedValue({
      ok: true,
      stdout: 'https://github.com/user/my-repo.git\n',
      stderr: '',
      exitCode: 0,
    } satisfies ExecuteResult);

    const result = await resolveRepoUrl('.', executor);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.url).toBe('https://github.com/user/my-repo.git');
    expect(executor).toHaveBeenCalledWith('git', ['remote', 'get-url', 'origin']);
  });

  it('resolves "." with SSH remote URL', async () => {
    const executor = vi.fn().mockResolvedValue({
      ok: true,
      stdout: 'git@github.com:user/my-repo.git\n',
      stderr: '',
      exitCode: 0,
    } satisfies ExecuteResult);

    const result = await resolveRepoUrl('.', executor);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.url).toBe('git@github.com:user/my-repo.git');
  });

  it('returns GIT_ERROR when no git remote found', async () => {
    const executor = vi.fn().mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'fatal: not a git repository',
      exitCode: 128,
    } satisfies ExecuteResult);

    const result = await resolveRepoUrl('.', executor);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('GIT_ERROR');
    expect(result.error.message).toContain('No git remote found');
  });

  it('returns GIT_ERROR when remote URL is empty', async () => {
    const executor = vi.fn().mockResolvedValue({
      ok: true,
      stdout: '  \n',
      stderr: '',
      exitCode: 0,
    } satisfies ExecuteResult);

    const result = await resolveRepoUrl('.', executor);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('GIT_ERROR');
    expect(result.error.message).toContain('No git remote found');
  });
});

// ─── attachToInstance tests ─────────────────────────────────────────────────

describe('attachToInstance', () => {
  it('calls docker exec with correct container name and tmux command', async () => {
    const executor = vi.fn().mockResolvedValue({
      ok: true,
      stdout: '',
      stderr: '',
      exitCode: 0,
    } satisfies ExecuteResult);

    const result = await attachToInstance('ae-bmad-orch-auth', executor);

    expect(result.ok).toBe(true);
    expect(executor).toHaveBeenCalledWith(
      'docker',
      [
        'exec',
        '-it',
        'ae-bmad-orch-auth',
        'bash',
        '-c',
        'tmux attach-session -t main 2>/dev/null || tmux new-session -s main',
      ],
      { stdio: 'inherit' }
    );
  });

  it('returns CONTAINER_ERROR when docker exec fails', async () => {
    const executor = vi.fn().mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'Error: No such container',
      exitCode: 1,
    } satisfies ExecuteResult);

    const result = await attachToInstance('ae-nonexistent', executor);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
    expect(result.error.message).toContain('ae-nonexistent');
    expect(result.error.suggestion).toContain('Ensure the container is running');
  });

  it('returns tmux-specific error when tmux is not found', async () => {
    const executor = vi.fn().mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'bash: tmux: command not found',
      exitCode: 127,
    } satisfies ExecuteResult);

    const result = await attachToInstance('ae-bmad-orch-auth', executor);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
    expect(result.error.message).toContain('tmux is not available');
    expect(result.error.suggestion).toContain('tmux is installed');
  });
});
