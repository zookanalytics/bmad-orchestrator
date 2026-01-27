---
stepsCompleted: [1, 2, 3, 4, 7, 8, 9, 10, 11]
status: complete
inputDocuments:
  - 'docs/plans/bmad-orchestration-implementation-brief.md'
  - '_bmad-output/planning-artifacts/research/claude-agent-sdk-eval.md'
  - '_bmad-output/planning-artifacts/research/auto-claude-patterns.md'
  - '_bmad-output/planning-artifacts/research/prototype-decision.md'
  - 'docs/plans/bmad-completion-detection-research.md'
  - 'docs/project-context.md'
  - 'docs/architecture.md'
  - '_bmad-output/planning-artifacts/research/technical-state-management-devcontainers-research-2026-01-03.md'
documentCounts:
  briefs: 1
  research: 5
  decisions: 1
  projectDocs: 2
workflowType: 'prd'
lastStep: 4
---

# Product Requirements Document - BMAD Orchestration Layer

**Author:** Node
**Date:** 2026-01-03

## Executive Summary

BMAD Orchestrator is a unified command center for multi-DevPod development. See every workflow, every story, every heartbeat - and know exactly what to do next.

The core problem: BMAD methodology is effective, but scaling it across multiple parallel workstreams creates cognitive overhead. Developers must manually track which stories are assigned where, detect stuck workflows, and determine optimal next actions. This coordination tax grows with each additional DevPod.

The solution: A host-based dashboard that reads BMAD state files (sprint-status.yaml, .worker-state.yaml) from all DevPod workspaces, aggregates progress, and surfaces actionable next steps with ready-to-run commands.

### What Makes This Special

**Confidence through clarity.** The dashboard doesn't just show status - it eliminates decision paralysis by making the next action obvious. Users stop asking "where are we?" and start executing.

**Git-native state architecture.** No new databases or sync infrastructure. Each DevPod writes its own state files; the orchestrator is read-only. State flows through git like all other BMAD artifacts.

**Progressive automation.** Start with visibility and manual commands (Phase 1), evolve to one-click dispatch (Phase 2), then autonomous execution with approval gates (Phase 3). Value delivered immediately, automation added incrementally.

**Lean orchestration core.** The orchestration logic leverages Claude Agent SDK to replace ~4200 LOC of fragile PTY coordination with ~635 LOC of structured invocation. Note: dashboard UI is additional scope beyond core orchestration.

## Project Classification

**Technical Type:** CLI tool + Developer tool hybrid
**Domain:** General (developer tooling)
**Complexity:** Medium - multi-instance coordination with known patterns
**Project Context:** Greenfield - new bmad-orchestrator system
**Deployment Model:** Host-based (reads DevPod filesystems via mounted workspaces)

### Phase 1 Scope (MVP)

- Dashboard aggregating state from all DevPods
- Copy-paste commands for manual dispatch
- Heartbeat monitoring and stale detection
- No Claude Agent SDK integration yet

The orchestrator integrates with:
- Existing BMAD workflows and state files
- DevPod for container lifecycle management
- Existing claude-instance tooling (tmux integration)

## Success Criteria

### User Success

**Core Success Metric:** "I know what to work on next."

- Open dashboard → immediately see next action → execute with confidence
- Works whether you have 1 DevPod or 5
- Portable across any BMAD project, not just one codebase
- **"Aha!" moment:** Clone a new repo, run the dashboard, and without reading docs know exactly where the project is and what to do next

### Business Success

| Horizon | Success Indicator |
|---------|-------------------|
| **1 month** | Still using it, happily evolving it (dogfooding success) |
| **3 months** | Almost exclusively using this as the interface into BMAD |
| **Longer term** | Quality bar = "good enough to publish without embarrassment" |

### Technical Success

