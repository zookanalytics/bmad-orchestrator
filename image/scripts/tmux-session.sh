#!/bin/bash
# Wrapper script to start tmux with session named after the instance
# Used by VS Code terminal profile for consistent session naming

session_name="${AGENT_INSTANCE:-$(hostname)}"
exec /usr/bin/tmux new-session -A -s "$session_name"
