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

# Resolve workspace directory — the repo mount under /workspaces/.
# Dockerfile WORKDIR is /workspaces but the actual repo lives one level deeper.
# Find the first real directory that isn't .pnpm-store.
workspace_dir="/workspaces"
for d in /workspaces/*/; do
  case "$d" in
    */\*/) break ;;            # glob didn't match anything
    */.pnpm-store/) continue ;;
    *) workspace_dir="${d%/}"; break ;;
  esac
done

# If no tmux session exists yet, create one and attempt to restore saved state.
# This handles plain Docker restarts where postStartCommand doesn't run.
if ! /usr/bin/tmux has-session -t "$session_name" 2>/dev/null; then
  /usr/bin/tmux new-session -d -s "$session_name" -c "$workspace_dir"
  bash -lc "agent-env tmux-restore" 2>/dev/null || true
fi

exec /usr/bin/tmux attach-session -t "$session_name"
