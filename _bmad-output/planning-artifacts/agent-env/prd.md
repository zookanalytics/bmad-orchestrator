---
stepsCompleted: [1, 2, 3, 4, 7, 9, 10, 11]
inputDocuments:
  - '_bmad-output/planning-artifacts/agent-env/product-brief.md'
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
lastEdited: '2026-02-14'
editHistory:
  - date: '2026-02-14'
    changes: 'Added 6 features: forced baseline config, multi-instance per repo, repo management (Growth), current directory creation, in-instance purpose tracking, purpose visibility in tmux/VS Code'
  - date: '2026-02-14'
    changes: 'Post-validation fixes: tightened 5 subjective NFRs, fixed 2 vague FRs, removed NFR9 implementation leakage, resolved 3 orphan FRs, reclassified status indicators to MVP, added core abstraction and target user profile sections'
  - date: '2026-02-14'
    changes: 'Architecture review fixes: (1) Changed forced baseline to opt-in — baseline auto-applies when repo has no .devcontainer/, user opts in to override repos with their own config. (2) Removed "Environments, not containers" abstraction paragraph — tool manages containers via devcontainer spec, future backends remain in Vision only.'
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

**Baseline config with opt-in override.** Repos without a `.devcontainer/` get agent-env's productive baseline automatically—Claude Code, git signing, SSH, tmux, all ready. Repos with their own `.devcontainer/` use their config by default; users can opt in to the agent-env baseline instead when they prefer consistent AI tooling over repo-specific setup.

**Multi-instance per repo.** Same repo, multiple isolated workstreams. Instance names are user-chosen, decoupled from repo names. Run a refactor, a bugfix, and an experiment against the same codebase without conflict.

**Purpose as context.** Instance purpose surfaces inside the running environment—tmux status bar and VS Code window title show what you're working on without leaving your editor.

### Non-Negotiables

**Speed is survival.** If isolation adds friction, it won't get used. Time-to-productive must be under 5 seconds from attach.

**Zero data loss. Ever.** Safety checks cover staged, unstaged, untracked, stashed, and unpushed commits on ALL branches. One incident kills trust.

**External repos are first-class.** 95%+ should work with baseline alone. If zero-config requires constant config, it's not zero-config.

### Target User Profile

**Primary:** Expert-level developer running multiple AI agent workstreams simultaneously. Comfortable with containers, terminal-first workflow, runs agents in YOLO mode where isolation is the safety net. Mental model: one instance per logical workstream, not per task. Instances are long-lived and repurposed, not ephemeral.

**Secondary:** Any developer wanting AI agent isolation. Beginners benefit more from isolation—they're more likely to cause accidental damage. Expert features available; safe defaults for everyone.

**Interface honesty:** Terminal-first tool. VS Code integration is seamless, but CLI and tmux are the primary design targets.

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
- External repo success rate: 95%+ repos build and are productive with agent-env baseline
- Config issues after initial setup: 0 per week
- Purpose visible in tmux status bar within 1 second of attach
- Purpose changes reflected live in tmux within 30 seconds

## Product Scope

### MVP - Minimum Viable Product

What must work for this to be useful:

- `create <name> --repo <url|.> [--attach] [--purpose <text>]` - Clone repo, spin up container, optionally attach immediately
- `list` / `ps` - Show all instances with status and purpose
- `attach <name>` - Terminal attach via tmux
- `remove [--force] <name>` - Delete with comprehensive safety checks
- `purpose <name> [value]` - Get/set mutable purpose
- Interactive menu (no args) - Simple numbered prompts for MVP
- Productive baseline - Claude Code, git signing, SSH agent, tmux, shell configured
- Baseline config - agent-env applies its baseline for repos without `.devcontainer/`; users can opt in to the baseline for repos that have their own config
- Purpose visibility - purpose exposed as env var inside container and displayed in tmux status bar
- Multi-instance per repo - instance names are user-chosen, multiple instances can target the same repo
- Current-directory creation - `--repo .` detects git remote from the working directory
- Comprehensive safety checks - staged, unstaged, untracked, stashed, unpushed on ALL branches
- Status indicators in `list` - ✓ clean, ● uncommitted, ↑ unpushed

