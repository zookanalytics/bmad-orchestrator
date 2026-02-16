/**
 * Unit tests for image/scripts/tmux-purpose.sh
 *
 * Tests the jq-based extraction logic of the tmux purpose display script.
 * Each test writes a fixture state.json, runs the script with STATE_FILE overridden,
 * and asserts the output.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;
let stateFile: string;

// Resolve script path from package root (src/lib/ → ../../ → package root → ../../../../image/scripts/)
const currentDir = fileURLToPath(new URL('.', import.meta.url));
const SCRIPT_PATH = join(currentDir, '..', '..', '..', '..', 'image', 'scripts', 'tmux-purpose.sh');

beforeEach(() => {
  tempDir = join(
    tmpdir(),
    `tmux-purpose-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  stateFile = join(tempDir, 'state.json');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

/**
 * Run tmux-purpose.sh with STATE_FILE overridden to a test fixture path.
 * Uses STATE_FILE_OVERRIDE environment variable.
 */
function runPurposeScript(stateFilePath: string): string {
  try {
    return execSync(`bash "${SCRIPT_PATH}"`, {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, STATE_FILE_OVERRIDE: stateFilePath },
    }).trim();
  } catch (error) {
    // Script may exit 0 but produce output on stderr
    const err = error as { stdout?: string; stderr?: string };
    return (err.stdout ?? '').trim();
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('tmux-purpose.sh', () => {
  describe('purpose display formatting', () => {
    it('shows "instance | purpose" when purpose is set', () => {
      writeFileSync(
        stateFile,
        JSON.stringify({ name: 'bmad-orch-auth', purpose: 'JWT authentication' })
      );
      expect(runPurposeScript(stateFile)).toBe('bmad-orch-auth | JWT authentication');
    });

    it('shows instance name only when purpose is null', () => {
      writeFileSync(stateFile, JSON.stringify({ name: 'bmad-orch-auth', purpose: null }));
      expect(runPurposeScript(stateFile)).toBe('bmad-orch-auth');
    });

    it('shows instance name only when purpose is empty string', () => {
      writeFileSync(stateFile, JSON.stringify({ name: 'bmad-orch-auth', purpose: '' }));
      expect(runPurposeScript(stateFile)).toBe('bmad-orch-auth');
    });

    it('shows instance name only when purpose key is absent', () => {
      writeFileSync(stateFile, JSON.stringify({ name: 'bmad-orch-auth' }));
      expect(runPurposeScript(stateFile)).toBe('bmad-orch-auth');
    });
  });

  describe('purpose truncation', () => {
    it('does not truncate purpose at exactly 40 characters', () => {
      const purpose40 = '1234567890123456789012345678901234567890'; // exactly 40
      writeFileSync(stateFile, JSON.stringify({ name: 'test', purpose: purpose40 }));
      expect(runPurposeScript(stateFile)).toBe(`test | ${purpose40}`);
    });

    it('truncates purpose longer than 40 characters with ellipsis', () => {
      const purpose41 = '12345678901234567890123456789012345678901'; // 41 chars
      writeFileSync(stateFile, JSON.stringify({ name: 'test', purpose: purpose41 }));
      expect(runPurposeScript(stateFile)).toBe('test | 1234567890123456789012345678901234567890…');
    });

    it('truncates long real-world purpose', () => {
      const longPurpose =
        'This is a very long purpose that definitely exceeds forty characters in length';
      writeFileSync(stateFile, JSON.stringify({ name: 'my-instance', purpose: longPurpose }));
      const result = runPurposeScript(stateFile);
      expect(result).toContain('my-instance | ');
      expect(result).toContain('…');
      // The purpose part (after "my-instance | ") should be 40 chars + ellipsis
      const purposePart = result.split(' | ')[1];
      expect(purposePart.length).toBe(41); // 40 chars + "…"
    });
  });

  describe('graceful fallbacks', () => {
    it('shows "?" when state file does not exist', () => {
      const nonExistent = join(tempDir, 'does-not-exist.json');
      expect(runPurposeScript(nonExistent)).toBe('?');
    });

    it('shows "?" when state file contains malformed JSON', () => {
      writeFileSync(stateFile, '{bad json content');
      expect(runPurposeScript(stateFile)).toBe('?');
    });

    it('shows "?" when state file is empty', () => {
      writeFileSync(stateFile, '');
      expect(runPurposeScript(stateFile)).toBe('?');
    });

    it('shows "?" when name is null', () => {
      writeFileSync(stateFile, JSON.stringify({ name: null, purpose: 'some purpose' }));
      expect(runPurposeScript(stateFile)).toBe('?');
    });

    it('shows "?" when name is empty string', () => {
      writeFileSync(stateFile, JSON.stringify({ name: '', purpose: 'some purpose' }));
      expect(runPurposeScript(stateFile)).toBe('?');
    });

    it('shows "?" when JSON is empty object', () => {
      writeFileSync(stateFile, '{}');
      expect(runPurposeScript(stateFile)).toBe('?');
    });
  });

  describe('real-world state.json', () => {
    it('handles full state.json with all fields', () => {
      writeFileSync(
        stateFile,
        JSON.stringify({
          name: 'bmad-orchestrator-epics',
          repo: 'git@github.com:zookanalytics/bmad-orchestrator.git',
          createdAt: '2026-02-15T09:13:56.366Z',
          lastAttached: '2026-02-15T09:13:56.366Z',
          purpose: 'Epic 6 implementation',
          containerName: 'agenttools-bmad-orchestrator-epics',
          configSource: 'repo',
        })
      );
      expect(runPurposeScript(stateFile)).toBe('bmad-orchestrator-epics | Epic 6 implementation');
    });

    it('handles state.json with purpose null and extra fields', () => {
      writeFileSync(
        stateFile,
        JSON.stringify({
          name: 'my-project-dev',
          repo: 'https://github.com/user/project.git',
          createdAt: '2026-02-16T00:00:00.000Z',
          lastAttached: '2026-02-16T00:00:00.000Z',
          purpose: null,
          containerName: 'ae-my-project-dev',
        })
      );
      expect(runPurposeScript(stateFile)).toBe('my-project-dev');
    });
  });
});
