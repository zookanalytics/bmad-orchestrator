# Story 7.1: Refactor workspace naming and state schema for repo-scoped instances

Status: done

## Story

As a **developer**,
I want **workspaces named with explicit repo-slug-instance format and state.json carrying structured fields**,
So that **instances are scoped to repositories with globally unique workspace identifiers**.

## Acceptance Criteria

1. **Given** I create an instance "auth" for repo `bmad-orchestrator`
   **When** the workspace is created
   **Then** it exists at `~/.agent-env/workspaces/bmad-orchestrator-auth/`
   **And** state.json contains `"instance": "auth"`, `"repoSlug": "bmad-orchestrator"`, `"repoUrl": "<full URL>"`

2. **Given** workspaces exist at `~/.agent-env/workspaces/bmad-orch-auth/` and `~/.agent-env/workspaces/awesome-cli-bugfix/`
   **When** `scanWorkspaces()` is called
   **Then** both instances are returned with their repo slug and instance name (from state.json, not parsed from directory name)

3. **Given** old-format workspaces exist (pre-Epic 7 compound names like `bmad-orch-auth`)
   **When** `scanWorkspaces()` is called
   **Then** old workspaces are NOT detected (pre-Epic 7 state files fail `isValidState` because they lack `instance`/`repoSlug`/`repoUrl` fields)

4. **Given** I run `agent-env list`
   **When** instances exist across multiple repos
   **Then** all instances are listed correctly with updated field names

5. **Given** I run `agent-env attach auth`
   **When** the instance exists
   **Then** attach works with the new naming scheme

6. **Given** I run `agent-env remove auth`
   **When** the instance passes safety checks
   **Then** remove works with the new naming scheme

7. **Given** I run `agent-env purpose auth "new purpose"`
   **When** the instance exists
   **Then** purpose command works with the new naming scheme

