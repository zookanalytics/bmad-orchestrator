---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# BMAD Orchestrator - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for BMAD Orchestrator, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**DevPod Discovery & Status (FR1-4):**
- FR1: User can view all active DevPods in a single unified display
- FR2: System can auto-discover DevPods via naming convention without manual configuration
- FR3: User can optionally override auto-discovery with explicit configuration
- FR4: User can see which project/workspace each DevPod is working on

**Story & Progress Visibility (FR5-10):**
- FR5: User can see current story assignment for each DevPod
- FR6: User can see story status (done, running, needs-input, stale)
- FR7: User can see time since last activity/heartbeat per DevPod
- FR8: User can see task progress within a story (e.g., "3/7 tasks completed")
- FR8a: User can see epic progress (overall completion percentage) for the epic containing the current story
- FR9: User can see the backlog of unassigned stories
- FR10: System can detect idle DevPods (completed story, no current assignment)

**Needs-Input Handling (FR11-15) - DEFERRED TO PHASE 2:**
- FR11: System can detect when Claude is waiting for user input
- FR12: User can see the specific question Claude is asking
- FR13: User can see the session ID for resume operations
- FR14: User can provide an answer to resume a paused session
- FR15: System can generate copy-paste resume command with answer

**Inactive Detection & Alerts (FR16-18):**
- FR16: System can detect inactive workers (no activity within threshold via file mtime)
- FR17: User can see visual indication of inactive status
- FR18: User can see SSH command to investigate inactive DevPods

**Command Generation (FR19-23):**
- FR19: User can see copy-paste ready dispatch commands for idle DevPods
- FR20: User can see suggested next story to assign
- FR21: User can see copy-paste ready resume commands
- FR22: User can see command to attach to interactive tmux session
- FR23: All generated commands use JSON output mode by default

**Dashboard Interface (FR24-28):**
- FR24: User can launch a persistent TUI dashboard
- FR25: User can quit the dashboard gracefully
- FR26: User can refresh dashboard state manually
- FR27: User can drill into detail view for specific DevPod
- FR28: User can navigate back from detail view to main view

**CLI Commands - Scriptable (FR29-32):**
- FR29: User can get one-shot status dump via CLI command
- FR30: User can list discovered DevPods via CLI command
- FR31: User can get output in JSON format for any CLI command
- FR32: User can use shell completion for DevPod names and commands

**Installation & Configuration (FR33-35):**
- FR33: User can install via npm
- FR34: User can run dashboard from any directory on host machine
- FR35: System can read BMAD state files from DevPod workspaces on host filesystem

### NonFunctional Requirements

**Performance:**
- NFR1: Dashboard initial render completes within 2 seconds of launch
- NFR2: Status refresh completes within 1 second
- NFR3: CLI commands return within 500ms for status queries
- NFR4: DevPod discovery completes within 3 seconds for up to 10 DevPods

**Reliability:**
- NFR5: Inactive detection has zero false negatives (never misses an inactive DevPod)
- NFR6: False positive rate for inactive detection is acceptable (may flag active DevPod briefly)
- NFR7: Dashboard gracefully handles unreachable DevPods without crashing
- NFR8: Partial failures (one DevPod unreachable) do not block display of other DevPods

**Integration & Compatibility:**
- NFR9: Runs on macOS (Intel and Apple Silicon)
- NFR10: Runs on Linux (Ubuntu 22.04+, Debian-based)
- NFR11: Works with DevPod CLI for container discovery
- NFR12: Correctly parses BMAD state files (sprint-status.yaml, story files)
- NFR13: Works with Claude CLI `--output-format json` responses
- NFR14: Compatible with existing claude-instance tmux session naming

**Maintainability:**
- NFR15: Codebase is understandable by owner without extensive documentation
- NFR16: Clear separation between TUI rendering, state aggregation, and command generation
- NFR17: No external runtime dependencies beyond Node.js and npm packages
- NFR18: Configuration schema is self-documenting (YAML with comments)

