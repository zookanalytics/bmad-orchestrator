#!/bin/bash
# tmux-purpose.sh - Displays instance name and purpose in tmux status bar
# Called by tmux status-right via #(bash /home/node/.local/bin/tmux-purpose)
#
# Reads from /etc/agent-env/state.json (bind-mounted from .agent-env/)
# Output format:
#   With purpose:    "<instance> | <purpose>"
#   Without purpose: "<instance>"
#   Missing file:    "?"
#   Missing jq:      "[jq required]"
#   Malformed JSON:  "?"
#
# Purpose is truncated at 40 characters with "…"

# Allow overriding state file path for testing
STATE_FILE="${STATE_FILE_OVERRIDE:-/etc/agent-env/state.json}"
MAX_PURPOSE_LEN=40

# Check jq availability
if ! command -v jq >/dev/null 2>&1; then
  echo "[jq required]"
  exit 0
fi

# Check state file exists
if [ ! -f "$STATE_FILE" ]; then
  echo "?"
  exit 0
fi

# Single jq invocation: format the display string directly
# - If instance is missing/null → "?"
# - If purpose is null/empty → just the instance
# - If purpose exists → "instance | purpose" (truncated at MAX_PURPOSE_LEN)
result=$(jq -r --argjson maxlen "$MAX_PURPOSE_LEN" '
  (.instance // "") as $inst |
  (.purpose // "") as $purpose |
  if ($inst | length) == 0 then "?"
  elif ($purpose | length) == 0 then $inst
  elif ($purpose | length) > $maxlen then "\($inst) | \($purpose[0:$maxlen])…"
  else "\($inst) | \($purpose)"
  end
' "$STATE_FILE" 2>/dev/null)

# Handle jq parse failure (malformed JSON or other errors)
jq_exit=$?
if [ $jq_exit -ne 0 ] || [ -z "$result" ]; then
  echo "?"
  exit 0
fi

echo "$result"
