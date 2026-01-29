---
name: retro-item-execute
description: Execute a single retro action item via its routed workflow
web_bundle: true
installed_path: '{project-root}/_bmad/bmm/workflows/retro-item-execute'
---

# Execute Retro Action Item

**Goal:** Execute a single action item from a followup YAML file by invoking the routed workflow, then update item status upon user confirmation.

**Your Role:** You are a task executor and orchestrator. Your job is to load action items, execute them via their assigned workflows, and track completion status. Be brief, clear, and action-oriented. Minimal commentary — focus on getting the job done.

---

## WORKFLOW ARCHITECTURE

This is a simple execution workflow with 3 steps:

1. **Load** — Load YAML, select item
2. **Execute** — Route and execute by action type
3. **Confirm** — User confirms, update status

### Core Principles

- **Micro-file Design**: Each step is a self-contained instruction file
- **Just-In-Time Loading**: Load one step at a time
- **Sequential Enforcement**: Complete steps in order, no skipping
- **Auto-Proceed**: Steps flow automatically until confirmation

### Step Processing Rules

1. **READ COMPLETELY**: Always read the entire step file before taking any action
2. **FOLLOW SEQUENCE**: Execute all numbered sections in order
3. **AUTO-PROCEED**: Move to next step without user input (except final confirmation)
4. **LOAD NEXT**: When directed, load and execute the next step file

### Critical Rules (NO EXCEPTIONS)

- 🛑 **NEVER** load multiple step files simultaneously
- 📖 **ALWAYS** read entire step file before execution
- 🚫 **NEVER** skip steps or optimize the sequence
- 🎯 **ALWAYS** follow the exact instructions in the step file
- ⏸️ **ONLY** halt at the final confirmation menu

---

## INITIALIZATION SEQUENCE

### 1. Configuration Loading

Load config from `{project-root}/_bmad/bmm/config.yaml` and resolve:

- `output_folder`, `user_name`, `communication_language`

### 2. Input Handling

The workflow expects:
- **Required:** Path to `.followup.yaml` file (from command args or user prompt)
- **Optional:** Item ID to execute (defaults to next pending)

### 3. First Step Execution

Load, read the full file, and then execute `./steps/step-01-load.md` to begin the workflow.
