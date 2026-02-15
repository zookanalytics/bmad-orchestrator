#!/bin/bash
# assemble-managed-settings.sh - Assemble Claude Code managed-settings.json from modules
#
# Merges base security hooks with optional feature hooks based on environment variables.
# Called during post-create to configure Claude Code hooks dynamically.
#
# Environment variables:
#   ENABLE_BMAD_ORCHESTRATOR=true  - Enable BMAD phase completion Stop hook

set -e

BASE_DIR="/etc/claude-code"
OUTPUT="$BASE_DIR/managed-settings.json"
HOOKS_DIR="$BASE_DIR/hooks"

# Start with base security hooks
cp "$HOOKS_DIR/managed-settings.base.json" "$OUTPUT"

# Track which modules are enabled for logging
enabled_modules=()

# Merge BMAD orchestrator hooks if enabled
if [[ "${ENABLE_BMAD_ORCHESTRATOR:-}" == "true" ]]; then
    BMAD_CONFIG="$HOOKS_DIR/managed-settings.bmad.json"
    if [[ -f "$BMAD_CONFIG" ]]; then
        # Merge Stop hooks from bmad config into base
        # jq merges the hooks objects, combining arrays for each hook type
        jq -s '
            .[0] as $base | .[1] as $addon |
            $base * {
                hooks: ($base.hooks * {
                    Stop: (($base.hooks.Stop // []) + ($addon.hooks.Stop // []))
                })
            }
        ' "$OUTPUT" "$BMAD_CONFIG" > "$OUTPUT.tmp" && mv "$OUTPUT.tmp" "$OUTPUT"
        enabled_modules+=("bmad-orchestrator")
    fi
fi

# Log what was assembled
if [[ ${#enabled_modules[@]} -gt 0 ]]; then
    echo "Enabled optional hooks: ${enabled_modules[*]}"
else
    echo "Using base security hooks only"
fi
