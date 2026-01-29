---
conversionFrom: 'packages/bmm-retrospective-module/src/workflows/retro-item-execute/retro-item-execute.spec.md'
originalFormat: 'BMAD Workflow Specification (spec.md)'
stepsCompleted: ['step-00-conversion', 'step-02-classification', 'step-03-requirements', 'step-04-tools', 'step-05-plan-review', 'step-06-design', 'step-07-foundation', 'step-08-build-step-01', 'step-09-build-step-02', 'step-09-build-step-03']
created: 2026-01-29
status: CONFIRMED
approvedDate: 2026-01-29
confirmationDate: 2026-01-29
confirmationType: conversion
coverageStatus: complete
---

# Workflow Creation Plan

## Conversion Source

**Original Path:** packages/bmm-retrospective-module/src/workflows/retro-item-execute/retro-item-execute.spec.md
**Original Format:** BMAD Workflow Specification (spec.md)
**Detected Structure:** 3-step planned workflow for executing retro action items

---

## Original Workflow Analysis

### Goal (from source)

Execute a single action item from a followup YAML file by invoking the routed workflow, then update item status upon user confirmation.

### Original Steps (Complete List)

**Step 1:** Load - Load followup YAML, select item by ID or find next pending item
**Step 2:** Execute - Invoke routed workflow with summary as context (handles bmad workflows, bash commands, human tasks)
**Step 3:** Confirm - User confirms completion, update status in YAML (done/skipped/pending)

### Output / Deliverable

- Non-document workflow
- Updates existing `<file>.followup.yaml` — Sets `status: done` on completed item
- Passes through whatever the routed workflow produces

### Input Requirements

- **Required:** `yaml-file` — Path to the `.followup.yaml` file
- **Optional:** `item-id` — Specific item ID to execute (defaults to next pending item)

### Key Instructions to LLM

- Orchestration workflow — invokes other workflows based on item type
- Three workflow types to handle:
  - `bmad:bmm:workflows:*` → Invoke BMAD workflow with summary as input
  - `bash` → Display/offer to run bash command
  - `human` → Display manual action, wait for confirmation
- Status updates are atomic (write after confirmation only)
- V1 philosophy: human confirms, no auto-marking

---

## Conversion Notes

**What works well in original:**
- Clear automation focus — execute items without friction
- Well-defined routing logic for different workflow types
- Explicit edge case handling (missing files, no pending items, etc.)
- Simple 3-step structure with clear boundaries

**What needs improvement:**
- Balance between human confirmation and autonomous completion
- Wide variety of action types need flexible handling
- Consider "quiet mode" for items that complete successfully without needing commentary

**Compliance gaps identified:**
- Spec only — no actual workflow implementation exists yet
- Need to implement as BMAD-compliant step-file architecture
- Create-only mode (no steps-c/ folder, just steps/)

---

## User Discovery Notes

1. **Key priority:** Automation — the workflow should minimize friction in executing items
2. **Main concern:** Balance human vs. autonomous — different action types have different needs
3. **No additional features** requested for V1
4. **Audience:** Solo developer

---

## Classification Decisions

**Workflow Name:** retro-item-execute
**Target Path:** packages/bmm-retrospective-module/src/workflows/retro-item-execute/

**4 Key Decisions:**
1. **Document Output:** false (non-document — orchestrates workflows, updates existing YAML)
2. **Module Affiliation:** BMM (bmm-retrospective-module extension)
3. **Session Type:** single-session (quick 3-step orchestration)
4. **Lifecycle Support:** create-only (execution workflow, no edit/validate needed)

**Structure Implications:**
- Uses `steps/` folder (not `steps-c/`) since create-only
- No continuation logic needed
- No document template needed
- Simple init → execute → confirm flow

---

## Requirements

**Flow Structure:**
- Pattern: Linear with internal branching (by action type)
- Phases: Load → Execute → Confirm
- Estimated steps: 3

**User Interaction:**
- Style: Mostly autonomous with confirmation checkpoint
- Decision points: Final confirmation (done/skipped), bash command display (user runs manually)
- Checkpoint frequency: Once per item (at confirmation)

**Inputs Required:**
- Required: `yaml-file` — Path to `.followup.yaml` file
- Optional: `item-id` — Specific item ID (defaults to next pending)
- Prerequisites: `.followup.yaml` must exist (from retro-followup workflow)

**Output Specifications:**
- Type: Action (updates existing file)
- Updates: Existing `.followup.yaml` — sets `status: done` or `status: skipped`
- Passes through: Whatever the routed workflow produces
- Feedback: Console status messages during execution

**Success Criteria:**
- Item executed (workflow invoked, bash displayed, or human task shown)
- User confirms completion
- YAML updated atomically after confirmation
- Edge cases handled gracefully (no pending items, file not found, invalid ID)

**Instruction Style:**
- Overall: Prescriptive
- Notes: Execution workflow — clear, predictable steps, no ambiguity

**Action Type Handling (V1):**
- `bmad:bmm:workflows:*` → Invoke BMAD workflow with summary as context
- `bash` → Display command for user to run manually (V1 conservative)
- `human` → Display manual action, wait for confirmation

