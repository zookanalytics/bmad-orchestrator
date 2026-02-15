#!/usr/bin/env python3
"""
prevent-bash-sensitive-args.py

PreToolUse hook for Bash commands that prevents any bash command from
referencing sensitive filenames as arguments.

This prevents bypassing file access controls via indirect operations like:
- mv credentials.json safe.json (rename to bypass read protection)
- cp .env .env.backup (copy sensitive files)
- cat id_rsa (read via bash instead of Read tool)
- rm secrets.txt (delete sensitive files)

The hook parses command syntax using shlex to extract tokens, then checks
each token against sensitive filename patterns. It also handles command
substitution by recursively checking content inside $(...) and backticks.

Exit codes:
    0 - Command is allowed
    2 - Command is blocked (provides feedback to Claude)
"""

import json
import os
import shlex
import sys

# Add lib directory to path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LIB_DIR = os.path.join(SCRIPT_DIR, 'lib')
sys.path.insert(0, LIB_DIR)

from patterns import is_sensitive_file


def extract_command_substitutions(token: str) -> list[str]:
    """
    Extract inner commands from $(...) and backtick substitutions.

    Handles both styles of command substitution:
    - Modern: $(command)
    - Legacy: `command`

    Args:
        token: A shell token that may contain command substitutions

    Returns:
        List of inner command strings extracted from substitution constructs
    """
    results = []
    i = 0
    while i < len(token):
        if token[i:i+2] == '$(':
            # Handle $(...) - find matching ) by counting depth
            depth = 1
            start = i + 2
            j = start
            while j < len(token) and depth > 0:
                if token[j:j+2] == '$(':
                    depth += 1
                    j += 1
                elif token[j] == ')':
                    depth -= 1
                j += 1
            if depth == 0:
                # Extract the inner command (excluding the closing paren)
                results.append(token[start:j-1])
            i = j
        elif token[i] == '`':
            # Handle backtick substitution - find matching backtick
            start = i + 1
            j = start
            while j < len(token) and token[j] != '`':
                j += 1
            if j < len(token):
                # Found closing backtick
                results.append(token[start:j])
                i = j + 1
            else:
                i += 1
        else:
            i += 1
    return results


def parse_command_tokens(command: str) -> list[str]:
    """
    Parse command into tokens using shlex.

    Raises:
        ValueError: If command is malformed (unclosed quotes, etc.)
    """
    return shlex.split(command, posix=True)


def contains_sensitive_filename(command: str, _depth: int = 0) -> tuple[bool, str]:
    """
    Check if command contains any sensitive filename pattern.

    Uses shlex to properly tokenize the command, handling quoted strings
    and escapes. Each token is checked against sensitive file patterns,
    with safe patterns (like .env.example) allowed through.

    Command substitutions $(...) and backticks are recursively parsed
    and checked.

    Args:
        command: The shell command to check
        _depth: Internal recursion depth counter (max 10)

    Returns:
        Tuple of (is_sensitive, matched_token)
        - is_sensitive: True if command contains sensitive filename
        - matched_token: The token/reason that matched (empty if none)

    Raises:
        ValueError: If command syntax is malformed
    """
    # Prevent infinite recursion - fail closed for security
    if _depth > 10:
        return True, "recursion depth exceeded"

    for token in parse_command_tokens(command):
        # Check for command substitutions - recursively check inner content
        inner_commands = extract_command_substitutions(token)
        if inner_commands:
            for inner_cmd in inner_commands:
                is_sensitive, match = contains_sensitive_filename(inner_cmd, _depth + 1)
                if is_sensitive:
                    return True, f"{match} (in substitution)"

        # Always check the token itself (even if it contains substitutions)
        # This catches cases like "$(echo foo).env" where .env is in outer token
        if is_sensitive_file(token):
            return True, token

    return False, ""


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get('tool_name', '')
    tool_input = input_data.get('tool_input', {})

    # Only process Bash commands
    if tool_name != 'Bash':
        sys.exit(0)

    command = tool_input.get('command', '')
    if not command:
        sys.exit(0)

    # Check if command contains sensitive filename patterns
    try:
        is_sensitive, matched_pattern = contains_sensitive_filename(command)
    except ValueError as e:
        print(f"""🚫 Bash command blocked: malformed command syntax.

Could not parse command (unclosed quotes, invalid escapes, etc.)

Parse error: {e}
Command: {command}

Fix the command syntax and try again.
""", file=sys.stderr)
        sys.exit(2)

    if is_sensitive:
        print(f"""🚫 Bash command blocked: contains sensitive filename pattern.

The command references a file that matches sensitive file patterns.
This is blocked to prevent bypassing file access controls.

Matched pattern: {matched_pattern}

Command: {command}

Why this is blocked:
Bash commands can bypass Read/Edit/Write hooks by directly accessing files.
Common bypass scenarios:
- mv credentials.json safe.json (rename to bypass read protection)
- cp .env .env.backup (copy sensitive files)
- cat id_rsa (read via bash instead of Read tool)
- rm secrets.txt (delete sensitive files)

To prevent these bypasses, ALL bash commands referencing sensitive filenames
are blocked, regardless of the operation.

Sensitive file patterns include:
- Environment files: .env, .env.* (except .env.example, .env.template, etc.)
- Credentials: credentials.json, secrets.*, *.key, *.pem
- Private keys: id_rsa, id_ed25519, *.key
- Cloud credentials: .aws/credentials, .kube/config
- Shell configs: .bashrc, .zshrc

If you need to perform operations on sensitive files:
1. Ask the user to perform the operation manually
2. Explain why you need access to the sensitive file
3. User can execute commands directly in their terminal
4. For reading files, explain what information you need without accessing the file

This protection ensures sensitive files are never exposed through autonomous
AI operations, even via indirect command-line access.
""", file=sys.stderr)
        sys.exit(2)

    # Command is safe - allow it
    sys.exit(0)


if __name__ == '__main__':
    main()
