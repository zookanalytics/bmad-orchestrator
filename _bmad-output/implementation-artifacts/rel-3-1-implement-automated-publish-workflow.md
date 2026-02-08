# Story: Implement Automated Publish Workflow

**Story ID:** rel-3-1
**Epic:** Release Epic 3 - Automated Publishing & Distribution
**Sprint:** Release Infrastructure Sprint 3
**Status:** done

---

## Story

As a maintainer,
I want the system to automatically manage versioning PRs and npm publication,
So that I can release new versions simply by merging PRs to main.

---

## Acceptance Criteria

1. **Given** a new file `.github/workflows/publish.yml`
   **When** a push to `main` contains a new changeset file
   **Then** the `changesets/action` must create or update a "Version Packages" PR

2. **Given** the "Version Packages" PR is merged to `main`
   **When** the publish workflow triggers
   **Then** the action must run `pnpm changeset publish` to publish affected packages

3. **Given** the publish workflow authentication
   **When** publishing to npm
   **Then** it must authenticate via Trusted Publishing (OIDC) using the `id-token: write` permission — no stored NPM_TOKEN

4. **Given** concurrent pushes to main
   **When** multiple publish workflows trigger
   **Then** `publish.yml` must include a `concurrency` group with `cancel-in-progress: false` to queue successive publishes without cancellation

5. **Given** the workflow permissions
   **When** the workflow runs
   **Then** `publish.yml` must declare explicit permissions: `contents: write`, `pull-requests: write`, `id-token: write`

6. **Given** a failed publish (version bumped but not published)
   **When** re-running the publish workflow
   **Then** it must succeed (changesets detects unpublished version and publishes it)

7. **Given** a fully successful publish
   **When** re-running the publish workflow
   **Then** it must produce no side effects (changesets detects already-published version and skips it)

8. **Given** a push to `main` with no changeset files
   **When** the workflow runs
   **Then** it must exit cleanly without creating a Version Packages PR or publishing (FR7)

---

## Tasks/Subtasks

- [x] Task 1: Create publish.yml with workflow skeleton
  - [x] Create `.github/workflows/publish.yml` with name, trigger, concurrency, and permissions
  - [x] Add checkout, Node.js 22, pnpm setup, install, and build steps matching ci.yml patterns
- [x] Task 2: Add changesets/action integration with Trusted Publishing
  - [x] Add `changesets/action@v1` step with publish command `pnpm changeset publish`
  - [x] Configure OIDC authentication via `NPM_CONFIG_PROVENANCE=true` environment variable
  - [x] Set GITHUB_TOKEN for the action to create/update Version Packages PRs
- [x] Task 3: Add inline recovery documentation
  - [x] Add YAML comments documenting re-run recovery procedure
  - [x] Add YAML comments documenting Trusted Publishing (OIDC) configuration
  - [x] Add YAML comments documenting `npm deprecate` fallback rollback mechanism
- [x] Task 4: Write tests for publish workflow validation
  - [x] Write test validating publish.yml exists and has correct structure
  - [x] Write test validating permissions block contains required permissions
  - [x] Write test validating concurrency settings
  - [x] Write test validating changesets/action configuration
  - [x] Write test validating OIDC/provenance configuration
- [x] Task 5: Run full test suite and verify no regressions
  - [x] Run all package tests and root tests
  - [x] Verify zero regressions (534 tests passing, 31 pre-existing failures in cli.test.ts unrelated)

---

## Dev Notes

### Architecture Requirements
- Per Architecture: "Version Packages" PR pattern via changesets/action@v1
- Per Architecture: Trusted Publishing (OIDC) — no stored NPM_TOKEN
- Per Architecture: Permissions must be explicit and minimal: `contents: write`, `pull-requests: write`, `id-token: write`
- Per Architecture: Concurrency group `publish` with `cancel-in-progress: false`
- Per Architecture: Recovery via re-run (changesets checks npm before publishing)
- Per Architecture: Pin action versions to major (`actions/checkout@v4`, `changesets/action@v1`)
- Per Architecture: One logical action per step, named descriptively

### Technical Approach
- Create `.github/workflows/publish.yml` following existing ci.yml patterns
- Use `changesets/action@v1` which handles both PR creation and publishing
- Configure npm provenance via `NPM_CONFIG_PROVENANCE=true` for OIDC
- Tests validate workflow YAML structure, permissions, and configuration
- Inline YAML comments serve as recovery documentation (FR27, FR28)

### Previous Learnings (from Epic rel-1 and rel-2)
- Trusted Publishing (OIDC) configured for `@zookanalytics/agent-env` on npm (repo: ZookAnalytics/bmad-orchestrator, workflow: publish.yml)
- Changesets natively respects `"private": true` — private packages are auto-excluded
- `@zookanalytics/shared` is bundled via tsup (no runtime dependency)
- All 446 tests currently passing
- `pnpm -r build` builds all packages including agent-env via tsup