---

## Tools Configuration

**Core BMAD Tools:**
- **Party Mode:** Excluded — execution workflow, not creative
- **Advanced Elicitation:** Excluded — execution workflow, not discovery
- **Brainstorming:** Excluded — not applicable

**LLM Features:**
- **File I/O:** Included — read YAML at start, write YAML after confirmation
- **Web-Browsing:** Excluded — local action items, no web needed
- **Sub-Agents:** Excluded — orchestrator doesn't need delegation
- **Sub-Processes:** Excluded — single item execution, no parallelism

**Workflow Invocation:**
- Method: Skill tool (standard BMAD invocation)
- Use case: Invoke workflows specified in action items (e.g., `bmad:bmm:workflows:quick-dev`)

**Memory:**
- Type: Single-session
- Tracking: Simple — read YAML at start, write at end

**External Integrations:**
- None required

**Installation Requirements:**
- None — all features are built-in

---

## Workflow Design

### Overview

| Aspect | Value |
|--------|-------|
| Steps | 3 (Load → Execute → Confirm) |
| Session | Single-session |
| Structure | Create-only (`steps/` folder) |
| Interaction | Minimal — one confirmation at end |
| Auto-proceed | Step 1 → Step 2 → Step 3 (no waits between) |

### Step Details

**Step 1: Load** (`step-01-load.md`)
- Type: Init (Non-Continuable)
- Goal: Load followup YAML, select item (by ID or next pending)
- Logic:
  1. Get YAML file path from user
  2. Load and parse YAML
  3. Select item (by ID if provided, else first pending)
  4. Handle errors (file not found, no pending items)
  5. Display item details
- Menu: Auto-proceed to Execute

**Step 2: Execute** (`step-02-execute.md`)
- Type: Branch (internal routing)
- Goal: Execute action based on item type
- Logic:
  1. Read item's `workflow` field
  2. Branch by type:
     - `bmad:bmm:workflows:*` → Invoke via Skill tool with summary as context
     - `bash` → Display command for user to run manually
     - `human` → Display manual action required
- Menu: Auto-proceed to Confirm

**Step 3: Confirm** (`step-03-confirm.md`)
- Type: Final
- Goal: Confirm completion, update YAML status
- Logic:
  1. Ask: "Was this item completed? [Y]es / [N]o / [S]kip"
  2. Update status based on response (done/pending/skipped)
  3. Write updated YAML atomically
  4. Report completion
- Menu: Y/N/S (custom)

### Data Flow

```
Input: yaml-file path, optional item-id
   ↓
Step 1: Load YAML → Extract item → Store in context
   ↓
Step 2: Read item.workflow → Route → Execute/Display
   ↓
Step 3: User confirms → Update YAML → Write file
   ↓
Output: Updated YAML with status change
```

### File Structure

```
retro-item-execute/
├── workflow.md
└── steps/
    ├── step-01-load.md
    ├── step-02-execute.md
    └── step-03-confirm.md
```

### Error Handling

| Scenario | Handling |
|----------|----------|
| YAML file not found | Error message, exit |
| YAML parse error | Error message, exit |
| Item ID not found | Error with available IDs, exit |
| No pending items | "All items complete!", exit gracefully |
| Unknown workflow type | Treat as `human` task |
| Routed workflow fails | Keep status pending, report error |

### Role and Persona

- Role: Task executor / orchestrator
- Tone: Brief, clear, action-oriented
- Style: Minimal commentary, status updates only

### Workflow Chaining

- Comes after: `retro-followup` (generates `.followup.yaml`)
- Invokes: Various workflows (quick-dev, research, etc.)
- Produces: Updated YAML status

---

## Foundation Build Complete

**Created:**
- Folder structure at: `packages/bmm-retrospective-module/src/workflows/retro-item-execute/`
- `workflow.md` — Entry point with initialization sequence
- `steps/` folder — Ready for step files

**Configuration:**
- Workflow name: retro-item-execute
- Continuable: No (single-session)
- Document output: No (non-document workflow)
- Mode: Create-only (`steps/` folder)

**Next Steps:**
- Step 8: Build step-01-load.md
- Step 9: Build step-02-execute.md and step-03-confirm.md

---

## Step 01 Build Complete

**Created:**
- `steps/step-01-load.md`

**Step Configuration:**
- Type: Non-continuable (single-session)
- Input Discovery: No (user provides YAML path)
- Menu: Auto-proceed (Pattern 3)
- Next Step: step-02-execute.md

**Supporting Files:**
- None needed

---

## Step 02 Build Complete

**Created:**
- `steps/step-02-execute.md`

**Step Configuration:**
- Type: Branch (internal routing by workflow type)
- Routes: bmad workflows → Skill tool, bash → display, human → display
- Menu: Auto-proceed to step-03-confirm
- Next Step: step-03-confirm.md

**Supporting Files:**
- None needed

---

## Step 03 Build Complete

**Created:**
- `steps/step-03-confirm.md`

**Step Configuration:**
- Type: Final Step
- Menu: Custom Y/N/S (done/pending/skipped)
- Updates: YAML status atomically after confirmation
- Next Step: None (final step)
