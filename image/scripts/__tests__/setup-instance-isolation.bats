#!/usr/bin/env bats
# setup-instance-isolation.bats
# Unit tests for setup-instance-isolation.sh with mocked filesystem
#
# Run with: bats image/scripts/__tests__/setup-instance-isolation.bats
# Or via Docker: docker run --rm -v "$PWD":/workspace bats/bats /workspace/image/scripts/__tests__/setup-instance-isolation.bats

# Setup: Create temp directories before each test
setup() {
  # Create isolated test environment
  export TEMP_ROOT=$(mktemp -d)
  export HOME="$TEMP_ROOT/home"
  export SHARED_DATA_DIR="$TEMP_ROOT/shared-data"

  mkdir -p "$HOME"
  mkdir -p "$SHARED_DATA_DIR"

  # Create minimal .zshrc
  touch "$HOME/.zshrc"

  # Path to script under test
  SCRIPT="/usr/local/bin/setup-instance-isolation.sh"

  # If running locally (not in container), use relative path
  if [ ! -f "$SCRIPT" ]; then
    SCRIPT="${BATS_TEST_DIRNAME}/../setup-instance-isolation.sh"
  fi
}

# Teardown: Clean up temp directories after each test
teardown() {
  rm -rf "$TEMP_ROOT"
}

# Helper: Run script with given DEVPOD_WORKSPACE_ID
run_isolation_script() {
  local workspace_id="$1"
  export DEVPOD_WORKSPACE_ID="$workspace_id"
  run bash "$SCRIPT"
}

# =============================================================================
# Test: E003 - Fails if DEVPOD_WORKSPACE_ID is unset
# =============================================================================
@test "E003: fails if DEVPOD_WORKSPACE_ID unset" {
  unset DEVPOD_WORKSPACE_ID
  run bash "$SCRIPT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"E003"* ]]
  [[ "$output" == *"DEVPOD_WORKSPACE_ID is not set"* ]]
}

# =============================================================================
# Test: E004 - Fails if DEVPOD_WORKSPACE_ID contains invalid characters
# =============================================================================
@test "E004: fails if DEVPOD_WORKSPACE_ID contains invalid chars" {
  run_isolation_script "agent/1"

  [ "$status" -eq 1 ]
  [[ "$output" == *"E004"* ]]
  [[ "$output" == *"invalid characters"* ]]
}

@test "E004: fails with spaces in DEVPOD_WORKSPACE_ID" {
  run_isolation_script "agent 1"

  [ "$status" -eq 1 ]
  [[ "$output" == *"E004"* ]]
}

@test "E004: fails with special chars in DEVPOD_WORKSPACE_ID" {
  run_isolation_script "agent\$1"

  [ "$status" -eq 1 ]
  [[ "$output" == *"E004"* ]]
}

# =============================================================================
# Test: E001 - Fails if /shared-data is read-only
# =============================================================================
@test "E001: fails if shared-data is read-only" {
  # Make shared-data read-only
  chmod 555 "$SHARED_DATA_DIR"

  run_isolation_script "test-instance"

  # Restore permissions for cleanup
  chmod 755 "$SHARED_DATA_DIR"

  [ "$status" -eq 1 ]
  [[ "$output" == *"E001"* ]] || [[ "$output" == *"E002"* ]]
}

# =============================================================================
# Test: Creates correct directory structure
# =============================================================================
@test "creates correct directory structure" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify directories exist
  [ -d "$SHARED_DATA_DIR/claude" ]
  [ -d "$SHARED_DATA_DIR/gemini" ]
  [ -d "$SHARED_DATA_DIR/instance/test-instance/claude" ]
}

# =============================================================================
# Test: Always creates Claude config symlink (~/.claude.json)
# =============================================================================
@test "always creates Claude config symlink" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify symlink always created
  [ -L "$HOME/.claude.json" ]
  [ "$(readlink "$HOME/.claude.json")" = "$SHARED_DATA_DIR/claude/config.json" ]

  # Verify bootstrapped file exists
  [ -f "$SHARED_DATA_DIR/claude/config.json" ]
}