_(Note: AC#3 was later revised in the epic definition to add backward-compatible migration via `migrateOldState()`. That migration was added as a post-implementation patch, not part of the original commit.)_

## Tasks / Subtasks

- [x] Task 1: Update `InstanceState` interface in `lib/types.ts` (AC: #1)
  - [x] 1.1 Replace `name: string` with `instance: string` (user-chosen instance name, max 20 chars)
  - [x] 1.2 Replace `repo: string` with `repoSlug: string` (derived repo identifier, max 39 chars) and `repoUrl: string` (full git URL)
  - [x] 1.3 Update `createFallbackState()` to use new field names with `'unknown'` defaults
  - [x] 1.4 Update JSDoc comments for all changed fields

- [x] Task 2: Update `lib/state.ts` core functions (AC: #1, #3)
  - [x] 2.1 Update `createInitialState()` signature: `(instance, repoSlug, repoUrl, options?)` instead of `(name, repo, options?)`
  - [x] 2.2 Derive `workspaceName` as `${repoSlug}-${instance}` for container name default
  - [x] 2.3 Update `isValidState()` to require `instance`, `repoSlug`, `repoUrl` fields (rejects old `name`/`repo` format)
  - [x] 2.4 Update all state tests to new schema

- [x] Task 3: Update `create-instance.ts` call site (AC: #1)
  - [x] 3.1 Update `createInitialState()` call to pass `instanceName`, `repoName`, `repoUrl` as separate arguments

- [x] Task 4: Update `purpose-instance.ts` for new schema (AC: #7)
  - [x] 4.1 Update `setContainerPurpose()` `WorkspacePath` construction: `name: ${read.state.repoSlug}-${read.state.instance}` instead of `name: read.state.name`

- [x] Task 5: Update `tmux-purpose.sh` jq field references (AC: #4, #5, #6, #7)
  - [x] 5.1 Change `.name` to `.instance` in jq display logic
  - [x] 5.2 Update comments to reflect `instance` field semantics

- [x] Task 6: Fix `setup-instance-isolation.sh` sed escaping (shell script hardening)
  - [x] 6.1 Step 9 (HISTFILE): Change `grep -q` to `grep -qF` for fixed-string matching
  - [x] 6.2 Step 9: Add `ESCAPED_HISTFILE_MARKER` via `sed 's/[][\\.^$*]/\\&/g'` for sed replacement
  - [x] 6.3 Step 11 (AGENT_INSTANCE): Same `grep -qF` and escaped marker pattern
  - [x] 6.4 Align with Step 11b (Epic 6) which already used `grep -qF` and escaping

- [x] Task 7: Update ALL test fixtures across 8 test files (AC: #1-#7)
  - [x] 7.1 `state.test.ts` — Updated `validState`, all `createInitialState` calls, fallback tests, and added old-format rejection test
  - [x] 7.2 `attach-instance.test.ts` — Updated `createTestState` and field assertions
  - [x] 7.3 `create-instance.test.ts` — Updated state field assertions
  - [x] 7.4 `list-instances.test.ts` — Updated `makeState` and 20+ test fixtures
  - [x] 7.5 `purpose-instance.test.ts` — Updated `createTestState` and field assertions
  - [x] 7.6 `rebuild-instance.test.ts` — Updated `createTestState`
  - [x] 7.7 `remove-instance.test.ts` — Updated `createTestState`
  - [x] 7.8 `tmux-purpose.test.ts` — Updated all `.name` references to `.instance` in JSON fixtures

- [x] Task 8: Run full test suite and verify no regressions
  - [x] 8.1 All tests pass with new schema
  - [x] 8.2 Sprint status updated: env-7-1 → done, env-epic-7 → in-progress

## Dev Notes

### Architecture Context
- This is the foundation story for Epic 7. All subsequent stories (7.2-7.5) build on this state schema change
- **Flat workspace layout**: `~/.agent-env/workspaces/<repo-slug>-<instance>/` preserves global uniqueness of `localWorkspaceFolderBasename`, which is critical for Docker volumes, `AGENT_INSTANCE`, and any system using folder basename as unique key
- **Nested layout was rejected**: `workspaces/<repo-slug>/<instance>/` would lose global uniqueness without workarounds
- `AGENT_ENV_INSTANCE` and `AGENT_INSTANCE` env vars are unaffected — flat layout preserves the compound name as globally unique
- **BREAKING CHANGE**: `isValidState()` now requires `instance`/`repoSlug`/`repoUrl`. Pre-Epic 7 state files with `name`/`repo` are rejected, meaning old workspaces become invisible to `scanWorkspaces()`
- The backward-compatible migration (`migrateOldState()`) was added as a post-implementation patch to restore visibility of pre-Epic 7 workspaces

### Key ADR Decisions
- **State schema split**: Single `name` field (compound "bmad-orch-auth") split into `instance` ("auth") + `repoSlug` ("bmad-orch") + `repoUrl` (full URL). This enables proper repo-scoped instance lookup in later stories
- **Container name derivation**: `ae-${repoSlug}-${instance}` computed from structured fields rather than stored as a compound name
- **`isValidState()` strictness**: Intentionally rejects old-format state — clean break rather than silent migration. Migration added later as a separate concern
- **Shell script hardening bundled in**: The `grep -q` → `grep -qF` and sed escaping fix was included because the marker strings `[setup-instance-isolation:...]` contain bracket characters that are regex metacharacters. Steps 9 and 11 predated the Epic 6 pattern (Step 11b) that already handled this correctly

### Technical Specifications
- `InstanceState.instance: string` — User-chosen name (e.g., "auth"), max 20 chars (enforced in Story 7.2)
- `InstanceState.repoSlug: string` — Derived from git URL (e.g., "bmad-orchestrator"), max 39 chars (enforced in Story 7.2)
- `InstanceState.repoUrl: string` — Full git remote URL
- `createInitialState(instance, repoSlug, repoUrl, options?)` — Updated 4-param signature
- `isValidState()` — Requires `instance`, `repoSlug`, `repoUrl`, `createdAt`, `lastAttached`, `containerName`
- `createFallbackState(workspaceName)` — Returns new-format state with `'unknown'` defaults

### Previous Learnings
- From env-6-2: `tmux-purpose.sh` reads state.json via jq — field name changes must propagate to shell scripts
- From env-6-2: Step 11b in `setup-instance-isolation.sh` already used proper `grep -qF` and sed escaping pattern
- From Known AI Agent Risks: Verify all test fixtures are updated — schema changes touch every file that creates test state objects

## Dev Agent Record

### Implementation Plan
1. Update `InstanceState` interface in `types.ts` with new field names and docs
2. Update `state.ts`: `createInitialState` signature, `isValidState` validation, `createFallbackState`
3. Update `create-instance.ts` call site to pass separate instance/repoSlug/repoUrl
4. Update `purpose-instance.ts` WorkspacePath construction
5. Update `tmux-purpose.sh` jq field references (`.name` → `.instance`)
6. Fix `setup-instance-isolation.sh` sed escaping for Steps 9 and 11
7. Update all 8 test files to use new schema in fixtures and assertions
8. Run full test suite

### Debug Log
- No issues encountered during implementation. The schema change was mechanical but wide-reaching — 15 files touched, 339 lines added, 160 removed
- The `list-instances.test.ts` file had the largest diff (+179/-36) because every `makeState()` call needed `instance`, `repoSlug`, and `repoUrl` fields added (previously just `name` and `repo`)
- Shell script fix for `grep -q` → `grep -qF` was bundled as a defensive hardening — the bracket characters in marker strings like `[setup-instance-isolation:HISTFILE]` could cause regex matching issues

### Completion Notes
All 8 tasks completed. Changes across 15 files:
- 3 source files updated: `types.ts` (interface), `state.ts` (core functions), `create-instance.ts` (call site)
- 2 runtime files updated: `purpose-instance.ts`, `tmux-purpose.sh`
- 1 shell script hardened: `setup-instance-isolation.sh` (Steps 9 and 11)
- 8 test files updated with new schema fixtures
- 1 config file updated: `sprint-status.yaml`

Test suite: All tests pass after schema migration.

## File List

- `packages/agent-env/src/lib/types.ts` — Updated `InstanceState` interface: `name`/`repo` → `instance`/`repoSlug`/`repoUrl`; updated `createFallbackState()`
- `packages/agent-env/src/lib/state.ts` — Updated `createInitialState()` signature (4 params), `isValidState()` to require new fields, added JSDoc noting old-format rejection
- `packages/agent-env/src/lib/create-instance.ts` — Updated `createInitialState()` call to pass `instanceName`, `repoName`, `repoUrl` separately
- `packages/agent-env/src/lib/purpose-instance.ts` — Updated `setContainerPurpose()` WorkspacePath `name` to `${repoSlug}-${instance}`
- `image/scripts/tmux-purpose.sh` — Changed jq field reference from `.name` to `.instance` in display logic
- `image/scripts/setup-instance-isolation.sh` — Fixed Steps 9 and 11: `grep -q` → `grep -qF`, added `ESCAPED_*_MARKER` for sed replacement patterns
- `packages/agent-env/src/lib/state.test.ts` — Updated all state tests to new schema; added old-format rejection test and new-format-without-configSource test
- `packages/agent-env/src/lib/attach-instance.test.ts` — Updated `createTestState` and field assertions to new schema
- `packages/agent-env/src/lib/create-instance.test.ts` — Updated state field assertions to new schema
- `packages/agent-env/src/lib/list-instances.test.ts` — Updated `makeState` default and 20+ test fixtures to new schema
- `packages/agent-env/src/lib/purpose-instance.test.ts` — Updated `createTestState` and field assertions to new schema
- `packages/agent-env/src/lib/rebuild-instance.test.ts` — Updated `createTestState` to new schema
- `packages/agent-env/src/lib/remove-instance.test.ts` — Updated `createTestState` to new schema
- `packages/agent-env/src/lib/tmux-purpose.test.ts` — Updated all JSON fixtures from `.name` to `.instance`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated env-7-1 status: backlog → done; env-epic-7: backlog → in-progress

## Senior Developer Review (AI)

**Reviewer:** (Reconstructed from retro) | **Date:** 2026-02-16 | **Outcome:** Approved

**Notes:** This story artifact was reconstructed from commit `a86a099` and the Epic 7 definition in `epics.md` as part of the Epic 7 retrospective follow-up (action item #5). The original implementation did not have a story artifact file — this was identified as a process gap and a new team agreement was established: story artifact files are mandatory for all stories.

## Change Log

- 2026-02-18: Story artifact reconstructed from commit `a86a099` and epic definition (retro follow-up item #5)
- 2026-02-16: Implemented workspace naming and state schema refactor for repo-scoped instances (commit `a86a099`)
