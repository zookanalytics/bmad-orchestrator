# Tmux Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist tmux sessions (especially Claude Code conversations) across container rebuilds so windows and CLI sessions restore automatically.

**Architecture:** A shell wrapper intercepts `claude` launches to track session IDs per tmux pane. Two new `agent-env` CLI commands (`tmux-save` / `tmux-restore`) capture and reconstruct tmux window state. Three save triggers (pre-rebuild, periodic, pane-exited) ensure state is captured. State files live in `/shared-data/instance/<id>/tmux/` which survives rebuilds.

**Tech Stack:** Shell (wrapper), TypeScript (agent-env commands), tmux hooks (config)

**Spec:** `docs/superpowers/specs/2026-03-17-tmux-session-persistence-design.md`

---

## Chunk 1: Claude Wrapper Script

### Task 1: Create the claude-wrapper shell script

**Files:**
- Create: `image/scripts/claude-wrapper.sh`

The wrapper intercepts `claude` invocations to track session IDs per tmux pane. It writes to `panes.json` in the shared-data tmux directory.

- [ ] **Step 1: Create the wrapper script**

```bash
#!/usr/bin/env bash
# claude-wrapper: Intercepts claude invocations to track session IDs per tmux pane.
# Installed to /usr/local/bin/claude-wrapper; invoked via shell function in .zshrc.
# Real claude binary path is baked in at install time by post-create.sh.

set -euo pipefail

CLAUDE_REAL="__CLAUDE_REAL_PATH__"
PANES_DIR="/shared-data/instance/${AGENT_INSTANCE:-unknown}/tmux"
PANES_FILE="$PANES_DIR/panes.json"

# --- Passthrough conditions: skip tracking ---

# Outside tmux — no pane to track
if [ -z "${TMUX_PANE:-}" ]; then
  exec "$CLAUDE_REAL" "$@"
fi

# Non-interactive mode — no session tracking needed
for arg in "$@"; do
  if [ "$arg" = "--print" ] || [ "$arg" = "-p" ]; then
    exec "$CLAUDE_REAL" "$@"
  fi
done

# --- JSON helpers (using flock for concurrency) ---

read_panes() {
  if [ -f "$PANES_FILE" ]; then
    cat "$PANES_FILE"
  else
    echo '{"version":1}'
  fi
}

write_pane_entry() {
  local pane_id="$1" session_id="$2"
  mkdir -p "$PANES_DIR"
  (
    flock 200
    local current
    current=$(read_panes)
    local window_name
    window_name=$(tmux display-message -p '#{window_name}' 2>/dev/null || echo "")
    local cwd
    cwd=$(pwd)
    # Use python3 for reliable JSON manipulation — pass values via env vars to avoid injection
    echo "$current" | \
      PANE_ID="$pane_id" SESSION_ID="$session_id" WINDOW_NAME="$window_name" CWD="$cwd" \
      python3 -c "
import sys, json, os
data = json.load(sys.stdin)
data[os.environ['PANE_ID']] = {
  'session_id': os.environ['SESSION_ID'],
  'window_name': os.environ['WINDOW_NAME'],
  'cwd': os.environ['CWD']
}
json.dump(data, sys.stdout)
" > "$PANES_FILE.tmp"
    mv "$PANES_FILE.tmp" "$PANES_FILE"
  ) 200>"$PANES_DIR/.panes.lock"
}

remove_pane_entry() {
  if [ ! -f "$PANES_FILE" ]; then return; fi
  (
    flock 200
    local current
    current=$(read_panes)
    echo "$current" | PANE_ID="$TMUX_PANE" python3 -c "
import sys, json, os
data = json.load(sys.stdin)
data.pop(os.environ['PANE_ID'], None)
json.dump(data, sys.stdout)
" > "$PANES_FILE.tmp"
    mv "$PANES_FILE.tmp" "$PANES_FILE"
  ) 200>"$PANES_DIR/.panes.lock"
}

# Clean up pane entry on exit
cleanup() { remove_pane_entry; }
trap cleanup EXIT

# --- Argument parsing ---

# Check for --resume and --session-id in args
RESUME_FLAG=""
RESUME_VALUE=""
SESSION_ID_FLAG=""
SESSION_ID_VALUE=""
ARGS=("$@")

for i in "${!ARGS[@]}"; do
  case "${ARGS[$i]}" in
    --resume|-r)
      RESUME_FLAG="true"
      # Check if next arg exists and is a UUID (not another flag)
      next_idx=$((i + 1))
      if [ $next_idx -lt ${#ARGS[@]} ]; then
        next="${ARGS[$next_idx]}"
        if [[ "$next" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
          RESUME_VALUE="$next"
        fi
      fi
      ;;
    --session-id)
      SESSION_ID_FLAG="true"
      next_idx=$((i + 1))
      if [ $next_idx -lt ${#ARGS[@]} ]; then
        SESSION_ID_VALUE="${ARGS[$next_idx]}"
      fi
      ;;
  esac
done

# --- Dispatch ---

# Explicit --session-id: record it and pass through
if [ -n "$SESSION_ID_FLAG" ] && [ -n "$SESSION_ID_VALUE" ]; then
  write_pane_entry "$TMUX_PANE" "$SESSION_ID_VALUE"
  exec "$CLAUDE_REAL" "$@"
fi

# Explicit --resume <uuid>: record it and pass through
if [ -n "$RESUME_FLAG" ] && [ -n "$RESUME_VALUE" ]; then
  write_pane_entry "$TMUX_PANE" "$RESUME_VALUE"
  exec "$CLAUDE_REAL" "$@"
fi

# Bare --resume (no UUID): look up pane state
if [ -n "$RESUME_FLAG" ] && [ -z "$RESUME_VALUE" ]; then
  if [ -f "$PANES_FILE" ]; then
    STORED_ID=$(PANES_FILE="$PANES_FILE" PANE_ID="$TMUX_PANE" python3 -c "
import json, os
try:
  data = json.load(open(os.environ['PANES_FILE']))
  entry = data.get(os.environ['PANE_ID'], {})
  print(entry.get('session_id', ''))
except: pass
" 2>/dev/null)
    if [ -n "$STORED_ID" ]; then
      write_pane_entry "$TMUX_PANE" "$STORED_ID"
      exec "$CLAUDE_REAL" --resume "$STORED_ID"
    fi
  fi
  # No stored ID — fall through to real claude (opens picker)
  exec "$CLAUDE_REAL" "$@"
fi

# Fresh launch: generate UUID and set session ID
NEW_UUID=$(cat /proc/sys/kernel/random/uuid)
write_pane_entry "$TMUX_PANE" "$NEW_UUID"
exec "$CLAUDE_REAL" --session-id "$NEW_UUID" "$@"
```

