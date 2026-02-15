#!/bin/bash
set -euo pipefail

# Post-create command for Agent DevContainer base image
# Handles initialization tasks after container creation
# Projects can extend via <workspace>/.devcontainer/post-create-project.sh

# Detect workspace root - environment variable or git root fallback
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Prevent Corepack from prompting during package installations
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

echo "==============================================="
echo "Starting Agent DevContainer post-create setup..."
echo "==============================================="

# Step 1: Fix SSH agent socket permissions (if mounted)
echo ""
echo "[1/13] Fixing SSH agent socket permissions..."
sudo /usr/local/bin/fix-ssh-socket-permissions.sh

# Step 2: SSH server setup (host keys + authorized_keys)
echo ""
echo "[2/13] Setting up SSH server..."

# Generate persistent host keys (stored in workspace so they survive stop/start)
SSH_HOST_KEY_DIR="$WORKSPACE_ROOT/.agent-env/ssh"
mkdir -p "$SSH_HOST_KEY_DIR"
chmod 700 "$SSH_HOST_KEY_DIR"
if [ ! -f "$SSH_HOST_KEY_DIR/ssh_host_ed25519_key" ]; then
  echo "  SSH: Generating host keys..."
  ssh-keygen -t ed25519 -f "$SSH_HOST_KEY_DIR/ssh_host_ed25519_key" -N "" -q
  ssh-keygen -t rsa -b 4096 -f "$SSH_HOST_KEY_DIR/ssh_host_rsa_key" -N "" -q
  echo "  SSH: Host keys generated"
else
  echo "  SSH: Using existing host keys"
fi

# Install host keys where sshd expects them
sudo cp "$SSH_HOST_KEY_DIR"/ssh_host_*_key "$SSH_HOST_KEY_DIR"/ssh_host_*_key.pub /etc/ssh/
sudo chown root:root /etc/ssh/ssh_host_*_key /etc/ssh/ssh_host_*_key.pub
sudo chmod 600 /etc/ssh/ssh_host_*_key
sudo chmod 644 /etc/ssh/ssh_host_*_key.pub

# Set up authorized_keys from staged public keys (mounted read-only by init-host.sh)
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [ -d "$HOME/.ssh-host" ]; then
  touch "$HOME/.ssh/authorized_keys"
  chmod 600 "$HOME/.ssh/authorized_keys"

  temp_keys=$(mktemp)
  trap 'rm -f "$temp_keys"' EXIT
  cat "$HOME/.ssh-host"/*.pub > "$temp_keys" 2>/dev/null || true

  if [ -s "$temp_keys" ]; then
    while IFS= read -r key; do
      if ! grep -qxF "$key" "$HOME/.ssh/authorized_keys" 2>/dev/null; then
        echo "$key" >> "$HOME/.ssh/authorized_keys"
      fi
    done < "$temp_keys"
    echo "  SSH: authorized_keys updated ($(wc -l < "$HOME/.ssh/authorized_keys") keys total)"
  else
    echo "  SSH: Warning: No .pub keys found in staged ssh-pub-keys"
  fi
  rm "$temp_keys"
else
  echo "  SSH: Warning: ssh-pub-keys not mounted at ~/.ssh-host"
fi
echo "✓ SSH server setup complete"

# Step 3: Assemble Claude Code managed settings
echo ""
echo "[3/13] Assembling Claude Code managed settings..."
sudo /usr/local/bin/assemble-managed-settings.sh
echo "✓ Managed settings assembled"

# Step 4: Instance isolation (if applicable)
echo ""
echo "[4/13] Checking for instance isolation..."

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

# Step 5: Check for package updates (daily)
echo ""
echo "[5/13] Checking for package updates..."
/usr/local/bin/check-daily-updates.sh
echo "✓ Package update check complete"

# Step 6: Fix node_modules ownership
echo ""
echo "[6/13] Fixing node_modules ownership..."
sudo /usr/local/bin/fix-node-modules-ownership.sh
echo "✓ Node modules ownership fixed"

# Step 7: Install CLI tools
echo ""
echo "[7/13] Installing CLI tools..."

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
# Pre-approve build/postinstall scripts to avoid interactive prompts during global install
GEMINI_CLI_VERSION="${GEMINI_CLI_VERSION:-latest}"
echo "  - Installing @google/gemini-cli@${GEMINI_CLI_VERSION}..."
GLOBAL_DIR="$(pnpm root -g)/.."
if [ -f "$GLOBAL_DIR/package.json" ]; then
  # Merge onlyBuiltDependencies into existing global package.json
  jq '.pnpm.onlyBuiltDependencies = ["@zookanalytics/keystone-workflows","keytar","node-pty","protobufjs","tree-sitter-bash"]' "$GLOBAL_DIR/package.json" > "$GLOBAL_DIR/package.json.tmp" && mv "$GLOBAL_DIR/package.json.tmp" "$GLOBAL_DIR/package.json"
else
  mkdir -p "$GLOBAL_DIR"
  echo '{"pnpm":{"onlyBuiltDependencies":["@zookanalytics/keystone-workflows","keytar","node-pty","protobufjs","tree-sitter-bash"]}}' > "$GLOBAL_DIR/package.json"
fi
pnpm install -g "@google/gemini-cli@${GEMINI_CLI_VERSION}"

# Install keystone-cli via bun
echo "  - Installing keystone-cli..."
if ! bun install -g github:ZookAnalytics/keystone-cli; then
  echo "  ⚠ keystone-cli update failed, using existing version"
fi

# Install keystone-workflows from npm (postinstall copies workflows to ~/.keystone/)
echo "  - Installing @zookanalytics/keystone-workflows..."
if ! pnpm install -g @zookanalytics/keystone-workflows; then
  echo "  ⚠ keystone-workflows update failed, using existing version"
fi

echo "✓ CLI tools installed"

# Step 8: Register plugin marketplaces from project settings
# NOTE: Must run BEFORE firewall init (step 11) — marketplace registration
# clones git repos and needs unrestricted network access.
echo ""
echo "[8/13] Registering plugin marketplaces..."
/usr/local/bin/register-plugin-marketplaces.sh "$WORKSPACE_ROOT"
echo "✓ Plugin marketplaces registered"

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
echo "Agent DevContainer setup complete!"
echo "==============================================="
