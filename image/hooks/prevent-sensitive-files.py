#!/usr/bin/env python3
"""
prevent-sensitive-files.py

PreToolUse hook for Read, Edit, and Write tools that prevents access to files
containing credentials, keys, and secrets.

This provides defense-in-depth alongside the existing permissions system in
.claude/settings.json. While permissions can be bypassed with user approval,
this hook provides hard blocks with informative error messages to Claude.

Exit codes:
    0 - File access is allowed
    2 - File access is blocked (provides feedback to Claude)
"""

import json
import os
import sys

# Add lib directory to path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LIB_DIR = os.path.join(SCRIPT_DIR, 'lib')
sys.path.insert(0, LIB_DIR)

from patterns import is_sensitive_file

def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get('tool_name', '')
    tool_input = input_data.get('tool_input', {})

    # Only process Read, Edit, and Write tools
    if tool_name not in ['Read', 'Edit', 'Write']:
        sys.exit(0)

    # Get file path from tool input
    file_path = tool_input.get('file_path', '')
    if not file_path:
        sys.exit(0)

    # Normalize path for consistent matching
    # Remove leading ./ and resolve relative paths
    normalized_path = os.path.normpath(file_path)

    # Check if file matches sensitive patterns
    if is_sensitive_file(normalized_path):
        file_name = os.path.basename(normalized_path)
        print(f"""🚫 Access to sensitive file blocked by safety hook.

Cannot {tool_name.lower()} file: {file_path}

This file matches patterns for sensitive data (credentials, keys, secrets).
Accessing such files could lead to credential leakage through AI responses or logs.

File: {file_name}
Path: {normalized_path}

Common sensitive file patterns:
- Environment files: .env, .env.*, secrets.*
- Private keys: *.pem, *.key, id_rsa, id_ed25519
- Credentials: credentials.json, .aws/credentials, .kube/config
- Shell configs: .bashrc, .zshrc (may contain credentials)

If you need to access this file:
1. Verify it doesn't contain actual secrets (use cat, less, or your editor directly)
2. If it contains secrets, extract only non-sensitive configuration
3. Use environment variables or secret management tools instead of files
4. Ask the user for explicit permission if absolutely necessary

For secret management best practices, see:
- docs/commit_specification.md (Git Commit Policy section)
- AI-README.md (Development Environment section)
""", file=sys.stderr)
        sys.exit(2)

    # File access is allowed
    sys.exit(0)

if __name__ == '__main__':
    main()
