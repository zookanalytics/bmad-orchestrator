#!/bin/bash
# setup-instance-isolation.sh
# Creates per-instance directories for history while sharing credentials/config
#
# Architecture (organized by program):
#   /shared-data/
#   ├── claude/                    # SHARED Claude state
#   │   ├── inner-config.json      # Account, auth, etc (~/.claude/.claude.json)
#   │   ├── credentials.json       # Credentials (~/.claude/.credentials.json)
#   │   ├── settings.json          # User preferences (~/.claude/settings.json)
#   │   └── config.json            # Theme, MCP servers, project state (~/.claude.json)
#   ├── gemini/                    # SHARED - entire ~/.gemini directory
#   │   ├── oauth_creds.json
#   │   ├── google_accounts.json
#   │   ├── installation_id
#   │   ├── settings.json
#   │   └── tmp/
#   ├── gh/                        # SHARED - GitHub CLI config (~/.config/gh)
#   │   ├── hosts.yml              # GitHub auth tokens
#   │   └── config.yml             # CLI preferences
#   └── instance/                  # PER-INSTANCE isolation
#       └── <instance-id>/
#           ├── claude/            # -> symlink target for ~/.claude
#           │   ├── history.jsonl  # Per-instance conversations
#           │   ├── projects/      # Per-instance project state
#           │   └── todos/         # Per-instance todos
#           └── zsh_history
#
# Error codes:
#   E001: /shared-data is read-only
#   E002: /shared-data write test timed out
#   E003: DEVPOD_WORKSPACE_ID is not set
#   E004: DEVPOD_WORKSPACE_ID contains invalid characters
#   E005: Failed to create directory
#   E006: Failed to create symlink (ln -sf failed)
#   E007: Symlink verification failed (symlink not created or not a symlink)
#   E008: Final health check failed (symlinks not writable)

# --- Testing support ---
# FAIL_AT_STEP: If set, script will fail after completing that step (for rollback testing)
# Example: FAIL_AT_STEP=5 causes exit 1 after step 5

# Track created symlinks and directories for rollback
TRACKING_FILE="/tmp/isolation-$$.created"
TRACKING_DIRS="/tmp/isolation-$$.dirs"
touch "$TRACKING_FILE"
touch "$TRACKING_DIRS"

# Cleanup function (runs on EXIT)
cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "ERROR: Script failed, initiating rollback..."
    rollback
  fi
  rm -f "$TRACKING_FILE" 2>/dev/null || true
  rm -f "$TRACKING_DIRS" 2>/dev/null || true
}

