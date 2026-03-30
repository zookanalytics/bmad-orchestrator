---
"@zookanalytics/agent-env": patch
---

Fix localhost access blocked by domain-based firewall filtering

Chrome 145+ resolves localhost to [::1] (IPv6 only), but the firewall only configured
iptables (IPv4) rules. Added ip6tables loopback rules and defense-in-depth IPv4 ipset
entries to ensure localhost is never blocked.
