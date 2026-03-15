# PulseAudio Passthrough Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Claude voice mode (ALSA) inside agent-env containers by routing audio to the macOS host's PulseAudio server over TCP.

**Architecture:** ALSA -> PulseAudio client (in container) -> TCP to `host.docker.internal:4713` -> macOS PulseAudio server. Cookie-based auth, staged via existing `.agent-env` bind mount, promoted to shared-data volume.

**Tech Stack:** PulseAudio, ALSA, Commander.js (CLI), execa (subprocess), bash (scripts), vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-15-pulseaudio-passthrough-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `image/config/asound.conf` | NEW: 2-line ALSA config routing default PCM/CTL to PulseAudio |
| `image/config/allowed-domains.txt` | MODIFY: Add `host.docker.internal` entry |
| `image/Dockerfile` | MODIFY: Add apt packages, COPY asound.conf, add LABEL env vars |
| `packages/agent-env/src/lib/setup-audio.ts` | NEW: Core logic for audio setup (platform check, pactl, cookie staging) |
| `packages/agent-env/src/lib/setup-audio.test.ts` | NEW: Unit tests for setup-audio logic |
| `packages/agent-env/src/commands/setup-audio.ts` | NEW: Commander command wiring |
| `packages/agent-env/src/commands/setup-audio.test.ts` | NEW: Command integration tests |
| `packages/agent-env/src/cli.ts` | MODIFY: Register setup-audio command |
| `packages/agent-env/config/baseline/init-host.sh` | MODIFY: Add PulseAudio cookie staging block |
| `image/scripts/post-create.sh` | MODIFY: Add PulseAudio cookie promotion step |

---

## Chunk 1: Image and Infrastructure

### Task 1: ALSA Configuration File

**Files:**
- Create: `image/config/asound.conf`

- [ ] **Step 1: Create the ALSA config file**

Create `image/config/asound.conf` with:

```
pcm.default pulse
ctl.default pulse
```

This tells ALSA to route all audio through PulseAudio.

- [ ] **Step 2: Commit**

```
git add image/config/asound.conf
git commit -m "chore(devcontainer): add ALSA-to-PulseAudio config"
```

---

### Task 2: Allowed Domains Update

**Files:**
- Modify: `image/config/allowed-domains.txt`

- [ ] **Step 1: Add host.docker.internal to allowed-domains.txt**

Add a new section at the end of `image/config/allowed-domains.txt`:

```
# Host access (PulseAudio audio passthrough, general host services)
host.docker.internal
```

This ensures the firewall allows TCP connections to the host, which may resolve to an IP outside the HOST_NETWORK /24 (e.g., OrbStack uses `0.250.250.254`).

- [ ] **Step 2: Commit**

```
git add image/config/allowed-domains.txt
git commit -m "chore(devcontainer): allow host.docker.internal through firewall"
```

---

### Task 3: Dockerfile Changes

**Files:**
- Modify: `image/Dockerfile`

- [ ] **Step 1: Add audio packages to apt-get install**

In the first `RUN apt-get update && apt-get install` block (around line 7), add these three packages to the list:

```
  alsa-utils \
  libasound2-plugins \
  pulseaudio-utils \
```

Keep alphabetical order within the list.

- [ ] **Step 2: Add COPY for asound.conf**

In the root config section (around line 164, near `COPY image/config/allowed-domains.txt`), add:

```dockerfile
COPY image/config/asound.conf /etc/asound.conf
```

Group it with the other `image/config/` COPYs for consistency. This section runs as root, which is correct for `/etc/asound.conf`.

- [ ] **Step 3: Add PULSE_SERVER and PULSE_COOKIE to LABEL containerEnv**

In the LABEL `devcontainer.metadata` JSON block, add to the `containerEnv` object (around line 269):

```json
"PULSE_SERVER": "tcp:host.docker.internal:4713",
"PULSE_COOKIE": "/shared-data/pulse/cookie"
```

Add after the existing `AGENT_ENV_CONTAINER` entry. Maintain the trailing comma and backslash continuation pattern.

- [ ] **Step 4: Commit**

```
git add image/Dockerfile
git commit -m "feat(devcontainer): add PulseAudio/ALSA audio passthrough packages and config"
```

---

### Task 4: init-host.sh Cookie Staging

**Files:**
- Modify: `packages/agent-env/config/baseline/init-host.sh`

- [ ] **Step 1: Add PulseAudio cookie staging block**