- [ ] **Step 2: Verify the script is syntactically valid**

Run: `bash -n image/scripts/claude-wrapper.sh`
Expected: No output (syntax OK)

- [ ] **Step 3: Commit**

```
git add image/scripts/claude-wrapper.sh
git commit -m "feat(devcontainer): add claude-wrapper script for session ID tracking"
```

---

### Task 2: Create the shell function file

**Files:**
- Create: `image/config/claude-fn.sh`

This tiny file is sourced by `.zshrc` to override the `claude` command with our wrapper.

- [ ] **Step 1: Create the shell function file**

```bash
# claude-fn.sh — sourced by .zshrc to intercept claude with session tracking wrapper
# The wrapper tracks session IDs per tmux pane for session persistence across rebuilds.
claude() { /usr/local/bin/claude-wrapper "$@"; }
```

- [ ] **Step 2: Commit**

```
git add image/config/claude-fn.sh
git commit -m "feat(devcontainer): add claude shell function for wrapper invocation"
```

---

## Chunk 2: tmux-save Command

### Task 3: Create tmux-save library module

**Files:**
- Create: `packages/agent-env/src/lib/tmux-session.ts`
- Test: `packages/agent-env/src/lib/tmux-session.test.ts`

This module contains the core logic for saving and restoring tmux state. It is shared between the `tmux-save` and `tmux-restore` commands.

- [ ] **Step 1: Write tests for the tmux session state types and helpers**

Create `packages/agent-env/src/lib/tmux-session.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  readPanesState,
  writePanesState,
  readSessionState,
  writeSessionState,
  pruneStaleEntries,
  type PanesState,
  type SessionState,
} from './tmux-session.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = join(tmpdir(), `tmux-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('readPanesState', () => {
  it('returns empty state when file does not exist', async () => {
    const result = await readPanesState(join(tempDir, 'nonexistent.json'));
    expect(result).toEqual({ version: 1 });
  });

  it('reads valid panes state', async () => {
    const state: PanesState = {
      version: 1,
      '%0': { session_id: 'aaa-bbb', window_name: 'test', cwd: '/tmp' },
    };
    await writeFile(join(tempDir, 'panes.json'), JSON.stringify(state));
    const result = await readPanesState(join(tempDir, 'panes.json'));
    expect(result['%0']?.session_id).toBe('aaa-bbb');
  });

  it('returns empty state for corrupted JSON', async () => {
    await writeFile(join(tempDir, 'panes.json'), 'not json');
    const result = await readPanesState(join(tempDir, 'panes.json'));
    expect(result).toEqual({ version: 1 });
  });
});

