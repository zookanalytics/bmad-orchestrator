#!/usr/bin/env bash
# init-host.sh - Runs on the HOST before container creation (initializeCommand)
# Ensures mount sources exist to prevent devcontainer up failures.
# The .gitconfig mount is provided by the image LABEL metadata; the SSH agent
# socket mount is injected per-platform by agent-env (resolveSshAgentMount).

set -euo pipefail

GITCONFIG="$HOME/.gitconfig"

# Host SSH agent socket. macOS Docker Desktop/OrbStack expose it at a fixed path;
# on Linux it is the host's real $SSH_AUTH_SOCK. Used only for a pre-flight warning.
if [ "$(uname -s)" = "Darwin" ]; then
  SSH_SOCKET="/run/host-services/ssh-auth.sock"
else
  SSH_SOCKET="${SSH_AUTH_SOCK:-}"
fi

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
    rm -f "$SSH_PUB_DIR"/*.pub 2>/dev/null || true
    echo "agent-env: Warning: Failed to stage SSH public keys — cleared stale keys (non-fatal)"
  fi
  rm -rf "$STAGING_TMP" 2>/dev/null || true
else
  rm -f "$SSH_PUB_DIR"/*.pub 2>/dev/null || true
  echo "agent-env: Warning: No SSH public keys found in ~/.ssh — cleared stale keys. SSH access will require manual setup."
fi

# Stage PulseAudio cookie for audio passthrough (if setup-audio was run)
PULSE_COOKIE_SRC="$HOME/.agent-env/pulse/cookie"
PULSE_COOKIE_DST="$PWD/.agent-env/pulse"
if [ -f "$PULSE_COOKIE_SRC" ]; then
  mkdir -p "$PULSE_COOKIE_DST"
  cp -p "$PULSE_COOKIE_SRC" "$PULSE_COOKIE_DST/cookie"
  echo "agent-env: Staged PulseAudio cookie for audio passthrough"
fi

# Verify a host SSH agent socket is available to forward into the container.
if [ -z "$SSH_SOCKET" ] || [ ! -S "$SSH_SOCKET" ]; then
  echo "agent-env: Warning: no SSH agent socket found${SSH_SOCKET:+ at $SSH_SOCKET}"
  echo "agent-env: SSH operations (git clone/push) may not work inside the container."
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "agent-env: Ensure Docker Desktop or OrbStack is running."
  else
    echo "agent-env: Start an SSH agent and load your key (eval \"\$(ssh-agent -s)\" && ssh-add)."
  fi
fi

echo "agent-env: Host initialization complete"
