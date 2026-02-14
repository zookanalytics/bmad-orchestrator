#!/usr/bin/env bash
# post-create.sh - Runtime initialization for agent-env devcontainers
# Runs once after the container is created

set -euo pipefail

echo "=== agent-env: post-create initialization ==="

# Verify tool installation
echo "--- Tool verification ---"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "git: $(git --version)"
echo "tmux: $(tmux -V)"
echo "zsh: $(zsh --version)"

if command -v claude &>/dev/null; then
  echo "Claude Code: installed"
else
  echo "Warning: Claude Code CLI not found in PATH"
fi

echo "=== agent-env: post-create complete ==="