| Dimension | Criteria |
|-----------|----------|
| **Code Quality** | Clear, understandable architecture over minimal LOC. "I can read it and know what does what." |
| **Platform** | Mac + Linux support. TUI preferred, Web UI acceptable if superior. |
| **Hackability** | Owner can modify easily. No plugin system needed, but good structure that enables future extensibility. |
| **Communication** | Reliable and simple. Not complicated and brittle - that defeats the entire purpose. |

### Measurable Outcomes

- Dashboard renders full state within 2 seconds of launch
- Stale worker detection fires reliably (no false negatives)
- Commands provided are copy-paste ready (no manual editing required)
- New project onboarding: working dashboard in <5 minutes

## Product Scope

### MVP - Minimum Viable Product

What must work for this to be useful:

- Dashboard shows all DevPods + story status at a glance
- Surfaces next action clearly per worker
- Provides copy-paste commands for manual dispatch
- Heartbeat monitoring with stale detection
- Runs on Mac and Linux
- Host-based, reads DevPod filesystems

### Growth Features (Post-MVP)

What makes it pleasant to live in:

- One-click dispatch (still user-initiated, but no copy-paste)
- Enhanced visualization (Kanban view of stories across workers)
- Project-agnostic operation (works on any BMAD project without configuration)
- Improved status refresh (real-time or near-real-time updates)

### Vision (Future)

The dream version:

- Autonomous dispatch with human approval gates
- Claude Agent SDK integration for structured skill invocation
- Publishable quality for broader BMAD community
- Potential integration as official BMAD tooling

## User Journeys

### Journey 1: Node - The Morning Orchestration

Node starts his day with three DevPods running from yesterday - one finishing a story, one mid-implementation, one that was supposed to run overnight. He opens VS Code and sees three workspaces in his dock. *Which one needs attention first?*

He could cycle through each, run `/workflow-status`, piece together the picture. But today he opens BMAD Orchestrator instead.

One glance (pane-based layout provides room for inline questions):

```
┌─ BMAD Orchestrator ──────────────────────────────────────────── ↻ 5s ago ─┐
│                                                                            │
│  ┌─ devpod-1 ──────────────────────┐  ┌─ devpod-2 ──────────────────────┐ │
│  │  ✓ DONE                  2h ago │  │  ● RUNNING              12m ago │ │
│  │  → 1-3-auth-flow                │  │  → 2-1-api-layer                │ │
│  │    Complete                     │  │    ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 60%      │ │
│  │                                 │  │                                 │ │
│  │  Suggested: 1-4-tests           │  │                                 │ │
│  └─────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                            │
│  ╔═ devpod-3 ══════════════════════╗                                      │
│  ║  ⏸ NEEDS INPUT           6h ago ║                                      │
│  ║  → 2-2-persistence              ║                                      │
│  ║                                 ║                                      │
│  ║  ╭─ Claude is asking ─────────╮ ║                                      │
│  ║  │ Should I mock the DB or    │ ║                                      │
│  ║  │ use a test container?      │ ║                                      │
│  ║  ╰────────────────────────────╯ ║                                      │
│  ╚═════════════════════════════════╝                                      │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  Backlog: 1-4-tests, 2-3-validation, 2-4-integration                       │
├────────────────────────────────────────────────────────────────────────────┤
│  j/k: select   Enter: open   b: backlog   c: copy   q: quit               │
└────────────────────────────────────────────────────────────────────────────┘
```

*Note: Needs-input pane (devpod-3) uses double-line border to draw attention. Pane layout provides space for inline question display without drilling down.*

DevPod-3 needs input - Claude asked a question overnight that went unanswered (visible right in the pane). DevPod-1 finished and is idle. DevPod-2 is humming along. Without opening a single VS Code window, Node knows: answer DevPod-3's question, then assign new work to DevPod-1.

The dashboard shows the command for the idle DevPod:

```
devpod ssh devpod-1 -- claude -p "/bmad:bmm:workflows:dev-story 1-4-tests" --output-format json
```

Copy. Paste. Execute. Back to the dashboard. On to the next decision.

