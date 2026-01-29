---
validationDate: 2026-01-29
workflowName: retro-followup
workflowPath: packages/bmm-retrospective-module/src/workflows/retro-followup
validationStatus: PASS
---

# Validation Report: retro-followup

**Validation Started:** 2026-01-29
**Validator:** BMAD Workflow Validation System
**Standards Version:** BMAD Workflow Standards

---

## File Structure & Size

### Folder Structure

```
retro-followup/
├── workflow.md              ✅ Present
├── retro-followup.spec.md   (source spec — not part of workflow)
├── steps/                   ✅ Present
│   ├── step-01-parse.md     ✅ Present
│   ├── step-02-route.md     ✅ Present
│   └── step-03-output.md    ✅ Present
└── data/                    ✅ Present
    └── workflow-routing.md  ✅ Present
```

**Structure Assessment:** ✅ PASS
- workflow.md exists
- Step files organized in `steps/` folder
- Data files organized in `data/` folder
- Sequential numbering (01, 02, 03) — no gaps
- All 3 design steps present

### File Sizes

| File | Lines | Status |
|------|-------|--------|
| workflow.md | 53 | ✅ Good |
| step-01-parse.md | 150 | ✅ Good |
| step-02-route.md | 159 | ✅ Good |
| step-03-output.md | 161 | ✅ Good |
| workflow-routing.md | 39 | ✅ Good |

**Size Assessment:** ✅ PASS — All files under 200-line recommended limit

### File Presence Verification

| Design Step | File Exists | Sequential |
|-------------|-------------|------------|
| step-01-parse | ✅ | ✅ |
| step-02-route | ✅ | ✅ |
| step-03-output | ✅ | ✅ |

**Presence Assessment:** ✅ PASS — All design steps have corresponding files

**Section Status:** ✅ PASS

---

## Frontmatter Validation

| File | Variables | Used in Body | Forbidden Patterns | Status |
|------|-----------|-------------|-------------------|--------|
| step-01-parse.md | `nextStepFile` | ✅ 2 uses | None | ✅ PASS |
| step-02-route.md | `nextStepFile`, `routingData` | ✅ 3 uses | None | ✅ PASS |
| step-03-output.md | (none) | N/A (final) | None | ✅ PASS |

**Checks Performed:**
- Variable usage: All frontmatter variables referenced in step body ✅
- Path format: Relative paths used correctly (`./`, `../`) ✅
- Forbidden patterns: No `workflow_path`, `thisStepFile`, `workflowFile` ✅
- Required fields: `name` and `description` present in all files ✅

**Section Status:** ✅ PASS

## Critical Path Violations

### Config Variables (Exceptions)

From workflow.md Configuration Loading:
- `{project_name}`, `{output_folder}`, `{user_name}`, `{communication_language}`, `{document_output_language}`

### Content Path Violations

No hardcoded `{project-root}/` paths found in step body content. ✅

### Dead Links

| Reference | From File | Target | Exists |
|-----------|-----------|--------|--------|
| `nextStepFile` | step-01-parse.md | `./step-02-route.md` | ✅ |
| `nextStepFile` | step-02-route.md | `./step-03-output.md` | ✅ |
| `routingData` | step-02-route.md | `../data/workflow-routing.md` | ✅ |

No dead links found. ✅

### Module Awareness

This workflow is in the BMM module (`packages/bmm-retrospective-module/`).
No BMB-specific path assumptions found. ✅

### Summary

- **CRITICAL:** 0 violations
- **HIGH:** 0 violations
- **MEDIUM:** 0 violations

**Section Status:** ✅ PASS — No violations

## Menu Handling Validation

| File | Menu Type | Handler | Execution Rules | A/P | Status |
|------|-----------|---------|----------------|-----|--------|
| step-01-parse.md | Auto-proceed | ✅ Present | ✅ Present | None (correct for init) | ✅ PASS |
| step-02-route.md | Auto-proceed | ✅ Present | ✅ Present | None (correct for autonomous) | ✅ PASS |
| step-03-output.md | No menu (final) | N/A | N/A | N/A | ✅ PASS |

**Notes:**
- All steps use auto-proceed — appropriate for a fully autonomous workflow
- No A/P menus — correct since there are no collaborative content creation points
- Step-01 correctly omits A/P (init step)
- Step-03 correctly has no menu (final step)

**Section Status:** ✅ PASS

## Step Type Validation

