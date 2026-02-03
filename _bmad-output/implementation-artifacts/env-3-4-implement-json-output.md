# Story 3.4: Implement JSON Output

Status: done

## Story

As a **script or orchestrator**,
I want **machine-readable output from list command**,
So that **I can programmatically discover and manage instances**.

## Acceptance Criteria

1. **Given** I run `agent-env list --json`
   **When** instances exist
   **Then** I get JSON output: `{ "ok": true, "data": [...], "error": null }`

2. **Given** the JSON output data array
   **When** I inspect an instance object
   **Then** it includes: name, status, lastAttached, purpose, gitState

3. **Given** an error occurs during list
   **When** I run `agent-env list --json`
   **Then** I get: `{ "ok": false, "data": null, "error": { "code": "...", "message": "...", "suggestion?": "..." } }` (per `AppError` contract)

4. **Given** I pipe output through jq
   **When** I run `agent-env list --json | jq '.data[].name'`
   **Then** I get a list of instance names

## Tasks / Subtasks

- [x] Task 1: Verify existing --json flag implementation (AC: #1, #2, #3, #4)
  - [x] 1.1 Verify `--json` flag is registered on list command
  - [x] 1.2 Verify JSON success output uses `JsonOutput<InstanceInfo[]>` contract
  - [x] 1.3 Verify JSON error output uses `JsonOutput<never>` contract
  - [x] 1.4 Verify colored/formatted output is suppressed when --json

- [x] Task 2: Write dedicated command-level tests for JSON output (AC: #1, #2, #3, #4)
  - [x] 2.1 Create `packages/agent-env/src/commands/list.test.ts`
  - [x] 2.2 Test JSON success output with instances (AC: #1, #2)
  - [x] 2.3 Test JSON error output structure (AC: #3)
  - [x] 2.4 Test JSON output with empty instances (AC: #1)
  - [x] 2.5 Test JSON output contains all required fields per instance (AC: #2)
  - [x] 2.6 Test exit code 0 for success path

- [x] Task 3: Run full test suite and verify no regressions (AC: #1-#4)
  - [x] 3.1 Run `pnpm --filter @zookanalytics/agent-env test:run` — 249 tests pass
  - [x] 3.2 Run `pnpm -r test:run` for all packages — 325 tests pass across all packages
  - [x] 3.3 Run `pnpm --filter @zookanalytics/agent-env type-check` — clean

## Dev Notes

### Architecture Requirements

**Existing Implementation:** The `--json` flag and JSON output logic were implemented during Story 3.2 (basic list) and Story 3.3 (git state indicators). The list command (`packages/agent-env/src/commands/list.ts`) already:
- Registers `--json` option
- Uses `JsonOutput<T>` from `@zookanalytics/shared`
- Outputs `{ ok: true, data: [...], error: null }` for success
- Outputs `{ ok: false, data: null, error: { code, message } }` for errors
- Includes gitState in the JSON data array
- Suppresses Ink rendering when --json is active

**What Was Added:** Dedicated command-level unit tests for `list.ts` that specifically validate the JSON output contract. Tests mock `listInstances()` at the module boundary and verify:
- Success JSON structure with instances
- Empty instance list JSON structure
- Error JSON structure with code and message
- Field completeness per instance (name, status, lastAttached, purpose, gitState)
- Null value preservation for optional fields
- GitState details in JSON output
- No extra fields beyond the contract
- process.exit behavior (0 for success, 1 for error)
- Ink rendering suppression when --json is used
- Valid parseable JSON output with pretty-printing

### Project Structure Notes

- Follows existing patterns from Story 3.1 (git.ts) and Story 3.2 (InstanceList.tsx)
- `.js` extension on all local imports (ESM requirement)
- Co-located tests: `list.ts` → `list.test.ts`
- Uses vi.mock for module mocking pattern

### References

- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-3.4]
- [Source: _bmad-output/implementation-artifacts/env-3-3-add-git-state-indicators-to-list.md]
- [Source: _bmad-output/implementation-artifacts/env-3-2-implement-list-command-basic.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Code Review & Fixes
- **Review Agent:** Claude Opus 4.5 (claude-opus-4-5-20251101) via BMAD adversarial code review
- **Review Date:** 2026-02-03
- **Findings:** 3 HIGH, 3 MEDIUM, 1 LOW
- **Summary of Fixes Applied:**
  - **[H1] AC #3 text alignment:** Updated AC #3 to acknowledge optional `suggestion` field per `AppError` contract
  - **[H2] Test exitCode leak:** Added `process.exitCode = undefined` in afterEach to prevent cross-file test pollution
  - **[H3] Extra blank lines:** Removed double blank lines in test file for consistent code style
  - **[M1] Ink render ordering reverted:** Restored safer `unmount()` then `await waitUntilExit()` for static renders to prevent potential hang
  - **[M2+M3] Non-JSON error path tests:** Added 2 tests for stderr error output path, making consoleErrorSpy meaningful
- **Not Fixed (LOW):**
  - **[L1] Pre-populated review notes:** Story had anticipatory review notes from "Gemini Pro" — documented as provenance concern

### Debug Log References

None — implementation proceeded without issues.

### Completion Notes List

- Verified that `--json` flag was already fully implemented in `list.ts` during Stories 3.2 and 3.3
- The `JsonOutput<T>` type from `@zookanalytics/shared` was already in use with proper `{ ok, data, error }` contract
- Created `packages/agent-env/src/commands/list.test.ts` with 13 dedicated tests for JSON output
- Tests use vi.mock to mock `listInstances` at module boundary and capture `console.log` output
- Tests verify: success/error JSON structure, field completeness, null preservation, gitState details, exit codes, Ink suppression, and valid JSON
- All 251 agent-env tests pass (15 new + 236 existing, zero regressions) after review fixes
- TypeScript type-check passes cleanly

### Change Log

- 2026-02-03: Story created — verified existing implementation, wrote comprehensive command-level tests for JSON output contract
- 2026-02-03: Code review performed; applied fixes for exit handling, error reporting, and Ink rendering.
- 2026-02-03: Adversarial code review (BMAD workflow) — 7 findings (3H/3M/1L), 6 auto-fixed, 251 tests pass.

### File List

**New Files:**
- packages/agent-env/src/commands/list.test.ts

**Modified Files:**
- _bmad-output/implementation-artifacts/sprint-status.yaml (env-3-4 status updated)
- _bmad-output/implementation-artifacts/env-3-4-implement-json-output.md (story file created and completed)
- packages/agent-env/src/commands/list.ts (refactored during code review)
