#!/bin/bash
# Wrapper script to start tmux with session named after the instance
# Used by VS Code terminal profile for consistent session naming

# Defensive color upgrade: if TERM is the bare "xterm" (8 colors), promote
# to xterm-256color. Preserves richer values (xterm-direct, etc.) if already set.
# COLORTERM=truecolor is ensured so apps (Claude Code, etc.) use 24-bit RGB.
[[ "$TERM" == "xterm" ]] && export TERM=xterm-256color
export COLORTERM="${COLORTERM:-truecolor}"

# Fixed name — one managed session per container, matches postStartCommand LABEL
session_name="agent-env"

# If no tmux session exists yet, create one and attempt to restore saved state.
# This handles plain Docker restarts where postStartCommand doesn't run.
if ! /usr/bin/tmux has-session -t "$session_name" 2>/dev/null; then
  /usr/bin/tmux new-session -d -s "$session_name"
  bash -lc "agent-env tmux-restore" 2>/dev/null || true
fi

exec /usr/bin/tmux attach-session -t "$session_name"
