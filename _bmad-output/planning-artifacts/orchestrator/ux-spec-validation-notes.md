# UX Spec Validation Notes

**Date:** 2026-01-06
**Purpose:** Track findings from validating UX Design Specification against Product Brief and PRD

---

## Alignment Summary

### Perfect Alignment ✅
- Core vision: "Confidence through clarity"
- Target user: Solo orchestrator, 1-6 DevPods
- Status indicators: ✓ ● ○ ⏸ ✗ ⚠ (same symbols, same meanings)
- Copy-paste commands: Phase 1 approach agreed
- Success metric: Morning check-in < 30 seconds

### Needs Attention

| Issue | Status | Resolution |
|-------|--------|------------|
| Panes layout | ✅ Confirmed | Panes provide space for inline questions; scroll trade-off accepted |
| Epic progress (new feature) | ✅ Resolved | Added FR8a to PRD |
| Backlog visibility | ✅ Resolved | Hybrid: footer bar + overlay via `b` key |
| Detail view | ✅ Resolved | MVP contents specified; full mockup deferred |
| CLI subcommands UX | ✅ Resolved | Out of scope - covered by PRD FR29-32 |
| Naming | ✅ Resolved | Standardized on "BMAD Orchestrator" / `bmad-orchestrator` |

---

## Issue 1: Panes Layout Validation ✅ RESOLVED

### The Question
UX spec evolved to 2x2 pane grid layout. Is this the right approach given all requirements?

### Requirements Check

**From Brief:**
- "See all DevPods + status at a glance" ✅ Panes support this
- "Surfaces what needs attention" ✅ Double-border on needs-input panes
- "Show backlog of unassigned stories" ⚠️ Need dedicated space

**From PRD:**
- FR11-15: Needs-input handling with full question display ✅ Panes have room
- FR27: Drill into detail view for specific DevPod ✅ Panes naturally support focus
- Journey 2 mockup shows inline question text ✅ Panes accommodate this

**From PRD Journey 2 mockup:**
```
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
```

This REQUIRES pane-style space. A row layout cannot fit multi-line questions.

### Validation Findings

- Panes provide necessary vertical space for inline question display
- PRD Journey 2 mockup implicitly requires pane-style layout
- Trade-off: 5+ DevPods require scrolling (2x2 grid shows 4 at once)
- Scroll trade-off is acceptable; attention-drawing mechanisms can be added later if needed

### Decision

**✅ PANES CONFIRMED** - The pane-based layout is the correct approach. Accept scroll trade-off for 5+ DevPods. Future enhancement: auto-focus on needs-input panes if scroll becomes problematic.

---

## Issue 2: Backlog Visibility ✅ RESOLVED

### Gap Description
- Brief explicitly says: "Show backlog of unassigned stories"
- PRD FR9: "User can see backlog of unassigned stories"
- UX spec only shows "Suggested: STORY-18" in idle panes

### Resolution Options

1. **Dedicated backlog section** below pane grid
2. **Overlay/modal** accessible via hotkey
3. **Inline in idle panes** (current approach - just needs expansion)

### Decision

**✅ HYBRID APPROACH (Option C)** - Combines ambient awareness with detail-on-demand:

1. **Backlog Bar** (always visible): Shows story count + IDs summary
   - Example: `Backlog: 3 stories ready │ 1-4-tests, 2-3-validation, 2-4-integration`

2. **Backlog Overlay** (via `b` key): Full detail table with ID, Epic, Title
   - Esc to close
   - Aligns with progressive disclosure principle

**Updates Made:**
- UX spec: Added Backlog Bar to Layout Zones
- UX spec: Added Backlog Overlay mockup
- UX spec: Added `b` key to Keyboard Mapping and Tertiary Actions
- UX spec: Updated Key Discoverability footer

---

## Issue 3: Detail View Specification ✅ RESOLVED

### Gap Description
PRD Journey 2 shows rich detail view with:
- Full question text with numbered options
- Progress before pause (tasks 3/7)
- Session ID visible
- Answer input field
- Interactive Mode button

UX spec mentions "Enter drills into detail view" but doesn't fully specify contents.

### Resolution

**MVP Detail View** (added to UX spec):
- Full question text (untruncated)
- Session ID for resume commands
- Task progress (e.g., "3/7 tasks completed")
- Last completed task name
- Copy-paste command for SSH/resume

**Phase 2 (deferred):**
- Answer input field for quick responses
- Interactive Mode button (tmux attach)

Full visual mockup deferred to future iteration - current spec provides sufficient guidance for implementation.

---

## Issue 4: CLI Subcommands UX ✅ RESOLVED

### Gap Description
PRD specifies CLI commands for scripting:
- `bmad-orchestrator status` - one-shot status dump
- `bmad-orchestrator list` - list discovered DevPods
- `bmad-orchestrator dispatch <devpod> <story>` - generate dispatch command
- `bmad-orchestrator resume <devpod> <answer>` - resume session

UX spec focuses on TUI only.

### Resolution Options

1. **Explicitly out-of-scope** for UX spec (CLI is separate concern)
2. **Add CLI output patterns** to UX spec
3. **Create separate CLI UX guidelines** document

### Decision

**✅ OUT OF SCOPE** - CLI subcommands are not part of the UX spec.

Rationale:
- UX spec focuses on visual TUI experience
- CLI output patterns already defined in PRD (FR29-32) and project-context.md
- JSON output format, error formatting with suggestions already established
- No duplication needed

---

## Issue 5: Naming Reconciliation ✅ RESOLVED

### Current State (Before)
- Brief: "BMAD Dashboard"
- PRD: "BMAD Dashboard"
- UX Spec: "BMAD Orchestrator"

### Considerations
- "Dashboard" = read-only visibility connotation
- "Orchestrator" = implies coordination/control (aligns with Phase 2+ vision)
- Repo name is already `bmad-orchestrator`

### Decision

**✅ STANDARDIZE ON "ORCHESTRATOR"**

- Product name: **BMAD Orchestrator**
- CLI command: `bmad-orchestrator`
- Config file: `~/.bmad-orchestrator.yaml`
- Package: `@zookanalytics/bmad-orchestrator`

Rationale: Captures aspirational vision even though MVP focuses on dashboard functionality. Consistent with repo name.

**Updates Made:**
- PRD: All references updated to "BMAD Orchestrator" and `bmad-orchestrator`
- Brief: CLI command reference updated
- UX spec: Already used "Orchestrator" (no change needed)

---

## Change Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2026-01-06 | Document created | Initial validation started |
| 2026-01-06 | Panes layout | ✅ Confirmed - panes provide necessary space for inline questions; scroll trade-off for 5+ DevPods accepted |
| 2026-01-06 | Backlog visibility | ✅ Resolved - hybrid approach: footer bar for awareness + overlay via `b` key for detail |
| 2026-01-06 | Detail view | ✅ Resolved - MVP contents specified; answer input + interactive mode deferred to Phase 2 |
| 2026-01-06 | CLI subcommands | ✅ Resolved - out of scope for UX spec; covered by PRD FR29-32 |
| 2026-01-06 | Naming | ✅ Resolved - standardized on "BMAD Orchestrator" / `bmad-orchestrator` across all docs |
| 2026-01-06 | Epic progress | ✅ Resolved - added FR8a to PRD for epic-level progress visibility |

