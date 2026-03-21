#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Note: Domain-to-IP resolution is now handled by dnsmasq's --ipset feature
# (see start-dnsmasq.sh). This script no longer reads allowed-domains.txt or
# resolves domains — it only creates the ipset, fetches GitHub CIDR ranges,
# and sets up iptables rules. dnsmasq populates the ipset reactively from DNS.

# SECURITY NOTE: This script temporarily sets ACCEPT policies during execution
# to allow re-runs. If the script fails mid-execution, the error trap handler
# restores DROP policies for defense-in-depth. The 'set -euo pipefail' ensures
# we exit immediately on errors.

# Reset default policies to ACCEPT at the very start to allow re-runs
# Note: This is done before Docker DNS extraction to ensure any future
# network operations work correctly during script execution
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT

# Set up error trap to restore DROP policies if script fails
# This prevents leaving the container in a permissive state on error
cleanup_on_error() {
    echo "ERROR: Script failed, restoring DROP policies for security"
    iptables -P INPUT DROP 2>/dev/null || true
    iptables -P OUTPUT DROP 2>/dev/null || true
    iptables -P FORWARD DROP 2>/dev/null || true
}
trap cleanup_on_error ERR EXIT

# 1. Extract Docker DNS info BEFORE any flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Flush existing rules and delete existing ipsets
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# 2. Selectively restore ONLY internal Docker DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
else
    echo "No Docker DNS rules to restore"
fi

# First allow DNS and localhost before any restrictions
# Allow outbound DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
# Allow inbound DNS responses
iptables -A INPUT -p udp --sport 53 -j ACCEPT
# Allow outbound SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
# Allow inbound SSH responses
iptables -A INPUT -p tcp --sport 22 -m state --state ESTABLISHED -j ACCEPT
# Allow localhost
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT
# Allow metadata service (169.254.169.254 - used by cloud providers for instance metadata)
iptables -A OUTPUT -d 169.254.169.254 -j ACCEPT
iptables -A INPUT -s 169.254.169.254 -j ACCEPT

# Create ipset with CIDR support
ipset create allowed-domains hash:net

# Fetch GitHub meta information and aggregate + add their IP ranges
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi

if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi

echo "Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    echo "Adding GitHub range $cidr"
    ipset add allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# Domain-to-IP resolution is handled by dnsmasq's --ipset feature (configured in
# start-dnsmasq.sh). When a DNS query matches an allowed domain, dnsmasq automatically
# adds the resolved IP to the 'allowed-domains' ipset. This solves the dynamic IP
# problem — IPs are learned at query time rather than resolved once at startup.
#
# Restart dnsmasq so it picks up any new domains added to allowed-domains.txt
# since the last run, and re-learns IPs into the freshly created ipset.
if pgrep -x dnsmasq >/dev/null 2>&1; then
    echo "Restarting dnsmasq to pick up domain changes..."
    pkill -x dnsmasq || true
    # Wait for dnsmasq to fully release port 53 before restarting
    for i in 1 2 3 4 5; do
        pgrep -x dnsmasq >/dev/null 2>&1 || break
        sleep 1
    done
    /usr/local/bin/start-dnsmasq.sh
fi

# Get host IP from default route
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi

HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network detected as: $HOST_NETWORK"

# Set up remaining iptables rules
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# Add allow rules BEFORE setting DROP policy
# This ensures no traffic is blocked during the transition
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Log blocked outbound connections using NFLOG (works in containers)
# Group 1 is configured in ulogd to write to /var/log/ulogd-firewall.log
iptables -A OUTPUT -j NFLOG --nflog-group 1 --nflog-prefix "FIREWALL-BLOCK: "

# Reject remaining traffic immediately (instead of DROP timeout)
iptables -A OUTPUT -j REJECT --reject-with icmp-net-unreachable

# Prime the ipset by resolving key domains through dnsmasq BEFORE setting DROP.
# dnsmasq's --ipset feature adds resolved IPs on DNS response, but the ipset starts
# empty (except GitHub CIDRs). Pre-resolving ensures verification curls succeed.
echo "Priming ipset via DNS lookups..."
dig +short api.github.com >/dev/null 2>&1 || true

# Set default policies to DROP as the final step
# This is done AFTER all rules are added to prevent blocking traffic during setup
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

# Remove error trap now that configuration is complete and policies are locked down
trap - ERR EXIT

echo "Firewall configuration complete"

echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "Firewall verification passed - unable to reach https://example.com as expected"
fi

# Verify GitHub API access
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi
