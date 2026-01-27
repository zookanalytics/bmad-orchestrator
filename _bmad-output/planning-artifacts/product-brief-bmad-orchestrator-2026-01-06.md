---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowComplete: true
completedAt: "2026-01-26"
inputDocuments:
  - 'docs/reference/project-context.md'
  - 'docs/reference/architecture.md'
  - 'docs/bmad_reference/planning-artifacts/prd-bmad-dashboard.md'
  - 'docs/bmad_reference/planning-artifacts/architecture.md'
  - 'docs/commit_specification.md'
date: 2026-01-06
author: Node
---

# Product Brief: BMAD Orchestrator

## Executive Summary

BMAD Orchestrator is a terminal-based command center for managing BMAD workflows across multiple parallel DevPods. It eliminates the cognitive overhead of tracking sprint status, workflow state, and next actions across concurrent development environments.

**Why this exists:** Running 3-6 parallel BMAD workstreams means cycling through VS Code windows, manually checking status in each, and mentally tracking which DevPod needs what. This tool consolidates everything into a single persistent TUI that shows the full picture and tells you exactly what to do next.

**Why it's open source:** Built to solve a specific workflow pain point. Shared with the BMAD community because others might find it useful. Not designed to compete with anything or become a platform—just a tool that scratches an itch.

**Success metric:** Does it save time and mental energy for the person using it?

---

## Core Vision

### Problem Statement

Managing BMAD methodology across multiple parallel DevPods creates unsustainable cognitive overhead. Developers must manually cycle through environments, run status commands in each, interpret results, determine next actions, and construct the right commands to execute. This mental tax grows with each additional DevPod, limiting the practical benefit of parallelization.

### Problem Impact

- **Context switching tax**: Cycling through 3-6 VS Code windows breaks flow and wastes time
- **Decision fatigue**: Constantly determining "what BMAD command do I run next?"
- **Idle waste**: DevPods sit waiting because no one noticed they finished or need input
- **Scaling ceiling**: Can't effectively run more parallel work than you can mentally track

### Why Existing Solutions Fall Short

- **claude-instance**: Solves container lifecycle (spin up, list, manage) but provides zero visibility into BMAD workflow state
- **Manual /workflow-status**: Must run in each DevPod separately, requires clean context, tells you status but not the action to take
- **No unified view**: Nothing shows all DevPods' BMAD state in one place with actionable next steps

### Proposed Solution

A persistent terminal TUI (like `htop`) that:
1. **Shows all DevPods** with current story, status, and time since last activity
2. **Surfaces what needs attention**: idle workers, needs-input states, stale sessions
3. **Suggests next actions** with ready-to-run commands
4. **Progressive automation path**: Phase 1 is read-only visibility and copy-paste commands. Later phases add one-click dispatch, then autonomous execution with approval gates.

**UX Layout:** Pane-based grid (2x2 at 120+ cols, 1-column stack at 80-119 cols). Each DevPod is a self-contained pane showing status, story, progress, and inline question display for needs-input states. This provides rich context without drilling down. Trade-off: 5+ DevPods require scrolling.

The transformation: from scattered mental overhead → calm, clear command center.

### Why This Tool

| Aspect | Reality |
|--------|---------|
| **Primary user** | The person building it—dogfooding with instant feedback loops |
| **Methodology-aware** | Understands BMAD's natural flow (phases, gates, artifacts), not just file contents |
| **Scope** | Solves one specific problem well. Not trying to be a platform. |
| **Open source** | Shared because it might help others. Community contributions welcome. |
| **Success criteria** | Does it reduce cognitive overhead? Does it save time? |

### Prior Art

