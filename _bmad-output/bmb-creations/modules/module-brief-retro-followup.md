# Module Brief: retro-followup

**Date:** 2026-01-29
**Author:** Node
**Module Code:** `bmm` (extension)
**Module Type:** Extension
**Status:** Ready for Development

---

## Executive Summary

Retrospectives actually lead to action — the gap between "we should do X" and "X is done" disappears. One command transforms retro action items into orchestrated, executable work.

**Module Category:** Process Automation / Workflow Orchestration
**Target Users:** BMAD practitioners, solo devs using BMM
**Complexity Level:** Low (2 workflows, no agents)

---

## Module Identity

### Module Code & Name

- **Code:** `bmm` (inherited from base module)
- **Name:** `Retro Followup`
- **Folder:** `bmm-workflow-retro-followup`

### Core Concept

A bridge between human retrospective reflection and automated execution. Parses retrospective action items, uses AI to route each item to the appropriate BMM workflow, and generates a machine-parseable YAML file for orchestrated execution.

### Personality Theme

None — lean utility module. Consistency with BMM is the primary goal. Delight comes from results, not whimsy.

---

## Module Type

**Type:** Extension (extends BMM)

This module extends the BMM (BMAD Method Module) rather than standing alone because:

- Retrospectives are part of the BMM methodology lifecycle
- The workflow routes to existing BMM workflows (`quick-dev`, `research`, etc.)
- It shares the BMM namespace and integrates seamlessly with BMM practitioners' existing workflow
- Designed to be portable/installable across projects that have BMM

---

## Unique Value Proposition

**What makes this module special:**

> For BMAD practitioners, Retro Followup provides automated action item routing and execution unlike manual tracking and context-switching because it transforms retrospective insights into orchestrated BMAD workflows with a single command.

**Why users would choose this module:**

| Alternative | Why Retro Followup is better |
|-------------|------------------------------|
| Manual tracking | Tedious, context lost, items forgotten |
| Generic task tools | No BMAD integration, no intelligent routing |
| Nothing (skip followup) | Retros become theater — insights without action |

---

## User Scenarios

### Target Users

| Attribute | Value |
|-----------|-------|
| **Primary user** | BMAD practitioner / Solo dev using BMM |
| **Context** | Just completed a retrospective, has action items to execute |
| **Skill level** | Familiar with BMAD workflows |
| **Pain point** | Action items pile up; manual routing is tedious |
| **Goal** | Turn retro insights into automated follow-through |

### Primary Use Case

After completing `/bmad-bmm-retrospective`, user runs `/bmad-bmm-retro-followup` to transform action items into an executable plan.

### User Journey

1. **Trigger:** User finishes `/bmad-bmm-retrospective` — action items in markdown
2. **Invoke:** User runs `/bmad-bmm-retro-followup <retro-file-path>`
3. **Process:** Workflow parses retro, AI routes each open item
4. **Output:** `<retro-file>.followup.yaml` generated
5. **Execute:** User runs `/bmad-bmm-retro-item-execute <yaml-file> [item-id]` to execute items
6. **Outcome:** Action items get done, status updates in YAML

---

## Agent Architecture

### Agent Count Strategy

**None** — this is a workflow-only module.

The workflows handle parsing and routing procedurally. The "intelligence" is in the AI analysis within the workflow logic, not in agent personas. Routed workflows use existing BMM agents (dev, analyst, etc.) for execution.

### Agent Roster

N/A — no agents in this module.

### Agent Interaction Model

N/A — workflows invoke existing BMM workflows which may use BMM agents.

### Agent Communication Style

N/A — inherits BMM communication patterns through routed workflows.

---

## Workflow Ecosystem

### Core Workflows (Essential)

| Workflow | Invocation | Purpose |
|----------|------------|---------|
| `retro-followup` | `/bmad-bmm-retro-followup <retro-file-path>` | Parse retrospective → AI-route action items → generate YAML |
| `retro-item-execute` | `/bmad-bmm-retro-item-execute <yaml-file> [item-id]` | Execute a single item → invoke routed workflow → user confirms done |

#### retro-followup

- **Input:** Retrospective markdown file with action items table
- **Process:** Parse retro → filter open items → AI analyze & route each → generate YAML
- **Output:** `<retro-file>.followup.yaml` (sibling file to source)
- **Behavior:** Autonomous

#### retro-item-execute

- **Input:** Followup YAML + optional item ID (or "next pending")
- **Process:** Load item → invoke routed workflow with summary as context → user confirms completion
- **Output:** Updated YAML (status: `done` only on success) + routed workflow output
- **Behavior:** Human confirms completion

**V1 Philosophy:** Simple, observable, learnable. Gather data on usage patterns, then automate where safe in V2.

### Feature Workflows (Specialized)

None — the two core workflows cover all functionality.

### Utility Workflows (Support)

None.

---

## Tools & Integrations

### MCP Tools

None — file I/O is native, no external connectors needed.

### External Services

None — no APIs, cloud services, or third-party tools required.

### Integrations with Other Modules

**BMM (BMAD Method Module):**

- Routes action items to any valid BMM workflow
- Special values: `bash` (direct CLI commands), `human` (manual action required)
- The `workflow` field is open-ended — AI determines the best-fit workflow for each action item

---

## Creative Features

### Personality & Theming

None — lean utility module. Consistency with BMM is the primary goal.

### Easter Eggs & Delighters

None for V1. Delight comes from the results (action items that actually get done), not from whimsy in the workflow.

### Module Lore

None — it's a tool, not a character.

---

## Reference Design

Source document: `_bmad-output/planning-artifacts/bmm-retrospective-module/2026-01-29-retro-followup-design.md`

This brief was created from an existing design document that includes:

- YAML schema for followup files
- Workflow routing values and status values
- Supported retrospective formats
- Edge case handling
- Keystone integration notes (future scope)

---

## Next Steps

1. **Review this brief** — Ensure the vision is clear
2. **Run module workflow (Create mode)** — Build the module structure
3. **Create workflows** — Use workflow-builder for `retro-followup` and `retro-item-execute`
4. **Test module** — Install and verify functionality
5. **Gather data** — Track usage patterns for V2 automation decisions

---

_Brief created on 2026-01-29 by Node using the BMAD Module workflow_
