#!/usr/bin/env bash
# bmad-phase-complete.sh - Stop hook for BMAD phase completion detection
#
# Fires when Claude stops responding. Checks if the story status changed
# (indicating phase completion) and writes a signal file for the executor.

set -e

LOCK_DIR=".claude/.bmad-running"
SIGNAL_FILE=".claude/.bmad-phase-signal.json"
STATUS_FILE="docs/delivery/sprint-status.yaml"

# Only run if we're in a BMAD workflow (lock file exists)
shopt -s nullglob
locks=("$LOCK_DIR"/*.json)
[[ ${#locks[@]} -eq 0 ]] && exit 0

# Get the lock file (first one if multiple)
lock_file="${locks[0]}"
[[ ! -f "$lock_file" ]] && exit 0

# Read lock data
story_id=$(jq -r '.story_id // empty' "$lock_file" 2>/dev/null)
starting_status=$(jq -r '.starting_status // empty' "$lock_file" 2>/dev/null)

[[ -z "$story_id" ]] && exit 0

# If no starting_status recorded, we can't compare (old lock format)
[[ -z "$starting_status" ]] && exit 0

# Read current status from sprint-status.yaml
if [[ ! -f "$STATUS_FILE" ]]; then
    exit 0
fi

# Extract current story status using yq or grep+sed fallback
if command -v yq &>/dev/null; then
    current_status=$(yq -r ".stories.\"$story_id\" // empty" "$STATUS_FILE" 2>/dev/null)
else
    # Fallback: grep for the story line
    # Escape story_id for use in grep pattern (handle regex metacharacters)
    escaped_id=$(printf '%s\n' "$story_id" | sed 's/[.[\*^$()+?{|]/\\&/g')
    current_status=$(grep -E "^\s+\"?${escaped_id}\"?:" "$STATUS_FILE" 2>/dev/null | head -1 | sed 's/.*:\s*//' | tr -d '"' | tr -d "'" | xargs)
fi

[[ -z "$current_status" ]] && exit 0

# Check if status changed (phase made progress)
if [[ "$current_status" != "$starting_status" ]]; then
    # Phase complete - write signal file
    cat > "$SIGNAL_FILE" << EOF
{
  "story_id": "$story_id",
  "from_status": "$starting_status",
  "to_status": "$current_status",
  "timestamp": "$(date -Iseconds)"
}
EOF
    echo "BMAD: Phase complete ($starting_status -> $current_status)" >&2
fi

exit 0
