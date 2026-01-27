---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowComplete: true
completedAt: "2026-01-26"
inputDocuments:
  - 'user-provided-seed: instance-manager-product-brief-seed'
  - 'user-provided: claude-instance CLI help documentation'
  - 'web-fetched: airops-worktree-cli-blog-post'
date: 2026-01-26
author: Node
---

# Product Brief: agent-env

## Executive Summary

agent-env is a CLI for creating isolated, AI-ready development environments that can run in parallel. It solves multiple isolation problems: preventing rogue agents from escaping their sandbox, keeping test databases separate, isolating dev servers, and ensuring one environment's state doesn't pollute another. Git worktrees provide parallelism but share your filesystem. agent-env gives you worktree-like parallelism with full isolation, plus configuration composition for working across multiple repos.

**Why this exists:** You want to run multiple AI agents in parallel, each with full dev tooling, without risking your machine or cross-contaminating environments. The bash script (claude-instance) proved the concept works. This formalizes it into a supported, testable codebase.

**Who it's for:** Built for one user (dogfooding daily). Published for others who want it.

**Agent-agnostic:** While Claude Code is the primary CLI today, agent-env makes no assumptions about which AI agent runs inside. Any agent CLI that works in a terminal works in agent-env.

---

## Core Vision

### Problem Statement

Running parallel AI agents on a single machine creates a tension between capability and safety. You want multiple agent instances working simultaneously—on different features, debugging, PR reviews—but they need isolation. Beyond agent safety, you also need separation between test databases, dev servers, and environment state across workstreams.

### Problem Impact

- **Real incident history**: AI agents have deleted files, wiped git repo clones, and modified state outside intended scope. Isolation is learned from pain, not theoretical.
- **Worktrees alone are unsafe**: Git worktrees enable parallel work but share the host filesystem. No sandbox = no protection.
- **Environment contamination**: Test DBs, dev servers, and local state from one workstream can pollute another.
- **Configuration tax**: Every repo needs its own devcontainer config. Updates mean N commits to N repos.
- **Bash scripts rot**: claude-instance worked but wasn't testable, maintainable, or shareable. A proper codebase is needed.

### Why Existing Solutions Fall Short

| Approach | Parallelism | Isolation | Dev Tooling | Gap |
|----------|-------------|-----------|-------------|-----|
| Git worktrees | Yes | No | Host-based | Rogue agent risk, shared state |
| Raw containers | Yes | Yes | Manual setup | Config fragmentation across repos |
| worktree-cli (AirOps) | Yes | Yes | Custom stack | No public tool, stack-specific |
| Bash scripts | Yes | Yes | Custom | Untestable, unmaintainable, rots over time |

### Proposed Solution

A CLI tool that:
1. **Creates isolated environments** - Sandboxed filesystem, processes, and optionally network; agents can't escape, tests/DBs/servers stay separated
2. **Enables parallel execution** - Multiple environments running simultaneously, each with its own git clone
3. **Provides full dev tooling** - Complete development environment, not a stripped-down sandbox
4. **Composes configuration** - Central baseline + repo overrides for working across multiple repos; updates propagate without commits
5. **Supports multiple attach methods** - Terminal-first (shell/tmux), VS Code optional. Full workflow without loading an IDE.
6. **Agent-agnostic** - Works with any AI agent CLI (Claude Code, Gemini CLI, Aider, etc.). No assumptions about which agent runs inside.

### Core Abstraction

**agent-env manages isolated development environments, not containers.**

The fundamental truths:
- Isolated filesystem
- Isolated processes
- Isolated network (optional)
- Complete dev tooling inside
- Visibility from outside (list, inspect, attach)

Today, this is implemented via Docker containers and the devcontainer spec. But the abstraction is the **environment**, not the container. If better isolation primitives emerge (Firecracker microVMs, WASM sandboxes, etc.), the CLI interface remains stable.

---

## Configuration & State

### Environment Detection

| Scenario | Behavior |
|----------|----------|
| **Native repo**: `.agent-env/` exists | Use `config.json` for repo overrides; track state in `state.json` |
| **Generic repo**: no `.agent-env/` | Use baseline config only; state stored in agent-env's central data directory |

### `.agent-env/` Structure

```
.agent-env/
├── config.json      # Repo-specific overrides
├── state.json       # Purpose, created timestamp, last attached, etc.
└── (extensible)     # Future: hooks, scripts, env templates
```

### Config Composition

Repo overrides win. Central baseline provides defaults; repos can override any setting. No complex merge—just layered precedence.

