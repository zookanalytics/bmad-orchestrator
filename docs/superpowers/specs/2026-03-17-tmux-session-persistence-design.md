# Tmux Session Persistence Across Container Rebuilds

## Problem

When a devcontainer is rebuilt (via `agent-env rebuild`, VS Code rebuild, or container restart), all tmux sessions are destroyed. Users running multiple Claude Code sessions across tmux windows lose their conversation context and must manually reopen and resume each one.

## Goal

After a container rebuild, tmux windows are automatically restored with the same names, working directories, and CLI sessions. Claude conversations resume exactly where they left off. The user opens their terminal and finds their workspace as they left it.

## Non-Goals (v1)

- Gemini CLI session persistence (future — same pattern)
- Scrollback buffer restoration (`claude --resume` replays conversation history)
- Pane split restoration (only full windows)

## Architecture

Four components work together:

```
claude-wrapper ──records──▶ claude-sessions.json ◀──reads── tmux-save
                                                      │
                                        tmux list-panes ──▶
                                                      │
                                                      ▼
                                                session.json
                                                      │
                                              tmux-restore ──reads──▶ recreates windows
                                                                      sends: claude --resume <session-id>
```

### 1. Claude Wrapper

A shell script at `~/.local/bin/claude-wrapper`, invoked via a shell function in `.zshrc` that overrides the `claude` command.

**Real binary path:** Hardcoded as `CLAUDE_REAL="$HOME/.local/bin/claude"` in the wrapper script. This is the standard install location for Claude Code's symlink.

**Behavior:**

- **Fresh launch** (`claude` or `claude <args>` without `--resume` or `--session-id`):
  1. Generate a UUID via `cat /proc/sys/kernel/random/uuid`
  2. Record `{ session_id, window_name, cwd }` to `claude-sessions.json` keyed by `$TMUX_PANE` (atomic write via temp file + `mv`)
  3. `exec` real claude with `--session-id <uuid>` plus any original args

- **Bare `--resume`** (`claude --resume` where `--resume` is the last argument or next argument starts with `-`):
  1. Look up `$TMUX_PANE` in `claude-sessions.json`
  2. If found: `exec` real claude with `--resume <stored-session-id>`
  3. If not found: pass through to real claude (opens native session picker)

- **Explicit resume/session-id** (`claude --resume <uuid>` or `claude --session-id <uuid>`):
  - Record the provided session ID in `claude-sessions.json` for this `$TMUX_PANE`
  - Pass through to real claude directly

- **Non-interactive** (`claude --print ...`):
  - Pass through to real claude directly, no tracking

- **Outside tmux** (`$TMUX_PANE` is unset):
  - Pass through to real claude directly, no tracking

- **On exit**: trap EXIT to remove own `$TMUX_PANE` entry from `claude-sessions.json`

**Shell function** (sourced from `/home/node/.config/agent-env/claude-fn.sh`):
```sh
claude() { "$HOME/.local/bin/claude-wrapper" "$@"; }
```

Sourced by `.zshrc`. Functions take priority over PATH, so the real claude binary is never shadowed — it can still be called directly by full path if needed.

**Argument parsing for `--resume`:** The wrapper checks if `--resume` is present in args. If the token immediately following `--resume` is missing, starts with `-`, or is not a valid UUID pattern, it's treated as bare `--resume` (wrapper resolves from pane state). Otherwise it's an explicit session ID and passes through.

### 2. Claude Sessions State File

**Location:** `/shared-data/instance/<instance-id>/tmux/claude-sessions.json`

```json
{
  "version": 1,
  "%42": {
    "session_id": "aaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "window_name": "auth-fix",
    "cwd": "/workspaces/bmad-orchestrator-bugs"
  },
  "%57": {
    "session_id": "1111-2222-3333-4444-555555555555",
    "window_name": "refactor",
    "cwd": "/workspaces/bmad-orchestrator-bugs/packages/agent-env"
  }
}
```

- Keyed by tmux pane ID (`$TMUX_PANE`), which is stable for the life of the tmux server
- Written by the claude wrapper on session start, cleaned up on session exit
- Read by `tmux-save` to associate panes with claude session IDs
- **Concurrency:** All writes use atomic temp-file-then-rename pattern. The wrapper reads the current file, updates its entry, writes to `claude-sessions.json.tmp`, then `mv` to `claude-sessions.json`. Shell-level file locking (`flock`) is used to serialize concurrent writes from multiple claude launches.
- **Stale entry cleanup:** `tmux-save` prunes entries from `claude-sessions.json` whose pane IDs no longer appear in `tmux list-panes` output

