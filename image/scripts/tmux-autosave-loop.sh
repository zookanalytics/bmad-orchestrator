#!/bin/bash
# tmux-autosave-loop: Periodic tmux state auto-save (every 5 minutes).
# Launched by tmux session-created hook. Uses a PID file to prevent
# accumulating background loops across session restarts.

PID_FILE="/tmp/tmux-autosave.pid"

# Kill any previous loop
if [ -f "$PID_FILE" ]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null
fi
echo $$ > "$PID_FILE"

while true; do
  sleep 300
  /home/node/.local/bin/agent-env tmux-save 2>/dev/null
done
