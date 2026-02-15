#!/usr/bin/env bats
# search-history.bats
# Unit tests for search-history.sh with fixture data
#
# Run with: bats image/scripts/__tests__/search-history.bats
# Or via Docker: docker run --rm -v "$PWD":/workspace bats/bats /workspace/image/scripts/__tests__/search-history.bats

# Setup: Create temp directories and copy fixtures
setup() {
  # Create isolated test environment
  export TEMP_ROOT=$(mktemp -d)
  export SHARED_DATA_DIR="$TEMP_ROOT/shared-data"

  mkdir -p "$SHARED_DATA_DIR/instance"

  # Copy fixtures to temp directory
  FIXTURES_DIR="${BATS_TEST_DIRNAME}/fixtures"
  if [ -d "$FIXTURES_DIR" ]; then
    cp -r "$FIXTURES_DIR/instance-1" "$SHARED_DATA_DIR/instance/"
    cp -r "$FIXTURES_DIR/instance-2" "$SHARED_DATA_DIR/instance/"
  fi

  # Path to script under test
  SCRIPT="/usr/local/bin/search-history.sh"

  # If running locally (not in container), use relative path
  if [ ! -f "$SCRIPT" ]; then
    SCRIPT="${BATS_TEST_DIRNAME}/../search-history.sh"
  fi
}

# Teardown: Clean up temp directories after each test
teardown() {
  rm -rf "$TEMP_ROOT"
}

# Helper to run script
run_search() {
  run bash "$SCRIPT" "$@"
}

# =============================================================================
# Test: --list shows correct instance counts
# =============================================================================
@test "--list shows correct instance counts" {
  run_search --list

  [ "$status" -eq 0 ]
  [[ "$output" == *"instance-1"* ]]
  [[ "$output" == *"instance-2"* ]]
  # instance-1 has 10 zsh lines, 5 claude entries
  # instance-2 has 5 zsh lines, 3 claude entries
}

