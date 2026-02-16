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

  # Path to script under test - prefer repo version for development
  SCRIPT="${BATS_TEST_DIRNAME}/../setup-instance-isolation.sh"

  # If repo script is not available (e.g., in a container), fall back to installed version
  if [ ! -f "$SCRIPT" ]; then
    SCRIPT="/usr/local/bin/setup-instance-isolation.sh"
  fi
}

# Teardown: Clean up temp directories after each test
teardown() {
  rm -rf "$TEMP_ROOT"
}

# Helper: Run script with given AGENT_INSTANCE
run_isolation_script() {
  local workspace_id="$1"
  export AGENT_INSTANCE="$workspace_id"
  run bash "$SCRIPT"
}

# =============================================================================
# Test: E003 - Fails if AGENT_INSTANCE is unset
# =============================================================================
@test "E003: fails if AGENT_INSTANCE unset" {
  unset AGENT_INSTANCE
  run bash "$SCRIPT"

  [ "$status" -eq 1 ]
  [[ "$output" == *"E003"* ]]
  [[ "$output" == *"AGENT_INSTANCE is not set"* ]]
}

# =============================================================================
# Test: E004 - Fails if AGENT_INSTANCE contains invalid characters
# =============================================================================
@test "E004: fails if AGENT_INSTANCE contains invalid chars" {
  run_isolation_script "agent/1"

  [ "$status" -eq 1 ]
  [[ "$output" == *"E004"* ]]
  [[ "$output" == *"invalid characters"* ]]
}

@test "E004: fails with spaces in AGENT_INSTANCE" {
  run_isolation_script "agent 1"

  [ "$status" -eq 1 ]
  [[ "$output" == *"E004"* ]]
}

@test "E004: fails with special chars in AGENT_INSTANCE" {
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
# Test: Symlinks credentials when shared credentials exist (AC3)
# =============================================================================
@test "symlinks credentials when shared credentials exist" {
  # Pre-create shared credentials
  mkdir -p "$SHARED_DATA_DIR/claude"
  echo '{"token": "test"}' > "$SHARED_DATA_DIR/claude/credentials.json"

  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Shared credentials found"* ]]
  [[ "$output" == *"Credentials symlinked to shared"* ]]

  # Verify symlink
  [ -L "$HOME/.claude/.credentials.json" ]
  [ "$(readlink "$HOME/.claude/.credentials.json")" = "$SHARED_DATA_DIR/claude/credentials.json" ]

  # Verify readable
  [ -r "$HOME/.claude/.credentials.json" ]
}

# =============================================================================
# Test: First instance - no credentials anywhere (AC1)
# =============================================================================
@test "first instance: no credentials, no shared, no errors" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]
  [[ "$output" == *"No credentials found - first instance will create on auth"* ]]

  # No shared credentials should exist
  [ ! -f "$SHARED_DATA_DIR/claude/credentials.json" ]

  # No credentials symlink should exist
  [ ! -L "$HOME/.claude/.credentials.json" ]
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
# Test: Exports AGENT_INSTANCE to .zshrc
# =============================================================================
@test "exports AGENT_INSTANCE to .zshrc" {
  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]

  # Verify AGENT_INSTANCE export in .zshrc (marker is trailing comment)
  grep -q "^export AGENT_INSTANCE=" "$HOME/.zshrc"
  grep -q "\[setup-instance-isolation:AGENT_INSTANCE\]" "$HOME/.zshrc"
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

# =============================================================================
# Credential Discovery & Promotion Tests
# =============================================================================

# =============================================================================
# Test: Discovery scenario - instance A has local creds, no shared (AC2)
# =============================================================================
@test "discovers credentials from another instance and promotes to shared" {
  # Simulate instance A having already authenticated (created local credentials)
  mkdir -p "$SHARED_DATA_DIR/instance/instance-A/claude"
  echo '{"token": "from-instance-A"}' > "$SHARED_DATA_DIR/instance/instance-A/claude/.credentials.json"

  # Run as instance B
  run_isolation_script "instance-B"

  [ "$status" -eq 0 ]
  [[ "$output" == *"No shared credentials, discovering from instances"* ]]
  [[ "$output" == *"Found credentials"* ]]
  [[ "$output" == *"Credentials promoted and symlinked"* ]]

  # Verify shared credentials now exist
  [ -f "$SHARED_DATA_DIR/claude/credentials.json" ]

  # Verify instance B has symlink to shared
  [ -L "$HOME/.claude/.credentials.json" ]
  [ "$(readlink "$HOME/.claude/.credentials.json")" = "$SHARED_DATA_DIR/claude/credentials.json" ]
  [ -r "$HOME/.claude/.credentials.json" ]

  # Verify instance A's original file is now a symlink back to shared
  [ -L "$SHARED_DATA_DIR/instance/instance-A/claude/.credentials.json" ]
}

