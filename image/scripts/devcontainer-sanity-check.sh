#!/bin/bash
# DevContainer sanity check - extensible script verifying container expectations
# Add checks as container capabilities grow
set -u  # Fail on undefined variables

PASS=0
FAIL=0

check() {
  if eval "$2" > /dev/null 2>&1; then
    echo "✓ $1"
    PASS=$((PASS + 1))
  else
    echo "✗ $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "Running DevContainer sanity checks..."
echo "---"

# Core runtimes
check "bun runtime" "bun --version"
check "node runtime" "node --version"
check "pnpm runtime" "pnpm --version"

# Keystone
check "keystone binary" "keystone --version"
check "keystone workflows exist" "ls ~/.keystone/workflows/bmad-*.yaml"
check "keystone workflow discovery" "keystone run --list 2>/dev/null | grep -q bmad"
check "keystone config exists" "test -f ~/.config/keystone/config.yaml"

# AI CLIs
check "claude cli" "command -v claude"
check "gemini cli" "command -v gemini"

# DevContainer tools
check "git available" "git --version"
check "gh cli available" "gh --version"

echo "---"
echo "Passed: $PASS, Failed: $FAIL"
[ $FAIL -eq 0 ]