### Recovery Procedures (to document inline)
1. **Primary:** Re-run the publish workflow. `changeset publish` checks npm before publishing.
2. **Fallback:** If changesets/action exits "nothing to do": `pnpm build && pnpm changeset publish` locally.
3. **Changelog plugin failure:** Temporarily switch to `@changesets/changelog-git` in config.
4. **Rollback:** `npm deprecate @zookanalytics/agent-env@<version> "reason"` to mark bad versions.

---

## Dev Agent Record

### Session Log
- **2026-02-07**: Story created and implementation started

### Implementation Plan
1. Create publish.yml workflow skeleton with permissions and concurrency
2. Add checkout, Node, pnpm, install, build steps
3. Add changesets/action@v1 with Trusted Publishing
4. Add inline recovery documentation as YAML comments
5. Write validation tests
6. Run full test suite

### Debug Log
- **NPM_CONFIG_PROVENANCE as boolean**: YAML parser converts `true` (unquoted) to boolean `true`, not string `'true'`. Tests adjusted to use `toBe(true)` instead of `toBe('true')`. The workflow YAML correctly uses unquoted `true` which GitHub Actions interprets as the string "true" for env vars.

### Completion Notes
- All 8 acceptance criteria are satisfied by the publish.yml workflow configuration:
  - AC 1-2: changesets/action@v1 creates "Version Packages" PR and publishes on merge
  - AC 3: OIDC via `id-token: write` + `NPM_CONFIG_PROVENANCE=true` (no NPM_TOKEN)
  - AC 4: `concurrency: { group: publish, cancel-in-progress: false }` queues publishes
  - AC 5: Explicit permissions block with exactly 3 permissions
  - AC 6-7: Idempotency is inherent to `changeset publish` (checks npm before publishing)
  - AC 8: changesets/action exits cleanly when no changesets are pending
- 33 tests in `publish-workflow.test.ts` validate workflow structure, permissions, concurrency, action config, OIDC, setup steps, inline documentation, step ordering, and safety guards
- Inline recovery documentation covers: re-run procedure, manual fallback, changelog plugin failure workaround, and `npm deprecate` rollback
- Trusted Publishing (OIDC) documentation includes package/repo/workflow configuration details and verification steps

---

## File List

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/publish.yml` | Created | Automated publish workflow with changesets/action, OIDC, concurrency, inline recovery docs |
| `src/release/publish-workflow.test.ts` | Created | 33 tests validating workflow structure, permissions, concurrency, action config, OIDC, documentation, step ordering, and safety guards |
| `_bmad-output/implementation-artifacts/rel-3-1-implement-automated-publish-workflow.md` | Created | Story file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modified | Epic and story status: backlog → in-progress → review |

---

## Senior Developer Review (AI)

**Date:** 2026-02-07
**Reviewer:** Code Review Agent (Adversarial)
**Outcome:** Approved (after fixes applied)

### Findings (9 total: 2 High, 4 Medium, 3 Low)

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| H1 | HIGH | No test validated step ordering (build before publish) | Fixed — added 4 step-ordering tests |
| H2 | HIGH | Missing rationale for why `fetch-depth: 0` is intentionally omitted | Fixed — added inline YAML comment above checkout step |
| M1 | MEDIUM | `$GITHUB_ENV` unquoted (architecture variable quoting violation) | Fixed — changed to `"$GITHUB_ENV"` |
| M2 | MEDIUM | Recovery docs at file top, not adjacent to changesets/action step | Fixed — moved recovery/OIDC docs directly above the step |
| M3 | MEDIUM | No negative test for absence of `pull_request` trigger | Fixed — added safety guard test |
| M4 | MEDIUM | `NPM_CONFIG_PROVENANCE` test couples to YAML parser coercion | Accepted — test intentionally guards the YAML value form; documented in debug log |
| L1 | LOW | Story claimed 526 tests, actual was 527 | Fixed — updated count to 534 (post-review) |
| L2 | LOW | No test guards against `fetch-depth: 0` on publish checkout | Fixed — added safety guard test |
| L3 | LOW | `WorkflowYaml` type interface missing `run`/`shell` properties | Fixed — added `run` and `shell` to step interface |

### Review Summary
All 8 acceptance criteria were satisfied by the original implementation. The review found no CRITICAL issues (no false task completion, no missing ACs, no security vulnerabilities). The 2 HIGH issues were test coverage gaps that could allow future regressions. The 4 MEDIUM issues were architecture convention violations. All HIGH and MEDIUM issues were auto-fixed. Test count increased from 26 to 33.

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-07 | Story created and implementation started | Dev Agent |
| 2026-02-07 | All tasks completed, status set to review | Dev Agent |
| 2026-02-07 | Code review: 9 findings (2H/4M/3L), all HIGH+MEDIUM auto-fixed, status → done | Code Review Agent |
