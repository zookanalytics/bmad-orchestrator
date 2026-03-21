#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, and pipeline failures
IFS=$'\n\t'       # Stricter word splitting

# Start dnsmasq DNS forwarder with logging and ipset auto-population
# This script must be run with sudo privileges
#
# dnsmasq's --ipset feature automatically adds resolved IPs to the
# 'allowed-domains' ipset whenever a DNS query matches an allowed domain.
# This solves the dynamic IP problem — IPs are learned at query time,
# so changes to DNS (e.g., Google/Gemini API IPs rotating) are picked up
# automatically without requiring a firewall reload.

echo "Starting dnsmasq DNS forwarder..."

# Determine the upstream DNS server.
# On first run, read from resolv.conf (before we overwrite it).
# On restarts (e.g., init-firewall.sh re-runs), resolv.conf points to 127.0.0.1
# (dnsmasq itself), so we read the saved upstream from the state file instead.
UPSTREAM_STATE="/var/run/dnsmasq-upstream"

UPSTREAM_DNS=$(grep -E '^nameserver' /etc/resolv.conf | awk '{print $2}' | grep -v '^127\.0\.0\.1$' | head -1 || true)

if [ -n "$UPSTREAM_DNS" ]; then
    echo "Detected upstream DNS server: $UPSTREAM_DNS"
    # Save for future restarts
    echo "$UPSTREAM_DNS" > "$UPSTREAM_STATE"
elif [ -f "$UPSTREAM_STATE" ]; then
    UPSTREAM_DNS=$(cat "$UPSTREAM_STATE")
    echo "Using saved upstream DNS server: $UPSTREAM_DNS"
else
    # No resolv.conf entry and no saved state — fall back to Docker DNS
    UPSTREAM_DNS="127.0.0.11"
    echo "WARNING: No upstream DNS found, falling back to Docker DNS ($UPSTREAM_DNS)"
fi

# Detect workspace root for project-specific allowed domains.
# Prefer WORKSPACE_ROOT from caller (avoids running git as root).
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Generate --ipset directives from allowed-domains.txt files
# Each directive tells dnsmasq: when a DNS response matches this domain,
# add the resolved IP to the 'allowed-domains' ipset automatically.
# Format: --ipset=/<domain>/allowed-domains
IPSET_ARGS=()

generate_ipset_args() {
    local domains_file="$1"
    if [ ! -f "$domains_file" ]; then
        return
    fi

    echo "Generating ipset directives from $domains_file..."
    while IFS= read -r line; do
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        # Strip inline comments and trim whitespace, take first token as domain
        local trimmed
        trimmed=$(echo "$line" | xargs)
        [ -z "$trimmed" ] && continue
        local domain="${trimmed%%[[:space:]]*}"
        [ -z "$domain" ] && continue
        # Validate domain format: labels of letters/digits/hyphens separated by dots
        if [[ ! "$domain" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]]; then
            echo "  WARNING: Skipping invalid domain '$domain' in $domains_file"
            continue
        fi
        IPSET_ARGS+=("--ipset=/${domain}/allowed-domains")
        echo "  ipset: $domain -> allowed-domains"
    done < "$domains_file"
}

generate_ipset_args "/etc/allowed-domains.txt"
generate_ipset_args "$WORKSPACE_ROOT/.devcontainer/allowed-domains.txt"

echo "Generated ${#IPSET_ARGS[@]} ipset directives for dnsmasq"

# Start dnsmasq in background, forwarding to the detected upstream DNS
# Note: The 'allowed-domains' ipset may not exist yet (created by init-firewall.sh
# at a later step). dnsmasq handles this gracefully — it logs a warning on the first
# query but retries on subsequent queries. Once init-firewall.sh creates the ipset,
# all DNS responses automatically populate it.
dnsmasq --conf-file=/etc/dnsmasq.conf --server="$UPSTREAM_DNS" "${IPSET_ARGS[@]}"

# Update resolv.conf to point to localhost (dnsmasq)
echo "nameserver 127.0.0.1" > /etc/resolv.conf

echo "✓ dnsmasq started and DNS configured to use 127.0.0.1 (forwarding to $UPSTREAM_DNS)"
