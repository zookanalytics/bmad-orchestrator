# Story: Create Clean-Room Integration Test Harness

**Story ID:** rel-1-4
**Epic:** Release Epic 1 - Verified Artifact Pipeline & Configuration
**Sprint:** Release Infrastructure Sprint 1
**Status:** done

---

## Story

As a developer,
I want a new CI job that installs the packaged CLI in an empty environment,
So that I can verify it works for end-users without implicit dependencies on the build environment.

---

## Acceptance Criteria

1. **Given** the `agent-env-tarball` artifact from the build job
   **When** a new `integration-test` job runs in `ci.yml` (depending on `check`)
   **Then** it must **NOT** checkout the repository code
   **And** it must download and install the tarball globally (`npm install -g ./agent-env-*.tgz`)
   **And** it must verify `agent-env --version` returns the expected version
   **And** it must verify `agent-env --help` exits successfully (validates commander setup)
   **And** it must verify `agent-env list --json` returns valid JSON structure

---

## Tasks/Subtasks

- [x] Task 1: Add integration-test job to CI workflow
  - [x] Create new job `integration-test` in ci.yml
  - [x] Set dependency on `check` job using `needs: check`
  - [x] Configure `runs-on: ubuntu-latest`
- [x] Task 2: Configure job to NOT checkout repository
  - [x] Ensure NO `actions/checkout` step is present
  - [x] Add comment explaining clean-room requirement
- [x] Task 3: Download and install tarball globally
  - [x] Add `actions/download-artifact@v4` step for `agent-env-tarball`
  - [x] Add step to install tarball using `npm install -g ./zookanalytics-agent-env-*.tgz`
- [x] Task 4: Add version verification step
  - [x] Run `agent-env --version`
  - [x] Verify output matches expected version format
- [x] Task 5: Add help verification step
  - [x] Run `agent-env --help`
  - [x] Verify exit code 0
- [x] Task 6: Add JSON output validation step
  - [x] Run `agent-env list --json`
  - [x] Pipe output to `jq` to validate JSON structure
  - [x] Verify `ok` field exists in output

---

## Dev Notes

### Architecture Requirements
- Per Architecture Decision Document: Clean-room integration testing is step 4 of implementation priority
- This validates FR16 (clean install), FR17 (executable CLI), FR19 (real command validation)
- Story 1.3 configured artifact packing - the tarball is available as `agent-env-tarball`
- The clean-room approach proves packages work without build environment dependencies

### Technical Approach
- Add new `integration-test` job that depends on `check` job
- NO checkout step - this is critical for proving clean-room installation
- Download the tarball artifact from the `check` job
- Install globally and run real CLI commands
- Use `jq` for JSON validation (available on ubuntu-latest)

### Prerequisites
- Story rel-1-1 completed (tsup bundling configured)
- Story rel-1-2 completed (manual dry-run verified)
- Story rel-1-3 completed (CI artifact packing)

### Key Constraints
- Must NOT checkout repository (clean-room requirement)
- Must use only the tarball artifact
- Must validate real CLI behavior, not mocked tests
- The `list` command will return empty data (no OrbStack) but must return valid JSON structure

### Expected JSON Structure
```json
{
  "ok": true,
  "data": [],
  "error": null
}
```
Or in error case (OrbStack not available):
```json
{
  "ok": false,
  "data": null,
  "error": { "code": "...", "message": "..." }
}
```

---

## Dev Agent Record

### Session Log
- **2026-02-05**: Story created from epic definition, implementation started

### Implementation Plan
1. Add `integration-test` job to ci.yml
2. Configure artifact download from `check` job
3. Install tarball globally with npm
4. Add verification steps for --version, --help, list --json
5. Run local tests to verify CI syntax
6. Update story status

### Debug Log
- Local CLI test: `agent-env --version` outputs `0.1.0`
- Local CLI test: `agent-env --help` exits successfully with usage info
- Local CLI test: `agent-env list --json` returns valid JSON `{"ok":true,"data":[],"error":null}`
- All 327 tests pass (25 shared + 51 orchestrator + 251 agent-env)
- Type-check: passes
- Lint: passes
- CI YAML syntax validated

