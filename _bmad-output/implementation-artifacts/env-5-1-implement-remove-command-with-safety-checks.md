# Story 5.1: Implement Remove Command with Safety Checks

Status: done

## Story

As a **user**,
I want **remove to block when I have unsaved work**,
So that **I never accidentally lose code**.

## Acceptance Criteria

1. **Given** an instance "auth" with clean git state (nothing uncommitted, nothing unpushed)
   **When** I run `agent-env remove auth`
   **Then** the instance is removed (container stopped, workspace deleted)
   **And** I see confirmation "Instance 'auth' removed"

2. **Given** an instance "auth" with a running container
   **When** I run `agent-env remove auth`
   **Then** the container is stopped before workspace deletion
   **And** the removal proceeds normally after container stops

3. **Given** container stop times out (> 30 seconds)
   **When** removal is in progress
   **Then** the operation fails with clear error message
   **And** suggests "docker stop <container> --force" if user wants to proceed manually

4. **Given** an instance with staged changes
   **When** I run `agent-env remove auth`
   **Then** the removal is blocked
   **And** I see "Cannot remove: staged changes detected"

5. **Given** an instance with unstaged changes
   **When** I run `agent-env remove auth`
   **Then** the removal is blocked
   **And** I see "Cannot remove: unstaged changes detected"

6. **Given** an instance with untracked files
   **When** I run `agent-env remove auth`
   **Then** the removal is blocked
   **And** I see "Cannot remove: untracked files detected"

7. **Given** an instance with stashed changes
   **When** I run `agent-env remove auth`
   **Then** the removal is blocked
   **And** I see "Cannot remove: stashed changes detected (N stashes)"

8. **Given** an instance with unpushed commits on ANY branch
   **When** I run `agent-env remove auth`
   **Then** the removal is blocked
   **And** I see "Cannot remove: unpushed commits on branches: feature-x, bugfix-y"

9. **Given** an instance with never-pushed branches
   **When** I run `agent-env remove auth`
   **Then** the removal is blocked
   **And** I see "Cannot remove: branches never pushed: new-feature"

10. **Given** an instance in detached HEAD state
    **When** I run `agent-env remove auth`
    **Then** the removal is blocked
    **And** I see "Cannot remove: detached HEAD state (investigate manually)"

11. **Given** the instance does not exist
    **When** I run `agent-env remove nonexistent`
    **Then** I get error "Instance 'nonexistent' not found"

## Tasks / Subtasks

