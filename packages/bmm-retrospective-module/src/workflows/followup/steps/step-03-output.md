---
name: 'step-03-output'
description: 'Generate followup YAML file and report results'
---

# Step 3: Generate Output

## STEP GOAL:

To write the structured `.followup.yaml` file as a sibling to the source retrospective and report completion results to the user.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 📖 CRITICAL: Read the complete step file before taking any action
- 🎯 This is an autonomous step — execute without user interaction
- 🎯 This is the FINAL step — no next step to load

### Role Reinforcement:

- ✅ You are an Output Generator producing machine-parseable YAML
- ✅ Output must be valid YAML — no syntax errors
- ✅ Follow the schema exactly — no extra fields, no missing fields

### Step-Specific Rules:

- 🎯 Focus only on generating the YAML file and reporting results
- 🚫 FORBIDDEN to re-analyze or re-route items — use routing from step 2 as-is
- 🚫 FORBIDDEN to modify summaries or workflow assignments
- 💬 Write the file, then report what was created

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Write YAML file to disk as sibling to source retro
- 📖 Report completion to user
- 🚫 FORBIDDEN to add fields not in the schema

## CONTEXT BOUNDARIES:

- Available context: Routed action items from step 2, source retro file path
- Focus: File generation and reporting only
- Limits: Do not modify routing decisions — output them as received
- Dependencies: Routed items from step 2

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

### 1. Determine Output File Path

Derive the output path from the source retro file path:

- Strip the `.md` extension from the source file
- Append `.followup.yaml`
- Output goes in the same directory as the source retro

**Example:**
`_bmad-output/implementation-artifacts/epic-1-retro-2026-01-19.md`
→ `_bmad-output/implementation-artifacts/epic-1-retro-2026-01-19.followup.yaml`

"**Writing followup YAML:** `{output-path}`..."

### 2. Build YAML Content

Generate valid YAML following this exact schema:

```yaml
source: {retro-file-path}
generated: {current ISO date YYYY-MM-DD}

items:
  - id: 1
    action_item: {original item number from retro}
    workflow: {assigned workflow from step 2}
    status: pending
    summary: |
      {enriched summary from step 2}

  - id: 2
    action_item: {original item number}
    workflow: {assigned workflow}
    status: pending
    summary: |
      {enriched summary}
```

**Schema rules:**
- `source` — Relative path to the source retrospective file
- `generated` — ISO date (YYYY-MM-DD) when this file was generated
- `items` — Array of action items, sequential `id` starting at 1
- Each item has exactly: `id`, `action_item`, `workflow`, `status`, `summary`
- All items initialized with `status: pending`
- `summary` uses YAML block scalar (`|`) for multi-line text

### 3. Handle Empty Items

If no open action items were found (empty list from step 1/2):

```yaml
source: {retro-file-path}
generated: {current ISO date}

items: []
```

Include a note to the user: "No open action items found — generated empty followup file."

### 4. Write File to Disk

Write the YAML content to the determined output path.

### 5. Report Completion

"**Followup YAML generated successfully.**

**Output:** `{output-path}`

**Summary:**
- **Source:** `{retro-file-path}`
- **Items processed:** {count}
- **Workflow breakdown:**
{For each unique workflow, display: - {workflow}: {count} items}

**Status:** All items set to `pending`.

**Next:** Use Keystone CLI or manually execute each item's workflow to process the followup."

### 6. Workflow Complete

This is the final step. The workflow is now complete.

No further steps to load.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Output file path correctly derived as sibling to source
- Valid YAML generated with correct schema
- All routed items included with sequential IDs
- All items have `status: pending`
- Summaries use block scalar format
- Empty items array handled correctly
- File written to disk
- Completion report displayed to user

### ❌ SYSTEM FAILURE:

- Invalid YAML syntax
- Missing schema fields (id, action_item, workflow, status, summary)
- Extra fields not in schema
- Wrong output file path or name
- Modifying routing decisions from step 2
- Not writing file to disk
- Missing completion report

**Master Rule:** Valid YAML. Exact schema. Write the file. Report results.
