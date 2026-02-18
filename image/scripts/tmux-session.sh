#!/bin/bash
# Wrapper script to start tmux with session named after the instance
# Used by VS Code terminal profile for consistent session naming

# Defensive color upgrade: if TERM is the bare "xterm" (8 colors), promote
# to xterm-256color. Preserves richer values (xterm-direct, etc.) if already set.
# COLORTERM=truecolor is ensured so apps (Claude Code, etc.) use 24-bit RGB.
[[ "$TERM" == "xterm" ]] && export TERM=xterm-256color
export COLORTERM="${COLORTERM:-truecolor}"

session_name="${AGENT_INSTANCE:-$(hostname)}"
exec /usr/bin/tmux new-session -A -s "$session_name"
