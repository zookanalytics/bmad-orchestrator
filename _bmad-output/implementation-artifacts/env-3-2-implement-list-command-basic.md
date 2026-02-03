# Story 3.2: Implement List Command (Basic)

Status: done

## Story

As a **user**,
I want **to see all my instances at a glance**,
So that **I know what environments I have available**.

## Acceptance Criteria

1. **Given** I have 3 instances created
   **When** I run `agent-env list`
   **Then** I see a table with all 3 instances

2. **Given** an instance is running
   **When** I run `agent-env list`
   **Then** the status column shows "running" (green)

3. **Given** an instance is stopped
   **When** I run `agent-env list`
   **Then** the status column shows "stopped" (yellow)

4. **Given** an instance workspace exists but container is missing
   **When** I run `agent-env list`
   **Then** the status column shows "orphaned" (red)

5. **Given** Docker/OrbStack is not running
   **When** I run `agent-env list`
   **Then** I see workspace-level info (name, purpose, last attached from state.json)
   **And** container status shows "unknown (Docker unavailable)"
   _Note: Git state indicators ("?" when unavailable) deferred to Story 3.3_

6. **Given** an instance was attached 2 hours ago
   **When** I run `agent-env list`
   **Then** the "Last Attached" column shows "2h ago"

7. **Given** I run `agent-env ps`
   **When** the command executes
   **Then** it behaves identically to `agent-env list` (alias)

## Tasks / Subtasks

- [x] Task 1: Create list-instances lib module (AC: #1-#5)
  - [x] 1.1 Create `packages/agent-env/src/lib/list-instances.ts` with factory pattern
  - [x] 1.2 Implement `listInstances()` that scans workspaces, reads state, checks container status
  - [x] 1.3 Handle Docker unavailable gracefully (AC: #5)
  - [x] 1.4 Handle orphaned containers (workspace exists, container not-found) (AC: #4)

- [x] Task 2: Create InstanceList component for table rendering (AC: #1-#6)
  - [x] 2.1 Create `packages/agent-env/src/components/InstanceList.tsx` with Ink table
  - [x] 2.2 Color-code status column (green=running, yellow=stopped, red=orphaned)
  - [x] 2.3 Format lastAttached with timeago.js (AC: #6)
  - [x] 2.4 Show purpose column (truncated if needed)

- [x] Task 3: Implement list command (AC: #1-#7)
  - [x] 3.1 Replace placeholder in `packages/agent-env/src/commands/list.ts`
  - [x] 3.2 Wire up listInstances + InstanceList rendering via Ink render
  - [x] 3.3 Handle empty state (no instances) with helpful message
  - [x] 3.4 Verify `ps` alias works (AC: #7)

- [x] Task 4: Write comprehensive tests (AC: #1-#7)
  - [x] 4.1 Create `packages/agent-env/src/lib/list-instances.test.ts`
  - [x] 4.2 Test multiple instances with various statuses
  - [x] 4.3 Test Docker unavailable graceful degradation
  - [x] 4.4 Test orphaned container detection
  - [x] 4.5 Test empty workspace list
  - [x] 4.6 Updated `packages/agent-env/src/cli.test.ts` for CLI integration tests (list, list --json, ps alias)

- [x] Task 5: Run full test suite and verify no regressions (AC: #1-#7)
  - [x] 5.1 Run `pnpm --filter @zookanalytics/agent-env test:run` — 209 tests pass
  - [x] 5.2 Run `pnpm -r test:run` for all packages — 285 tests pass (25 shared + 51 orchestrator + 209 agent-env)
  - [x] 5.3 Run `pnpm --filter @zookanalytics/agent-env type-check` — clean

## Dev Notes

### Architecture Requirements

**Modules:**
- `packages/agent-env/src/lib/list-instances.ts` - Business logic for listing
- `packages/agent-env/src/components/InstanceList.tsx` - Ink table component
- `packages/agent-env/src/commands/list.ts` - Command wiring

**Pattern:** `listInstances(deps?)` function with optional injectable dependencies
- Uses scanWorkspaces, readState, containerStatus from existing modules
- All I/O operations injectable for testing via `ListInstancesDeps` interface
- Docker availability checked once, then container status checked per instance in parallel

**Columns:** Name, Status, Last Attached, Purpose

**Graceful Degradation:**
- Docker unavailable: show state.json data, status = "unknown"
- Missing state.json: use fallback state
- Container not-found: show "orphaned" status

**Performance:** Uses Promise.all for parallel container status checks per instance

### Project Structure Notes

- Follows existing patterns in container.ts (DI, result types)
- Uses Ink for rendering (already a dependency)
- Uses timeago.js for relative timestamps (already a dependency)
- Co-located tests
- `.js` extension on all local imports (ESM requirement)

### References

- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-3.2]
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Created `list-instances.ts` with `listInstances()` function that scans workspaces, reads state files, and checks container status with full DI support
- Created `InstanceList.tsx` Ink component with color-coded status (green=running, yellow=stopped, red=orphaned, gray=unknown), timeago.js timestamps, truncated purpose column, and Docker unavailability notice
- Replaced placeholder `list.ts` command with full implementation wiring `listInstances()` to Ink rendering, plus `--json` output using `JsonOutput<T>` contract
- Added 13 unit tests in `list-instances.test.ts` covering: multiple instances, running/stopped/orphaned statuses, Docker unavailable graceful degradation, empty workspace list, container error handling, purpose field, parallel execution, lastAttached null handling
- Updated `cli.test.ts`: replaced "not implemented" test with 3 integration tests (list output, list --json, ps alias)
- All 285 tests pass across all packages (zero regressions)
- TypeScript type-check passes cleanly

### Change Log

- 2026-02-03: Story created and implementation started
- 2026-02-03: Implemented list command with Ink rendering, comprehensive tests, all 285 tests pass
- 2026-02-03: Code review — 8 issues found (3H, 3M, 2L). Fixed 6 (all HIGH + MEDIUM):
  - H1+M1: Removed unused `createDefaultListDeps()` with unsafe `undefined as unknown` casts
  - H2: Added `ListError` variant to `ListResult` discriminated union with try/catch in `listInstances()`
  - H3: Clarified AC #5 git state indicator deferral to Story 3.3
  - M2: Added 14 component tests for `InstanceList.tsx` (empty state, table rendering, status colors, Docker unavailable, timestamps, purpose truncation)
  - M3: Updated `list.ts` to use `JsonOutput<T>` from shared and handle `ok: false` result
  - All 299 tests pass (25 shared + 51 orchestrator + 223 agent-env), type-check clean

### File List

**New Files:**
- packages/agent-env/src/lib/list-instances.ts
- packages/agent-env/src/lib/list-instances.test.ts
- packages/agent-env/src/components/InstanceList.tsx
- packages/agent-env/src/components/InstanceList.test.tsx (added in review)

**Modified Files:**
- packages/agent-env/src/commands/list.ts (replaced placeholder with full implementation; review: added JsonOutput<T>, error handling)
- packages/agent-env/src/cli.test.ts (updated list test from "not implemented" to actual behavior tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (env-3-2 status updated)
- _bmad-output/implementation-artifacts/env-3-2-implement-list-command-basic.md (story file created and completed)