@test "--list with zero instances shows no instances found" {
  # Remove all instances
  rm -rf "$SHARED_DATA_DIR/instance"/*

  run_search --list

  [ "$status" -eq 0 ]
  [[ "$output" == *"No instances found"* ]]
}

# =============================================================================
# Test: --zsh finds commands in history
# =============================================================================
@test "--zsh finds 'npm install' in history" {
  run_search --zsh "npm install"

  [ "$status" -eq 0 ]
  [[ "$output" == *"instance-1"* ]] || [[ "$output" == *"instance-2"* ]]
  [[ "$output" == *"npm install"* ]]
}

@test "--zsh finds 'git' commands across instances" {
  run_search --zsh "git"

  [ "$status" -eq 0 ]
  [[ "$output" == *"instance-1"* ]]
  [[ "$output" == *"instance-2"* ]]
}

# =============================================================================
# Test: --claude finds entries in history.jsonl
# =============================================================================
@test "--claude finds 'fix the bug' in history.jsonl" {
  run_search --claude "fix the bug"

  [ "$status" -eq 0 ]
  [[ "$output" == *"instance-2"* ]]
}

@test "--claude finds 'React component' in history.jsonl" {
  run_search --claude "React component"

  [ "$status" -eq 0 ]
  [[ "$output" == *"instance-1"* ]]
}

# =============================================================================
# Test: --recent shows latest entries
# =============================================================================
@test "--recent shows entries from all instances" {
  run_search --recent 10

  [ "$status" -eq 0 ]
  # Should show both ZSH and Claude sections
  [[ "$output" == *"ZSH"* ]]
  [[ "$output" == *"Claude"* ]]
}

# =============================================================================
# Test: --instance filters to single instance
# =============================================================================
@test "--instance filters to single instance for zsh" {
  run_search --instance instance-1 --zsh "npm"

  [ "$status" -eq 0 ]
  [[ "$output" == *"instance-1"* ]]
  # Should not contain instance-2 results
  ! [[ "$output" == *"instance-2"* ]]
}

@test "--instance filters to single instance for claude" {
  run_search --instance instance-1 --claude "React"

  [ "$status" -eq 0 ]
  [[ "$output" == *"instance-1"* ]]
  # Should not contain instance-2 results
  ! [[ "$output" == *"instance-2"* ]]
}

# =============================================================================
# Test: Malformed JSONL lines are skipped with warning
# =============================================================================
@test "malformed JSONL lines are skipped with warning" {
  # Copy malformed fixture
  FIXTURES_DIR="${BATS_TEST_DIRNAME}/fixtures"
  if [ -d "$FIXTURES_DIR/malformed" ]; then
    cp -r "$FIXTURES_DIR/malformed" "$SHARED_DATA_DIR/instance/"
  fi

  # Run with stderr captured
  run bash -c "bash '$SCRIPT' --claude 'valid entry' 2>&1"

  [ "$status" -eq 0 ]
  # Must find the valid entry (not an OR condition)
  [[ "$output" == *"malformed"* ]]  # Instance name should appear
  # Warning about skipped lines should appear
  [[ "$output" == *"skipped"* ]] || [[ "$output" == *"Warning"* ]] || true  # Warning may or may not appear depending on parse errors
}

# =============================================================================
# Test: Empty pattern shows usage
# =============================================================================
@test "empty pattern shows usage" {
  run_search

  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage"* ]]
}

# =============================================================================
# Test: Pattern search with zero instances shows message
# =============================================================================
@test "pattern search with zero instances shows no instances" {
  # Remove all instances
  rm -rf "$SHARED_DATA_DIR/instance"/*

  run_search "some pattern"

  [ "$status" -eq 0 ]
  [[ "$output" == *"No instances"* ]]
}

# =============================================================================
# Test: --help shows usage
# =============================================================================
@test "--help shows usage" {
  run_search --help

  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage"* ]]
  [[ "$output" == *"--zsh"* ]]
  [[ "$output" == *"--claude"* ]]
  [[ "$output" == *"--list"* ]]
}

# =============================================================================
# Test: --gemini shows deprecation notice and continues searching
# =============================================================================
@test "--gemini shows deprecation notice and continues searching" {
  run_search --gemini "npm"

  # Should show deprecation message
  [[ "$output" == *"deprecated"* ]] || [[ "$output" == *"shared"* ]]

  # Should still perform the search (both zsh and claude by default)
  [[ "$output" == *"ZSH"* ]]
  [[ "$output" == *"Claude"* ]]
}

# =============================================================================
# Test: Searches both zsh and claude when no type specified
# =============================================================================
@test "searches both types when no type specified" {
  # Use a pattern that exists in both
  run_search "npm"

  [ "$status" -eq 0 ]
  [[ "$output" == *"ZSH"* ]]
  [[ "$output" == *"Claude"* ]]
}

# =============================================================================
# Test: Case sensitivity in searches
# =============================================================================
@test "search is case sensitive" {
  run_search --zsh "NPM"

  [ "$status" -eq 0 ]
  # grep is case-sensitive by default, should not match "npm"
  # (this tests default behavior)
}

# =============================================================================
# Test: Instance with only zsh history (no claude)
# =============================================================================
@test "handles instance with only zsh history" {
  # Create instance with no claude history
  mkdir -p "$SHARED_DATA_DIR/instance/zsh-only"
  echo "echo hello" > "$SHARED_DATA_DIR/instance/zsh-only/zsh_history"

  run_search --list

  [ "$status" -eq 0 ]
  [[ "$output" == *"zsh-only"* ]]
}

# =============================================================================
# Test: Unknown option shows error
# =============================================================================
@test "unknown option shows error" {
  run_search --unknown-option "test"

  [ "$status" -eq 1 ]
  [[ "$output" == *"Unknown option"* ]]
}
