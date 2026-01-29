# Workflow Specification: retro-followup

**Module:** bmm (extension)
**Status:** Placeholder — To be created via workflow-builder workflow
**Created:** 2026-01-29

---

## Workflow Overview

**Goal:** Transform retrospective action items into a machine-parseable YAML file for orchestrated execution.

**Description:** Parse a retrospective markdown file, extract open action items, use AI to analyze and route each item to the appropriate BMM workflow, and generate a structured YAML file.

**Workflow Type:** Document-producing (generates `.followup.yaml`)

---

## Workflow Structure

### Entry Point

```yaml
---
name: retro-followup
description: Parse retrospective action items and generate followup YAML for orchestrated execution
web_bundle: true
installed_path: '{project-root}/_bmad/bmm/workflows/retro-followup'
---
```

### Mode

- [x] Create-only (no steps-c/ folder, just steps/)
- [ ] Tri-modal (steps-c/, steps-e/, steps-v/)

---

## Planned Steps

| Step | Name | Goal |
|------|------|------|
| 1 | Parse | Load retro file, detect format, extract open action items |
| 2 | Route | AI analyzes each item, assigns workflow, generates enriched summary |
| 3 | Output | Write `.followup.yaml` sibling file, report summary |

---

## Workflow Inputs

### Required Inputs

- `retro-file-path` — Path to the retrospective markdown file (passed as workflow argument)

### Optional Inputs

None

---

## Workflow Outputs

### Output Format

- [x] Document-producing
- [ ] Non-document

### Output Files

- `<retro-file>.followup.yaml` — Sibling file to source retro

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

### Workflow Routing Values

| Value | Use Case |
|-------|----------|
| `bmad:bmm:workflows:research` | Spikes, investigations, documentation research |
| `bmad:bmm:workflows:quick-dev` | Code changes, template edits, simple implementations |
| `bmad:bmm:workflows:create-tech-spec` | Items needing detailed technical design |
| `bmad:bmm:workflows:create-story` | Items that should become backlog stories |
| `bmad:bmm:workflows:sprint-planning` | Sprint status updates |
| `bash` | Direct CLI commands (e.g., `gh issue create`) |
| `human` | Requires manual human action, cannot be automated |

---

## Agent Integration

### Primary Agent

None — workflow-only module. AI analysis is embedded in workflow logic.

### Other Agents

Routed workflows may use their own agents (dev, analyst, etc.)

---

## Supported Input Formats

### Format A: Simple Table

```markdown
## Action Items

| # | Action | Owner | Priority | Status |
|---|--------|-------|----------|--------|
| 1 | Create GitHub issue for X | Node | Medium | Open |
```

### Format B: Detailed Specifications

```markdown
## Action Items

| # | Action | Owner | Deadline | Success Criteria |
|---|--------|-------|----------|------------------|
| 1 | Implement feature X | Node | Before env-2 | Tests pass |

### #1: Feature X Spec

Command to execute:
/bmad:bmm:workflows:quick-dev
...
```

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

## Implementation Notes

**Use the workflow-builder workflow to build this workflow.**

Reference design document: `_bmad-output/planning-artifacts/bmm-retrospective-module/2026-01-29-retro-followup-design.md`

---

_Spec created on 2026-01-29 via BMAD Module workflow_
