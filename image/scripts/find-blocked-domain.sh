#!/bin/bash
# Correlate blocked IPs from iptables logs with domain names from DNS logs

set -euo pipefail

# Detect workspace root - environment variable or git root fallback
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

DNSMASQ_LOG="/var/log/dnsmasq.log"

# Configuration constants
DEFAULT_LIMIT=20                # Default number of recent blocks to show

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 [--recent] [--limit N] [IP_ADDRESS]"
    echo ""
    echo "Find domain names for blocked IP connections by correlating"
    echo "iptables firewall logs with dnsmasq DNS query logs."
    echo ""
    echo "Options:"
    echo "  --recent        Show all recent blocked connections with their domains"
    echo "  --limit N       Limit output to N most recent blocks (default: $DEFAULT_LIMIT)"
    echo "  IP_ADDRESS      Look up specific IP address"
    echo ""
    echo "Examples:"
    echo "  $0 --recent                # Show recent blocks"
    echo "  $0 --recent --limit 10     # Show last 10 blocks"
    echo "  $0 1.2.3.4                 # Look up specific IP"
    exit 1
}

# Check if dnsmasq log exists
if [ ! -f "$DNSMASQ_LOG" ]; then
    echo -e "${RED}ERROR: dnsmasq log not found at $DNSMASQ_LOG${NC}"
    echo "Make sure dnsmasq is running and logging is enabled."
    exit 1
fi

# Parse command line arguments
SHOW_RECENT=false
LIMIT=$DEFAULT_LIMIT
TARGET_IP=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --recent)
            SHOW_RECENT=true
            shift
            ;;
        --limit)
            LIMIT="$2"
            shift 2
            ;;
        --help|-h)
            usage
            ;;
        *)
            # Assume it's an IP address
            if [[ "$1" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                TARGET_IP="$1"
            else
                echo -e "${RED}ERROR: Invalid IP address: $1${NC}"
                usage
            fi
            shift
            ;;
    esac
done

# Default to --recent if no options specified
if [ "$SHOW_RECENT" = false ] && [ -z "$TARGET_IP" ]; then
    SHOW_RECENT=true
fi

# Find the original queried domain from a DNS resolution chain ending at a specific line
find_original_domain_for_line() {
    local from_line=$1
    local oldest_cname_domain=""

    # Read lines backwards from the A record, track the oldest CNAME domain
    while IFS= read -r line; do
        if [[ "$line" =~ reply\ ([^ ]+)\ is\ \<CNAME\> ]]; then
            oldest_cname_domain="${BASH_REMATCH[1]}"
        elif [[ "$line" =~ query\[A\] ]]; then
            break
        elif [[ "$line" =~ (forwarded|cached|reply) ]]; then
            continue
        else
            break
        fi
    done < <(head -n "$((from_line - 1))" "$DNSMASQ_LOG" | tac)

    if [ -n "$oldest_cname_domain" ]; then
        echo "$oldest_cname_domain"
    else
        local a_record_line
        a_record_line=$(sed -n "${from_line}p" "$DNSMASQ_LOG")
        if [[ "$a_record_line" =~ reply\ ([^ ]+)\ is\ [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "${BASH_REMATCH[1]}"
        fi
    fi
}

# Function to find domain for a specific IP
find_domain_for_ip() {
    local ip=$1
    grep -n -E "reply .* is ${ip}$" "$DNSMASQ_LOG" 2>/dev/null | tail -10 | while IFS=: read -r line_num _; do
        find_original_domain_for_line "$line_num"
    done | sort -u || true
}

# Function to check if domain is in allowlist
is_in_allowlist() {
    local domain=$1
    # Check both base and project-specific allowlists
    for allowlist in "/etc/allowed-domains.txt" "$WORKSPACE_ROOT/.devcontainer/allowed-domains.txt"; do
        if [ -f "$allowlist" ] && grep -qxF "$domain" "$allowlist" 2>/dev/null; then
            return 0
        fi
    done
    return 1
}

# Show recent blocked connections
if [ "$SHOW_RECENT" = true ]; then
    echo "Recent blocked connections (grouped by domain):"
    echo "==============================================="
    echo ""

    TEMP_FILE=$(mktemp)
    trap "rm -f $TEMP_FILE" EXIT

    while read -r line; do
        timestamp=$(echo "$line" | awk '{print $1, $2, $3}')
        dst_ip=$(echo "$line" | sed -n 's/.*DST=\([0-9.]*\).*/\1/p')
        dst_port=$(echo "$line" | sed -n 's/.*DPT=\([0-9]*\).*/\1/p')

        if [ -z "$dst_ip" ]; then
            continue
        fi

        domains=$(find_domain_for_ip "$dst_ip")
        if [ -n "$domains" ]; then
            echo "$domains" | while read -r domain; do
                echo "${domain}|${timestamp}|${dst_ip}:${dst_port}" >> "$TEMP_FILE"
            done
        else
            echo "UNKNOWN|${timestamp}|${dst_ip}:${dst_port}" >> "$TEMP_FILE"
        fi
    done < <(sudo /usr/local/bin/read-firewall-logs.sh | tail -"$LIMIT")

    if [ -f "$TEMP_FILE" ] && [ -s "$TEMP_FILE" ]; then
        sort "$TEMP_FILE" | awk -F'|' '
        BEGIN { current_domain = "" }
        {
            domain = $1
            timestamp = $2
            ip_port = $3

            if (domain != current_domain) {
                if (current_domain != "") {
                    print ""
                }
                current_domain = domain
                printf "%s\n", domain
            }
            printf "  [%s] %s\n", timestamp, ip_port
        }
        END { print "" }
        ' | while IFS= read -r line; do
            if [[ "$line" =~ ^[^[:space:]] ]]; then
                domain=$(echo "$line" | awk '{print $1}')
                if [ "$domain" = "UNKNOWN" ]; then
                    echo -e "${YELLOW}Unknown domain (no DNS query found)${NC}"
                elif is_in_allowlist "$domain"; then
                    echo -e "${GREEN}${domain}${NC} (already in allowlist)"
                else
                    echo -e "${RED}${domain}${NC} (NOT in allowlist)"
                fi
            else
                echo "$line"
            fi
        done
    else
        echo "No blocked connections found in recent logs."
    fi

    echo ""
    echo "To allow these domains, add to .devcontainer/allowed-domains.txt"

elif [ -n "$TARGET_IP" ]; then
    echo "Looking up IP: $TARGET_IP"
    echo "===================="
    echo ""

    domains=$(find_domain_for_ip "$TARGET_IP")
    if [ -n "$domains" ]; then
        echo "Found domains:"
        echo "$domains" | while read -r domain; do
            if is_in_allowlist "$domain"; then
                echo -e "  ${GREEN}${domain}${NC} (already in allowlist)"
            else
                echo -e "  ${RED}${domain}${NC} (NOT in allowlist)"
            fi
        done
    else
        echo "No domain found for IP $TARGET_IP"
        echo "Check if the DNS query was logged in $DNSMASQ_LOG"
    fi

else
    usage
fi
