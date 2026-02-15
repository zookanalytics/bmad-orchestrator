#!/bin/bash
# Fix permissions on /shared-data volume
# This script is allowed via sudoers for the node user

set -e

TARGET="/shared-data"

# Security: Verify /shared-data is a mount point, not a symlink
if [ -L "$TARGET" ]; then
  echo "Error: $TARGET is a symlink, refusing to chown" >&2
  exit 1
fi

if ! mountpoint -q "$TARGET" 2>/dev/null; then
  echo "Error: $TARGET is not a mount point, refusing to chown" >&2
  exit 1
fi

chown -R node:node "$TARGET"
