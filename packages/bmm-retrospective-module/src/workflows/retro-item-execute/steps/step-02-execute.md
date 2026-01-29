---
name: 'step-02-execute'
description: 'Execute action item by routing to appropriate workflow, bash, or human task'

nextStepFile: './step-03-confirm.md'
---

# Step 2: Execute Action Item

## STEP GOAL:

Route and execute the selected action item based on its workflow type (BMAD workflow, bash command, or human task).

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER modify YAML status in this step — that's step 3
- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step, ensure entire file is read
- 📋 YOU ARE A TASK EXECUTOR — route and execute

### Role Reinforcement:

- ✅ You are an orchestrator routing action items
- ✅ Be brief and action-oriented
- ✅ Execute the action, then move on
- ✅ Handle unknown types gracefully

### Step-Specific Rules:

- 🎯 Focus ONLY on executing the action based on its type
- 🚫 FORBIDDEN to update YAML status — that's step 3
- 🚫 FORBIDDEN to ask unnecessary questions — execute the action
- 💬 Report what you're doing, then do it

## EXECUTION PROTOCOLS:

- 🎯 Read item's workflow field from context
- 💾 Route to correct execution path
- 📖 Execute or display as appropriate
- 🚫 Auto-proceed to Confirm when done

## CONTEXT BOUNDARIES:

- Item details available from step 1 (id, workflow, summary, status)
- This step routes and executes — does not confirm
- Pass execution result context to step 3

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

### 1. Read Workflow Type

Read the item's `workflow` field and determine the execution path:

- Starts with `bmad:bmm:workflows:` → **BMAD Workflow**
- Equals `bash` → **Bash Command**
- Equals `human` → **Human Task**
- Anything else → **Unknown** (treat as human task)

### 2. Execute by Type

#### IF BMAD Workflow (`bmad:bmm:workflows:*`):

Extract the workflow name from the path (e.g., `bmad:bmm:workflows:quick-dev` → `quick-dev`).

```
Invoking workflow: {workflow-name}
Context: {item summary}
```

Invoke the workflow using the Skill tool, passing the item's summary as context.

After the invoked workflow completes, report:
```
Workflow {workflow-name} completed.
```

#### IF Bash (`bash`):

Display the command for the user to run:

```
Bash command to execute:

  {item summary / command}

Please run this command manually and return when done.
```

Wait for user to acknowledge they've run the command.

#### IF Human (`human`):

Display the manual action:

```
Manual action required:

  {item summary}

Complete this action and return when done.
```

Wait for user to acknowledge completion.

#### IF Unknown:

```
Unknown workflow type: {workflow}
Treating as manual action.

  {item summary}

Complete this action and return when done.
```

Wait for user to acknowledge.

### 3. Proceed to Confirm

Display: "**Proceeding to confirmation...**"

#### Menu Handling Logic:

- After execution completes (or user acknowledges for bash/human), immediately load, read entire file, then execute {nextStepFile}

#### EXECUTION RULES:

- This is an auto-proceed step after execution
- For BMAD workflows: proceed after workflow completes
- For bash/human: proceed after user acknowledges

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Workflow type correctly identified
- Correct execution path taken
- BMAD workflow invoked with summary context
- Bash command displayed clearly
- Human task displayed clearly
- Unknown types handled gracefully
- Proceeding to Confirm step

### ❌ SYSTEM FAILURE:

- Wrong routing based on workflow type
- Modifying YAML status in this step
- Not invoking BMAD workflows via Skill tool
- Failing silently on unknown types

**Master Rule:** Route correctly, execute cleanly, then proceed to confirmation.