### Additional Requirements

**From Architecture - Technical Constraints:**
- AR1: Manual project setup with full tooling (ESLint, Prettier, Vitest, CI) - no scaffolding tool
- AR2: Single TypeScript package structure (not a monorepo)
- AR3: Zero container footprint in Phase 1 (no modifications to BMAD workflows or DevPod containers)
- AR4: Read-only observer pattern - derives ALL state from existing BMAD artifacts
- AR5: Git-native state using existing sprint-status.yaml and story files only
- AR6: DevPod CLI dependency for container discovery (devpod list --output json)
- AR7: Promise.allSettled pattern for error isolation per DevPod
- AR8: execa 9.x with reject: false pattern for subprocess handling
- AR9: Dependency injection pattern enabling testability without global mocks
- AR10: Test fixtures required from day 1 (devPodList.json, sprintStatus.yaml, story files)
- AR11: Scoped npm package: @zookanalytics/bmad-orchestrator

**From Architecture - Data Sources:**
- AR12: Sprint status from `_bmad-output/implementation-artifacts/sprint-status.yaml`
- AR13: Story files from `_bmad-output/implementation-artifacts/stories/*.md`
- AR14: Epic files from `_bmad-output/implementation-artifacts/epics/*.md`
- AR15: Activity detection via file mtime with 1-hour default threshold

**From Architecture - Module Structure:**
- AR16: lib/ layer for pure business logic (no React imports)
- AR17: hooks/ layer for React state bridge
- AR18: components/ layer for Ink TUI components
- AR19: commands/ layer for CLI entry points

**From UX Design - Responsive Requirements:**
- UX1: Three responsive breakpoints: ≥120 cols (2-column grid), 80-119 cols (1-column stack), <80 cols (compact)
- UX2: Use Ink's useStdoutDimensions() for terminal size detection

**From UX Design - Accessibility Requirements:**
- UX3: Never rely on color alone - symbols + text + color triple redundancy
- UX4: Full keyboard-only operation (j/k/h/l/Enter/Esc/q)
- UX5: Respect NO_COLOR and TERM=dumb environment variables
- UX6: ASCII fallback symbols for terminals without Unicode support

**From UX Design - Interaction Patterns:**
- UX7: Clipboard-based handoff (dashboard never spawns terminals)
- UX8: Auto-refresh with visible timestamp indicator
- UX9: Backlog overlay triggered by 'b' key
- UX10: Empty state with BMAD-contextual guidance for new users
- UX11: No animations - instant state change for simplicity
- UX12: Selection persists across refreshes (by DevPod name, not index)
- UX13: Double-line border for needs-input panes to visually "scream" for attention

**From UX Design - Error Handling:**
- UX14: Every error state has a visible next action (no dead ends)
- UX15: Clipboard failure fallback: show command inline for manual copy
- UX16: Partial discovery results shown with "R to retry" hint

