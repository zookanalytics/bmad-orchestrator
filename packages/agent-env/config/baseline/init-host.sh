#!/usr/bin/env bash
# init-host.sh - Runs on the HOST before container creation (initializeCommand)
# Ensures mount sources exist to prevent devcontainer up failures.
# The .gitconfig and SSH socket mounts are provided by the image LABEL metadata.

set -euo pipefail

GITCONFIG="$HOME/.gitconfig"
SSH_SOCKET="/run/host-services/ssh-auth.sock"

# Ensure ~/.gitconfig exists (mounted read-only into container)
if [ ! -f "$GITCONFIG" ]; then
  echo "agent-env: Creating $GITCONFIG (mount source)"
  touch "$GITCONFIG"
fi

# Verify SSH agent socket exists (provided by Docker Desktop / OrbStack on macOS)
if [ ! -S "$SSH_SOCKET" ]; then
  echo "agent-env: Warning: SSH agent socket not found at $SSH_SOCKET"
  echo "agent-env: SSH operations (git clone/push) may not work inside the container."
  echo "agent-env: Ensure Docker Desktop or OrbStack is running on macOS."
fi

echo "agent-env: Host initialization complete"
