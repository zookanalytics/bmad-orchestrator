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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import type { ContainerPurposeDeps, PurposeInstanceDeps } from './purpose-instance.js';
import type { InstanceState } from './types.js';

import {
  getContainerPurpose,
  getPurpose,
  setContainerPurpose,
  setPurpose,
} from './purpose-instance.js';
import { AGENT_ENV_DIR, STATE_FILE, STATE_FILE_TMP, WORKSPACES_DIR } from './types.js';

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
    instance: workspaceName,
    repoSlug: 'repo',
    repoUrl: 'https://github.com/user/repo.git',
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
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
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
      repoUrl: 'https://github.com/user/special.git',
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
    expect(updatedState.repoUrl).toBe('https://github.com/user/special.git');
    expect(updatedState.lastAttached).toBe('2026-01-25T10:00:00.000Z');
    expect(updatedState.createdAt).toBe('2026-01-10T08:00:00.000Z');
    expect(updatedState.instance).toBe('repo-auth');
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

  it('accepts a purpose at exactly MAX_PURPOSE_LENGTH characters', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const exactLengthPurpose = 'x'.repeat(200);
    const result = await setPurpose('auth', exactLengthPurpose, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.cleared).toBe(false);
  });

  it('returns PURPOSE_TOO_LONG when purpose exceeds MAX_PURPOSE_LENGTH', async () => {
    const state = createTestState('repo-auth');
    await createTestWorkspace('repo-auth', state);
    const deps = createTestDeps();

    const tooLongPurpose = 'x'.repeat(201);
    const result = await setPurpose('auth', tooLongPurpose, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('PURPOSE_TOO_LONG');
    expect(result.error.message).toContain('200');
    expect(result.error.message).toContain('201');
  });
});

// ─── Container-mode helpers ─────────────────────────────────────────────────

/** Create a state.json file at a given path */
async function createContainerStateFile(stateDir: string, state: InstanceState): Promise<string> {
  await mkdir(stateDir, { recursive: true });
  const statePath = join(stateDir, STATE_FILE);
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
  return statePath;
}

function createContainerDeps(stateDir: string, statePath: string): ContainerPurposeDeps {
  return {
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    containerEnvDeps: {
      getEnv: (key: string) => (key === 'AGENT_ENV_CONTAINER' ? 'true' : undefined),
    },
    statePath,
    agentEnvDir: stateDir,
  };
}

// ─── getContainerPurpose tests ──────────────────────────────────────────────

describe('getContainerPurpose', () => {
  it('returns purpose from container state.json', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const state = createTestState('repo-auth', { purpose: 'JWT auth work' });
    const statePath = await createContainerStateFile(stateDir, state);
    const deps = createContainerDeps(stateDir, statePath);

    const result = await getContainerPurpose(deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.purpose).toBe('JWT auth work');
  });

  it('returns null when purpose is not set in container state.json', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const state = createTestState('repo-auth', { purpose: null });
    const statePath = await createContainerStateFile(stateDir, state);
    const deps = createContainerDeps(stateDir, statePath);

    const result = await getContainerPurpose(deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.purpose).toBeNull();
  });

  it('returns null when purpose field is absent from JSON', async () => {
    const stateDir = join(tempDir, 'agent-env');
    await mkdir(stateDir, { recursive: true });
    const statePath = join(stateDir, STATE_FILE);
    // Write state JSON without the purpose field
    const stateWithoutPurpose = {
      instance: 'repo-auth',
      repoSlug: 'repo',
      repoUrl: 'https://github.com/user/repo.git',
      createdAt: '2026-01-15T10:00:00.000Z',
      lastAttached: '2026-01-20T14:00:00.000Z',
      containerName: 'ae-repo-auth',
    };
    await writeFile(statePath, JSON.stringify(stateWithoutPurpose, null, 2), 'utf-8');
    const deps = createContainerDeps(stateDir, statePath);

    const result = await getContainerPurpose(deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.purpose).toBeNull();
  });

  it('returns STATE_NOT_FOUND when state.json does not exist', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const statePath = join(stateDir, STATE_FILE);
    const deps = createContainerDeps(stateDir, statePath);

    const result = await getContainerPurpose(deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('STATE_NOT_FOUND');
  });

  it('returns STATE_CORRUPT when state.json contains invalid JSON', async () => {
    const stateDir = join(tempDir, 'agent-env');
    await mkdir(stateDir, { recursive: true });
    const statePath = join(stateDir, STATE_FILE);
    await writeFile(statePath, 'not valid json{{{', 'utf-8');
    const deps = createContainerDeps(stateDir, statePath);

    const result = await getContainerPurpose(deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('STATE_CORRUPT');
  });
});

