# Story 1.R: Epic 1 Rework — DevPod-to-agent-env Migration

Status: done

## Reviewer Record

### Review 1: Gemini Code Assist

#### Review Summary

The dev agent successfully completed the migration from DevPod to agent-env, meeting all acceptance criteria. The implementation is clean and significantly simplifies the codebase by removing legacy mapping functions. The review identified two medium-severity and two low-severity issues. The medium-severity issues were auto-fixed.

#### Findings & Fixes

- **[MEDIUM] FIXED: Fragile table formatting in `list` command**
  - **Finding:** The text table in `list.ts` used hardcoded padding (`padEnd(20)`), which would break the layout if an instance name was too long.
  - **Fix:** Refactored the table formatting logic to dynamically calculate column widths based on the content, ensuring a robust layout.

- **[MEDIUM] FIXED: Weak tests for `list` command UI**
  - **Finding:** Tests for the table output in `list.test.ts` used vague `toContain` assertions, which wouldn't catch formatting regressions.
  - **Fix:** Replaced the weak assertions with snapshot testing (`toMatchSnapshot()`) to lock in the correct table layout and prevent future regressions.

- **[LOW] Unhandled parsing error in `discovery.ts`**
  - **Finding:** The `try...catch` block around `JSON.parse` in the discovery module returns a generic error message, swallowing the specific parsing error. This was left as-is.

- **[LOW] Hardcoded timeout in `discovery.ts`**
  - **Finding:** The 10-second timeout for the `agent-env` command is hardcoded. This could be made configurable for more flexibility. This was left as-is.

### Review 2: Claude Opus 4.6 (Adversarial Code Review)

#### Review Summary

All 6 acceptance criteria verified as implemented. All tasks marked [x] confirmed done. Zero DevPod references in src/. 45 tests pass, type-check clean. Found 3 medium and 3 low issues. All medium issues auto-fixed.

#### Findings & Fixes

- **[MEDIUM] FIXED: `listCommand` creates its own discovery — untestable without module mocking**
  - **Finding:** `listCommand()` called `createDiscovery()` internally, requiring `vi.mock()` to test. Inconsistent with the DI pattern used in `discovery.ts`.
  - **Fix:** Added `discover` parameter to `listCommand()` with default `createDiscovery()`. Removed module mock from `list.test.ts`, tests now pass discovery function directly via DI.

- **[MEDIUM] FIXED: Snapshot file not documented in story File List**
  - **Finding:** `packages/orchestrator/src/commands/__snapshots__/list.test.ts.snap` created by Review 1 but not tracked in story File List.
  - **Fix:** Added snapshot file to File List under "New files".

- **[MEDIUM] FIXED: `discoverInstances` default export test creates dangling promise**
  - **Finding:** `discovery.test.ts:324` called `discoverInstances()` (real execa) without awaiting, creating unhandled promise rejection in CI where agent-env is not installed.
  - **Fix:** Changed test to `await discoverInstances()` and assert on the DiscoveryResult shape instead of just checking `instanceof Promise`.

- **[LOW] Hardcoded `DEFAULT_TIMEOUT` in `discovery.ts`** — Left as-is (acknowledged by Review 1).
- **[LOW] Generic JSON parse error message in `discovery.ts`** — Left as-is (acknowledged by Review 1).
- **[LOW] `InstanceDisplayStatus` catch-all `'unknown'` could mask new statuses** — Design tradeoff, left as-is.

## Story

As a **developer maintaining the orchestrator**,
I want **the discovery layer rewritten to consume agent-env CLI instead of DevPod CLI**,
so that **the orchestrator works with the actual instance management tool and gets richer data (git state, purpose, typed status) for free**.

## Context

Epic 1 was originally built against DevPod CLI. DevPod has been fully replaced by agent-env (`@zookanalytics/agent-env`), which is complete (all 5 epics done). This rework replaces the DevPod foundation with agent-env CLI consumption.

**Scope:** This is a combined rework of stories 1.2 (fixtures/types), 1.3 (discovery module), and 1.4 (list command). They are tightly coupled — same types flow through all three — and should be done as a single atomic change.

