# TEA Agent Integration Evaluation

**Source:** Epic env-7 Retrospective Action Item #6
**Date:** 2026-02-18
**Owner:** Node (Project Lead)
**Status:** Decision documented

## Problem Statement

Epic 7 revealed systematic test architecture gaps that code review alone cannot catch:

1. **Phantom task completion** (Story 7-5): Task 1.4 marked complete but mutual exclusion test didn't exist (HIGH severity, caught in review)
2. **Missing test layer** (Story 7-3): No CLI integration tests for `--repo` flag (caught in review, not by tests)
3. **DI contract violation** (Story 7-3): `removeInstance()` and `setPurpose()` passed raw `readFile` instead of injected deps (caught downstream in review, not by tests)

Root cause from retro: "Code review is diff-scoped -- it catches bugs in changed code but doesn't assess whether the *right kinds of tests* exist."

## Current TEA Integration Points

The `bmad-story.yaml` keystone workflow already has two TEA hooks gated by `use_tea: boolean` (default: false):

1. **`acceptanceTestDesign`** (before dev): Invokes `/bmad-tea-testarch-atdd` to generate failing acceptance tests
2. **`traceabilityCheck`** (after code review): Invokes `/bmad-tea-testarch-trace` to verify implementation satisfies acceptance criteria

The `bmad-epic.yaml` workflow passes `use_tea` through to each story in the foreach loop.

## TEA Configuration Status

The TEA config (`_bmad/tea/config.yaml`) already has CLI-appropriate settings:

```yaml
tea_use_playwright_utils: false
tea_browser_automation: none
test_framework: other
```

## Evaluation: TEA Workflows for CLI Testing

### Usable Now (framework-agnostic)

| Workflow | Purpose | CLI Value |
|----------|---------|-----------|
| **test-design** | System/epic-level test planning with risk assessment | HIGH -- would catch missing test layers at planning time |
| **test-review** | Test quality review with scoring | HIGH -- would catch phantom task completion and DI contract gaps |
| **trace** | Requirements-to-tests traceability matrix | MEDIUM -- coverage_levels config supports `unit,integration,cli` |
| **nfr-assess** | Non-functional requirements assessment | LOW -- useful for release gates |

### Need Adaptation for CLI Testing

| Workflow | Issue | Adaptation Needed |
|----------|-------|-------------------|
| **atdd** | Generates `@playwright/test` imports, `page.goto()`, browser selectors | Rewrite step-04a/04b to generate Vitest tests with project's DI patterns |
| **automate** | Generates Playwright E2E tests | Rewrite for CLI integration test generation |
| **framework** | Playwright framework initialization | Not applicable -- project uses Vitest |

### Knowledge Base Assessment

Of 36 knowledge fragments in `tea-index.csv`:

**Applicable to CLI testing (13):** `data-factories`, `contract-testing`, `error-handling`, `risk-governance`, `probability-impact`, `test-quality`, `nfr-criteria`, `test-levels`, `test-priorities`, `test-healing-patterns`, `selective-testing`, `ci-burn-in`, `api-testing-patterns`

**Playwright/browser-specific (18):** `fixture-architecture`, `network-first`, `playwright-config`, `component-tdd`, `selector-resilience`, `timing-debugging`, `overview`, `api-request`, `network-recorder`, `auth-session`, `intercept-network-call`, `recurse`, `log`, `file-utils`, `burn-in`, `network-error-monitor`, `fixtures-composition`, `playwright-cli`

**General (5):** `feature-flags`, `email-auth`, `visual-debugging`, `adr-quality-readiness-checklist`, `test-healing-patterns`

## Decision

**TEA integrates at two points, with different timelines:**

### 1. Epic-Level Test Architecture Audit (Enable Now)

**When:** At epic start, after stories are defined but before implementation begins.
**Workflow:** `test-design` (epic-level mode)
**Why:** This is framework-agnostic. It reviews test strategy, identifies missing test layers, and establishes coverage expectations. Would have caught:
- The missing CLI integration test layer for `--repo` (identified at planning, not post-hoc)
- The DI contract verification gap (test-design would flag DI boundaries as requiring explicit test coverage)

**How to enable:** Run `/bmad-tea-testarch-test-design` manually at epic start. No keystone workflow change needed -- this is a planning-phase activity.

### 2. Per-Story Test Review (Enable Now)

