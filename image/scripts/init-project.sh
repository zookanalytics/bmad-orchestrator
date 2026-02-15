#!/bin/bash
set -e

# Initialize a project to use claude-devcontainer
# Usage: curl -fsSL https://raw.githubusercontent.com/zookanalytics/claude-devcontainer/main/scripts/init-project.sh | bash

DEVCONTAINER_DIR=".devcontainer"
IMAGE="ghcr.io/zookanalytics/claude-devcontainer:latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Check if we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  error "Not in a git repository. Please run from your project root."
fi

# Derive project name from git remote or directory
PROJECT_NAME=""
if git remote get-url origin &>/dev/null; then
  REMOTE_URL=$(git remote get-url origin)
  PROJECT_NAME=$(echo "$REMOTE_URL" | sed -E 's/.*[\/:]([^\/]+)\.git$/\1/' | sed 's/\.git$//')
fi
if [ -z "$PROJECT_NAME" ]; then
  PROJECT_NAME=$(basename "$(pwd)")
fi

echo ""
echo "Initializing claude-devcontainer for: $PROJECT_NAME"
echo ""

# Create .devcontainer directory
mkdir -p "$DEVCONTAINER_DIR"
info "Created $DEVCONTAINER_DIR/"

# Create devcontainer.json if it doesn't exist
if [ -f "$DEVCONTAINER_DIR/devcontainer.json" ]; then
  warn "devcontainer.json already exists, skipping"
else
  cat > "$DEVCONTAINER_DIR/devcontainer.json" << EOF
{
  "name": "${PROJECT_NAME} - \${localWorkspaceFolderBasename}",
  "image": "${IMAGE}",
  "runArgs": [
    "--name=${PROJECT_NAME}-\${localWorkspaceFolderBasename}",
    "--cap-add=NET_ADMIN",
    "--cap-add=NET_RAW",
    "--cap-add=SYSLOG"
  ],
  "customizations": {
    "vscode": {
      "extensions": [
        "Anthropic.claude-code"
      ]
    }
  },
  "remoteUser": "node",
  "mounts": [
    "source=${PROJECT_NAME}-bashhistory-\${localWorkspaceFolderBasename},target=/commandhistory,type=volume",
    "source=${PROJECT_NAME}-claude-config,target=/home/node/.claude,type=volume",
    "source=${PROJECT_NAME}-gemini-config,target=/home/node/.gemini,type=volume",
    "source=${PROJECT_NAME}-shared-config,target=/home/node/.config,type=volume",
    "source=pnpm-store,target=/workspace/.pnpm-store,type=volume",
    "source=${PROJECT_NAME}-node-modules-\${localWorkspaceFolderBasename},target=/workspace/node_modules,type=volume"
  ],
  "containerEnv": {
    "PROJECT_NAME": "${PROJECT_NAME}",
    "AGENT_INSTANCE": "\${localWorkspaceFolderBasename}",
    "NODE_OPTIONS": "--max-old-space-size=4096",
    "CLAUDE_CONFIG_DIR": "/home/node/.claude",
    "PNPM_HOME": "/pnpm",
    "npm_config_store_dir": "/workspace/.pnpm-store",
    "npm_config_virtual_store_dir": ".pnpm-store/container/\${localWorkspaceFolderBasename}"
  },
  "workspaceMount": "source=\${localWorkspaceFolder},target=/workspace,type=bind,consistency=delegated",
  "workspaceFolder": "/workspace",
  "postCreateCommand": "/usr/local/bin/post-create.sh"
}
EOF
  info "Created devcontainer.json"
fi

# Create allowed-domains.txt if it doesn't exist
if [ -f "$DEVCONTAINER_DIR/allowed-domains.txt" ]; then
  warn "allowed-domains.txt already exists, skipping"
else
  cat > "$DEVCONTAINER_DIR/allowed-domains.txt" << 'EOF'
# Project-specific domains
# Base domains (npm, GitHub, Anthropic, Google APIs) provided by base image

# Add your project's API endpoints, services, etc.
# Example:
# api.your-service.com
# your-backend.example.com
EOF
  info "Created allowed-domains.txt"
fi

# Create post-create-project.sh if it doesn't exist
if [ -f "$DEVCONTAINER_DIR/post-create-project.sh" ]; then
  warn "post-create-project.sh already exists, skipping"
else
  cat > "$DEVCONTAINER_DIR/post-create-project.sh" << 'EOF'
#!/bin/bash
set -e

# Project-specific post-create setup
# This script is called by the base image's post-create.sh

echo "Running project-specific setup..."

# Install dependencies (uncomment as needed)
# pnpm install

# Install Playwright browsers (if using Playwright)
# pnpm exec playwright install

# Add any other project-specific initialization here

echo "✓ Project setup complete!"
EOF
  chmod +x "$DEVCONTAINER_DIR/post-create-project.sh"
  info "Created post-create-project.sh"
fi

echo ""
echo "Done! Next steps:"
echo "  1. Edit $DEVCONTAINER_DIR/allowed-domains.txt with your project's domains"
echo "  2. Edit $DEVCONTAINER_DIR/post-create-project.sh with your setup commands"
echo "  3. Open in VS Code and 'Reopen in Container'"
echo ""