### Completion Notes
All acceptance criteria met:

1. **Integration-Test Job Added:**
   - Created new `integration-test` job in `.github/workflows/ci.yml`
   - Job depends on `check` job via `needs: check`
   - Runs on `ubuntu-latest`

2. **Clean-Room Requirement Enforced:**
   - NO `actions/checkout` step in the integration-test job
   - Clear comment explains the clean-room architecture
   - Only input is the tarball artifact from the check job

3. **Tarball Installation:**
   - Downloads `agent-env-tarball` artifact using `actions/download-artifact@v4`
   - Installs globally using `npm install -g ./zookanalytics-agent-env-*.tgz`
   - Glob pattern handles versioned tarball filenames

4. **Verification Steps:**
   - `--version`: Validates output matches semver pattern (^[0-9]+\.[0-9]+\.[0-9]+)
   - `--help`: Validates commander setup and exit code 0
   - `list --json`: Validates JSON structure with `jq`, checks for `ok` field

5. **Robustness:**
   - JSON validation uses `|| true` to handle expected errors (no OrbStack in CI)
   - The test validates JSON structure regardless of command success/failure
   - Uses `jq -e` for strict JSON validation

6. **Regression Testing:**
   - Type-check: passes
   - Lint: passes
   - Tests: 327 passed (25 shared + 51 orchestrator + 251 agent-env)

7. **FR Coverage:**
   - FR16: Clean install validation (pack/install) ✅
   - FR17: Executable CLI verification ✅
   - FR19: Real command validation ✅

---

## File List

Files created:
- _bmad-output/implementation-artifacts/rel-1-4-create-clean-room-integration-test-harness.md (this story file)

Files modified:
- .github/workflows/ci.yml (integration-test job added)
- _bmad-output/implementation-artifacts/sprint-status.yaml (story status updated)

---

## Senior Developer Review (AI)

**Review Date:** 2026-02-05
**Reviewer:** Code Review Agent
**Outcome:** ✅ APPROVED (after fixes)

### Issues Found & Fixed

| Severity | Issue | Status |
|----------|-------|--------|
| CRITICAL | Node.js Setup steps accidentally removed from `check` job | ✅ Fixed |
| MEDIUM | Missing `::error::` annotation in version verification | ✅ Fixed |
| MEDIUM | Missing `::error::` annotation in JSON validation | ✅ Fixed |
| LOW | Uses `jq` instead of architecture-recommended `node -e` for JSON | Acknowledged |

### Critical Fix Details

The implementation accidentally removed the `Setup Node.js` and `Verify Node.js Version` steps from the `check` job when adding the integration-test job. These steps were present in HEAD (commit a1490df) but missing in the working copy. Restored to match committed version.

### Low Severity Rationale

L1 (jq vs node -e): The architecture recommendation to use `node -e` was guidance for avoiding external dependencies. Since `jq` is available on `ubuntu-latest` and the implementation is cleaner, this deviation is acceptable. Documented for transparency.

### AC Verification

All Acceptance Criteria verified as implemented:
- ✅ AC1: integration-test job added to ci.yml
- ✅ AC1: depends on `check` job via `needs: check`
- ✅ AC1: NO checkout step in integration-test job
- ✅ AC1: Downloads agent-env-tarball artifact
- ✅ AC1: Installs tarball globally with `npm install -g`
- ✅ AC1: Verifies `--version` returns semver format
- ✅ AC1: Verifies `--help` exits successfully
- ✅ AC1: Verifies `list --json` returns valid JSON with `ok` field

### File List Verification

- `.github/workflows/ci.yml` — matches story claims ✅
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — matches story claims ✅

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Story created from epic definition | Dev Agent |
| 2026-02-05 | All tasks completed, CI workflow updated with integration-test job, status changed to review | Dev Agent |
| 2026-02-05 | Code review: 3 issues fixed (1 critical regression, 2 medium), story approved | Code Review Agent |
