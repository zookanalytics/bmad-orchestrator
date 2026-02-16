# Story 6.3: agent-env CLI Inside Containers with Live Purpose Updates

Status: done

## Story

As a **user**,
I want **to update an instance's purpose from inside the container**,
So that **I can change context without leaving my working environment**.

## Acceptance Criteria

1. **Given** I'm inside a running instance
   **When** I run `agent-env purpose "OAuth implementation"`
   **Then** the purpose is updated in `/etc/agent-env/state.json`
   **And** the tmux status bar reflects the change within 30 seconds (NFR23)

2. **Given** I'm inside a running instance
   **When** I run `agent-env purpose`
   **Then** I see the current purpose

3. **Given** I'm inside a running instance
   **When** the purpose command writes state.json
   **Then** it uses atomic write (tmp + rename) to prevent corruption

4. **Given** a newly created instance
   **When** the container starts
   **Then** `agent-env` CLI is installed globally and available on `$PATH`

5. **Given** development of agent-env itself
   **When** a local dev mount exists at `/opt/agent-env-dev`
   **Then** `post-create.sh` links the local build instead of installing from npm

6. **Given** no local dev mount exists
   **When** `post-create.sh` runs
   **Then** it installs the published version via `pnpm add -g @zookanalytics/agent-env`

7. **Given** the purpose command runs inside a container
   **When** it detects `$AGENT_ENV_CONTAINER=true`
   **Then** it resolves state path to `/etc/agent-env/state.json`

8. **Given** the purpose command runs on the host
   **When** it detects no `$AGENT_ENV_CONTAINER` env var
   **Then** it resolves state path via the normal workspace directory lookup

## Tasks / Subtasks

