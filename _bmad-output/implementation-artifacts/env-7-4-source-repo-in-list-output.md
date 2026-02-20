# Story 7.4: Source repo in list output

Status: done

## Story

As a **user**,
I want **to see which repo each instance belongs to in the list output**,
So that **I can distinguish instances from different repos at a glance**.

## Acceptance Criteria

1. **Given** instances exist across multiple repos
   **When** I run `agent-env list`
   **Then** each instance shows its repo slug in a "Repo" column

2. **Given** I run `agent-env list --json`
   **When** instances exist
   **Then** each instance object includes `"repoSlug": "..."` and `"repoUrl": "..."`

3. **Given** I run `agent-env list --repo bmad-orchestrator`
   **When** instances exist for that repo and others
   **Then** only instances for `bmad-orchestrator` are shown

## Tasks / Subtasks

- [x] Task 1: Add `repoSlug` and `repoUrl` fields to Instance type and listInstances output (AC: #1, #2)
  - [x] 1.1 Add `repoSlug: string` and `repoUrl: string` fields to `Instance` interface in `list-instances.ts`
  - [x] 1.2 Populate `repoSlug` and `repoUrl` from `InstanceState` in `listInstances()` function
  - [x] 1.3 Write unit tests for new fields in `list-instances.test.ts`

- [x] Task 2: Add REPO column to `InstanceList.tsx` component (AC: #1)
  - [x] 2.1 Add "REPO" column header and row content in `InstanceList.tsx`
  - [x] 2.2 Update column width calculations to include repo slug
  - [x] 2.3 Update snapshot tests in `InstanceList.test.tsx`

- [x] Task 3: Add `--repo` filter option to list command (AC: #3)
  - [x] 3.1 Add `--repo <slug>` option to `listCommand` in `commands/list.ts`
  - [x] 3.2 Pass repo filter to `listInstances()` and filter instances by `repoSlug`
  - [x] 3.3 Write unit tests for `--repo` filtering in `list-instances.test.ts`
  - [x] 3.4 Write command-level tests for `--repo` in `commands/list.test.ts`

- [x] Task 4: Update JSON output to include `repoSlug` and `repoUrl` (AC: #2)
  - [x] 4.1 Add `repoSlug` and `repoUrl` to JSON mapping in `commands/list.ts`
  - [x] 4.2 Update JSON output tests in `commands/list.test.ts` to verify new fields
  - [x] 4.3 Preserve existing `sshConnection` field in JSON mapping

- [x] Task 5: Run full test suite and verify no regressions
  - [x] 5.1 Run `pnpm -r test:run` — 742 tests pass (shared: 25, orchestrator: 45, agent-env: 672)
  - [x] 5.2 Run `pnpm -r type-check` — all packages clean

## Dev Notes

### Architecture Context
- This story builds on Story 7.1 (state schema: `instance`, `repoSlug`, `repoUrl` fields) and Story 7.2 (slug derivation + compression)
- The `InstanceState` already has `repoSlug` and `repoUrl` fields from Story 7.1
- The `Instance` display type in `list-instances.ts` currently does NOT include repo fields — this story adds them
- Story 7.3 added `--repo` option to attach/remove/purpose commands using `resolveRepo()` — this story adds it to list command
- The list command does NOT need two-phase instance resolution since it lists all instances; it only needs simple string filtering on `repoSlug`

### Key ADR Decisions
- **Simple string match for `--repo` filter:** Unlike attach/remove/purpose which use `resolveRepo()` for cwd inference, list's `--repo` is a simple exact-match slug filter. No cwd inference needed — user either wants all instances or filtered by explicit slug.
- **REPO column placement:** After NAME, before STATUS — repo context is second most important identifier after name
- **Both `repoSlug` and `repoUrl` in JSON:** Slug for display/filtering, URL for programmatic use
- **Case-insensitive filtering:** `--repo` filter does case-insensitive matching for user convenience

### Technical Specifications
- Instance type gains: `repoSlug: string`, `repoUrl: string`
- List command gains: `--repo <slug>` option for filtering
- JSON output adds two new fields while preserving all existing fields
- `ListInstancesOpts` type added with `repoFilter?: string`
- FR45 covered by this story

### Previous Learnings
- From env-7-3: `resolveRepo()` available but overkill for list filtering
- From Known AI Agent Risks: Verify all tests actually run and pass

## Dev Agent Record

### Implementation Plan
1. Add `repoSlug` and `repoUrl` to `Instance` type and populate from state
2. Add REPO column to `InstanceList.tsx`
3. Add `--repo` filter option to list command
4. Update JSON output mapping
5. Run full test suite

### Debug Log
- No issues encountered. The `Instance` type change required updating `makeInstance` helpers in 4 test files (list-instances.test.ts, list.test.ts, InstanceList.test.tsx, InteractiveMenu.test.tsx, interactive-menu.test.ts) to include the new required `repoSlug` and `repoUrl` fields.
- InstanceList snapshot tests regenerated after adding REPO column.

### Completion Notes
All 5 tasks complete. 742 tests pass across all packages (shared: 25, orchestrator: 45, agent-env: 672). Type-check clean. No commits per user instructions.

New tests added: 11 total
- `list-instances.test.ts`: 7 new tests (3 for repo fields, 4 for repo filter)
- `list.test.ts`: 4 new tests (1 for repoSlug/repoUrl in JSON, 3 for --repo flag)

## File List

### Modified
- `packages/agent-env/src/lib/list-instances.ts` — Added `repoSlug`, `repoUrl` fields to `Instance` interface; added `ListInstancesOpts` type with `repoFilter`; populate fields from state; filter by repo slug
- `packages/agent-env/src/lib/list-instances.test.ts` — Added 7 tests for repo fields and repo filter
- `packages/agent-env/src/components/InstanceList.tsx` — Added REPO column (header + row) with blue color and dynamic width
- `packages/agent-env/src/components/InstanceList.test.tsx` — Updated `makeInstance` helper with new required fields; regenerated snapshots
- `packages/agent-env/src/components/__snapshots__/InstanceList.test.tsx.snap` — Regenerated snapshots with REPO column
- `packages/agent-env/src/commands/list.ts` — Added `--repo <slug>` option; added `repoSlug`, `repoUrl` to JSON mapping; pass `repoFilter` to `listInstances()`
- `packages/agent-env/src/commands/list.test.ts` — Updated `makeInstance` helper; added 4 tests for `repoSlug`/`repoUrl` in JSON and `--repo` flag; updated field count from 6 to 8
- `packages/agent-env/src/components/InteractiveMenu.test.tsx` — Updated `makeInstance` helper with new required fields
- `packages/agent-env/src/lib/interactive-menu.test.ts` — Updated `makeInstance` helper with new required fields

### Sprint Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated env-7-4 from `backlog` to `in-progress`

## Senior Developer Review (AI)

**Reviewer:** Node on 2026-02-16
**Outcome:** Approved (with fixes applied)

### AC Validation
| AC | Result | Evidence |
|---|---|---|
| #1 Repo column in list output | IMPLEMENTED | `InstanceList.tsx:117,129` — REPO header and row with blue color |
| #2 repoSlug/repoUrl in JSON | IMPLEMENTED | `list.ts:48-49` — both fields in JSON mapping |
| #3 --repo filter | IMPLEMENTED | `list.ts:17`, `list-instances.ts:103-112` — case-insensitive exact match |

### Task Audit
All 5 tasks and subtasks verified complete against implementation.

### Findings and Fixes
1. **MEDIUM (FIXED):** Repo filter applied after expensive container/git I/O — refactored `list-instances.ts` to read state and apply filter *before* container status and git state checks. Avoids unnecessary I/O for filtered-out instances.
2. **MEDIUM (NOTED):** Snapshot test uses string replacement hack creating impossible rendering state — not fixed per constraint on ATDD test files. Functionally harmless.
3. **MEDIUM (FIXED):** Sprint-status.yaml showed `in-progress` while story was `review` — corrected to `review`, then updated to `done` as part of this review.
4. **LOW (NOTED):** JSON key ordering is implementation-consistent but not spec-guaranteed — no action needed.

### Test Verification
- 742 tests passing after fixes (shared: 25, orchestrator: 45, agent-env: 672)
- Type-check clean
- No regressions introduced by review fixes

## Change Log
- 2026-02-16: Story created and all 5 tasks implemented in single session. 742 tests passing across all packages.
- 2026-02-16: Code review — 3 MEDIUM, 1 LOW findings. Fixed repo filter performance (early filtering before container/git I/O). Fixed sprint-status sync. Status → done.