### Growth Features (Post-MVP)

What makes it pleasant to live in:

- `run <name> <command>` - Execute command in instance (orchestrator contract)
- `show <name>` - Detailed instance info
- `dashboard` - tmux overview of all instances
- Full Ink TUI for interactive menu (replacing numbered prompts)
- Config layering - `.agent-env/` repo-level overrides extend the baseline with repo-specific packages, env vars, or scripts
- `rebuild` command for updating instances without recreating
- Repo registry - `agent-env repos` command lists tracked repos, fast path for spinning up new instances from known repos
- Purpose visible in VS Code window title when attached via VS Code

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

Node starts his day with three agent-env instances—two from the bmad-orchestrator repo (different epics) and one for a quick fix to an external dependency. He opens his terminal and types `agent-env`.

The interactive menu shows:

```
agent-env instances:

  1. bmad-orch-auth    ✓ clean     "JWT authentication"      2h ago
  2. bmad-orch-api     ● uncommit  "API layer refactor"      12m ago
  3. external-cli-fix  ↑ unpushed  "CLI help text fix"       18h ago

[1-3] attach  [c] create  [q] quit
```

At a glance: instances 1 and 2 are both bmad-orchestrator—different names, different workstreams, fully isolated. Instance 1 is git-clean (ready for new work or teardown). Instance 2 has uncommitted changes (agent paused or still working—he'll check). Instance 3 has unpushed commits—that PR he meant to submit yesterday.

*Note: The timestamp shows last-attached time. Whether the agent succeeded, failed, or is stuck isn't visible here—agent-env tracks git state, not agent state. Agent status visibility is a future orchestrator concern, not MVP scope.*

He hits `3` to attach, pushes the branch, opens the PR on his phone while making coffee, then returns and types `agent-env remove external-cli-fix`. Clean. No lingering state on his host machine.

Back to the menu. He hits `1` to attach to bmad-orch-auth. The tmux status bar reads `bmad-orch-auth | JWT authentication`—immediate confirmation he's in the right workstream. The auth epic is done, so he updates the purpose: `agent-env purpose bmad-orch-auth "Epic 2 - user sessions"`, and starts the next BMAD story.

By the time he finishes his coffee, he's triaged all three instances, submitted a PR, and started new work. Total context switches between projects: zero. Everything isolated, everything visible.

### Journey 2: Node - The External Repo Contribution

Node finds a bug in a CLI tool he uses daily. The repo is on GitHub, maintained by someone else. In the old days, he'd clone it locally, pollute his host with their dependencies, maybe break something, definitely forget to clean up.

Now he runs:

```bash
agent-env create cli-bugfix --repo https://github.com/someuser/awesome-cli --attach
```

A couple minutes later—first-time setup pulls the base image and configures the environment—he's inside a fully configured instance. The repo didn't have a `.devcontainer/` directory, so agent-env applied the baseline config automatically. Claude Code is authenticated. Git signing works (SSH agent forwarded from host). The repo is cloned. He didn't configure anything—the baseline handled it.

*Note: The baseline is optimized for TypeScript/Node repos. For repos needing different runtimes (Python 3.11, Go, Rust), the baseline may not have everything. MVP targets 95%+ success rate for common repos; edge cases may need future multi-stack baselines. Repos needing repo-specific tooling on top of the baseline can use `.agent-env/` additive overrides (Growth).*

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

### Journey 4: Node - Quick Instance from Current Project

Node is inside a project directory on his host, deep in a refactor that's getting risky. He wants an isolated sandbox to try an experimental approach without polluting his working tree.

He runs:

```bash
agent-env create risky-refactor --repo . --attach --purpose "Experimental API redesign"
```

agent-env detects the git remote from the current directory, creates the instance with the baseline config, clones the repo, and attaches. The tmux status bar immediately reads `risky-refactor | Experimental API redesign`. He's productive in seconds, with full isolation from his host checkout.

Later, when he needs another instance of the same repo for a different experiment, he doesn't need to re-enter the URL—the repo is already tracked.

### Journey 5: Node - Purpose as Context While Working

Node is juggling three instances of the same repo—different epics. He attaches to one, and the tmux status bar reads `bmad-orch-auth | JWT authentication`. He switches to another—`bmad-orch-api | API layer refactor`. No confusion about which workstream he's in, even though all three are the same codebase.

He updates the purpose mid-session via `agent-env purpose bmad-orch-api "API v2 migration"` and the tmux bar updates live within seconds. The `$AGENT_ENV_PURPOSE` environment variable inside the container reflects the change too—scripts and agents can read it.

When he opens an instance in VS Code, the window title includes the purpose. Three VS Code windows, three different labels. No guessing which window is which.

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
| **Baseline config (opt-in override)** | Journey 2 - baseline applied when no repo config exists; opt-in for repos with their own |
| **Multi-instance per repo** | Journey 1 - two instances for same repo |
| **Create from current directory** | Journey 4 - `--repo .` quick path |
| **Repo registry** | Journey 4 - known repos for fast re-creation (Growth) |
| **Purpose visible in tmux** | Journey 1, 5 - status bar shows purpose |
| **Purpose visible in VS Code** | Journey 5 - window title includes purpose (Growth) |
| **Purpose as env var** | Journey 5 - `$AGENT_ENV_PURPOSE` available |
| **Purpose set at creation** | Journey 4 - `--purpose` flag on create |
| **Live purpose updates** | Journey 5 - tmux bar updates within seconds |
| **Instance naming** | Journey 1, 4 - user-chosen names for all instances (implicit in all create flows) |
| **Creation timestamp tracking** | Journey 1 - implicit in last-attached display and instance lifecycle |
| **Instance name as env var** | Journey 5 - `$AGENT_ENV_INSTANCE` counterpart to `$AGENT_ENV_PURPOSE` |

### Scope Boundaries (From Journeys)

| Capability | Status |
|------------|--------|
| **Git state visibility** | MVP - agent-env tracks this |
| **Agent execution status** | Future - orchestrator concern, not agent-env |
| **Multi-stack baselines** | Post-MVP - start with TypeScript, expand later |
| **Additive repo overrides via `.agent-env/`** | Post-MVP - `.agent-env/` overrides extend the baseline with repo-specific needs |
| **Repo registry** | Growth - track repos for fast instance creation |
| **In-instance purpose visibility** | MVP - env var + tmux status bar |
| **VS Code purpose visibility** | Growth - window title integration |

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
- `create <name> --repo <url|.> [--attach] [--purpose <text>]` - Create and optionally attach. `--repo` accepts a git URL or `.` to detect the current directory's git remote.
- `list` / `ps` - Show all instances with status
- `attach <name>` - Terminal attach via tmux
- `remove [--force] <name>` - Delete with safety checks
- `purpose <name> [value]` - Get/set mutable purpose

**Growth Commands:**
- `repos` - List tracked repositories (Growth)

### Output Formats

| Context | Format |
|---------|--------|
| **Human** | Colored terminal output with status indicators (✓ ● ↑) |
| **Scripting** | `--json` flag for structured output |
| **Orchestrator** | JSON contract via `list --json` (details in Architecture) |

### Configuration Model

| Phase | Approach |
|-------|----------|
| **MVP** | Baseline config applied automatically for repos without `.devcontainer/`; repos with their own config use it by default. User can opt in to agent-env's baseline to override repo config when preferred. |
| **Post-MVP** | Baseline + `.agent-env/` additive overrides - repos can layer additional packages, env vars, or scripts on top of the baseline |

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
- FR3: User can create an instance from the current directory's git remote by specifying `--repo .`
- FR4: User can create an instance and immediately attach in one command
- FR5: User can remove an instance that passes safety checks
- FR6: User can force-remove an instance, bypassing safety checks with explicit warning
- FR43: User can create multiple instances from the same repository, each with a distinct user-chosen name

### Instance Discovery & Status

- FR7: User can list all instances with their current status
- FR8: User can see git state indicators for each instance (clean, uncommitted, unpushed)
- FR9: User can see the last-attached timestamp for each instance
- FR10: User can see the purpose/label for each instance
- FR11: System can detect instances with never-pushed branches
- FR45: User can see the source repository for each instance in list output

### Instance Access

- FR12: User can attach to an instance's tmux session
- FR13: User can attach to any instance from the interactive menu
- FR14: System maintains persistent tmux session per instance across attach/detach cycles

### State & Metadata

- FR15: User can get the current purpose of an instance
- FR16: User can set/update the purpose of an instance
- FR17: System tracks instance creation timestamp
- FR18: System tracks last-attached timestamp per instance
- FR46: User can set instance purpose at creation time via `--purpose` flag
- FR47: System exposes instance name as `$AGENT_ENV_INSTANCE` environment variable inside the container
- FR48: System exposes instance purpose as `$AGENT_ENV_PURPOSE` environment variable inside the container
- FR49: System displays instance name and purpose in the tmux status bar inside the container
- FR50: System updates tmux status bar purpose live when purpose changes externally (within 30 seconds)

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

- FR27: System applies agent-env baseline devcontainer configuration to new instances when the cloned repository has no `.devcontainer/` directory; user can opt in to use the baseline for repos that have their own config
- FR28: Baseline includes Claude Code CLI authenticated and ready
- FR29: Baseline includes git signing configured
- FR30: Baseline includes SSH agent forwarded from host
- FR31: Baseline includes tmux running with persistent session
- FR32: Baseline includes shell properly configured
- FR33: System clones the specified repository into the instance

### CLI Interface

- FR34: User can launch interactive menu by running agent-env with no arguments
- FR35: User can run all core commands (create, list, attach, remove, purpose) non-interactively with explicit arguments
- FR36: User can get JSON output from list command for scripting/orchestration
- FR37: User can install shell completion for bash/zsh
- FR38: System provides structured terminal output with ANSI color codes for status indicators and section headers

### Installation & Platform

- FR39: User can install agent-env globally via npm/pnpm
- FR40: System runs on macOS (Intel and Apple Silicon)
- FR41: System runs on Linux
- FR42: System requires Docker for container operations

### Repo Management (Growth)

- FR51: System tracks repositories used for instance creation in a local registry
- FR52: User can list tracked repositories
- FR53: User can create a new instance from a registered repository without re-entering the URL

### Purpose Visibility (Growth)

- FR54: System displays instance purpose in VS Code window title when attached via VS Code

## Non-Functional Requirements

### Performance

- NFR1: Attach to existing instance completes within 2 seconds
- NFR2: List command returns within 500ms for up to 20 instances
- NFR3: Create with cached base image completes within 30 seconds
- NFR4: First command after attach executes within 5 seconds (time-to-productive)
- NFR5: Safety check analysis completes within 3 seconds
- NFR22: Purpose displayed in tmux status bar within 1 second of attach
- NFR23: Live purpose updates reflected in tmux status bar within 30 seconds of change

### Reliability

- NFR6: Safety checks detect 100% of unsafe scenarios defined in the test suite
- NFR7: Safety checks false positive rate below 5% across test scenarios
- NFR8: tmux sessions persist across attach/detach cycles without data loss
- NFR9: Instance state survives host machine restart
- NFR10: Partial failures (one instance unreachable) do not block operations on other instances

### Integration & Compatibility

- NFR11: Works with Docker Engine 20.10+
- NFR12: Agent-env baseline devcontainer configuration conforms to the devcontainer.json specification
- NFR13: JSON output parseable by standard tools (jq, orchestrator)
- NFR14: Git operations work with any remote (GitHub, GitLab, Bitbucket, etc.)
- NFR15: SSH agent forwarding works with standard SSH configurations
- NFR16: Works in tmux, screen, and bare terminal environments
- NFR24: tmux status bar integration does not interfere with user's tmux configuration outside agent-env instances

### Maintainability

- NFR17: Codebase organized into modules with clear boundaries: CLI layer, container lifecycle, safety checks, configuration, git operations
- NFR18: Clear separation between CLI, container lifecycle, and git operations
- NFR19: Core modules (lifecycle, safety, configuration) have 80% or higher branch coverage
- NFR20: No external runtime dependencies beyond Node.js and Docker
- NFR21: Configuration includes JSON Schema with descriptions for all fields