**From UX Design - Visual Standards:**
- UX17: STATE_CONFIG as single source of truth for status visuals
- UX18: Status symbols: ● (running), ✓ (done), ○ (idle), ⏸ (needs-input), ⚠ (stale), ✗ (error)
- UX19: Success feedback: 3 seconds duration, green ✓
- UX20: Error feedback: persistent until resolved, red ✗

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | View all active DevPods in unified display |
| FR2 | Epic 1 | Auto-discover DevPods via naming convention |
| FR3 | Epic 1 | Optional override with explicit configuration |
| FR4 | Epic 1 | See project/workspace per DevPod |
| FR5 | Epic 2 | See current story assignment |
| FR6 | Epic 2 | See story status (done, running, etc.) |
| FR7 | Epic 2 | See time since last activity |
| FR8 | Epic 2 | See task progress within story |
| FR8a | Epic 2 | See epic progress percentage |
| FR9 | Epic 2 | See backlog of unassigned stories |
| FR10 | Epic 2 | Detect idle DevPods |
| FR11-15 | **Deferred** | Needs-Input Handling (Phase 2) |
| FR16 | Epic 2 | Detect inactive workers via mtime |
| FR17 | Epic 2 | Visual indication of inactive status |
| FR18 | Epic 2 | SSH command to investigate |
| FR19 | Epic 4 | Copy-paste dispatch commands |
| FR20 | Epic 4 | Suggested next story |
| FR21 | Epic 4 | Copy-paste resume commands |
| FR22 | Epic 4 | Command to attach to tmux |
| FR23 | Epic 4 | JSON output mode by default |
| FR24 | Epic 3 | Launch persistent TUI dashboard |
| FR25 | Epic 3 | Quit dashboard gracefully |
| FR26 | Epic 3 | Manual refresh |
| FR27 | Epic 3 | Drill into detail view |
| FR28 | Epic 3 | Navigate back from detail |
| FR29 | Epic 5 | One-shot status dump CLI |
| FR30 | Epic 1 | List DevPods CLI (validates Epic 1 delivery) |
| FR31 | Epic 5 | JSON output for CLI |
| FR32 | Epic 5 | Shell completion |
| FR33 | Epic 1 | Install via npm |
| FR34 | Epic 1 | Run from any directory |
| FR35 | Epic 1 | Read BMAD state files |

## Epic List

### Epic 1: Project Foundation & DevPod Discovery
**User Outcome:** I can install the tool and it discovers my DevPods

This epic establishes the project with full quality gates (CI, testing, linting) and implements the core discovery mechanism. After this epic, users can run `bmad-orchestrator list` and see their DevPods.

**FRs covered:** FR1, FR2, FR3, FR4, FR30, FR33, FR34, FR35
**ARs covered:** AR1-AR11 (tooling, package structure, execa, testing)
**Deliverable:** Working `bmad-orchestrator list` command

---

### Epic 2: BMAD State Parsing & Activity Detection
**User Outcome:** I can see what each DevPod is working on and whether it's active

This epic adds meaning to discovered DevPods by parsing BMAD state files (sprint-status.yaml, story files) and detecting activity via file mtime. After this epic, the `list` command shows story assignments, task progress, epic progress, and inactive status.

**FRs covered:** FR5, FR6, FR7, FR8, FR8a, FR9, FR10, FR16, FR17, FR18
**ARs covered:** AR12-AR15 (data sources, mtime detection)
**Deliverable:** Enhanced `list` output with BMAD state

---

### Epic 3: Dashboard Experience
**User Outcome:** I have a visual dashboard showing all DevPods at a glance with keyboard navigation

This epic creates the persistent TUI using Ink, implementing the pane-based grid layout, keyboard navigation (j/k/h/l), selection highlighting, responsive breakpoints, and all UX patterns.

**FRs covered:** FR24, FR25, FR26, FR27, FR28
**UX covered:** UX1-UX13 (responsive, accessibility, navigation, visual standards)
**NFRs addressed:** NFR1, NFR2 (performance)
**Deliverable:** `bmad-orchestrator` launches persistent TUI dashboard

---

### Epic 4: Command Generation & Clipboard Actions
**User Outcome:** I can see and copy actionable commands for any DevPod

This epic adds command generation (dispatch, SSH, tmux attach) and clipboard integration. The dashboard shows contextual commands and users can copy them with a single keypress.

**FRs covered:** FR19, FR20, FR21, FR22, FR23
**UX covered:** UX7, UX14, UX15, UX16 (clipboard handoff, error recovery)
**Deliverable:** Command bar with copy-paste functionality

---

### Epic 5: CLI Polish & Package Publishing
**User Outcome:** I can script the tool and install it globally from npm

This epic adds the `status` CLI command with JSON output, shell completion, and publishes the package to npm as @zookanalytics/bmad-orchestrator.

**FRs covered:** FR29, FR31, FR32
**ARs covered:** AR11 (scoped npm package)
**NFR addressed:** NFR3 (CLI performance <500ms)
**Deliverable:** Published npm package with full CLI