By the time he finishes his coffee, Node has answered DevPod-3's question, confirmed it resumed successfully, and dispatched two new stories. Total time: 8 minutes. Total context switches: zero.

### Journey 2: The Needs-Input Resolution

*Note: This journey shows the full vision including Phase 2 features (answer input field, Interactive Mode button). MVP uses copy-paste commands; inline response is Phase 2.*

Node sees DevPod-3 showing `⏸ needs-input` with last activity 6 hours ago. Claude asked a question that went unanswered overnight. The question is already visible in the pane (see Journey 1 mockup), but for complex questions with multiple options, he drills into the detail view for full context:

```
┌─────────────────────────────────────────────────────────────┐
│  DevPod-3: devpod-3-persistence                              │
├─────────────────────────────────────────────────────────────┤
│  Story: 2-2-persistence                                      │
│  Status: needs-input (waiting 6h)                            │
│  Session: ab2c3d4-e5f6-7890-abcd-ef1234567890                │
│                                                              │
│  Claude is asking:                                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ "Test repository_save_test is failing with error:       │ │
│  │  'Connection refused on port 5432'.                     │ │
│  │                                                         │ │
│  │  Should I:                                              │ │
│  │  (1) Fix by mocking the database connection             │ │
│  │  (2) Update test to use test container                  │ │
│  │  (3) Skip test and document as known issue"             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Progress before pause:                                      │
│  └── tasks completed: 3/7                                    │
│  └── last task: "Implementing repository pattern"           │
├─────────────────────────────────────────────────────────────┤
│  Resume with answer:  [1_______________] [Send]              │
│                                                              │
│  Or: [Interactive Mode] - attach to tmux for conversation   │
└─────────────────────────────────────────────────────────────┘
```

**MVP:** Node copies the resume command, pastes into a terminal, and provides the answer. **Phase 2:** Node types "1" directly in the dashboard and clicks Send. The dashboard generates:

```
devpod ssh devpod-3 -- claude -p "1" --resume "ab2c3d4-e5f6-7890-abcd-ef1234567890" --output-format json
```

The command executes. Claude resumes with the answer, mocks the database connection, and continues implementing. The dashboard refreshes: DevPod-3 now shows `● running`.

**For complex situations**, Node could click [Interactive Mode] to attach via tmux and have a back-and-forth conversation. But for clear transactional decisions like this? One answer, structured response, back to orchestrating.

### Architectural Decision: Hybrid Execution Model

| Mode | When Used | Characteristics |
|------|-----------|-----------------|
| **JSON (default)** | Standard BMAD workflows | `--output-format json`, structured results, orchestrator-friendly |
| **Interactive (escape hatch)** | Complex debugging, extended conversation | tmux attach, full back-and-forth, manual control |

Most BMAD steps are transactional: dispatch a skill, get a result. JSON mode makes these reliable and parseable. Interactive mode remains available for situations requiring human judgment beyond a simple answer.

### Journey Requirements Summary

| Capability | Revealed By |
|------------|-------------|
| **Unified status view** | Journey 1 - see all DevPods at a glance |
| **Idle worker detection** | Journey 1 - know which DevPod can take work |
| **Needs-input detection** | Journey 1 & 2 - surface questions immediately |
| **Question display** | Journey 2 - show exactly what Claude is asking |
| **Session ID tracking** | Journey 2 - enable structured resume |
| **Resume with answer** | Journey 2 - single-field response for simple decisions |
| **Interactive escape hatch** | Journey 2 - drop to tmux when needed |
| **Copy-paste commands** | Journey 1 - zero-friction execution |
| **JSON mode dispatch** | Both - reliable, structured orchestration |
| **Progress visibility** | Journey 2 - tasks completed before pause |

## CLI + Developer Tool Requirements

### Project-Type Overview

BMAD Orchestrator is a hybrid CLI/developer tool:
- **TUI component:** Persistent dashboard for visual orchestration
- **CLI component:** Individual commands for scripting and automation
- **Developer tool aspect:** Designed for modification and extension by owner

