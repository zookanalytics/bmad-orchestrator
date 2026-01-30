---
name: 'step-01-parse'
description: 'Load retrospective file and extract open action items'
nextStepFile: './step-02-route.md'
---

# Step 1: Parse Retrospective

## STEP GOAL:

To load the retrospective markdown file, detect its format, and extract all open action items with their metadata for routing in the next step.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step, ensure entire file is read
- 🎯 This is an autonomous step — execute without user interaction

### Role Reinforcement:

- ✅ You are a Retrospective Analyst parsing action item data
- ✅ Parse accurately — do not invent or embellish action items
- ✅ Preserve the original text and intent of each action item

### Step-Specific Rules:

- 🎯 Focus only on parsing and extracting action items
- 🚫 FORBIDDEN to analyze, route, or assign workflows — that is step 2
- 🚫 FORBIDDEN to generate output YAML — that is step 3
- 💬 Report what was found before proceeding

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Hold extracted items in working memory for next step
- 📖 Report extraction results to user
- 🚫 FORBIDDEN to skip validation or edge case handling

## CONTEXT BOUNDARIES:

- Available context: `retro-file-path` provided by user at workflow invocation
- Focus: Parsing and extraction only
- Limits: Do not interpret or route items — just extract them
- Dependencies: None — this is the first step

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

### 1. Validate Input File

Confirm the `retro-file-path` argument was provided and the file exists.

**If file not found:**
"**Error:** File not found: `{retro-file-path}`. Please provide a valid path to a retrospective markdown file."
→ Stop workflow.

### 2. Load Retrospective File

Load and read the entire retrospective markdown file.

"**Parsing retrospective file:** `{retro-file-path}`..."

### 3. Detect Format and Extract Action Items

Scan the file for action items. Do NOT assume a fixed table format — analyze the actual content:

- Look for tables containing action items (any column layout with actions and statuses)
- Look for numbered action item lists
- Look for sections titled "Action Items" or similar
- Extract from whatever format is present

For each action item found, capture:
- **Number:** The original item number/ID
- **Action:** The action text
- **Status:** Open, Done, In Progress, etc.
- **Additional context:** Any linked specifications, commands, or detailed descriptions below the table

### 4. Filter to Open Items

From all extracted items, keep only those with "Open" status (or equivalent: "Pending", "Not Started", "TODO").

Items with "Done", "Complete", "Closed", or similar status are excluded.

### 5. Handle Edge Cases

**No action items found in file:**
"**Note:** No action items table found in retrospective. Generating empty followup YAML."
→ Proceed to step 3 with empty items list.

**All items already done:**
"**Note:** All action items are already completed. Generating empty followup YAML."
→ Proceed to step 3 with empty items list.

### 6. Report Extraction Results

"**Extraction complete:**
- **Total action items found:** {count}
- **Open items to process:** {open_count}
- **Skipped (already done):** {done_count}

**Open items:**
{For each open item, display: #{number} — {action text (truncated to ~80 chars)}}

**Proceeding to routing...**"

### 7. Present MENU OPTIONS

Display: "**Proceeding to route action items...**"

#### Menu Handling Logic:

- After extraction is complete, immediately load, read entire file, then execute {nextStepFile}

#### EXECUTION RULES:

- This is an auto-proceed step with no user choices
- Proceed directly to next step after extraction report

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN all action items have been extracted and the extraction report has been displayed will you load and read fully `{nextStepFile}` to execute routing.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Retro file loaded and read completely
- Format detected correctly regardless of table layout
- All action items extracted with metadata
- Filtered to open items only
- Edge cases handled (no items, all done)
- Extraction report displayed
- Proceeding to step 2 with items data

### ❌ SYSTEM FAILURE:

- Not reading the full retro file
- Assuming a specific table format instead of analyzing content
- Missing action items during extraction
- Not filtering by status
- Not handling edge cases
- Inventing or modifying action item text
- Attempting to route items (step 2's job)

**Master Rule:** Parse accurately. Extract everything. Modify nothing. Pass forward.
