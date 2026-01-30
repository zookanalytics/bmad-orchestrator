---
name: 'step-03-confirm'
description: 'Confirm item completion and update followup YAML status'
---

# Step 3: Confirm and Update

## STEP GOAL:

Confirm whether the action item was completed, then update its status in the followup YAML file.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 🛑 NEVER update YAML without user confirmation
- 📖 CRITICAL: Read the complete step file before taking any action
- 📋 YOU ARE A TASK EXECUTOR — confirm and update

### Role Reinforcement:

- ✅ You are an orchestrator finalizing action items
- ✅ Be brief and action-oriented
- ✅ Only update YAML after explicit user response
- ✅ Report final status clearly

### Step-Specific Rules:

- 🎯 Focus ONLY on confirmation and YAML update
- 🚫 FORBIDDEN to re-execute the action
- 🚫 FORBIDDEN to update YAML before user responds
- 💬 Write YAML atomically after confirmation

## EXECUTION PROTOCOLS:

- 🎯 Present confirmation prompt
- 💾 Update YAML based on user response
- 📖 Report final status
- 🚫 This is the final step — no next step

## CONTEXT BOUNDARIES:

- Item details available from step 1 (id, workflow, summary)
- Execution completed in step 2
- YAML file path available from step 1
- This is the FINAL step — workflow ends here

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

### 1. Present Confirmation

```
Was this item completed successfully?

  [Y] Yes — mark as done
  [N] No — keep as pending
  [S] Skip — mark as skipped
```

#### EXECUTION RULES:

- ALWAYS halt and wait for user input
- Only update YAML after user responds

#### Menu Handling Logic:

- IF Y: Set item `status: done`, proceed to Update YAML (section 2)
- IF N: Leave item `status: pending`, proceed to Update YAML (section 2)
- IF S: Set item `status: skipped`, proceed to Update YAML (section 2)
- IF Any other: Help user respond, then redisplay confirmation

### 2. Update YAML

**If Y (done) or S (skipped):**

Load the followup YAML file, update the selected item's status field, and write the file back.

```
Updated item #{id}: status → {done|skipped}
```

**If N (pending):**

No YAML update needed.

```
Item #{id} remains pending. Re-run to retry.
```

### 3. Report Completion

Display final summary:

```
Workflow complete.

  Item: #{id}
  Action: {summary (truncated)}
  Status: {done|pending|skipped}
```

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- User explicitly confirmed status
- YAML updated atomically (only if status changed)
- Final status reported clearly
- Workflow exits cleanly

### ❌ SYSTEM FAILURE:

- Updating YAML without user confirmation
- Writing partial/corrupt YAML
- Not reporting final status
- Attempting to continue after final step

**Master Rule:** Only update YAML after explicit user confirmation. Atomic writes only.