**Sprint change proposal:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-07.md`

## Acceptance Criteria

### AC1: Fixture files replaced

**Given** `packages/orchestrator/src/lib/__fixtures__/`
**When** I look at the fixture files
**Then** old `devPodList*.json` files are deleted and replaced by:
- `instanceList.json` — 3 instances with mixed statuses, git state, purpose (matches `agent-env list --json` envelope)
- `instanceListEmpty.json` — `{ "ok": true, "data": [], "error": null }`
- `instanceListError.json` — `{ "ok": false, "data": null, "error": { "code": "...", "message": "...", "suggestion": "..." } }`

### AC2: Types rewritten for agent-env

**Given** `packages/orchestrator/src/lib/types.ts`
**When** I import instance-related types
**Then** the following exist and DevPod types are removed:
- `InstanceDisplayStatus` type: `'running' | 'stopped' | 'not-found' | 'orphaned' | 'unknown'`
- `Instance` interface: `{ name, status, lastAttached, purpose, gitState }`
- `DiscoveryResult` interface: `{ instances: Instance[], error: string | null }`
- `AgentEnvJsonOutput` interface: `{ ok: boolean, data: Instance[] | null, error: { code, message, suggestion? } | null }`
**And** all DevPod-specific types are deleted: `DevPod`, `DevPodStatus`, `DevPodSource`, `DevPodMachineConfig`, `DevPodProviderConfig`, `DevPodIDEConfig`, `DevPodTimestamp`

### AC3: Discovery module rewritten

**Given** `packages/orchestrator/src/lib/discovery.ts`
**When** I call `discoverInstances()` (renamed from `discoverDevPods()`)
**Then** it executes `agent-env list --json` (not `devpod list --output json`)
**And** parses the `{ ok, data, error }` envelope directly — no field-by-field mapping needed
**And** returns `{ instances: Instance[], error: string | null }`

**Given** agent-env CLI returns `{ ok: true, data: [...] }`
**When** parsed
**Then** `data` array is returned as `instances` directly (agent-env already returns structured data)

**Given** agent-env CLI returns `{ ok: false, error: { code, message, suggestion } }`
**When** parsed
**Then** returns `{ instances: [], error: "DISCOVERY_FAILED: {message}" }`

**Given** agent-env CLI is not installed or execa fails
**When** `discoverInstances()` is called
**Then** returns `{ instances: [], error: "DISCOVERY_FAILED: ..." }` (never throws)

### AC4: List command updated

**Given** `packages/orchestrator/src/commands/list.ts`
**When** I run `bmad-orchestrator list`
**Then** output uses "instances" terminology (not "DevPods")
**And** table shows: NAME, STATUS, PURPOSE columns (not NAME, WORKSPACE, PROVIDER)
**And** empty state message reads "No instances discovered" (not "No DevPods discovered")
**And** error suggestion says "Check if agent-env CLI is available with `agent-env --version`"

**Given** `--json` flag
**When** output is generated
**Then** JSON envelope uses `{ version: "1", instances: [...], errors: [...] }` (not `devpods`)

### AC5: All tests pass

**Given** the reworked code
**When** I run `pnpm --filter @zookanalytics/bmad-orchestrator test:run`
**Then** all tests pass with updated fixtures and assertions
**And** `pnpm --filter @zookanalytics/bmad-orchestrator type-check` passes

### AC6: No DevPod references remain

**Given** the orchestrator package
**When** I search for "devpod" (case-insensitive)
**Then** zero matches in `packages/orchestrator/src/` (no source code references)

## Tasks / Subtasks

- [x] Task 1: Replace fixture files (AC: #1)
  - [x] Delete `devPodList.json`, `devPodListEmpty.json`, `devPodListError.json`
  - [x] Create `instanceList.json` with 3 instances matching agent-env JSON output shape
  - [x] Create `instanceListEmpty.json` with `{ ok: true, data: [], error: null }`
  - [x] Create `instanceListError.json` with `{ ok: false, data: null, error: {...} }`
- [x] Task 2: Rewrite types.ts (AC: #2)
  - [x] Remove all DevPod types (DevPod, DevPodStatus, DevPodSource, etc.)
  - [x] Add `InstanceDisplayStatus` type
  - [x] Add `Instance` interface matching agent-env JSON output
  - [x] Add `GitState` interface (nested in Instance)
  - [x] Add `AgentEnvJsonOutput` interface for CLI envelope parsing
  - [x] Update `DiscoveryResult` to use `instances: Instance[]` (not `devpods: DevPod[]`)
  - [x] Remove `RawObject` (no longer used — agent-env returns structured data)
  - [x] Update `types.test.ts` for new types
- [x] Task 3: Rewrite discovery.ts (AC: #3)
  - [x] Change CLI command from `devpod list --output json` to `agent-env list --json`
  - [x] Remove all mapping functions (mapSource, mapProvider, mapIde, mapMachine, mapTimestamp, mapWorkspaces, mapDevPodOutput) — agent-env returns structured data directly
  - [x] Parse `{ ok, data, error }` envelope: on `ok: true`, return `data` as `instances`; on `ok: false`, return error
  - [x] Rename function: `discoverDevPods` → `discoverInstances`
  - [x] Rename factory export: `discoverDevPods` → `discoverInstances`
  - [x] Update `discovery.test.ts` with agent-env envelope fixtures and updated assertions
- [x] Task 4: Update list.ts command (AC: #4)
  - [x] Update `ListJsonOutput` interface: `devpods` → `instances` field
  - [x] Update table columns: NAME, STATUS, PURPOSE (not NAME, WORKSPACE, PROVIDER)
  - [x] Update empty state: "No instances discovered"
  - [x] Update error suggestion: reference `agent-env --version`
  - [x] Remove `getWorkspacePath()` helper (no longer needed — no DevPod source object)
  - [x] Add status and purpose display from Instance fields
  - [x] Update `list.test.ts` with new output expectations
- [x] Task 5: Update cli.ts (AC: #5, #6)
  - [x] Update command description if it references DevPod
  - [x] Update `cli.test.ts` if needed
- [x] Task 6: Verify clean (AC: #5, #6)
  - [x] Run `pnpm --filter @zookanalytics/bmad-orchestrator test:run` — 45 tests pass
  - [x] Run `pnpm --filter @zookanalytics/bmad-orchestrator type-check` — clean
  - [x] Grep for "devpod" (case-insensitive) in `packages/orchestrator/src/` — zero matches

## Dev Notes

### agent-env CLI JSON Contract

```
$ agent-env list --json