describe('writeSessionState', () => {
  it('writes session state atomically', async () => {
    const state: SessionState = {
      version: 1,
      saved_at: '2026-03-17T00:00:00Z',
      tmux_session: 'bugs',
      active_window: 1,
      windows: [
        { index: 1, name: 'shell', cwd: '/tmp', program: null },
      ],
    };
    const path = join(tempDir, 'session.json');
    await writeSessionState(path, state);
    const read = JSON.parse(await readFile(path, 'utf-8'));
    expect(read.tmux_session).toBe('bugs');
    expect(read.windows).toHaveLength(1);
  });
});

describe('readSessionState', () => {
  it('returns null when file does not exist', async () => {
    const result = await readSessionState(join(tempDir, 'nonexistent.json'));
    expect(result).toBeNull();
  });

  it('reads valid session state', async () => {
    const state: SessionState = {
      version: 1,
      saved_at: '2026-03-17T00:00:00Z',
      tmux_session: 'bugs',
      active_window: 1,
      windows: [{ index: 1, name: 'shell', cwd: '/tmp', program: null }],
    };
    await writeFile(join(tempDir, 'session.json'), JSON.stringify(state));
    const result = await readSessionState(join(tempDir, 'session.json'));
    expect(result?.tmux_session).toBe('bugs');
    expect(result?.windows).toHaveLength(1);
  });

  it('returns null for corrupted JSON', async () => {
    await writeFile(join(tempDir, 'session.json'), 'not json');
    const result = await readSessionState(join(tempDir, 'session.json'));
    expect(result).toBeNull();
  });
});

