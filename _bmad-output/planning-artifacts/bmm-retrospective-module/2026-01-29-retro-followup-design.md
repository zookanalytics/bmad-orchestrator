# Retro-Followup Workflow Design

**Date:** 2026-01-29
**Status:** Draft
**Author:** Node + BMad Master

---

## Overview

A BMAD workflow that parses retrospective action items and generates a machine-parseable YAML file for orchestrated execution via Keystone CLI.

**Problem:** Retrospective action items require manual tracking and context-switching to execute. Each item needs analysis to determine the right workflow and sufficient context.

**Solution:** Automate the routing and enrichment of action items into a structured format that Keystone can orchestrate.

---

## Invocation

```
/bmad:bmm:workflows:retro-followup <retro-file-path>
```

**Example:**
```
/bmad:bmm:workflows:retro-followup _bmad-output/implementation-artifacts/epic-1-retro-2026-01-19.md
```

---

## Output

**Location:** `<retro-file>.followup.yaml` (sibling file to source)

**Example:** `epic-1-retro-2026-01-19.md` → `epic-1-retro-2026-01-19.followup.yaml`

### YAML Schema

```yaml
source: string          # Path to source retrospective file
generated: string       # ISO date when generated

items:                  # Array of action items (only "Open" items from source)
  - id: integer         # Sequential ID for this followup file (1, 2, 3...)
    action_item: integer # Original action item number from retro table
    workflow: string    # Full workflow path, "bash", or "human"
    status: string      # pending | done | skipped
    summary: string     # Clear, actionable summary with sufficient context
```

### Workflow Values

| Value | Use Case |
|-------|----------|
| `bmad:bmm:workflows:research` | Spikes, investigations, documentation research |
| `bmad:bmm:workflows:quick-dev` | Code changes, template edits, simple implementations |
| `bmad:bmm:workflows:create-tech-spec` | Items needing detailed technical design |
| `bmad:bmm:workflows:create-story` | Items that should become backlog stories |
| `bmad:bmm:workflows:sprint-planning` | Sprint status updates |
| `bash` | Direct CLI commands (e.g., `gh issue create`) |
| `human` | Requires manual human action, cannot be automated |

### Status Values

| Value | Meaning |
|-------|---------|
| `pending` | Not yet executed |
| `done` | Successfully completed |
| `skipped` | Intentionally not executed |

### Example Output

```yaml
source: _bmad-output/implementation-artifacts/epic-1-retro-2026-01-19.md
generated: 2026-01-29

items:
  - id: 1
    action_item: 1
    workflow: bash
    status: pending
    summary: |
      Create GitHub issue titled "Epic Evaluation Workflow" with label
      "enhancement". Use the Process Improvement Proposal section
      (delivery manifest, demos, deviations) as the issue body.

  - id: 2
    action_item: 2
    workflow: bmad:bmm:workflows:quick-dev
    status: pending
    summary: |
      Add a "Deviations from Spec" section to the story template at
      _bmad/bmm/templates/story-tmpl.md. Include fields for: deviation
      description, impact assessment, and resolution.

  - id: 3
    action_item: 3
    workflow: bmad:bmm:workflows:quick-dev
    status: pending
    summary: |
      Create a pre-review checklist document covering: types exported,
      constants defined, pnpm check passes locally.

  - id: 4
    action_item: 4
    workflow: bmad:bmm:workflows:sprint-planning
    status: pending
    summary: |
      Update sprint-status.yaml to mark Epic 1 as "done".

  - id: 5
    action_item: 5
    workflow: human
    status: pending
    summary: |
      Manually validate container lifecycle on host machine outside
      devcontainer environment.
```

---

## Workflow Steps

### Step 1: Parse Retrospective

- Load the retrospective file
- Detect format:
  - **Simple table:** `#`, `Action`, `Owner`, `Priority`, `Status` columns
  - **Detailed specs:** Action items with embedded command specifications
- Extract action items with metadata
- Filter to only "Open" status items (skip already-done items)

### Step 2: Analyze & Route Each Item

For each open action item:

1. **Analyze** the action text and any linked specification in the retro
2. **Determine** the best-fit workflow from available options
3. **Generate** a clear summary that provides sufficient context for execution

**Routing Logic:** AI analysis determines the appropriate workflow based on:
- Action item text and keywords
- Surrounding context in the retrospective
- Any detailed specifications provided
- Nature of the deliverable (code, docs, research, manual)

### Step 3: Generate YAML

- Write `<retro-file>.followup.yaml` to same directory as source
- All items initialized with `status: pending`
- Report summary to user (X items processed, workflows assigned)

---

## Proposed File Structure

```
_bmad/bmm/workflows/retro-followup/
├── workflow.md           # Main workflow definition
├── steps/
│   ├── step-01-parse.md  # Parse retro, extract action items
│   ├── step-02-route.md  # Analyze each item, assign workflow
│   └── step-03-output.md # Generate YAML file
└── examples/
    └── sample-output.yaml
```

**Note:** Leverage BMAD custom workflow capabilities. Research existing BMAD workflow conventions and adapt structure accordingly.

---

## Keystone Integration

### Invocation

```bash
# Run all pending items for a retro
keystone run retro-followup -i "retro_id=epic-1"

# Future enhancement: Run specific action item
keystone run retro-followup -i "retro_id=epic-1" -i "action_id=2"
```

### Prompt Templating

Keystone templates the full prompt from YAML fields:

```
{summary}

Reference: {source} Action Item #{action_item}
When complete, update Action Item #{action_item} status to "done" in both
{source} and this followup file.
```

### Status Consistency

Keystone workflow includes a step to sync status between:
- The followup YAML file (`status` field)
- The source retrospective file (Action Items table Status column)

---

## Supported Retrospective Formats

### Format A: Simple Table

```markdown
## Action Items

| # | Action | Owner | Priority | Status |
|---|--------|-------|----------|--------|
| 1 | Create GitHub issue for X | Node | Medium | Open |
| 2 | Update template Y | Winston | Low | Open |
```

**Handling:** AI analyzes action text to determine workflow and generate enriched summary.

### Format B: Detailed Specifications

```markdown
## Action Items

| # | Action | Owner | Deadline | Success Criteria |
|---|--------|-------|----------|------------------|
| 1 | Implement TEA-first test design | TEA | Before env-2 | Tests defined before dev-story |

### #1: TEA-First Test Design Spec

Command to execute:
/bmad:bmm:workflows:research
...
```

**Handling:** Extract embedded specifications directly; workflow and context already provided.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No action items in retro | Generate YAML with empty `items` array, log note |
| All items already "Done" | Generate YAML with empty `items` array, log note |
| Item has detailed spec | Extract workflow/summary from spec directly |
| Item is vague | AI enriches with context from surrounding retro sections |
| Unknown workflow needed | Default to `bmad:bmm:workflows:quick-dev` with note |

---

## Implementation Handoff

This design document provides architectural direction. Implementation agents should:

1. **BMAD Workflow Agent:**
   - Research BMAD custom workflow conventions
   - Implement `retro-followup` workflow following discovered patterns
   - Register in workflow manifest

2. **Keystone Agent:**
   - Create `retro-followup` keystone workflow
   - Implement prompt templating from YAML
   - Implement status sync step

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| YAML over Markdown | Machine-parseable for Keystone orchestration |
| Sibling file location | Keeps followup coupled with source retro |
| Minimal fields | YAGNI - id, action_item, workflow, status, summary |
| AI routing over keywords | Action items vary widely; AI analysis more accurate |
| Status in YAML | Enables Keystone filtering without parsing Markdown |
| `human` workflow type | Some items require manual action, can't be automated |
