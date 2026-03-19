#!/usr/bin/env bash
#
# enforce-commit-skill.sh
#
# PreToolUse hook for Bash commands that ensures the git-commit skill
# workflow is followed before any git commit.
#
# The state file lives in /tmp keyed by repo path hash, avoiding writes
# to .claude/ (which triggers permission prompts) and keeping it out of
# the repo tree entirely.
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

# Only process shell commands (Bash for Claude, run_shell_command for Gemini)
if [[ "$tool_name" != "Bash" && "$tool_name" != "run_shell_command" ]]; then
    exit 0
fi

# Match only actual git commit invocations, not strings containing "git" and "commit"
# Matches: git commit, git -C path commit, git --no-pager commit
# Anchored to command boundaries: start of line, after &&, ||, ;, |, or $()
# Does NOT match: echo "git commit", grep "git commit", cat > file with git commit
if ! echo "$command" | grep -qP '(?:^|&&|\|\||;|\||\$\()\s*git\s(?:[^;|&]*\s)?commit\b'; then
    exit 0
fi

# Allow git commit --amend (special case for pre-commit hook fixes)
# The boundary anchor already prevents false positives, so .*? is safe here
if echo "$command" | grep -qP '(?:^|&&|\|\||;|\||\$\()\s*git\s(?:[^;|&]*\s)?commit\s.*--amend'; then
    exit 0
fi

# Get git repository root
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo "Warning: Not in a git repository, skipping commit validation" >&2
    exit 0
}

# State file in /tmp, keyed by repo path hash
REPO_HASH=$(echo -n "$GIT_ROOT" | md5sum | cut -d' ' -f1)
STATE_FILE="/tmp/.commit-state-${REPO_HASH}"

# Check if state file exists
if [[ ! -f "$STATE_FILE" ]]; then
    cat >&2 <<EOF
🚫 Commit blocked - git-commit skill not followed

You MUST use the 'git-commit' skill before committing.

Required workflow:
1. Use Skill tool: Skill(git-commit)
2. Follow ALL checklist steps:
   - Run quality checks
   - Review changes with 'git diff'
   - Stage files with 'git add <files>'
   - Preview staged changes with 'git diff --staged'
   - Touch state file: $STATE_FILE
   - Create commit

Never skip this workflow - even for "simple" changes.
EOF
    exit 2
fi

# Verify state file is recent (within last 5 minutes)
# Note: md5sum and stat -c are Linux-specific; this hook runs in the container image
file_age=$(($(date +%s) - $(stat -c %Y "$STATE_FILE")))

if [[ $file_age -gt 300 ]]; then
    cat >&2 <<EOF
🚫 Commit blocked - stale commit state

The commit state file is older than 5 minutes.

Please re-run the 'git-commit' skill to ensure fresh validation
before committing.

Run: Skill(git-commit)
EOF
    rm -f "$STATE_FILE"
    exit 2
fi

# Allow commit to proceed
exit 0
