#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Start dnsmasq DNS forwarder with logging
# This script must be run with sudo privileges

echo "Starting dnsmasq DNS forwarder..."

# Capture the current upstream DNS server(s) from resolv.conf BEFORE overwriting it
UPSTREAM_DNS=$(grep -E '^nameserver' /etc/resolv.conf | head -1 | awk '{print $2}')

if [ -z "$UPSTREAM_DNS" ]; then
    echo "ERROR: Could not detect upstream DNS server from /etc/resolv.conf"
    exit 1
fi

echo "Detected upstream DNS server: $UPSTREAM_DNS"

# Start dnsmasq in background, forwarding to the detected upstream DNS
dnsmasq --conf-file=/etc/dnsmasq.conf --server="$UPSTREAM_DNS"

# Update resolv.conf to point to localhost (dnsmasq)
echo "nameserver 127.0.0.1" > /etc/resolv.conf

echo "✓ dnsmasq started and DNS configured to use 127.0.0.1 (forwarding to $UPSTREAM_DNS)"