describe('pruneStaleEntries', () => {
  it('removes pane entries not in active pane list', () => {
    const state: PanesState = {
      version: 1,
      '%0': { session_id: 'aaa', window_name: 'a', cwd: '/tmp' },
      '%1': { session_id: 'bbb', window_name: 'b', cwd: '/tmp' },
      '%2': { session_id: 'ccc', window_name: 'c', cwd: '/tmp' },
    };
    const activePanes = ['%0', '%2'];
    const pruned = pruneStaleEntries(state, activePanes);
    expect(pruned['%0']).toBeDefined();
    expect(pruned['%1']).toBeUndefined();
    expect(pruned['%2']).toBeDefined();
  });

  it('preserves version field', () => {
    const state: PanesState = { version: 1, '%0': { session_id: 'a', window_name: 'x', cwd: '/' } };
    const pruned = pruneStaleEntries(state, ['%0']);
    expect(pruned.version).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/agent-env && pnpm vitest run src/lib/tmux-session.test.ts`
Expected: FAIL — module does not exist yet

- [ ] **Step 3: Implement the tmux-session library module**

Create `packages/agent-env/src/lib/tmux-session.ts`:

```typescript
/**
 * Tmux session state management for agent-env
 *
 * Handles reading/writing panes.json and session.json files that track
 * tmux window state for persistence across container rebuilds.
 *
 * State files live at: /shared-data/instance/<id>/tmux/
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PaneEntry {
  session_id: string;
  window_name: string;
  cwd: string;
}

export interface PanesState {
  version: 1;
  [paneId: string]: PaneEntry | 1; // 1 is the version value
}

export interface WindowEntry {
  index: number;
  name: string;
  cwd: string;
  program: 'claude' | null;
  claude_session_id?: string;
}

export interface SessionState {
  version: 1;
  saved_at: string;
  tmux_session: string;
  active_window: number;
  windows: WindowEntry[];
}

// ─── Panes State ────────────────────────────────────────────────────────────

export async function readPanesState(path: string): Promise<PanesState> {
  try {
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null && parsed.version === 1) {
      return parsed as PanesState;
    }
    return { version: 1 };
  } catch {
    return { version: 1 };
  }
}

export async function writePanesState(path: string, state: PanesState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = path + '.tmp';
  await writeFile(tmpPath, JSON.stringify(state), 'utf-8');
  await rename(tmpPath, path);
}

// ─── Session State ──────────────────────────────────────────────────────────

export async function readSessionState(path: string): Promise<SessionState | null> {
  try {
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null && parsed.version === 1 && Array.isArray(parsed.windows)) {
      return parsed as SessionState;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeSessionState(path: string, state: SessionState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = path + '.tmp';
  await writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  await rename(tmpPath, path);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function pruneStaleEntries(state: PanesState, activePaneIds: string[]): PanesState {
  const pruned: PanesState = { version: 1 };
  const activeSet = new Set(activePaneIds);
  for (const [key, value] of Object.entries(state)) {
    if (key === 'version') continue;
    if (activeSet.has(key)) {
      pruned[key] = value;
    }
  }
  return pruned;
}

/**
 * Resolve the tmux state directory for the current instance.
 * Returns /shared-data/instance/<AGENT_INSTANCE>/tmux
 */
export function resolveTmuxStateDir(agentInstance?: string): string | null {
  const instance = agentInstance || process.env.AGENT_INSTANCE;
  if (!instance) return null;
  return join('/shared-data/instance', instance, 'tmux');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/agent-env && pnpm vitest run src/lib/tmux-session.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add packages/agent-env/src/lib/tmux-session.ts packages/agent-env/src/lib/tmux-session.test.ts
git commit -m "feat(agent-env): add tmux session state library module"
```

---

### Task 4: Create tmux-save command

**Files:**
- Create: `packages/agent-env/src/commands/tmux-save.ts`
- Create: `packages/agent-env/src/commands/tmux-save.test.ts`
- Modify: `packages/agent-env/src/cli.ts` (register command)

- [ ] **Step 1: Write tests for tmux-save command**

Create `packages/agent-env/src/commands/tmux-save.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionState } from '../lib/tmux-session.js';

// Mock dependencies
const mockExecSync = vi.fn();
const mockReadPanesState = vi.fn();
const mockWritePanesState = vi.fn();
const mockWriteSessionState = vi.fn();
const mockResolveTmuxStateDir = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock pruneStaleEntries as a passthrough that returns pruned state
const mockPruneStaleEntries = vi.fn().mockImplementation(
  (state: Record<string, unknown>, activeIds: string[]) => {
    const result: Record<string, unknown> = { version: 1 };
    const activeSet = new Set(activeIds);
    for (const [key, value] of Object.entries(state)) {
      if (key === 'version') continue;
      if (activeSet.has(key)) result[key] = value;
    }
    return result;
  }
);

vi.mock('../lib/tmux-session.js', () => ({
  readPanesState: (...args: unknown[]) => mockReadPanesState(...args),
  writePanesState: (...args: unknown[]) => mockWritePanesState(...args),
  writeSessionState: (...args: unknown[]) => mockWriteSessionState(...args),
  resolveTmuxStateDir: (...args: unknown[]) => mockResolveTmuxStateDir(...args),
  pruneStaleEntries: (...args: unknown[]) => mockPruneStaleEntries(...args),
}));

import { executeTmuxSave } from './tmux-save.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTmuxStateDir.mockReturnValue('/shared-data/instance/test/tmux');
  mockReadPanesState.mockResolvedValue({ version: 1 });
  mockWritePanesState.mockResolvedValue(undefined);
  mockWriteSessionState.mockResolvedValue(undefined);
});

describe('executeTmuxSave', () => {
  it('returns early when no tmux state dir is resolvable', async () => {
    mockResolveTmuxStateDir.mockReturnValue(null);
    await executeTmuxSave();
    expect(mockWriteSessionState).not.toHaveBeenCalled();
  });

  it('saves session state from tmux list-panes output', async () => {
    // Simulate tmux list-panes output (tab-separated): pane_id window_index window_name pane_current_path pane_current_command session_name
    mockExecSync.mockReturnValue(
      '%0\t1\tshell\t/workspaces/project\tzsh\tbugs\n' +
      '%1\t2\tclaude-win\t/workspaces/project\tclaude\tbugs\n'
    );
    mockReadPanesState.mockResolvedValue({
      version: 1,
      '%1': { session_id: 'aaa-bbb', window_name: 'claude-win', cwd: '/workspaces/project' },
    });

    await executeTmuxSave();

    expect(mockWriteSessionState).toHaveBeenCalledTimes(1);
    const savedState: SessionState = mockWriteSessionState.mock.calls[0][1];
    expect(savedState.windows).toHaveLength(2);
    expect(savedState.windows[0].program).toBeNull();
    expect(savedState.windows[1].program).toBe('claude');
    expect(savedState.windows[1].claude_session_id).toBe('aaa-bbb');
  });

  it('records window as shell when no panes.json entry exists', async () => {
    mockExecSync.mockReturnValue('%0\t1\twin\t/tmp\tclaude\tbugs\n');
    mockReadPanesState.mockResolvedValue({ version: 1 }); // no entry for %0

    await executeTmuxSave();

    const savedState: SessionState = mockWriteSessionState.mock.calls[0][1];
    expect(savedState.windows[0].program).toBe('claude');
    expect(savedState.windows[0].claude_session_id).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/agent-env && pnpm vitest run src/commands/tmux-save.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement tmux-save command**

Create `packages/agent-env/src/commands/tmux-save.ts`:

```typescript
/**
 * tmux-save command for agent-env
 *
 * Captures current tmux window state and saves it to session.json.
 * Designed to run inside the container. Silent on errors (used in hooks).
 */

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import {
  readPanesState,
  writePanesState,
  writeSessionState,
  pruneStaleEntries,
  resolveTmuxStateDir,
  type WindowEntry,
  type SessionState,
} from '../lib/tmux-session.js';

export async function executeTmuxSave(): Promise<void> {
  const stateDir = resolveTmuxStateDir();
  if (!stateDir) return;

  // Get tmux pane information using tab separator for reliable parsing
  let tmuxOutput: string;
  try {
    tmuxOutput = execSync(
      'tmux list-panes -a -F "#{pane_id}\t#{window_index}\t#{window_name}\t#{pane_current_path}\t#{pane_current_command}\t#{session_name}"',
      { encoding: 'utf-8', timeout: 5000 }
    );
  } catch {
    return; // tmux not running or no panes
  }

  const panes = tmuxOutput
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [paneId, indexStr, windowName, cwd, command, sessionName] = line.split('\t');
      return {
        paneId,
        windowIndex: parseInt(indexStr, 10),
        windowName,
        cwd,
        command,
        sessionName,
      };
    });

  if (panes.length === 0) return;

  // Read panes.json to get claude session IDs
  const panesPath = join(stateDir, 'panes.json');
  const panesState = await readPanesState(panesPath);

  // Get active window
  let activeWindow = 1;
  try {
    const activeOutput = execSync(
      'tmux display-message -p "#{window_index}"',
      { encoding: 'utf-8', timeout: 5000 }
    );
    activeWindow = parseInt(activeOutput.trim(), 10) || 1;
  } catch {
    // Use default
  }

  // Build session state — deduplicate by window index (take first pane per window)
  const sessionName = panes[0].sessionName;
  const seenWindows = new Set<number>();
  const windows: WindowEntry[] = [];

  for (const pane of panes) {
    if (seenWindows.has(pane.windowIndex)) continue;
    seenWindows.add(pane.windowIndex);

    const paneEntry = panesState[pane.paneId];
    const hasClaudeEntry = typeof paneEntry === 'object' && paneEntry !== null && 'session_id' in paneEntry;

    const window: WindowEntry = {
      index: pane.windowIndex,
      name: pane.windowName,
      cwd: pane.cwd,
      program: hasClaudeEntry ? 'claude' : null,
    };

    if (hasClaudeEntry) {
      window.claude_session_id = paneEntry.session_id;
    }

    windows.push(window);
  }

  // Write session state
  const sessionState: SessionState = {
    version: 1,
    saved_at: new Date().toISOString(),
    tmux_session: sessionName,
    active_window: activeWindow,
    windows,
  };

  await writeSessionState(join(stateDir, 'session.json'), sessionState);

  // Prune stale pane entries
  const activePaneIds = panes.map((p) => p.paneId);
  const pruned = pruneStaleEntries(panesState, activePaneIds);
  await writePanesState(panesPath, pruned);
}

export const tmuxSaveCommand = new Command('tmux-save')
  .description('Save current tmux session state for persistence across rebuilds (container only)')
  .action(async () => {
    try {
      await executeTmuxSave();
    } catch {
      // Silent failure — this runs in tmux hooks and must not produce output
    }
  });
```

- [ ] **Step 4: Register the command in cli.ts**

Modify `packages/agent-env/src/cli.ts`:
- Add import: `import { tmuxSaveCommand } from './commands/tmux-save.js';`
- Add registration: `program.addCommand(tmuxSaveCommand);` (after the `tmuxStatusCommand` line)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/agent-env && pnpm vitest run src/commands/tmux-save.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `cd packages/agent-env && pnpm vitest run`
Expected: All existing tests still pass

- [ ] **Step 7: Commit**

```
git add packages/agent-env/src/commands/tmux-save.ts packages/agent-env/src/commands/tmux-save.test.ts packages/agent-env/src/cli.ts
git commit -m "feat(agent-env): add tmux-save command for session state capture"
```

---

## Chunk 3: tmux-restore Command

### Task 5: Create tmux-restore command

**Files:**
- Create: `packages/agent-env/src/commands/tmux-restore.ts`
- Create: `packages/agent-env/src/commands/tmux-restore.test.ts`
- Modify: `packages/agent-env/src/cli.ts` (register command)

- [ ] **Step 1: Write tests for tmux-restore command**

Create `packages/agent-env/src/commands/tmux-restore.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionState } from '../lib/tmux-session.js';

const mockExecSync = vi.fn();
const mockReadSessionState = vi.fn();
const mockResolveTmuxStateDir = vi.fn();

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock('../lib/tmux-session.js', () => ({
  readSessionState: (...args: unknown[]) => mockReadSessionState(...args),
  resolveTmuxStateDir: (...args: unknown[]) => mockResolveTmuxStateDir(...args),
}));

import { executeTmuxRestore } from './tmux-restore.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveTmuxStateDir.mockReturnValue('/shared-data/instance/test/tmux');
  mockExecSync.mockReturnValue('');
});

describe('executeTmuxRestore', () => {
  it('returns early when no tmux state dir is resolvable', async () => {
    mockResolveTmuxStateDir.mockReturnValue(null);
    await executeTmuxRestore();
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('returns early when no session.json exists', async () => {
    mockReadSessionState.mockResolvedValue(null);
    await executeTmuxRestore();
    // Should only call resolveTmuxStateDir, not any tmux commands
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('creates windows for saved session state', async () => {
    const state: SessionState = {
      version: 1,
      saved_at: '2026-03-17T00:00:00Z',
      tmux_session: 'bugs',
      active_window: 1,
      windows: [
        { index: 1, name: 'shell', cwd: '/tmp', program: null },
        { index: 2, name: 'claude-win', cwd: '/workspaces/project', program: 'claude', claude_session_id: 'aaa-bbb' },
      ],
    };
    mockReadSessionState.mockResolvedValue(state);

    // Mock tmux list-sessions to return the target session
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('list-sessions')) return 'bugs\n';
      return '';
    });

    await executeTmuxRestore();

    // Should have created windows and sent keys
    const calls = mockExecSync.mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('new-window'))).toBe(true);
    expect(calls.some((c) => c.includes('claude --resume aaa-bbb'))).toBe(true);
  });

  it('creates tmux session if none exists', async () => {
    const state: SessionState = {
      version: 1,
      saved_at: '2026-03-17T00:00:00Z',
      tmux_session: 'bugs',
      active_window: 1,
      windows: [{ index: 1, name: 'shell', cwd: '/tmp', program: null }],
    };
    mockReadSessionState.mockResolvedValue(state);
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('list-sessions')) throw new Error('no sessions');
      return '';
    });

    await executeTmuxRestore();

    const calls = mockExecSync.mock.calls.map((c) => c[0] as string);
    expect(calls.some((c) => c.includes('new-session'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/agent-env && pnpm vitest run src/commands/tmux-restore.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement tmux-restore command**

Create `packages/agent-env/src/commands/tmux-restore.ts`:

```typescript
/**
 * tmux-restore command for agent-env
 *
 * Reconstructs tmux windows from saved session.json state.
 * Designed to run in postStartCommand after tmux server is created.
 */

import { Command } from 'commander';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { readSessionState, resolveTmuxStateDir } from '../lib/tmux-session.js';

function tmuxExec(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
}

function tmuxExecSafe(cmd: string): boolean {
  try {
    execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Find or create the target tmux session.
 * Returns the session name.
 */
function ensureTmuxSession(savedName: string): string {
  // Check if any session exists
  try {
    const sessions = tmuxExec('tmux list-sessions -F "#{session_name}"')
      .trim()
      .split('\n')
      .filter(Boolean);

    if (sessions.length > 0) {
      // Use the first (only) session
      return sessions[0];
    }
  } catch {
    // No sessions exist
  }

  // Create session with the saved name
  const name = savedName || process.env.AGENT_INSTANCE || 'main';
  tmuxExecSafe(`tmux new-session -d -s "${name}"`);
  return name;
}

export async function executeTmuxRestore(): Promise<void> {
  const stateDir = resolveTmuxStateDir();
  if (!stateDir) return;

  const sessionState = await readSessionState(join(stateDir, 'session.json'));
  if (!sessionState) return;

  const sessionName = ensureTmuxSession(sessionState.tmux_session);

  for (let i = 0; i < sessionState.windows.length; i++) {
    const win = sessionState.windows[i];

    if (i === 0) {
      // Reuse the existing first window — rename it and set its working directory
      tmuxExecSafe(`tmux rename-window -t "${sessionName}:1" "${win.name}"`);
      tmuxExecSafe(`tmux send-keys -t "${sessionName}:1" "cd ${win.cwd}" Enter`);
    } else {
      // Create a new window
      tmuxExecSafe(
        `tmux new-window -t "${sessionName}" -n "${win.name}" -c "${win.cwd}"`
      );
    }

    // Launch claude if this window had an active session
    // Target by window index (more reliable than name which may have special chars)
    if (win.program === 'claude' && win.claude_session_id) {
      const windowIndex = i + 1; // tmux base-index is 1
      tmuxExecSafe(
        `tmux send-keys -t "${sessionName}:${windowIndex}" "claude --resume ${win.claude_session_id}" Enter`
      );
    }
  }

  // Select the previously active window
  if (sessionState.active_window) {
    tmuxExecSafe(`tmux select-window -t "${sessionName}:${sessionState.active_window}"`);
  }
}

export const tmuxRestoreCommand = new Command('tmux-restore')
  .description('Restore tmux session state from saved state (container only)')
  .action(async () => {
    try {
      await executeTmuxRestore();
    } catch {
      // Silent failure — this runs in postStartCommand
    }
  });
```

- [ ] **Step 4: Register the command in cli.ts**

Modify `packages/agent-env/src/cli.ts`:
- Add import: `import { tmuxRestoreCommand } from './commands/tmux-restore.js';`
- Add registration: `program.addCommand(tmuxRestoreCommand);` (after the `tmuxSaveCommand` line)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/agent-env && pnpm vitest run src/commands/tmux-restore.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run full test suite**

Run: `cd packages/agent-env && pnpm vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```
git add packages/agent-env/src/commands/tmux-restore.ts packages/agent-env/src/commands/tmux-restore.test.ts packages/agent-env/src/cli.ts
git commit -m "feat(agent-env): add tmux-restore command for session reconstruction"
```

---

## Chunk 4: Lifecycle Integration

### Task 6: Add tmux hooks to tmux.conf

**Files:**
- Modify: `image/config/tmux.conf`

- [ ] **Step 1: Add save hooks to tmux.conf**

Append to the end of `image/config/tmux.conf`:

```conf

# ============================================================================
# Session Persistence Hooks
# ============================================================================

# Save tmux state when any pane exits (captures window closures)
set-hook -g pane-exited 'run-shell "/home/node/.local/bin/agent-env tmux-save 2>/dev/null"'

# Periodic auto-save every 5 minutes (safety net for crashes)
set-hook -g session-created 'run-shell -b "while true; do sleep 300; /home/node/.local/bin/agent-env tmux-save 2>/dev/null; done"'
```

- [ ] **Step 2: Commit**

```
git add image/config/tmux.conf
git commit -m "feat(devcontainer): add tmux hooks for session state auto-save"
```

---

### Task 7: Add wrapper setup to post-create.sh

**Files:**
- Modify: `image/scripts/post-create.sh`

- [ ] **Step 1: Read current post-create.sh**

Read `image/scripts/post-create.sh` and locate the Claude Code installation verification block (the `if command -v claude` section after Claude Code install).

- [ ] **Step 2: Add wrapper setup after Claude Code verification**

After the Claude Code verification block (`echo "  ✓ Claude Code installed: ..."` / `echo "  ⚠ Claude Code binary not found"`), add:

```bash
# Set up Claude wrapper for tmux session persistence
CLAUDE_BIN=$(command -v claude 2>/dev/null || echo "")
if [ -n "$CLAUDE_BIN" ]; then
  echo "  - Setting up Claude session persistence wrapper..."
  # Bake the real binary path into the wrapper script
  mkdir -p "$HOME/.local/bin"
  sed "s|__CLAUDE_REAL_PATH__|$CLAUDE_BIN|g" \
    /usr/local/share/agent-env/claude-wrapper.sh > "$HOME/.local/bin/claude-wrapper"
  chmod +x "$HOME/.local/bin/claude-wrapper"
  # Install shell function (sourced by .zshrc)
  mkdir -p "$HOME/.config/agent-env"
  cp /usr/local/share/agent-env/claude-fn.sh "$HOME/.config/agent-env/claude-fn.sh"
  # Source the function from .zshrc if not already present
  MARKER="[agent-env:claude-wrapper]"
  SOURCE_LINE="source \"\$HOME/.config/agent-env/claude-fn.sh\" # $MARKER"
  if ! grep -qF "$MARKER" "$HOME/.zshrc" 2>/dev/null; then
    echo "$SOURCE_LINE" >> "$HOME/.zshrc"
  fi
  echo "  ✓ Claude session persistence wrapper configured"
else
  echo "  ⚠ Skipping Claude wrapper (claude not found)"
fi
```

- [ ] **Step 3: Commit**

```
git add image/scripts/post-create.sh
git commit -m "feat(devcontainer): add claude wrapper setup to post-create"
```

---

### Task 8: Add wrapper files to Dockerfile

**Files:**
- Modify: `image/Dockerfile`

- [ ] **Step 1: Read the Dockerfile**

Read `image/Dockerfile` and find where config files are copied into the image (look for `COPY` commands that copy tmux.conf, scripts, etc.).

- [ ] **Step 2: Add COPY commands for wrapper files**

Add near the other config file copies:

```dockerfile
# Claude session persistence wrapper (real path baked in at post-create time)
COPY image/scripts/claude-wrapper.sh /usr/local/share/agent-env/claude-wrapper.sh
COPY image/config/claude-fn.sh /usr/local/share/agent-env/claude-fn.sh
```

These are staged to `/usr/local/share/agent-env/` — post-create.sh will install them to their final locations with the real binary path baked in.

- [ ] **Step 3: Commit**

```
git add image/Dockerfile
git commit -m "feat(devcontainer): copy claude wrapper files into image"
```

---

### Task 9: Add pre-rebuild tmux-save to rebuild command

**Files:**
- Modify: `packages/agent-env/src/lib/rebuild-instance.ts`
- Modify: `packages/agent-env/src/lib/rebuild-instance.ts` (tests — update existing)

- [ ] **Step 1: Read rebuild-instance.ts and its test file**

Read both `packages/agent-env/src/lib/rebuild-instance.ts` and the test file to understand where to insert the change.

- [ ] **Step 2: Add executor to RebuildInstanceDeps (if not already present — it is)**

The `executor` field already exists on `RebuildInstanceDeps`. We'll use it to run `docker exec`.

- [ ] **Step 3: Add pre-teardown tmux-save call**

In `rebuildInstance()`, insert **after** the `if (wasRunning && !force)` early-return block (after line 466) and **before** the `// Step 6-7: Stop and remove old container` comment (line 468). This ensures save only runs when we're actually proceeding with teardown:

```typescript
  // Step 5.5: Save tmux session state before teardown (best-effort)
  if (wasRunning) {
    try {
      await deps.executor('docker', [
        'exec', oldContainerName, 'agent-env', 'tmux-save',
      ]);
      deps.logger?.info('Saved tmux session state');
    } catch {
      deps.logger?.warn('Could not save tmux session state (non-fatal)');
    }
  }
```

- [ ] **Step 4: Add a test for the pre-teardown save**

Add to the existing rebuild test file:

Adapt an existing test from `rebuild-instance.test.ts` that exercises the running container + force path. Find a test in the "container teardown" describe block, duplicate it, and add the tmux-save assertion. The key setup is:

- `containerStatus` returns `{ ok: true, status: 'running', containerId: 'abc', ports: {}, labels: {} }`
- `rebuildInstance` is called with `{ force: true }`
- Assert that `executor` was called with `('docker', ['exec', <containerName>, 'agent-env', 'tmux-save'])`
- Also verify the call happens BEFORE `containerStop` (check call order in mock)

- [ ] **Step 5: Run tests**

Run: `cd packages/agent-env && pnpm vitest run src/lib/rebuild-instance.test.ts`
Expected: All tests pass

- [ ] **Step 6: Commit**

```
git add packages/agent-env/src/lib/rebuild-instance.ts
git commit -m "feat(agent-env): save tmux state before container teardown on rebuild"
```

---

### Task 10: Add tmux-restore to postStartCommand

**Files:**
- Modify: `image/Dockerfile` (postStartCommand metadata label)

- [ ] **Step 1: Read the Dockerfile postStartCommand**

Find the `postStartCommand` in the Dockerfile LABEL metadata (around line 285).

- [ ] **Step 2: Add tmux-restore to postStartCommand**

Update the `postStartCommand` to include `agent-env tmux-restore` after the tmux session creation:

```
"postStartCommand": "sudo /usr/local/bin/start-sshd.sh; tmux new-session -d -s main 2>/dev/null || true; agent-env tmux-restore 2>/dev/null || true; : > /tmp/install-shared-skills.log; /usr/local/bin/install-shared-skills.sh >> /tmp/install-shared-skills.log 2>&1 || true"
```

- [ ] **Step 3: Commit**

```
git add image/Dockerfile
git commit -m "feat(devcontainer): add tmux-restore to postStartCommand"
```

---

## Chunk 5: Integration Testing and Verification

### Task 11: Manual integration test

This task verifies the full round-trip works end-to-end.

- [ ] **Step 1: Build the project**

Run: `cd packages/agent-env && pnpm build`
Expected: Build succeeds

- [ ] **Step 2: Verify the new commands are registered**

Run: `agent-env --help`
Expected: `tmux-save` and `tmux-restore` appear in the command list

- [ ] **Step 3: Test tmux-save manually**

In a tmux session, run:
```bash
agent-env tmux-save
```
Then check the state file:
```bash
cat /shared-data/instance/$(echo $AGENT_INSTANCE)/tmux/session.json
```
Expected: JSON with current windows listed

- [ ] **Step 4: Test tmux-restore manually**

Kill the current tmux windows, then run:
```bash
agent-env tmux-restore
```
Expected: Windows are recreated from saved state

- [ ] **Step 5: Test the claude wrapper**

(After a container rebuild that includes the wrapper):
1. Open a tmux window and run `claude`
2. Check that `panes.json` has an entry for the pane
3. Exit claude and verify the entry is cleaned up
4. Run `claude` again, then run `agent-env tmux-save`
5. Verify `session.json` captures the claude session ID

- [ ] **Step 6: Final commit — update any issues found during testing**

Fix any issues discovered and commit.