### 3. `agent-env tmux-save`

New CLI command that captures the full tmux state.

**Process detection:** The command needs to identify which panes are running Claude. `tmux list-panes` reports `#{pane_current_command}` which reflects the foreground process name. The wrapper `exec`s the real claude binary, so this will report the actual process name. During implementation, verify the reported value and match accordingly (may be `claude`, `node`, or the binary name). As a fallback, cross-reference against `claude-sessions.json` — if a pane has an entry in `claude-sessions.json`, it's running (or was running) a claude session regardless of what `pane_current_command` reports.

**Logic:**
1. Run `tmux list-panes -a -F "#{pane_id} #{window_index} #{window_name} #{pane_current_path} #{pane_current_command} #{session_name}"`
2. For each pane, check `claude-sessions.json` for a matching pane ID to get the claude session ID
3. Record the active window index
4. Prune `claude-sessions.json` of stale entries (pane IDs not in `tmux list-panes` output)
5. Write state to `session.json` using atomic write pattern

**Tmux session targeting:** There is a single tmux session per container. Save captures whichever session exists (typically named after `$AGENT_INSTANCE`). Restore creates windows in that same session.

**State file location:** `/shared-data/instance/<instance-id>/tmux/session.json`

```json
{
  "version": 1,
  "saved_at": "2026-03-17T05:30:00Z",
  "tmux_session": "bugs",
  "active_window": 1,
  "windows": [
    {
      "index": 1,
      "name": "auth-fix",
      "cwd": "/workspaces/bmad-orchestrator-bugs",
      "program": "claude",
      "claude_session_id": "aaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    },
    {
      "index": 2,
      "name": "refactor",
      "cwd": "/workspaces/bmad-orchestrator-bugs/packages/agent-env",
      "program": "claude",
      "claude_session_id": "1111-2222-3333-4444-555555555555"
    },
    {
      "index": 3,
      "name": "shell",
      "cwd": "/workspaces/bmad-orchestrator-bugs/packages/api",
      "program": null
    }
  ]
}
```

### 4. `agent-env tmux-restore`

New CLI command that reconstructs tmux state from `session.json`.

**Logic:**
1. Read `session.json` — if missing, no-op (first-time container)
2. Identify the existing tmux session (there should be exactly one, created by `postStartCommand` or `tmux-session.sh`). If none exists, create one named after `$AGENT_INSTANCE`.
3. For each saved window:
   - Create tmux window with saved name and working directory
   - If `program` is `claude` and `claude_session_id` is present:
     - Send `claude --resume <claude_session_id>` directly to the pane via `tmux send-keys` (uses the session ID from `session.json`, does NOT rely on `claude-sessions.json` lookup — pane IDs are different after rebuild)
     - The wrapper intercepts this, sees an explicit session ID, records it in `claude-sessions.json` for the new pane ID, and passes through
   - If `program` is null, leave pane at shell prompt
3. Select the previously active window
4. Remove the initial empty window if restore created new ones

**Window ordering:** Windows are created in saved order and named explicitly. The saved `index` is used as a hint but not enforced strictly — since `renumber-windows` is enabled in tmux.conf, indices may shift. The ordering of the `windows` array is the source of truth.

**Failed resume handling:** If `claude --resume <id>` exits with a non-zero code (session data missing or corrupted), the pane is left at the shell prompt. The user can manually run `claude --resume` to use the interactive picker.

## Lifecycle Integration

### Three-layer save strategy

1. **Pre-rebuild save (guaranteed):** `agent-env rebuild` runs on the host. Before tearing down the container, it runs `docker exec <container-name> agent-env tmux-save`. The container name is available from `.agent-env/state.json`. This requires adding a `containerExec` method to the `ContainerLifecycle` interface (or using `child_process.exec` with `docker exec` directly).

