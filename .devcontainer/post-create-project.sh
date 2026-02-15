#!/bin/bash
set -e

# Agent Tools project-specific post-create tasks
# Called by the base image's post-create.sh (step 12)

echo "=== Agent Tools Project Setup ==="

# Install project dependencies
echo ""
echo "[Project 1/2] Installing project dependencies..."
pnpm install
echo "✓ Project dependencies installed"

# Display welcome banner
echo ""
echo "[Project 2/2] Setup complete!"
echo ""
cat << 'EOF'
    _                    _     _____
   / \   __ _  ___ _ __ | |_  | ____|_ ____   __
  / _ \ / _` |/ _ \ '_ \| __| |  _| | '_ \ \ / /
 / ___ \ (_| |  __/ | | | |_  | |___| | | \ V /
/_/   \_\__, |\___|_| |_|\__| |_____|_| |_|\_/
        |___/
EOF
echo "✓ Ready!"