// ─── setContainerPurpose tests ──────────────────────────────────────────────

describe('setContainerPurpose', () => {
  it('sets purpose in container state.json', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const state = createTestState('repo-auth');
    const statePath = await createContainerStateFile(stateDir, state);
    const deps = createContainerDeps(stateDir, statePath);

    const result = await setContainerPurpose('OAuth implementation', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.cleared).toBe(false);

    // Verify state file was updated
    const content = await readFile(statePath, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;
    expect(updatedState.purpose).toBe('OAuth implementation');
  });

  it('clears purpose when empty string is provided', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const state = createTestState('repo-auth', { purpose: 'Old purpose' });
    const statePath = await createContainerStateFile(stateDir, state);
    const deps = createContainerDeps(stateDir, statePath);

    const result = await setContainerPurpose('', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.cleared).toBe(true);

    const content = await readFile(statePath, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;
    expect(updatedState.purpose).toBeNull();
  });

  it('preserves other state fields when updating purpose', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const state = createTestState('repo-auth', {
      repoUrl: 'https://github.com/user/special.git',
      lastAttached: '2026-01-25T10:00:00.000Z',
    });
    const statePath = await createContainerStateFile(stateDir, state);
    const deps = createContainerDeps(stateDir, statePath);

    await setContainerPurpose('New purpose', deps);

    const content = await readFile(statePath, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;
    expect(updatedState.purpose).toBe('New purpose');
    expect(updatedState.repoUrl).toBe('https://github.com/user/special.git');
    expect(updatedState.lastAttached).toBe('2026-01-25T10:00:00.000Z');
    expect(updatedState.instance).toBe('repo-auth');
  });

  it('uses atomic write (tmp + rename) pattern', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const state = createTestState('repo-auth');
    const statePath = await createContainerStateFile(stateDir, state);

    // Track rename calls to verify atomic write pattern
    let renameCalled = false;
    const trackingDeps: ContainerPurposeDeps = {
      stateFsDeps: {
        readFile,
        writeFile,
        rename: async (oldPath, newPath) => {
          renameCalled = true;
          // Verify tmp file is used
          expect(String(oldPath)).toContain(STATE_FILE_TMP);
          return rename(oldPath, newPath);
        },
        mkdir,
        appendFile,
      },
      containerEnvDeps: { getEnv: () => 'true' },
      statePath,
      agentEnvDir: stateDir,
    };

    await setContainerPurpose('Test purpose', trackingDeps);
    expect(renameCalled).toBe(true);
  });

  it('returns STATE_NOT_FOUND when state.json does not exist', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const statePath = join(stateDir, STATE_FILE);
    const deps = createContainerDeps(stateDir, statePath);

    const result = await setContainerPurpose('some purpose', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('STATE_NOT_FOUND');
  });

  it('returns STATE_CORRUPT when state.json contains invalid JSON', async () => {
    const stateDir = join(tempDir, 'agent-env');
    await mkdir(stateDir, { recursive: true });
    const statePath = join(stateDir, STATE_FILE);
    await writeFile(statePath, '{invalid json', 'utf-8');
    const deps = createContainerDeps(stateDir, statePath);

    const result = await setContainerPurpose('some purpose', deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('STATE_CORRUPT');
  });

  it('overwrites existing purpose with new value', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const state = createTestState('repo-auth', { purpose: 'Old purpose' });
    const statePath = await createContainerStateFile(stateDir, state);
    const deps = createContainerDeps(stateDir, statePath);

    await setContainerPurpose('New purpose', deps);

    const content = await readFile(statePath, 'utf-8');
    const updatedState = JSON.parse(content) as InstanceState;
    expect(updatedState.purpose).toBe('New purpose');
  });

  it('accepts a purpose at exactly MAX_PURPOSE_LENGTH characters', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const state = createTestState('repo-auth');
    const statePath = await createContainerStateFile(stateDir, state);
    const deps = createContainerDeps(stateDir, statePath);

    const exactLengthPurpose = 'x'.repeat(200);
    const result = await setContainerPurpose(exactLengthPurpose, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.cleared).toBe(false);
  });

  it('returns PURPOSE_TOO_LONG when purpose exceeds MAX_PURPOSE_LENGTH', async () => {
    const stateDir = join(tempDir, 'agent-env');
    const state = createTestState('repo-auth');
    const statePath = await createContainerStateFile(stateDir, state);
    const deps = createContainerDeps(stateDir, statePath);

    const tooLongPurpose = 'x'.repeat(201);
    const result = await setContainerPurpose(tooLongPurpose, deps);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('PURPOSE_TOO_LONG');
    expect(result.error.message).toContain('200');
    expect(result.error.message).toContain('201');
  });
});