**Baseline config location:**
```
<agent-env-install>/config/baseline/
├── devcontainer.json   # Base container config
├── Dockerfile          # Base image definition
```
Versioned and updated with agent-env releases.

### Purpose Auto-Update

Agents update purpose by writing to `.agent-env/state.json`:
```json
{ "purpose": "JWT Authentication", "updatedAt": "..." }
```
agent-env reads this for `list` and `show`. Convention, not enforcement.

---

## CLI Design

### Command Structure

`agent-env <verb> [options] <name>` (matches claude-instance)

### Core Commands

| Command | Purpose |
|---------|---------|
| `create <name> [--repo <url\|path>] [--branch]` | Create new environment. Defaults to current folder's remote if in a git repo. |
| `list` | List all with status indicators |
| `show <name>` | Detailed info for one environment |
| `purpose <name> [value]` | Get or set mutable purpose |
| `remove [--force] <name>` | Delete with safety checks |
| `rebuild <name>` | Re-compose config and rebuild container; preserves git state |
| `config show <repo>` | Display composed config before create |

### Terminal Commands

| Command | Purpose |
|---------|---------|
| (no args) | Interactive menu/picker |
| `dashboard` | tmux overview of all terminals |
| `attach <name>` | Direct terminal attach |
| `run <name> <command>` | Execute command in instance (critical for orchestrator) |

### Status Indicators

- ✓ Clean git state
- ● Uncommitted changes
- ↑ Unpushed commits (any branch)
- ⚠ Config drift from baseline

### Safety Checks

- Uncommitted: staged + unstaged + untracked
- Unpushed: ALL branches, not just current
- Stashed changes
- Require `--force` to override

### Orchestrator Contract

**`agent-env list --json`** returns:
```json
[
  {
    "name": "agent-1",
    "repo": "bmad-orchestrator",
    "status": "running",
    "purpose": "JWT Auth",
    "gitState": { "dirty": false, "unpushed": 2 },
    "createdAt": "...",
    "lastAttached": "..."
  }
]
```
Orchestrator consumes this; no filesystem assumptions.

---

## Open Design Decisions

| Decision | Options | Leaning |
|----------|---------|---------|
| **Instance storage location** | Sibling folders / Central `~/.agent-env/instances/` / Configurable | Central managed directory for clean enumeration |

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Config debugging hell | `config show` command; clear conflict errors; dry-run mode |
| Slow startup | Pre-built base images, fast-path for common case |
| Janky orchestrator integration | Explicit JSON contract, CLI-based discovery |
| Safety check gaps | Comprehensive git status, dedicated test coverage |
| IDE dependency | Terminal attach is first-class; VS Code is optional |

---

## Prior Art

**claude-instance (internal)** - Bash script that proved this works. Comprehensive CLI with:
- Core lifecycle: `create`, `list`, `show`, `remove`
- Purpose tracking: mutable labels stored in `.claude-metadata.json`, agent-updatable
- Terminal sharing: `menu` (interactive picker), `dashboard` (tmux overview), `attach` (direct), `run` (execute command)
- Status indicators: ✓ clean, ● uncommitted, ↑ unpushed, ⚠ env drift
- Safety checks: uncommitted, unpushed on ANY branch, stashed
- Architecture: sibling folders with reference instance for env sync

Reliable but bash, untestable, unmaintainable. Direct foundation for agent-env.

