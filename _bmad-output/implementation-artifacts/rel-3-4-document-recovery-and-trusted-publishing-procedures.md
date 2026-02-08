# Story: Document Recovery and Trusted Publishing Procedures

**Story ID:** rel-3-4
**Epic:** Release Epic 3 - Automated Publishing & Distribution
**Sprint:** Release Infrastructure Sprint 3
**Status:** done

---

## Story

As a maintainer,
I want to have clear, inline instructions for handling failures and managing secrets,
So that I can recover the pipeline quickly without searching for external documentation.

*Moved from Epic 4 (formerly Story 4.2) — Epic 4 dissolved after Story 4.1 was superseded by Trusted Publishing.*

---

## Acceptance Criteria

1. **Given** the `.github/workflows/publish.yml` file
   **When** I examine the YAML content
   **Then** I must see descriptive comments explaining how to re-run a failed publish (idempotency)

2. **Given** the `.github/workflows/publish.yml` file
   **When** I examine the YAML content
   **Then** I must see documentation of the Trusted Publishing (OIDC) configuration (linked repo, workflow name) and how to verify/fix it

3. **Given** the `.github/workflows/publish.yml` file
   **When** I examine the YAML content
   **Then** I must see instructions for manually deprecating a package version via `npm deprecate` as a fallback rollback mechanism

---

## Tasks/Subtasks

- [x] Task 1: Audit existing inline documentation in publish.yml for completeness
  - [x] Verify re-run recovery procedure covers primary and fallback recovery paths
  - [x] Verify Trusted Publishing (OIDC) documentation includes linked repo, workflow name, and verification/fix steps
  - [x] Verify npm deprecate rollback instructions are clear and actionable
  - [x] Enhance documentation where gaps are found
- [x] Task 2: Write dedicated tests for FR27 (npm deprecate rollback) and FR28 (inline recovery docs)
  - [x] Write tests validating re-run recovery documentation content (AC1)
  - [x] Write tests validating Trusted Publishing documentation completeness (AC2)
  - [x] Write tests validating npm deprecate rollback instructions (AC3)
- [x] Task 3: Run full test suite and verify no regressions

---

## Dev Notes

### Architecture Requirements
- Per PRD FR27: The maintainer can deprecate a published package version as a rollback mechanism
- Per PRD FR28: The maintainer can follow inline documentation in workflow files for recovery procedures
- Per Architecture: Recovery procedures as comments directly above the relevant step, not in a separate file
- Per Architecture: YAML comments for "why," not "what"
- Per Architecture: Document OIDC configuration (linked repo, workflow name) as YAML comment in publish.yml
- Note: FR26 (failure notifications) is satisfied implicitly by GitHub Actions default email notifications

### Technical Approach
- publish.yml already contains inline recovery documentation (added in Story 3.1, Task 3)
- This story validates completeness and writes dedicated tests for FR27/FR28 coverage
- Existing tests in `publish-workflow.test.ts` validate some inline docs but are not FR27/FR28-specific
- New test file `recovery-docs.test.ts` will provide focused FR27/FR28 validation
- May enhance existing YAML comments if gaps are found during audit

### Previous Learnings (from Stories rel-3-1, rel-3-2, rel-3-3)
- Publish workflow is at `.github/workflows/publish.yml` with name "Publish"
- Repository: ZookAnalytics/bmad-orchestrator
- Package: @zookanalytics/agent-env
- Inline recovery docs exist: RECOVERY PROCEDURES, TRUSTED PUBLISHING (OIDC), ROLLBACK, GITHUB RELEASES sections
- Test patterns use YAML parsing and raw file content checks
- Architecture specifies recovery docs live inline, not in separate files

---

## Dev Agent Record

### Session Log
- **2026-02-07**: Story created and implementation started
- **2026-02-07**: All tasks completed, status set to review

### Implementation Plan
1. Audit publish.yml inline documentation against ACs and FR27/FR28
2. Enhance documentation if gaps are found
3. Write dedicated FR27/FR28 test file (recovery-docs.test.ts)
4. Run full test suite
5. Update story status

