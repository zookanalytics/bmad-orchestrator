---
stepsCompleted: [1, 2, 3, 4, 7, 9, 10, 11]
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-instance-manager-2026-01-26.md'
  - '_bmad-output/planning-artifacts/research/technical-ai-dev-environment-tools-research-2026-01-03.md'
  - '_bmad-output/planning-artifacts/research/technical-state-management-devcontainers-research-2026-01-03.md'
documentCounts:
  briefs: 1
  research: 2
  brainstorming: 0
  projectDocs: 0
workflowType: 'prd'
lastStep: 11
status: complete
---

# Product Requirements Document - agent-env

**Author:** Node
**Date:** 2026-01-26

## Executive Summary

agent-env is a CLI for creating isolated, AI-ready development environments that can run in parallel. It solves multiple isolation problems: preventing rogue agents from escaping their sandbox, keeping test databases separate, isolating dev servers, and ensuring one environment's state doesn't pollute another. Git worktrees provide parallelism but share your filesystem. agent-env gives you worktree-like parallelism with full isolation, plus configuration composition for working across multiple repos.

**Why this exists:** You want to run multiple AI agents in parallel, each with full dev tooling, without risking your machine or cross-contaminating environments. The bash script (claude-instance) proved the concept works. This formalizes it into a supported, testable codebase.

**Who it's for:** Built for one user (dogfooding daily). Published for others who want it.

**Agent-agnostic:** While Claude Code is the primary CLI today, agent-env makes no assumptions about which AI agent runs inside. Any agent CLI that works in a terminal works in agent-env.

### What Makes This Special

**Isolation with parallelism.** Full container isolation without sacrificing the ability to run multiple workstreams simultaneously. Each environment has its own filesystem, processes, and optionally network.

**Session continuity.** Every instance runs a persistent tmux session. VS Code, host terminal, phone via SSH—all attach to the same session. The session is the source of truth, not the interface.

**Agent-agnostic by design.** Works with Claude Code, Gemini CLI, Aider, or any future AI agent CLI. No assumptions baked in.

**Zero-config for external repos.** Fork a repo, spin up an instance, start working. Baseline config provides full AI tooling without commits to the external repo.

### Non-Negotiables

**Speed is survival.** If isolation adds friction, it won't get used. Time-to-productive must be under 5 seconds from attach.

**Zero data loss. Ever.** Safety checks cover staged, unstaged, untracked, stashed, and unpushed commits on ALL branches. One incident kills trust.

**External repos are first-class.** 95%+ should work with baseline alone. If zero-config requires constant config, it's not zero-config.

## Project Classification

**Technical Type:** CLI Tool + Developer Tool hybrid
**Domain:** General (developer tooling)
**Complexity:** Low - standard software practices, no regulatory requirements
**Project Context:** Greenfield - formalizing claude-instance bash script into testable codebase

## Success Criteria

### User Success

**Core Success Metric:** "I know my environment is ready."

- Open instance → core tools loaded → start working immediately
- No post-attach debugging or "why isn't X working?"
- Works whether you're on your main project or a random external fork
- **Aha moment:** First attach where everything just works. Claude Code authenticated, git signing configured, shell ready. No friction.

### Business Success

| Horizon | Success Indicator |
|---------|-------------------|
| **1 week** | Daily driver for 100% of AI agent work |
| **1 month** | Still using it, not reverting to bash script or bare host |
| **Longer term** | Quality bar = "good enough to publish without embarrassment" |

**Note:** Personal utility tool. No revenue, growth, or market targets.

### Technical Success

| Dimension | Criteria |
|-----------|----------|
| **Codebase Health** | Clear, readable architecture. "I can modify it without fear." |
| **CI/CD** | GitHub Actions automation that gives confidence in changes |
| **Iteration Speed** | Local development workflow—test changes without full CI push |
| **Platform** | Mac + Linux support. Terminal-first. |
| **Testability** | Testable codebase (the whole point of formalizing the bash script) |

### Measurable Outcomes

- Time-to-productive: < 5 seconds from attach to first command
- Data loss incidents: 0 forever (non-negotiable)
- External repo success rate: 95%+ work first-try with baseline
- Config issues after initial setup: 0 per week

## Product Scope

### MVP - Minimum Viable Product

What must work for this to be useful:

