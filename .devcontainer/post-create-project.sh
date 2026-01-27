#!/bin/bash
set -e

# Signal Loom project-specific post-create tasks
# Called by the base image's post-create.sh

echo "=== Signal Loom Project Setup ==="

# Install global tools (project-specific)
echo ""
echo "[Project 1/6] Installing global tools..."
pnpm install -g vercel typescript-language-server

# Install actionlint for GitHub Actions workflow linting
echo "Installing actionlint..."
mkdir -p ~/.local/bin
cd ~/.local/bin
bash <(curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) 1.7.10
cd -
echo "✓ Vercel CLI, TypeScript language server, and actionlint installed"

# Configure shell customizations
echo ""
echo "[Project 2/6] Configuring shell customizations..."

# Add app alias for opening browser
APP_ALIAS='alias app='"'"'$BROWSER "https://${CLAUDE_INSTANCE}.signalloom.local"'"'"
if ! grep -q "alias app=" ~/.zshrc 2>/dev/null; then
  echo "" >> ~/.zshrc
  echo "# Open app in browser (OrbStack domain)" >> ~/.zshrc
  echo "$APP_ALIAS" >> ~/.zshrc
fi

# Add VS Code shell integration (must be at end of .zshrc, after p10k)
if ! grep -q "VS Code shell integration" ~/.zshrc 2>/dev/null; then
  cat >> ~/.zshrc << 'VSCODE_INTEGRATION'

# VS Code shell integration (loaded after p10k to avoid prompt conflicts)
# Uses first match if multiple VS Code versions exist - best effort approach
if [[ "$TERM_PROGRAM" == "vscode" ]]; then
  VSCODE_SHELL_INTEGRATION_SCRIPT=$(find /vscode/vscode-server/bin -name "shellIntegration-rc.zsh" 2>/dev/null | head -1)
  [[ -n "$VSCODE_SHELL_INTEGRATION_SCRIPT" ]] && source "$VSCODE_SHELL_INTEGRATION_SCRIPT"
fi
VSCODE_INTEGRATION
fi

echo "✓ Shell customizations configured"

# Install project dependencies
echo ""
echo "[Project 3/6] Installing project dependencies..."
pnpm install
echo "✓ Project dependencies installed"

# Initialize status bar
echo ""
echo "[Project 4/6] Initializing status bar..."
if [ -f /workspace/scripts/claude-instance ] && [ -x /workspace/scripts/claude-instance ]; then
  /workspace/scripts/claude-instance regenerate
  echo "✓ Status bar initialized"
else
  echo "⚠ Status bar script not found or not executable, skipping"
fi

# Install Playwright browsers (if Playwright is a project dependency)
echo ""
echo "[Project 5/6] Installing Playwright browsers..."
if pnpm exec playwright --version >/dev/null 2>&1; then
  pnpm exec playwright install
  echo "✓ Playwright browsers installed"
else
  echo "⚠ Playwright not found in project dependencies, skipping browser install"
fi

# Display welcome banner
echo ""
echo "[Project 6/6] Setup complete!"

APP_URL="https://${CLAUDE_INSTANCE}.signalloom.local"
BOX_WIDTH=61
URL_LINE="  ✓ Ready!  $APP_URL"
PADDING=$((BOX_WIDTH - ${#URL_LINE} - 2))

echo ""
cat << 'EOF'
   _____ _                   _   _
  / ____(_)                 | | | |
 | (___  _  __ _ _ __   __ _| | | |     ___   ___  _ __ ___
  \___ \| |/ _` | '_ \ / _` | | | |    / _ \ / _ \| '_ ` _ \
  ____) | | (_| | | | | (_| | | | |___| (_) | (_) | | | | | |
 |_____/|_|\__, |_| |_|\__,_|_| |______\___/ \___/|_| |_| |_|
            __/ |
           |___/
 ┌───────────────────────────────────────────────────────────┐
EOF
printf " │%s%*s│\n" "$URL_LINE" $PADDING ""
cat << 'EOF'
 │    Run 'app' or use 'Run App' (F5) to open in browser     │
 └───────────────────────────────────────────────────────────┘
EOF
