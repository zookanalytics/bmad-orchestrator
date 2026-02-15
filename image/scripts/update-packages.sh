#!/bin/bash
set -e

# Update package lists
# This script must be run as root

TIMESTAMP_FILE="/var/lib/apt/periodic/update-success-stamp"

echo "Updating package lists..."
apt-get update

# Update timestamp file to track when the last update occurred
mkdir -p /var/lib/apt/periodic
touch "$TIMESTAMP_FILE"
echo "Package lists updated successfully"