- `create <name> [--repo] [--attach]` - Clone repo, spin up container, optionally attach immediately
- `list` / `ps` - Show all instances with status and purpose
- `attach <name>` - Terminal attach via tmux
- `remove [--force] <name>` - Delete with comprehensive safety checks
- `purpose <name> [value]` - Get/set mutable purpose
- Interactive menu (no args) - Simple numbered prompts for MVP
- Productive baseline - Claude Code, git signing, SSH agent, tmux, shell configured
- Comprehensive safety checks - staged, unstaged, untracked, stashed, unpushed on ALL branches

### Growth Features (Post-MVP)

What makes it pleasant to live in:

- `run <name> <command>` - Execute command in instance (orchestrator contract)
- `show <name>` - Detailed instance info
- `dashboard` - tmux overview of all instances
- Status indicators in `list` - ✓ clean, ● uncommitted, ↑ unpushed
- Full Ink TUI for interactive menu (replacing numbered prompts)
- Config composition - baseline + `.agent-env/` repo overrides
- `rebuild` command for updating instances without recreating

### Vision (Future)

The dream version:

- Multiple stack baselines (Python, Go, etc. beyond TypeScript)
- Staleness visibility and cleanup suggestions
- `reset` command - wipe runtime state while preserving git
- Full orchestrator integration with structured dispatch
- Pre-built base images for faster cold starts
- Alternative isolation backends (Firecracker, etc.) if better primitives emerge

## User Journeys

### Journey 1: Node - The Morning Standup Flow

Node starts his day with three agent-env instances from yesterday—one finished a BMAD story overnight, one is mid-implementation on a different epic, and one he spun up for a quick fix to an external dependency. He opens his terminal and types `agent-env`.

The interactive menu shows:

```
agent-env instances:

  1. bmad-orch-auth    ✓ clean     "JWT authentication"      2h ago
  2. bmad-orch-api     ● uncommit  "API layer refactor"      12m ago
  3. external-cli-fix  ↑ unpushed  "CLI help text fix"       18h ago

[1-3] attach  [c] create  [q] quit
```

