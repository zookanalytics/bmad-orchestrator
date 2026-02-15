#!/bin/bash
# setup-claude-auth-sharing.sh
# Copies local Claude credentials to shared volume for use by other instances
#
# Run this AFTER authenticating with Claude in the first instance.
# This is a MANUAL operation - explicit user action ensures informed consent.
#
# Usage:
#   setup-claude-auth-sharing
#
# What it does:
#   1. Verifies ~/.claude/.credentials.json exists (from Claude authentication)
#   2. Copies credentials to /shared-data/claude/credentials.json (atomic)
#   3. Replaces local file with symlink to shared credentials
#   4. Future instances will use the shared credentials automatically

set -e

SHARED_DATA="${SHARED_DATA_DIR:-/shared-data}"
LOCAL_CREDS="$HOME/.claude/.credentials.json"
SHARED_CREDS="$SHARED_DATA/claude/credentials.json"
LOCKFILE="$SHARED_DATA/claude/.credentials-sharing.lock"

echo "=== Claude Credentials Sharing Setup ==="
echo ""

# --- Step 1: Check if already a symlink (already shared) ---
if [ -L "$LOCAL_CREDS" ]; then
  echo "Credentials are already shared (symlink exists)."
  echo "  $LOCAL_CREDS -> $(readlink -f "$LOCAL_CREDS")"
  exit 0
fi

# --- Step 2: Check if local credentials exist ---
if [ ! -f "$LOCAL_CREDS" ]; then
  echo "ERROR: No credentials file found at $LOCAL_CREDS"
  echo ""
  echo "Please authenticate with Claude first:"
  echo "  1. Run 'claude' to start Claude Code"
  echo "  2. Complete the authentication flow"
  echo "  3. Run this script again"
  exit 1
fi

# --- Step 3: Ensure shared directory exists ---
mkdir -p "$SHARED_DATA/claude"

# --- Step 4: Acquire lock to prevent concurrent execution ---
echo "Acquiring lock..."
exec 200>"$LOCKFILE"
if ! flock -n 200; then
  echo "ERROR: Another instance is currently sharing credentials."
  echo "Please wait and try again."
  exit 1
fi

# --- Step 5: Check if another instance beat us ---
if [ -f "$SHARED_CREDS" ]; then
  echo "Credentials were already shared by another instance."
  echo "Creating local symlink..."

  # Backup local file
  BACKUP="$LOCAL_CREDS.bak"
  if [ -e "$BACKUP" ]; then
    BACKUP="$LOCAL_CREDS.bak.$(date +%s)"
  fi
  mv "$LOCAL_CREDS" "$BACKUP"
  echo "  Local credentials backed up to: $BACKUP"

  # Create symlink
  ln -sf "$SHARED_CREDS" "$LOCAL_CREDS"
  echo "  $LOCAL_CREDS -> $SHARED_CREDS"
  echo ""
  echo "Done! Your local Claude now uses shared credentials."
  exit 0
fi

# --- Step 6: Copy local credentials to shared (atomic: write to .tmp, then mv) ---
echo "Copying credentials to shared volume..."
TEMP_FILE="$SHARED_CREDS.tmp.$$"
cp "$LOCAL_CREDS" "$TEMP_FILE"
mv "$TEMP_FILE" "$SHARED_CREDS"
echo "  Copied to: $SHARED_CREDS"

# --- Step 7: Backup and remove local file ---
BACKUP="$LOCAL_CREDS.bak"
if [ -e "$BACKUP" ]; then
  BACKUP="$LOCAL_CREDS.bak.$(date +%s)"
fi
mv "$LOCAL_CREDS" "$BACKUP"
echo "  Local credentials backed up to: $BACKUP"

# --- Step 8: Create symlink ---
ln -sf "$SHARED_CREDS" "$LOCAL_CREDS"
echo "  Created symlink: $LOCAL_CREDS -> $SHARED_CREDS"

# --- Step 9: Verify symlink works ---
if [ ! -L "$LOCAL_CREDS" ] || [ ! -r "$LOCAL_CREDS" ]; then
  echo "ERROR: Symlink verification failed!"
  echo "Restoring backup..."
  rm -f "$LOCAL_CREDS"
  mv "$BACKUP" "$LOCAL_CREDS"
  rm -f "$SHARED_CREDS"
  exit 1
fi

# Lock is automatically released on script exit

echo ""
echo "Claude credentials shared successfully!"
echo ""
echo "New instances will skip authentication automatically."
echo "Your local backup is at: $BACKUP"