### Technical Architecture

**Runtime:** Node.js with TypeScript
- Consistency with existing claude-instance tooling
- Mature TUI libraries available (ink, blessed-contrib)
- Familiar ecosystem for owner modification

**Package Structure:**
- Node.js package
- Entry point: `bmad-orchestrator` (persistent TUI)
- Additional commands: `bmad-orchestrator status`, `bmad-orchestrator list`, etc.

### Command Structure

| Command | Description |
|---------|-------------|
| `bmad-orchestrator` | Launch persistent TUI (default) |
| `bmad-orchestrator status` | One-shot status dump (scriptable) |
| `bmad-orchestrator list` | List discovered DevPods |
| `bmad-orchestrator dispatch <devpod> <story>` | Generate/execute dispatch command |
| `bmad-orchestrator resume <devpod> <answer>` | Resume needs-input session |

### Configuration & Discovery

**Auto-Discovery (zero-config):**
- Query `devpod list` for active instances
- Filter by naming convention (e.g., `devpod-*`, `{project}-*`)
- Detect workspace paths from DevPod metadata

**Optional Config Override:**
```yaml
# ~/.bmad-orchestrator.yaml (optional)
devpods:
  include: ["devpod-*"]
  exclude: ["devpod-test-*"]
workspaces_root: "~/.devpod/workspaces"
```

### Output Formats

| Context | Format |
|---------|--------|
| **TUI** | Rich terminal UI with colors, borders, status indicators |
| **CLI commands** | Plain text default, `--json` flag for structured output |
| **Generated commands** | Copy-paste ready shell commands |

### Shell Completion

- Leverage `yargs` or `commander` built-in completion support
- Complete DevPod names, story IDs from discovered state
- Install via: `bmad-orchestrator completion >> ~/.bashrc`

### Installation Method

```bash
# From package root
pnpm install

# Or if published
pnpm add -g @zookanalytics/bmad-orchestrator
```

### Scripting Support

CLI commands designed for pipeline integration:
```bash
# Check if any DevPod needs input
bmad-orchestrator status --json | jq '.devpods[] | select(.status == "needs-input")'

# Auto-dispatch to idle workers
for pod in $(bmad-orchestrator list --idle); do
  bmad-orchestrator dispatch $pod --next-story
done
```

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP
- Solve the core cognitive load problem: "Which DevPod needs attention? What should I do next?"
- Deliver working visibility before adding automation
- Value delivered immediately, automation added incrementally

**Resource Requirements:** Solo developer with TypeScript/Node experience

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Journey 1: Morning Orchestration (full support)
- Journey 2: Needs-Input Resolution (full support)

**Must-Have Capabilities:**

| Capability | Rationale |
|------------|-----------|
| Unified status view | This IS the product - see all DevPods at a glance |
| Copy-paste commands | Enables immediate action from dashboard |
| Stale/needs-input detection | Surfaces problems before they become blockers |
| Auto-discovery | Existing capability in claude-instance, must preserve |
| Session ID tracking | Required for structured resume workflow |

**Explicitly Deferred:**
- One-click dispatch (Phase 2)
- Kanban visualization (Phase 2)
- Autonomous execution (Phase 3)
- Claude Agent SDK integration (Phase 3)

### Post-MVP Features

**Phase 2 (Growth):**
- One-click dispatch from dashboard (no copy-paste)
- Enhanced visualization (Kanban view of stories)
- Project-agnostic operation (works on any BMAD project)
- Real-time status refresh

**Phase 3 (Vision):**
- Autonomous dispatch with human approval gates
- Claude Agent SDK integration for structured invocation
- Publishable quality for broader community

### Risk Mitigation Strategy

**Technical Risks:**
- JSON parsing: Use Claude's `--output-format json` for predictable structure
- TUI complexity: Start with proven library (ink), keep UI minimal

