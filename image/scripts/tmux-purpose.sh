#!/bin/bash
# tmux-purpose.sh - Displays instance name and purpose in tmux status bar
# Called by tmux status-right via #(bash /home/node/.local/bin/tmux-purpose)
#
# Delegates to `agent-env tmux-status` for state reading and formatting.
# This eliminates schema duplication — the TypeScript CLI is the single
# source of truth for state.json field names and display formatting.
#
# Falls back to "?" if agent-env is unavailable or returns empty output.

result=$(agent-env tmux-status 2>/dev/null | head -1)
echo "${result:-?}"