Success:
{
  "ok": true,
  "data": [
    {
      "name": "workspace-name",
      "status": "running" | "stopped" | "orphaned" | "unknown" | "not-found",
      "lastAttached": "2026-02-03T10:00:00.000Z" | null,
      "purpose": "User description" | null,
      "gitState": {
        "ok": true,
        "state": { "hasStaged": false, "stagedCount": 0, "hasUnstaged": true, "unstagedCount": 3, "hasUntracked": false, "untrackedCount": 0, "stashCount": 0, "unpushedBranches": [], "neverPushedBranches": [], "isDetachedHead": false, "isClean": false }
      } | { "ok": false, "state": null, "error": {...} } | null
    }
  ],
  "error": null
}

Error:
{
  "ok": false,
  "data": null,
  "error": { "code": "ERROR_CODE", "message": "...", "suggestion": "..." }
}
```

### Key Simplification

The old DevPod discovery code had ~100 lines of field-by-field mapping functions (`mapSource`, `mapProvider`, `mapIde`, `mapMachine`, `mapTimestamp`, `mapWorkspaces`, `mapDevPodOutput`). **Delete all of them.** agent-env returns typed, structured JSON — just parse the envelope and return `data` directly.

The new `discovery.ts` should be ~40 lines: execute subprocess → parse envelope → return instances or error.

### Architecture Reference Pattern

From architecture.md — the discovery module pattern:

```typescript
import { execa } from 'execa';
import type { Instance, DiscoveryResult } from './types.js';

const DEFAULT_TIMEOUT = 10000;
type CommandExecutor = typeof execa;

interface AgentEnvJsonOutput {
  ok: boolean;
  data: Instance[] | null;
  error: { code: string; message: string; suggestion?: string } | null;
}

export function createDiscovery(executor: CommandExecutor = execa) {
  return async function discoverInstances(): Promise<DiscoveryResult> {
    const result = await executor('agent-env', ['list', '--json'], {
      timeout: DEFAULT_TIMEOUT,
      reject: false,
    });

    if (result.failed) {
      let errorMessage: string;
      if (result.timedOut) {
        errorMessage = `Command timed out after ${DEFAULT_TIMEOUT}ms`;
      } else {
        errorMessage = result.stderr || result.shortMessage || 'Unknown error';
      }
      return { instances: [], error: `DISCOVERY_FAILED: ${errorMessage}` };
    }

    try {
      const parsed: AgentEnvJsonOutput = JSON.parse(result.stdout);
      if (!parsed.ok || !parsed.data) {
        const msg = parsed.error?.message ?? 'Unknown error';
        return { instances: [], error: `DISCOVERY_FAILED: ${msg}` };
      }
      return { instances: parsed.data, error: null };
    } catch {
      return { instances: [], error: 'DISCOVERY_FAILED: Invalid JSON response' };
    }
  };
}

