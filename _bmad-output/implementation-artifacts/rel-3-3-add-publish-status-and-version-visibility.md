# Story: Add Publish Status and Version Visibility

**Story ID:** rel-3-3
**Epic:** Release Epic 3 - Automated Publishing & Distribution
**Sprint:** Release Infrastructure Sprint 3
**Status:** done

---

## Story

As a maintainer,
I want to see the pipeline status, current npm version, and changeset coverage on PRs,
So that I can verify process health, deployment outcomes, and whether PRs include required changesets at a glance.

---

## Acceptance Criteria

1. **Given** the project's root `README.md`
   **When** I add a GitHub Actions status badge for the `publish.yml` workflow
   **Then** the badge must correctly reflect the status (Success/Failure) of the last run on the `main` branch
   **And** I must add an npm version badge for `@zookanalytics/agent-env`
   **And** both badges must be positioned prominently near the top of the README

2. **Given** a pull request opened against `main`
   **When** the PR modifies files in a publishable package
   **Then** the changeset bot must comment on the PR indicating which packages have changesets and which do not (FR32)

3. **And** the CI changeset status step must warn (not fail) if no changesets are found, so infrastructure-only PRs are not blocked

---

## Tasks/Subtasks

- [x] Task 1: Create README.md with publish status and npm version badges
  - [x] Create root README.md file
  - [x] Add GitHub Actions publish workflow status badge
  - [x] Add npm version badge for @zookanalytics/agent-env
  - [x] Position both badges prominently near the top
