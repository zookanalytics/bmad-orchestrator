import type { ExecuteResult } from '@zookanalytics/shared';

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type {
  ContainerLifecycle,
  ContainerRemoveResult,
  ContainerStopResult,
} from './container.js';
import type { GitStateDetector } from './git.js';
import type { RemoveInstanceDeps } from './remove-instance.js';
import type { GitState, InstanceState } from './types.js';

import { evaluateSafetyChecks, removeInstance } from './remove-instance.js';
import { AGENT_ENV_DIR, STATE_FILE, WORKSPACES_DIR } from './types.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-remove-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function createCleanGitState(): GitState {
  return {
    hasStaged: false,
    stagedCount: 0,
    hasUnstaged: false,
    unstagedCount: 0,
    hasUntracked: false,
    untrackedCount: 0,
    stashCount: 0,
    firstStashMessage: '',
    unpushedBranches: [],
    unpushedCommitCounts: {},
    neverPushedBranches: [],
    isDetachedHead: false,
    isClean: true,
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
    devcontainerUp: vi.fn().mockResolvedValue({
      ok: true,
      status: 'running',
      containerId: 'abc123',
    }),
    containerStop: vi.fn().mockResolvedValue({ ok: true } satisfies ContainerStopResult),
    containerRemove: vi.fn().mockResolvedValue({ ok: true } satisfies ContainerRemoveResult),
    ...overrides,
  };
}

function createMockGitDetector(gitState?: Partial<GitState>): GitStateDetector {
  const state = { ...createCleanGitState(), ...gitState };
  // Ensure counts are consistent with booleans when overrides only set booleans
  if (state.hasStaged && state.stagedCount === 0) state.stagedCount = 1;
  if (state.hasUnstaged && state.unstagedCount === 0) state.unstagedCount = 1;
  if (state.hasUntracked && state.untrackedCount === 0) state.untrackedCount = 1;
  // Recompute isClean based on actual field values
  state.isClean =
    !state.hasStaged &&
    !state.hasUnstaged &&
    !state.hasUntracked &&
    state.stashCount === 0 &&
    state.unpushedBranches.length === 0 &&
    state.neverPushedBranches.length === 0 &&
    !state.isDetachedHead;

  return {
    getGitState: vi.fn().mockResolvedValue({ ok: true, state }),
  };
}

function createTestDeps(overrides: Partial<RemoveInstanceDeps> = {}): RemoveInstanceDeps {
  const executor = vi.fn().mockResolvedValue({
    ok: true,
    stdout: '',
    stderr: '',
    exitCode: 0,
  } satisfies ExecuteResult);

  return {
    executor,
    container: createMockContainer(),
    gitDetector: createMockGitDetector(),
    workspaceFsDeps: {
      mkdir,
      readdir,
      stat,
      homedir: () => tempDir,
    },
    stateFsDeps: { readFile },
    deleteFsDeps: { rm },
    ...overrides,
  };
}

// ─── evaluateSafetyChecks tests ──────────────────────────────────────────────

describe('evaluateSafetyChecks', () => {
  it('returns empty array for clean state', () => {
    const blockers = evaluateSafetyChecks(createCleanGitState());
    expect(blockers).toEqual([]);
  });

  it('detects staged changes', () => {
    const blockers = evaluateSafetyChecks({
      ...createCleanGitState(),
      hasStaged: true,
      stagedCount: 1,
    });
    expect(blockers).toContain('1 staged file detected');
  });

  it('detects unstaged changes', () => {
    const blockers = evaluateSafetyChecks({
      ...createCleanGitState(),
      hasUnstaged: true,
      unstagedCount: 1,
    });
    expect(blockers).toContain('1 unstaged change detected');
  });

  it('detects untracked files', () => {
    const blockers = evaluateSafetyChecks({
      ...createCleanGitState(),
      hasUntracked: true,
      untrackedCount: 1,
    });
    expect(blockers).toContain('1 untracked file detected');
  });

  it('detects stashed changes with count', () => {
    const blockers = evaluateSafetyChecks({ ...createCleanGitState(), stashCount: 3 });
    expect(blockers).toContain('stashed changes detected (3 stashes)');
  });

  it('uses singular "stash" for count of 1', () => {
    const blockers = evaluateSafetyChecks({ ...createCleanGitState(), stashCount: 1 });
    expect(blockers).toContain('stashed changes detected (1 stash)');
  });

  it('detects unpushed branches', () => {
    const blockers = evaluateSafetyChecks({
      ...createCleanGitState(),
      unpushedBranches: ['feature-x', 'bugfix-y'],
    });
    expect(blockers).toContain('unpushed commits on branches: feature-x, bugfix-y');
  });

  it('detects never-pushed branches', () => {
    const blockers = evaluateSafetyChecks({
      ...createCleanGitState(),
      neverPushedBranches: ['new-feature'],
    });
    expect(blockers).toContain('branches never pushed: new-feature');
  });

  it('detects detached HEAD', () => {
    const blockers = evaluateSafetyChecks({ ...createCleanGitState(), isDetachedHead: true });
    expect(blockers).toContain('detached HEAD state (investigate manually)');
  });

  it('detects multiple issues simultaneously', () => {
    const blockers = evaluateSafetyChecks({
      ...createCleanGitState(),
      hasStaged: true,
      stagedCount: 2,
      hasUntracked: true,
      untrackedCount: 3,
      unpushedBranches: ['main'],
    });
    expect(blockers).toHaveLength(3);
    expect(blockers).toContain('2 staged files detected');
    expect(blockers).toContain('3 untracked files detected');
    expect(blockers).toContain('unpushed commits on branches: main');
  });
});

