#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Start ulogd2 daemon for firewall logging
# This script must be run with sudo privileges

# Check if ulogd is already running
if pgrep -x "ulogd" > /dev/null; then
    echo "ulogd is already running"
    exit 0
fi

# Start ulogd with our configuration
echo "Starting ulogd..."
/usr/sbin/ulogd -d -c /etc/ulogd.conf

# Verify it started
if pgrep -x "ulogd" > /dev/null; then
    echo "ulogd started successfully"
else
    echo "ERROR: Failed to start ulogd"
    exit 1
fi
