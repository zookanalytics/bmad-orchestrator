---
conversionFrom: 'packages/bmm-retrospective-module/src/workflows/retro-followup/retro-followup.spec.md'
originalFormat: 'Workflow specification + Design document'
stepsCompleted: ['step-00-conversion', 'step-02-classification', 'step-03-requirements', 'step-04-tools', 'step-05-plan-review', 'step-06-design', 'step-07-foundation', 'step-08-build-step-01', 'step-09-build-steps-02-03']
created: 2026-01-29
status: CONFIRMED
approvedDate: 2026-01-29
confirmationDate: 2026-01-29
confirmationType: conversion
coverageStatus: complete
---

# Workflow Creation Plan

## Conversion Source

**Original Path:** packages/bmm-retrospective-module/src/workflows/retro-followup/retro-followup.spec.md
**Original Format:** Workflow specification (placeholder for implementation)
**Detected Structure:** Create-only workflow with 3 steps, document-producing

---

## Original Workflow Analysis

### Goal (from source)

Transform retrospective action items into a machine-parseable YAML file for orchestrated execution. Parse a retrospective markdown file, extract open action items, use AI to analyze and route each item to the appropriate BMM workflow, and generate a structured YAML file.

### Original Steps (Complete List)

**Step 1:** Parse - Load retro file, detect format (simple table vs detailed specs), extract open action items with metadata, filter to "Open" status only
**Step 2:** Route - AI analyzes each item, determines best-fit workflow, generates enriched summary with sufficient context for execution
**Step 3:** Output - Write `.followup.yaml` sibling file to source retro, report summary to user (X items processed, workflows assigned)

### Output / Deliverable

- `<retro-file>.followup.yaml` - Sibling file to source retrospective
- YAML schema with: source, generated date, and items array (id, action_item, workflow, status, summary)

### Input Requirements

- `retro-file-path` - Path to the retrospective markdown file (passed as workflow argument)

### Key Instructions to LLM

- **Routing Logic:** AI analysis determines appropriate workflow based on:
  - Action item text and keywords
  - Surrounding context in the retrospective
  - Any detailed specifications provided
  - Nature of the deliverable (code, docs, research, manual)
- **Workflow values:** research, quick-dev, create-tech-spec, create-story, sprint-planning, bash, human
- **Status values:** pending, done, skipped
- **Edge case handling:** Empty items, all done, vague items, detailed specs, unknown workflow

---

## Conversion Notes

**What works well in original:**
- Clear 3-step structure (Parse → Route → Output)
- Well-defined YAML schema with explicit fields
- Comprehensive workflow routing values with use case mapping
- Good edge case documentation
- Two input format support (simple table vs detailed specs)

**What needs improvement:**
- Needs actual implementation (currently just a spec)
- Step files need to be created with BMAD-compliant format
- Workflow.md main entry point needs creation

**Compliance gaps identified:**
- Missing BMAD workflow.md structure with frontmatter
- Missing step files with proper STEP GOAL, MANDATORY EXECUTION RULES, etc.
- Missing menu/continuation handling
- Missing state tracking in frontmatter

---

## Classification Decisions

**Workflow Name:** retro-followup
**Target Path:** packages/bmm-retrospective-module/src/workflows/retro-followup/

**4 Key Decisions:**
1. **Document Output:** true (produces `.followup.yaml`)
2. **Module Affiliation:** BMM (bmm-retrospective-module)
3. **Session Type:** single-session
4. **Lifecycle Support:** create-only

**Structure Implications:**
- Uses `steps/` folder (not steps-c/ since create-only)
- No continuation logic needed (single-session)
- No steps-e/ or steps-v/ folders (create-only)
- Document template for YAML output

---

## User Answers

**Q1 - What's working well:** (Deferred to future)

**Q2 - Problems/Gaps:** The two-format restriction is limiting. Should analyze ANY retrospective for action items and route to appropriate workflows - not be constrained to specific table formats.

**Q3 - Missing features:** (Deferred to future)

**Q4 - Target audience:** Solo user (Node) for now

---

## Requirements

**Flow Structure:**
- Pattern: linear
- Phases: Parse → Route → Output
- Estimated steps: 3

**User Interaction:**
- Style: mostly autonomous
- Decision points: none (fully automated after invocation)
- Checkpoint frequency: none needed

**Inputs Required:**
- Required: retro-file-path (path to retrospective markdown file)
- Optional: none
- Prerequisites: retro file must exist and contain action items

