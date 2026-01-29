# Workflow Specification: retro-item-execute

**Module:** bmm (extension)
**Status:** Placeholder — To be created via workflow-builder workflow
**Created:** 2026-01-29

---

## Workflow Overview

**Goal:** Execute a single action item from a followup YAML file by invoking the routed workflow.

**Description:** Load a followup YAML, select an item (by ID or next pending), invoke the assigned workflow with the summary as context, and update the item status upon user confirmation.

**Workflow Type:** Non-document (executes other workflows, updates existing YAML)

---

## Workflow Structure

### Entry Point

```yaml
---
name: retro-item-execute
description: Execute a single retro action item via its routed workflow
web_bundle: true
installed_path: '{project-root}/_bmad/bmm/workflows/retro-item-execute'
---
```

### Mode

- [x] Create-only (no steps-c/ folder, just steps/)
- [ ] Tri-modal (steps-c/, steps-e/, steps-v/)

---

## Planned Steps

| Step | Name | Goal |
|------|------|------|
| 1 | Load | Load followup YAML, select item (by ID or next pending) |
| 2 | Execute | Invoke routed workflow with summary as context |
| 3 | Confirm | User confirms completion, update status in YAML |

---

## Workflow Inputs

### Required Inputs

- `yaml-file` — Path to the `.followup.yaml` file

### Optional Inputs

- `item-id` — Specific item ID to execute (defaults to next pending item)

---

## Workflow Outputs

### Output Format

- [ ] Document-producing
- [x] Non-document

### Output Files

- Updates existing `<file>.followup.yaml` — Sets `status: done` on completed item
- Also outputs whatever the routed workflow produces

---

## Execution Logic

### Item Selection

1. If `item-id` provided → execute that specific item
2. If no `item-id` → find first item with `status: pending`
3. If no pending items → report "All items complete" and exit

### Workflow Invocation

For each item type:

| Workflow Value | Action |
|----------------|--------|
| `bmad:bmm:workflows:*` | Invoke the BMAD workflow with summary as input |
| `bash` | Display the bash command for user to run (or offer to run it) |
| `human` | Display the manual action required, wait for user confirmation |

### Status Update

- Only mark `status: done` when user explicitly confirms completion
- If workflow fails or user aborts → status remains `pending`
- User can optionally mark `status: skipped` if intentionally not executing

---

## Agent Integration

### Primary Agent

None — workflow-only module.

### Other Agents

Routed workflows (quick-dev, research, etc.) may use their own agents.

---

## User Interaction

### V1 Philosophy

Simple, observable, learnable:
- User must confirm each item completion
- No auto-marking as done
- Gather data on usage patterns for V2 automation

### Confirmation Flow

```
Item #2: Add validation to user input
Workflow: bmad:bmm:workflows:quick-dev
Summary: Add input validation to the signup form...

[Invoking quick-dev workflow...]

...workflow completes...

Was this item completed successfully? [Y/N/Skip]
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| YAML file doesn't exist | Error with clear message |
| Item ID not found | Error with available IDs listed |
| No pending items | Report completion status, exit gracefully |
| Routed workflow fails | Keep status as pending, report error |
| User skips item | Set status to `skipped` |

---

## Implementation Notes

**Use the workflow-builder workflow to build this workflow.**

Key considerations:
- Keep it simple for V1 — human confirms completion
- Status updates should be atomic (write YAML after confirmation)
- Consider source retro sync in future versions

---

_Spec created on 2026-01-29 via BMAD Module workflow_