export const discoverInstances = createDiscovery();
```

### Existing Patterns to Preserve

- **DI factory pattern**: `createDiscovery(executor)` — keep this pattern
- **execa with `reject: false`**: errors in return value, not thrown
- **Error utilities**: `createError()` + `formatError()` from `@zookanalytics/shared`
- **Co-located tests**: `*.test.ts` next to source files
- **ESM imports**: `.js` extension on all relative imports
- **import type syntax**: for type-only imports

### List Command Output Changes

Old table: `NAME | WORKSPACE | PROVIDER`
New table: `NAME | STATUS | PURPOSE`

- NAME: `instance.name` (was `pod.id`)
- STATUS: `instance.status` (new — agent-env provides this)
- PURPOSE: `instance.purpose ?? '-'` (new — agent-env provides this)

### Terminology Mapping

| Old | New |
|-----|-----|
| `DevPod` interface | `Instance` interface |
| `DevPodStatus` | `InstanceDisplayStatus` |
| `devpods: DevPod[]` | `instances: Instance[]` |
| `discoverDevPods()` | `discoverInstances()` |
| `devpod list --output json` | `agent-env list --json` |
| `devPodList.json` | `instanceList.json` |
| `No DevPods discovered` | `No instances discovered` |
| `devpod version` | `agent-env --version` |

### Project Structure Notes

- All files in `packages/orchestrator/src/` within the pnpm monorepo
- Fixtures in `packages/orchestrator/src/lib/__fixtures__/`
- Error utilities from `@zookanalytics/shared` (NOT local)
- `tsconfig.json` extends `../../tsconfig.base.json`
- ESLint/Prettier at monorepo root

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-07.md] — full change proposal with terminology mapping, CLI contract, action plan
- [Source: _bmad-output/planning-artifacts/orchestrator/architecture.md#Subprocess-Handling] — discovery module DI pattern and code example
- [Source: _bmad-output/planning-artifacts/orchestrator/architecture.md#Project-Structure] — file locations and naming conventions
- [Source: _bmad-output/planning-artifacts/orchestrator/epics.md#Story-1.2-1.3-1.4] — original acceptance criteria (now updated for agent-env)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered. All tasks completed cleanly on first pass.

### Completion Notes List

- **Task 1**: Deleted 3 old DevPod fixture files, created 3 new agent-env envelope fixtures (instanceList.json with 3 instances showing mixed statuses/gitState/purpose, instanceListEmpty.json, instanceListError.json)
- **Task 2**: Rewrote types.ts from ~137 lines of DevPod types to ~65 lines of agent-env types. Removed 8 DevPod-specific types/interfaces (DevPod, DevPodStatus, DevPodSource, DevPodMachineConfig, DevPodProviderConfig, DevPodIDEConfig, DevPodTimestamp, RawObject). Added InstanceDisplayStatus, Instance, GitState, GitStateResult, AgentEnvJsonOutput, updated DiscoveryResult. Tests: 10 pass.
- **Task 3**: Rewrote discovery.ts from ~199 lines to ~75 lines. Deleted 7 mapping functions (mapSource, mapProvider, mapIde, mapMachine, mapTimestamp, mapWorkspaces, mapDevPodOutput) and toOptionalString helper. New module directly parses `{ ok, data, error }` envelope. Renamed discoverDevPods→discoverInstances, CLI command from `devpod list --output json` to `agent-env list --json`. Tests: 20 pass.
- **Task 4**: Rewrote list.ts — table columns from NAME/WORKSPACE/PROVIDER to NAME/STATUS/PURPOSE, removed getWorkspacePath() and formatDevPodRow(), added formatInstanceRow(), JSON output uses `instances` field (not `devpods`), empty state "No instances discovered", error suggestion references `agent-env --version`. Tests: 9 pass.
- **Task 5**: Updated cli.ts descriptions: program description from "multi-DevPod" to "multi-instance", list command from "List discovered DevPods" to "List discovered instances". Updated cli.test.ts mock and assertions. Tests: 6 pass.
- **Task 6**: Full verification — 45 orchestrator tests pass, type-check clean, zero "devpod" references in src/. Full monorepo regression: 500 tests pass (455 agent-env + 45 orchestrator).

### Change Log

- 2026-02-08: Complete DevPod-to-agent-env migration — rewrote fixtures, types, discovery module, list command, and CLI descriptions. Net code reduction ~130 lines due to agent-env's structured JSON eliminating all mapping functions.
- 2026-02-08: Code review fixes — added DI parameter to `listCommand()`, removed module mock from list tests, fixed dangling promise in discovery default export test, documented snapshot file in File List.

### File List

New files:
- packages/orchestrator/src/lib/__fixtures__/instanceList.json
- packages/orchestrator/src/lib/__fixtures__/instanceListEmpty.json
- packages/orchestrator/src/lib/__fixtures__/instanceListError.json
- packages/orchestrator/src/commands/__snapshots__/list.test.ts.snap

Modified files:
- packages/orchestrator/src/lib/types.ts
- packages/orchestrator/src/lib/types.test.ts
- packages/orchestrator/src/lib/discovery.ts
- packages/orchestrator/src/lib/discovery.test.ts
- packages/orchestrator/src/commands/list.ts
- packages/orchestrator/src/commands/list.test.ts
- packages/orchestrator/src/cli.ts
- packages/orchestrator/src/cli.test.ts

Deleted files:
- packages/orchestrator/src/lib/__fixtures__/devPodList.json
- packages/orchestrator/src/lib/__fixtures__/devPodListEmpty.json
- packages/orchestrator/src/lib/__fixtures__/devPodListError.json
