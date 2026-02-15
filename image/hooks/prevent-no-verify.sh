#!/bin/bash
#
# prevent-no-verify.sh
#
# PreToolUse hook for Bash commands that prevents bypassing pre-commit hooks.
# Enforces the project policy documented in AI-README.md that git commit --no-verify
# should never be used without explicit user permission.
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

# Check if this is a git commit command with --no-verify or -n flag
if echo "$command" | grep -qE '^\s*git\s+commit.*(-n\b|--no-verify)'; then
    cat >&2 <<EOF
🚫 Git commit --no-verify blocked by safety hook.

Cannot bypass pre-commit hooks with --no-verify or -n flag. Pre-commit hooks
enforce code quality standards (linting, formatting, tests) and must not be
bypassed without explicit user approval.

Project policy (from AI-README.md):
"IMPORTANT: NEVER use 'git commit --no-verify' without explicitly asking
for permission first in bold text."

Recommended workflow:
1. Run automated fixes:
   pnpm fix

2. Verify quality checks pass:
   pnpm check

3. Review changes before committing:
   git diff --staged

4. Commit without --no-verify flag:
   git commit -m "your message"

If pre-commit hooks are failing:
- Fix the underlying issues instead of bypassing checks
- Run 'pnpm fix' to auto-fix formatting and linting
- Check test failures with 'pnpm test'

Only bypass hooks with explicit user permission for exceptional circumstances.
EOF
    exit 2
fi

# Command is safe - allow it
exit 0
