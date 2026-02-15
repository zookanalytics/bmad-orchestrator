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

# Stage only SSH public keys for container mount (never expose private keys)
SSH_PUB_DIR="$HOME/.agent-env/ssh-pub-keys"
mkdir -p "$SSH_PUB_DIR"
rm -f "$SSH_PUB_DIR"/*.pub 2>/dev/null || true
if ls "$HOME/.ssh/"*.pub &>/dev/null; then
  cp -p "$HOME/.ssh/"*.pub "$SSH_PUB_DIR/"
  echo "agent-env: Staged SSH public keys:"
  for f in "$SSH_PUB_DIR"/*.pub; do
    echo "  - $(basename "$f")"
  done
else
  echo "agent-env: Warning: No SSH public keys found in ~/.ssh. SSH access will require manual setup."
fi

# Verify SSH agent socket exists (provided by Docker Desktop / OrbStack on macOS)
if [ ! -S "$SSH_SOCKET" ]; then
  echo "agent-env: Warning: SSH agent socket not found at $SSH_SOCKET"
  echo "agent-env: SSH operations (git clone/push) may not work inside the container."
  echo "agent-env: Ensure Docker Desktop or OrbStack is running on macOS."
fi

echo "agent-env: Host initialization complete"
