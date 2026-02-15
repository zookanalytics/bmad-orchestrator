#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Read ONLY firewall-related logs from ulogd
# This script must be run with sudo privileges
#
# Security: This wrapper restricts log access to only firewall logs,
# preventing exposure of other system logs.

LOGFILE="/var/log/ulogd-firewall.log"

if [ ! -f "$LOGFILE" ]; then
    echo "Firewall log file not found: $LOGFILE"
    echo "Make sure ulogd is running (sudo /usr/local/bin/start-ulogd.sh)"
    exit 1
fi

# Show firewall block logs
cat "$LOGFILE"