# =============================================================================
# Test: Multi-instance discovery picks most recent by mtime (AC4)
# =============================================================================
@test "multi-instance discovery picks most recent credentials by mtime" {
  # Create instance A credentials (older)
  mkdir -p "$SHARED_DATA_DIR/instance/instance-A/claude"
  echo '{"token": "older"}' > "$SHARED_DATA_DIR/instance/instance-A/claude/.credentials.json"
  # Set mtime to 1 hour ago
  touch -d "1 hour ago" "$SHARED_DATA_DIR/instance/instance-A/claude/.credentials.json"

  # Create instance B credentials (newer)
  mkdir -p "$SHARED_DATA_DIR/instance/instance-B/claude"
  echo '{"token": "newer"}' > "$SHARED_DATA_DIR/instance/instance-B/claude/.credentials.json"

  # Run as instance C
  run_isolation_script "instance-C"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Credentials promoted and symlinked"* ]]

  # Verify shared credentials contain the newer token
  [ -f "$SHARED_DATA_DIR/claude/credentials.json" ]
  grep -q '"newer"' "$SHARED_DATA_DIR/claude/credentials.json"
}

# =============================================================================
# Test: Late-arrival instance uses already-promoted shared credentials (AC5)
# Note: True concurrent flock contention requires manual integration testing
# =============================================================================
@test "late-arrival instance uses already-promoted shared credentials" {
  # Simulate: instance A has local credentials
  mkdir -p "$SHARED_DATA_DIR/instance/instance-A/claude"
  echo '{"token": "from-A"}' > "$SHARED_DATA_DIR/instance/instance-A/claude/.credentials.json"

  # Run first instance (promotes credentials)
  run_isolation_script "instance-B"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Credentials promoted and symlinked"* ]]

  # Verify shared exists
  [ -f "$SHARED_DATA_DIR/claude/credentials.json" ]

  # Run second instance (should see shared and just symlink)
  run_isolation_script "instance-C"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Shared credentials found"* ]]
  [[ "$output" == *"Credentials symlinked to shared"* ]]

  # Both instances should have readable symlinks
  [ -L "$HOME/.claude/.credentials.json" ]
  [ -r "$HOME/.claude/.credentials.json" ]
}

# =============================================================================
# Test: Self-healing - shared deleted, rediscovery rebuilds (AC9)
# =============================================================================
@test "self-healing: rediscovers credentials after shared is deleted" {
  # Setup: instance A has local credentials in instance dir
  mkdir -p "$SHARED_DATA_DIR/instance/instance-A/claude"
  echo '{"token": "recovered"}' > "$SHARED_DATA_DIR/instance/instance-A/claude/.credentials.json"

  # Shared credentials do NOT exist (simulate deletion)
  rm -f "$SHARED_DATA_DIR/claude/credentials.json" 2>/dev/null || true

  # Run instance B - should discover from instance A and promote
  run_isolation_script "instance-B"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Found credentials"* ]]
  [[ "$output" == *"Credentials promoted and symlinked"* ]]

  # Verify shared is rebuilt
  [ -f "$SHARED_DATA_DIR/claude/credentials.json" ]
  [ -r "$HOME/.claude/.credentials.json" ]
}

# =============================================================================
# Test: Local regular file replaced with symlink when shared exists (AC10)
# =============================================================================
@test "replaces local regular file with symlink when shared exists" {
  # Pre-create shared credentials
  mkdir -p "$SHARED_DATA_DIR/claude"
  echo '{"token": "shared"}' > "$SHARED_DATA_DIR/claude/credentials.json"

  # Run instance to set up ~/.claude symlink
  run_isolation_script "test-instance"
  [ "$status" -eq 0 ]

  # Simulate Claude replacing symlink with regular file
  rm -f "$HOME/.claude/.credentials.json"
  echo '{"token": "local-override"}' > "$HOME/.claude/.credentials.json"

  # Run again - should replace regular file with symlink
  run_isolation_script "test-instance"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Shared credentials found"* ]]

  # Verify it's a symlink again (not a regular file)
  [ -L "$HOME/.claude/.credentials.json" ]
  [ "$(readlink "$HOME/.claude/.credentials.json")" = "$SHARED_DATA_DIR/claude/credentials.json" ]
}

# =============================================================================
# Test: Backward compatibility - existing shared from manual script (AC6)
# =============================================================================
@test "backward compatibility: uses existing shared credentials without discovery" {
  # Simulate setup-claude-auth-sharing.sh having already run
  mkdir -p "$SHARED_DATA_DIR/claude"
  echo '{"token": "manually-shared"}' > "$SHARED_DATA_DIR/claude/credentials.json"

  run_isolation_script "test-instance"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Shared credentials found"* ]]

  # Should NOT run discovery
  [[ "$output" != *"discovering from instances"* ]]

  # Verify symlink
  [ -L "$HOME/.claude/.credentials.json" ]
  [ "$(readlink "$HOME/.claude/.credentials.json")" = "$SHARED_DATA_DIR/claude/credentials.json" ]
}

# =============================================================================
# Test: Idempotent - already symlinked, re-run recreates symlink (AC7)
# =============================================================================
@test "idempotent: re-run recreates credentials symlink" {
  # Pre-create shared credentials
  mkdir -p "$SHARED_DATA_DIR/claude"
  echo '{"token": "shared"}' > "$SHARED_DATA_DIR/claude/credentials.json"

  # First run
  run_isolation_script "test-instance"
  [ "$status" -eq 0 ]
  [ -L "$HOME/.claude/.credentials.json" ]

  # Second run - should succeed and re-create symlink
  run_isolation_script "test-instance"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Shared credentials found"* ]]

  # Verify symlink still correct
  [ -L "$HOME/.claude/.credentials.json" ]
  [ "$(readlink "$HOME/.claude/.credentials.json")" = "$SHARED_DATA_DIR/claude/credentials.json" ]
  [ -r "$HOME/.claude/.credentials.json" ]
}