After the SSH pub keys section (after line 29, before the SSH socket verification), add:

```bash
# Stage PulseAudio cookie for audio passthrough (if setup-audio was run)
PULSE_COOKIE_SRC="$HOME/.agent-env/pulse/cookie"
PULSE_COOKIE_DST="$PWD/.agent-env/pulse"
if [ -f "$PULSE_COOKIE_SRC" ]; then
  mkdir -p "$PULSE_COOKIE_DST"
  cp -p "$PULSE_COOKIE_SRC" "$PULSE_COOKIE_DST/cookie"
  echo "agent-env: Staged PulseAudio cookie for audio passthrough"
fi
```

Note: `initializeCommand` runs on the host with `$PWD` set to the workspace folder. The workspace's `.agent-env/` directory is bind-mounted into the container at `/etc/agent-env/`.

- [ ] **Step 2: Commit**

```
git add packages/agent-env/config/baseline/init-host.sh
git commit -m "feat(agent-env): stage PulseAudio cookie in init-host.sh"
```

---

### Task 5: post-create.sh Cookie Promotion

**Files:**
- Modify: `image/scripts/post-create.sh`

- [ ] **Step 1: Add PulseAudio cookie promotion step**

After the instance isolation block (Step 4, around line 108) and before Step 5, add a new step:

```bash
# Step 4b: Promote PulseAudio cookie to shared-data (if available)
PULSE_COOKIE_SRC="/etc/agent-env/pulse/cookie"
PULSE_COOKIE_DST="${SHARED_DATA_DIR:-/shared-data}/pulse/cookie"
if [ -f "$PULSE_COOKIE_SRC" ]; then
  echo ""
  echo "[Step 4b] Promoting PulseAudio cookie to shared-data..."
  mkdir -p "$(dirname "$PULSE_COOKIE_DST")"
  cp -p "$PULSE_COOKIE_SRC" "$PULSE_COOKIE_DST"
  chmod 600 "$PULSE_COOKIE_DST"
  echo "✓ PulseAudio cookie promoted"
fi
```

This always overwrites to handle cookie rotation. Silently skips if no cookie is staged.

- [ ] **Step 2: Commit**

```
git add image/scripts/post-create.sh
git commit -m "feat(devcontainer): promote PulseAudio cookie to shared-data"
```

---

## Chunk 2: CLI Command (setup-audio)

### Task 6: Core Setup Logic with Tests (TDD)

**Files:**
- Create: `packages/agent-env/src/lib/setup-audio.ts`
- Create: `packages/agent-env/src/lib/setup-audio.test.ts`

