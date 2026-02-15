#!/bin/bash
# fix-ssh-socket-permissions.sh - Fix SSH agent socket permissions for non-root users
#
# OrbStack/Docker Desktop on macOS bind-mount /run/host-services/ssh-auth.sock
# with the host user's UID (typically 501) and restrictive permissions (rw-rw----).
# Inside the container, the 'node' user (UID 1000) can't access the socket.
#
# This script makes the socket world-accessible. This is safe in a single-user
# devcontainer — anyone who can reach the socket already has full container access.
#
# Must run as root (via sudo). Called from post-create.sh.

set -euo pipefail

# Verify running as root
if [ "$EUID" -ne 0 ]; then
  echo "  ⚠ fix-ssh-socket-permissions.sh must run as root (use sudo)" >&2
  exit 1
fi

# Docker Desktop/OrbStack macOS convention; fall back to SSH_AUTH_SOCK for other runtimes
DOCKER_DESKTOP_SOCKET="/run/host-services/ssh-auth.sock"

if [ -S "$DOCKER_DESKTOP_SOCKET" ]; then
  SSH_SOCKET="$DOCKER_DESKTOP_SOCKET"
elif [ -n "${SSH_AUTH_SOCK:-}" ] && [ -S "$SSH_AUTH_SOCK" ]; then
  SSH_SOCKET="$SSH_AUTH_SOCK"
else
  echo "  SSH agent socket not found — skipping"
  exit 0
fi

# Security: refuse to follow symlinks (consistent with fix-shared-data-permissions.sh)
if [ -L "$SSH_SOCKET" ]; then
  echo "  ⚠ $SSH_SOCKET is a symlink — skipping for security"
  exit 0
fi

if ! chmod o+rw "$SSH_SOCKET"; then
  echo "  ⚠ Could not fix SSH socket permissions — SSH agent may not work"
  exit 0
fi

echo "  ✓ SSH agent socket permissions fixed ($SSH_SOCKET)"
