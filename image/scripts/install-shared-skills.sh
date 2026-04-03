#!/bin/bash
# install-shared-skills.sh
# Clones (or refreshes) the shared agent-skills repo and installs skills
# for all supported agent platforms via `npx skills add`.
#
# Runs in two contexts:
#   1. postCreateCommand (first container): clone + install
#   2. postStartCommand (every start/attach): pull + refresh
#
# All operations are non-fatal — failures log warnings but never block
# container startup.
#
# Usage: install-shared-skills.sh

set -euo pipefail

SHARED_DATA="${SHARED_DATA_DIR:-/shared-data}"
SKILLS_REPO_DIR="$SHARED_DATA/agent-skills"
SKILLS_REPO_URL="git@github.com:zookanalytics/agent-skills.git"
CLONE_LOCK="$SHARED_DATA/.agent-skills-clone.lock"

# Guard: shared-data directory must exist (no volume = nothing to do)
if [ ! -d "$SHARED_DATA" ]; then
  echo "  $SHARED_DATA not available, skipping shared skills"
  exit 0
fi

# Step 1: Ensure skills repo is present
if [ ! -d "$SKILLS_REPO_DIR" ]; then
  echo "  Shared skills repo not found, cloning..."

  # Use flock to prevent concurrent clone races across containers
  (
    if ! flock -w 60 200; then
      echo "  ⚠ Could not acquire clone lock (timeout)"
      exit 1
    fi

    # Double-check inside the lock (another container may have cloned)
    if [ ! -d "$SKILLS_REPO_DIR" ]; then
      if ! timeout 120 git clone "$SKILLS_REPO_URL" "$SKILLS_REPO_DIR"; then
        echo "  ⚠ Failed to clone agent-skills repo (network or SSH issue)"
        # Clean up partial clone if directory was created
        if [ -d "$SKILLS_REPO_DIR" ] && [[ "$SKILLS_REPO_DIR" == *"/agent-skills" ]]; then
          rm -rf "$SKILLS_REPO_DIR"
        fi
        exit 1
      fi
      echo "  ✓ Cloned agent-skills repo"
    else
      echo "  ✓ Repo already cloned by another container"
    fi
  ) 200>"$CLONE_LOCK" || true
elif [ ! -f "$SKILLS_REPO_DIR/.git/HEAD" ]; then
  # Directory exists but is not a valid git repo (interrupted clone)
  echo "  ⚠ Corrupt skills repo detected, removing and re-cloning..."
  (
    if ! flock -w 60 200; then
      echo "  ⚠ Could not acquire clone lock (timeout)"
      exit 1
    fi
    if [[ "$SKILLS_REPO_DIR" == *"/agent-skills" ]]; then
      rm -rf "$SKILLS_REPO_DIR"
    fi
    if ! timeout 120 git clone "$SKILLS_REPO_URL" "$SKILLS_REPO_DIR"; then
      echo "  ⚠ Re-clone failed (network or SSH issue)"
      if [ -d "$SKILLS_REPO_DIR" ] && [[ "$SKILLS_REPO_DIR" == *"/agent-skills" ]]; then
        rm -rf "$SKILLS_REPO_DIR"
      fi
      exit 1
    fi
    echo "  ✓ Skills repo re-cloned"
  ) 200>"$CLONE_LOCK" || true
else
  # Repo exists and is valid — pull latest changes
  echo "  Refreshing shared skills repo..."
  if ! timeout 30 git -C "$SKILLS_REPO_DIR" pull --ff-only; then
    echo "  ⚠ git pull failed (offline or diverged), using existing copy"
  else
    echo "  ✓ Skills repo updated"
  fi
fi

# Step 2: Install skills for all agents
if [ -d "$SKILLS_REPO_DIR" ]; then
  echo "  Installing skills for all agents..."
  if ! npx --yes skills@1 add "$SKILLS_REPO_DIR" -g --all; then
    echo "  ⚠ npx skills add failed (see output above)"
  else
    echo "  ✓ Shared skills installed"
  fi
else
  echo "  ⚠ Skills repo not available, skipping installation"
  exit 1
fi