### Debug Log
- Existing `publish-workflow.test.ts` tests use `toContain('TRUSTED PUBLISHING (OIDC)')` — new section header preserved this substring to avoid breaking existing tests.

### Completion Notes
- All 3 acceptance criteria are satisfied by the inline documentation in publish.yml:
  - AC 1: RECOVERY PROCEDURES section (lines 73-96) documents idempotent re-run safety (FR10/11/12), primary re-run recovery, manual fallback, and changelog plugin failure workaround
  - AC 2: TRUSTED PUBLISHING (OIDC) section (lines 114-136) documents package, repository, workflow name, npm settings URL, how OIDC works, and step-by-step verify/fix instructions
  - AC 3: ROLLBACK section (lines 98-112) documents npm deprecate command, 72-hour unpublish limitation, undo deprecation, and follow-up fix version procedure
- Documentation enhancements made to existing publish.yml comments:
  - Added explicit FR10/FR11/FR12 references with idempotency explanation
  - Added numbered recovery scenarios (1. publish failed, 2. nothing to do, 3. changelog plugin)
  - Added FR27 reference to rollback section
  - Added npm unpublish limitation (72 hours)
  - Added deprecation undo command
  - Added "publish a fix version" follow-up steps
  - Added FR29/FR30 references to Trusted Publishing section
  - Added npm settings URL for quick access
  - Added numbered verify/fix steps with specific error codes (403/401)
- 23 new tests in `recovery-docs.test.ts` validate FR27/FR28 requirements
- 633 total tests passing, zero regressions

---

## File List

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/publish.yml` | Modified | Enhanced inline recovery, rollback, and Trusted Publishing documentation |
| `src/release/recovery-docs.test.ts` | Created | 23 tests validating FR27/FR28 recovery and Trusted Publishing docs |
| `_bmad-output/implementation-artifacts/rel-3-4-document-recovery-and-trusted-publishing-procedures.md` | Created | Story file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modified | Story status: backlog → in-progress → review |

---

## Senior Developer Review (AI)

**Reviewer:** Node | **Date:** 2026-02-07 | **Outcome:** Approved with fixes applied

### AC Verification
- AC1 (Re-run recovery/idempotency): **IMPLEMENTED** — RECOVERY PROCEDURES section with FR10/FR11/FR12 references, 3 recovery scenarios
- AC2 (Trusted Publishing OIDC docs): **IMPLEMENTED** — Dedicated section with package, repo, workflow, OIDC explanation, verify/fix steps
- AC3 (npm deprecate rollback): **IMPLEMENTED** — ROLLBACK section with deprecate command, 72h limitation, undo, fix version steps

### Issues Found: 3 HIGH, 4 MEDIUM, 1 LOW

**Fixed (3 issues in publish.yml):**
1. [HIGH] Recovery scenario #2 manual fallback bypasses OIDC without caveats → Added warning about token requirement, missing provenance, potential 403
2. [MEDIUM] `NPM_CONFIG_PROVENANCE: true` lacks explanatory comment → Added inline comment explaining SLSA provenance
3. [LOW] FR/NFR requirement codes referenced without definition link → Added pointer to planning-artifacts at top of file

**Not fixed — in ATDD test file (recovery-docs.test.ts, protected):**
4. [HIGH] 9 assertions duplicate `publish-workflow.test.ts:204-229` — maintenance burden, zero added signal
5. [HIGH] All 23 tests defeateable by keyword dumping — `toContain()` only, no semantic/structural validation
6. [MEDIUM] No file-existence guard test (cryptic ENOENT on deletion)
7. [MEDIUM] No structural/ordering assertions for claimed "sections"
8. [MEDIUM] Line 157 tests functional YAML via raw string (already covered by parsed-YAML in sibling test)

### Recommendation
All ACs implemented. HIGH/MEDIUM publish.yml issues fixed. Test file issues are noted but protected per ATDD policy — recommend addressing test quality in a follow-up story focused on release test consolidation.

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-07 | Story created and implementation started | Dev Agent |
| 2026-02-07 | All tasks completed, status set to review | Dev Agent |
| 2026-02-07 | Code review: 3 fixes applied to publish.yml, 5 test issues noted (ATDD protected), status → done | Code Review (AI) |