The core logic is separated from the Commander command to enable testability via dependency injection (following the project's existing pattern, e.g., `purpose-instance.ts`).

- [ ] **Step 1: Define the interface and types**

Create `packages/agent-env/src/lib/setup-audio.ts` with just the types and function signature:

```typescript
import type { ExecuteResult } from '@zookanalytics/shared';

/**
 * Subprocess executor signature.
 * Compatible with the return type of createExecutor() from @zookanalytics/shared.
 * Uses a minimal options type to avoid coupling to execa's Options type.
 */
export type Execute = (command: string, args?: string[], options?: object) => Promise<ExecuteResult>;

/** Dependency injection for setup-audio (enables testing without real shell/fs) */
export interface SetupAudioDeps {
  platform: string;
  homeDir: string;
  execute: Execute;
  readFile: (path: string, encoding: BufferEncoding) => Promise<string>;
  writeFile: (path: string, content: string, encoding: BufferEncoding) => Promise<void>;
  copyFile: (src: string, dst: string) => Promise<void>;
  mkdir: (path: string, options: { recursive: boolean }) => Promise<string | undefined>;
  access: (path: string) => Promise<void>;
}

export interface SetupAudioResult {
  ok: boolean;
  /** Steps that were performed */
  steps: string[];
  /** Error message if !ok */
  error?: string;
}

export async function setupAudio(_deps: SetupAudioDeps): Promise<SetupAudioResult> {
  throw new Error('Not implemented');
}
```

- [ ] **Step 2: Write failing test for platform check**

Create `packages/agent-env/src/lib/setup-audio.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

import type { SetupAudioDeps } from './setup-audio.js';

import { setupAudio } from './setup-audio.js';

function createMockDeps(overrides: Partial<SetupAudioDeps> = {}): SetupAudioDeps {
  return {
    platform: 'darwin',
    homeDir: '/Users/testuser',
    execute: vi.fn().mockResolvedValue({ ok: true, stdout: '', stderr: '', exitCode: 0 }),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('setupAudio', () => {
  describe('platform check', () => {
    it('rejects non-macOS platforms', async () => {
      const deps = createMockDeps({ platform: 'linux' });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/macOS/i);
    });

    it('accepts darwin platform', async () => {
      const deps = createMockDeps();
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/agent-env && pnpm vitest run src/lib/setup-audio.test.ts`
Expected: FAIL with "Not implemented"

- [ ] **Step 4: Implement platform check**

Replace the `setupAudio` function body in `packages/agent-env/src/lib/setup-audio.ts`:

```typescript
export async function setupAudio(deps: SetupAudioDeps): Promise<SetupAudioResult> {
  const steps: string[] = [];

  // Step 1: Platform check
  if (deps.platform !== 'darwin') {
    return {
      ok: false,
      steps,
      error: 'Audio passthrough is only supported on macOS. On Linux, use native PulseAudio directly.',
    };
  }

  // Step 2: Check PulseAudio is installed
  const brewPrefix = await deps.execute('brew', ['--prefix', 'pulseaudio']);
  if (!brewPrefix.ok) {
    return {
      ok: false,
      steps,
      error: 'PulseAudio not found. Install with: brew install pulseaudio',
    };
  }
  const paPrefix = brewPrefix.stdout.trim();
  steps.push('PulseAudio found');

  // Step 3: Check if TCP module is already loaded
  const moduleCheck = await deps.execute('pactl', ['list', 'short', 'modules']);
  const tcpAlreadyLoaded = moduleCheck.ok && moduleCheck.stdout.includes('module-native-protocol-tcp');

  if (!tcpAlreadyLoaded) {
    // Load TCP module
    const loadResult = await deps.execute('pactl', [
      'load-module',
      'module-native-protocol-tcp',
      'auth-cookie-enabled=1',
      'listen=127.0.0.1',
      'port=4713',
    ]);
    if (!loadResult.ok) {
      return {
        ok: false,
        steps,
        error: `Failed to load PulseAudio TCP module: ${loadResult.stderr}`,
      };
    }
    steps.push('TCP module loaded');
  } else {
    steps.push('TCP module already loaded');
  }

  // Step 4: Persist TCP module to default.pa
  const defaultPaPath = `${paPrefix}/etc/pulse/default.pa`;
  const tcpModuleLine = 'load-module module-native-protocol-tcp auth-cookie-enabled=1 listen=127.0.0.1 port=4713';
  try {
    const paContent = await deps.readFile(defaultPaPath, 'utf-8');
    if (!paContent.includes('module-native-protocol-tcp')) {
      await deps.writeFile(defaultPaPath, paContent.trimEnd() + '\n' + tcpModuleLine + '\n', 'utf-8');
      steps.push('TCP module persisted to default.pa');
    } else {
      steps.push('TCP module already in default.pa');
    }
  } catch {
    return {
      ok: false,
      steps,
      error: `Failed to read or write ${defaultPaPath}. Check file permissions.`,
    };
  }

  // Step 5: Stage cookie
  const cookieSrc = `${deps.homeDir}/.config/pulse/cookie`;
  const cookieDstDir = `${deps.homeDir}/.agent-env/pulse`;
  const cookieDst = `${cookieDstDir}/cookie`;
  try {
    await deps.access(cookieSrc);
    await deps.mkdir(cookieDstDir, { recursive: true });
    await deps.copyFile(cookieSrc, cookieDst);
    steps.push('Cookie staged');
  } catch {
    return {
      ok: false,
      steps,
      error: `PulseAudio cookie not found at ${cookieSrc}. Is PulseAudio running? Try: pulseaudio --start`,
    };
  }

  return { ok: true, steps };
}
```

- [ ] **Step 5: Run test to verify platform check passes**

Run: `cd packages/agent-env && pnpm vitest run src/lib/setup-audio.test.ts`
Expected: Both platform tests PASS

- [ ] **Step 6: Add tests for PulseAudio check, TCP module loading, persistence, and cookie staging**

Add these test cases **inside** the existing `describe('setupAudio', () => { ... })` block in `setup-audio.test.ts`, after the `platform check` describe block and before the closing `});` of the outer describe:

```typescript
  describe('PulseAudio check', () => {
    it('fails when brew --prefix pulseaudio fails', async () => {
      const deps = createMockDeps({
        execute: vi.fn().mockResolvedValue({ ok: false, stdout: '', stderr: 'not found', exitCode: 1 }),
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/brew install pulseaudio/);
    });
  });

  describe('TCP module', () => {
    it('loads module when not already loaded', async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce({ ok: true, stdout: '/opt/homebrew/opt/pulseaudio', stderr: '', exitCode: 0 }) // brew --prefix
        .mockResolvedValueOnce({ ok: true, stdout: 'module-cli-protocol-unix', stderr: '', exitCode: 0 }) // pactl list (no TCP)
        .mockResolvedValueOnce({ ok: true, stdout: '42', stderr: '', exitCode: 0 }); // pactl load-module
      const deps = createMockDeps({ execute: mockExecute });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith('pactl', [
        'load-module',
        'module-native-protocol-tcp',
        'auth-cookie-enabled=1',
        'listen=127.0.0.1',
        'port=4713',
      ]);
      expect(result.steps).toContain('TCP module loaded');
    });

    it('skips loading when module is already loaded', async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce({ ok: true, stdout: '/opt/homebrew/opt/pulseaudio', stderr: '', exitCode: 0 }) // brew --prefix
        .mockResolvedValueOnce({ ok: true, stdout: '25\tmodule-native-protocol-tcp', stderr: '', exitCode: 0 }); // pactl list (has TCP)
      const deps = createMockDeps({ execute: mockExecute });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(result.steps).toContain('TCP module already loaded');
    });
  });

  describe('default.pa persistence', () => {
    it('appends TCP module line when not present', async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce({ ok: true, stdout: '/opt/homebrew/opt/pulseaudio', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ ok: true, stdout: '25\tmodule-native-protocol-tcp', stderr: '', exitCode: 0 });
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const deps = createMockDeps({
        execute: mockExecute,
        readFile: vi.fn().mockResolvedValue('.include /etc/pulse/default.pa.d\n'),
        writeFile: mockWriteFile,
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/opt/homebrew/opt/pulseaudio/etc/pulse/default.pa',
        expect.stringContaining('module-native-protocol-tcp'),
        'utf-8',
      );
      expect(result.steps).toContain('TCP module persisted to default.pa');
    });

    it('skips write when TCP module already in default.pa', async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce({ ok: true, stdout: '/opt/homebrew/opt/pulseaudio', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ ok: true, stdout: '25\tmodule-native-protocol-tcp', stderr: '', exitCode: 0 });
      const mockWriteFile = vi.fn();
      const deps = createMockDeps({
        execute: mockExecute,
        readFile: vi.fn().mockResolvedValue('load-module module-native-protocol-tcp auth-cookie-enabled=1\n'),
        writeFile: mockWriteFile,
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(result.steps).toContain('TCP module already in default.pa');
    });
  });

  describe('cookie staging', () => {
    it('copies cookie to ~/.agent-env/pulse/', async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce({ ok: true, stdout: '/opt/homebrew/opt/pulseaudio', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ ok: true, stdout: '25\tmodule-native-protocol-tcp', stderr: '', exitCode: 0 });
      const mockCopyFile = vi.fn().mockResolvedValue(undefined);
      const mockMkdir = vi.fn().mockResolvedValue(undefined);
      const deps = createMockDeps({
        execute: mockExecute,
        readFile: vi.fn().mockResolvedValue('load-module module-native-protocol-tcp\n'),
        copyFile: mockCopyFile,
        mkdir: mockMkdir,
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(mockMkdir).toHaveBeenCalledWith('/Users/testuser/.agent-env/pulse', { recursive: true });
      expect(mockCopyFile).toHaveBeenCalledWith(
        '/Users/testuser/.config/pulse/cookie',
        '/Users/testuser/.agent-env/pulse/cookie',
      );
      expect(result.steps).toContain('Cookie staged');
    });

    it('fails when cookie does not exist', async () => {
      const mockExecute = vi.fn()
        .mockResolvedValueOnce({ ok: true, stdout: '/opt/homebrew/opt/pulseaudio', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({ ok: true, stdout: '25\tmodule-native-protocol-tcp', stderr: '', exitCode: 0 });
      const deps = createMockDeps({
        execute: mockExecute,
        readFile: vi.fn().mockResolvedValue('load-module module-native-protocol-tcp\n'),
        access: vi.fn().mockRejectedValue(new Error('ENOENT')),
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/cookie not found/i);
    });
  });
```

- [ ] **Step 7: Run all tests**

Run: `cd packages/agent-env && pnpm vitest run src/lib/setup-audio.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```
git add packages/agent-env/src/lib/setup-audio.ts packages/agent-env/src/lib/setup-audio.test.ts
git commit -m "feat(agent-env): add setup-audio core logic with tests"
```

---

### Task 7: Commander Command and CLI Registration

**Files:**
- Create: `packages/agent-env/src/commands/setup-audio.ts`
- Create: `packages/agent-env/src/commands/setup-audio.test.ts`
- Modify: `packages/agent-env/src/cli.ts`

- [ ] **Step 1: Create the Commander command**

Create `packages/agent-env/src/commands/setup-audio.ts`:

```typescript
import { formatError, createError, createExecutor } from '@zookanalytics/shared';
import { Command } from 'commander';
import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { homedir, platform } from 'node:os';

import type { SetupAudioDeps } from '../lib/setup-audio.js';

import { setupAudio } from '../lib/setup-audio.js';

export function createDefaultSetupAudioDeps(): SetupAudioDeps {
  const exec = createExecutor();
  return {
    platform: platform(),
    homeDir: homedir(),
    execute: exec,
    readFile: (path, encoding) => readFile(path, encoding) as Promise<string>,
    writeFile: (path, content, encoding) => writeFile(path, content, encoding),
    copyFile,
    mkdir: (path, opts) => mkdir(path, opts),
    access: (path) => access(path),
  };
}

export const setupAudioCommand = new Command('setup-audio')
  .description('Configure macOS PulseAudio for audio passthrough to containers')
  .action(async () => {
    const deps = createDefaultSetupAudioDeps();
    const result = await setupAudio(deps);

    if (!result.ok) {
      console.error(formatError(createError('AUDIO_SETUP_FAILED', result.error ?? 'Unknown error')));
      process.exit(1);
      return;
    }

    for (const step of result.steps) {
      console.log(`\x1b[32m✓\x1b[0m ${step}`);
    }
    console.log('');
    console.log('Audio passthrough configured. Changes take effect on next container start or rebuild.');
  });
```

- [ ] **Step 2: Write a basic command test**

Create `packages/agent-env/src/commands/setup-audio.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

const mockSetupAudio = vi.fn();

vi.mock('../lib/setup-audio.js', () => ({
  setupAudio: (...args: unknown[]) => mockSetupAudio(...args),
}));

const { setupAudioCommand } = await import('./setup-audio.js');

describe('setupAudioCommand', () => {
  it('is named setup-audio', () => {
    expect(setupAudioCommand.name()).toBe('setup-audio');
  });

  it('has a description', () => {
    expect(setupAudioCommand.description()).toMatch(/audio/i);
  });
});
```

- [ ] **Step 3: Register in cli.ts**

In `packages/agent-env/src/cli.ts`:

Add import (around line 19, with the other command imports):

```typescript
import { setupAudioCommand } from './commands/setup-audio.js';
```

Add registration (around line 48, with the other `program.addCommand` calls):

```typescript
program.addCommand(setupAudioCommand);
```

- [ ] **Step 4: Run tests**

Run: `cd packages/agent-env && pnpm vitest run src/commands/setup-audio.test.ts`
Expected: PASS

- [ ] **Step 5: Verify type-check passes**

Run: `cd packages/agent-env && pnpm type-check`
Expected: No errors

- [ ] **Step 6: Commit**

```
git add packages/agent-env/src/commands/setup-audio.ts packages/agent-env/src/commands/setup-audio.test.ts packages/agent-env/src/cli.ts
git commit -m "feat(agent-env): add setup-audio CLI command"
```

---

## Chunk 3: Verification

### Task 8: Full Test Suite Verification

- [ ] **Step 1: Run the full agent-env test suite**

Run: `cd packages/agent-env && pnpm test:run`
Expected: All tests pass, including existing tests (no regressions)

- [ ] **Step 2: Run type-check and lint**

Run: `cd packages/agent-env && pnpm check`
Expected: No type errors, no lint errors, all tests pass

- [ ] **Step 3: Fix any issues found**

If any tests fail or lint/type errors are found, fix them before proceeding.

- [ ] **Step 4: Commit any fixes**

Only if step 3 required changes.
