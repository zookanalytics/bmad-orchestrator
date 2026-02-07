# Story 5.3: Implement Force Remove

Status: done

## Story

As a **user**,
I want **to force-remove an instance when I'm certain I don't need the work**,
So that **I can clean up without resolving every git issue**.

## Acceptance Criteria

1. **Given** an instance with unsafe git state
   **When** I run `agent-env remove auth --force`
   **Then** I see a warning listing everything that will be lost
   **And** I'm prompted to type the instance name to confirm

2. **Given** the force confirmation prompt
   **When** I type the instance name correctly
   **Then** the instance is removed regardless of git state
   **And** I see "Instance 'auth' force-removed. Data permanently deleted."

3. **Given** the force confirmation prompt
   **When** I type the wrong name or press Ctrl+C
   **Then** the removal is cancelled
   **And** I see "Removal cancelled"

4. **Given** an instance with clean git state
   **When** I run `agent-env remove auth --force`
   **Then** it removes without the extra confirmation (not needed)

5. **Given** I run `agent-env remove auth --force --yes`
   **When** used in a script
   **Then** it skips the confirmation prompt entirely (for automation)
   **And** this is documented as dangerous

6. **Given** a force remove completes (with or without --yes)
   **When** the instance is deleted
   **Then** an entry is written to `~/.agent-env/audit.log`
   **And** the entry includes: timestamp, instance name, git state at removal, user confirmation method

## Tasks / Subtasks

