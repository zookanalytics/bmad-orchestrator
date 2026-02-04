# Story 3.1: Implement Git State Detection

Status: done

## Story

As a **developer**,
I want **comprehensive git state analysis for any workspace**,
So that **I can show users exactly what's at risk before destructive operations**.

## Code Review

### Review 1 — Gemini Pro

**Date:** 2026-02-03

**Summary:** The initial implementation had several critical and high-severity issues that have been addressed.

**Findings:** CRITICAL (files untracked), HIGH (parseBranches logic), MEDIUM (isClean logic, parseStatus), LOW (unnecessary else), TESTING (mock bug). All fixed.

### Review 2 — Claude Opus 4.5 (Adversarial)

**Date:** 2026-02-03

**Summary:** 0 High, 4 Medium, 2 Low issues found. All Medium issues auto-fixed. Tests increased from 39 to 42 (194 total pass).

**Findings:**

- **MEDIUM (M1) [FIXED]:** `parseBranches` used `split(' ')` which mishandles empty upstream fields from `git for-each-ref`. Real git output produces trailing spaces for empty `%(upstream:short)` fields, causing `parts[1]` to be `''` (truthy) instead of detecting no upstream. Fixed with `split(' ').filter(Boolean)` and `parts.length === 1` check. Added regression test with trailing spaces.
- **MEDIUM (M2) [FIXED]:** Shared `opts` object reference across all 4 parallel `Promise.allSettled` calls. If executor mutates options, all calls share the mutation. Fixed by using `makeOpts()` factory to create fresh object per call. Added uniqueness test.
- **MEDIUM (M3) [FIXED]:** No test verifying parallel calls receive independent option objects. Added test asserting all 4 captured opts are distinct object references.
- **MEDIUM (M4) [FIXED]:** `parseStatus` treated any non-space, non-`?` char in column 1 as staged. This would misclassify `!!` (ignored files) as staged changes. Fixed to whitelist `MADRC` chars. Added regression test with `!!` input.
- **LOW (L1):** `GIT_COMMAND_TIMEOUT` of 5000ms may be too aggressive for very large repos where `git status --porcelain` can exceed 10s. Not fixed — acceptable known limitation.
- **LOW (L2):** Story Code Review section format is non-standard. Not fixed — documentation nit.

## Acceptance Criteria

1. **Given** a workspace with staged changes
   **When** I call `getGitState(workspacePath)`
   **Then** `hasStaged` is true

2. **Given** a workspace with unstaged changes
   **When** I call `getGitState(workspacePath)`
   **Then** `hasUnstaged` is true

3. **Given** a workspace with untracked files
   **When** I call `getGitState(workspacePath)`
   **Then** `hasUntracked` is true

4. **Given** a workspace with stashed changes
   **When** I call `getGitState(workspacePath)`
   **Then** `stashCount` is greater than 0

5. **Given** a workspace with unpushed commits on any branch
   **When** I call `getGitState(workspacePath)`
   **Then** `unpushedBranches` contains those branch names

6. **Given** unpushed commits exist on branch 'feature' while I'm on branch 'main'
   **When** I call `getGitState(workspacePath)`
   **Then** `unpushedBranches` includes 'feature' (cross-branch detection)

7. **Given** a workspace with branches never pushed to any remote
   **When** I call `getGitState(workspacePath)`
   **Then** `neverPushedBranches` contains those branch names

8. **Given** a workspace in detached HEAD state
   **When** I call `getGitState(workspacePath)`
   **Then** `isDetachedHead` is true

9. **Given** a clean repository with everything pushed
   **When** I call `getGitState(workspacePath)`
   **Then** `isClean` is true

## Tasks / Subtasks

