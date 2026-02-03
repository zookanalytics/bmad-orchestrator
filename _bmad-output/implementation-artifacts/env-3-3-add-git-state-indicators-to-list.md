# Story 3.3: Add Git State Indicators to List

Status: done

## Story

As a **user**,
I want **to see git state at a glance in the instance list**,
So that **I know which instances have uncommitted or unpushed work**.

## Acceptance Criteria

1. **Given** an instance with clean git state
   **When** I run `agent-env list`
   **Then** I see ✓ (green) next to the instance

2. **Given** an instance with uncommitted changes (staged, unstaged, or untracked)
   **When** I run `agent-env list`
   **Then** I see ● (yellow) next to the instance

3. **Given** an instance with unpushed commits
   **When** I run `agent-env list`
   **Then** I see ↑ (blue) next to the instance

4. **Given** an instance with never-pushed branches
   **When** I run `agent-env list`
   **Then** I see ⚠ (red) indicator with branch count

5. **Given** an instance with both uncommitted AND unpushed
   **When** I run `agent-env list`
   **Then** I see both ● and ↑ indicators

## Tasks / Subtasks

- [x] Task 1: Create StatusIndicator component (AC: #1-#5)
  - [x] 1.1 Create `packages/agent-env/src/components/StatusIndicator.tsx`
  - [x] 1.2 Implement indicator rendering for clean state (✓ green)
  - [x] 1.3 Implement indicator for uncommitted changes (● yellow)
  - [x] 1.4 Implement indicator for unpushed commits (↑ blue)
  - [x] 1.5 Implement indicator for never-pushed branches (⚠ red with count)
  - [x] 1.6 Implement combined indicators (e.g., ● ↑)
  - [x] 1.7 Implement unavailable state (? gray) for Docker unavailable

- [x] Task 2: Add gitState to InstanceInfo and integrate into listInstances (AC: #1-#5)
  - [x] 2.1 Add `gitState` field to `InstanceInfo` interface
  - [x] 2.2 Add `GitStateDetector` to `ListInstancesDeps`
  - [x] 2.3 Integrate `getGitState()` calls in parallel with container checks
  - [x] 2.4 Handle git state unavailable when Docker is down

- [x] Task 3: Update InstanceList to render git state column (AC: #1-#5)
  - [x] 3.1 Add GIT column to InstanceList header
  - [x] 3.2 Render StatusIndicator for each instance
  - [x] 3.3 Update column width calculations

- [x] Task 4: Update list command for JSON output (AC: #1-#5)
  - [x] 4.1 Include gitState in JSON output data

- [x] Task 5: Write comprehensive tests (AC: #1-#5)
  - [x] 5.1 Create `packages/agent-env/src/components/StatusIndicator.test.tsx`
  - [x] 5.2 Update `packages/agent-env/src/components/InstanceList.test.tsx`
  - [x] 5.3 Update `packages/agent-env/src/lib/list-instances.test.ts`

- [x] Task 6: Run full test suite and verify no regressions (AC: #1-#5)
  - [x] 6.1 Run `pnpm --filter @zookanalytics/agent-env test:run` — 236 tests pass
  - [x] 6.2 Run `pnpm -r test:run` for all packages — tests pass across all packages
  - [x] 6.3 Run `pnpm --filter @zookanalytics/agent-env type-check` — clean

## Dev Notes

### Architecture Requirements

**New Module:** `packages/agent-env/src/components/StatusIndicator.tsx`
- Pure presentational component rendering git state as colored indicators
- Accepts `GitStateResult | null` as prop
- Exports `formatGitIndicators()` for reuse by InstanceList column width calculations
- No business logic — just visual mapping

**Modified Modules:**
- `list-instances.ts` — Add git state detection via `createGitStateDetector()` from Story 3.1
- `InstanceList.tsx` — Add GIT column with StatusIndicator
- `list.ts` — Include gitState in JSON output

**Pattern:** Run git state detection in parallel for all instances alongside container status checks

**Performance:** list should complete in <500ms for 20 instances (NFR2) — git detection runs in parallel

**Reliability over completeness:** If git state detection fails for an instance, show "?" rather than failing the entire list command

### Project Structure Notes

- Follows existing patterns from Story 3.1 (git.ts) and Story 3.2 (InstanceList.tsx)
- Uses dependency injection for GitStateDetector in listInstances
- `.js` extension on all local imports (ESM requirement)

### References

- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-3.3]
- [Source: _bmad-output/implementation-artifacts/env-3-1-implement-git-state-detection.md]
- [Source: _bmad-output/implementation-artifacts/env-3-2-implement-list-command-basic.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None — implementation proceeded without issues.

### Completion Notes List

- Created `StatusIndicator.tsx` component with `formatGitIndicators()` function that maps `GitStateResult | null` to colored indicator symbols: ✓ (green/clean), ● (yellow/uncommitted), ↑ (blue/unpushed), ⚠ N (red/never-pushed), ? (gray/unavailable)
- Added `gitState: GitStateResult | null` field to `InstanceInfo` interface in `list-instances.ts`
- Added `gitDetector: GitStateDetector` to `ListInstancesDeps` interface with DI support
- Integrated `getGitState()` calls in parallel within `listInstances()` — skipped when Docker unavailable (returns null)
- Updated `InstanceList.tsx` to render GIT column between STATUS and LAST ATTACHED, using `formatGitIndicators()` for colored indicator rendering
- Updated `list.ts` command to include `gitState` in JSON output
- Created 14 StatusIndicator tests covering clean, uncommitted (staged/unstaged/untracked), unpushed, never-pushed with count, combined indicators, null state, and error state
- Updated InstanceList tests: added GIT header test, git indicator rendering tests (7 tests total)
- Updated list-instances tests: added mock git detector to all tests, 6 new git state detection tests (19 tests total)
- All 236 agent-env tests pass (zero regressions)
- TypeScript type-check passes cleanly

### Change Log

- 2026-02-03: Story created and implementation started
- 2026-02-03: Implemented git state indicators in list command — StatusIndicator component, InstanceInfo.gitState field, GIT column in table, JSON output
- 2026-02-03: Code review — Fixed sequential git/container detection to run in parallel (H1), added missing snapshot files to File List (M1), corrected inflated test counts (M2/M3), fixed React key anti-pattern in StatusIndicator (L1), fixed misleading section comment in InstanceList (L2)

### File List

**New Files:**
- packages/agent-env/src/components/StatusIndicator.tsx
- packages/agent-env/src/components/StatusIndicator.test.tsx
- packages/agent-env/src/components/__snapshots__/StatusIndicator.test.tsx.snap
- packages/agent-env/src/components/__snapshots__/InstanceList.test.tsx.snap

**Modified Files:**
- packages/agent-env/src/lib/list-instances.ts (added gitState field, GitStateDetector DI, parallel git detection)
- packages/agent-env/src/lib/list-instances.test.ts (added mock git detector, 6 new git state tests)
- packages/agent-env/src/components/InstanceList.tsx (added GIT column with colored indicators)
- packages/agent-env/src/components/InstanceList.test.tsx (added gitState to makeInstance, 6 new git indicator tests)
- packages/agent-env/src/commands/list.ts (added gitState to JSON output)
- _bmad-output/implementation-artifacts/sprint-status.yaml (env-3-3 status updated)
- _bmad-output/implementation-artifacts/env-3-3-add-git-state-indicators-to-list.md (story file created and completed)
