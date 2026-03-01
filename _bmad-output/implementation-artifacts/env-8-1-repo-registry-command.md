# Story 8.1: Repo registry command

Status: done

## Story

As a **user**,
I want **to see which repositories I've used before**,
So that **I can quickly create new instances from known repos without re-entering URLs**.

## Acceptance Criteria

1. **Given** I have instances for repos `bmad-orchestrator` and `awesome-cli`
   **When** I run `agent-env repos`
   **Then** I see a list showing each repo slug and its full URL

2. **Given** I have no instances
   **When** I run `agent-env repos`
   **Then** I see "No repositories tracked. Create an instance with: agent-env create <name> --repo <url>"

3. **Given** I remove all instances for `awesome-cli`
   **When** I run `agent-env repos`
   **Then** `awesome-cli` no longer appears (registry derived from existing workspaces)

4. **Given** I run `agent-env repos --json`
   **When** repos exist
   **Then** I get JSON output: `{ "ok": true, "data": [{ "slug": "...", "url": "...", "instanceCount": N }], "error": null }`

## Tasks / Subtasks

- [x] Task 1: Create `list-repos.ts` lib module with `RepoInfo` type and `listRepos()` function (AC: #1, #3)
  - [x] 1.1 Define `RepoInfo` interface with `slug`, `url`, and `instanceCount` fields
  - [x] 1.2 Define `ListReposResult` type (success/error pattern)
  - [x] 1.3 Implement `listRepos()` using `scanWorkspaces()` + `readState()` to aggregate repos
  - [x] 1.4 Use dependency injection for testability (matching existing patterns)

- [x] Task 2: Write unit tests for `list-repos.ts` (AC: #1, #2, #3)
  - [x] 2.1 Test: multiple workspaces across different repos returns aggregated repo list
  - [x] 2.2 Test: no workspaces returns empty array
  - [x] 2.3 Test: removing all instances for a repo excludes it from results
  - [x] 2.4 Test: multiple instances for same repo correctly counts instanceCount
  - [x] 2.5 Test: graceful handling of corrupted/missing state files

- [x] Task 3: Create `commands/repos.ts` with `--json` flag (AC: #1, #2, #4)
  - [x] 3.1 Create `reposCommand` using Commander pattern matching existing commands
  - [x] 3.2 Implement plain text output showing repo slug, URL, and instance count
  - [x] 3.3 Implement `--json` output following `JsonOutput` contract
  - [x] 3.4 Display "No repositories tracked..." message when no repos exist

- [x] Task 4: Write command-level tests for `commands/repos.test.ts` (AC: #1, #2, #4)
  - [x] 4.1 Test: repos command outputs repo list in plain text
  - [x] 4.2 Test: repos command with --json outputs correct JSON structure
  - [x] 4.3 Test: empty repos shows appropriate message
  - [x] 4.4 Test: error handling outputs error in both plain and JSON formats

- [x] Task 5: Register `repos` command in `cli.ts`
  - [x] 5.1 Import `reposCommand` from `./commands/repos.js`
  - [x] 5.2 Add `program.addCommand(reposCommand)` in command registration section

- [x] Task 6: Run full test suite and verify no regressions
  - [x] 6.1 Run `pnpm -r test:run` — 795 tests pass (shared: 25, orchestrator: 45, agent-env: 725)
  - [x] 6.2 Run `pnpm -r type-check` — all packages clean

## Dev Notes

### Architecture Context
- This story builds on Epic 7's repo-scoped workspace structure: `~/.agent-env/workspaces/<repoSlug>-<instance>/`
- Each workspace has `.agent-env/state.json` containing `repoSlug`, `repoUrl`, and `instance` fields
- The repo registry is **derived** from existing workspaces — no separate registry file to maintain
- Scanning uses existing `scanWorkspaces()` from `workspace.ts` and `readState()` from `state.ts`
- Story 7.4 already added `repoSlug` and `repoUrl` to the `Instance` display type — this story creates a repo-level aggregation

### Key ADR Decisions
- **No separate registry file:** Repos are derived from workspace scan + state.json. This ensures the registry always reflects reality (no stale entries).
- **Simple text output (no Ink):** The repos command displays a simple table — no need for Ink components. Use console.log with formatting.
- **Sort repos alphabetically by slug:** Predictable, deterministic output order.
- **FR51 (track repos) and FR52 (list repos) covered by this story.**

### Technical Specifications
- New file: `packages/agent-env/src/lib/list-repos.ts` — core listing logic
- New file: `packages/agent-env/src/lib/list-repos.test.ts` — unit tests
- New file: `packages/agent-env/src/commands/repos.ts` — command definition
- New file: `packages/agent-env/src/commands/repos.test.ts` — command tests
- Modified: `packages/agent-env/src/cli.ts` — register repos command
- `listRepos()` follows same DI pattern as `listInstances()` for testing

### Previous Learnings
- From env-7-4: State reading with `readState()` gracefully handles missing/corrupted files
- From Known AI Agent Risks: Verify all tests actually run and pass — run full suite
- From env-7-4: Use `getWorkspacePathByName()` to resolve workspace paths from scanned names

## Dev Agent Record

### Implementation Plan
1. Create `list-repos.ts` with `RepoInfo` type and `listRepos()` function
2. Write comprehensive unit tests for `list-repos.ts`
3. Create `commands/repos.ts` with plain text and --json output
4. Write command-level tests
5. Register command in `cli.ts`
6. Run full test suite

### Debug Log
- No issues encountered. Implementation was straightforward, following the existing patterns from `list-instances.ts` and `commands/list.ts`.
- The `listRepos()` function reuses `scanWorkspaces()` and `readState()` with the same DI pattern.
- Workspaces with fallback state (`repoSlug: 'unknown'`) are excluded from the repo list to avoid misleading entries.

### Completion Notes
All 6 tasks complete. 795 tests pass across all packages (shared: 25, orchestrator: 45, agent-env: 725). Type-check clean. No commits per user instructions.

New tests added: 18 total
- `list-repos.test.ts`: 8 tests (aggregation, empty, dynamic registry, instance count, corrupted state, error handling)
- `repos.test.ts`: 10 tests (plain text output, empty message, --json output, error handling, exit codes)

## File List

### New
- `packages/agent-env/src/lib/list-repos.ts` — Core repo listing logic with `RepoInfo` interface, `ListReposResult` type, and `listRepos()` function using DI pattern
- `packages/agent-env/src/lib/list-repos.test.ts` — 8 unit tests for repo listing aggregation, empty states, and error handling
- `packages/agent-env/src/commands/repos.ts` — `repos` command with plain text table output and `--json` flag
- `packages/agent-env/src/commands/repos.test.ts` — 10 command-level tests for plain/JSON output, errors, and exit codes

### Modified
- `packages/agent-env/src/cli.ts` — Import and register `reposCommand`

### Sprint Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated env-8-1 to `in-progress`, env-epic-8 to `in-progress`

## Senior Developer Review (AI)

**Reviewer:** Node | **Date:** 2026-02-26 | **Outcome:** Approved

### Verification Summary
- **Tests independently verified:** 795 total (shared: 25, orchestrator: 45, agent-env: 725) — matches dev agent claim
- **New tests verified:** 18 (list-repos.test.ts: 8, repos.test.ts: 10) — matches dev agent claim
- **Type-check:** Clean across all packages
- **Git vs Story File List:** No discrepancies — all claimed files present in git, no unclaimed changes
- **No out-of-scope changes detected**

### AC Validation
- **AC #1 (list repos with slug/URL):** IMPLEMENTED — `listRepos()` aggregates from workspace scan, command displays table with REPO/INSTANCES/URL columns
- **AC #2 (empty message):** IMPLEMENTED — exact message "No repositories tracked. Create an instance with: agent-env create <name> --repo <url>" displayed
- **AC #3 (dynamic registry):** IMPLEMENTED — registry derived from workspace scan, removing all instances for a repo removes it from listing
- **AC #4 (--json output):** IMPLEMENTED — outputs `{ ok: true, data: [{ slug, url, instanceCount }], error: null }` matching contract

### Task Audit
All 6 tasks with 16 subtasks verified as complete. DI pattern correctly follows `listInstances()` convention. Command registration in `cli.ts` confirmed.

### Findings (0 High, 3 Medium, 2 Low)

**Medium (all assessed as "consistent with existing patterns" — no action required):**
- M1: `repos.ts` error handler constructs `suggestion` field not present in `ListReposError` type — matches `list.ts` pattern
- M2: `listRepos(deps?: Partial<>)` allows empty `{}` relying on downstream defaults — matches `listInstances()` pattern
- M3: `Math.max(...spread)` for column width — safe for realistic repo counts

**Low (not fixed due to acceptance test file constraint):**
- L1: No separator line between table header and data rows — style choice consistent with "simple table" ADR
- L2: `process.exitCode = undefined` in afterEach vs `= 0` in beforeEach — trivial inconsistency, no behavioral impact

### Code Quality Assessment
- Clean separation of concerns: `lib/list-repos.ts` (logic) → `commands/repos.ts` (CLI integration)
- DI pattern correctly implemented for testability
- Error handling follows established success/error result type pattern
- Tests have real assertions with meaningful scenarios (not placeholder tests)
- Workspaces with `unknown` repoSlug correctly excluded from results

## Change Log
- 2026-02-26: Story created and all 6 tasks implemented in single session. 795 tests passing across all packages. Status set to review.
- 2026-02-26: Senior Developer Review (AI) — Approved. 0 High, 3 Medium (all pattern-consistent, no action), 2 Low. Status set to done.
