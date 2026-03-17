#!/usr/bin/env bash
# claude-wrapper: Intercepts claude invocations to track session IDs per tmux pane.
# Installed to /usr/local/bin/claude-wrapper; invoked via shell function in .zshrc.
# Real claude binary path is baked in at install time by post-create.sh.

set -euo pipefail

CLAUDE_REAL="__CLAUDE_REAL_PATH__"
PANES_DIR="/shared-data/instance/${AGENT_INSTANCE}/tmux"
PANES_FILE="$PANES_DIR/panes.json"

# --- Passthrough conditions: skip tracking ---

# No instance ID — can't track state
if [ -z "${AGENT_INSTANCE:-}" ]; then
  exec "$CLAUDE_REAL" "$@"
fi

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
