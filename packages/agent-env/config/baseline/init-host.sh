#!/usr/bin/env bash
# init-host.sh - Runs on the HOST before container creation (initializeCommand)
# Ensures mount sources exist to prevent devcontainer up failures

set -euo pipefail

CLAUDE_DIR="$HOME/.claude"
SSH_SOCKET="/run/host-services/ssh-auth.sock"

# Ensure ~/.claude directory exists (mounted read-only into container)
if [ ! -d "$CLAUDE_DIR" ]; then
  echo "agent-env: Creating $CLAUDE_DIR (mount source)"
  mkdir -p "$CLAUDE_DIR"
fi

# Verify SSH agent socket exists (provided by Docker Desktop / OrbStack on macOS)
if [ ! -S "$SSH_SOCKET" ]; then
  echo "agent-env: Warning: SSH agent socket not found at $SSH_SOCKET"
  echo "agent-env: SSH operations (git clone/push) may not work inside the container."
  echo "agent-env: Ensure Docker Desktop or OrbStack is running on macOS."
fi

echo "agent-env: Host initialization complete"
