#!/usr/bin/env python3
"""
patterns.py

Shared pattern library for Claude Code safety hooks.
Contains common patterns for detecting sensitive files and environment variables.
"""

import re
from typing import List, Pattern

# Safe environment file patterns (templates/examples without real secrets)
# These should be checked BEFORE sensitive patterns to allow safe template files
SAFE_ENV_FILE_PATTERNS: List[str] = [
    r'\.env\.example$',
    r'\.env\.template$',
    r'\.env\.sample$',
    r'\.env\.local\.example$',
    r'\.env\.dist$',
    r'env\.example$',
    r'env\.template$',
    r'env\.sample$',
]

# Sensitive file patterns
# These patterns match files that commonly contain credentials, keys, or secrets
SENSITIVE_FILE_PATTERNS: List[str] = [
    # Environment files
    r'\.env(\.|$)',
    r'\.env\..*',

    # Credential files
    r'credentials\.json',
    r'credentials\.ya?ml',
    r'secrets\.',
    r'secret\.',

    # Private keys and certificates
    r'\.(pem|key|p12|pfx|crt|cer|der)$',
    r'.*\.key$',
    r'.*_key$',
    r'.*-key$',

    # SSH keys
    r'id_(rsa|ed25519|ecdsa)',
    r'\.ssh/.*_key$',
    r'\.ssh/id_',

    # Cloud provider credentials
    r'\.aws/credentials',
    r'\.aws/config',
    r'\.azure/credentials',
    r'\.gcp/.*\.json$',
    r'gcloud.*\.json$',

    # Docker and Kubernetes secrets
    r'docker/config\.json$',
    r'\.docker/config\.json$',
    r'\.kube/config$',
    r'kubeconfig',

    # Database credentials
    r'\.pgpass',
    r'\.my\.cnf',
    r'\.mongodb/.*',

    # API tokens and keys
    r'\.npmrc',
    r'\.pypirc',
    r'\.gem/credentials',

    # Shell configuration (may contain credentials)
    r'\.bashrc',
    r'\.zshrc',
    r'\.profile',
    r'\.bash_profile',

    # Git credentials
    r'\.git-credentials',
    r'\.netrc',
]

# Sensitive environment variable patterns
# These patterns match environment variable names that commonly contain secrets
SENSITIVE_ENV_PATTERNS: List[str] = [
    r'.*KEY.*',
    r'.*SECRET.*',
    r'.*TOKEN.*',
    r'.*PASSWORD.*',
    r'.*PASS.*',
    r'.*PWD.*',
    r'.*API.*',
    r'.*AUTH.*',
    r'.*CREDENTIAL.*',
    r'.*PRIVATE.*',
    r'.*CERT.*',
    r'.*SALT.*',
    r'.*HASH.*',
    r'.*SIGNATURE.*',
    r'.*SIGNING.*',
]

# Safe environment variables (allow-list)
# These are common non-sensitive environment variables
SAFE_ENV_VARS: List[str] = [
    'HOME',
    'USER',
    'PATH',
    'PWD',
    'SHELL',
    'TERM',
    'LANG',
    'LC_.*',
    'TZ',
    'EDITOR',
    'VISUAL',
    'PAGER',
    'NODE_ENV',
    'ENV',
    'ENVIRONMENT',
    'DEBUG',
    'LOG_LEVEL',
    'PORT',
    'HOST',
    'HOSTNAME',
]

def compile_patterns(patterns: List[str]) -> List[Pattern]:
    """Compile a list of regex pattern strings into Pattern objects."""
    return [re.compile(pattern, re.IGNORECASE) for pattern in patterns]

def matches_any_pattern(text: str, patterns: List[Pattern]) -> bool:
    """Check if text matches any of the compiled patterns."""
    return any(pattern.search(text) for pattern in patterns)

def is_sensitive_file(file_path: str) -> bool:
    """
    Check if a file path matches any sensitive file pattern.

    Safe template files (e.g., .env.example) are checked first and allowed.
    Only files matching sensitive patterns without matching safe patterns are blocked.

    Args:
        file_path: Path to check

    Returns:
        True if the path matches a sensitive pattern and is NOT a safe template,
        False otherwise
    """
    # Check safe patterns first - if it matches, allow it
    safe_patterns = compile_patterns(SAFE_ENV_FILE_PATTERNS)
    if matches_any_pattern(file_path, safe_patterns):
        return False

    # Now check if it matches sensitive patterns
    compiled_patterns = compile_patterns(SENSITIVE_FILE_PATTERNS)
    return matches_any_pattern(file_path, compiled_patterns)

def is_sensitive_env_var(var_name: str) -> bool:
    """
    Check if an environment variable name is potentially sensitive.

    Args:
        var_name: Environment variable name to check

    Returns:
        True if the variable name matches a sensitive pattern and is not
        in the safe variables allow-list, False otherwise
    """
    # Check if it's in the safe list first
    safe_patterns = compile_patterns(SAFE_ENV_VARS)
    if matches_any_pattern(var_name, safe_patterns):
        return False

    # Check if it matches a sensitive pattern
    sensitive_patterns = compile_patterns(SENSITIVE_ENV_PATTERNS)
    return matches_any_pattern(var_name, sensitive_patterns)
