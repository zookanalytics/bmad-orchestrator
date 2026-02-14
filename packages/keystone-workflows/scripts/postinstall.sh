#!/bin/sh
# Keystone Workflows postinstall
# Installs workflow files and config to user directories.
# Non-fatal: warnings are printed but npm install is never blocked.
# POSIX sh compatible — works on Alpine, minimal containers, and anywhere sh exists.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$SCRIPT_DIR/.."
WORKFLOWS_DIR="$PACKAGE_DIR/workflows"
CONFIG_DIR="$PACKAGE_DIR/config"

# Validate prerequisites
if [ -z "${HOME:-}" ]; then
  echo "keystone-workflows: WARNING: \$HOME is not set. Skipping resource installation." >&2
  exit 0
fi

if [ ! -d "$WORKFLOWS_DIR" ]; then
  echo "keystone-workflows: WARNING: Workflows directory not found in package. Skipping." >&2
  exit 0
fi

# --- Workflows ---
# Workflows are the product — always install latest version
# Workflow and config sections are independent — failure in one does not skip the other
WORKFLOW_TARGET="$HOME/.keystone/workflows"
IS_UPGRADE=false
[ -d "$WORKFLOW_TARGET" ] && IS_UPGRADE=true

if mkdir -p "$WORKFLOW_TARGET" 2>/dev/null; then
  WORKFLOW_COUNT=0
  for f in "$WORKFLOWS_DIR"/*.yaml; do
    [ -e "$f" ] || continue
    if cp -f "$f" "$WORKFLOW_TARGET/$(basename "$f")" 2>/dev/null; then
      WORKFLOW_COUNT=$((WORKFLOW_COUNT + 1))
    fi
  done

  if [ "$WORKFLOW_COUNT" -gt 0 ]; then
    if [ "$IS_UPGRADE" = true ]; then
      echo "keystone-workflows: Updated $WORKFLOW_TARGET ($WORKFLOW_COUNT files)"
    else
      echo "keystone-workflows: Installed workflows to $WORKFLOW_TARGET ($WORKFLOW_COUNT files)"
    fi
  else
    echo "keystone-workflows: WARNING: No workflow files installed." >&2
  fi
else
  echo "keystone-workflows: WARNING: Cannot create $WORKFLOW_TARGET. Skipping workflows." >&2
fi

# --- Config ---
# Config is overwritten with single-backup protection
# Source: keystone-config.yaml -> installed as config.yaml (keystone-cli convention)
# Attempted independently of workflow installation
CONFIG_TARGET="$HOME/.config/keystone"
if ! mkdir -p "$CONFIG_TARGET" 2>/dev/null; then
  echo "keystone-workflows: WARNING: Cannot create $CONFIG_TARGET. Skipping config." >&2
  exit 0
fi

CONFIG_SRC="$CONFIG_DIR/keystone-config.yaml"
CONFIG_DEST="$CONFIG_TARGET/config.yaml"

if [ -f "$CONFIG_SRC" ]; then
  if [ -f "$CONFIG_DEST" ]; then
    if cp -f "$CONFIG_DEST" "$CONFIG_DEST.bak" 2>/dev/null; then
      echo "keystone-workflows: Previous config backed up to $CONFIG_DEST.bak"
    else
      echo "keystone-workflows: WARNING: Failed to backup existing config." >&2
    fi
  fi
  if cp -f "$CONFIG_SRC" "$CONFIG_DEST" 2>/dev/null; then
    echo "keystone-workflows: Config installed to $CONFIG_DEST"
  else
    echo "keystone-workflows: WARNING: Failed to install config." >&2
  fi
else
  echo "keystone-workflows: WARNING: Default config not found in package. Skipping." >&2
fi
