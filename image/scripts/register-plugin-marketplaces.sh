#!/bin/bash
# register-plugin-marketplaces.sh
# Auto-registers Claude Code plugin marketplaces defined in project settings.
#
# Reads extraKnownMarketplaces from <workspace>/.claude/settings.json and
# registers each via `claude plugin marketplace add` so enabled plugins
# resolve without manual intervention.
#
# Usage: register-plugin-marketplaces.sh [workspace-root]

set -euo pipefail

WORKSPACE_ROOT="${1:-${WORKSPACE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}}"
PROJECT_SETTINGS="$WORKSPACE_ROOT/.claude/settings.json"

if ! command -v claude >/dev/null 2>&1; then
  echo "  Claude Code not installed, skipping marketplace registration"
  exit 0
fi

if [ ! -f "$PROJECT_SETTINGS" ]; then
  echo "  No project settings found at $PROJECT_SETTINGS"
  exit 0
fi

# Extract name+URL pairs from extraKnownMarketplaces
if ! ENTRIES=$(jq -r '
  .extraKnownMarketplaces // {} |
  to_entries[] |
  select(.value.source.source == "git") |
  "\(.key)\t\(.value.source.url)"
' "$PROJECT_SETTINGS" 2>&1); then
  echo "  ⚠ Failed to parse $PROJECT_SETTINGS: $ENTRIES"
  exit 0
fi

if [ -z "$ENTRIES" ]; then
  echo "  No extraKnownMarketplaces defined in project settings"
  exit 0
fi

# Registration: remove first to avoid "already installed" errors, then add
while IFS=$'\t' read -r name url; do
  echo "  Registering marketplace: $name ($url)"
  timeout 10 claude plugin marketplace remove "$name" 2>/dev/null || true
  if output=$(timeout 30 claude plugin marketplace add "$url" 2>&1); then
    echo "  ✓ Registered: $name"
  else
    echo "  ⚠ Failed to register: $name"
    echo "    $output"
  fi
done <<< "$ENTRIES"
