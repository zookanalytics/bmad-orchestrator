# Story 4.2: Implement Purpose Command

Status: done

## Story

As a **user**,
I want **to label instances with their purpose**,
So that **I remember what each environment is for**.

## Acceptance Criteria

1. **Given** an instance "auth" with purpose set to "Authentication feature"
   **When** I run `agent-env purpose auth`
   **Then** I see "Authentication feature"

2. **Given** an instance "auth" with no purpose set
   **When** I run `agent-env purpose auth`
   **Then** I see "(no purpose set)"

3. **Given** I run `agent-env purpose auth "OAuth implementation"`
   **When** the command completes
   **Then** the purpose is saved to state.json
   **And** I see confirmation "Purpose updated"

4. **Given** I run `agent-env purpose auth ""`
   **When** the command completes
   **Then** the purpose is cleared
   **And** I see confirmation "Purpose cleared"

5. **Given** the instance does not exist
   **When** I run `agent-env purpose nonexistent`
   **Then** I get error "Instance 'nonexistent' not found"

## Tasks / Subtasks

- [x] Task 1: Create purpose-instance.ts lib module (AC: #1-#5)
  - [x] 1.1 Create `packages/agent-env/src/lib/purpose-instance.ts` with types and factory
  - [x] 1.2 Implement `getPurpose()` - read purpose from state.json via workspace lookup
  - [x] 1.3 Implement `setPurpose()` - write purpose to state.json atomically
  - [x] 1.4 Handle instance not found and ambiguous match errors

- [x] Task 2: Write tests for purpose-instance.ts (AC: #1-#5)
  - [x] 2.1 Test get purpose returns existing purpose (AC: #1)
  - [x] 2.2 Test get purpose returns null when no purpose set (AC: #2)
  - [x] 2.3 Test set purpose writes to state.json (AC: #3)
  - [x] 2.4 Test set empty string clears purpose (AC: #4)
  - [x] 2.5 Test instance not found error (AC: #5)
  - [x] 2.6 Test ambiguous match error
  - [x] 2.7 Test state preservation (other fields not corrupted)

- [x] Task 3: Replace purpose command placeholder (AC: #1-#5)
  - [x] 3.1 Update `packages/agent-env/src/commands/purpose.ts` to use purpose-instance module
  - [x] 3.2 Add get mode output (display purpose or "(no purpose set)")
  - [x] 3.3 Add set mode output (confirmation messages)
  - [x] 3.4 Add proper error formatting and exit codes

- [x] Task 4: Update CLI integration tests (AC: #1-#5)
  - [x] 4.1 Update purpose test to expect WORKSPACE_NOT_FOUND instead of NotImplemented
  - [x] 4.2 Move purpose test from "placeholder commands" to own describe block

- [x] Task 5: Run full test suite and verify no regressions (AC: #1-#5)
  - [x] 5.1 Run `pnpm --filter @zookanalytics/agent-env test:run` — 281 tests pass
  - [x] 5.2 Run `pnpm -r test:run` for all packages — 357 tests pass (25 shared + 51 orchestrator + 281 agent-env)
  - [x] 5.3 Run `pnpm --filter @zookanalytics/agent-env type-check` — clean

## Dev Notes

### Architecture Requirements

**Existing Code Reused:**
- `findWorkspaceByName()` in `attach-instance.ts` — workspace lookup by instance name
- `scanWorkspaces()` + `getWorkspacePathByName()` — instance discovery
- `readState()` + `writeStateAtomic()` — state management
- `formatError()` + `createError()` from shared — error formatting

**New Module:** `purpose-instance.ts` handles purpose get/set:
1. Find workspace by instance name (reuse `findWorkspaceByName()`)
2. Read state to get current purpose
3. For get mode: return purpose string or null
4. For set mode: update purpose in state and write atomically

**Key Design Decisions:**
- Reuse `findWorkspaceByName()` from attach-instance.ts for workspace lookup
- Same DI pattern as attach-instance.ts with deps factory
- No Docker/container interaction needed — purpose is metadata only
- Empty string set clears purpose (sets to null in state.json)

### References

- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-4.2]
- [Source: packages/agent-env/src/lib/attach-instance.ts (findWorkspaceByName function)]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None — implementation proceeded without issues.

### Completion Notes List

- Created `purpose-instance.ts` with `getPurpose()` and `setPurpose()` functions using dependency injection
- Created `purpose-instance.test.ts` with 11 unit tests covering: get existing purpose, get null purpose, exact name match, set purpose, clear purpose (empty string), state preservation, overwrite existing, WORKSPACE_NOT_FOUND, and AMBIGUOUS_MATCH errors
- Replaced placeholder `purpose.ts` command with real implementation using `getPurpose()`/`setPurpose()` from new lib module
- Updated CLI integration test: moved purpose test from "placeholder commands" to own "purpose command" describe block, expects WORKSPACE_NOT_FOUND instead of NotImplemented
- All 281 agent-env tests pass, 357 total across all packages, type-check clean

### Change Log

- 2026-02-04: Story created and implementation completed — purpose command fully functional with tests
- 2026-02-04: Code review completed — 1 medium issue fixed (DRY refactor of error-mapping in purpose-instance.ts), 2 low issues noted. All 281 tests pass, type-check clean. Status → done

### File List

**New Files:**
- packages/agent-env/src/lib/purpose-instance.ts
- packages/agent-env/src/lib/purpose-instance.test.ts

**Modified Files:**
- packages/agent-env/src/commands/purpose.ts (replaced placeholder with real implementation)
- packages/agent-env/src/cli.test.ts (updated purpose test to expect WORKSPACE_NOT_FOUND)
- _bmad-output/implementation-artifacts/sprint-status.yaml (env-4-2 status updated)
- _bmad-output/implementation-artifacts/env-4-2-implement-purpose-command.md (story file)