**Adoption Risks:**
- Dashboard as "yet another tool": Position as THE interface, not an addition
- Measure success by reduction in VS Code window cycling

**Scope Risks:**
- Automation temptation: Strict Phase 1 boundary - copy-paste only
- Feature creep: Success criterion is "still using it at 1 month", not feature count

## Functional Requirements

### DevPod Discovery & Status

- FR1: User can view all active DevPods in a single unified display
- FR2: System can auto-discover DevPods via naming convention without manual configuration
- FR3: User can optionally override auto-discovery with explicit configuration
- FR4: User can see which project/workspace each DevPod is working on

### Story & Progress Visibility

- FR5: User can see current story assignment for each DevPod
- FR6: User can see story status (done, running, needs-input, stale)
- FR7: User can see time since last activity/heartbeat per DevPod
- FR8: User can see task progress within a story (e.g., "3/7 tasks completed")
- FR8a: User can see epic progress (overall completion percentage) for the epic containing the current story
- FR9: User can see the backlog of unassigned stories
- FR10: System can detect idle DevPods (completed story, no current assignment)

### Needs-Input Handling

- FR11: System can detect when Claude is waiting for user input
- FR12: User can see the specific question Claude is asking
- FR13: User can see the session ID for resume operations
- FR14: User can provide an answer to resume a paused session
- FR15: System can generate copy-paste resume command with answer

### Stale Detection & Alerts

- FR16: System can detect stale workers (no heartbeat within threshold)
- FR17: User can see visual indication of stale status
- FR18: User can see suggested diagnostic actions for stale DevPods

### Command Generation

- FR19: User can see copy-paste ready dispatch commands for idle DevPods
- FR20: User can see suggested next story to assign
- FR21: User can see copy-paste ready resume commands
- FR22: User can see command to attach to interactive tmux session
- FR23: All generated commands use JSON output mode by default

### Dashboard Interface

- FR24: User can launch a persistent TUI dashboard
- FR25: User can quit the dashboard gracefully
- FR26: User can refresh dashboard state manually
- FR27: User can drill into detail view for specific DevPod
- FR28: User can navigate back from detail view to main view

### CLI Commands (Scriptable)

- FR29: User can get one-shot status dump via CLI command
- FR30: User can list discovered DevPods via CLI command
- FR31: User can get output in JSON format for any CLI command
- FR32: User can use shell completion for DevPod names and commands

### Installation & Configuration

- FR33: User can install via pnpm
- FR34: User can run dashboard from any directory on host machine
- FR35: System can read BMAD state files from DevPod workspaces on host filesystem

## Non-Functional Requirements

### Performance

- NFR1: Dashboard initial render completes within 2 seconds of launch
- NFR2: Status refresh completes within 1 second
- NFR3: CLI commands return within 500ms for status queries
- NFR4: DevPod discovery completes within 3 seconds for up to 10 DevPods

### Reliability

- NFR5: Stale detection has zero false negatives (never misses a stale DevPod)
- NFR6: False positive rate for stale detection is acceptable (may flag active DevPod briefly after network hiccup)
- NFR7: Dashboard gracefully handles unreachable DevPods without crashing
- NFR8: Partial failures (one DevPod unreachable) do not block display of other DevPods

### Integration & Compatibility

- NFR9: Runs on macOS (Intel and Apple Silicon)
- NFR10: Runs on Linux (Ubuntu 22.04+, Debian-based)
- NFR11: Works with DevPod CLI for container discovery
- NFR12: Correctly parses BMAD state files (sprint-status.yaml, .worker-state.yaml)
- NFR13: Works with Claude CLI `--output-format json` responses
- NFR14: Compatible with existing claude-instance tmux session naming

### Maintainability

- NFR15: Codebase is understandable by owner without extensive documentation
- NFR16: Clear separation between TUI rendering, state aggregation, and command generation
- NFR17: No external runtime dependencies beyond Node.js packages
- NFR18: Configuration schema is self-documenting (YAML with comments)