At a glance: instance 1 is git-clean (ready for new work or teardown). Instance 2 has uncommitted changes (agent paused or still working—he'll check). Instance 3 has unpushed commits—that PR he meant to submit yesterday.

*Note: The timestamp shows last-attached time. Whether the agent succeeded, failed, or is stuck isn't visible here—agent-env tracks git state, not agent state. Agent status visibility is a future orchestrator concern, not MVP scope.*

He hits `3` to attach, pushes the branch, opens the PR on his phone while making coffee, then returns and types `agent-env remove external-cli-fix`. Clean. No lingering state on his host machine.

Back to the menu. Instance 1 is done—he could repurpose it for the next story or tear it down. He decides to keep it, updates the purpose: `agent-env purpose bmad-orch-auth "Epic 2 - user sessions"`, attaches, and starts the next BMAD story.

By the time he finishes his coffee, he's triaged all three instances, submitted a PR, and started new work. Total context switches between projects: zero. Everything isolated, everything visible.

### Journey 2: Node - The External Repo Contribution

Node finds a bug in a CLI tool he uses daily. The repo is on GitHub, maintained by someone else. In the old days, he'd clone it locally, pollute his host with their dependencies, maybe break something, definitely forget to clean up.

Now he runs:

```bash
agent-env create cli-bugfix --repo https://github.com/someuser/awesome-cli --attach
```

A couple minutes later—first-time setup pulls the base image and configures the environment—he's inside a fully configured instance. Claude Code is authenticated. Git signing works (SSH agent forwarded from host). The repo is cloned. He didn't configure anything—the baseline handled it.

*Note: The baseline is optimized for TypeScript/Node repos. For repos needing different runtimes (Python 3.11, Go, Rust), the baseline may not have everything. MVP targets 95%+ success rate for common repos; edge cases may need future multi-stack baselines or repo-specific config overrides.*

He spends an hour with Claude Code tracking down the bug, writes a fix, runs their test suite (inside the container, not touching his host), and commits. The agent-env status shows `↑ unpushed`. He pushes, opens a PR, and tears down the instance:

```bash
agent-env remove cli-bugfix
```

Gone. No leftover node_modules on his machine. No stale git worktrees. No "wait, which version of Node did that repo need?" The contribution took an hour. Cleanup took one command.

*Subsequent creates are faster—base image is cached, only repo clone and minimal setup needed.*

### Journey 3: Node - Safety Check Saves the Day

It's late. Node's been working on a complex refactor across two instances. He's tired and wants to clean up before bed. He runs `agent-env remove bmad-orch-refactor`.

```
⚠️  Cannot remove 'bmad-orch-refactor':

  Unpushed commits on branches:
    - feature/refactor-core (3 commits ahead of origin)
    - experiment/alt-approach (1 commit, never pushed)

  Stashed changes:
    - stash@{0}: WIP on feature/refactor-core: half-done handler

  Unstaged changes:
    - src/core/handler.ts (modified)

  Use --force to override (DATA WILL BE LOST - no recovery)
```

He stares at the screen. He completely forgot about that experimental branch—one that was *never pushed anywhere*. The stash from earlier today. Three hours of work across multiple places he'd forgotten about.

He attaches, commits the WIP, pushes both branches, clears the stash, and *then* removes the instance. The safety check just saved him from losing work he'd forgotten about.

*Note: `--force` is truly destructive. There is no recovery path. The safety check exists precisely because humans forget, especially when tired.*

He sleeps well, confident that agent-env won't let him shoot himself in the foot.

### Journey Requirements Summary

| Capability | Revealed By |
|------------|-------------|
| **Instance listing with status** | Journey 1 - quick triage of multiple instances |
| **Status indicators** (✓ ● ↑) | Journey 1 - visual git state at a glance |
| **Last-attached timestamp** | Journey 1 - know when you last touched each instance |
| **Purpose tracking** | Journey 1 - mutable labels for context |
| **Quick attach/detach** | Journey 1, 2 - fluid movement between instances |
| **Zero-config external repos** | Journey 2 - baseline handles common repos |
| **Create with --repo and --attach** | Journey 2 - single command to productive state |
| **SSH agent forwarding** | Journey 2 - git signing works without config |
| **Clean teardown** | Journey 2 - no host pollution |
| **Comprehensive safety checks** | Journey 3 - all branches (including never-pushed), stash, staged, unstaged |
| **Clear blocker messaging** | Journey 3 - knows exactly what's at risk |
| **Force override with warning** | Journey 3 - escape hatch, but makes consequences clear |

### Scope Boundaries (From Journeys)

| Capability | Status |
|------------|--------|
| **Git state visibility** | MVP - agent-env tracks this |
| **Agent execution status** | Future - orchestrator concern, not agent-env |
| **Multi-stack baselines** | Post-MVP - start with TypeScript, expand later |
| **Repo-specific config overrides** | Post-MVP - baseline-only for MVP |

## CLI + Developer Tool Requirements

### Project-Type Overview

agent-env is a CLI tool with developer tool characteristics:
- **CLI aspect:** Command-line interface for managing isolated dev environments
- **Developer tool aspect:** Designed for modification and extension by owner

### Command Interface

**Command Pattern:** `agent-env <verb> [options] <name>`

| Mode | Behavior |
|------|----------|
| **Interactive** | No args → numbered menu for instance selection |
| **Scriptable** | Direct commands with `--json` output for automation |

**Core Commands (MVP):**
- `create <name> [--repo] [--attach]` - Create and optionally attach
- `list` / `ps` - Show all instances with status
- `attach <name>` - Terminal attach via tmux
- `remove [--force] <name>` - Delete with safety checks
- `purpose <name> [value]` - Get/set mutable purpose

### Output Formats

| Context | Format |
|---------|--------|
| **Human** | Colored terminal output with status indicators (✓ ● ↑) |
| **Scripting** | `--json` flag for structured output |
| **Orchestrator** | JSON contract via `list --json` (details in Architecture) |

### Configuration Model

| Phase | Approach |
|-------|----------|
| **MVP** | Baseline config only - ships with agent-env, versioned with releases |
| **Post-MVP** | Baseline + `.agent-env/config.json` repo overrides |

Baseline config location: `<agent-env-install>/config/baseline/`

### Installation & Distribution

```bash
# Global installation (primary method)
npm install -g @zookanalytics/agent-env

# Or via pnpm
pnpm add -g @zookanalytics/agent-env
```

**Runtime Requirements:**
- Node.js (LTS)
- Docker (for container operations)
- macOS or Linux

### Shell Integration

- Shell completion support (bash/zsh)
- Install via: `agent-env completion >> ~/.bashrc`

### Technical Details Deferred to Architecture

- Full CLI contract and JSON schemas
- Baseline devcontainer.json structure
- Container lifecycle implementation
- State file formats (`.agent-env/state.json`)

## Functional Requirements

### Instance Lifecycle

- FR1: User can create a new instance with a specified name
- FR2: User can create an instance from a git repository URL
- FR3: User can create an instance from the current directory's git remote
- FR4: User can create an instance and immediately attach in one command
- FR5: User can remove an instance that passes safety checks
- FR6: User can force-remove an instance, bypassing safety checks with explicit warning

### Instance Discovery & Status

- FR7: User can list all instances with their current status
- FR8: User can see git state indicators for each instance (clean, uncommitted, unpushed)
- FR9: User can see the last-attached timestamp for each instance
- FR10: User can see the purpose/label for each instance
- FR11: System can detect instances with never-pushed branches

### Instance Access

- FR12: User can attach to an instance's tmux session
- FR13: User can attach to any instance from the interactive menu
- FR14: System maintains persistent tmux session per instance across attach/detach cycles

### State & Metadata

- FR15: User can get the current purpose of an instance
- FR16: User can set/update the purpose of an instance
- FR17: System tracks instance creation timestamp
- FR18: System tracks last-attached timestamp per instance

### Safety & Data Protection

- FR19: System can detect staged changes in an instance
- FR20: System can detect unstaged changes in an instance
- FR21: System can detect untracked files in an instance
- FR22: System can detect stashed changes in an instance
- FR23: System can detect unpushed commits on ALL branches (not just current)
- FR24: System can detect branches that have never been pushed to any remote
- FR25: System displays clear messaging about what blocks a remove operation
- FR26: System warns that force-remove results in permanent data loss

### Configuration & Environment

- FR27: System provides a baseline devcontainer configuration
- FR28: Baseline includes Claude Code CLI authenticated and ready
- FR29: Baseline includes git signing configured
- FR30: Baseline includes SSH agent forwarded from host
- FR31: Baseline includes tmux running with persistent session
- FR32: Baseline includes shell properly configured
- FR33: System clones the specified repository into the instance

### CLI Interface

- FR34: User can launch interactive menu by running agent-env with no arguments
- FR35: User can run scriptable commands directly with arguments
- FR36: User can get JSON output from list command for scripting/orchestration
- FR37: User can install shell completion for bash/zsh
- FR38: System provides human-readable colored output by default

### Installation & Platform

- FR39: User can install agent-env globally via npm/pnpm
- FR40: System runs on macOS (Intel and Apple Silicon)
- FR41: System runs on Linux
- FR42: System requires Docker for container operations

## Non-Functional Requirements

### Performance

- NFR1: Attach to existing instance completes within 2 seconds
- NFR2: List command returns within 500ms for up to 20 instances
- NFR3: Create with cached base image completes within 30 seconds
- NFR4: First command after attach executes within 5 seconds (time-to-productive)
- NFR5: Safety check analysis completes within 3 seconds

### Reliability

- NFR6: Safety checks have zero false negatives (never miss unsafe state)
- NFR7: False positive rate for safety checks is acceptable (may block when technically safe)
- NFR8: tmux sessions persist across attach/detach cycles without data loss
- NFR9: Instance state survives host machine restart (Docker volumes persist)
- NFR10: Partial failures (one instance unreachable) do not block operations on other instances

### Integration & Compatibility

- NFR11: Works with Docker Engine 20.10+
- NFR12: Compatible with devcontainer.json specification
- NFR13: JSON output parseable by standard tools (jq, orchestrator)
- NFR14: Git operations work with any remote (GitHub, GitLab, Bitbucket, etc.)
- NFR15: SSH agent forwarding works with standard SSH configurations
- NFR16: Works in tmux, screen, and bare terminal environments

### Maintainability

- NFR17: Codebase understandable without extensive documentation
- NFR18: Clear separation between CLI, container lifecycle, and git operations
- NFR19: Test coverage sufficient for confidence in changes
- NFR20: No external runtime dependencies beyond Node.js and Docker
- NFR21: Configuration schema is self-documenting

