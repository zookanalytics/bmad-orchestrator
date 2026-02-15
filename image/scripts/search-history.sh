#!/bin/bash
# search-history.sh
# Search across all DevPod instance histories (zsh, claude)
#
# Usage:
#   search-history <pattern>                    # Search all history types
#   search-history --zsh <pattern>              # Search only zsh history
#   search-history --claude <pattern>           # Search only Claude history.jsonl
#   search-history --list                       # List all instances with counts
#   search-history --instance <id> <pattern>    # Search specific instance
#   search-history --recent <n>                 # Show last n entries
#
# Claude history.jsonl format (per line):
#   {"timestamp": 1234567890123, "type": "...", "message": {...}}

set -e

SHARED_DATA="${SHARED_DATA_DIR:-/shared-data}"
INSTANCE_DIR="$SHARED_DATA/instance"
STALE_DAYS=30
SKIPPED_LINES=0

usage() {
  echo "Usage: search-history [OPTIONS] <pattern>"
  echo ""
  echo "Options:"
  echo "  --zsh              Search only zsh command history"
  echo "  --claude           Search only Claude conversation history (history.jsonl)"
  echo "  --instance <id>    Search only specific instance"
  echo "  --list             List all instances with history counts"
  echo "  --recent <n>       Show last n entries (default: 50)"
  echo "  -h, --help         Show this help"
  echo ""
  echo "Examples:"
  echo "  search-history 'git commit'           # Find in all instances"
  echo "  search-history --zsh 'npm install'    # Find in shell history"
  echo "  search-history --claude 'fix bug'     # Find in Claude conversations"
  echo "  search-history --list                 # Show all instances"
  echo "  search-history --recent 50            # Show last 50 entries"
}

# Check if any instances exist
check_instances_exist() {
  local found=false
  for dir in "$INSTANCE_DIR"/*/; do
    if [ -d "$dir" ]; then
      found=true
      break
    fi
  done
  echo "$found"
}

# List all instances with counts and staleness detection
list_instances() {
  if [ "$(check_instances_exist)" = "false" ]; then
    echo "No instances found in $INSTANCE_DIR/"
    exit 0
  fi

  echo "Instances with history:"
  echo ""
  printf "  %-30s %8s %8s %s\n" "INSTANCE" "ZSH" "CLAUDE" "STATUS"
  printf "  %-30s %8s %8s %s\n" "--------" "---" "------" "------"

  for dir in "$INSTANCE_DIR"/*/; do
    if [ -d "$dir" ]; then
      instance=$(basename "$dir")

      # Count zsh history lines
      zsh_lines=0
      if [ -f "$dir/zsh_history" ]; then
        zsh_lines=$(wc -l < "$dir/zsh_history" 2>/dev/null || echo "0")
        zsh_lines=$(echo "$zsh_lines" | tr -d ' ')
      fi

      # Count claude history.jsonl lines
      claude_entries=0
      local history_file="$dir/claude/history.jsonl"
      if [ -f "$history_file" ]; then
        claude_entries=$(wc -l < "$history_file" 2>/dev/null || echo "0")
        claude_entries=$(echo "$claude_entries" | tr -d ' ')
      fi

      # Check staleness (file modified more than STALE_DAYS ago)
      status=""
      if [ -f "$history_file" ]; then
        local mtime
        mtime=$(stat -c %Y "$history_file" 2>/dev/null || stat -f %m "$history_file" 2>/dev/null || echo "0")
        local now
        now=$(date +%s)
        local age_days=$(( (now - mtime) / 86400 ))
        if [ "$age_days" -gt "$STALE_DAYS" ]; then
          status="(stale?)"
        fi
      fi

      printf "  %-30s %8s %8s %s\n" "$instance" "$zsh_lines" "$claude_entries" "$status"
    fi
  done
}

# Search zsh history
search_zsh() {
  local pattern="$1"
  local instance_filter="$2"

  echo "=== ZSH History ==="

  if [ "$(check_instances_exist)" = "false" ]; then
    echo "No instances found"
    return
  fi

  local found=false
  if [ -n "$instance_filter" ]; then
    local hist="$INSTANCE_DIR/$instance_filter/zsh_history"
    if [ -f "$hist" ]; then
      found=true
      # grep returns 1 if no matches, which is normal - only mask that exit code
      local grep_result
      grep_result=$(grep -hFn "$pattern" "$hist" 2>/dev/null) || true
      if [ -n "$grep_result" ]; then
        echo "$grep_result" | sed "s/^/[$instance_filter] /"
      fi
    fi
  else
    for hist in "$INSTANCE_DIR"/*/zsh_history; do
      if [ -f "$hist" ]; then
        found=true
        instance=$(basename "$(dirname "$hist")")
        local grep_result
        grep_result=$(grep -hFn "$pattern" "$hist" 2>/dev/null) || true
        if [ -n "$grep_result" ]; then
          echo "$grep_result" | sed "s/^/[$instance] /"
        fi
      fi
    done
  fi

  if [ "$found" = "false" ]; then
    echo "No zsh history files found"
  fi
}

# Search Claude history.jsonl files
search_claude() {
  local pattern="$1"
  local instance_filter="$2"

  echo "=== Claude Conversations (history.jsonl) ==="

  if [ "$(check_instances_exist)" = "false" ]; then
    echo "No instances found"
    return
  fi

  local found=false
  local total_skipped=0

  if [ -n "$instance_filter" ]; then
    local history_file="$INSTANCE_DIR/$instance_filter/claude/history.jsonl"
    if [ -f "$history_file" ]; then
      found=true
      search_jsonl_file "$history_file" "$pattern" "$instance_filter"
    fi
  else
    for history_file in "$INSTANCE_DIR"/*/claude/history.jsonl; do
      if [ -f "$history_file" ]; then
        found=true
        instance=$(basename "$(dirname "$(dirname "$history_file")")")
        search_jsonl_file "$history_file" "$pattern" "$instance"
      fi
    done
  fi

  if [ "$found" = "false" ]; then
    echo "No Claude history.jsonl files found"
  fi

  if [ "$SKIPPED_LINES" -gt 0 ]; then
    echo ""
    echo "Warning: $SKIPPED_LINES lines skipped (parse errors)" >&2
  fi
}