| File | Expected Type | Actual Type | Pattern Match | Status |
|------|--------------|-------------|---------------|--------|
| step-01-parse.md | Init (Non-Continuable) | Init (Non-Continuable) | ✅ Auto-proceed, no continuation | ✅ PASS |
| step-02-route.md | Middle (Simple) | Middle (Simple) | ✅ Auto-proceed, no A/P | ✅ PASS |
| step-03-output.md | Final | Final | ✅ No nextStepFile, completion msg | ✅ PASS |

**Checks:**
- All steps have STEP GOAL section ✅
- All steps have MANDATORY EXECUTION RULES ✅
- All steps have Role Reinforcement ✅
- All steps have Step-Specific Rules ✅
- All steps have EXECUTION PROTOCOLS ✅
- All steps have CONTEXT BOUNDARIES ✅
- All steps have MANDATORY SEQUENCE ✅
- All steps have SUCCESS/FAILURE METRICS ✅

**Section Status:** ✅ PASS

---

## Output Format Validation

**Workflow produces:** `.followup.yaml` (YAML file)
**Template type:** Strict schema (programmatic generation)
**Template file needed:** No — YAML is generated in step-03, not from a template

**Schema validation:**
- `source` field ✅
- `generated` field ✅
- `items` array with `id`, `action_item`, `workflow`, `status`, `summary` ✅
- Block scalar (`|`) for summary ✅
- Empty items array handled ✅

**Section Status:** ✅ PASS

---

## Validation Design Check

**Design alignment:**
- 3 steps specified in design → 3 steps built ✅
- Linear flow → No branching logic ✅
- Single-session → No continuation ✅
- Create-only → `steps/` folder (not steps-c/) ✅
- File I/O only tool → Reads file, writes file ✅
- Autonomous → Auto-proceed menus ✅

**Section Status:** ✅ PASS

---

## Instruction Style Check

**Specified:** Prescriptive
**Implemented:** Prescriptive throughout

| File | Style | Prescriptive Elements | Status |
|------|-------|----------------------|--------|
| step-01-parse.md | Prescriptive | Exact validation, extraction, filtering steps | ✅ |
| step-02-route.md | Prescriptive | Routing table, analysis algorithm, assignment rules | ✅ |
| step-03-output.md | Prescriptive | Exact YAML schema, field-by-field generation | ✅ |

**Section Status:** ✅ PASS

---

## Collaborative Experience Check

**N/A** — This is a fully autonomous workflow with no user interaction during execution. Collaborative experience is not applicable.

**Section Status:** ✅ PASS (N/A)

---

## Subprocess Optimization Opportunities

**Design decision:** No subprocess optimization needed (confirmed during design phase).

**Rationale:** Single file input, typically 5-15 action items, sequential processing. Overhead of subprocesses would exceed benefit.

**Section Status:** ✅ PASS (N/A)

---

## Cohesive Review

**Overall workflow coherence:**
- **Step-to-step data flow:** Parse extracts items → Route assigns workflows → Output writes YAML ✅
- **Consistent role:** Retrospective Analyst across all steps ✅
- **Consistent tone:** Minimal status messages, autonomous execution ✅
- **Edge case coverage:** Consistent handling across steps (no items, all done, ambiguous) ✅
- **Error handling:** File not found, no items, all done — all covered ✅

**Section Status:** ✅ PASS

---

## Plan Quality Validation

**Plan completeness:**
- Discovery/Conversion analysis ✅
- Classification (4 decisions) ✅
- Requirements (flow, interaction, I/O, success criteria) ✅
- Tools configuration ✅
- Design (steps, data flow, file structure) ✅
- Foundation build record ✅
- Step build records (01, 02, 03) ✅
- Confirmation/coverage report ✅

**Section Status:** ✅ PASS

---

## Summary

| Validation Area | Status |
|----------------|--------|
| File Structure & Size | ✅ PASS |
| Frontmatter Validation | ✅ PASS |
| Critical Path Violations | ✅ PASS |
| Menu Handling | ✅ PASS |
| Step Type Validation | ✅ PASS |
| Output Format | ✅ PASS |
| Design Alignment | ✅ PASS |
| Instruction Style | ✅ PASS |
| Collaborative Experience | ✅ PASS (N/A) |
| Subprocess Optimization | ✅ PASS (N/A) |
| Cohesive Review | ✅ PASS |
| Plan Quality | ✅ PASS |

**Overall Validation Status: ✅ PASS — All checks passed. Workflow is BMAD compliant.**
