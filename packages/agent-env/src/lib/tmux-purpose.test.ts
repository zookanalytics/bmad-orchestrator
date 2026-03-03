/**
 * Integration tests for image/scripts/tmux-purpose.sh (thin wrapper)
 *
 * The shell script delegates to `agent-env tmux-status` and falls back
 * to "?" when agent-env is unavailable. The actual formatting and state
 * parsing logic is tested in tmux-status.test.ts.
 *
 * These tests verify the wrapper's fallback behavior by manipulating PATH.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

// Resolve script path from package root
const currentDir = fileURLToPath(new URL('.', import.meta.url));
const SCRIPT_PATH = join(currentDir, '..', '..', '..', '..', 'image', 'scripts', 'tmux-purpose.sh');

beforeEach(() => {
  tempDir = join(
    tmpdir(),
    `tmux-purpose-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

/**
 * Run tmux-purpose.sh with a fake agent-env script on PATH.
 * The fake script outputs the given string and exits with the given code.
 */
function runWithFakeAgentEnv(fakeOutput: string, exitCode = 0): string {
  // Create a fake agent-env script
  const fakeBinDir = join(tempDir, 'bin');
  mkdirSync(fakeBinDir, { recursive: true });
  writeFileSync(
    join(fakeBinDir, 'agent-env'),
    `#!/bin/bash\necho "${fakeOutput}"\nexit ${exitCode}\n`,
    { mode: 0o755 }
  );

  try {
    return execSync(`bash "${SCRIPT_PATH}"`, {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, PATH: `${fakeBinDir}:${process.env.PATH}` },
    }).trim();
  } catch (error) {
    const err = error as { stdout?: string };
    return (err.stdout ?? '').trim();
  }
}

/**
 * Run tmux-purpose.sh with agent-env removed from PATH.
 */
function runWithoutAgentEnv(): string {
  try {
    return execSync(`bash "${SCRIPT_PATH}"`, {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, PATH: '/usr/bin:/bin' },
    }).trim();
  } catch (error) {
    const err = error as { stdout?: string };
    return (err.stdout ?? '').trim();
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('tmux-purpose.sh (wrapper)', () => {
  it('passes through agent-env tmux-status output', () => {
    expect(runWithFakeAgentEnv('auth | JWT authentication')).toBe('auth | JWT authentication');
  });

  it('passes through instance-only output', () => {
    expect(runWithFakeAgentEnv('auth')).toBe('auth');
  });

  it('falls back to "?" when agent-env is not available', () => {
    expect(runWithoutAgentEnv()).toBe('?');
  });

  it('falls back to "?" when agent-env exits non-zero', () => {
    expect(runWithFakeAgentEnv('', 1)).toBe('?');
  });

  it('falls back to "?" when agent-env returns empty output', () => {
    expect(runWithFakeAgentEnv('')).toBe('?');
  });
});