# =============================================================================
# Test: Symlinks credentials when shared credentials exist
# =============================================================================
@test "symlinks credentials when shared credentials exist" {
  # Pre-create shared credentials
  mkdir -p "$SHARED_DATA_DIR/claude"
  echo '{"token": "test"}' > "$SHARED_DATA_DIR/claude/credentials.json"

  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify symlink
  [ -L "$HOME/.claude/.credentials.json" ]
  [ "$(readlink "$HOME/.claude/.credentials.json")" = "$SHARED_DATA_DIR/claude/credentials.json" ]
}

# =============================================================================
# Test: Creates credentials symlink proactively (bootstraps empty file)
# =============================================================================
@test "creates credentials symlink proactively and bootstraps empty file" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Bootstrapping empty credentials.json"* ]]

  # Symlink should be created pointing to the bootstrapped file
  [ -L "$HOME/.claude/.credentials.json" ]
  [ "$(readlink "$HOME/.claude/.credentials.json")" = "$SHARED_DATA_DIR/claude/credentials.json" ]

  # Bootstrapped file should exist and be valid JSON
  [ -f "$SHARED_DATA_DIR/claude/credentials.json" ]
  jq empty "$SHARED_DATA_DIR/claude/credentials.json"
}

# =============================================================================
# Test: Creates Gemini symlink to shared directory
# =============================================================================
@test "creates Gemini symlink to shared directory" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify symlink
  [ -L "$HOME/.gemini" ]
  [ "$(readlink "$HOME/.gemini")" = "$SHARED_DATA_DIR/gemini" ]
}

# =============================================================================
# Test: Sets HISTFILE correctly in .zshrc
# =============================================================================
@test "sets HISTFILE correctly in .zshrc" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify marker and HISTFILE in .zshrc (marker is trailing comment)
  grep -q "\[setup-instance-isolation:HISTFILE\]" "$HOME/.zshrc"
  grep -q "^export HISTFILE=.*test-instance.*zsh_history" "$HOME/.zshrc"
}

# =============================================================================
# Test: Backs up existing non-symlink ~/.claude.json
# =============================================================================
@test "backs up existing non-symlink ~/.claude.json" {
  # Pre-create local MCP config file
  echo '{"mcpServers": {}}' > "$HOME/.claude.json"

  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify backup exists
  [ -f "$HOME/.claude.json.bak" ]

  # Verify original is now a symlink
  [ -L "$HOME/.claude.json" ]
}

# =============================================================================
# Test: Uses timestamped backup when .bak already exists
# =============================================================================
@test "uses timestamped backup when .bak already exists" {
  # Pre-create local MCP config file
  echo '{"mcpServers": {}}' > "$HOME/.claude.json"

  # Pre-create a .bak file
  echo '{"mcpServers": {"old": {}}}' > "$HOME/.claude.json.bak"

  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify original .bak still exists (wasn't overwritten)
  [ -f "$HOME/.claude.json.bak" ]

  # Verify a timestamped backup was created
  ls "$HOME/.claude.json.bak."* 2>/dev/null
  [ $? -eq 0 ]
}

# =============================================================================
# Test: Does not create .bak for empty directories
# =============================================================================
@test "does not create backup for empty directories" {
  # Pre-create empty .claude and .gemini directories
  mkdir -p "$HOME/.claude"
  mkdir -p "$HOME/.gemini"

  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Removing empty directory"* ]]

  # Verify NO .bak directories were created
  [ ! -d "$HOME/.claude.bak" ]
  [ ! -d "$HOME/.gemini.bak" ]

  # Verify symlinks are correctly set up
  [ -L "$HOME/.claude" ]
  [ -L "$HOME/.gemini" ]
}

# =============================================================================
# Test: Idempotent - safe to run twice
# =============================================================================
@test "idempotent - safe to run twice" {
  run_isolation_script "test-instance"
  [ "$status" -eq 0 ]

  # Run again
  run_isolation_script "test-instance"
  [ "$status" -eq 0 ]

  # Verify symlinks still correct
  [ -L "$HOME/.claude" ]
  [ -L "$HOME/.gemini" ]
}

# =============================================================================
# Test: Bootstraps empty settings.json if not exists
# =============================================================================
@test "bootstraps empty settings.json if not exists" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify settings file exists
  [ -f "$SHARED_DATA_DIR/claude/settings.json" ]

  # Verify it's valid JSON
  jq empty "$SHARED_DATA_DIR/claude/settings.json"
  [ $? -eq 0 ]

  # Verify symlink in per-instance claude dir
  [ -L "$HOME/.claude/settings.json" ]
}

