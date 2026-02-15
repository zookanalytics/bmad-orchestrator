#!/bin/bash
#
# prevent-admin-flag.sh
#
# PreToolUse hook for Bash commands that prevents using --admin flag with GitHub CLI.
# The --admin flag bypasses GitHub branch protection rules, undermining repository
# safety controls. This hook ensures AI agents cannot use administrative overrides.
#
# Exit codes:
#   0 - Command is allowed
#   2 - Command is blocked (provides feedback to agent)

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

# Check if this is a gh command with --admin flag
if echo "$command" | grep -qE '^\s*gh\s+.*--admin\b'; then
    cat >&2 <<EOF
🚫 GitHub CLI --admin flag blocked by safety hook.

Cannot use --admin flag with GitHub CLI commands. This flag bypasses GitHub
branch protection rules and must not be used by autonomous AI operations.

Blocked command: $command

Why this is blocked:
The --admin flag overrides branch protection settings including:
- Required status checks
- Required reviews
- Restrictions on who can push

This undermines repository safety controls designed to ensure code quality
and proper review processes.

Recommended alternatives:
1. Wait for CI checks to complete:
   gh pr checks --watch

2. Fix failing checks instead of bypassing:
   - Review test failures
   - Fix linting/formatting issues
   - Address review feedback

3. Use proper workflow without overrides:
   gh pr merge <number>

4. Ask user to merge manually if urgent:
   User can use --admin flag in their terminal if truly necessary

Branch protection rules exist for good reason. Do not bypass them.
EOF
    exit 2
fi

# Command is safe - allow it
exit 0
