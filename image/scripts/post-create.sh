#!/bin/bash
set -euo pipefail

# Post-create command for Claude DevContainer base image
# Handles initialization tasks after container creation
# Projects can extend via <workspace>/.devcontainer/post-create-project.sh

# Detect workspace root - environment variable or git root fallback
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Prevent Corepack from prompting during package installations
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

echo "==============================================="
echo "Starting Claude DevContainer post-create setup..."
echo "==============================================="

# Step 1: Fix SSH agent socket permissions (if mounted)
echo ""
echo "[1/13] Fixing SSH agent socket permissions..."
sudo /usr/local/bin/fix-ssh-socket-permissions.sh

# Step 2: Assemble Claude Code managed settings
echo ""
echo "[2/13] Assembling Claude Code managed settings..."
sudo /usr/local/bin/assemble-managed-settings.sh
echo "✓ Managed settings assembled"

# Step 3: Instance isolation (if applicable)
echo ""
echo "[3/13] Checking for instance isolation..."

# Fix shared-data volume permissions if needed (Docker creates volumes as root)
if [ -n "${SHARED_DATA_DIR:-}" ] && [ -d "$SHARED_DATA_DIR" ] && [ ! -w "$SHARED_DATA_DIR" ]; then
  echo "  Fixing $SHARED_DATA_DIR permissions..."
  sudo /usr/local/bin/fix-shared-data-permissions.sh
fi

# Isolation mode detection - ALL conditions must be true:
# a. SHARED_DATA_DIR environment variable is set AND non-empty
# b. Directory $SHARED_DATA_DIR exists and is writable
ISOLATION_MODE=false

if [ -z "${SHARED_DATA_DIR:-}" ]; then
  echo "  SHARED_DATA_DIR not set (VS Code mode or no shared volume)"
elif [ ! -d "$SHARED_DATA_DIR" ]; then
  echo "  $SHARED_DATA_DIR directory does not exist"
elif [ ! -w "$SHARED_DATA_DIR" ]; then
  echo "  $SHARED_DATA_DIR is not writable"
else
  ISOLATION_MODE=true
fi

if [ "$ISOLATION_MODE" = true ]; then
  echo "  Isolation mode detected, running instance isolation..."
  /usr/local/bin/setup-instance-isolation.sh
  echo "✓ Instance isolation complete"
else
  echo "  Skipping instance isolation (not in proper DevContainer)"
fi

# Step 4: Check for package updates (daily)
echo ""
echo "[4/13] Checking for package updates..."
/usr/local/bin/check-daily-updates.sh
echo "✓ Package update check complete"

# Step 5: Fix node_modules ownership
echo ""
echo "[5/13] Fixing node_modules ownership..."
sudo /usr/local/bin/fix-node-modules-ownership.sh
echo "✓ Node modules ownership fixed"

# Step 6: Install CLI tools
echo ""
echo "[6/13] Installing CLI tools..."

# Install Claude Code via official installer (https://claude.ai/install.sh)
# Security note: Piping to bash is the official install method. The script is served
# over HTTPS from Anthropic's domain. For additional security, you could download,
# inspect, and run manually, but this would break automated container builds.
# CLAUDE_CODE_VERSION can be: empty (latest), "stable", or specific version like "1.0.58"
CLAUDE_CODE_VERSION="${CLAUDE_CODE_VERSION:-}"
if [ -n "$CLAUDE_CODE_VERSION" ]; then
  echo "  - Installing Claude Code (version: $CLAUDE_CODE_VERSION)..."
  if ! curl -fsSL https://claude.ai/install.sh | bash -s "$CLAUDE_CODE_VERSION"; then
    echo "  ⚠ Claude Code installation failed for version: $CLAUDE_CODE_VERSION"
    echo "  Check https://claude.ai/install.sh for valid versions"
  fi
else
  echo "  - Installing Claude Code (latest)..."
  if ! curl -fsSL https://claude.ai/install.sh | bash; then
    echo "  ⚠ Claude Code installation failed"
  fi
fi

# Verify Claude Code installation
if command -v claude >/dev/null 2>&1; then
  echo "  ✓ Claude Code installed: $(claude --version 2>/dev/null || echo 'version unknown')"
else
  echo "  ⚠ Claude Code binary not found in PATH after installation"
fi

# Install Gemini CLI via pnpm
GEMINI_CLI_VERSION="${GEMINI_CLI_VERSION:-latest}"
echo "  - Installing @google/gemini-cli@${GEMINI_CLI_VERSION}..."
pnpm install -g "@google/gemini-cli@${GEMINI_CLI_VERSION}"

echo "✓ CLI tools installed"

# Step 7: Register plugin marketplaces from project settings
# NOTE: Must run BEFORE firewall init (step 11) — marketplace registration
# clones git repos and needs unrestricted network access.
echo ""
echo "[7/13] Registering plugin marketplaces..."
/usr/local/bin/register-plugin-marketplaces.sh "$WORKSPACE_ROOT"
echo "✓ Plugin marketplaces registered"

# Step 8: Update keystone packages
echo ""
echo "[8/13] Updating keystone packages..."
/usr/local/bin/update-keystone.sh
echo "✓ Keystone packages updated"

# Step 9: Start dnsmasq for DNS logging
echo ""
echo "[9/13] Starting dnsmasq DNS forwarder..."
sudo /usr/local/bin/start-dnsmasq.sh

# Step 10: Start ulogd for firewall logging
echo ""
echo "[10/13] Starting ulogd firewall logger..."
sudo /usr/local/bin/start-ulogd.sh
echo "✓ ulogd started"

# Step 11: Initialize firewall
echo ""
echo "[11/13] Initializing firewall rules..."
sudo /usr/local/bin/init-firewall.sh
echo "✓ Firewall initialized"

# Step 12: Run sanity check
echo ""
echo "[12/13] Running sanity check..."
if /usr/local/bin/devcontainer-sanity-check.sh; then
  echo "✓ Sanity check passed"
else
  echo "⚠ Sanity check reported failures (see above) - container continues"
fi

# Step 13: Run project-specific post-create if it exists
echo ""
echo "[13/13] Running project-specific setup..."
PROJECT_POST_CREATE="$WORKSPACE_ROOT/.devcontainer/post-create-project.sh"
if [ -f "$PROJECT_POST_CREATE" ]; then
    echo "Running $PROJECT_POST_CREATE..."
    chmod +x "$PROJECT_POST_CREATE"
    "$PROJECT_POST_CREATE"
    echo "✓ Project-specific setup complete"
else
    echo "No project-specific post-create script found (optional)"
fi

echo ""
echo "==============================================="
echo "Claude DevContainer setup complete!"
echo "==============================================="