# Rollback function - restore backups, remove created symlinks and directories
rollback() {
  echo "Rolling back changes..."

  # Remove symlinks we created
  if [ -f "$TRACKING_FILE" ]; then
    while IFS= read -r symlink; do
      if [ -L "$symlink" ]; then
        echo "  Removing symlink: $symlink"
        rm -f "$symlink"
      fi
    done < "$TRACKING_FILE"
  fi

  # Remove directories we created (in reverse order, only if empty)
  if [ -f "$TRACKING_DIRS" ]; then
    # Read dirs in reverse order (deepest first)
    tac "$TRACKING_DIRS" 2>/dev/null | while IFS= read -r dir; do
      if [ -d "$dir" ] && [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
        echo "  Removing empty directory: $dir"
        rmdir "$dir" 2>/dev/null || true
      fi
    done
  fi

  # Restore backups
  for backup in "$HOME"/.claude.json.bak* "$HOME"/.claude.bak* "$HOME"/.gemini.bak* "$HOME"/.config/gh.bak*; do
    if [ -f "$backup" ] || [ -d "$backup" ]; then
      # Find the original name by removing .bak suffix
      original="${backup%.bak*}"
      if [ ! -e "$original" ]; then
        echo "  Restoring: $backup -> $original"
        mv "$backup" "$original"
      fi
    fi
  done

  echo "Rollback complete. Manual recovery may be needed."
  echo "Check: ~/.claude.json, ~/.claude, ~/.gemini, ~/.config/gh"
}

# Track a symlink for potential rollback
track_symlink() {
  echo "$1" >> "$TRACKING_FILE"
}

# Track a directory for potential rollback (only if we created it)
track_dir() {
  echo "$1" >> "$TRACKING_DIRS"
}

# Check if we should fail at this step (for testing)
check_fail_at_step() {
  local step="$1"
  if [ -n "${FAIL_AT_STEP:-}" ] && [ "$step" -eq "$FAIL_AT_STEP" ]; then
    echo "TEST MODE: Simulating failure at step $step"
    exit 1
  fi
}

# Set up trap BEFORE set -e to ensure cleanup runs
trap cleanup EXIT

set -e

# --- Configuration ---
SHARED_DATA="${SHARED_DATA_DIR:-/shared-data}"
SHARED_DATA_TIMEOUT="${SHARED_DATA_TIMEOUT:-5}"

# --- Step 0: Early checks ---
echo "=== DevPod Instance Isolation Setup ==="
echo ""

# 0a: Verify /shared-data is writable with timeout
echo "[0] Verifying /shared-data is accessible..."
if ! timeout "${SHARED_DATA_TIMEOUT}s" bash -c "touch '$SHARED_DATA/.write-test' && rm '$SHARED_DATA/.write-test'" 2>/dev/null; then
  if [ ! -w "$SHARED_DATA" ]; then
    echo "E001: ERROR: /shared-data is read-only. Check volume mount configuration."
  else
    echo "E002: ERROR: /shared-data write test timed out. Network volume may be unresponsive."
  fi
  exit 1
fi
echo "  /shared-data is writable"

check_fail_at_step 0

# --- Step 1: Validate DEVPOD_WORKSPACE_ID ---
echo ""
echo "[1] Validating DEVPOD_WORKSPACE_ID..."

if [ -z "${DEVPOD_WORKSPACE_ID:-}" ]; then
  echo "E003: ERROR: DEVPOD_WORKSPACE_ID is not set. Cannot proceed with isolation."
  exit 1
fi

# Validate format: alphanumeric, hyphens, underscores only
SANITIZED_ID="${DEVPOD_WORKSPACE_ID//[^a-zA-Z0-9_-]/}"
if [ "$SANITIZED_ID" != "$DEVPOD_WORKSPACE_ID" ]; then
  echo "E004: ERROR: DEVPOD_WORKSPACE_ID contains invalid characters: '$DEVPOD_WORKSPACE_ID'"
  echo "  Allowed: alphanumeric, hyphens, underscores"
  exit 1
fi

INSTANCE_ID="$DEVPOD_WORKSPACE_ID"
echo "  Instance ID: $INSTANCE_ID"

check_fail_at_step 1

# --- Step 2: Create directory structure ---
echo ""
echo "[2] Creating directory structure..."

create_dir() {
  local dir="$1"
  local existed=false
  [ -d "$dir" ] && existed=true

  if ! mkdir -p "$dir"; then
    echo "E005: ERROR: Failed to create directory: $dir"
    exit 1
  fi
  # Verify writable
  if ! timeout "${SHARED_DATA_TIMEOUT}s" bash -c "touch '$dir/.write-test' && rm '$dir/.write-test'" 2>/dev/null; then
    echo "E005: ERROR: Directory not writable: $dir"
    exit 1
  fi

  # Track for rollback only if we created it
  if [ "$existed" = "false" ]; then
    track_dir "$dir"
  fi
  echo "  Created: $dir"
}

create_dir "$SHARED_DATA/claude"
create_dir "$SHARED_DATA/gemini"
create_dir "$SHARED_DATA/instance/$INSTANCE_ID/claude"

check_fail_at_step 2

# --- Step 3: Handle existing files (backup if needed) ---
echo ""
echo "[3] Handling existing files..."

backup_if_not_symlink() {
  local path="$1"
  if [ -e "$path" ] && [ ! -L "$path" ]; then
    # Check if it's a mount point - can't replace with symlink
    if mountpoint -q "$path" 2>/dev/null; then
      echo "  ERROR: $path is a mount point, cannot replace with symlink"
      echo "  Check your devcontainer.json mounts - remove the mount for $path"
      return 1
    fi
    # Remove empty directories
    if [ -d "$path" ] && [ -z "$(ls -A "$path" 2>/dev/null)" ]; then
      echo "  Removing empty directory: $path"
      rmdir "$path"
      return
    fi
    local backup="$path.bak"
    # If .bak exists, use timestamped version
    if [ -e "$backup" ]; then
      backup="$path.bak.$(date +%s)"
    fi
    echo "  Backing up: $path -> $backup"
    mv "$path" "$backup"
  elif [ -L "$path" ]; then
    echo "  Removing existing symlink: $path"
    rm -f "$path"
  fi
}

backup_if_not_symlink "$HOME/.claude.json"
backup_if_not_symlink "$HOME/.claude"
backup_if_not_symlink "$HOME/.gemini"

check_fail_at_step 3

# --- Step 4: Handle Claude config (~/.claude.json) ---
echo ""
echo "[4] Setting up Claude config (theme, MCP servers, project state)..."

# ~/.claude.json contains theme, MCP servers, OAuth, per-project state, caches
CLAUDE_CONFIG_FILE="$SHARED_DATA/claude/config.json"
if [ ! -f "$CLAUDE_CONFIG_FILE" ]; then
  echo "  Bootstrapping empty config..."
  echo '{}' > "$CLAUDE_CONFIG_FILE"
fi

if ! ln -sf "$CLAUDE_CONFIG_FILE" "$HOME/.claude.json"; then
  echo "E006: ERROR: Failed to create symlink: ~/.claude.json -> $CLAUDE_CONFIG_FILE"
  exit 1
fi
track_symlink "$HOME/.claude.json"

# Verify symlink
if [ ! -L "$HOME/.claude.json" ]; then
  echo "E007: ERROR: Symlink verification failed for: ~/.claude.json"
  exit 1
fi
echo "  ~/.claude.json -> $CLAUDE_CONFIG_FILE"

check_fail_at_step 4

# --- Step 5: Symlink ~/.claude -> per-instance directory ---
echo ""
echo "[5] Setting up Claude data directory..."

if ! ln -sf "$SHARED_DATA/instance/$INSTANCE_ID/claude" "$HOME/.claude"; then
  echo "E006: ERROR: Failed to create symlink: ~/.claude -> $SHARED_DATA/instance/$INSTANCE_ID/claude"
  exit 1
fi
track_symlink "$HOME/.claude"

# Verify symlink points to directory
if [ ! -L "$HOME/.claude" ] || [ ! -d "$HOME/.claude" ]; then
  echo "E007: ERROR: Symlink verification failed for: ~/.claude"
  exit 1
fi
echo "  ~/.claude -> $SHARED_DATA/instance/$INSTANCE_ID/claude"

check_fail_at_step 5

# --- Step 6: Bootstrap and symlink Claude settings (SHARED) ---
echo ""
echo "[6] Setting up shared Claude settings..."

SETTINGS_FILE="$SHARED_DATA/claude/settings.json"
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "  Bootstrapping empty settings file..."
  echo '{}' > "$SETTINGS_FILE"
else
  # Validate JSON, backup and repair if corrupted
  if ! jq empty "$SETTINGS_FILE" 2>/dev/null; then
    SETTINGS_BACKUP="$SETTINGS_FILE.corrupted.$(date +%s)"
    echo "  Settings file corrupted, backing up to $SETTINGS_BACKUP..."
    cp "$SETTINGS_FILE" "$SETTINGS_BACKUP"
    echo "  Resetting to empty..."
    echo '{}' > "$SETTINGS_FILE"
  fi
fi

# Create symlink inside the per-instance claude directory
if ! ln -sf "$SETTINGS_FILE" "$HOME/.claude/settings.json"; then
  echo "E006: ERROR: Failed to create symlink: ~/.claude/settings.json -> $SETTINGS_FILE"
  exit 1
fi
track_symlink "$HOME/.claude/settings.json"

# Verify symlink
if [ ! -L "$HOME/.claude/settings.json" ]; then
  echo "E007: ERROR: Symlink verification failed for: ~/.claude/settings.json"
  exit 1
fi
echo "  ~/.claude/settings.json -> $SETTINGS_FILE"

check_fail_at_step 6

# --- Step 7: Symlink Claude credentials (SHARED) ---
echo ""
echo "[7] Setting up shared Claude credentials..."

# 7a: .credentials.json
CREDENTIALS_FILE="$SHARED_DATA/claude/credentials.json"

# Bootstrap with empty JSON if not exists
if [ ! -f "$CREDENTIALS_FILE" ]; then
  echo "  Bootstrapping empty credentials.json..."
  echo '{}' > "$CREDENTIALS_FILE"
fi

if ! ln -sf "$CREDENTIALS_FILE" "$HOME/.claude/.credentials.json"; then
  echo "E006: ERROR: Failed to create symlink: ~/.claude/.credentials.json -> $CREDENTIALS_FILE"
  exit 1
fi
track_symlink "$HOME/.claude/.credentials.json"

if [ ! -L "$HOME/.claude/.credentials.json" ]; then
  echo "E007: ERROR: Symlink verification failed for: ~/.claude/.credentials.json"
  exit 1
fi
echo "  ~/.claude/.credentials.json -> $CREDENTIALS_FILE"

# 7b: .claude.json (inside ~/.claude/ - account info, auth, etc.)
CLAUDE_INNER_CONFIG="$SHARED_DATA/claude/inner-config.json"

# Bootstrap with empty JSON if not exists (Claude accepts {} as valid)
if [ ! -f "$CLAUDE_INNER_CONFIG" ]; then
  echo "  Bootstrapping empty inner-config.json..."
  echo '{}' > "$CLAUDE_INNER_CONFIG"
fi

if ! ln -sf "$CLAUDE_INNER_CONFIG" "$HOME/.claude/.claude.json"; then
  echo "E006: ERROR: Failed to create symlink: ~/.claude/.claude.json -> $CLAUDE_INNER_CONFIG"
  exit 1
fi
track_symlink "$HOME/.claude/.claude.json"

if [ ! -L "$HOME/.claude/.claude.json" ]; then
  echo "E007: ERROR: Symlink verification failed for: ~/.claude/.claude.json"
  exit 1
fi
echo "  ~/.claude/.claude.json -> $CLAUDE_INNER_CONFIG"

check_fail_at_step 7

# --- Step 8: Symlink ~/.gemini -> shared directory ---
echo ""
echo "[8] Setting up Gemini directory (shared)..."

if ! ln -sf "$SHARED_DATA/gemini" "$HOME/.gemini"; then
  echo "E006: ERROR: Failed to create symlink: ~/.gemini -> $SHARED_DATA/gemini"
  exit 1
fi
track_symlink "$HOME/.gemini"

# Verify symlink
if [ ! -L "$HOME/.gemini" ]; then
  echo "E007: ERROR: Symlink verification failed for: ~/.gemini"
  exit 1
fi
echo "  ~/.gemini -> $SHARED_DATA/gemini"

check_fail_at_step 8

# --- Step 9: Configure ZSH HISTFILE ---
echo ""
echo "[9] Configuring ZSH history isolation..."

HISTFILE_PATH="$SHARED_DATA/instance/$INSTANCE_ID/zsh_history"
touch "$HISTFILE_PATH"

# Disable any existing HISTFILE exports in .zshrc
if [ -f "$HOME/.zshrc" ]; then
  sed -i 's/^export HISTFILE=/#DISABLED_BY_ISOLATION# export HISTFILE=/' "$HOME/.zshrc" 2>/dev/null || true
fi

# Use marker line for idempotent updates (marker at end as trailing comment)
HISTFILE_MARKER="[setup-instance-isolation:HISTFILE]"
HISTFILE_LINE="export HISTFILE=\"$HISTFILE_PATH\" # $HISTFILE_MARKER"

if grep -q "$HISTFILE_MARKER" "$HOME/.zshrc" 2>/dev/null; then
  # Update existing line
  sed -i "s|.*$HISTFILE_MARKER.*|$HISTFILE_LINE|" "$HOME/.zshrc"
  echo "  Updated HISTFILE in .zshrc"
else
  # Append new line
  echo "" >> "$HOME/.zshrc"
  echo "$HISTFILE_LINE" >> "$HOME/.zshrc"
  echo "  Added HISTFILE to .zshrc"
fi

# Set in this script's environment (new zsh sessions will read from .zshrc)
export HISTFILE="$HISTFILE_PATH"
echo "  HISTFILE=$HISTFILE_PATH (effective on next shell session)"

check_fail_at_step 9

# --- Step 10: Final health check ---
echo ""
echo "[10] Running final health check..."

verify_writable() {
  local path="$1"
  local target
  if [ -L "$path" ]; then
    target=$(readlink -f "$path")
  else
    target="$path"
  fi

  if [ -d "$target" ]; then
    if ! timeout "${SHARED_DATA_TIMEOUT}s" bash -c "touch '$target/.health-check' && rm '$target/.health-check'" 2>/dev/null; then
      return 1
    fi
  elif [ -f "$target" ]; then
    if [ ! -w "$target" ]; then
      return 1
    fi
  fi
  return 0
}

HEALTH_CHECK_FAILED=false

if ! verify_writable "$HOME/.claude"; then
  echo "  WARNING: ~/.claude is not writable"
  HEALTH_CHECK_FAILED=true
fi

if ! verify_writable "$HOME/.gemini"; then
  echo "  WARNING: ~/.gemini is not writable"
  HEALTH_CHECK_FAILED=true
fi

# Note: ~/.config/gh is verified in Step 12 after creation

if [ "$HEALTH_CHECK_FAILED" = true ]; then
  echo "E008: ERROR: Final health check failed. Rolling back..."
  exit 1
fi
echo "  All symlinks verified writable"

check_fail_at_step 10

# --- Step 11: Export CLAUDE_INSTANCE ---
echo ""
echo "[11] Exporting instance ID..."

INSTANCE_MARKER="[setup-instance-isolation:CLAUDE_INSTANCE]"
INSTANCE_LINE="export CLAUDE_INSTANCE=\"$INSTANCE_ID\" # $INSTANCE_MARKER"

if grep -q "$INSTANCE_MARKER" "$HOME/.zshrc" 2>/dev/null; then
  # Update existing line
  sed -i "s|.*$INSTANCE_MARKER.*|$INSTANCE_LINE|" "$HOME/.zshrc"
else
  # Append new line
  echo "$INSTANCE_LINE" >> "$HOME/.zshrc"
fi

export CLAUDE_INSTANCE="$INSTANCE_ID"
echo "  CLAUDE_INSTANCE=$INSTANCE_ID"

check_fail_at_step 11

# --- Step 12: Symlink ~/.config/gh -> shared directory ---
echo ""
echo "[12] Setting up GitHub CLI config (shared)..."

# Ensure ~/.config directory exists
mkdir -p "$HOME/.config"

# Create shared gh directory
create_dir "$SHARED_DATA/gh"

# Migrate existing gh config to shared volume (only if shared is empty to avoid clobber)
if [ -d "$HOME/.config/gh" ] && [ ! -L "$HOME/.config/gh" ] && [ -n "$(ls -A "$HOME/.config/gh" 2>/dev/null)" ]; then
  if [ -z "$(ls -A "$SHARED_DATA/gh" 2>/dev/null)" ]; then
    echo "  Migrating existing gh config to shared volume..."
    cp -rp "$HOME/.config/gh/." "$SHARED_DATA/gh/" 2>/dev/null || true
  else
    echo "  Shared gh config already exists, skipping migration"
  fi
fi

# Use standard backup function for cleanup
if ! backup_if_not_symlink "$HOME/.config/gh"; then
  exit 1
fi

if ! ln -sf "$SHARED_DATA/gh" "$HOME/.config/gh"; then
  echo "E006: ERROR: Failed to create symlink: ~/.config/gh -> $SHARED_DATA/gh"
  exit 1
fi
track_symlink "$HOME/.config/gh"

# Verify symlink and writability
if [ ! -L "$HOME/.config/gh" ]; then
  echo "E007: ERROR: Symlink verification failed for: ~/.config/gh"
  exit 1
fi
if ! verify_writable "$HOME/.config/gh"; then
  echo "E008: ERROR: ~/.config/gh is not writable"
  exit 1
fi
echo "  ~/.config/gh -> $SHARED_DATA/gh"

check_fail_at_step 12

# --- Success ---
echo ""
echo "Instance isolation complete for: $INSTANCE_ID"
echo ""
echo "Summary:"
echo "  Instance ID:        $INSTANCE_ID"
echo "  Claude data:        $SHARED_DATA/instance/$INSTANCE_ID/claude/ (per-instance)"
echo "  Claude credentials: $SHARED_DATA/claude/credentials.json (shared)"
echo "  Claude settings:    $SHARED_DATA/claude/settings.json (shared)"
echo "  Claude config:      $SHARED_DATA/claude/config.json (shared - theme, MCP, state)"
echo "  Gemini:             $SHARED_DATA/gemini/ (shared)"
echo "  GitHub CLI:         $SHARED_DATA/gh/ (shared)"
echo "  ZSH history:        $SHARED_DATA/instance/$INSTANCE_ID/zsh_history (per-instance)"
