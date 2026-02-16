# Story 6.2: --purpose flag on create and AGENT_ENV_PURPOSE env var

Status: done

## Story

As a **user**,
I want **to set an instance's purpose at creation time**,
So that **the context is visible from the very first attach**.

## Acceptance Criteria

1. **Given** I run `agent-env create auth --repo <url> --purpose "JWT authentication"`
   **When** the instance is created
   **Then** state.json contains `"purpose": "JWT authentication"`
   **And** the tmux bar shows the purpose on first attach

2. **Given** I run `agent-env create auth --repo <url>` without `--purpose`
   **When** the instance is created
   **Then** state.json contains `"purpose": null`
   **And** the tmux bar shows instance name only

3. **Given** an instance with purpose "JWT work"
   **When** I open a new shell inside the container
   **Then** `$AGENT_ENV_PURPOSE` is set to `JWT work`

4. **Given** an instance with no purpose
   **When** I open a shell inside the container
   **Then** `$AGENT_ENV_PURPOSE` is set to an empty string

## Tasks / Subtasks

- [x] Task 1: Add `--purpose` flag to create command (AC: #1, #2)
  - [x] 1.1 Add `--purpose <text>` option to `commands/create.ts`
  - [x] 1.2 Pass purpose through to `createInstance()` in `lib/create-instance.ts`

- [x] Task 2: Write purpose to state.json during instance creation (AC: #1, #2)
  - [x] 2.1 Add optional `purpose` parameter to `createInitialState()` in `lib/state.ts`
  - [x] 2.2 Wire purpose from `createInstance()` to `createInitialState()` call
  - [x] 2.3 Add `AGENT_ENV_PURPOSE` to `patchContainerEnv()` call for baseline configs

- [x] Task 3: Add AGENT_ENV_PURPOSE shell init to baseline container (AC: #3, #4)
  - [x] 3.1 Add jq-based `AGENT_ENV_PURPOSE` export to `setup-instance-isolation.sh`
  - [x] 3.2 Export reads from `/etc/agent-env/state.json` at shell startup via `.zshrc`

- [x] Task 4: Write tests for all new functionality (AC: #1-#4)
  - [x] 4.1 Test `--purpose` flag is documented in `create --help` output (cli.test.ts)
  - [x] 4.2 Test `createInstance()` writes purpose to state.json when provided
  - [x] 4.3 Test `createInstance()` writes purpose as null when not provided
  - [x] 4.4 Test `AGENT_ENV_PURPOSE` is included in `patchContainerEnv()` call (with value)
  - [x] 4.5 Test `AGENT_ENV_PURPOSE` is empty string in `patchContainerEnv()` when no purpose
  - [x] 4.6 Test `createInitialState()` accepts and stores purpose string
  - [x] 4.7 Test `createInitialState()` stores purpose as null when provided as null
  - [x] 4.8 Test `createInitialState()` defaults purpose to null when not provided
  - [x] 4.9 Test `createInitialState()` stores purpose alongside other options

- [x] Task 5: Run full test suite and verify no regressions
  - [x] 5.1 Run `pnpm -r test:run` — 654 total tests pass (25 shared + 45 orchestrator + 584 agent-env)
  - [x] 5.2 Run `pnpm -r type-check` — all packages clean

## Dev Notes

### Architecture Context
- This story builds on env-6-1 which established the purpose infrastructure (tmux display, bind-mount, static env vars)
- Purpose is written to state.json during create, which is already bind-mounted to `/etc/agent-env/state.json` in the container
- The tmux status bar (from Story 6.1) already reads purpose from state.json — setting purpose at create time means it displays immediately on first attach
- `AGENT_ENV_PURPOSE` is set at shell startup (not live-updated). Live updates are via tmux bar (Story 6.1) and purpose command (Story 6.3)
- `patchContainerEnv()` sets env vars in `devcontainer.json`'s `containerEnv` — these are available to all processes in the container, not just shells
- The jq-based `.zshrc` export provides the env var in interactive shells, reading current value from state.json each time a new shell opens

### Key ADR Decisions
- **containerEnv for AGENT_ENV_PURPOSE:** Set in `containerEnv` via `patchContainerEnv()` so it's available to all container processes (not just shells). Initial value set at create time. Shell init re-reads from state.json for updated values.
- **Shell init reads state.json:** Each new shell reads current purpose from state.json via jq. This means after `agent-env purpose <name> "new purpose"` updates state.json, new shells will pick up the change.
- **Empty string for no purpose:** When purpose is null in state.json, `AGENT_ENV_PURPOSE` is set to empty string (not unset). Consistent behavior for scripts that check the variable.

### Technical Specifications
- `--purpose <text>` option on create command (optional, defaults to undefined)
- `createInitialState()` accepts optional `purpose` parameter, defaults to null
- `patchContainerEnv()` includes `AGENT_ENV_PURPOSE` (value or empty string for null)
- Shell init: `export AGENT_ENV_PURPOSE=$(jq -r '.purpose // ""' /etc/agent-env/state.json 2>/dev/null)` in `.zshrc`

### Previous Learnings
- From env-6-1: Follow the patchContainerEnv() pattern for per-instance env vars
- From env-6-1: Use setup-instance-isolation.sh marker pattern for .zshrc modifications
- From Known AI Agent Risks: Verify all tests actually run and pass. Don't claim verification without execution.

## Dev Agent Record

### Implementation Plan
1. Add `--purpose <text>` option to `commands/create.ts`
2. Update `createInstance()` signature to accept optional purpose parameter
3. Update `createInitialState()` to accept optional purpose parameter
4. Wire purpose through patchContainerEnv() for AGENT_ENV_PURPOSE
5. Add jq-based AGENT_ENV_PURPOSE export to setup-instance-isolation.sh
6. Write tests for all changes
7. Run full test suite

### Debug Log
- No issues encountered during implementation. All changes followed existing patterns cleanly.

### Completion Notes
All 5 tasks completed successfully. 654 tests pass across all packages (8 new tests added, up from 646). Type-check clean. No commits made per user instruction.

**Implementation Summary:**
- **create command** (`commands/create.ts`): Added `--purpose <text>` option, passed to `createInstance()` via options parameter
- **createInstance()** (`lib/create-instance.ts`): Added optional `{ purpose }` options parameter, passed to both `patchContainerEnv()` (as `AGENT_ENV_PURPOSE`) and `createInitialState()` (as `purpose`)
- **createInitialState()** (`lib/state.ts`): Extended options to accept `purpose?: string | null`, defaults to null
- **patchContainerEnv()**: Now receives `AGENT_ENV_PURPOSE` alongside existing `AGENT_ENV_INSTANCE` and `AGENT_ENV_REPO`
- **setup-instance-isolation.sh**: Added Step 11b to export `AGENT_ENV_PURPOSE` via jq-based read from `/etc/agent-env/state.json` in `.zshrc`
- **Tests**: 8 new tests added: 4 in `state.test.ts` (purpose parameter handling), 4 in `create-instance.test.ts` (purpose in state.json and patchContainerEnv), 1 updated in `cli.test.ts` (--purpose in help output)

### Manual Validation Protocol
These steps require a running devcontainer environment and cannot be automated:
1. Create instance with purpose: `agent-env create test --repo . --purpose "JWT authentication"`
2. Attach to instance: `agent-env attach test`
3. Verify tmux status bar shows: `test | JWT authentication`
4. Open new shell and verify: `echo $AGENT_ENV_PURPOSE` → `JWT authentication`
5. Create instance without purpose: `agent-env create test2 --repo .`
6. Attach and verify: `echo $AGENT_ENV_PURPOSE` → (empty string)
7. Verify tmux shows instance name only (no trailing pipe)

## File List

| File | Action | Description |
|------|--------|-------------|
| `packages/agent-env/src/commands/create.ts` | **Modified** | Added `--purpose <text>` option, passed to `createInstance()` via options parameter |
| `packages/agent-env/src/lib/create-instance.ts` | **Modified** | Added optional `{ purpose }` options parameter, wired to `patchContainerEnv()` and `createInitialState()` |
| `packages/agent-env/src/lib/state.ts` | **Modified** | Extended `createInitialState()` options to accept `purpose?: string \| null` |
| `image/scripts/setup-instance-isolation.sh` | **Modified** | Added Step 11b: jq-based `AGENT_ENV_PURPOSE` export to `.zshrc` |
| `packages/agent-env/src/lib/state.test.ts` | **Modified** | Added 4 tests for `createInitialState()` purpose parameter handling |
| `packages/agent-env/src/lib/create-instance.test.ts` | **Modified** | Added 4 tests for purpose in state.json and `patchContainerEnv()` |
| `packages/agent-env/src/cli.test.ts` | **Modified** | Updated create --help test to verify `--purpose` option is documented |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | **Modified** | Updated env-6-2 status: backlog → in-progress → review |

## Senior Developer Review (AI)

**Reviewer:** Node | **Date:** 2026-02-16 | **Outcome:** Approved with fixes applied

### Review Summary
- **ACs verified:** All 4 ACs implemented correctly
- **Tasks audited:** All 5 tasks (9 subtask items) verified as genuinely complete
- **Tests verified:** 654 tests passing (confirmed by running `pnpm -r test:run`)
- **Type-check:** Clean (confirmed by running `pnpm -r type-check`)
- **Git vs Story discrepancies:** 0

### Issues Found and Fixed

| # | Severity | Description | Fix |
|---|----------|-------------|-----|
| M1 | Medium | `grep -q` in Step 11b of `setup-instance-isolation.sh` treats `[` as regex metachar — should use `grep -qF` for fixed string match. Also `sed` pattern needs bracket escaping. | Changed to `grep -qF` and added `sed` bracket escaping via `printf + sed` |
| M2 | Medium | No test coverage for `devcontainerUp` `remoteEnv` when purpose is NOT provided (only covered with purpose) | Added test: "passes empty string AGENT_ENV_PURPOSE in devcontainerUp remoteEnv when no purpose" |

### Notes
- The `grep -q` vs `grep -qF` issue is pre-existing across Steps 9, 11 of `setup-instance-isolation.sh` (same pattern with `[` in markers). Fixed only in Step 11b per story scope. Consider fixing Steps 9 and 11 in a follow-up.
- 655 tests pass after review fixes (1 new test added).

## Change Log

| Date | Change |
|------|--------|
| 2026-02-16 | Story created for implementation |
| 2026-02-16 | All tasks implemented, 654 tests pass, story marked review |
| 2026-02-16 | Code review: 2 medium issues found and fixed, 655 tests pass, story marked done |
