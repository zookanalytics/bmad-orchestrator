/**
 * Unit tests for tmux status line formatting
 *
 * Tests the TypeScript logic that replaced the previous jq-based shell script.
 * This is now the single source of truth for reading state.json and formatting
 * the tmux status bar display.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_PURPOSE_DISPLAY_LEN, formatTmuxStatus, getTmuxStatus } from './tmux-status.js';

// ─── formatTmuxStatus (pure formatting) ─────────────────────────────────────

describe('formatTmuxStatus', () => {
  it('returns "instance | purpose" when both are set', () => {
    expect(formatTmuxStatus('auth', 'JWT authentication')).toBe('auth | JWT authentication');
  });

  it('returns instance only when purpose is null', () => {
    expect(formatTmuxStatus('auth', null)).toBe('auth');
  });

  it('returns instance only when purpose is empty string', () => {
    expect(formatTmuxStatus('auth', '')).toBe('auth');
  });

  it('returns "?" when instance is empty', () => {
    expect(formatTmuxStatus('', 'some purpose')).toBe('?');
  });

  it('does not truncate purpose at exactly 40 characters', () => {
    const purpose40 = '1234567890123456789012345678901234567890'; // exactly 40
    expect(formatTmuxStatus('test', purpose40)).toBe(`test | ${purpose40}`);
  });

  it('truncates purpose longer than 40 characters with ellipsis', () => {
    const purpose41 = '12345678901234567890123456789012345678901'; // 41 chars
    expect(formatTmuxStatus('test', purpose41)).toBe(
      'test | 1234567890123456789012345678901234567890…'
    );
  });

  it('truncates long real-world purpose', () => {
    const longPurpose =
      'This is a very long purpose that definitely exceeds forty characters in length';
    const result = formatTmuxStatus('my-instance', longPurpose);
    expect(result).toContain('my-instance | ');
    expect(result).toContain('…');
    // The purpose part (after "my-instance | ") should be 40 chars + ellipsis
    const purposePart = result.split(' | ')[1];
    expect(purposePart.length).toBe(MAX_PURPOSE_DISPLAY_LEN + 1); // 40 chars + "…"
  });
});

// ─── getTmuxStatus (I/O + formatting) ───────────────────────────────────────

describe('getTmuxStatus', () => {
  let tempDir: string;
  let stateFile: string;

  beforeEach(() => {
    tempDir = join(
      tmpdir(),
      `tmux-status-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempDir, { recursive: true });
    stateFile = join(tempDir, 'state.json');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const deps = { readFile };

  describe('purpose display', () => {
    it('shows "instance | purpose" when purpose is set', async () => {
      writeFileSync(stateFile, JSON.stringify({ instance: 'auth', purpose: 'JWT authentication' }));
      expect(await getTmuxStatus(stateFile, deps)).toBe('auth | JWT authentication');
    });

    it('shows instance name only when purpose is null', async () => {
      writeFileSync(stateFile, JSON.stringify({ instance: 'auth', purpose: null }));
      expect(await getTmuxStatus(stateFile, deps)).toBe('auth');
    });

    it('shows instance name only when purpose is empty string', async () => {
      writeFileSync(stateFile, JSON.stringify({ instance: 'auth', purpose: '' }));
      expect(await getTmuxStatus(stateFile, deps)).toBe('auth');
    });

    it('shows instance name only when purpose key is absent', async () => {
      writeFileSync(stateFile, JSON.stringify({ instance: 'auth' }));
      expect(await getTmuxStatus(stateFile, deps)).toBe('auth');
    });
  });

  describe('purpose truncation', () => {
    it('does not truncate purpose at exactly 40 characters', async () => {
      const purpose40 = '1234567890123456789012345678901234567890';
      writeFileSync(stateFile, JSON.stringify({ instance: 'test', purpose: purpose40 }));
      expect(await getTmuxStatus(stateFile, deps)).toBe(`test | ${purpose40}`);
    });

    it('truncates purpose longer than 40 characters with ellipsis', async () => {
      const purpose41 = '12345678901234567890123456789012345678901';
      writeFileSync(stateFile, JSON.stringify({ instance: 'test', purpose: purpose41 }));
      expect(await getTmuxStatus(stateFile, deps)).toBe(
        'test | 1234567890123456789012345678901234567890…'
      );
    });
  });

  describe('graceful fallbacks', () => {
    it('shows "?" when state file does not exist', async () => {
      const nonExistent = join(tempDir, 'does-not-exist.json');
      expect(await getTmuxStatus(nonExistent, deps)).toBe('?');
    });

    it('shows "?" when state file contains malformed JSON', async () => {
      writeFileSync(stateFile, '{bad json content');
      expect(await getTmuxStatus(stateFile, deps)).toBe('?');
    });

    it('shows "?" when state file is empty', async () => {
      writeFileSync(stateFile, '');
      expect(await getTmuxStatus(stateFile, deps)).toBe('?');
    });

    it('shows "?" when instance is null', async () => {
      writeFileSync(stateFile, JSON.stringify({ instance: null, purpose: 'some purpose' }));
      expect(await getTmuxStatus(stateFile, deps)).toBe('?');
    });

    it('shows "?" when instance is empty string', async () => {
      writeFileSync(stateFile, JSON.stringify({ instance: '', purpose: 'some purpose' }));
      expect(await getTmuxStatus(stateFile, deps)).toBe('?');
    });

    it('shows "?" when JSON is empty object', async () => {
      writeFileSync(stateFile, '{}');
      expect(await getTmuxStatus(stateFile, deps)).toBe('?');
    });

    it('shows "?" when readFile throws unexpected error', async () => {
      const failDeps = {
        readFile: vi.fn().mockRejectedValue(new Error('permission denied')),
      };
      expect(await getTmuxStatus(stateFile, failDeps)).toBe('?');
    });
  });

  describe('real-world state.json', () => {
    it('handles full state.json with all fields', async () => {
      writeFileSync(
        stateFile,
        JSON.stringify({
          instance: 'epics',
          repoSlug: 'bmad-orchestrator',
          repoUrl: 'git@github.com:zookanalytics/bmad-orchestrator.git',
          createdAt: '2026-02-15T09:13:56.366Z',
          lastAttached: '2026-02-15T09:13:56.366Z',
          purpose: 'Epic 6 implementation',
          containerName: 'ae-bmad-orchestrator-epics',
          configSource: 'repo',
        })
      );
      expect(await getTmuxStatus(stateFile, deps)).toBe('epics | Epic 6 implementation');
    });

    it('handles state.json with purpose null and extra fields', async () => {
      writeFileSync(
        stateFile,
        JSON.stringify({
          instance: 'dev',
          repoSlug: 'my-project',
          repoUrl: 'https://github.com/user/project.git',
          createdAt: '2026-02-16T00:00:00.000Z',
          lastAttached: '2026-02-16T00:00:00.000Z',
          purpose: null,
          containerName: 'ae-my-project-dev',
        })
      );
      expect(await getTmuxStatus(stateFile, deps)).toBe('dev');
    });
  });
});
