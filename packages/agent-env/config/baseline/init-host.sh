#!/usr/bin/env bash
# init-host.sh - Runs on the HOST before container creation (initializeCommand)
# Ensures mount sources exist to prevent devcontainer up failures.
# The .gitconfig and SSH socket mounts are provided by the image LABEL metadata.

set -uo pipefail

GITCONFIG="$HOME/.gitconfig"
SSH_SOCKET="/run/host-services/ssh-auth.sock"

# Ensure ~/.gitconfig exists (mounted read-only into container)
if [ ! -f "$GITCONFIG" ]; then
  echo "agent-env: Creating $GITCONFIG (mount source)"
  touch "$GITCONFIG"
fi

# Stage only SSH public keys for container mount (never expose private keys).
# Non-fatal — SSH agent socket provides auth; pub keys are only for sshd authorized_keys.
SSH_PUB_DIR="$HOME/.agent-env/ssh-pub-keys"
mkdir -p "$SSH_PUB_DIR"
if ls "$HOME/.ssh/"*.pub &>/dev/null; then
  # Atomic replace: copy to temp dir, then swap
  STAGING_TMP="$SSH_PUB_DIR/.staging.$$"
  mkdir -p "$STAGING_TMP"
  if cp -p "$HOME/.ssh/"*.pub "$STAGING_TMP/" 2>/dev/null; then
    rm -f "$SSH_PUB_DIR"/*.pub 2>/dev/null || true
    mv "$STAGING_TMP"/*.pub "$SSH_PUB_DIR/" 2>/dev/null || true
    echo "agent-env: Staged SSH public keys:"
    for f in "$SSH_PUB_DIR"/*.pub; do
      [ -f "$f" ] && echo "  - $(basename "$f")"
    done
  else
    echo "agent-env: Warning: Failed to stage SSH public keys (non-fatal)"
  fi
  rm -rf "$STAGING_TMP" 2>/dev/null || true
else
  echo "agent-env: Warning: No SSH public keys found in ~/.ssh. SSH access will require manual setup."
fi

# Stage PulseAudio cookie for audio passthrough (if setup-audio was run)
PULSE_COOKIE_SRC="$HOME/.agent-env/pulse/cookie"
PULSE_COOKIE_DST="$PWD/.agent-env/pulse"
if [ -f "$PULSE_COOKIE_SRC" ]; then
  mkdir -p "$PULSE_COOKIE_DST"
  cp -p "$PULSE_COOKIE_SRC" "$PULSE_COOKIE_DST/cookie"
  echo "agent-env: Staged PulseAudio cookie for audio passthrough"
fi

# Verify SSH agent socket exists (provided by Docker Desktop / OrbStack on macOS)
if [ ! -S "$SSH_SOCKET" ]; then
  echo "agent-env: Warning: SSH agent socket not found at $SSH_SOCKET"
  echo "agent-env: SSH operations (git clone/push) may not work inside the container."
  echo "agent-env: Ensure Docker Desktop or OrbStack is running on macOS."
fi

echo "agent-env: Host initialization complete"
