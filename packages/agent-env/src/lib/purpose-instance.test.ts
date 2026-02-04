import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import type { PurposeInstanceDeps } from './purpose-instance.js';
import type { InstanceState } from './types.js';

import { getPurpose, setPurpose } from './purpose-instance.js';
import { AGENT_ENV_DIR, STATE_FILE, WORKSPACES_DIR } from './types.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-purpose-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function createTestDeps(): PurposeInstanceDeps {
  return {
    workspaceFsDeps: {
      mkdir,
      readdir,
      stat,
      homedir: () => tempDir,
    },
    stateFsDeps: { readFile, writeFile, rename, mkdir },
  };
}

// ─── getPurpose tests ────────────────────────────────────────────────────────

describe('getPurpose', () => {
  it('returns existing purpose for an instance', async () => {
    const state = createTestState('repo-auth', { purpose: 'Authentication feature' });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const result = await getPurpose('auth', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.purpose).toBe('Authentication feature');
  });

  it('returns null when no purpose is set', async () => {
    const state = createTestState('repo-auth', { purpose: null });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const result = await getPurpose('auth', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.purpose).toBeNull();
  });

  it('finds workspace by exact name match', async () => {
    const state = createTestState('repo-auth', { purpose: 'Testing exact match' });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const result = await getPurpose('repo-auth', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.purpose).toBe('Testing exact match');
  });

  it('returns WORKSPACE_NOT_FOUND when instance does not exist', async () => {
    const deps = createTestDeps();

    const result = await getPurpose('nonexistent', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect(result.error.message).toContain("Instance 'nonexistent' not found");
  });

  it('returns AMBIGUOUS_MATCH when multiple workspaces match', async () => {
    await createTestWorkspace('repo1-auth', createTestState('repo1-auth'));
    await createTestWorkspace('repo2-auth', createTestState('repo2-auth'));
    const deps = createTestDeps();

    const result = await getPurpose('auth', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('AMBIGUOUS_MATCH');
    expect(result.error.message).toContain('repo1-auth');
    expect(result.error.message).toContain('repo2-auth');
  });
});

// ─── setPurpose tests ────────────────────────────────────────────────────────

describe('setPurpose', () => {
  it('sets purpose and writes to state.json', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const result = await setPurpose('auth', 'OAuth implementation', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.cleared).toBe(false);

    // Verify state file was updated
    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const stateFile = join(wsRoot, AGENT_ENV_DIR, STATE_FILE);
    const content = await readFile(stateFile, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;
    expect(updatedState.purpose).toBe('OAuth implementation');
  });

  it('clears purpose when empty string is provided', async () => {
    const state = createTestState('repo-auth', { purpose: 'Old purpose' });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const result = await setPurpose('auth', '', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.cleared).toBe(true);

    // Verify state file was updated
    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const stateFile = join(wsRoot, AGENT_ENV_DIR, STATE_FILE);
    const content = await readFile(stateFile, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;
    expect(updatedState.purpose).toBeNull();
  });

  it('preserves other state fields when updating purpose', async () => {
    const state = createTestState('repo-auth', {
      repo: 'https://github.com/user/special.git',
      lastAttached: '2026-01-25T10:00:00.000Z',
      createdAt: '2026-01-10T08:00:00.000Z',
    });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await setPurpose('auth', 'New purpose', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const stateFile = join(wsRoot, AGENT_ENV_DIR, STATE_FILE);
    const content = await readFile(stateFile, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;

    expect(updatedState.purpose).toBe('New purpose');
    expect(updatedState.repo).toBe('https://github.com/user/special.git');
    expect(updatedState.lastAttached).toBe('2026-01-25T10:00:00.000Z');
    expect(updatedState.createdAt).toBe('2026-01-10T08:00:00.000Z');
    expect(updatedState.name).toBe('repo-auth');
    expect(updatedState.containerName).toBe('ae-repo-auth');
  });

  it('returns WORKSPACE_NOT_FOUND when instance does not exist', async () => {
    const deps = createTestDeps();

    const result = await setPurpose('nonexistent', 'some purpose', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect(result.error.message).toContain("Instance 'nonexistent' not found");
  });

  it('returns AMBIGUOUS_MATCH when multiple workspaces match', async () => {
    await createTestWorkspace('repo1-auth', createTestState('repo1-auth'));
    await createTestWorkspace('repo2-auth', createTestState('repo2-auth'));
    const deps = createTestDeps();

    const result = await setPurpose('auth', 'some purpose', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('AMBIGUOUS_MATCH');
  });

  it('overwrites existing purpose with new value', async () => {
    const state = createTestState('repo-auth', { purpose: 'Old purpose' });
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    await setPurpose('auth', 'New purpose', deps);

    const wsRoot = join(tempDir, AGENT_ENV_DIR, WORKSPACES_DIR, 'repo-auth');
    const stateFile = join(wsRoot, AGENT_ENV_DIR, STATE_FILE);
    const content = await readFile(stateFile, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;
    expect(updatedState.purpose).toBe('New purpose');
  });
});
