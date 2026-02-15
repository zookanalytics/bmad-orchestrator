#!/bin/bash
#
# prevent-main-push.sh
#
# PreToolUse hook for Bash commands that prevents pushing to main/master branches.
# This provides an additional safety layer beyond existing permissions to protect
# the production branch from accidental or autonomous changes.
#
# Exit codes:
#   0 - Command is allowed
#   2 - Command is blocked (provides feedback to Claude)

set -euo pipefail

# Read JSON input from stdin
input=$(cat)

# Extract tool name and command from JSON
tool_name=$(echo "$input" | jq -r '.tool_name // ""')
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# Only process Bash commands
if [[ "$tool_name" != "Bash" ]]; then
    exit 0
fi

# Check if this is a git push command
if ! echo "$command" | grep -qE '^\s*git\s+push'; then
    exit 0
fi

# Get current branch
current_branch=$(git branch --show-current 2>/dev/null || echo "")

# Check if pushing to main or master branch
# Patterns to detect:
# - git push (implicit current branch)
# - git push origin main
# - git push origin master
# - git push -u origin main
# - git push --set-upstream origin main

protected_branches="main|master"

# Check if pushing current branch to protected branch
if [[ "$current_branch" =~ ^(main|master)$ ]]; then
    # On a protected branch - block any push without explicit branch
    if echo "$command" | grep -qE 'git\s+push(\s+(origin|--all|--tags|-[a-z]+))*\s*$'; then
        cat >&2 <<EOF
🚫 Push to '$current_branch' branch blocked by safety hook.

Cannot push to protected branch '$current_branch'. This branch is protected to prevent
accidental or autonomous changes to production code.

Recommended alternatives:
1. Create a feature branch:
   git checkout -b feat/my-feature
   git push -u origin feat/my-feature

2. Use GitHub PR workflow:
   Create a pull request from a feature branch instead

If you need to push to $current_branch, please:
- Ensure changes are reviewed
- Use the GitHub CLI: gh pr merge <number>
- Or manually merge via GitHub web interface

Protected branches: main, master
EOF
        exit 2
    fi
fi

# Check for explicit pushes to protected branches
if echo "$command" | grep -qE "git\s+push.*\s+(origin\s+)?(${protected_branches})\b"; then
    cat >&2 <<EOF
🚫 Push to protected branch blocked by safety hook.

Cannot push to main/master branch. This branch is protected to prevent
accidental or autonomous changes to production code.

Recommended alternatives:
1. Create a feature branch:
   git checkout -b feat/my-feature
   git push -u origin feat/my-feature

2. Use GitHub PR workflow:
   Create a pull request from a feature branch instead

Protected branches: main, master
EOF
    exit 2
fi

# Command is safe - allow it
exit 0
