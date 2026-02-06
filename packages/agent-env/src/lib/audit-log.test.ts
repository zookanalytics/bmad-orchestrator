import { appendFile, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { AuditLogDeps, AuditLogEntry } from './audit-log.js';
import type { GitState } from './types.js';

import { createAuditEntry, getAuditLogPath, writeAuditLogEntry } from './audit-log.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-audit-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function createCleanGitState(): GitState {
  return {
    hasStaged: false,
    hasUnstaged: false,
    hasUntracked: false,
    stashCount: 0,
    unpushedBranches: [],
    neverPushedBranches: [],
    isDetachedHead: false,
    isClean: true,
  };
}

function createDirtyGitState(): GitState {
  return {
    hasStaged: true,
    hasUnstaged: true,
    hasUntracked: false,
    stashCount: 2,
    unpushedBranches: ['feature-x'],
    neverPushedBranches: ['new-branch'],
    isDetachedHead: false,
    isClean: false,
  };
}

function createTestDeps(): AuditLogDeps {
  return {
    appendFile,
    mkdir,
    homedir: () => tempDir,
  };
}

// ─── getAuditLogPath tests ──────────────────────────────────────────────────

describe('getAuditLogPath', () => {
  it('returns path under ~/.agent-env/audit.log', () => {
    const path = getAuditLogPath({ homedir: () => '/home/user' });
    expect(path).toBe('/home/user/.agent-env/audit.log');
  });
});

// ─── createAuditEntry tests ─────────────────────────────────────────────────

describe('createAuditEntry', () => {
  it('creates entry with correct fields', () => {
    const gitState = createDirtyGitState();
    const entry = createAuditEntry('auth', gitState, 'typed-name');

    expect(entry.action).toBe('force-remove');
    expect(entry.instanceName).toBe('auth');
    expect(entry.gitState).toBe(gitState);
    expect(entry.confirmationMethod).toBe('typed-name');
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('accepts null gitState', () => {
    const entry = createAuditEntry('auth', null, 'yes-flag');

    expect(entry.gitState).toBeNull();
  });

  it('records not-required confirmation method', () => {
    const entry = createAuditEntry('auth', createCleanGitState(), 'not-required');

    expect(entry.confirmationMethod).toBe('not-required');
  });
});

// ─── writeAuditLogEntry tests ───────────────────────────────────────────────

describe('writeAuditLogEntry', () => {
  it('creates audit log file and writes entry', async () => {
    const deps = createTestDeps();
    const entry = createAuditEntry('auth', createCleanGitState(), 'not-required');

    await writeAuditLogEntry(entry, deps);

    const logPath = join(tempDir, '.agent-env', 'audit.log');
    const content = await readFile(logPath, 'utf-8');
    const parsed = JSON.parse(content.trim()) as AuditLogEntry;

    expect(parsed.action).toBe('force-remove');
    expect(parsed.instanceName).toBe('auth');
    expect(parsed.confirmationMethod).toBe('not-required');
  });

  it('appends to existing audit log', async () => {
    const deps = createTestDeps();
    const entry1 = createAuditEntry('auth', createCleanGitState(), 'not-required');
    const entry2 = createAuditEntry('dev', createDirtyGitState(), 'typed-name');

    await writeAuditLogEntry(entry1, deps);
    await writeAuditLogEntry(entry2, deps);

    const logPath = join(tempDir, '.agent-env', 'audit.log');
    const content = await readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n');

    expect(lines).toHaveLength(2);

    const parsed1 = JSON.parse(lines[0]) as AuditLogEntry;
    const parsed2 = JSON.parse(lines[1]) as AuditLogEntry;

    expect(parsed1.instanceName).toBe('auth');
    expect(parsed2.instanceName).toBe('dev');
    expect(parsed2.confirmationMethod).toBe('typed-name');
  });

  it('writes valid JSON lines format', async () => {
    const deps = createTestDeps();
    const gitState = createDirtyGitState();
    const entry = createAuditEntry('auth', gitState, 'yes-flag');

    await writeAuditLogEntry(entry, deps);

    const logPath = join(tempDir, '.agent-env', 'audit.log');
    const content = await readFile(logPath, 'utf-8');

    // Each line should be valid JSON
    const parsed = JSON.parse(content.trim()) as AuditLogEntry;
    expect(parsed.gitState?.hasStaged).toBe(true);
    expect(parsed.gitState?.stashCount).toBe(2);
    expect(parsed.gitState?.unpushedBranches).toEqual(['feature-x']);
    expect(parsed.gitState?.neverPushedBranches).toEqual(['new-branch']);
  });

  it('creates .agent-env directory if it does not exist', async () => {
    const deps = createTestDeps();
    const entry = createAuditEntry('auth', null, 'yes-flag');

    // Directory doesn't exist yet
    await writeAuditLogEntry(entry, deps);

    const logPath = join(tempDir, '.agent-env', 'audit.log');
    const content = await readFile(logPath, 'utf-8');
    expect(content.trim()).not.toBe('');
  });

  it('calls appendFile with correct path', async () => {
    const mockAppendFile = vi.fn().mockResolvedValue(undefined);
    const mockMkdir = vi.fn().mockResolvedValue(undefined);
    const deps: AuditLogDeps = {
      appendFile: mockAppendFile,
      mkdir: mockMkdir,
      homedir: () => '/fake/home',
    };
    const entry = createAuditEntry('auth', null, 'typed-name');

    await writeAuditLogEntry(entry, deps);

    expect(mockAppendFile).toHaveBeenCalledWith(
      '/fake/home/.agent-env/audit.log',
      expect.stringContaining('"action":"force-remove"'),
      'utf-8'
    );
  });
});