# =============================================================================
# Test: Creates ~/.claude symlink to per-instance directory
# =============================================================================
@test "creates ~/.claude symlink to per-instance directory" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify symlink
  [ -L "$HOME/.claude" ]
  [ "$(readlink "$HOME/.claude")" = "$SHARED_DATA_DIR/instance/test-instance/claude" ]
}

# =============================================================================
# Test: Exports CLAUDE_INSTANCE to .zshrc
# =============================================================================
@test "exports CLAUDE_INSTANCE to .zshrc" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify CLAUDE_INSTANCE export in .zshrc (marker is trailing comment)
  grep -q "^export CLAUDE_INSTANCE=" "$HOME/.zshrc"
  grep -q "\[setup-instance-isolation:CLAUDE_INSTANCE\]" "$HOME/.zshrc"
}

# =============================================================================
# Test: Valid instance IDs with hyphens and underscores
# =============================================================================
@test "accepts valid instance IDs with hyphens" {
  run_isolation_script "my-test-instance"
  [ "$status" -eq 0 ]
}

@test "accepts valid instance IDs with underscores" {
  run_isolation_script "my_test_instance"
  [ "$status" -eq 0 ]
}

@test "accepts alphanumeric instance IDs" {
  run_isolation_script "agent123"
  [ "$status" -eq 0 ]
}

# =============================================================================
# Test: Rollback on mid-script failure (uses FAIL_AT_STEP)
# =============================================================================
@test "rollback restores state on mid-script failure" {
  # Pre-create a local .claude.json that will be backed up
  echo '{"mcpServers": {}}' > "$HOME/.claude.json"

  # Fail after step 5 (after symlinks created, before settings)
  export FAIL_AT_STEP=5

  run_isolation_script "test-instance"

  [ "$status" -eq 1 ]
  [[ "$output" == *"TEST MODE: Simulating failure"* ]]
  [[ "$output" == *"Rolling back"* ]]

  # Verify rollback actually cleaned up filesystem state:
  # 1. Symlinks created before failure should be removed
  [ ! -L "$HOME/.claude" ] || [ ! -e "$HOME/.claude" ]

  # 2. Backup file should be restored OR still exist for manual recovery
  [ -f "$HOME/.claude.json.bak" ] || [ -f "$HOME/.claude.json" ]

  # 3. The rollback output should indicate action was taken
  [[ "$output" == *"Restoring"* ]] || [[ "$output" == *"Removing"* ]]
}

# =============================================================================
# Test: Disables conflicting HISTFILE exports in .zshrc
# =============================================================================
@test "disables conflicting HISTFILE exports in .zshrc" {
  # Pre-create .zshrc with an existing HISTFILE export
  echo 'export HISTFILE="$HOME/.zsh_history"' >> "$HOME/.zshrc"

  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # The original export should be commented out
  grep -q "#DISABLED_BY_ISOLATION#" "$HOME/.zshrc"
}

# =============================================================================
# Test: Shows success message on completion
# =============================================================================
@test "shows success message on completion" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Instance isolation complete"* ]]
  [[ "$output" == *"test-instance"* ]]
}