**Output Specifications:**
- Type: document (YAML file)
- Format: strict (defined schema)
- Location: sibling file to source retro (`<retro-file>.followup.yaml`)
- Schema:
  ```yaml
  source: string
  generated: string
  items:
    - id: integer
      action_item: integer
      workflow: string
      status: string
      summary: string
  ```

**Success Criteria:**
- YAML file generated as sibling to source retro
- All "Open" action items extracted and included
- Each item routed to appropriate workflow
- Each item has clear, actionable summary with context
- Empty items array valid if no open action items

**Instruction Style:**
- Overall: prescriptive
- Notes: Deterministic transformation with AI analysis for routing decisions

---

## Tools Configuration

**Core BMAD Tools:**
- **Party Mode:** excluded - No user interaction needed
- **Advanced Elicitation:** excluded - No decision points
- **Brainstorming:** excluded - Routing is prescribed, not creative

**LLM Features:**
- **Web-Browsing:** excluded - All data from local retro file
- **File I/O:** included - Read retro file, write YAML output
- **Sub-Agents:** excluded - Simple linear flow
- **Sub-Processes:** excluded - Sequential processing

**Memory:**
- Type: single-session
- Tracking: none needed

**External Integrations:**
- None required

**Installation Requirements:**
- None - all tools are built-in

---

## Workflow Design

### File Structure

```
packages/bmm-retrospective-module/src/workflows/retro-followup/
├── workflow.md
├── steps/
│   ├── step-01-parse.md
│   ├── step-02-route.md
│   └── step-03-output.md
└── data/
    └── workflow-routing.md
```

### Step Sequence

| Step | Name | Type | Goal | Menu |
|------|------|------|------|------|
| 1 | step-01-parse | Init (Non-Continuable) | Load retro file, extract open action items | Auto-proceed |
| 2 | step-02-route | Middle (Simple) | Analyze each item, assign workflow, generate summary | Auto-proceed |
| 3 | step-03-output | Final | Write YAML file, report results | None |

### Data Flow

| Step | Input | Output |
|------|-------|--------|
| step-01-parse | `retro-file-path` (arg) | List of open action items |
| step-02-route | Action items list | Routed items with workflow + summary |
| step-03-output | Routed items | `.followup.yaml` file |

### Error Handling

| Scenario | Handling |
|----------|----------|
| File not found | Error + exit |
| No action items | Error + exit |
| No open items | Write empty `items[]` + note |
| Unrecognized action | Default to quick-dev |

### Role

**AI Role:** Retrospective Analyst and Workflow Router
**Approach:** Prescriptive, minimal user interaction

### Special Features

- **Continuation:** Not needed (single-session)
- **Subprocess optimization:** Not needed (small dataset)
- **Input Discovery:** Not needed (explicit path argument)
- **Workflow Chaining:** Produces output for Keystone CLI

---

## Foundation Build Complete

**Created:**
- Folder structure at: `packages/bmm-retrospective-module/src/workflows/retro-followup/`
- `workflow.md` - Main entry point with init sequence
- `steps/` directory (empty, step files next)
- `data/` directory (empty, routing data next)

**Configuration:**
- Workflow name: retro-followup
- Continuable: no
- Document output: yes (YAML, programmatically generated — no template)
- Mode: create-only

**Next Steps:**
- Step 8: Build step-01-parse
- Step 9: Build remaining steps (step-02-route, step-03-output)
- Build data/workflow-routing.md

---

## Step 01 Build Complete

**Created:**
- steps/step-01-parse.md

**Step Configuration:**
- Type: non-continuable (no step-01b)
- Input Discovery: no (explicit path argument)
- Next Step: step-02-route
- Menu: auto-proceed

**Supporting Files:**
- None needed for step 01

---

## Step 02 Build Complete

**Created:**
- steps/step-02-route.md
- data/workflow-routing.md (routing reference with workflows, keywords, priority)

**Step Configuration:**
- Type: middle (simple), auto-proceed
- Outputs to: working memory (routed items)
- Next Step: step-03-output

**Supporting Files:**
- data/workflow-routing.md — routing logic reference

---

## Step 03 Build Complete

**Created:**
- steps/step-03-output.md

**Step Configuration:**
- Type: final (no next step)
- Outputs to: `<retro-file>.followup.yaml` sibling file
- Next Step: none (workflow complete)

**Supporting Files:**
- None needed for step 03
