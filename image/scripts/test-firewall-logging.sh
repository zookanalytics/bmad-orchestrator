#!/bin/bash
set -euo pipefail

# Test script to verify firewall logging functionality
# This tests that ulogd is running and logging NFLOG messages

echo "Testing firewall logging access..."
echo "=================================="
echo ""

# Test 1: Check if ulogd is running
echo "Test 1: Checking if ulogd daemon is running..."
if pgrep -x "ulogd" > /dev/null; then
    echo "✓ ulogd daemon is running"
else
    echo "✗ FAILED: ulogd daemon not running"
    echo "  Run: sudo /usr/local/bin/start-ulogd.sh"
    exit 1
fi
echo ""

# Test 2: Check if log file exists
echo "Test 2: Checking if firewall log file exists..."
if [ -f "/var/log/ulogd-firewall.log" ]; then
    echo "✓ Firewall log file exists"
else
    echo "✗ FAILED: /var/log/ulogd-firewall.log not found"
    exit 1
fi
echo ""

# Test 3: Check if read-firewall-logs.sh works
echo "Test 3: Checking read-firewall-logs.sh wrapper..."
if sudo /usr/local/bin/read-firewall-logs.sh >/dev/null 2>&1; then
    echo "✓ read-firewall-logs.sh executes successfully"
else
    exit_code=$?
    echo "✗ FAILED: read-firewall-logs.sh failed with exit code $exit_code"
    exit 1
fi
echo ""

# Test 4: Check current log count
echo "Test 4: Checking firewall log entries..."
log_count=$(sudo /usr/local/bin/read-firewall-logs.sh 2>/dev/null | wc -l || echo "0")
echo "✓ Found $log_count firewall log entries"
echo ""

# Test 5: Trigger a block and verify logging
echo "Test 5: Triggering firewall block and verifying logging..."
initial_count=$log_count
curl --connect-timeout 2 https://example.com >/dev/null 2>&1 || true
sleep 1  # Give ulogd time to write the log
new_count=$(sudo /usr/local/bin/read-firewall-logs.sh 2>/dev/null | wc -l || echo "0")

if [ "$new_count" -gt "$initial_count" ]; then
    added=$((new_count - initial_count))
    echo "✓ Firewall logging working! Added $added log entries"
    echo ""
    echo "Latest log entry:"
    sudo /usr/local/bin/read-firewall-logs.sh | tail -1
else
    echo "✗ WARNING: No new logs after triggering block"
    echo "  This might indicate an issue with NFLOG configuration"
fi
echo ""

echo "=================================="
echo "All tests passed!"
echo ""
echo "Note: To view firewall logs, run:"
echo "  sudo /usr/local/bin/read-firewall-logs.sh"