# Search a single JSONL file for pattern
search_jsonl_file() {
  local file="$1"
  local pattern="$2"
  local instance="$3"

  while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines
    [ -z "$line" ] && continue

    # Try to extract relevant content with jq
    # Format: timestamp, type, and content preview
    local extracted
    local jq_status
    extracted=$(echo "$line" | jq -r '
      [
        (.timestamp // 0 | . / 1000 | strftime("%Y-%m-%d %H:%M")),
        (.type // "unknown"),
        ((.message.content // .message // .content // "") | tostring | .[0:100])
      ] | @tsv
    ' 2>/dev/null) && jq_status=0 || jq_status=$?

    if [ "$jq_status" -ne 0 ] || [ -z "$extracted" ]; then
      # Parse error - count and skip
      SKIPPED_LINES=$((SKIPPED_LINES + 1))
      continue
    fi

    # Check if pattern matches the line (use -F for literal string matching)
    if echo "$line" | grep -qF "$pattern" 2>/dev/null; then
      echo "[$instance] $extracted"
    fi
  done < "$file"
}

# Show recent entries across instances
recent_commands() {
  local count="${1:-50}"

  if [ "$(check_instances_exist)" = "false" ]; then
    echo "No instances found"
    exit 0
  fi

  echo "=== Recent ZSH Commands ==="
  for hist in "$INSTANCE_DIR"/*/zsh_history; do
    if [ -f "$hist" ]; then
      instance=$(basename "$(dirname "$hist")")
      tail -n "$count" "$hist" 2>/dev/null | \
        sed "s/^/[$instance] /" || true
    fi
  done | tail -n "$count"

  echo ""
  echo "=== Recent Claude Entries (sorted by timestamp) ==="

  # Collect all entries with timestamps, sort, take top N
  local temp_file
  temp_file=$(mktemp)

  for history_file in "$INSTANCE_DIR"/*/claude/history.jsonl; do
    if [ -f "$history_file" ]; then
      instance=$(basename "$(dirname "$(dirname "$history_file")")")
      tail -n "$count" "$history_file" 2>/dev/null | while IFS= read -r line || [ -n "$line" ]; do
        [ -z "$line" ] && continue

        local ts
        ts=$(echo "$line" | jq -r '.timestamp // 0' 2>/dev/null || echo "0")

        local extracted
        extracted=$(echo "$line" | jq -r '
          [
            (.timestamp // 0 | . / 1000 | strftime("%Y-%m-%d %H:%M")),
            (.type // "unknown"),
            ((.message.content // .message // .content // "") | tostring | .[0:80])
          ] | @tsv
        ' 2>/dev/null)

        if [ -n "$extracted" ] && [ "$extracted" != "null" ]; then
          echo "$ts|[$instance] $extracted"
        fi
      done
    fi
  done | sort -t'|' -k1 -rn | head -n "$count" | cut -d'|' -f2- > "$temp_file"

  cat "$temp_file"
  rm -f "$temp_file"
}

# --- Parse arguments ---
SEARCH_ZSH=false
SEARCH_CLAUDE=false
INSTANCE=""
RECENT=""
PATTERN=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --zsh)
      SEARCH_ZSH=true
      shift
      ;;
    --claude)
      SEARCH_CLAUDE=true
      shift
      ;;
    --gemini)
      # Deprecated - Gemini is now shared, no per-instance history
      echo "Note: --gemini is deprecated. Gemini is shared across instances, not isolated."
      shift
      ;;
    --instance)
      INSTANCE="$2"
      shift 2
      ;;
    --list)
      list_instances
      exit 0
      ;;
    --recent)
      RECENT="${2:-50}"
      shift
      # Handle case where number is provided
      if [[ $# -gt 0 && "$1" =~ ^[0-9]+$ ]]; then
        RECENT="$1"
        shift
      fi
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
    *)
      PATTERN="$1"
      shift
      ;;
  esac
done

# Handle --recent
if [ -n "$RECENT" ]; then
  recent_commands "$RECENT"
  exit 0
fi

# Require pattern for search
if [ -z "$PATTERN" ]; then
  usage
  exit 1
fi

# Check for instances before searching
if [ "$(check_instances_exist)" = "false" ]; then
  echo "No instances to search"
  exit 0
fi

# If no specific type selected, search all
if ! $SEARCH_ZSH && ! $SEARCH_CLAUDE; then
  SEARCH_ZSH=true
  SEARCH_CLAUDE=true
fi

# Execute searches
$SEARCH_ZSH && search_zsh "$PATTERN" "$INSTANCE"
echo ""
$SEARCH_CLAUDE && search_claude "$PATTERN" "$INSTANCE"