- [x] Task 1: Add containerStop and containerRemove to container.ts (AC: #2, #3)
  - [x] 1.1 Add `containerStop(containerName)` to `ContainerLifecycle` interface — uses `docker stop` with 30s timeout
  - [x] 1.2 Add `containerRemove(containerName)` to `ContainerLifecycle` interface — uses `docker rm` to remove stopped container
  - [x] 1.3 Write tests for containerStop and containerRemove

- [x] Task 2: Add deleteWorkspace to workspace.ts (AC: #1)
  - [x] 2.1 Add `deleteWorkspace(wsPath)` function — recursively removes workspace folder
  - [x] 2.2 Write tests for deleteWorkspace

- [x] Task 3: Create remove-instance.ts orchestration module (AC: #1-#11)
  - [x] 3.1 Create `packages/agent-env/src/lib/remove-instance.ts` with types, deps interface, and factory
  - [x] 3.2 Implement safety check evaluation using `getGitState()` from git.ts
  - [x] 3.3 Implement removal orchestration: safety checks → stop container → remove container → delete workspace
  - [x] 3.4 Format safety check failure messages with specific blockers

- [x] Task 4: Write tests for remove-instance.ts (AC: #1-#11)
  - [x] 4.1 Test successful removal of clean instance (AC: #1)
  - [x] 4.2 Test container is stopped before deletion (AC: #2)
  - [x] 4.3 Test container stop timeout error (AC: #3)
  - [x] 4.4 Test all safety check blockers: staged, unstaged, untracked, stashed, unpushed, never-pushed, detached HEAD (AC: #4-#10)
  - [x] 4.5 Test instance not found error (AC: #11)
  - [x] 4.6 Test Docker unavailable returns ORBSTACK_REQUIRED
  - [x] 4.7 Test git state detection failure handling

- [x] Task 5: Replace remove command placeholder (AC: #1-#11)
  - [x] 5.1 Update `packages/agent-env/src/commands/remove.ts` to use remove-instance module
  - [x] 5.2 Add proper error formatting and exit codes
  - [x] 5.3 Update CLI test to expect WORKSPACE_NOT_FOUND instead of NotImplemented

- [x] Task 6: Run full test suite and verify no regressions (AC: #1-#11)
  - [x] 6.1 Run `pnpm --filter @zookanalytics/agent-env test:run` — all tests pass
  - [x] 6.2 Run `pnpm -r test:run` for all packages — no regressions
  - [x] 6.3 Run `pnpm --filter @zookanalytics/agent-env type-check` — clean

## Dev Notes

### Architecture Requirements

**Existing Code Reused:**
- `getGitState()` from `git.ts` — provides complete git state detection (staged, unstaged, untracked, stashed, unpushed, never-pushed, detached HEAD)
- `findWorkspaceByName()` from `attach-instance.ts` — workspace discovery by instance name
- `readState()` from `state.ts` — reads state.json for container name
- `createContainerLifecycle()` from `container.ts` — container status, stop, remove
- `scanWorkspaces()` + `getWorkspacePathByName()` — instance path resolution

**New Code:**
- `remove-instance.ts` — orchestrates the full removal flow with safety checks
- `containerStop()` + `containerRemove()` in `container.ts` — new container lifecycle methods
- `deleteWorkspace()` in `workspace.ts` — recursive workspace folder deletion

**Key Design Decisions:**
- Follows `attach-instance.ts` DI pattern: deps interface + factory function
- Safety checks use `getGitState()` then evaluate each field for blockers
- Removal order: run safety checks → stop container → remove container → delete workspace folder
- Safety check failures return `SAFETY_CHECK_FAILED` error code with detailed blocker list
- `containerStop` uses 30s timeout, returns `CONTAINER_STOP_TIMEOUT` on timeout
- `deleteWorkspace` uses `rm -rf` equivalent via `node:fs/promises`
- Container not-found during stop is not an error (already cleaned up)

### References

- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-5.1]
- [Source: packages/agent-env/src/lib/attach-instance.ts (DI pattern)]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None.

### Completion Notes List

- Task 1: Added `containerStop()` (30s timeout, idempotent for not-found) and `containerRemove()` (10s timeout, idempotent for not-found) to `ContainerLifecycle` interface. 10 new tests, all pass.
- Task 2: Added `deleteWorkspace()` with separate `DeleteFsDeps` interface to avoid breaking existing callers. Uses `rm({recursive: true, force: true})`. 3 new tests, all pass.
- Task 3: Created `remove-instance.ts` following attach-instance DI pattern. `evaluateSafetyChecks()` evaluates 7 git state conditions and returns blocker list. `removeInstance()` orchestrates: find workspace → check Docker → git safety → stop container → remove container → delete workspace.
- Task 4: 32 comprehensive tests covering all safety checks, error paths, success paths, and edge cases.
- Task 5: Replaced placeholder in `commands/remove.ts` with real implementation. Updated CLI integration test.
- Task 6: All 461 tests pass (25 shared + 51 orchestrator + 385 agent-env). TypeScript type-check clean. Fixed mock factories in attach-instance.test.ts, create-instance.test.ts, and list-instances.test.ts to include new `containerStop`/`containerRemove` methods.

### Senior Developer Review (AI)

**Reviewer:** Code Review Agent (Claude Opus 4.6)
**Date:** 2026-02-06
**Outcome:** APPROVED (after auto-fix)

**Issues Found:** 1 High, 4 Medium, 1 Low
**Issues Fixed:** 1 High, 4 Medium (all auto-fixed)
**Issues Deferred:** 1 Low (glob dependency — cosmetic)

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| H1 | HIGH | container.ts:291 | Invalid `docker stop --force` in suggestion (no such flag) | Changed to `docker rm -f <container>` |
| M1 | MEDIUM | remove-instance.ts:11 | Unused imports: appendFile, rename, writeFile | Removed |
| M2 | MEDIUM | workspace.ts:216-229 | Dead ENOENT catch (force:true suppresses it), misleading JSDoc | Simplified to void return, removed dead branch |
| M3 | MEDIUM | remove-instance.test.ts | No unit test for force=true bypass | Added 2 tests: skips safety checks, still checks Docker |
| M4 | MEDIUM | mock-executables.js:66-118 | Git mock handlers don't match real getGitState() commands | Replaced with handlers matching actual git.ts calls |
| L1 | LOW | package.json | glob devDep added for single debug test | Deferred (cosmetic) |

**Post-fix verification:** 467 tests pass (25 shared + 51 orchestrator + 391 agent-env), type-check clean.

### Change Log

- 2026-02-06: Story created, implementation started
- 2026-02-06: All 6 tasks completed, all tests pass (461 total), type-check clean, status → review
- 2026-02-06: Code review: 5 issues fixed (1 HIGH, 4 MEDIUM), 467 tests pass, status → done

### File List

**New Files:**
- packages/agent-env/src/lib/remove-instance.ts
- packages/agent-env/src/lib/remove-instance.test.ts
- packages/agent-env/test-utils/mock-executables.js

**Modified Files:**
- packages/agent-env/src/lib/container.ts (add containerStop, containerRemove)
- packages/agent-env/src/lib/container.test.ts (add stop/remove tests)
- packages/agent-env/src/lib/workspace.ts (add deleteWorkspace)
- packages/agent-env/src/lib/workspace.test.ts (add deleteWorkspace tests)
- packages/agent-env/src/commands/remove.ts (replace placeholder)
- packages/agent-env/src/cli.test.ts (update remove test)
- packages/agent-env/src/lib/attach-instance.test.ts (add containerStop/containerRemove to mock)
- packages/agent-env/src/lib/create-instance.test.ts (add containerStop/containerRemove to mock)
- packages/agent-env/src/lib/list-instances.test.ts (add containerStop/containerRemove to mock)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status update)
- packages/agent-env/package.json
- pnpm-lock.yaml
