# Story 4.3: Implement Interactive Menu

Status: done

## Story

As a **user**,
I want **an interactive menu when I run agent-env with no arguments**,
So that **I can quickly select and attach to an instance**.

## Acceptance Criteria

1. **Given** I have multiple instances
   **When** I run `agent-env` with no arguments
   **Then** I see an interactive menu listing all instances

2. **Given** the interactive menu is displayed
   **When** I use arrow keys to navigate
   **Then** the selected instance is highlighted

3. **Given** I select an instance and press Enter
   **When** the selection is confirmed
   **Then** I'm attached to that instance's tmux session

4. **Given** the menu is displayed
   **When** I look at each instance row
   **Then** I see: name, status, git state indicator, purpose (truncated to fit terminal width)

5. **Given** a terminal with narrow width (< 80 columns)
   **When** the menu is displayed
   **Then** purpose is truncated with "..." to fit available space
   **And** core info (name, status, git state) is always visible

6. **Given** no instances exist
   **When** I run `agent-env`
   **Then** I see "No instances found. Create one with: agent-env create <name> --repo <url>"

## Tasks / Subtasks

- [x] Task 1: Create InteractiveMenu.tsx component (AC: #1, #2, #4, #5)
  - [x] 1.1 Create `packages/agent-env/src/components/InteractiveMenu.tsx` using Ink + @inkjs/ui Select
  - [x] 1.2 Build option labels with name, status, git indicator, and purpose
  - [x] 1.3 Handle terminal width detection and purpose truncation
  - [x] 1.4 Show empty state message when no instances (AC: #6)

- [x] Task 2: Write tests for InteractiveMenu.tsx (AC: #1, #2, #4, #5, #6)
  - [x] 2.1 Test rendering with multiple instances shows Select with correct labels
  - [x] 2.2 Test empty state shows create suggestion message
  - [x] 2.3 Test purpose truncation for long strings
  - [x] 2.4 Test git state indicators appear in labels

- [x] Task 3: Create interactive-menu lib module (AC: #1, #3)
  - [x] 3.1 Create `packages/agent-env/src/lib/interactive-menu.ts` with types and factory
  - [x] 3.2 Implement `launchInteractiveMenu()` — list instances and render menu
  - [x] 3.3 On selection, call `attachInstance()` to attach to chosen instance
  - [x] 3.4 Handle errors (list failure, attach failure)

- [x] Task 4: Write tests for interactive-menu lib module (AC: #1, #3, #6)
  - [x] 4.1 Test launchInteractiveMenu with instances returns success
  - [x] 4.2 Test launchInteractiveMenu with no instances shows empty state
  - [x] 4.3 Test list failure propagation
  - [x] 4.4 Test attach is called with correct instance name on selection

- [x] Task 5: Update cli.ts default action (AC: #1, #3)
  - [x] 5.1 Replace `program.help()` with interactive menu launcher
  - [x] 5.2 Detect if stdin is TTY — fall back to help if not interactive

- [x] Task 6: Update CLI integration tests (AC: #1, #6)
  - [x] 6.1 Update 'no arguments' test to expect interactive menu behavior or help fallback

- [x] Task 7: Run full test suite and verify no regressions
  - [x] 7.1 Run `pnpm --filter @zookanalytics/agent-env test:run` — 296 tests pass
  - [x] 7.2 Run `pnpm -r test:run` for all packages — 372 tests pass (25 shared + 51 orchestrator + 296 agent-env)
  - [x] 7.3 Run `pnpm --filter @zookanalytics/agent-env type-check` — clean

## Dev Notes

### Architecture Requirements

**Existing Code Reused:**
- `listInstances()` in `list-instances.ts` — fetches all instance data
- `attachInstance()` + `createAttachDefaultDeps()` in `attach-instance.ts` — attach orchestration
- `formatGitIndicators()` in `StatusIndicator.tsx` — git state formatting
- `InstanceInfo` type from `list-instances.ts`

**New Modules:**
- `InteractiveMenu.tsx` — Ink component using @inkjs/ui Select
- `interactive-menu.ts` — orchestration logic (list → render → attach)

**Key Design Decisions:**
- Use `@inkjs/ui` Select component for keyboard navigation (arrows, enter)
- Build option labels as formatted strings with name, status, git indicator, purpose
- Select's `onChange` fires on Enter — triggers attach flow
- Non-TTY detection: if `!process.stdin.isTTY`, fall back to help output
- Business logic in `lib/interactive-menu.ts`, presentation in `components/InteractiveMenu.tsx`

### References

- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-4.3]
- [Source: packages/agent-env/src/lib/attach-instance.ts]
- [Source: packages/agent-env/src/lib/list-instances.ts]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None — implementation proceeded without issues.

### Completion Notes List

- Created `InteractiveMenu.tsx` component using `@inkjs/ui` Select for keyboard-navigable instance selection
- Component builds option labels with name, status symbol (▶/■/✗/?), git indicator (✓/●/↑/⚠), and purpose
- Purpose truncation based on terminal width via `process.stdout.columns` with `...` ellipsis
- Empty state shows "No instances found" with create command suggestion
- Created `interactive-menu.ts` lib module with `launchInteractiveMenu()` orchestrating list → render → attach flow
- Dependency injection for all I/O: listInstances, attachInstance, createAttachDeps, renderMenu
- Updated `cli.ts` default action: TTY mode launches interactive menu, non-TTY falls back to help
- 10 component tests (rendering, empty state, labels, truncation, git indicators)
- 5 lib orchestration tests (list failure, empty, selection+attach, attach failure, user exit)
- Updated CLI integration test description to document non-TTY fallback behavior
- All 296 agent-env tests pass, 372 total across all packages, type-check clean
- Removed `console.log` from `lib/interactive-menu.ts` to adhere to layered architecture principles.
- Renamed `InstanceInfo` to `Instance` across `list-instances.ts`, `InteractiveMenu.tsx`, `interactive-menu.ts`, `InteractiveMenu.test.tsx`, `interactive-menu.test.ts` for type naming consistency.
- Replaced magic numbers with named constants (`COLUMN_PADDING`, `SELECT_PREFIX_WIDTH`) in `InteractiveMenu.tsx`'s `buildOptionLabel` function.
- Added `ink-testing-library` interaction test to `InteractiveMenu.test.tsx` for `onSelect` callback verification.
- [Review #2] Completed `InstanceInfo` → `Instance` rename across all remaining files: `list.ts`, `list.test.ts`, `InstanceList.tsx`, `InstanceList.test.tsx`, `interactive-menu.test.ts`.
- [Review #2] Fixed broken interaction test in `InteractiveMenu.test.tsx` — `stdin` is a top-level return from `render()`, not a property of `lastFrame()`.
- [Review #2] Removed empty `onStarting` callback in `interactive-menu.ts` — pass no argument instead of empty function.
- [Review #2] Added explicit type annotations for `.map()` callback in `InstanceList.tsx` to fix implicit `any` type errors.
- [Review #2] All 297 agent-env tests pass, type-check clean.

### Change Log

- 2026-02-04: Story created and implementation completed — interactive menu fully functional with tests
- 2026-02-04: Code review findings addressed: removed `console.log` from lib, renamed `InstanceInfo` to `Instance` for consistency, replaced magic numbers in `buildOptionLabel` with named constants, and added `ink-testing-library` interaction test.
- 2026-02-04: Code review #2 findings addressed: completed incomplete `InstanceInfo` → `Instance` rename across 5 files, fixed broken interaction test (`stdin` API misuse), removed empty callback, added type annotations for implicit `any` params.

### File List

**New Files:**
- packages/agent-env/src/components/InteractiveMenu.tsx
- packages/agent-env/src/components/InteractiveMenu.test.tsx
- packages/agent-env/src/lib/interactive-menu.ts
- packages/agent-env/src/lib/interactive-menu.test.ts

**Modified Files:**
- packages/agent-env/src/cli.ts (replaced help placeholder with interactive menu launcher)
- packages/agent-env/src/cli.test.ts (updated no-args test description for non-TTY behavior)
- packages/agent-env/src/lib/list-instances.ts (renamed InstanceInfo → Instance)
- packages/agent-env/src/commands/list.ts (InstanceInfo → Instance rename)
- packages/agent-env/src/commands/list.test.ts (InstanceInfo → Instance rename)
- packages/agent-env/src/components/InstanceList.tsx (InstanceInfo → Instance rename, type annotations)
- packages/agent-env/src/components/InstanceList.test.tsx (InstanceInfo → Instance rename)
- _bmad-output/implementation-artifacts/sprint-status.yaml (env-4-3 status updated)
- _bmad-output/implementation-artifacts/env-4-3-implement-interactive-menu.md (story file)
