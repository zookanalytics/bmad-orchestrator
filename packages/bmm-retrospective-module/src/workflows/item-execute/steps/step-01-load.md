---
name: 'step-01-load'
description: 'Load followup YAML file and select item to execute'

nextStepFile: './step-02-execute.md'
---

# Step 1: Load Action Item

## STEP GOAL:

Load a followup YAML file, select an action item (by ID or next pending), and prepare for execution.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER proceed without a valid YAML file
- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step, ensure entire file is read
- 📋 YOU ARE A TASK EXECUTOR, not a conversationalist

### Role Reinforcement:

- ✅ You are an orchestrator loading action items
- ✅ Be brief and action-oriented
- ✅ Minimal commentary — status updates only
- ✅ Handle errors gracefully with clear messages

### Step-Specific Rules:

- 🎯 Focus ONLY on loading YAML and selecting item
- 🚫 FORBIDDEN to execute the item yet — that's step 2
- 💬 Report what you find, then proceed
- ⚠️ Exit gracefully if no valid item found

## EXECUTION PROTOCOLS:

- 🎯 Get YAML path from user or command context
- 💾 Parse YAML and extract items array
- 📖 Select item by ID or find first pending
- 🚫 FORBIDDEN to modify YAML in this step

## CONTEXT BOUNDARIES:

- User provides: yaml-file path, optional item-id
- YAML structure: array of items with id, workflow, summary, status fields
- This is step 1 — sets up context for Execute step
- No prior workflow state to consider

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

### 1. Get YAML File Path

Check if YAML path was provided in command invocation or conversation context.

**If path provided:**
- Use the provided path

**If no path provided:**
- Ask: "Please provide the path to the `.followup.yaml` file:"
- Wait for user response

### 2. Load and Parse YAML

Load the YAML file at the specified path.

**If file not found:**
```
Error: File not found: {path}
Please check the path and try again.
```
→ Exit workflow

**If YAML parse error:**
```
Error: Invalid YAML format in {path}
{error details}
```
→ Exit workflow

**If successful:**
- Extract items array from YAML
- Report: "Loaded: {filename} ({count} items)"

### 3. Select Item

**If item-id was provided:**
- Find item with matching id
- If not found:
  ```
  Error: Item #{id} not found.
  Available items: {list of IDs}
  ```
  → Exit workflow

**If no item-id provided:**
- Find first item with `status: pending`
- If no pending items:
  ```
  All items complete! No pending actions remaining.
  ```
  → Exit workflow gracefully (success, not error)

### 4. Display Selected Item

Present the selected item clearly:

```
Executing item #{id}:

  Workflow: {workflow}
  Summary: {summary}
  Status: {status}
```

### 5. Proceed to Execute

Display: "**Proceeding to execute...**"

#### Menu Handling Logic:

- After item is selected and displayed, immediately load, read entire file, then execute {nextStepFile}

#### EXECUTION RULES:

- This is an auto-proceed step with no user menu
- Proceed directly to Execute after item is loaded
- Pass item context (id, workflow, summary) to next step

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- YAML file loaded and parsed
- Item selected (by ID or next pending)
- Item details displayed clearly
- Proceeding to Execute step with item context

### ❌ SYSTEM FAILURE:

- Proceeding without valid YAML
- Ignoring file errors
- Not handling "no pending items" case
- Attempting to execute item in this step

**Master Rule:** This step ONLY loads and selects. Execution happens in step 2.
