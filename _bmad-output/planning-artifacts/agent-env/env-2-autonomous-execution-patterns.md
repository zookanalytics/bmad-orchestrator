# Autonomous AI Agent Execution Patterns from Epic env-1

**Date:** 2026-01-30
**Author:** Node
**Research Type:** Technical (Internal Codebase Analysis)
**Source:** Epic env-1 planning artifacts, implementation artifacts, and retrospective

---

## Executive Summary

Epic env-1 (Monorepo Setup & agent-env CLI Scaffold) achieved 100% autonomous execution: all 5 stories were implemented by AI agents without human intervention during execution. This document analyzes what made the planning artifacts comprehensive enough to enable this, extracting repeatable patterns for Epic env-2 and future epics.

The core insight is not that any single artifact was exceptional, but that **the artifacts formed a closed information system** — every question an AI agent might ask during implementation was already answered somewhere in the document chain. There were no dangling references, ambiguous scope boundaries, or unresolvable technical decisions.

---

## Table of Contents

1. [Artifact Chain Overview](#1-artifact-chain-overview)
2. [PRD Structure & Detail Level](#2-prd-structure--detail-level)
3. [Architecture Document Completeness](#3-architecture-document-completeness)
4. [Epic & Story Specification Patterns](#4-epic--story-specification-patterns)
5. [Acceptance Criteria Clarity](#5-acceptance-criteria-clarity)
6. [Dev Notes & Technical Context](#6-dev-notes--technical-context)
7. [Supporting Infrastructure](#7-supporting-infrastructure)
8. [What Caused Extra Review Cycles](#8-what-caused-extra-review-cycles)
9. [Repeatable Patterns for Epic env-2](#9-repeatable-patterns-for-epic-env-2)
10. [Anti-Patterns to Avoid](#10-anti-patterns-to-avoid)
11. [Conclusions](#11-conclusions)

---

## 1. Artifact Chain Overview

### Documents Produced Before Implementation

| Document | Size | Purpose | Key Contribution |
|----------|------|---------|-----------------|
| Product Brief | 19.2 KB | Vision, problem, users, scope | Establishes "why" and boundaries |
| PRD | 18.2 KB | 42 FRs, 21 NFRs, user journeys | Numbered requirements for traceability |
| Architecture | 40.5 KB | Tech stack, patterns, structure | Exact code patterns and file locations |
| Epics & Stories | 47.3 KB | 5 epics, 21 stories, FR mapping | Implementation-ready task breakdown |
| Test Design | 18.8 KB | Testing strategy and patterns | Coverage targets and test approaches |
| Implementation Readiness Report | ~20 KB | Validation of all artifacts | Confirmed 100% FR coverage before start |
| Project Context | ~8 KB | Critical rules for AI agents | Anti-patterns and "don't miss" rules |

**Total planning investment:** ~170 KB of structured documentation before a single line of implementation code was written.

### Information Flow

```
Product Brief → PRD → Architecture → Epics & Stories
                                          ↓
                              Implementation Readiness Report
                                          ↓
                                    Project Context
                                          ↓
                              Story Files (with Dev Notes)
                                          ↓
                               Autonomous Execution
```

Each downstream document explicitly references its upstream sources, creating a traceable chain. No document exists in isolation.

---

## 2. PRD Structure & Detail Level

### What Worked

**2.1. Numbered Requirements with Categories**

The PRD organized 42 functional requirements into 8 clear categories (Instance Lifecycle, Discovery & Status, Access, etc.), each with sequential FR numbers (FR1-FR42). This enabled:

- **Unambiguous traceability** — Every epic and story references specific FR numbers
- **Coverage validation** — The Implementation Readiness Report verified 42/42 FRs mapped (100%)
- **Scope boundaries** — AI agents could check "is this in scope?" against the FR list

**2.2. Concrete User Journeys**

Three detailed user journeys (Morning Standup Flow, External Repo Contribution, Safety Check Saves the Day) served as executable examples that grounded abstract requirements in real scenarios. Each journey included:

- Terminal output mockups (what the user actually sees)
- Decision points and their outcomes
- Edge cases naturally revealed through narrative

The journeys also included a **Journey Requirements Summary** table explicitly mapping capabilities to the journeys that revealed them — a critical pattern for AI agents that need to understand "why does this requirement exist?"

**2.3. Non-Negotiables Called Out Explicitly**

The PRD front-loaded three non-negotiables:
- Speed (< 5 seconds time-to-productive)
- Zero data loss (safety checks on ALL branches)
- External repos first-class (95%+ baseline success)

These appeared in the Executive Summary, not buried in NFRs. AI agents could use these as decision heuristics when facing trade-offs during implementation.

**2.4. Scope Boundaries Table**

An explicit "Scope Boundaries" table distinguished MVP from Post-MVP, preventing agents from over-building:

| In Scope (MVP) | Out of Scope (Future) |
|----------------|----------------------|
| Git state visibility | Agent execution status |
| TypeScript baseline | Multi-stack baselines |
| Baseline-only config | Repo-specific overrides |

This table was replicated in the epics document, reinforcing scope at every layer.

### Pattern: PRD Requirements Density

The PRD achieved a density of **~6.8 requirements per KB** (63 total requirements / ~18 KB content minus frontmatter). Requirements were concise single-line statements, not paragraphs. This high density meant agents could scan quickly while still having complete coverage.

---

## 3. Architecture Document Completeness

### What Worked

**3.1. Exact Versions and Configuration Blocks**

The architecture document specified exact package versions (Commander 14.0.2, Ink 6.6.0, React 19.x, Vitest 4.x, execa 9.x) and included copy-pastable configuration blocks:

- `package.json` with exact dependencies
- `tsconfig.json` with all compiler options
- `vitest.config.ts` with test configuration
- `pnpm-workspace.yaml` structure

AI agents could copy these configurations directly, eliminating version conflicts and configuration guessing.

**3.2. Complete Project Structure Diagram**

A 60+ line directory tree showed every file and its purpose:

```
packages/
├── shared/
│   └── src/
│       ├── index.ts              # Re-exports public API
│       ├── types.ts              # AppError, JsonOutput<T>
│       ├── errors.ts             # formatError()
│       └── subprocess.ts         # createExecutor()
```

Each file had a comment explaining its purpose. This meant agents never asked "where should this code go?" — the answer was in the structure diagram.

**3.3. Current State vs. Target State Documentation**

The architecture documented **what already exists** (the current orchestrator codebase) separately from **what needs to be created**. This "Existing Infrastructure" section prevented agents from accidentally recreating what was already there or breaking existing functionality.

**3.4. Implementation Pattern Examples with Code**

Every architectural pattern included working code examples:

- Subprocess execution with `reject: false`
- Atomic file writes with tmp+rename
- Error formatting with `formatError()`
- Hook state management with `useReducer`
- JSON output contract `{ ok, data, error }`

These weren't abstract descriptions — they were implementable code blocks that agents could follow as templates.

**3.5. FR-to-Structure Mapping**

A table explicitly mapped each FR category to the files responsible:

| FR Category | Files |
|-------------|-------|
| FR1-6: Lifecycle | `commands/create.ts`, `remove.ts` |
| FR7-11: Discovery | `lib/workspace.ts`, `lib/git.ts`, `commands/list.ts` |

This eliminated architectural ambiguity about "which module owns this requirement?"

### Pattern: Architecture Decision Density

At 40.5 KB, the architecture was the largest document. It contained:
- 15+ architectural decisions with rationale
- 8+ pattern categories with code examples
- 50+ files specified with locations
- Complete dependency graph

The key insight: **the architecture document was the agent's primary reference during implementation**, not the PRD. PRD says *what*; architecture says *how* and *where*.

---

## 4. Epic & Story Specification Patterns

### What Worked

**4.1. Sequential Story Dependencies Made Explicit**

Epic 1 stories were sequenced with explicit dependency documentation:

```
1.1 (workspace structure) → 1.2 (shared package) → 1.3 (migrate orchestrator)
→ 1.4 (agent-env scaffold) → 1.5 (CI update)
```

Each story's Dev Notes section began with a "Previous Story Context" block listing what prior stories created and a **CRITICAL** directive to verify prerequisites:

> **CRITICAL:** Stories 1.1 and 1.2 must be completed before starting this story. Verify:
> - `pnpm-workspace.yaml` exists
> - `packages/shared/` is fully implemented with tests passing

This prevented agents from starting work without the necessary foundation.

**4.2. Task Breakdown with Subtask Granularity**

Each story included 4-5 tasks, each with 3-6 subtasks. Example from Story 1.2:

```
- [ ] Task 1: Create shared package structure (AC: #1, #3)
  - [ ] 1.1 Create packages/shared/package.json
  - [ ] 1.2 Create packages/shared/tsconfig.json
  - [ ] 1.3 Create packages/shared/vitest.config.ts
  - [ ] 1.4 Create packages/shared/src/index.ts
```

Each task referenced the Acceptance Criteria it satisfies (`AC: #1, #3`). This bi-directional traceability meant agents could verify they'd addressed all ACs by checking their tasks.

**4.3. FR Mapping Per Epic**

Every epic included a line like:
> **FRs covered:** FR35, FR38, FR39, FR40, FR41, FR42

And the epics document included a complete FR Coverage Map table showing which FR maps to which Epic. This redundancy ensured traceability was visible at every level.

**4.4. "What This Story Does NOT Do" Sections**

Stories included explicit negative scope:

> ### What This Story Does NOT Do
> - **NO actual command implementations** — just placeholders
> - **NO Ink components** — just directory structure
> - **NO workspace/container management** — that's Epic 2

This prevented agents from over-building, which is a common AI agent failure mode (adding functionality that belongs to a future story).

### Pattern: Story Size Calibration

Epic 1 stories ranged from 3-5 tasks with clear boundaries. The largest story (1.3: Migrate Orchestrator) had 5 tasks with 22 subtasks and required 5 code review cycles. The smallest (1.5: Update CI) had 5 tasks but was mostly configuration changes with 1 review cycle. The sweet spot for autonomous execution appears to be stories that can be implemented in a single focused session with 3-5 distinct implementation activities.

---

## 5. Acceptance Criteria Clarity

### What Worked

**5.1. Given/When/Then BDD Format Exclusively**

Every acceptance criterion followed strict BDD format:

```gherkin
Given the existing flat repository structure
When I run `pnpm install` at the root
Then pnpm recognizes the workspace configuration
And the `packages/` directory exists
```

This format is unambiguous and directly testable. AI agents can convert each AC into a verification step without interpretation.

**5.2. Multiple ACs Per Story with Error Conditions**

Stories included both happy-path and error-path ACs:

- **Story 1.3 AC#4:** "Given I run `pnpm pack`... Then `bmad-orchestrator --help` works correctly"
- **Story 3.1:** Includes 9 ACs covering clean repo, dirty repo, stashed, unpushed, never-pushed, detached HEAD — every git edge case

Including error conditions in ACs prevented agents from implementing only the happy path.

**5.3. Concrete Command Examples in ACs**

ACs referenced specific commands and expected outputs:

```gherkin
Given the agent-env package is installed
When I run `agent-env --help`
Then I see usage information with available commands listed
```

The command is exact (`agent-env --help`), not abstract ("when the user requests help"). This precision eliminates interpretation errors.

### Pattern: AC-to-Test Conversion Rate

Every AC in Epic env-1 was directly convertible to a test case. The Implementation Readiness Report verified this with a formal acceptance criteria review. The conversion rate was 100% — no AC required "interpretation" to become a test.

---

## 6. Dev Notes & Technical Context

### What Worked

**6.1. Configuration Specifications as Code Blocks**

Each story's Dev Notes included the exact configuration files to create, as code blocks:

```json
// packages/shared/package.json
{
  "name": "@zookanalytics/shared",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  ...
}
```

Agents copied these directly, eliminating configuration guessing.

**6.2. "Critical Don't-Miss Rules" Sections**

Every story included a "Critical Don't-Miss Rules" section highlighting easy-to-forget gotchas:

1. **ESM imports require .js extension** (with correct/wrong examples)
2. **reject: false is mandatory for subprocess** (with correct/wrong examples)
3. **Bin entry point must use dist** (with exact code)
4. **Do NOT commit intermediate broken states**
5. **Preserve git history using `git mv`**

These rules addressed the specific failure modes of AI agents working autonomously (e.g., forgetting ESM extensions, not using `reject: false`).

**6.3. "Current State" and "Target State" Diagrams**

Stories that involved restructuring (1.1, 1.3) included both the current directory structure and the target directory structure as ASCII diagrams. This made the delta clear and prevented agents from misunderstanding what needed to change.

**6.4. Testing Requirements with Specific Test Cases**

Dev Notes listed specific test cases:

> **Test Cases for errors.ts:**
> - formatError returns colored output with error code and message
> - formatError includes suggestion when provided
> - formatError handles missing suggestion gracefully
> - createError creates AppError with all fields
> - createError omits undefined suggestion

This meant agents didn't need to invent test cases — they implemented the specified ones.

**6.5. References to Source Documents**

Every story ended with explicit references:

```
### References
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Package-Architecture]
- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-1.2]
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules]
```

These allowed agents to trace back to upstream decisions if they encountered ambiguity.

### Pattern: Dev Notes Density

Dev Notes sections were typically 40-60% of total story file size. Story 1.3 (Migrate Orchestrator) had the most extensive Dev Notes at roughly 350 lines, covering current state, target state, configuration specs, import updates, testing verification steps, and critical don't-miss rules. The investment in Dev Notes directly correlates with execution success: stories with denser Dev Notes required fewer review cycles.

---

## 7. Supporting Infrastructure

### What Worked

**7.1. Project Context File**

The `project-context.md` file served as a centralized "rules bible" for AI agents:

- Technology stack with version constraints
- TypeScript rules (strict mode, import patterns)
- React/Ink rules (hook patterns, component structure)
- Testing rules (DI pattern, fixtures, coverage targets)
- Code quality rules (naming, layered architecture)
- Anti-patterns with correct alternatives

This file was referenced by every story and provided consistent guidance across all implementations.

**7.2. Implementation Readiness Report**

The readiness assessment validated all planning artifacts before execution began:

- 42/42 FRs covered (100%)
- All 21 NFRs assigned to epics
- Epic quality review (user value, independence, dependencies)
- Story dependency analysis
- 0 critical issues, 0 major issues, 3 minor concerns

This pre-flight check caught potential gaps before agents started implementing.

**7.3. Code Review as Quality Gate**

Each story went through adversarial AI code review that:

- Verified all ACs were met
- Checked all tasks/subtasks completed
- Ran verification commands (type-check, lint, test)
- Found and fixed real issues (e.g., missing package.json fields, test coverage gaps)

The code review agent had access to the same story file, so it could verify claims against specifications.

---

## 8. What Caused Extra Review Cycles

Despite autonomous execution succeeding, some stories required multiple code review iterations:

| Story | Reviews | Root Cause |
|-------|---------|------------|
| 1.1 | 4 reviews | Missing package.json stubs, vitest/eslint workspace patterns |
| 1.3 | 5 reviews | Test files in tarball, AC#4 interpretation, untracked files |
| 1.2 | 1 review | Clean execution |
| 1.4 | 2 reviews | formatError not used, test coverage gap |
| 1.5 | 1 review | Clean execution |

### Root Cause Analysis

**8.1. Incomplete Verification Before Marking Done**

The primary failure pattern was agents marking tasks as complete without verifying all claims. Example: Story 1.1 claimed bin/main entries were removed, but they weren't. The code review caught this.

**Mitigation for env-2:** The retro identified a `verify-story-completion` workflow (Action Item #2) to automate claim verification.

**8.2. Edge Cases in Workspace Configuration**

Story 1.1 needed 4 reviews because workspace configuration has subtle requirements:
- Package.json stubs needed for pnpm to recognize workspace packages
- Vitest config needed package glob patterns
- ESLint config needed package dist ignore patterns

**Mitigation for env-2:** These patterns are now established and documented in the architecture/project-context. Future stories build on existing workspace infrastructure rather than creating it.

**8.3. Ambiguous AC Interpretation**

Story 1.3 AC#4 ("pnpm pack → install → --help works") was unclear about workspace dependency resolution during standalone installation. The agent interpreted this differently than intended.

**Mitigation for env-2:** ACs should explicitly state preconditions and expected failure modes, not just happy-path outcomes.

---

## 9. Repeatable Patterns for Epic env-2

### 9.1. Document Chain Checklist

Before starting any epic, ensure this chain exists:

- [ ] Product Brief with problem statement and scope
- [ ] PRD with numbered FRs and NFRs
- [ ] Architecture with exact versions, code patterns, and file locations
- [ ] Epics & Stories with FR mapping and dependency graph
- [ ] Project Context with critical rules and anti-patterns
- [ ] Implementation Readiness Report confirming 100% coverage

### 9.2. Story File Template Requirements

Each story file must include:

1. **User story** in standard format
2. **Acceptance criteria** in Given/When/Then BDD format (both happy and error paths)
3. **Tasks/subtasks** with AC references (`AC: #1, #3`)
4. **Dev Notes** with:
   - Previous story context (what exists now)
   - Critical constraints
   - Configuration specifications (copy-pastable code blocks)
   - File changes summary table (CREATE/MODIFY/DELETE/MOVE)
   - Target directory structure (ASCII diagram)
   - Testing requirements with specific test case names
   - Critical don't-miss rules
   - Verification steps (commands to run)
   - References to upstream documents
5. **"What This Story Does NOT Do"** section (negative scope)

### 9.3. Architecture Specificity Standard

The architecture document must answer these questions for every module:

- What file does this live in? (exact path)
- What are its dependencies? (exact imports)
- What pattern does it follow? (with code example)
- What types does it use? (with interface definition)
- How is it tested? (with DI pattern and fixture location)

### 9.4. AC Quality Standard

Every acceptance criterion must be:

- **Concrete** — references specific commands, files, or outputs
- **Testable** — directly convertible to a test case
- **Scoped** — states both what should happen and what should not
- **Error-aware** — includes error/failure scenarios, not just happy path
- **Preconditioned** — Given clause establishes required state clearly

### 9.5. Dev Notes Information Density

Dev Notes should constitute 40-60% of total story file content. Key sections by priority:

1. **Configuration specifications** — highest value, most copy-pasted
2. **Critical don't-miss rules** — prevents common agent failure modes
3. **Current/target state diagrams** — prevents misunderstanding scope
4. **Testing requirements** — specific test cases prevent gaps
5. **Previous story context** — prevents starting without prerequisites

---

## 10. Anti-Patterns to Avoid

### 10.1. Vague Requirements

**Bad:** "User can manage instances"
**Good:** "FR7: User can list all instances with their current status" + AC with exact command and output expectations

### 10.2. Architecture Without Code Examples

**Bad:** "Use the reject: false pattern for subprocess execution"
**Good:** A complete code block showing the pattern with correct/incorrect examples side-by-side

### 10.3. Stories Without Negative Scope

**Bad:** Story says what to build but not what to avoid
**Good:** "What This Story Does NOT Do" section explicitly listing out-of-scope work

### 10.4. ACs Without Error Conditions

**Bad:** Only happy-path ACs like "create succeeds"
**Good:** Include "Given the instance name already exists, When I try to create it, Then I get an error 'Instance already exists'"

### 10.5. Missing File Change Summary

**Bad:** Agent must infer which files to create/modify from task descriptions
**Good:** Explicit table showing CREATE/MODIFY/DELETE/MOVE with file paths

### 10.6. Undocumented Prerequisites

**Bad:** Story implicitly assumes previous story is complete
**Good:** "**CRITICAL:** Stories 1.1 and 1.2 must be completed. Verify: [list of checks]"

---

## 11. Conclusions

### Why Epic env-1 Succeeded Autonomously

1. **Closed information system** — No question required information not present in the artifacts
2. **Multi-layer traceability** — Product Brief → PRD → Architecture → Epics → Stories → Tests, with explicit cross-references at every level
3. **Concrete over abstract** — Code blocks > descriptions, specific commands > general patterns, exact file paths > vague locations
4. **Negative scope documented** — "What this does NOT do" sections prevented over-building
5. **Error paths specified** — ACs included failure scenarios, not just happy paths
6. **Critical rules centralized** — Project Context file prevented common agent mistakes
7. **Pre-flight validation** — Implementation Readiness Report caught gaps before execution

### Key Metric

- **5/5 stories executed autonomously** (0 human intervention during execution)
- **85 tests** passing across 3 packages at completion
- **2-5 code reviews per story** — but reviews caught real issues, not interpretation failures
- **~170 KB planning artifacts** for a ~400-line implementation delta

### Investment Ratio

The planning-to-implementation ratio was roughly 4:1 by document volume. This may seem high, but:

- Planning documents are reusable across epics (architecture, project context)
- Autonomous execution eliminates human context-switching overhead
- Code review iterations would be higher without comprehensive specs
- Planning investment amortizes across all 5 epics, not just Epic 1

### Recommendation

Apply these patterns to Epic env-2 with the additional improvements from the retrospective:

1. **TEA-first test design** — Define acceptance tests before implementation
2. **Verify-story-completion workflow** — Automated claim verification before code review
3. **Fixture-driven testing** — Pre-captured command output fixtures for container operations
4. **Human validation protocol** — Defined checkpoints for features requiring real host testing

The autonomous execution model works when planning artifacts form a complete, traceable, concrete information system. Invest in planning density; it pays back in execution reliability.

---

*End of Autonomous Execution Patterns Analysis*
