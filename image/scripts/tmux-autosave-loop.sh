#!/bin/bash -l
# tmux-autosave-loop: Periodic tmux state auto-save (every 5 minutes).
# Launched by tmux session-created hook. Uses a PID file to prevent
# accumulating background loops across session restarts.
# Uses login shell (-l) so pnpm global bin (/pnpm) is on PATH.

PID_FILE="/tmp/tmux-autosave.pid"

cleanup() { rm -f "$PID_FILE"; exit 0; }
trap cleanup TERM INT EXIT

# Kill any previous loop (verify PID belongs to this script before killing)
if [ -f "$PID_FILE" ]; then
  old_pid=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    # Check that the process is actually a tmux-autosave-loop instance
    if grep -q 'tmux-autosave-loop' "/proc/$old_pid/cmdline" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null
    fi
  fi
fi
echo $$ > "$PID_FILE"

while true; do
  sleep 300
  agent-env tmux-save 2>/dev/null
done
