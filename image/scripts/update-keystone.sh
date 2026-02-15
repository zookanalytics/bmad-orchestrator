#!/bin/bash
set -euo pipefail

# Track update failures (non-fatal - container continues with existing versions)
UPDATE_FAILURES=0

echo "Updating keystone packages..."
# Note: bun global installs may change paths from ~/.local/lib to ~/.bun/install/global
# This is acceptable - postinstall.sh uses cp -f to overwrite existing files

if ! bun install -g github:ZookAnalytics/keystone-cli; then
  echo "⚠ keystone-cli update failed, using existing version"
  UPDATE_FAILURES=$((UPDATE_FAILURES + 1))
fi

# keystone-workflows is in a monorepo subdirectory - clone and run postinstall directly
TEMP_DIR=$(mktemp -d)
if git clone --depth 1 --filter=blob:none --sparse https://github.com/ZookAnalytics/claude-devcontainer.git "$TEMP_DIR" 2>/dev/null && \
   cd "$TEMP_DIR" && \
   git sparse-checkout set packages/keystone-workflows && \
   cd packages/keystone-workflows && \
   ./scripts/postinstall.sh; then
  echo "✓ keystone-workflows updated"
else
  echo "⚠ keystone-workflows update failed, using existing version"
  UPDATE_FAILURES=$((UPDATE_FAILURES + 1))
fi
rm -rf "$TEMP_DIR"

# Log versions for debugging
echo "---"
echo "keystone-cli: $(keystone --version 2>/dev/null || echo 'not installed')"
# Workflows version from package.json (if installed locally) or symlink target
WORKFLOWS_PKG="$HOME/.local/lib/keystone-workflows/package.json"
if [ -f "$WORKFLOWS_PKG" ]; then
  echo "keystone-workflows: $(grep '"version"' "$WORKFLOWS_PKG" | head -1 | sed 's/.*: *"\([^"]*\)".*/\1/')"
else
  echo "keystone-workflows: (installed via bun global)"
fi
echo "workflows path: $(ls -l ~/.keystone/workflows/*.yaml 2>/dev/null | head -1 || echo 'not found')"

# Report update status (exit 0 for graceful degradation per AC5)
if [ "$UPDATE_FAILURES" -gt 0 ]; then
  echo "⚠ $UPDATE_FAILURES update(s) failed - using existing versions"
fi