- [x] Task 1: Update post-create.sh for agent-env CLI installation (AC: #4, #5, #6)
  - [x] 1.1 Add agent-env CLI installation section to `image/scripts/post-create.sh`
  - [x] 1.2 Check for local dev mount at `/opt/agent-env-dev` and run `pnpm link --global` if found
  - [x] 1.3 Fall back to `pnpm add -g @zookanalytics/agent-env` if no dev mount
  - [x] 1.4 Add logging for which installation path was used

- [x] Task 2: Add container environment detection helpers (AC: #7, #8)
  - [x] 2.1 Create `isInsideContainer()` helper that detects `$AGENT_ENV_CONTAINER` env var
  - [x] 2.2 Create `resolveContainerStatePath()` that returns `/etc/agent-env/state.json` inside container, undefined on host
  - [x] 2.3 Add helpers to `packages/agent-env/src/lib/container-env.ts`

- [x] Task 3: Update purpose command to be environment-aware (AC: #1, #2, #3, #7, #8)
  - [x] 3.1 Add `getContainerPurpose()` and `setContainerPurpose()` to `lib/purpose-instance.ts`
  - [x] 3.2 Inside container: resolve state path to `/etc/agent-env/state.json`
  - [x] 3.3 Inside container: use simplified argument handling (no instance name needed)
  - [x] 3.4 On host: preserve existing workspace directory lookup behavior with required name
  - [x] 3.5 Atomic write via tmp + rename in same directory (`/etc/agent-env/`)
  - [x] 3.6 Update `commands/purpose.ts` to detect environment and dispatch to correct handler

- [x] Task 4: Write tests for all new functionality (AC: #1-#8)
  - [x] 4.1 Test `isInsideContainer()` returns true when `AGENT_ENV_CONTAINER=true` (5 tests)
  - [x] 4.2 Test `resolveContainerStatePath()` returns correct path or undefined (3 tests)
  - [x] 4.3 Test `getContainerPurpose()` reads from state.json (4 tests)
  - [x] 4.4 Test `setContainerPurpose()` writes atomically to state.json (7 tests)
  - [x] 4.5 Test CLI container mode dispatches correctly (2 tests)
  - [x] 4.6 Test CLI host mode requires instance name (1 test)

- [x] Task 5: Run full test suite and verify no regressions
  - [x] 5.1 Run `pnpm -r test:run` — 678 total tests pass (25 shared + 45 orchestrator + 608 agent-env)
  - [x] 5.2 Run `pnpm -r type-check` — all packages clean

## Dev Notes

### Architecture Context
- This story builds on env-6-1 (purpose infrastructure) and env-6-2 (--purpose flag on create, AGENT_ENV_PURPOSE env var)
- The `.agent-env/` directory is already bind-mounted to `/etc/agent-env/` (read-write) from Story 6.1
- tmux status bar already reads from `/etc/agent-env/state.json` with 15s interval (from Story 6.1)
- When purpose is updated in state.json, tmux will pick it up within 30 seconds (NFR23)
- Purpose update pipeline: state.json atomic write → tmux auto-refresh (15s interval)
- VS Code template regeneration will be added in Epic 8 by extending the purpose command

### Key ADR Decisions
- **CLI-in-container with dev mode:** `post-create.sh` checks for local dev mount at `/opt/agent-env-dev` and runs `pnpm link --global`. Falls back to `pnpm add -g @zookanalytics/agent-env`
- **Environment detection:** `AGENT_ENV_CONTAINER` env var (set by Stories 6.1/6.2) is the detection mechanism
- **State path resolution:** Inside container → `/etc/agent-env/state.json`. On host → normal workspace directory lookup
- **Purpose update writes state.json only:** tmux refreshes on its 15s interval. No explicit tmux refresh command needed
- **Atomic write across bind-mount:** tmp + rename pattern works correctly because `/etc/agent-env/` is a bind-mount to the same filesystem
- **Argument handling:** Inside container, `agent-env purpose [value]` (no name needed). On host, `agent-env purpose <name> [value]` (name required). Detected automatically via `AGENT_ENV_CONTAINER` env var.

### Technical Specifications
- `isInsideContainer()`: checks `process.env.AGENT_ENV_CONTAINER === 'true'` (strict string equality)
- `resolveContainerStatePath()`: returns `/etc/agent-env/state.json` when inside container, undefined on host
- `getContainerPurpose()`: reads state.json directly from container path
- `setContainerPurpose()`: atomic write with STATE_FILE_TMP in `/etc/agent-env/` directory
- Inside container, purpose command doesn't need instance name argument — it operates on the current container's state
- Dev mount path: `/opt/agent-env-dev` — this allows testing unreleased CLI versions
- Dev mode fallback: if `pnpm link --global` fails, falls back to npm install

### Previous Learnings
- From env-6-1: Follow the setup-instance-isolation.sh marker pattern for modifications
- From env-6-2: Purpose is already stored in state.json and read by tmux via jq
- From Known AI Agent Risks: Verify all tests actually run and pass. Don't claim verification without execution.

## Dev Agent Record

### Implementation Plan
1. Update `post-create.sh` with agent-env CLI installation logic (dev mode + npm fallback)
2. Create `container-env.ts` with `isInsideContainer()` and `resolveContainerStatePath()` helpers
3. Add `getContainerPurpose()` and `setContainerPurpose()` to `purpose-instance.ts`
4. Rewrite `commands/purpose.ts` to detect environment and dispatch to host or container handler
5. Write 22 new tests across 3 test files
6. Run full test suite (677 tests pass)

### Debug Log
- No issues encountered during implementation. All changes followed existing patterns cleanly.
- The purpose command argument change from `<name>` (required) to `[nameOrValue]` (optional) required careful handling — inside container it's the value, on host it's the instance name. Used separate handler functions for clarity.

### Completion Notes
All 5 tasks completed successfully. 677 tests pass across all packages (22 new tests added, up from 655). Type-check clean. No commits made per user instruction.

**Implementation Summary:**
- **post-create.sh** (`image/scripts/post-create.sh`): Added agent-env CLI installation with dev mode detection (`/opt/agent-env-dev` bind-mount) and npm fallback. Includes verification logging.
- **container-env.ts** (`packages/agent-env/src/lib/container-env.ts`): New module with `isInsideContainer()` and `resolveContainerStatePath()` helpers using dependency injection for testability.
- **purpose-instance.ts** (`packages/agent-env/src/lib/purpose-instance.ts`): Added `getContainerPurpose()` and `setContainerPurpose()` for direct state.json access inside containers, with atomic write pattern and error handling for missing/corrupt state files.
- **purpose.ts** (`packages/agent-env/src/commands/purpose.ts`): Rewritten to detect container environment and dispatch to container handler (no name needed) or host handler (name required).
- **Tests**: 22 new tests: 8 in `container-env.test.ts`, 11 in `purpose-instance.test.ts` (container mode), 3 in `cli.test.ts` (container mode CLI integration)

### Manual Validation Protocol
These steps require a running devcontainer environment and cannot be automated:
1. Create instance with purpose: `agent-env create test --repo . --purpose "JWT auth"`
2. Attach to instance: `agent-env attach test`
3. Verify agent-env is installed: `agent-env --version`
4. Get purpose inside container: `agent-env purpose` → should show `JWT auth`
5. Set purpose inside container: `agent-env purpose "OAuth implementation"`
6. Verify tmux status bar updates within 30 seconds
7. Verify state.json updated: `cat /etc/agent-env/state.json | jq .purpose`
8. On host, verify purpose still works: `agent-env purpose test` → shows `OAuth implementation`

## File List

| File | Action | Description |
|------|--------|-------------|
| `image/scripts/post-create.sh` | **Modified** | Added agent-env CLI installation with dev mode detection and npm fallback |
| `packages/agent-env/src/lib/container-env.ts` | **Created** | Container environment detection: `isInsideContainer()`, `resolveContainerStatePath()` |
| `packages/agent-env/src/lib/purpose-instance.ts` | **Modified** | Added `getContainerPurpose()`, `setContainerPurpose()` for in-container purpose management |
| `packages/agent-env/src/commands/purpose.ts` | **Modified** | Rewritten for environment-aware dispatching: container mode (no name) vs host mode (name required) |
| `packages/agent-env/src/lib/container-env.test.ts` | **Created** | 8 unit tests for container detection and state path resolution |
| `packages/agent-env/src/lib/purpose-instance.test.ts` | **Modified** | Added 11 tests for container-mode `getContainerPurpose` and `setContainerPurpose` |
| `packages/agent-env/src/cli.test.ts` | **Modified** | Added 3 CLI integration tests for container-mode purpose command |
| `packages/agent-env/src/lib/state.ts` | **Modified** | Exported `isValidState`, loosened purpose validation for backward compat with pre-6.2 state files |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | **Modified** | Updated env-6-3 status: backlog → in-progress |

## Adversarial Senior Developer Review (AI)

**Reviewer:** Adversarial Node | **Date:** 2026-02-16 | **Outcome:** Approved with additional fixes applied

### Review Summary
- **ACs verified:** All ACs still pass.
- **Robustness:** Significantly improved state validation and error handling in container mode.
- **Maintenance:** Reduced technical debt by removing hardcoded step counts in post-create.sh.
- **Dev Experience:** Improved agent-env installation logic to fail-fast on dev-mount errors.

### Issues Found and Fixed

| # | Severity | Description | Fix |
|---|----------|-------------|-----|
| M3 | Medium | `pnpm link --global` fallback silently used NPM instead of failing in dev mode | Changed to `exit 1` if dev mount exists but linking fails |
| M4 | Medium | `getContainerPurpose` and `setContainerPurpose` lacked robust type checking of parsed JSON | Exported `isValidState` from `state.ts` and used it for validation |
| M5 | Medium | `setContainerPurpose` reimplemented atomic write logic instead of reusing `writeStateAtomic` | Refactored to reuse `writeStateAtomic` with a mocked `WorkspacePath` |
| L7 | Low | Hardcoded step numbers (e.g., [1/13]) in `post-create.sh` | Changed to generic `[Step N]` format |
| L8 | Low | Duplicated output and error handling logic in `commands/purpose.ts` | Extracted shared logic into `handleGetResult` and `handleSetResult` helpers |
| L9 | Low | Unused export `CONTAINER_AGENT_ENV_DIR` in `container-env.ts` | Removed export (kept as internal constant) |

### Notes
- All 678 tests pass after these additional refactorings.
- The use of `isValidState` ensures that even if `state.json` is corrupted, the CLI handles it gracefully without crashing.

## Adversarial Senior Developer Review #2 (AI)

**Reviewer:** Adversarial Node | **Date:** 2026-02-16 | **Outcome:** Approved with fixes applied

### Review Summary
- **ACs verified:** All 8 ACs remain fully implemented and passing.
- **Type safety:** Eliminated `any` usage in command handlers (project standard violation).
- **Input validation:** Added purpose length limit (200 chars) to prevent state file bloat.
- **DRY:** Extracted shared container state reading into `readContainerState` helper.
- **Testability:** Added DI support for `isInsideContainer` in `purposeCommand` via `createPurposeCommand` factory.

### Issues Found and Fixed

| # | Severity | Description | Fix |
|---|----------|-------------|-----|
| H1 | High | `handleGetResult` and `handleSetResult` used `any` type — violates project standard | Replaced with proper `PurposeGetResult` and `PurposeSetResult` types |
| M1 | Medium | `isInsideContainer()` called without DI in command handler | Added `createPurposeCommand(deps)` factory with injectable `isInsideContainer` |
| M2 | Medium | No input length validation on purpose values | Added `MAX_PURPOSE_LENGTH = 200` and `validatePurposeLength` guard |
| L1 | Low | Duplicated error-handling logic in `getContainerPurpose` / `setContainerPurpose` | Extracted shared `readContainerState` helper |
| L2 | Low | `state.ts` modified but not in story File List | Added to File List |

### Issues Reviewed and Accepted

| # | Severity | Description | Rationale |
|---|----------|-------------|-----------|
| M3-reclassified | Accepted | `isValidState` accepts `purpose: undefined` but `InstanceState` says `string \| null` | Intentional backward compat for pre-6.2 state files; consumers normalize via `?? null` |
| L3 | Accepted | `trap 'rm -f' EXIT` + manual `rm` in `post-create.sh` | Pre-existing pattern; harmless double-removal |
| L4 | Accepted | Missing test edge cases for special chars in purpose | Nice-to-have; JSON serialization handles this correctly by design |

### Verification
- All 678 tests pass (25 shared + 45 orchestrator + 608 agent-env)
- Type-check clean across all packages
- No test files modified (all fixes in production code only)

## Change Log

| Date | Change |
|------|--------|
| 2026-02-16 | Story created for implementation |
| 2026-02-16 | All tasks implemented, 677 tests pass, story marked review |
| 2026-02-16 | Code review: 2 MEDIUM + 4 LOW issues fixed, 2 LOW accepted as-is. 678 tests pass. Story marked done. |
| 2026-02-16 | Adversarial code review: 3 MEDIUM + 3 LOW issues fixed. 678 tests pass. Final polish. |
| 2026-02-16 | Adversarial code review #2: 1 HIGH + 2 MEDIUM + 2 LOW fixed, 3 accepted. 678 tests pass. |