- [x] Task 1: Define GitState types in types.ts (AC: #1-#9)
  - [x] 1.1 Add `GitState` interface with all detection fields
  - [x] 1.2 Add `GitStateResult` union type (success/error pattern)

- [x] Task 2: Implement git state detection module (AC: #1-#9)
  - [x] 2.1 Create `packages/agent-env/src/lib/git.ts` with factory pattern
  - [x] 2.2 Implement working tree status detection (staged, unstaged, untracked) via `git status --porcelain`
  - [x] 2.3 Implement stash detection via `git stash list`
  - [x] 2.4 Implement cross-branch unpushed detection via `git for-each-ref`
  - [x] 2.5 Implement never-pushed branch detection (no upstream tracking)
  - [x] 2.6 Implement detached HEAD detection via `git symbolic-ref HEAD`
  - [x] 2.7 Compute `isClean` from combined state
  - [x] 2.8 Run git commands in parallel for performance

- [x] Task 3: Write comprehensive tests for git.ts (AC: #1-#9)
  - [x] 3.1 Create `packages/agent-env/src/lib/git.test.ts`
  - [x] 3.2 Test staged changes detection (AC: #1)
  - [x] 3.3 Test unstaged changes detection (AC: #2)
  - [x] 3.4 Test untracked files detection (AC: #3)
  - [x] 3.5 Test stash count detection (AC: #4)
  - [x] 3.6 Test unpushed branches detection (AC: #5)
  - [x] 3.7 Test cross-branch unpushed detection (AC: #6)
  - [x] 3.8 Test never-pushed branches detection (AC: #7)
  - [x] 3.9 Test detached HEAD detection (AC: #8)
  - [x] 3.10 Test clean repository detection (AC: #9)
  - [x] 3.11 Test git command failure handling
  - [x] 3.12 Test parallel execution uses correct commands

- [x] Task 4: Run full test suite and verify no regressions (AC: #1-#9)
  - [x] 4.1 Run `pnpm --filter @zookanalytics/agent-env test:run`
  - [x] 4.2 Run `pnpm -r test:run` for all packages
  - [x] 4.3 Run `pnpm --filter @zookanalytics/agent-env type-check`

## Dev Notes

### Architecture Requirements

**Module:** `packages/agent-env/src/lib/git.ts`

**Pattern:** Factory function with injectable executor (same as container.ts)
- `createGitStateDetector(executor)` returns object with `getGitState(workspacePath)` method
- Uses `createExecutor()` from shared package as default executor
- All git commands use `reject: false` and check `result.ok`

**Git Commands Used:**
- `git status --porcelain` — staged (lines starting with `[MADRC]`), unstaged (lines with changes in column 2), untracked (`??`)
- `git stash list` — count lines for stashCount
- `git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads` — detect `[ahead N]` for unpushed, empty upstream for never-pushed
- `git symbolic-ref HEAD` — fails if detached HEAD

**Performance:** Run independent git commands in parallel using `Promise.allSettled()` (<500ms target)

**Reliability over completeness:** Every implemented detection function must reliably catch its target state. Missing a check is acceptable; a broken check that silently passes is not. (Established in Epic env-2 retrospective)

### Project Structure Notes

- Follows existing patterns in `container.ts` (factory, DI, result types)
- Types added to existing `types.ts` (single source of truth)
- Co-located test at `git.test.ts`
- `.js` extension on all local imports (ESM requirement)

### References

- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-3.1]
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Added `GitState` interface, `GitStateSuccess`, `GitStateError`, and `GitStateResult` types to `types.ts`
- Created `git.ts` module with `createGitStateDetector(executor)` factory pattern matching `container.ts` conventions
- Implemented 4 parallel git commands via `Promise.allSettled()`: `git status --porcelain`, `git stash list`, `git for-each-ref`, `git symbolic-ref HEAD`
- `parseStatus()` correctly distinguishes staged (column 1), unstaged (column 2), and untracked (`??`) from porcelain output
- `parseBranches()` uses `%(upstream:short)` to distinguish never-pushed branches (no upstream) from up-to-date branches (upstream present but no tracking diff)
- `isClean` computed as conjunction of all clean conditions including no detached HEAD
- 39 unit tests covering all 9 acceptance criteria plus error handling and command verification
- All 267 tests pass across all packages (25 shared + 51 orchestrator + 191 agent-env)
- TypeScript type-check passes cleanly

### Change Log

- 2026-02-03: Implemented git state detection module with comprehensive test suite
- 2026-02-03: Code review (Claude Opus 4.5): Fixed parseBranches empty-field handling, shared opts reference, parseStatus char whitelist. Added 3 regression tests.

### File List

**New Files:**
- packages/agent-env/src/lib/git.ts
- packages/agent-env/src/lib/git.test.ts

**Modified Files:**
- packages/agent-env/src/lib/types.ts (added GitState, GitStateResult types)
- _bmad-output/implementation-artifacts/sprint-status.yaml (env-epic-3 and env-3-1 status updated)
