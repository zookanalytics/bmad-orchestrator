#!/bin/bash
set -euo pipefail

# Install SSH host keys from workspace to /etc/ssh
# Must run as root to write to /etc/ssh
# Called by post-create.sh after generating persistent host keys

if [ $# -ne 1 ]; then
  echo "Usage: install-ssh-host-keys.sh <ssh-key-directory>" >&2
  exit 1
fi

SSH_KEY_DIR="$1"

if [ ! -d "$SSH_KEY_DIR" ]; then
  echo "Error: SSH key directory '$SSH_KEY_DIR' does not exist" >&2
  exit 1
fi

# Copy host keys to /etc/ssh
cp "$SSH_KEY_DIR"/ssh_host_*_key "$SSH_KEY_DIR"/ssh_host_*_key.pub /etc/ssh/

# Set proper ownership and permissions
chown root:root /etc/ssh/ssh_host_*_key /etc/ssh/ssh_host_*_key.pub
chmod 600 /etc/ssh/ssh_host_*_key
chmod 644 /etc/ssh/ssh_host_*_key.pub

echo "SSH host keys installed successfully"