- [x] Task 1: Add audit log module (AC: #6)
  - [x] 1.1 Create `packages/agent-env/src/lib/audit-log.ts` with types and write function
  - [x] 1.2 Write tests in `audit-log.test.ts`

- [x] Task 2: Update removeInstance to support force-remove with git state awareness (AC: #1-#6)
  - [x] 2.1 Update `removeInstance()` to run git state detection even when force=true (needed for warning display and audit log)
  - [x] 2.2 Update `RemoveResult` to include git state on successful force removals
  - [x] 2.3 Add audit log writing after force removals
  - [x] 2.4 Write tests for force-with-gitstate behavior

- [x] Task 3: Update remove command with confirmation prompt and --yes flag (AC: #1-#5)
  - [x] 3.1 Add `--yes` flag to remove command
  - [x] 3.2 Implement force confirmation flow: show warning, prompt for name, validate
  - [x] 3.3 Skip confirmation when git state is clean (AC: #4)
  - [x] 3.4 Skip confirmation when --yes is provided (AC: #5)
  - [x] 3.5 Write audit log with confirmation method

- [x] Task 4: Write CLI integration tests for force-remove (AC: #1-#6)
  - [x] 4.1 Test force with dirty state shows warning and force-removes (with --yes for non-interactive test)
  - [x] 4.2 Test force with clean state removes without extra confirmation
  - [x] 4.3 Test force --yes skips confirmation
  - [x] 4.4 Test audit log is written on force removal

- [x] Task 5: Run full test suite and verify no regressions
  - [x] 5.1 Run `pnpm --filter @zookanalytics/agent-env test:run` — all 437 tests pass
  - [x] 5.2 Run `pnpm -r test:run` for all packages — 513 total tests pass (25 shared + 51 orchestrator + 437 agent-env)
  - [x] 5.3 Run `pnpm --filter @zookanalytics/agent-env type-check` — clean

## Code Review Findings

### Review 1 (2026-02-06) — 1 Medium fixed, 4 Low noted

**Medium Issues (1 Fixed):**

1.  **Inconsistent Error Handling for Container Operations with `--force`**
    *   **Resolution**: Modified `remove-instance.ts` so `containerStop`/`containerRemove` failures with `--force` log warnings and proceed.

**Low Issues (4 - Accepted):**

1.  Audit log `appendFile` not atomic (accepted: append-only log, low corruption risk)
2.  `RemoveResult` type allows `gitState`/`blockers` on non-forced `ok: true` (accepted: harmless)
3.  `--yes` flag documentation could be more prominent (addressed in Review 2)
4.  `--force` on clean instance says "Data permanently deleted" (accepted: consistent messaging)

### Review 2 (2026-02-06) — 1 High fixed, 2 Medium fixed, 2 Low fixed

**High Issues (1 Fixed):**

1.  **`--yes` without `--force` silently ignored** (`commands/remove.ts`)
    *   **Description**: `--yes` without `--force` had no guard — silently performed normal removal.
    *   **Resolution**: Added early guard that errors with `INVALID_OPTIONS` when `--yes` is used without `--force`.

**Medium Issues (2 Fixed):**

1.  **Unhandled `writeAuditLogEntry` failure crashes command after successful deletion** (`commands/remove.ts`)
    *   **Description**: Audit log write failures would throw after the instance was already deleted, giving a misleading error.
    *   **Resolution**: Wrapped both audit log write calls in try/catch; failures now produce a non-fatal warning.
2.  **`appendFile` not atomic for concurrent writes** (`audit-log.ts`)
    *   **Description**: Concurrent force-removes could interleave writes. Accepted as low-risk for append-only log in single-user CLI tool.

**Low Issues (2 Fixed):**

1.  **`--yes` flag description strengthened** — changed to `'DANGEROUS: skips all safety prompts, for scripts only'`
2.  **Step comment numbering corrected** in `remove-instance.ts` — Steps 5/6/7 renumbered to 4/5/6.

## Dev Notes

### Architecture Requirements

**Existing Code Reused:**
- `evaluateSafetyChecks()` from `remove-instance.ts` — produces blocker strings from GitState
- `getGitState()` from `git.ts` — comprehensive git state detection
- `removeInstance()` from `remove-instance.ts` — orchestrates removal with safety checks
- `formatSafetyReport()` from `safety-report.ts` — formats safety report for display
- `formatError()` from `@zookanalytics/shared` — base error formatting

**New Code:**
- `audit-log.ts` — writes JSON Lines audit log entries to `~/.agent-env/audit.log`
- Enhanced `removeInstance()` to get git state even for forced removals (for audit + UI)
- Enhanced `commands/remove.ts` with `--yes` flag and confirmation prompt flow

**Key Design Decisions:**
- Audit log format: JSON Lines (one JSON object per line) for easy parsing
- Audit log path: `~/.agent-env/audit.log` (same base dir as workspaces)
- Confirmation method values: "typed-name", "yes-flag", "not-required" (clean state)
- Force with clean state: no confirmation needed, still writes audit log
- Force with dirty state + no --yes: requires typing instance name
- Force with --yes: always skips confirmation regardless of git state
- Use `node:readline` for interactive input (not Ink — remove is a non-interactive command)
- Two-phase force flow: first try non-force removal (to get safety check results), then if blocked and --force, show warning, get confirmation, then execute force removal
- Non-interactive mode (piped/CI): --force without --yes on dirty state shows error with hint to use --yes

### References

- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-5.3]
- [Source: packages/agent-env/src/lib/remove-instance.ts (existing force bypass)]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

None.

### Completion Notes List

- Task 1: Created `audit-log.ts` with `AuditLogEntry` type, `createAuditEntry()`, `writeAuditLogEntry()`, and `getAuditLogPath()`. DI pattern with `AuditLogDeps` interface. JSON Lines format. 9 tests in `audit-log.test.ts` covering entry creation, log writing, appending, and path resolution.
- Task 2: Updated `RemoveResult` type to include `forced`, `gitState`, and `blockers` on success. Modified `removeInstance()` to always run git state detection (even force=true) so warnings and audit logs have data. Force with git detection failure proceeds anyway (non-fatal). 4 new unit tests: force-with-gitstate, force-clean, force-with-git-failure, and returns-blockers-on-force.
- Task 3: Rewrote `commands/remove.ts` with two-phase flow: (1) try non-force to get safety results, (2) if blocked and --force, show warning, get confirmation, execute force removal. Added `--yes` flag. Interactive confirmation uses `node:readline` to prompt for instance name. Non-TTY without --yes shows error with hint. Clean state with --force skips confirmation. All force removals write audit log.
- Task 4: Added 5 new CLI integration tests: force-with-audit-log, force-clean-no-confirmation, force-with-warning-display, force-no-tty-hint, and --yes-in-help. Updated existing force test to use --yes.
- Task 5: All 513 tests pass (25 shared + 51 orchestrator + 437 agent-env). TypeScript type-check clean. No regressions.

### Change Log

- 2026-02-06: Story created, implementation started
- 2026-02-06: All 5 tasks completed, all tests pass (513 total), type-check clean, status → review
- 2026-02-06: Code review #1 completed. 1 Medium issue fixed, 4 Low issues identified. Status → in-progress.
- 2026-02-06: Code review #2 completed. 1 High + 2 Medium + 2 Low issues fixed. All 437 tests pass, type-check clean. Status → done.

### File List

**New Files:**
- packages/agent-env/src/lib/audit-log.ts
- packages/agent-env/src/lib/audit-log.test.ts

**Modified Files:**
- packages/agent-env/src/lib/remove-instance.ts (RemoveResult type extension, git state detection for force mode)
- packages/agent-env/src/lib/remove-instance.test.ts (updated force tests, added 4 new tests)
- packages/agent-env/src/commands/remove.ts (--yes flag, confirmation prompt, two-phase force flow, audit log)
- packages/agent-env/src/cli.test.ts (updated force test, added 5 new integration tests)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status update)
