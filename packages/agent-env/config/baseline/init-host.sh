#!/usr/bin/env bash
# init-host.sh - Runs on the HOST before container creation (initializeCommand)
# Ensures mount sources exist to prevent devcontainer up failures

set -euo pipefail

CLAUDE_DIR="$HOME/.claude"

# Ensure ~/.claude directory exists (mounted read-only into container)
if [ ! -d "$CLAUDE_DIR" ]; then
  echo "agent-env: Creating $CLAUDE_DIR (mount source)"
  mkdir -p "$CLAUDE_DIR"
fi

echo "agent-env: Host initialization complete"
