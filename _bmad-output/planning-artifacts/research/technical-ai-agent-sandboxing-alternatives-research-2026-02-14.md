---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
workflowType: 'research'
lastStep: 4
research_type: 'technical'
research_topic: 'AI Agent Sandboxing & Isolation Tool Alternatives'
research_goals: 'Find open source tools that can replace custom agent-env/claude-devcontainer features to reduce maintenance burden and adopt existing standards'
user_name: 'Node'
date: '2026-02-14'
web_research_enabled: true
source_verification: true
---

# Research Report: AI Agent Sandboxing & Isolation Tool Alternatives

**Date:** 2026-02-14
**Author:** Node
**Research Type:** Technical — Build vs. Buy Analysis

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [1. Network Firewall / Egress Filtering](#1-network-firewall--egress-filtering)
- [2. AI Agent Safety Hooks](#2-ai-agent-safety-hooks)
- [3. Transcript / History Search](#3-transcript--history-search)
- [4. Credential Management](#4-credential-management)
- [5. Container Isolation & Full Sandbox Platforms](#5-container-isolation--full-sandbox-platforms)
- [6. Adjacent Capabilities Worth Knowing](#6-adjacent-capabilities-worth-knowing)
- [7. Proxy-Based Egress Filtering (Firewall Replacement)](#7-proxy-based-egress-filtering-firewall-replacement)
- [8. Additional Tools Evaluated](#8-additional-tools-evaluated)
- [Feature-by-Feature Verdict Matrix](#feature-by-feature-verdict-matrix)
- [Recommended Action Items](#recommended-action-items)
- [Sources](#sources)

---

## Executive Summary

After extensive web research across 100+ sources (February 2026), the AI agent sandboxing landscape has matured significantly. However, **no single tool replaces all of our implementation**. The findings break into three categories:

### Tools You Should Adopt (Reduce Maintenance)

| Tool | Replaces | Maintenance Savings |
|------|----------|-------------------|
| **Smokescreen** (Stripe) | iptables + ipset + dnsmasq + ulogd firewall | Eliminates ~400 lines of custom scripts. YAML domain allowlist, CONNECT-based (no MITM/CA certs), built-in SSRF protection. Fixes stale-IP problem permanently. MIT license. |
| **raine/claude-history** | search-history.sh (Claude portion) | Rust CLI with fuzzy-search TUI, resume integration. Better UX than grep. |
| **Gitleaks** (or TruffleHog) | Enhances prevent-sensitive-files.py | 500-800+ secret type patterns vs our limited custom patterns. Can be called from PreToolUse hook. |

### Tools to Evaluate (High Potential)

| Tool | Why Evaluate | Status |
|------|------------|--------|
| **SLB** (Simultaneous Launch Button) | Two-person rule for destructive commands. Tiered approval workflow, command normalization for evasion resistance, audit trail, rollback capture. Claude Code hooks integration. | MIT, v0.1.0, single maintainer |

### Tools to Monitor (Not Ready Yet)

| Tool | Why Monitor | Status |
|------|------------|--------|
| **Docker Sandboxes** | Full microVM isolation with built-in network proxy, purpose-built for AI agents | Proprietary (Docker Desktop), not OSS |
| **Matchlock** | Proxy-based secret injection (secrets never in sandbox) | Young project (438 stars), MIT license |
| **cass_memory_system** | Cross-agent procedural memory with confidence-tracked rules | Alpha, sole maintainer, no contributions accepted |
| **Community Claude Code hooks** | Shared hook libraries could emerge | No comprehensive library exists yet |

### Features to Keep (No Alternatives Exist)

| Feature | Why Keep |
|---------|---------|
| **prevent-env-leakage.py** | No tool blocks env var exposure in CLI commands. Unique. |
| **prevent-bash-sensitive-args.py** | No tool filters bash arguments for sensitive files. Unique. |
| **prevent-main-push.sh / prevent-no-verify.sh / prevent-admin-flag.sh** | Pre-execution (before git runs). Git tools like Gitleaks operate at commit level (after). Different lifecycle. |
| **Shared credential architecture** (symlinks + named volumes) | No open source tool solves "login once to Claude/Gemini, share across containers." Novel problem. |
| **Cross-CLI transcript search** (Claude + Gemini + ZSH) | raine/claude-history is Claude-only. No cross-CLI tool exists. |

---

## 1. Network Firewall / Egress Filtering

### Our Current Implementation

- **iptables + ipset** for IP-level firewalling (deny-by-default)
- **dnsmasq** for DNS query logging and forwarding
- **Domain allowlist files** (allowed-domains.txt) resolved to IPs via DNS
- **ulogd** for firewall logging (NFLOG group 1)
- **Custom scripts**: `init-firewall.sh`, `find-blocked-domain.sh` (DNS↔firewall log correlation)
- **Requires**: NET_ADMIN + NET_RAW + SYSLOG capabilities
- **Pain point**: DNS-to-IP correlation is fragile; IPs change and require firewall reload

### Best Alternative: Anthropic Sandbox Runtime

- **Repository**: [anthropic-experimental/sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime)
- **Stars**: ~3,000 | **License**: Apache 2.0 | **Status**: Research preview (updated Jan 2026)
- **Confidence**: [High] — from Anthropic, designed for Claude Code

**How it works:**
- Lightweight OS-level sandboxing (no container required)
- Linux bubblewrap and macOS seatbelt backends
- **HTTP/HTTPS mediation via HTTP proxy** (not iptables — application-level)
- **TCP mediation via SOCKS5 proxy**
- **Domain allowlists and denylists** — native, no DNS correlation needed
- Filesystem restrictions (explicit mounts only)

**Why this is better than our approach:**
- No NET_ADMIN/NET_RAW capabilities required
- No DNS-to-IP correlation scripts (proxy sees actual hostnames)
- No iptables rule management
- No dnsmasq/ulogd daemon management
- Built specifically for Claude Code
- Domain-level filtering at application layer (not IP-level)

**Trade-offs:**
- Research preview — APIs may evolve
- Proxy-based approach doesn't cover raw TCP by IP (only SOCKS5 mediated)
- Would need to verify Gemini CLI compatibility

**Migration path:** Convert `allowed-domains.txt` to sandbox-runtime config. Test with Claude Code. Monitor for GA release.

_Source: [GitHub](https://github.com/anthropic-experimental/sandbox-runtime), [InfoQ](https://www.infoq.com/news/2025/11/anthropic-claude-code-sandbox/)_

### Runner-up: Docker Sandbox Network Proxy

- **URL**: [docs.docker.com/ai/sandboxes/network-policies/](https://docs.docker.com/ai/sandboxes/network-policies/)
- **License**: Proprietary (Docker Desktop) | **Status**: GA (Docker Engine 29.1.5+)

**Features:**
- Native FQDN/domain-based filtering (not just IP)
- Two modes: allowlist (deny-by-default) and denylist
- Proxy runs on host at `host.docker.internal:3128`
- Declarative CLI: `docker sandbox network proxy --policy allow --allow-host github.com`
- Purpose-built for AI agent sandboxing

**Why not recommended over sandbox-runtime:**
- Proprietary (part of Docker Desktop, not open source)
- Requires Docker Sandboxes (microVM layer), not plain devcontainers
- Would require rearchitecting from DevContainers to Docker Sandboxes

_Source: [Docker Docs](https://docs.docker.com/ai/sandboxes/network-policies/), [Docker Blog](https://www.docker.com/blog/docker-sandboxes-a-new-approach-for-coding-agent-safety/)_

### Other Evaluated Options (Not Recommended)

| Tool | License | Why Not |
|------|---------|---------|
| **Squid** (transparent proxy) | GPL v2+ | Still requires NET_ADMIN for transparent mode. Simpler FQDN ACLs but heavier than needed. |
| **Tinyproxy** | GPL v2+ | Lightweight (2MB), good regex filtering. Still needs NET_ADMIN for transparent mode. v1.6.3 released Jan 2026. |
| **Cilium** (Docker plugin) | Apache 2.0 | Native eBPF FQDN policies. Excellent but heavy learning curve; most docs focus on Kubernetes. |
| **CoreDNS + filter plugin** | Apache 2.0 | Could replace dnsmasq but still needs iptables for enforcement. Different problem. |
| **nftables** (Docker 29.0.0+) | Kernel | Cleaner syntax than iptables but still IP-only. Doesn't solve DNS correlation. |
| **Pi-hole** | EUPL v1.2 | Designed for blocklisting (ad-blocking), not allowlisting. Wrong paradigm. |

_Sources: [Squid](https://wiki.squid-cache.org/SquidFaq/SquidAcl), [Tinyproxy](https://github.com/tinyproxy/tinyproxy), [Cilium](https://cilium.io/), [CoreDNS](https://coredns.io/)_

---

## 2. AI Agent Safety Hooks

### Our Current Implementation

Six PreToolUse hooks intercept Claude Code and Gemini CLI tool calls BEFORE execution:

| Hook | What It Blocks |
|------|----------------|
| `prevent-main-push.sh` | `git push origin main/master` |
| `prevent-no-verify.sh` | `git commit --no-verify` / `-n` |
| `prevent-admin-flag.sh` | `gh ... --admin` |
| `prevent-env-leakage.py` | Commands exposing `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*`, etc. |
| `prevent-bash-sensitive-args.py` | Bash commands accessing `.env`, private keys, credentials files |
| `prevent-sensitive-files.py` | Read/Edit/Write tools accessing sensitive files |

Plus `lib/patterns.py` — shared pattern library for sensitive file/env var detection.

### Finding: No Comprehensive Alternative Exists

**Claude Code hook ecosystem (Feb 2026):**
- Community hooks exist but are **fragments, not libraries**
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — curated list, some hook examples
- [claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery) — tutorial-style examples
- Individual blog posts show basic patterns (block `rm -rf`, block force push)
- **No shared pattern library as comprehensive as ours**

**Gemini CLI hooks (Feb 2026):**
- [Official BeforeTool hooks](https://developers.googleblog.com/tailor-gemini-cli-to-your-workflow-with-hooks/) — functionally equivalent to Claude Code PreToolUse
- Same concept, different CLI. No shared ecosystem between Claude and Gemini hooks.
- Extensions can bundle hooks, but community libraries are early-stage.

_Sources: [Claude Code Hooks](https://code.claude.com/docs/en/hooks), [Gemini CLI Hooks](https://geminicli.com/docs/hooks/), [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)_

### Complementary Tool: Gitleaks (for Secret Detection)

- **Repository**: [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks)
- **Stars**: 19,000+ | **License**: MIT (core) | **Downloads**: 20M+ Docker
- **Confidence**: [High] — mature, actively maintained

**What it does:**
- 500+ secret type regex patterns (AWS credentials, API keys, tokens, passwords)
- Can run as pre-commit hook (`gitleaks protect --staged`)
- Fast, lightweight scanner written in Go

**How it could enhance our hooks:**
- Call from `prevent-bash-sensitive-args.py` or `prevent-sensitive-files.py`
- Adds pattern breadth we don't have (500+ types vs our focused patterns)
- Catches secret content in files being written/edited

**What it does NOT do:**
- Does not intercept tool calls (it's a scanner, not a hook)
- Cannot block env var exposure in commands
- Cannot block git push to main (different scope)

**Integration example:**
```bash
#!/bin/bash
# PreToolUse hook wrapper
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
if [ "$TOOL_NAME" = "Write" ]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content')
  echo "$CONTENT" | gitleaks detect --pipe --no-git
  if [ $? -ne 0 ]; then
    echo '{"error": "File contains secrets"}' >&2
    exit 2
  fi
fi
exit 0
```

_Source: [Gitleaks GitHub](https://github.com/gitleaks/gitleaks)_

### Also Considered: TruffleHog

- **Repository**: [trufflesecurity/trufflehog](https://github.com/trufflesecurity/trufflehog)
- **Stars**: 23,000+ | **License**: Open core + Enterprise

**Differentiator**: 800+ credential detectors with **active verification** (tests if secrets are live by calling APIs).

**Why Gitleaks over TruffleHog for hooks:** Gitleaks is faster (no API calls), MIT-licensed, and we need real-time blocking (verification latency is problematic). Use TruffleHog for periodic scanning, not real-time interception.

_Source: [TruffleHog](https://github.com/trufflesecurity/trufflehog)_

### Guardrail Frameworks (Not Applicable)

| Framework | Why Not Applicable |
|-----------|-------------------|
| **Guardrails AI** (Apache 2.0) | Validates LLM **outputs** (post-execution). Not tool-call interception. |
| **NVIDIA NeMo Guardrails** (Apache 2.0) | "Execution rails" can intercept but designed for LangChain/LlamaIndex, not Claude Code. Would require massive custom wrapping. |
| **LangGraph HITL** | Tool-call interception but for LangChain agents. Incompatible execution model. |

_Sources: [Guardrails AI](https://github.com/guardrails-ai/guardrails), [NeMo Guardrails](https://github.com/NVIDIA-NeMo/Guardrails)_

### Verdict: Keep Our Hooks, Enhance with Gitleaks

Our PreToolUse hooks fill a **real gap** in the ecosystem. Per [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/), pre-execution tool-call interception is a best practice. Our implementation is ahead of the open source curve.

**Action**: Integrate Gitleaks into our hook pipeline for broader secret detection patterns. Keep all six hooks custom.

---

## 3. Transcript / History Search

### Our Current Implementation

`search-history.sh` — Bash script that searches:
- ZSH command history (per-instance, at `/shared-data/instance/<id>/zsh_history`)
- Claude conversation history (per-instance JSONL at `/shared-data/instance/<id>/claude/history.jsonl`)
- Literal string matching via `grep -F`
- Groups results by instance, shows timestamps, detects stale instances (30+ days)

### Best Alternative: raine/claude-history

- **Repository**: [raine/claude-history](https://github.com/raine/claude-history)
- **Language**: Rust | **Install**: `brew install raine/claude-history/claude-history`
- **Confidence**: [High] — well-documented, actively maintained

**Features:**
- Built-in terminal UI with **fuzzy search** (much better UX than grep)
- Multi-word AND logic, case-insensitive
- Ledger-style conversation viewer with scrolling
- Tool call display modes (off / truncated / full)
- `--resume` flag to continue conversations via `claude --resume <id>`
- Fast (Rust performance)

**What it replaces:** The Claude portion of `search-history.sh`

**What it does NOT cover:**
- Gemini CLI history (Claude-only)
- ZSH command history
- Multi-instance cross-search (runs in project directory)

**Trade-off:** Better UX for Claude searches but loses our cross-CLI, cross-instance search capability. Consider using both — `claude-history` for interactive Claude searches, `search-history.sh` for cross-instance/cross-CLI grep.

_Source: [GitHub](https://github.com/raine/claude-history)_

### Also Evaluated

| Tool | Type | Verdict |
|------|------|---------|
| **claude-code-history-viewer** ([GitHub](https://github.com/jhlee0409/claude-code-history-viewer)) | Desktop app (Tauri + React), MIT license | Complementary — great for analytics/cost tracking/visualization. Not a CLI search replacement. |
| **claude-conversation-extractor** ([GitHub](https://github.com/ZeroSumQuant/claude-conversation-extractor)) | Python CLI, multi-format export | Better for archival/sharing than day-to-day search. |
| **Langfuse / Phoenix / AgentOps** | Self-hosted observability platforms | Overkill — require application-level instrumentation, heavy infra (3 databases for Langfuse). Designed for production LLM apps, not CLI transcript search. |
| **fblog** ([GitHub](https://github.com/brocode/fblog)) | Rust JSON log viewer | Could enhance JSONL filtering (Lua-based expressions). Complement, not replacement. |

### Verdict: Adopt claude-history, Keep search-history.sh for Cross-CLI

Recommend `brew install raine/claude-history/claude-history` for interactive Claude searches. Keep `search-history.sh` for cross-CLI and cross-instance needs. Consider filing an issue on claude-history for multi-instance support.

---

## 4. Credential Management

### Our Current Implementation

- **Named Docker volumes** share credentials across container instances
- **Symlink architecture**: shared credentials (`.claude/credentials.json`, `.gemini/oauth_creds.json`, `gh/hosts.yml`) vs isolated per-instance data (conversation history, project state, todos)
- `setup-instance-isolation.sh` — 13-step initialization with flock locking, atomic writes, rollback on failure
- `setup-claude-auth-sharing.sh` — manual credential propagation
- SSH agent forwarding via Docker socket mount
- Read-only `.gitconfig` mount

### Finding: No Drop-In Replacement Exists

This is a **novel problem** — "authenticate once to Claude Code / Gemini CLI, share credentials across N container instances while keeping conversation history isolated per-instance." No open source tool solves this.

**Evaluated tools:**

| Tool | What It Solves | Why Not a Replacement |
|------|---------------|----------------------|
| **docker-credential-helpers** ([GitHub](https://github.com/docker/docker-credential-helpers)) | Docker registry credentials in native keystores | Different problem (registry auth, not AI CLI auth) |
| **DevPod** ([GitHub](https://github.com/loft-sh/devpod), MPL-2.0) | Automatic Git/Docker credential sync | Requires adopting entire DevPod ecosystem. Tightly integrated. |
| **SOPS + age** ([GitHub](https://github.com/getsops/sops), MPL-2.0) | Encrypted secrets in version control | Overkill for local dev. Adds encryption/decryption step. |
| **HashiCorp Vault** (BSL 1.1) | Centralized secrets management | Massive infrastructure overhead. Wrong scale. |
| **1Password SSH Agent** | SSH key management in devcontainers | Proprietary. Only covers SSH, not Claude/Gemini/gh. |
| **Official DevContainer features** | Git/SSH credential forwarding | Already using this pattern. Doesn't extend to AI CLI tools. |

**Your approach validation:**
- Docker named volumes is the [recommended Docker best practice](https://docs.docker.com/engine/storage/volumes/) for persistent data sharing
- Your symlink architecture (shared auth, isolated history) is inventive and works well
- The flock-based locking and atomic writes show production-grade engineering

### Verdict: Keep Current Implementation

No tool to adopt. Your approach is sound and solves a novel problem. The main risk is maintenance of the symlink setup, but the alternative is building nothing (and authenticating in every container).

_Sources: [Docker Volumes](https://docs.docker.com/engine/storage/volumes/), [DevPod](https://devpod.sh/docs/developing-in-workspaces/credentials)_

---

## 5. Container Isolation & Full Sandbox Platforms

### Our Current Implementation

- DevContainer-based per-instance isolation
- Docker containers with NET_ADMIN + NET_RAW + SYSLOG capabilities
- Non-root user (`node`) with sudo for specific scripts
- Workspace-as-atomic-unit model (containers disposable, workspaces persist)

### Full Platform Alternatives

These are **holistic sandbox platforms** — if you adopted one, it would replace the entire `agent-env` CLI and `claude-devcontainer` image:

| Platform | Stars | License | Self-Hosted | Cold Start | Session Limit | Key Feature |
|----------|-------|---------|-------------|------------|---------------|-------------|
| **E2B** | 10.9k | Apache 2.0 | Experimental | <200ms | 24h | Firecracker microVMs. $21M Series A. |
| **Daytona** | 56.2k | AGPL-3.0 | Yes | <90ms | Unlimited | Fastest cold start. Docker-native. |
| **Docker Sandboxes** | N/A | Proprietary | Local | Fast | N/A | MicroVM isolation. Purpose-built for AI agents. |
| **microsandbox** | 4.8k | Apache 2.0 | Yes | <200ms | Unlimited | libkrun-based. OCI compatible. |
| **NanoClaw** | 8.3k | MIT | Yes | Fast | N/A | ~500 lines TypeScript. Apple Containers (macOS). |
| **Matchlock** | 438 | MIT | Yes | N/A | N/A | Network allowlists + proxy-based secret injection. |
| **k8s-sigs/agent-sandbox** | 528 | Apache 2.0 | Yes (K8s) | Sub-second | N/A | Official Kubernetes CRD. gVisor/Kata backends. |
| **Anthropic Sandbox Runtime** | 3k | Apache 2.0 | Yes | N/A | N/A | OS-level. bubblewrap/seatbelt. Domain proxy. |

### Assessment: Not Worth Adopting (Yet)

**Why not replace with a full platform:**

1. **You need DevContainer compatibility** — your workflow is DevContainer-based (VS Code, `.devcontainer/` in every repo). Full sandbox platforms use their own abstraction, not DevContainers.

2. **You need persistent workspaces** — your containers are disposable but workspaces persist. Most sandboxes are ephemeral (E2B: 24h max, Vercel: 45 min).

3. **You need credential sharing across instances** — no platform solves this.

4. **You need hook integration** — no platform provides PreToolUse hook equivalent.

5. **AGPL-3.0 concern** — Daytona's license is restrictive for commercial use.

**However**: Anthropic Sandbox Runtime is worth partial adoption for its **network isolation** (see Section 1). It doesn't require replacing your container architecture.

### Matchlock: Worth Monitoring

- **Repository**: [jingkaihe/matchlock](https://github.com/jingkaihe/matchlock)
- **Stars**: 438 | **License**: MIT

**Unique feature**: Proxy-based secret injection — secrets are never inside the sandbox. The proxy injects them in-flight. The agent only sees placeholders. This is architecturally superior to our approach of mounting credentials.

**Why not adopt now**: Young project, small community. But the proxy-injection pattern is worth stealing conceptually.

_Sources: [E2B](https://github.com/e2b-dev/E2B), [Daytona](https://github.com/daytonaio/daytona), [Docker Sandboxes](https://docs.docker.com/ai/sandboxes/), [Matchlock](https://github.com/jingkaihe/matchlock), [Anthropic Sandbox Runtime](https://github.com/anthropic-experimental/sandbox-runtime)_

---

## 6. Adjacent Capabilities Worth Knowing

### Isolation Technology Landscape (2026)

| Technology | Isolation Level | Cold Start | Used By |
|------------|----------------|------------|---------|
| **Firecracker** (microVM) | Hardware virtualization, dedicated kernel | ~125ms | E2B, Sprites, Vercel, AWS Lambda |
| **gVisor** (user-space kernel) | Syscall interception | 20-50% overhead | Modal, GKE Agent Sandbox |
| **Kata Containers** (microVM) | OCI-compatible VMs | Varies | Northflank, Kubernetes |
| **Docker containers** | Linux cgroups + namespaces | Minimal | Our approach, Daytona |
| **bubblewrap** (OS sandbox) | Linux namespace isolation | Instant | Anthropic Sandbox Runtime |
| **Apple Containers** (macOS) | macOS native isolation | Fast | NanoClaw |
| **WebAssembly** | Browser-grade sandbox | Instant | Microsoft Wassette (emerging) |

**Key insight (2026):** Standard Docker containers share the host kernel — a kernel vulnerability could allow container escape. MicroVMs provide dedicated kernels. For our use case (developer environments, not multi-tenant production), Docker containers with our firewall + hooks are sufficient. But if threat model escalates, consider Firecracker-based platforms.

_Sources: [Northflank](https://northflank.com/blog/how-to-sandbox-ai-agents), [Docker Blog](https://www.docker.com/blog/docker-sandboxes-a-new-approach-for-coding-agent-safety/)_

### OWASP Top 10 for Agentic Applications (2026)

Released December 2025 by 100+ industry experts. Our implementation aligns with several key mitigations:

- **Tool Misuse** (Risk #1): Our PreToolUse hooks directly address this
- **Agent Goal Hijacking** (Risk #2): Network isolation limits exfiltration
- **Credential Leakage**: Our env-leakage and sensitive-file hooks address this
- **Insufficient Sandboxing**: Our container + firewall addresses this

Our approach is **validated by industry best practices**.

_Source: [OWASP](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)_

### Awesome-Sandbox Repo

**Repository**: [restyler/awesome-sandbox](https://github.com/restyler/awesome-sandbox)

Curated list of all AI code sandboxing solutions. Good reference to periodically check for new entrants.

---

## 7. Proxy-Based Egress Filtering (Firewall Replacement)

### Problem Statement

Our current iptables + ipset + dnsmasq + ulogd firewall (~400 LoC of custom scripts) is **brittle**: when a domain resolves to new IPs, the ipset becomes stale and traffic breaks. A forward proxy operating at the domain/hostname level would eliminate this entirely — the proxy sees the actual hostname in CONNECT requests, so IP changes are transparent.

### Architecture Shift: iptables → Forward Proxy

Instead of kernel-level IP filtering, run a forward proxy as a sidecar (or inside the container) and configure `HTTP_PROXY`/`HTTPS_PROXY` environment variables. The proxy inspects hostnames from HTTP requests and HTTPS CONNECT tunnels, checks against a domain allowlist, and allows or denies. No `NET_ADMIN`, no `NET_RAW`, no `SYSLOG` capabilities needed.

### Solutions Evaluated

#### Smokescreen (Stripe) — RECOMMENDED

- **Repository**: [stripe/smokescreen](https://github.com/stripe/smokescreen)
- **Stars**: 1,200 | **License**: MIT | **Contributors**: 60 | **Commits**: 711
- **Status**: Battle-tested in production at Stripe for all webhook egress traffic

**How it works:** Purpose-built egress proxy. YAML ACL with domain allowlists including `*.example.com` wildcard support. Inspects CONNECT request hostnames — no MITM, no CA certificates. Single Go binary, trivially containerizable.

**Example config:**
```yaml
version: v1
services:
  - name: devcontainer
    project: agent-env
    action: enforce
    allowed_domains:
      - github.com
      - "*.github.com"
      - "*.githubusercontent.com"
      - registry.npmjs.org
      - "*.anthropic.com"
      - "*.googleapis.com"
default:
  project: default
  action: enforce
  allowed_domains: []
```

```bash
smokescreen --listen-port 4750 --egress-acl-file /etc/smokescreen/acl.yaml
```

**Why Smokescreen wins:**
- **Purpose-built** for exactly this problem (egress domain filtering)
- **MIT license** (non-copyleft)
- **No MITM / no CA certs** — uses CONNECT tunnel inspection
- **SSRF protection built in** — blocks connections to private IP ranges automatically
- **Prometheus metrics** — immediate observability of blocked/allowed traffic
- **Simple YAML config** — closest to "list domains, start proxy, done"
- **Single Go binary** — minimal container footprint, no runtime dependencies

**Migration path:** Convert `allowed-domains.txt` entries to Smokescreen YAML. Build a minimal Docker image with the Go binary. Add as a sidecar service or run inside the devcontainer. Set `HTTP_PROXY=http://smokescreen:4750` and `HTTPS_PROXY=http://smokescreen:4750`. Remove `init-firewall.sh`, `find-blocked-domain.sh`, `start-dnsmasq.sh`, `start-ulogd.sh`, `read-firewall-logs.sh`, `test-firewall-logging.sh`, and drop `NET_ADMIN`/`NET_RAW`/`SYSLOG` capabilities.

_Source: [GitHub](https://github.com/stripe/smokescreen), [Fly.io SSRF article](https://fly.io/blog/practical-smokescreen-sanitizing-your-outbound-web-requests/)_

#### Squid Proxy

- **License**: GPL v2+ (copyleft) | **Status**: Battle-tested for decades

**How it works:** ACL-based with `dstdomain` type for hostname matching. CONNECT tunneling for HTTPS (no MITM needed for domain filtering). Subdomain matching via `.example.com` syntax.

**Example config:**
```
acl allowed_domains dstdomain "/etc/squid/allowed_domains.txt"
http_access allow CONNECT SSL_ports allowed_domains
http_access allow allowed_domains
http_access deny all
```

**Pros:** Ancient, battle-tested, extensive documentation.
**Cons:** GPL license (copyleft concern), arcane configuration language with 200+ directives, heavier than needed for simple allowlisting.

_Source: [Squid ACL Docs](https://wiki.squid-cache.org/SquidFaq/SquidAcl)_

#### Tinyproxy

- **Stars**: 5,700 | **License**: GPL v2+ (copyleft)

**How it works:** `Filter` file with POSIX regex patterns and `FilterDefaultDeny Yes` for deny-by-default. CONNECT tunneling for HTTPS.

**Pros:** ~2MB memory footprint, extremely lightweight, simple config.
**Cons:** GPL license, POSIX regex syntax for domain matching (less ergonomic than YAML/glob), less actively maintained.

_Source: [GitHub](https://github.com/tinyproxy/tinyproxy)_

#### mitmproxy (standalone, not Tollbooth)

- **Stars**: 42,300 | **License**: MIT

**How it works:** Full MITM proxy. Requires a custom Python addon script for domain allowlisting (not built-in). Requires generating and installing CA certificates in the container.

**Pros:** MIT license, extremely mature, deep traffic inspection capability.
**Cons:** Overpowered for simple allowlisting. CA certificate management adds complexity. Python runtime dependency. Heavy compared to Go-based alternatives.

_Source: [GitHub](https://github.com/mitmproxy/mitmproxy)_

#### Caddy + forwardproxy plugin

- **Stars**: 66,800 (Caddy) / 693 (plugin) | **License**: Apache 2.0

**How it works:** `allow_file` and `deny_file` directives with `*.example.com` wildcard support. Caddyfile syntax is the most ergonomic of all options.

**Pros:** Most elegant configuration syntax, Apache 2.0, single Go binary.
**Cons:** The forwardproxy plugin is marked **"experimental"** and the last tagged release was July 2019. The maintainers are seeking new maintainers. Not ready for production dependency.

_Source: [GitHub](https://github.com/caddyserver/forwardproxy)_

#### Envoy Proxy

- **Stars**: 27,500 | **License**: Apache 2.0

**How it works:** Dynamic forward proxy filter with route-level domain matching via `:authority` header inspection on CONNECT requests.

**Verdict:** Massively overpowered. A minimal forward proxy config is 50-100+ lines of deeply nested YAML. Designed for service mesh, not devcontainer egress filtering. 100MB+ Docker image.

_Source: [GitHub](https://github.com/envoyproxy/envoy)_

#### Anthropic Sandbox Runtime (proxy component)

The proxy component (TypeScript HTTP + SOCKS5 proxies) is tightly integrated into the `SandboxManager` class. Not extractable as a standalone sidecar without significant work. The whole runtime replaces containers with OS-level sandboxing (bubblewrap/seatbelt) — not designed to complement devcontainers.

### Proxy Comparison Matrix

| Criterion | **Smokescreen** | Squid | Tinyproxy | mitmproxy | Caddy+fwdproxy | Envoy |
|-----------|-----------------|-------|-----------|-----------|----------------|-------|
| **Domain allowlisting** | YAML ACL (native) | `dstdomain` ACL | Regex filter | Python addon | `allow_file` ACL | Route matching |
| **HTTPS approach** | CONNECT tunnel | CONNECT tunnel | CONNECT tunnel | MITM (CA cert) | CONNECT tunnel | CONNECT matcher |
| **Needs CA cert?** | No | No | No | Yes | No | No |
| **Config complexity** | **Low** | Moderate | Low | High | Very Low | Very High |
| **License** | **MIT** | GPL v2+ | GPL v2+ | MIT | Apache 2.0 | Apache 2.0 |
| **Battle-tested** | **Yes (Stripe)** | Yes (decades) | Moderate | Yes | Experimental | Yes (CNCF) |
| **Sidecar weight** | **Single Go binary** | ~8MB Alpine | ~2MB RAM | Heavy (Python) | Single Go binary | 100MB+ |
| **SSRF protection** | **Built-in** | No | No | No | No | Manual |
| **Prometheus metrics** | **Yes** | Basic logs | Basic logs | Rich web UI | Caddy metrics | Prometheus |

### Verdict: Adopt Smokescreen

**Smokescreen replaces the entire iptables/ipset/dnsmasq/ulogd stack** with a simpler, more maintainable, domain-native approach. Key benefits over our current implementation:

1. **No stale IP problem** — proxy resolves domains at request time
2. **No NET_ADMIN/NET_RAW/SYSLOG capabilities** — user-space proxy process
3. **~400 lines of scripts eliminated** — replaced by a YAML config file
4. **SSRF protection for free** — blocks private IP connections automatically
5. **Prometheus metrics** — better observability than ulogd parsing

---

## 8. Additional Tools Evaluated

### 8.1 SLB — Simultaneous Launch Button (Two-Person Rule for AI Agents)

- **Repository**: [Dicklesworthstone/slb](https://github.com/Dicklesworthstone/slb)
- **Stars**: 56 | **License**: MIT | **Language**: Go | **Created**: 2025-12-13

**What it does:** Implements a "two-person rule" for AI coding agents. When an agent attempts a destructive command (`rm -rf`, `git push --force`, `terraform destroy`, `DROP TABLE`, etc.), SLB blocks execution until a peer (human or another agent) reviews and explicitly approves it.

**Key features:**
- **Risk-tiered command classification** — CRITICAL (2 approvals), DANGEROUS (1 approval), CAUTION (auto-approve after delay), SAFE (immediate)
- **Command normalization** — resolves `bash -c '...'`, strips `sudo`/`env`/`nohup` wrappers, splits `&&`/`||`, resolves path traversal (`rm -rf /tmp/../../etc` → `rm -rf /etc`)
- **Cryptographic approval binding** — SHA-256 hash ties approval to exact command
- **Approval TTL** — approvals expire (30min dangerous, 10min critical)
- **Rollback state capture** — filesystem snapshots, git state before destructive commands
- **Claude Code hooks integration** — generates `.claude/hooks.json` with `pre_bash` hook
- **SQLite audit trail** — all requests, reviews, and outcomes persisted
- **Interactive TUI** — Bubble Tea dashboard for reviewers
- **Rate limiting** — max 5 pending, max 10/minute

**Relevance to our stack:**

| Concern | Our Current Approach | SLB's Approach |
|---------|---------------------|----------------|
| Dangerous git ops | Binary block (hooks exit 2) | Tiered approval workflow |
| Scope | 6 specific hooks | 100+ command patterns across git, shell, SQL, K8s, Terraform, Docker, AWS |
| Evasion resistance | Simple regex matching | Command normalization (wrapper stripping, path traversal resolution, compound splitting) |
| Audit trail | Container stdout | SQLite database with full session/review history |
| Recovery | None | Rollback snapshots (filesystem, git state) |
| Multi-agent review | Not supported | Built-in (Agent Mail protocol) |

**Assessment:** SLB does not replace our hooks — it adds a **command-level approval workflow** layer that sits alongside them. Our hooks block env variable leakage and sensitive file access (which SLB does not address). SLB adds graduated approval, audit trails, and rollback capture (which we don't have). The command normalization for evasion resistance is notably more sophisticated than our simple regex matching.

**Verdict:** **EVALUATE** — SLB's Claude Code hooks integration means it can coexist with our existing hooks. The approval workflow and audit trail are valuable if we move toward multi-agent scenarios. The evasion-resistance patterns (path traversal, wrapper stripping) are worth studying even if we don't adopt SLB itself. Early-stage (v0.1.0, single maintainer) is the main risk.

_Source: [GitHub](https://github.com/Dicklesworthstone/slb)_

### 8.2 cass_memory_system — Cross-Agent Procedural Memory

- **Repository**: [Dicklesworthstone/cass_memory_system](https://github.com/Dicklesworthstone/cass_memory_system)
- **Stars**: 225 | **License**: MIT | **Language**: TypeScript (Bun) | **Status**: Alpha

**What it does:** A learning layer that extracts confidence-tracked rules ("playbook bullets") from AI agent session logs across 11+ agent providers (Claude Code, Cursor, Codex, Aider, Gemini, etc.). Not a transcript search tool — it distills knowledge and feeds context back to agents before tasks.

**Three-layer architecture:**
- **Episodic Memory** — raw session logs, searched via `cass` CLI (Rust, 456 stars)
- **Working Memory** — structured diary entries (session summaries)
- **Procedural Memory** — distilled rules with 90-day confidence decay, anti-pattern inversion

**Key dependency:** `cass` CLI ([coding_agent_session_search](https://github.com/Dicklesworthstone/coding_agent_session_search)) — Rust CLI/TUI for indexing and searching session logs from 11+ agent providers. This is a strong transcript search tool on its own, supporting more agents than `raine/claude-history` (Claude-only).

**Assessment:** Solves a fundamentally different problem than transcript search. The `cass` CLI dependency is worth evaluating as an alternative to `raine/claude-history` if multi-agent transcript search matters. The procedural memory concept is compelling but carries alpha-stage risk, sole-maintainer bus factor, Bun runtime dependency, and a "no outside contributions" policy.

**Verdict:** **MONITOR** — The `cass` CLI is worth evaluating for multi-agent transcript search. The full memory system is too early to depend on.

_Source: [GitHub](https://github.com/Dicklesworthstone/cass_memory_system), [cass CLI](https://github.com/Dicklesworthstone/coding_agent_session_search)_

### 8.3 Tollbooth — MITM Proxy for LLM Traffic Inspection

- **Repository**: [FlechetteLabs/Tollbooth](https://github.com/FlechetteLabs/Tollbooth)
- **Stars**: 5 | **License**: AGPL-3.0 | **Age**: 3 weeks | **Status**: Self-described as "vibecoded"

**What it does:** Transparent MITM proxy (built on mitmproxy) purpose-built for inspecting, debugging, and modifying LLM agent network traffic. Web UI with conversation trees, rules engine with `drop` actions, ML-powered refusal detection, and replay capabilities.

**Assessment:** Not a security/sandboxing tool. Allow-by-default, relies on agents respecting `HTTP_PROXY` env vars. The Layer 7 visibility concept (parsed LLM conversations, prompt injection detection) is architecturally interesting but the AGPL license, 3-week age, and self-described "vibecoded" status make it unsuitable for adoption.

**Verdict:** **SKIP** — AGPL license and extreme immaturity. The L7 LLM traffic inspection concept is worth keeping in mind for the future.

_Source: [GitHub](https://github.com/FlechetteLabs/Tollbooth)_

### 8.4 system_resource_protection_script — Host Responsiveness (Not Applicable)

- **Repository**: [Dicklesworthstone/system_resource_protection_script](https://github.com/Dicklesworthstone/system_resource_protection_script)
- **Stars**: 25 | **License**: MIT

**What it does:** OS-level process priority management (ananicy-cpp, sysctl tuning, systemd limits) to prevent runaway processes from making a dev workstation unresponsive.

**Verdict:** **NOT APPLICABLE** — Zero overlap with our sandboxing stack. Different problem domain (host responsiveness vs security/isolation). Most mechanisms require privileged access and are inoperable inside non-privileged Docker containers.

_Source: [GitHub](https://github.com/Dicklesworthstone/system_resource_protection_script)_

---

## Feature-by-Feature Verdict Matrix

| Feature | Our Implementation | Best Alternative | Verdict | Confidence |
|---------|-------------------|------------------|---------|------------|
| **Network firewall** | iptables + ipset + dnsmasq + ulogd (~400 LoC) | **Smokescreen** (MIT, Stripe, CONNECT proxy) | **ADOPT** — eliminates DNS↔IP correlation, no NET_ADMIN needed, simple YAML config | [High] |
| **prevent-env-leakage.py** | Custom PreToolUse hook | Nothing exists | **KEEP** — unique implementation, no alternative | [High] |
| **prevent-bash-sensitive-args.py** | Custom PreToolUse hook | Nothing exists | **KEEP** — unique implementation, no alternative | [High] |
| **prevent-sensitive-files.py** | Custom PreToolUse hook + patterns.py | **Gitleaks** (MIT, 500+ patterns) enhances | **KEEP + ENHANCE** — keep hook, add Gitleaks for broader patterns | [High] |
| **prevent-main-push.sh** | Custom PreToolUse hook | Community examples exist but not libraries | **KEEP** — operates earlier in safety chain than git hooks | [High] |
| **prevent-no-verify.sh** | Custom PreToolUse hook | Community examples exist | **KEEP** — unique to agent safety context | [High] |
| **prevent-admin-flag.sh** | Custom PreToolUse hook | Nothing found | **KEEP** — unique implementation | [High] |
| **Transcript search** | search-history.sh (grep-based) | **raine/claude-history** (Rust, fuzzy TUI) or **cass** (multi-agent) | **ADOPT** for Claude searches, evaluate `cass` for multi-agent | [High] |
| **Credential sharing** | Symlinks + named volumes + flock | Nothing exists | **KEEP** — novel problem, sound architecture | [High] |
| **Container isolation** | DevContainer + Docker + agent-env CLI | E2B, Daytona, Docker Sandboxes (all different paradigm) | **KEEP** — DevContainer compatibility required | [Medium] |
| **Secret detection patterns** | patterns.py (~50 patterns) | **Gitleaks** (500+) / **TruffleHog** (800+) | **ENHANCE** — integrate Gitleaks patterns | [High] |
| **Command approval workflow** | Not implemented | **SLB** (MIT, Go, two-person rule) | **EVALUATE** — adds graduated approval, audit trail, rollback | [Medium] |
| **Cross-agent memory** | Not implemented | **cass_memory_system** (MIT, alpha) | **MONITOR** — compelling concept, too early to adopt | [Low] |

---

## Recommended Action Items

### Immediate (Low Effort, High Impact)

1. **Replace iptables firewall with Smokescreen** — Build a minimal Docker image with the Smokescreen Go binary. Convert `allowed-domains.txt` to Smokescreen YAML ACL. Run as a sidecar or inside the devcontainer. Set `HTTP_PROXY`/`HTTPS_PROXY`. This eliminates `init-firewall.sh`, `find-blocked-domain.sh`, `start-dnsmasq.sh`, `start-ulogd.sh`, `read-firewall-logs.sh`, `test-firewall-logging.sh` (~400 LoC), drops `NET_ADMIN`/`NET_RAW`/`SYSLOG` capabilities, and fixes the stale-IP problem permanently.

2. **Install raine/claude-history** — `brew install raine/claude-history/claude-history`. Better UX for Claude transcript searches. Keep `search-history.sh` for cross-CLI. Also evaluate `cass` CLI if multi-agent transcript search is needed.

3. **Install Gitleaks** in the Docker image — Add `gitleaks` to Dockerfile. Integrate as a subprocess call from `prevent-sensitive-files.py` for broader pattern coverage.

### Short-Term (Moderate Effort, High Value)

4. **Evaluate SLB for command approval workflow** — Test SLB's Claude Code hooks integration alongside our existing hooks. The tiered approval workflow (vs binary allow/block), command normalization for evasion resistance, and audit trail add capabilities we don't have. Especially valuable if moving toward multi-agent scenarios.

### Medium-Term (Monitor)

5. **Monitor Matchlock's proxy-injection pattern** — If it matures, the concept of "secrets never in the sandbox" is architecturally superior to our volume-mounted credentials.

6. **Monitor cass_memory_system** — The procedural memory concept (cross-agent learning with confidence decay) is compelling. Too early to adopt (alpha, sole maintainer, no contributions accepted), but worth revisiting quarterly.

7. **Consider open-sourcing our hook library** — Our `lib/patterns.py` and hook collection fills a real ecosystem gap. Publishing to awesome-claude-code or as a standalone npm/pip package could attract community contributions and reduce our maintenance burden through shared ownership.

8. **Monitor Docker Sandboxes** — If Docker open-sources their microVM + network proxy, it could replace both our container isolation and firewall layers in one move.

### Periodic Review

9. **Check [awesome-sandbox](https://github.com/restyler/awesome-sandbox)** quarterly for new entrants in the AI agent sandboxing space. This landscape is moving fast.

---

## Sources

### AI Agent Sandbox Platforms
- [E2B GitHub](https://github.com/e2b-dev/E2B) — Apache 2.0, 10.9k stars
- [Daytona GitHub](https://github.com/daytonaio/daytona) — AGPL-3.0, 56.2k stars
- [Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) — Proprietary, GA 2026
- [Anthropic Sandbox Runtime](https://github.com/anthropic-experimental/sandbox-runtime) — Apache 2.0, 3k stars
- [Matchlock GitHub](https://github.com/jingkaihe/matchlock) — MIT, 438 stars
- [microsandbox GitHub](https://github.com/zerocore-ai/microsandbox) — Apache 2.0, 4.8k stars
- [NanoClaw GitHub](https://github.com/qwibitai/nanoclaw) — MIT, 8.3k stars
- [kubernetes-sigs/agent-sandbox](https://github.com/kubernetes-sigs/agent-sandbox) — Apache 2.0, 528 stars
- [Rivet Sandbox Agent](https://github.com/rivet-dev/sandbox-agent) — Apache 2.0, 826 stars
- [awesome-sandbox](https://github.com/restyler/awesome-sandbox)

### Network Isolation & Egress Filtering
- [Smokescreen GitHub](https://github.com/stripe/smokescreen) — MIT, 1.2k stars (Stripe)
- [Fly.io: Practical Smokescreen](https://fly.io/blog/practical-smokescreen-sanitizing-your-outbound-web-requests/)
- [Squid ACL Documentation](https://wiki.squid-cache.org/SquidFaq/SquidAcl) — GPL v2+
- [Tinyproxy GitHub](https://github.com/tinyproxy/tinyproxy) — GPL v2+
- [mitmproxy GitHub](https://github.com/mitmproxy/mitmproxy) — MIT, 42.3k stars
- [Caddy forwardproxy](https://github.com/caddyserver/forwardproxy) — Apache 2.0
- [Envoy Proxy](https://github.com/envoyproxy/envoy) — Apache 2.0, 27.5k stars
- [Cilium](https://cilium.io/) — Apache 2.0
- [CoreDNS](https://coredns.io/) — Apache 2.0
- [Docker nftables Support](https://docs.docker.com/engine/network/firewall-nftables/)
- [Docker Sandbox Network Policies](https://docs.docker.com/ai/sandboxes/network-policies/)
- [Docker Blog: Agent Safety](https://www.docker.com/blog/docker-sandboxes-a-new-approach-for-coding-agent-safety/)
- [InfoQ: Claude Code Sandboxing](https://www.infoq.com/news/2025/11/anthropic-claude-code-sandbox/)

### AI Agent Hooks & Guardrails
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Gemini CLI Hooks](https://geminicli.com/docs/hooks/)
- [Google Developers Blog: Gemini CLI Hooks](https://developers.googleblog.com/tailor-gemini-cli-to-your-workflow-with-hooks/)
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- [claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)
- [Guardrails AI GitHub](https://github.com/guardrails-ai/guardrails) — Apache 2.0
- [NVIDIA NeMo Guardrails](https://github.com/NVIDIA-NeMo/Guardrails) — Apache 2.0
- [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)

### Secret Detection
- [Gitleaks GitHub](https://github.com/gitleaks/gitleaks) — MIT, 19k+ stars
- [TruffleHog GitHub](https://github.com/trufflesecurity/trufflehog) — 23k+ stars
- [detect-secrets GitHub](https://github.com/Yelp/detect-secrets) — Apache 2.0
- [GitGuardian ggshield](https://github.com/GitGuardian/ggshield) — MIT

### Credential Management
- [Docker Volumes Best Practices](https://docs.docker.com/engine/storage/volumes/)
- [VS Code: Sharing Git Credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)
- [DevPod Credentials](https://devpod.sh/docs/developing-in-workspaces/credentials) — MPL-2.0
- [SOPS GitHub](https://github.com/getsops/sops) — MPL-2.0

### Transcript/History Search
- [raine/claude-history](https://github.com/raine/claude-history) — Rust CLI
- [claude-code-history-viewer](https://github.com/jhlee0409/claude-code-history-viewer) — MIT
- [claude-conversation-extractor](https://github.com/ZeroSumQuant/claude-conversation-extractor)
- [Langfuse](https://langfuse.com/self-hosting) — MIT
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — OSS

### Command Safety & Approval
- [SLB GitHub](https://github.com/Dicklesworthstone/slb) — MIT, 56 stars

### Cross-Agent Memory & Transcript Tools
- [cass_memory_system GitHub](https://github.com/Dicklesworthstone/cass_memory_system) — MIT, 225 stars
- [cass CLI (coding_agent_session_search)](https://github.com/Dicklesworthstone/coding_agent_session_search) — MIT, 456 stars

### Traffic Inspection
- [FlechetteLabs/Tollbooth](https://github.com/FlechetteLabs/Tollbooth) — AGPL-3.0, 5 stars

### Isolation Technologies
- [Firecracker GitHub](https://github.com/firecracker-microvm/firecracker) — Apache 2.0, 32k stars
- [Northflank: How to Sandbox AI Agents 2026](https://northflank.com/blog/how-to-sandbox-ai-agents)
- [Top AI Sandbox Platforms 2026](https://northflank.com/blog/top-ai-sandbox-platforms-for-code-execution)
- [NVIDIA: Security Guidance for Sandboxing](https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/)
