#!/usr/bin/env python3
"""
prevent-env-leakage.py

PreToolUse hook for Bash commands that prevents leakage of sensitive environment
variables through command output.

Environment variables often contain API keys, tokens, passwords, and other secrets.
This hook blocks commands that would expose these values through stdout, which could
leak credentials through AI responses or logs.

Exit codes:
    0 - Command is allowed
    2 - Command is blocked (provides feedback to Claude)
"""

import json
import os
import re
import sys

# Add lib directory to path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LIB_DIR = os.path.join(SCRIPT_DIR, 'lib')
sys.path.insert(0, LIB_DIR)

from patterns import is_sensitive_env_var

# Patterns for detecting environment variable access in bash commands
ENV_ACCESS_PATTERNS = [
    # Direct variable expansion: $VAR or ${VAR}
    r'\$\{?([A-Z_][A-Z0-9_]*)\}?',

    # printenv command: printenv VAR
    r'\bprintenv\s+([A-Z_][A-Z0-9_]*)',

    # printenv without arguments (dumps all vars)
    r'\bprintenv\s*($|\||>)',

    # export -p (prints all exported variables)
    r'\bexport\s+-p\b',

    # env command without assignment
    r'\benv\s*$',
    r'\benv\s+\|',
    r'\benv\s+>',

    # Process environment file access
    r'/proc/self/environ',
    r'/proc/\d+/environ',

    # Command substitution with env
    r'\$\(\s*env\s*\)',
    r'`\s*env\s*`',
]

# Patterns for assignments (these are OK - setting, not reading)
ASSIGNMENT_PATTERNS = [
    r'^[A-Z_][A-Z0-9_]*=',  # VAR=value
    r'\bexport\s+[A-Z_][A-Z0-9_]*=',  # export VAR=value
]

def extract_referenced_vars(command: str) -> set:
    """
    Extract all environment variable names referenced in a command.

    Args:
        command: The bash command to analyze

    Returns:
        Set of environment variable names found in the command
    """
    vars_found = set()

    # Check for direct variable references: $VAR or ${VAR}
    var_pattern = re.compile(r'\$\{?([A-Z_][A-Z0-9_]*)\}?')
    for match in var_pattern.finditer(command):
        var_name = match.group(1)
        vars_found.add(var_name)

    # Check for printenv VAR
    printenv_pattern = re.compile(r'\bprintenv\s+([A-Z_][A-Z0-9_]*)')
    for match in printenv_pattern.finditer(command):
        var_name = match.group(1)
        vars_found.add(var_name)

    return vars_found

def is_assignment_only(command: str) -> bool:
    """
    Check if command only assigns variables without reading them.

    Args:
        command: The bash command to check

    Returns:
        True if command only assigns variables, False otherwise
    """
    for pattern in ASSIGNMENT_PATTERNS:
        if re.match(pattern, command.strip()):
            return True
    return False

def accesses_all_env_vars(command: str) -> bool:
    """
    Check if command attempts to access all environment variables.

    Commands like 'env', 'export -p', 'printenv', reading /proc/self/environ
    dump all environment variables, which would expose all secrets.

    Args:
        command: The bash command to check

    Returns:
        True if command accesses all env vars, False otherwise
    """
    # Check for bare 'env' command (not in assignment)
    if re.search(r'\benv\s*($|\|)', command):
        return True

    # Check for bare 'printenv' command (without arguments)
    if re.search(r'\bprintenv\s*($|\||>)', command):
        return True

    # Check for export -p
    if re.search(r'\bexport\s+-p\b', command):
        return True

    # Check for /proc/*/environ access
    if re.search(r'/proc/(self|\d+)/environ', command):
        return True

    # Check for command substitution with env
    if re.search(r'\$\(\s*env\s*\)', command) or re.search(r'`\s*env\s*`', command):
        return True

    return False

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

    # Allow pure assignments (setting vars, not reading)
    if is_assignment_only(command):
        sys.exit(0)

    # Block commands that access all environment variables
    if accesses_all_env_vars(command):
        print("""🚫 Command blocked: attempts to access all environment variables.

Commands that dump all environment variables are blocked to prevent credential leakage.

Blocked command patterns:
- env (without assignment)
- printenv (without arguments)
- export -p (lists all exported variables)
- cat /proc/self/environ
- $(env) or `env` in command substitution

Environment variables often contain:
- API keys and tokens
- Database passwords
- Cloud credentials
- Authentication secrets

Why this is dangerous:
Environment variables are commonly used to pass secrets to applications.
Exposing all environment variables would leak these secrets through AI
responses or logs.

Alternatives:
1. Access specific non-sensitive variables:
   echo $HOME
   echo $USER
   echo $PATH

2. Check if a variable is set (without showing value):
   [ -z "$VAR_NAME" ] && echo "not set" || echo "is set"

3. Use dedicated secret management:
   - Load secrets from .env files (but don't display them)
   - Use cloud provider secret managers
   - Use environment variable only for application consumption

If you need to inspect environment for debugging:
- Ask user to check environment variables manually
- Access specific variables known to be non-sensitive
- Use grep to filter for specific non-sensitive patterns
""", file=sys.stderr)
        sys.exit(2)

    # Extract and check specific variable references
    referenced_vars = extract_referenced_vars(command)

    if referenced_vars:
        sensitive_vars = [var for var in referenced_vars if is_sensitive_env_var(var)]

        if sensitive_vars:
            var_list = ', '.join(sorted(sensitive_vars))
            print(f"""🚫 Command blocked: attempts to access sensitive environment variable(s).

Sensitive variables detected: {var_list}

Environment variables with names containing these keywords are blocked:
KEY, SECRET, TOKEN, PASSWORD, PASS, PWD, API, AUTH, CREDENTIAL,
PRIVATE, CERT, SALT, HASH, SIGNATURE, SIGNING

These variables typically contain credentials that should not be exposed
through command output, as they could leak through AI responses or logs.

Blocked command:
{command}

Why this is dangerous:
Environment variables are a common way to pass secrets to applications.
Displaying these values could expose:
- API keys and authentication tokens
- Database passwords
- Cloud provider credentials
- Signing keys and certificates
- Other authentication secrets

Alternatives:
1. Use the application's built-in secret loading (not display)
2. Access non-sensitive configuration variables instead
3. Check if variable exists without showing value:
   [ -z "$VAR_NAME" ] && echo "not set" || echo "is set"

4. If you absolutely need the value:
   - Ask the user to provide it manually
   - Load from secure secret management system
   - Use cloud provider's secret manager APIs

Safe environment variables you CAN access:
HOME, USER, PATH, PWD, SHELL, TERM, NODE_ENV, PORT, HOST, DEBUG, LOG_LEVEL
""", file=sys.stderr)
            sys.exit(2)

    # Command is safe - allow it
    sys.exit(0)

if __name__ == '__main__':
    main()
