#!/bin/bash
set -euo pipefail
# Fix ownership of node_modules volume for the node user
# This runs once during container creation

# Detect workspace root - environment variable or git root fallback
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Safety check: only proceed if WORKSPACE_ROOT looks like a valid workspace path
# This prevents dangerous chown operations on system directories
# Matches: /workspaces, /workspaces/*
if [[ ! "$WORKSPACE_ROOT" =~ ^/workspaces(/|$) || ! -d "$WORKSPACE_ROOT" ]]; then
    echo "Warning: WORKSPACE_ROOT ($WORKSPACE_ROOT) is not a valid workspace path, skipping"
    exit 0
fi

chown -R node:node "$WORKSPACE_ROOT/node_modules" 2>/dev/null || true