- [ ] Task 2: Add changeset bot for PR comments (FR32)
  - [ ] Install changeset-bot GitHub App on repository (https://github.com/apps/changeset-bot)
  - [x] ~~Create .github/workflows/changeset-bot.yml using changesets/bot action~~ — INVALID: changesets/bot is a GitHub App, not a GitHub Action
  - [x] Configure to run on pull_request_target events (opened, synchronize) — N/A (App-based, no workflow needed)
  - [x] Ensure minimal permissions (pull-requests: write) — N/A (App manages own permissions)
- [x] Task 3: Write tests for badges and changeset bot configuration
  - [x] Write tests for README badge content (publish status badge, npm version badge) — 6 tests
  - [x] Write tests for changeset-bot.yml structure and configuration — 10 tests
  - [x] Verify CI changeset status step already warns (not fails) — 4 tests
- [x] Task 4: Run full test suite and verify no regressions

### Review Follow-ups (AI)
- [x] [AI-Review][HIGH] Install changeset-bot GitHub App on repository (https://github.com/apps/changeset-bot) to satisfy AC2 — DONE (installed by maintainer)
- [x] [AI-Review][HIGH] Delete .github/workflows/changeset-bot.yml after App is installed (workflow uses non-existent Action) — DONE (post-rel-3 validation)
- [x] [AI-Review][MEDIUM] Update changeset-bot.test.ts to validate App installation instead of workflow YAML — DONE (tests now verify no workflow file exists)
- [ ] [AI-Review][LOW] Consider adding shared and bmm-retrospective-module to README Packages table [README.md]

---

## Dev Notes

### Architecture Requirements
- Per PRD FR25: Pipeline health visibility via status badge
- Per PRD FR32: Changeset bot PR comments for coverage visibility
- Per Architecture: Badges for publish workflow health and npm version
- Per Architecture: Changeset bot comments on PRs (NOTE: changesets/bot is a GitHub App, not an Action)
- Per Story AC3: CI changeset step must warn (not fail) — already implemented in ci.yml

### Technical Approach
- README.md does not exist yet — create with badges as the primary content
- GitHub Actions status badge URL pattern: `https://github.com/{owner}/{repo}/actions/workflows/{workflow}/badge.svg?branch=main`
- npm version badge URL pattern: `https://img.shields.io/npm/v/{package}` or `https://badge.fury.io/js/{package}.svg`
- Changeset bot: `changesets/bot` is a GitHub App (not an Action) — install via https://github.com/apps/changeset-bot. No workflow file needed.
- CI changeset step already uses `::warning::` pattern — AC3 is pre-satisfied, confirmed with tests

### Previous Learnings (from Stories rel-3-1, rel-3-2)
- Publish workflow is at `.github/workflows/publish.yml` with name "Publish"
- Repository: ZookAnalytics/bmad-orchestrator
- Package: @zookanalytics/agent-env
- All 37 existing publish-workflow tests pass
- Test patterns use YAML parsing and raw file content checks

---

## Dev Agent Record

### Session Log
- **2026-02-07**: Story created and implementation started
- **2026-02-07**: All tasks completed, status set to review

### Implementation Plan
1. Create README.md with publish status badge and npm version badge
2. Create changeset-bot.yml workflow
3. Write tests for badges, changeset bot, and CI advisory behavior
4. Run full test suite
5. Update story status

### Debug Log
- No issues encountered. All implementations were straightforward.
- AC3 (CI changeset warning) was already implemented in previous work — confirmed with 4 new tests.

### Completion Notes
- AC status after code review:
  - AC 1: IMPLEMENTED — README.md created with GitHub Actions publish workflow status badge (`branch=main`) and npm version badge for `@zookanalytics/agent-env`, both positioned on lines 3-4 (prominently near top)
  - AC 2: IMPLEMENTED — changeset-bot GitHub App installed on repository. Invalid workflow file deleted; tests updated to verify no workflow file exists.
  - AC 3: IMPLEMENTED — CI changeset step confirmed to use `::warning::` (advisory, not failure) — verified by 4 dedicated tests
- 20 new tests added across 3 test files (total release tests: 79 across 7 files)
- 558 of 589 tests pass; 31 pre-existing cli.test.ts/safety-report.test.ts failures unrelated to this story

---

## File List

| File | Action | Description |
|------|--------|-------------|
| `README.md` | Created | Root README with publish status and npm version badges |
| `.github/workflows/changeset-bot.yml` | Created | Changeset bot workflow for PR comments (FR32) |
| `src/release/readme-badges.test.ts` | Created | 6 tests validating README badge content and positioning |
| `src/release/changeset-bot.test.ts` | Created | 10 tests validating changeset-bot.yml structure and config |
| `src/release/ci-changeset-advisory.test.ts` | Created | 4 tests confirming CI changeset step is advisory (AC3) |
| `_bmad-output/implementation-artifacts/rel-3-3-add-publish-status-and-version-visibility.md` | Created | Story file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modified | Story status: backlog → in-progress → review |

---

## Senior Developer Review (AI)

**Reviewer:** Node
**Date:** 2026-02-07
**Outcome:** Changes Requested

### Findings Summary
| Severity | Count | Description |
|----------|-------|-------------|
| HIGH | 1 | `changesets/bot` is a GitHub App, not a GitHub Action — workflow will fail at runtime |
| MEDIUM | 3 | Missing checkout step (moot), missing contents:read permission (moot), test validates broken workflow |
| LOW | 2 | Contradictory test count phrasing, README packages table incomplete |

### AC Validation
| AC | Status | Evidence |
|----|--------|----------|
| AC1: README badges | IMPLEMENTED | `README.md:3-4` — publish status badge (branch=main) + npm version badge, both in first 5 lines |
| AC2: Changeset bot PR comments | NOT IMPLEMENTED | `changeset-bot.yml:22` — `uses: changesets/bot@v1` references a GitHub App repo with no `action.yml`. Will fail at runtime. Fix: install the changeset-bot GitHub App. |
| AC3: CI changeset advisory | IMPLEMENTED | `ci.yml:72-77` — uses `if !` guard + `::warning::` annotation, confirmed by 4 tests |

### Critical Finding: H1
`changesets/bot` (https://github.com/changesets/bot) is the source repository for a **GitHub App**, not a GitHub Action. It has no `action.yml` file. The reference `uses: changesets/bot@v1` in `changeset-bot.yml` will fail with a "repository not found" or "action.yml not found" error when the workflow is triggered.

The correct mechanism for FR32 is to install the changeset-bot GitHub App on the repository at https://github.com/apps/changeset-bot. Once installed, it automatically comments on PRs showing changeset coverage — no workflow file is needed.

The workflow file is retained (with warning comments added) because ATDD acceptance tests validate its YAML structure. The follow-up tasks above track the proper fix.

### Actions Taken
1. Added warning comments to `changeset-bot.yml` documenting the issue and correct fix
2. Unchecked Task 2 in story (not actually complete)
3. Fixed story completion notes to accurately reflect AC2 status
4. Fixed contradictory test count phrasing
5. Added review follow-up tasks for proper resolution
6. Updated Dev Notes to correct the technical approach

### Verdict
Story cannot be marked **done** — AC2 is not implemented. Status remains **in-progress** pending changeset-bot GitHub App installation (a manual step requiring repository admin access).

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-07 | Story created and implementation started | Dev Agent |
| 2026-02-07 | All tasks completed, status set to review | Dev Agent |
| 2026-02-07 | Code review: AC2 not implemented (changesets/bot is a GitHub App, not Action). Added warning comments to workflow, added follow-up tasks, status → in-progress | Code Review (AI) |
| 2026-02-07 | Post-rel-3 validation: changeset-bot App installed, workflow file deleted, tests updated. All ACs satisfied. Status → done | Architecture Validation |
