---
name: 'step-02-route'
description: 'Analyze each action item and assign appropriate workflow with enriched summary'
nextStepFile: './step-03-output.md'
routingData: '../data/workflow-routing.md'
---

# Step 2: Route Action Items

## STEP GOAL:

To analyze each open action item, determine the best-fit workflow for execution, and generate a clear, actionable summary with sufficient context for downstream orchestration.

## MANDATORY EXECUTION RULES (READ FIRST):

### Universal Rules:

- 📖 CRITICAL: Read the complete step file before taking any action
- 🔄 CRITICAL: When loading next step, ensure entire file is read
- 🎯 This is an autonomous step — execute without user interaction

### Role Reinforcement:

- ✅ You are a Workflow Router with knowledge of available BMM workflows
- ✅ Route based on evidence — action text, context, and linked specs
- ✅ When in doubt, prefer `bmad:bmm:workflows:quick-dev` as the safe default

### Step-Specific Rules:

- 🎯 Focus only on analyzing and routing action items
- 🚫 FORBIDDEN to modify or reinterpret action item text
- 🚫 FORBIDDEN to generate the YAML output — that is step 3
- 💬 Each item gets exactly one workflow assignment and one summary

## EXECUTION PROTOCOLS:

- 🎯 Follow the MANDATORY SEQUENCE exactly
- 💾 Hold routed items in working memory for next step
- 📖 Load routing reference data before analyzing items
- 🚫 FORBIDDEN to skip any action item

## CONTEXT BOUNDARIES:

- Available context: Open action items extracted in step 1, plus the full retrospective file
- Focus: Routing and summary generation only
- Limits: Do not execute any workflows — just assign them
- Dependencies: Parsed action items from step 1

## MANDATORY SEQUENCE

**CRITICAL:** Follow this sequence exactly. Do not skip, reorder, or improvise.

### 1. Load Routing Reference

Load {routingData} to understand available workflow options and their use cases.

"**Routing action items...**"

### 2. Analyze and Route Each Item

For each open action item, perform the following analysis:

**A. Check for Explicit Workflow Commands**

If the action item has a detailed specification section that includes an explicit workflow command (e.g., `/bmad:bmm:workflows:research`), use that workflow directly.

**B. Analyze Action Text and Context**

If no explicit command, analyze:

- **Action text keywords** — What is being asked? (create, implement, update, research, investigate, review)
- **Surrounding context** — What section of the retrospective does this relate to?
- **Nature of deliverable** — Is this code, documentation, research, a process change, or manual action?
- **Linked specifications** — Any detailed specs, commands, or success criteria provided?

**C. Assign Workflow**

Based on analysis, assign exactly one workflow:

| Workflow | Assign When |
|----------|-------------|
| `bmad:bmm:workflows:research` | Spikes, investigations, documentation research, "explore", "evaluate", "assess" |
| `bmad:bmm:workflows:quick-dev` | Code changes, template edits, config updates, simple implementations, "add", "update", "implement", "create" (code/file) |
| `bmad:bmm:workflows:create-tech-spec` | Items needing detailed technical design before implementation |
| `bmad:bmm:workflows:create-story` | Items that should become backlog stories for future epics |
| `bmad:bmm:workflows:sprint-planning` | Sprint status updates, tracking changes |
| `bash` | Direct CLI commands (e.g., `gh issue create`, `npm install`) |
| `human` | Requires manual human action that cannot be automated |

**D. Generate Summary**

Write a clear, actionable summary that provides sufficient context for execution:

- Include WHAT needs to be done
- Include WHERE (file paths, locations) if known from the retro
- Include WHY (the context or motivation from the retrospective)
- Include SUCCESS CRITERIA if specified in the retro
- Keep it concise but self-contained — the summary must make sense without reading the original retro

### 3. Handle Ambiguous Items

If an action item is vague or could match multiple workflows:

- Use surrounding retrospective context to disambiguate
- Default to `bmad:bmm:workflows:quick-dev` if still unclear
- Include a note in the summary: "Note: Routing inferred from context — verify workflow selection"

### 4. Report Routing Decisions

"**Routing complete:**

| # | Action (truncated) | Workflow | Summary Preview |
|---|-------------------|----------|-----------------|
{For each item: | {action_item} | {action text ~40 chars} | {workflow} | {summary ~40 chars} |}

**Proceeding to generate YAML output...**"

### 5. Present MENU OPTIONS

Display: "**Proceeding to generate output file...**"

#### Menu Handling Logic:

- After routing is complete, immediately load, read entire file, then execute {nextStepFile}

#### EXECUTION RULES:

- This is an auto-proceed step with no user choices
- Proceed directly to next step after routing report

## CRITICAL STEP COMPLETION NOTE

ONLY WHEN all action items have been analyzed, routed, and the routing report has been displayed will you load and read fully `{nextStepFile}` to execute output generation.

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Routing data loaded and referenced
- Every open action item analyzed individually
- Each item assigned exactly one workflow
- Each item has a clear, self-contained summary
- Explicit workflow commands in specs honored
- Ambiguous items handled with default and note
- Routing report displayed
- Proceeding to step 3 with routed items

### ❌ SYSTEM FAILURE:

- Skipping any action item
- Assigning multiple workflows to one item
- Generating vague summaries without context
- Ignoring explicit workflow commands in specs
- Not loading routing reference data
- Writing YAML output (step 3's job)

**Master Rule:** Route every item. Enrich every summary. Skip nothing.