**[bmad-progress-dashboard](https://github.com/ibadmore/bmad-progress-dashboard)** - An existing Node.js terminal UI for BMAD progress tracking that serves as both inspiration and potential foundation:

| Capability | Description |
|------------|-------------|
| Terminal-based progress display | Visual progress bars in terminal |
| BMAD file parsing | Reads story files, calculates completion |
| Phase weighting | Planning (40%) + Development (60%) |
| Real-time updates | File watching for live refresh |
| Markdown dashboard | Generates status reports |

This project demonstrates the terminal UI patterns and BMAD file parsing that inform the orchestrator's design approach.

---

## Target Users

### Primary User

**The BMAD Power User (You)**

A developer running BMAD methodology across one or more DevPods who wants to eliminate the cognitive overhead of workflow management.

**Profile:**
- Comfortable with BMAD workflows, Claude, and DevPod
- Running 1-6 parallel workstreams (or a single focused stream)
- Values flow state and hates context switching
- Wants to orchestrate, not babysit

**Current Pain:**
- Cycles through VS Code windows checking status
- Mentally tracks "what DevPod needs what?"
- Loses time to idle DevPods and missed needs-input states
- Has to remember and construct BMAD commands manually

**Usage Pattern:**
- Leaves BMAD Orchestrator running as the **primary interface**
- Only switches away for visual tasks (diffs, screenshots, reviewing output)
- Glances at dashboard to stay oriented, interacts to dispatch/resume
- Expects it to be faster than the alternative, or won't use it

**Success Moment:**
Story progression flows seamlessly—1.1 → 1.2 → 1.3—without manually thinking about each substep. The orchestrator handles the "what's next?" so you can focus on decisions that matter.

**Failure Mode to Avoid:**
Connection and session reliability. If resuming a Claude session breaks or is flaky, the frustration outweighs the benefit. Smooth session handling is non-negotiable.

### Secondary Users

Not a focus for v1. The tool is built for the person orchestrating, not observers or reviewers.

### User Journey

| Phase | Experience |
|-------|------------|
| **Discovery** | Already knows they need this—built it to scratch their own itch |
| **Onboarding** | `bmad-orchestrator` launches, auto-discovers DevPods, shows status immediately |
| **Core Usage** | Dashboard stays open. Glance → see what needs attention → dispatch/resume → repeat |
| **Aha Moment** | First time a story completes and the next one is ready to dispatch without thinking |
| **Long-term** | Becomes the default way to interact with BMAD. VS Code is for code, dashboard is for orchestration |

---

## Success Metrics

### User Success

**The Gut-Feel Test:**
"I open the dashboard instead of cycling VS Code windows." If the dashboard is the first reach, it's working.

**Time Savings:**
Morning check-in drops from **5+ minutes** of context-gathering to **under 30 seconds**. Glance, know, act.

**Behavioral Indicators:**
- Stop opening multiple VS Code windows just to check status
- Stop running `/workflow-status` manually in each DevPod
- Stories get dispatched without mentally tracking "what's idle, what's next"
- Needs-input situations get resolved faster (immediate visibility)

### The 1-Month Check

**The Bar:** Still using it daily = success.

**Must-Work Capabilities:**
| Capability | Success Criteria |
|------------|------------------|
| Unified visibility | See all DevPods + status at a glance |
| Attention routing | Know which one needs attention first |
| Actionable output | Copy-paste a command and act |

If any of these fail, the tool fails.

### Reliability Metrics

**The Non-Negotiable:** Reliability is the kill switch. If it's flaky, trust dies.

| Metric | Target |
|--------|--------|
| **Session resume** | Works on first attempt (leading indicator) |
| **Dashboard stability** | Runs error-free for a full work session |
| **Data integrity** | Zero data-loss incidents (binary—not "low," but *zero*) |

These aren't stretch goals—they're table stakes. A dashboard that crashes or loses session state is worse than no dashboard.

### Business Objectives

N/A — This is a personal utility tool, not a business. No revenue targets, no growth goals.

### Community Metrics

**Nice-to-have, not a goal.** If people find it useful, great. Not optimizing for GitHub stars or contributors.

**Quality bar:** "Good enough to publish without embarrassment." Clean, useful, shareable as a side effect—not the mission.

---

## MVP Scope

### Core Features (Phase 1)

**Dashboard Capabilities:**
- See all DevPods with current story + status at a glance
- Surface which DevPods need attention: needs-input, stale, idle
- Show backlog of unassigned stories (data's already there, trivial to display)
- Stale/heartbeat detection to surface stuck workers

**Command Generation:**
- Copy-paste ready commands for dispatch, resume, and other actions
- Dashboard is read-only—generates commands, doesn't execute them

**Technical Approach:**
- Host-based filesystem reads (DevPod workspaces via mounted paths)
- Zero-config auto-discovery (no configuration files)
- Periodic refresh: manual on keypress + auto-refresh every 30s

**The Ship-It Bar:**
Open dashboard → see 3 DevPods → immediately know one needs input → copy command → paste → done. If that loop works smoothly, MVP is complete.

### Out of Scope for MVP

| Feature | Status | Rationale |
|---------|--------|-----------|
| One-click dispatch | Phase 2 | Copy-paste is fine for MVP |
| Automatic execution / approval gates | Phase 3 | Way out of scope |
| Interactive tmux attach | Deferred | Can do manually |
| Configuration files | Phase 2 | Zero-config first |
| Real-time file watching | Phase 2 | Periodic refresh is fine |
| Claude Agent SDK integration | Phase 3 | Depends on SDK maturity |
| Team features / user accounts | Never | Off-mission |

### Implementation Notes

| Item | Note |
|------|------|
| **Backlog visibility** | Keep in MVP—data's in sprint-status.yaml, ~5 lines to filter |
| **Heartbeat detection** | Fiddly edge cases (missing files, stale timestamps)—don't underestimate |
| **Mounted paths** | Validate early that DevPod mounts to predictable host paths—potential blocker |

### MVP Success Criteria

MVP is successful when:
1. Dashboard becomes the first reach instead of VS Code cycling
2. Morning check-in drops from 5+ minutes to under 30 seconds
3. Still using it daily after 1 month
4. Session handling works reliably (zero flakiness)

### Future Vision

**Phase 2 (Realistic):**
- One-click dispatch (press a key, command executes)
- Real-time file watching instead of interval refresh
- Configuration file support (include/exclude DevPods, custom thresholds)
- Enhanced visualization (Kanban view of stories—nice-to-have)
- Project-agnostic (works on any BMAD project without per-project setup)

**Phase 3 (Aspirational — depends on Claude Agent SDK maturity):**
- Structured skill invocation (typed function calls, not string commands)
- Reliable output parsing (JSON responses, no PTY hacks)
- Session management (resume, context, conversation state)
- Approval gates (dispatch automatically, pause for human sign-off)
- Semi-autonomous: "DevPod-1 is idle, assign Story-15?" → approve → executes → review outcome

**Phase 4 (North Star — the dream):**
- Fully autonomous mode: workers self-assign, human reviews artifacts, intervenes on blockers
- Multi-project orchestration: manage DevPods across multiple repos
- NOT team features: stays a lean personal/small-team tool forever

**Honest Assessment:**
Phase 2 is realistic and achievable. Phase 3 depends on how well Claude Agent SDK matures. Phase 4 is the north star—nice to have direction, not planning for it.