**When:** After dev implementation, before code review (new step in bmad-story.yaml).
**Workflow:** `test-review`
**Why:** Reviews *existing* test files for quality, completeness, and patterns. Framework-agnostic -- it reads test files and evaluates them. Would have caught:
- Phantom task completion (test file doesn't exist or has placeholder assertions)
- DI contract not tested through factory boundary

**How to enable:** Add a `testReview` step in `bmad-story.yaml` between `devStory` and `reviewGemini`:

```yaml
- id: testReview
  type: shell
  needs: [devStory]
  if: ${{ inputs.use_tea == true }}
  allowInsecure: true
  run: |
    claude -p "/bmad-tea-testarch-test-review - Review tests for story ${{ inputs.story_id }}. Scope: directory. Check for missing test layers, DI contract verification, and acceptance criteria coverage. Do not ask questions." --dangerously-skip-permissions
```

### 3. Per-Story ATDD (Defer -- Needs Adaptation)

**When:** Before implementation (existing hook in bmad-story.yaml).
**Workflow:** `atdd`
**Why deferred:** The ATDD workflow is deeply Playwright-centric. The step files (`step-04a-subprocess-api-failing.md`, `step-04b-subprocess-e2e-failing.md`) generate `@playwright/test` imports, browser-based E2E tests, and API tests using Playwright's `request` fixture. This project uses Vitest with factory-function DI and mock executable shims.

**Adaptation required before enabling:**
- Rewrite `step-04a` to generate Vitest unit/integration tests using project's DI patterns
- Rewrite `step-04b` to generate CLI integration tests using mock executable shim pattern
- Add CLI testing knowledge fragments: mock executable patterns, DI contract testing, CLI integration patterns
- Update `test_framework` config from `other` to `vitest`
- Replace `coverage_levels: "e2e,api,component,unit"` in trace workflow with `cli-integration,integration,unit`

### 4. Post-Review Traceability Check (Enable Now)

**When:** After code review (existing hook in bmad-story.yaml).
**Workflow:** `trace`
**Why:** The traceability matrix maps requirements to test files. It's framework-agnostic at its core -- it searches for test files and matches them to acceptance criteria. The `coverage_levels` variable can be configured for CLI test layers.

**Config change needed in trace workflow.yaml:**
```yaml
coverage_levels: "cli-integration,integration,unit"  # was: e2e,api,component,unit
gate_type: "story"
```

## Implementation Summary

| Integration Point | Status | Action |
|-------------------|--------|--------|
| Epic-level test architecture audit | **Enable now** | Run test-design at epic start (manual) |
| Per-story test review | **Enable now** | Add testReview step in bmad-story.yaml |
| Per-story traceability check | **Enable now** | Update trace coverage_levels config |
| Per-story ATDD generation | **Defer** | Requires ATDD step rewrite for Vitest/CLI patterns |

## Configuration Changes

### Immediate (for enabling test-review and trace)

1. Update `_bmad/tea/config.yaml`:
   - Change `test_framework: other` to `test_framework: vitest`

2. Update `_bmad/tea/workflows/testarch/trace/workflow.yaml`:
   - Change `coverage_levels: "e2e,api,component,unit"` to `coverage_levels: "cli-integration,integration,unit"`

3. Add `testReview` step to `packages/keystone-workflows/workflows/bmad-story.yaml` (see above)

### Future (for enabling ATDD -- separate epic/story)

- Rewrite ATDD step files for Vitest/CLI patterns
- Add CLI testing knowledge fragments to TEA knowledge base
- Update ATDD template for non-browser test generation

## What TEA Would Have Caught in Epic 7

| Gap | TEA Workflow | How |
|-----|-------------|-----|
| Phantom task completion (7-5 mutual exclusion test) | test-review | Reviews test files against acceptance criteria; flags missing tests |
| Missing CLI integration tests for --repo (7-3) | test-design | Epic-level test plan identifies CLI integration as required test layer |
| DI contract violation (7-3 raw readFile) | test-review + test-design | test-design flags DI boundaries as needing contract tests; test-review checks existing tests cover DI patterns |
| Orphaned review recommendations | trace | Traceability matrix shows which acceptance criteria lack test coverage |

## Risk Assessment

**Risk of enabling TEA now:** LOW
- test-review and trace are read-only analysis workflows
- They produce reports and quality scores, not code changes
- `use_tea` flag defaults to false -- opt-in per story/epic
- No changes to existing test infrastructure

**Risk of deferring ATDD:** LOW
- Current workflow (dev writes tests, code review catches gaps) works acceptably
- test-review fills the immediate gap (post-hoc detection vs pre-hoc generation)
- ATDD adaptation is a self-contained task that can be done independently

## Backlog Items Generated

1. **Adapt ATDD workflow for Vitest/CLI testing** -- rewrite step-04a/04b subprocess files to generate Vitest tests using factory-function DI and mock executable shim patterns. Add CLI testing knowledge fragments to TEA knowledge base.
2. **Add `testReview` step to bmad-story.yaml** -- insert between devStory and reviewGemini, gated by `use_tea`.
3. **Update TEA trace workflow coverage levels** -- change from browser-centric levels to CLI test layers.