// ─── removeInstance tests ────────────────────────────────────────────────────

describe('removeInstance', () => {
  it('removes a clean instance successfully', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(true);
  });

  it('stops container before deletion', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await removeInstance('auth', deps);

    expect(mockContainer.containerStop).toHaveBeenCalledWith('ae-repo-auth');
  });

  it('removes container after stopping', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer();
    const deps = createTestDeps({ container: mockContainer });

    await removeInstance('auth', deps);

    expect(mockContainer.containerRemove).toHaveBeenCalledWith('ae-repo-auth');
  });

  it('deletes workspace folder after container removal', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await removeInstance('auth', deps);

    // Verify workspace folder no longer exists
    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    await expect(stat(wsRoot)).rejects.toThrow();
  });

  it('calls operations in correct order: safety → stop → remove container → delete workspace', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);

    const callOrder: string[] = [];
    const mockGitDetector: GitStateDetector = {
      getGitState: vi.fn().mockImplementation(async () => {
        callOrder.push('safety_check');
        return { ok: true, state: createCleanGitState() };
      }),
    };
    const mockContainer = createMockContainer({
      containerStop: vi.fn().mockImplementation(async () => {
        callOrder.push('container_stop');
        return { ok: true };
      }),
      containerRemove: vi.fn().mockImplementation(async () => {
        callOrder.push('container_remove');
        return { ok: true };
      }),
    });
    const mockRm = vi.fn().mockImplementation(async () => {
      callOrder.push('delete_workspace');
    });

    const deps = createTestDeps({
      container: mockContainer,
      gitDetector: mockGitDetector,
      deleteFsDeps: { rm: mockRm },
    });

    await removeInstance('auth', deps);

    expect(callOrder).toEqual([
      'safety_check',
      'container_stop',
      'container_remove',
      'delete_workspace',
    ]);
  });

  // ─── Safety check blocker tests ────────────────────────────────────────────

  it('blocks removal when staged changes detected', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ hasStaged: true }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('SAFETY_CHECK_FAILED');
    expect(result.error.message).toBe('Safety checks failed');
  });

  it('blocks removal when unstaged changes detected', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ hasUnstaged: true }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('SAFETY_CHECK_FAILED');
    expect(result.error.message).toBe('Safety checks failed');
    expect(result.blockers).toContain('1 unstaged change detected');
  });

  it('blocks removal when untracked files detected', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ hasUntracked: true }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('SAFETY_CHECK_FAILED');
    expect(result.error.message).toBe('Safety checks failed');
    expect(result.blockers).toContain('1 untracked file detected');
  });

  it('blocks removal when stashed changes detected', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ stashCount: 2 }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('SAFETY_CHECK_FAILED');
    expect(result.error.message).toBe('Safety checks failed');
    expect(result.blockers).toContain('stashed changes detected (2 stashes)');
  });

  it('blocks removal when unpushed commits on any branch', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ unpushedBranches: ['feature-x', 'bugfix-y'] }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('SAFETY_CHECK_FAILED');
    expect(result.error.message).toBe('Safety checks failed');
    expect(result.blockers).toContain('unpushed commits on branches: feature-x, bugfix-y');
  });

  it('blocks removal when never-pushed branches exist', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ neverPushedBranches: ['new-feature'] }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('SAFETY_CHECK_FAILED');
    expect(result.error.message).toBe('Safety checks failed');
    expect(result.blockers).toContain('branches never pushed: new-feature');
  });

  it('blocks removal when detached HEAD detected', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ isDetachedHead: true }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('SAFETY_CHECK_FAILED');
    expect(result.error.message).toBe('Safety checks failed');
    expect(result.blockers).toContain('detached HEAD state (investigate manually)');
  });

  it('includes suggestion to use --force when safety check fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ hasStaged: true }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.suggestion).toContain('--force');
  });

  it('returns gitState and blockers on safety check failure', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ hasStaged: true, unpushedBranches: ['feature-x'] }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('SAFETY_CHECK_FAILED');
    expect(result.gitState).toBeDefined();
    expect(result.gitState?.hasStaged).toBe(true);
    expect(result.gitState?.unpushedBranches).toEqual(['feature-x']);
    expect(result.blockers).toBeDefined();
    expect(result.blockers).toContain('1 staged file detected');
    expect(result.blockers).toContain('unpushed commits on branches: feature-x');
  });

  it('does not include gitState on non-safety errors', async () => {
    const deps = createTestDeps();

    const result = await removeInstance('nonexistent', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect(result.gitState).toBeUndefined();
    expect(result.blockers).toBeUndefined();
  });

  it('does not stop or remove container when safety check fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockContainer = createMockContainer();
    const deps = createTestDeps({
      container: mockContainer,
      gitDetector: createMockGitDetector({ hasStaged: true }),
    });

    await removeInstance('auth', deps);

    expect(mockContainer.containerStop).not.toHaveBeenCalled();
    expect(mockContainer.containerRemove).not.toHaveBeenCalled();
  });

  // ─── Force bypass tests ────────────────────────────────────────────────────

  it('bypasses safety checks when force=true but still detects git state', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockGitDetector = createMockGitDetector({ hasStaged: true, hasUnstaged: true });
    const deps = createTestDeps({ gitDetector: mockGitDetector });

    const result = await removeInstance('auth', deps, true);

    expect(result.ok).toBe(true);
    // Git state IS detected (for audit log and warning display) but doesn't block
    expect(mockGitDetector.getGitState).toHaveBeenCalled();
  });

  it('returns forced=true, gitState, and blockers on successful force removal', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector({ hasStaged: true, neverPushedBranches: ['feature'] }),
    });

    const result = await removeInstance('auth', deps, true);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.forced).toBe(true);
    expect(result.gitState).toBeDefined();
    expect(result.gitState?.hasStaged).toBe(true);
    expect(result.gitState?.neverPushedBranches).toEqual(['feature']);
    expect(result.blockers).toContain('1 staged file detected');
    expect(result.blockers).toContain('branches never pushed: feature');
  });

  it('returns forced=true with no blockers when force-removing clean instance', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      gitDetector: createMockGitDetector(), // clean state
    });

    const result = await removeInstance('auth', deps, true);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.forced).toBe(true);
    expect(result.gitState?.isClean).toBe(true);
    expect(result.blockers).toBeUndefined();
  });

  it('proceeds with force removal even when git detection fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockGitDetector: GitStateDetector = {
      getGitState: vi.fn().mockResolvedValue({
        ok: false,
        state: null,
        error: { code: 'GIT_ERROR', message: 'not a git repository' },
      }),
    };
    const deps = createTestDeps({ gitDetector: mockGitDetector });

    const result = await removeInstance('auth', deps, true);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.forced).toBe(true);
    expect(result.gitState).toBeUndefined();
  });

  it('still checks Docker availability when force=true', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      container: createMockContainer({
        isDockerAvailable: vi.fn().mockResolvedValue(false),
      }),
    });

    const result = await removeInstance('auth', deps, true);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('ORBSTACK_REQUIRED');
  });

  // ─── Error handling tests ──────────────────────────────────────────────────

  it('returns WORKSPACE_NOT_FOUND when instance does not exist', async () => {
    const deps = createTestDeps();

    const result = await removeInstance('nonexistent', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect(result.error.message).toContain("Instance 'nonexistent' not found");
  });

  it('returns AMBIGUOUS_MATCH when multiple workspaces match', async () => {
    await createTestWorkspace('repo1-auth', createTestState('repo1-auth'));
    await createTestWorkspace('repo2-auth', createTestState('repo2-auth'));
    const deps = createTestDeps();

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('AMBIGUOUS_MATCH');
    expect(result.error.message).toContain('repo1-auth');
    expect(result.error.message).toContain('repo2-auth');
  });

  it('returns ORBSTACK_REQUIRED when Docker is not available', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps({
      container: createMockContainer({
        isDockerAvailable: vi.fn().mockResolvedValue(false),
      }),
    });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('ORBSTACK_REQUIRED');
  });

  it('returns GIT_ERROR when git state detection fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockGitDetector: GitStateDetector = {
      getGitState: vi.fn().mockResolvedValue({
        ok: false,
        state: null,
        error: { code: 'GIT_ERROR', message: 'not a git repository' },
      }),
    };
    const deps = createTestDeps({ gitDetector: mockGitDetector });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('GIT_ERROR');
    expect(result.error.message).toContain('not a git repository');
  });

  it('returns error when container stop fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
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

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_STOP_TIMEOUT');
    expect(result.error.suggestion).toContain('docker rm -f');
  });

  it('returns error when container remove fails', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
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

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
  });

  it('returns WORKSPACE_DELETE_FAILED when workspace deletion throws', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const mockRm = vi.fn().mockRejectedValue(new Error('EACCES: permission denied'));
    const deps = createTestDeps({ deleteFsDeps: { rm: mockRm as unknown as typeof rm } });

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_DELETE_FAILED');
    expect(result.error.message).toContain('EACCES');
    expect(result.error.suggestion).toContain('Remove manually');
  });

  it('finds workspace by exact name', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const result = await removeInstance('repo-auth', deps);

    expect(result.ok).toBe(true);
  });

  it('finds workspace by suffix match', async () => {
    const state = createTestState('bmad-orch-auth');
    await createTestWorkspace('bmad-orch-auth', state);
    const deps = createTestDeps();

    const result = await removeInstance('auth', deps);

    expect(result.ok).toBe(true);
  });
});