2. **Periodic auto-save (safety net):** Background process started on tmux session creation. Uses full path to `agent-env` to ensure resolution in tmux's restricted `run-shell` environment:
   ```
   set-hook -g session-created 'run-shell -b "while true; do sleep 300; /home/node/.local/bin/agent-env tmux-save 2>/dev/null; done"'
   ```
   Catches crashes and external stops. Worst case: up to 5 minutes of window layout changes lost (conversation data is never lost — Claude persists that independently). Multiple `session-created` fires are harmless — concurrent saves produce the same result.

3. **tmux pane-exited hook (best-effort):** Saves state when any pane closes, which captures window closures before the layout is lost:
   ```
   set-hook -g pane-exited 'run-shell "/home/node/.local/bin/agent-env tmux-save 2>/dev/null"'
   ```
   Note: `session-closed` fires too late (after panes are destroyed). `pane-exited` fires while the tmux session is still intact.

### Restore point

In `postStartCommand`, after tmux server is created:
```
tmux new-session -d -s main 2>/dev/null || true;
agent-env tmux-restore 2>/dev/null || true;
```

Restore runs before the user attaches. Windows appear pre-populated in the single tmux session.

## Installation Changes

### Dockerfile

- No new packages needed. UUIDs are generated via `cat /proc/sys/kernel/random/uuid` (Linux kernel provides this, no package dependency).

### post-create.sh

After Claude Code installation (step 7):
1. The wrapper is pre-installed to `~/.local/bin/claude-wrapper` via the Dockerfile
2. The wrapper hardcodes `CLAUDE_REAL="$HOME/.local/bin/claude"`
3. Write shell function file to `/home/node/.config/agent-env/claude-fn.sh`
4. Source the function file from `.zshrc`

### tmux.conf

Add save hooks:
```
set-hook -g pane-exited 'run-shell "/home/node/.local/bin/agent-env tmux-save 2>/dev/null"'
set-hook -g session-created 'run-shell -b "while true; do sleep 300; /home/node/.local/bin/agent-env tmux-save 2>/dev/null; done"'
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No `session.json` exists | `tmux-restore` is a no-op. Normal single-window session. |
| Saved claude session ID no longer in history | `claude --resume <id>` prints "No conversation found" and exits. Pane falls back to shell prompt. |
| User manually renames window after startup | Next periodic save captures the new name. |
| User runs `claude` outside tmux | `$TMUX_PANE` is unset, wrapper skips tracking, passes through to real claude. |
| Multiple claude sessions in same window (pane splits) | Out of scope for v1. Only the primary pane is tracked. |
| `claude --print` in scripts | Passes through directly, no UUID overhead. |
| Container crash (no graceful shutdown) | Periodic auto-save provides last state within 5-minute window. Conversation data is always safe. |
| User exits claude then runs other commands before save | `claude-sessions.json` entry is cleaned up on claude exit (EXIT trap). `tmux-save` sees no `claude-sessions.json` entry for that pane, records `program: null`. On restore, pane opens as a shell. The claude session is still resumable manually via `claude --resume`. |
| Claude session in mid-startup when save runs | Pane shows claude but wrapper hasn't written `claude-sessions.json` yet. `tmux-save` records `program: null` for that pane. Safe — minor data loss limited to one window's program state. |
| Container stop (not rebuild) then restart | tmux server dies. `postStartCommand` creates fresh tmux, `tmux-restore` reads last saved `session.json` and reconstructs windows. |
| Two instances sharing `/shared-data` | Each instance has its own directory at `/shared-data/instance/<id>/tmux/`. No conflict. |

## Component Summary

| Component | Location | Est. Size |
|-----------|----------|-----------|
| `claude-wrapper` | `~/.local/bin/claude-wrapper` | ~35 lines shell |
| Shell function | `/home/node/.config/agent-env/claude-fn.sh` | ~3 lines |
| `agent-env tmux-save` | `packages/agent-env/src/commands/` | ~70 lines TS |
| `agent-env tmux-restore` | `packages/agent-env/src/commands/` | ~90 lines TS |
| `tmux.conf` additions | `image/config/tmux.conf` | ~5 lines |
| `post-create.sh` changes | `image/scripts/post-create.sh` | ~5 lines |
| Dockerfile changes | `image/Dockerfile` | ~0 lines (no new packages) |
| `agent-env rebuild` change | `packages/agent-env/src/commands/` | ~5 lines (add containerExec or docker exec call) |