**worktree-cli (AirOps)** - [Blog post](https://www.airops.com/blog/worktree-cli-running-parallel-ai-agents-across-isolated-dev-environments) describing similar goals. Validates the problem space. No public code.

---

## Target Users

### Primary User

**The Parallel AI Developer (You)**

A developer running multiple AI agent workstreams simultaneously across different contexts: core project work, infrastructure tooling, and external repos (forks, modifications).

**Profile:**
- Expert-level, comfortable with BMAD methodology, Claude Code, containers
- Solo developer dogfooding daily
- Runs AI agents in YOLO mode—needs isolation as the safety net
- Terminal-first workflow, with seamless VS Code integration for visual tasks
- Expects session continuity across clients—same tmux session from any interface
- Doesn't want to think about configuration—internal repos have rich setup, external repos get baseline AI tools
- External repos are first-class: fork, spin, agent, done—zero configuration
- Mental model: one instance per logical workstream, not per task
- Instances are long-lived and repurposed, not ephemeral

**Typical Workday:**
- 1-2 instances on external repos (forks, third-party with modifications)
- Multiple instances on core project using BMAD (parallel stories, different epics)
- Instances for infrastructure tool improvements (like agent-env itself)
- VS Code for visual work (diffs, code review, debugging); terminal for quick checks and commands

**Why Isolation Matters:**
- YOLO mode gives agents elevated permissions—isolation prevents escape
- Parallel work on same repo requires separate state (branches, DBs, servers)
- External repos shouldn't affect core project environment
- Long-running workstreams need stable, isolated state across days/weeks
- Repurposing an instance for a new workstream is cleaner than polluting host state

**Friction Points Avoided:**
- Configuration anxiety: "Will this instance have what I need?"
- For internal repos: `.agent-env/` ensures rich, consistent setup
- For external repos: baseline provides AI tools ready to go, zero config

**Success Moment:**
Start an agent before bed, check results in the morning. Confident the isolation held overnight—no 3am anxiety about what the agent might be doing to your machine.

**Failure Mode to Avoid:**
Friction that makes it faster to skip isolation. If agent-env is slower or more complex than "just run it locally," it won't get used.

### Secondary Users

**Design philosophy:** Built for the primary user first, but designed to be usable by anyone who needs AI agent isolation.

**Who can use this:**
- Any developer who wants to run AI agents safely—BMAD not required
- Beginners benefit *more* from isolation—they're more likely to cause accidental damage
- Expert features available; safe defaults for everyone

**Feedback welcome:** This is built for one person's workflow, but published to help others. If you hit friction, that's valuable signal. Issues and feedback help the tool grow beyond its original scope.

### User Journey

| Phase | Experience |
|-------|------------|
| **Discovery** | Already knows they need this—built it to scratch their own itch |
| **Onboarding** | `agent-env` with no args → interactive menu; immediate productivity |
| **Core Usage** | Create instance → attach → run agent in YOLO mode → check results → repurpose or tear down |
| **Aha Moment** | Agent completes full workstream in isolation; PR-ready branch with zero host impact |
| **Completion** | Workstream done, PR merged → delete instance or repurpose for next workstream |
| **Hygiene** | `agent-env list` shows last-attached date; stale instances flagged for cleanup |
| **Long-term** | Default way to run AI agents. Never run YOLO on host again. |

### Instance Lifecycle Clarity

**Repurposing vs. fresh instances:**
- **Repurposing** means git-only: checkout new branch, update purpose, continue working
- **Fresh instance** is safer if previous workstream was untrusted or experimental
- **Reset command** (future): wipe runtime state while preserving git and config—middle ground between repurpose and delete

**Staleness visibility:**
- `agent-env list` shows last-attached timestamp
- Instances untouched for extended periods are visually flagged
- Prevents zombie instance accumulation

### Session Continuity (Core UX Principle)

- Every instance runs a persistent tmux session
- VS Code integrated terminal, host terminal, phone via SSH—all attach to the same session
- Pick up where you left off, from any client
- The session is the source of truth, not the interface

**Interface honesty:** This is a terminal-first tool. VS Code integration is seamless, but the CLI and tmux are the primary design targets. If you prefer GUI-only workflows, this tool may feel awkward.

---

## Success Metrics

### The Only Metric That Matters

**% of dev work in agent-env = 100%**

If you're using it for all development, it's working. If you're bypassing it to "just run locally," something's wrong. Everything else is diagnostic.

### Core Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **% of dev work in agent-env** | 100% within 1 week of MVP | The top-line metric. Usage = success. |
| **Time-to-productive** | < 5 seconds from attach | Friction kills adoption. First command must work—no post-attach debugging. |
| **Data loss incidents** | 0 forever | Trust is binary. One incident of lost work = tool is dead. Safety checks must be comprehensive. |
| **Generic repo success rate** | 95%+ first-try success | External repos are half the use case. Baseline-only must work as well as full config. |
| **Config issues per week** | 0 after initial setup | Baseline must be stable. Config rot = friction = abandonment. |

### What We Don't Measure

**You'll feel it.** These aren't tracked because direct experience is the feedback loop:

- **Create/rebuild speed** — If it's too slow, you'll know
- **Attach reliability** — If it fails, you'll know immediately
- **Session continuity** — Works or doesn't; no gradations
- **Devcontainer fluidity** — Captured in time-to-productive

### The Zero Incidents Rule

**Non-negotiable:** Zero data loss from delete operations. Ever.

Safety checks cover:
- Staged, unstaged, untracked files
- Unpushed commits on ALL branches
- Stashed changes

**Recovery matters too:** System failures (container dies, volume issue) need documented recovery paths. Preventing user-initiated loss isn't enough.

### Business Objectives

**N/A** — Personal utility tool. No revenue, growth, or market targets.

**Quality bar:** Good enough to publish without embarrassment.

---

## MVP Scope

### Core Features (Day One)

**The Ship-It Bar:** Create an instance → attach via terminal → first command works. If you're productive within 5 seconds of attach, MVP is complete.

| Feature | Description | Why MVP |
|---------|-------------|---------|
| `create <name> [--repo] [--attach]` | Clone repo, compose config, spin up container. `--attach` immediately connects. | Core function + common flow optimization |
| `list` / `ps` | Show all instances with status and purpose. `ps` alias for Docker muscle memory. JSON first, human formatting on top. | Need to see what's running and why |
| `attach <name>` | Terminal attach via tmux | Primary interface |
| `remove [--force] <name>` | Delete with comprehensive safety checks | Lifecycle completion |
| `purpose <name> [value]` | Get/set mutable purpose. Auto-suggest from branch name on create. | Context for multi-instance workflow |
| Interactive menu (no args) | Simple numbered prompts for MVP. Full Ink TUI deferred. | Zero-friction entry point |
| Productive baseline | Claude Code, git signing, SSH agent, shell | Time-to-productive is the real gate |

### Implementation Notes

| Optimization | Rationale |
|--------------|-----------|
| `create --attach` | Most common flow is create-then-attach. Save a step. |
| `ps` alias | Docker users' muscle memory. Trivial to add. |
| JSON-first `list` | Build `list --json` first, add human formatting on top. Scripting API early. |
| Auto-suggest purpose | Derive from branch name (`feature/auth` → "auth"). Less friction, still editable. |
| Numbered menu | Ship faster than full Ink TUI. Polish later. |

### Comprehensive Safety Checks (Non-Negotiable)

**MVP must include all of these.** One data loss incident = tool is dead.

- Staged files
- Unstaged changes
- Untracked files
- Unpushed commits on ALL branches (not just current)
- Stashed changes
- Require `--force` to override any block

### Quick Follow (Same Sprint)

Leaner set after SCAMPER elimination:

| Feature | Description |
|---------|-------------|
| `run <name> <command>` | Execute command in instance |
| Status indicators | ✓ clean, ● uncommitted, ↑ unpushed in `list` |

### Deferred (Post-MVP)

| Feature | Rationale |
|---------|-----------|
| `show <name>` | `list` with purpose is enough to start |
| `dashboard` | Nice-to-have; `list` + `attach` covers core workflow |
| Full Ink TUI | Numbered prompts work for MVP; polish later |

### Configuration Scope

**MVP:** Baseline config for TypeScript repos. Full AI tooling that works on first attach:
- Claude Code authenticated and ready
- Git signing configured
- SSH agent forwarded
- tmux running
- Shell properly configured

**Deferred:**
- `.agent-env/` repo override support
- `config show` command
- Multiple language/stack baselines
- `rebuild` command

### Out of Scope for MVP

| Feature | Rationale |
|---------|-----------|
| `reset` command | Not essential for core workflow |
| Repo override config | Start baseline-only |
| `config show` | Not needed until config complexity grows |
| `rebuild` command | Requires config composition |
| Multiple stack baselines | Expand after TypeScript works |
| Staleness flagging | Nice-to-have hygiene feature |
| `show <name>` | Deferred — `list` is enough |
| `dashboard` | Deferred — `list` + `attach` covers workflow |

### MVP Success Criteria

1. **Daily driver within 1 week** — Using agent-env for 100% of AI agent work
2. **Time-to-productive < 5 seconds** — First command after attach works. No post-attach debugging.
3. **Replaces claude-instance** — All core functionality in testable codebase
4. **Zero data loss** — Comprehensive safety checks prevent any lost work

### Future Vision

**Phase 2 (Post-MVP):**
- `show <name>` for detailed instance info
- `dashboard` for tmux overview
- Full Ink TUI for interactive menu
- Config composition: baseline + `.agent-env/` repo overrides
- `rebuild` command for updating instances
- `config show` for debugging
- Multiple stack baselines (Python, Go, etc.)
- Staleness visibility in `list`
- `reset` command

**Phase 3 (Aspirational):**
- Full orchestrator integration with structured dispatch
- Pre-built base images for faster cold starts
- Instance templates for common patterns

**Phase 4 (North star):**
- Alternative isolation backends (Firecracker, etc.)
- Multi-machine orchestration
- NOT team features — stays a lean personal tool
