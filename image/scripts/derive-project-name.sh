#!/bin/bash
set -euo pipefail

# Derive project name from git remote origin URL
# Usage: derive-project-name.sh [repo-path]
# Output: lowercase project name suitable for Docker naming

REPO_PATH="${1:-.}"

cd "$REPO_PATH"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "ERROR: Not a git repository: $REPO_PATH" >&2
    exit 1
fi

REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || true)

if [ -z "$REMOTE_URL" ]; then
    echo "ERROR: No remote origin configured" >&2
    exit 1
fi

# Extract repo name from URL
# Handles: git@github.com:owner/repo.git, https://github.com/owner/repo.git, https://github.com/owner/repo
PROJECT_NAME=$(echo "$REMOTE_URL" | sed -E 's#.*/([^/]+?)(\.git)?$#\1#' | tr '[:upper:]' '[:lower:]' | tr -s ' _/' '-')

if [ -z "$PROJECT_NAME" ]; then
    echo "ERROR: Could not extract project name from: $REMOTE_URL" >&2
    exit 1
fi

echo "$PROJECT_NAME"
