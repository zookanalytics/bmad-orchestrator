#!/bin/bash
set -e

# Check if package updates are needed (daily check)
# This script runs as the node user and uses sudo to call update-packages.sh

TIMESTAMP_FILE="/var/lib/apt/periodic/update-success-stamp"
UPDATE_INTERVAL_SECONDS=$((24 * 60 * 60))  # 24 hours

# Check if timestamp file exists
if [ ! -f "$TIMESTAMP_FILE" ]; then
  echo "No previous update timestamp found, updating packages..."
  sudo /usr/local/bin/update-packages.sh
  exit 0
fi

# Get current time and last update time
CURRENT_TIME=$(date +%s)
LAST_UPDATE_TIME=$(stat -c %Y "$TIMESTAMP_FILE" 2>/dev/null || echo 0)
TIME_SINCE_UPDATE=$((CURRENT_TIME - LAST_UPDATE_TIME))

# Check if 24 hours have passed
if [ "$TIME_SINCE_UPDATE" -ge "$UPDATE_INTERVAL_SECONDS" ]; then
  echo "Last package update was $(($TIME_SINCE_UPDATE / 3600)) hours ago, updating..."
  sudo /usr/local/bin/update-packages.sh
else
  HOURS_UNTIL_NEXT=$((($UPDATE_INTERVAL_SECONDS - TIME_SINCE_UPDATE) / 3600))
  echo "Package lists are up to date (last updated $(($TIME_SINCE_UPDATE / 3600)) hours ago)"
  echo "Next update in approximately $HOURS_UNTIL_NEXT hours"
fi
