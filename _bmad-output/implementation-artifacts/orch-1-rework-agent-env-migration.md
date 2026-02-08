# Story 1.R: Epic 1 Rework — DevPod-to-agent-env Migration

Status: ready-for-dev

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

- [ ] Task 1: Replace fixture files (AC: #1)
  - [ ] Delete `devPodList.json`, `devPodListEmpty.json`, `devPodListError.json`
  - [ ] Create `instanceList.json` with 3 instances matching agent-env JSON output shape
  - [ ] Create `instanceListEmpty.json` with `{ ok: true, data: [], error: null }`
  - [ ] Create `instanceListError.json` with `{ ok: false, data: null, error: {...} }`
- [ ] Task 2: Rewrite types.ts (AC: #2)
  - [ ] Remove all DevPod types (DevPod, DevPodStatus, DevPodSource, etc.)
  - [ ] Add `InstanceDisplayStatus` type
  - [ ] Add `Instance` interface matching agent-env JSON output
  - [ ] Add `GitState` interface (nested in Instance)
  - [ ] Add `AgentEnvJsonOutput` interface for CLI envelope parsing
  - [ ] Update `DiscoveryResult` to use `instances: Instance[]` (not `devpods: DevPod[]`)
  - [ ] Keep `RawObject` if still used, otherwise remove
  - [ ] Update `types.test.ts` for new types
- [ ] Task 3: Rewrite discovery.ts (AC: #3)
  - [ ] Change CLI command from `devpod list --output json` to `agent-env list --json`
  - [ ] Remove all mapping functions (mapSource, mapProvider, mapIde, mapMachine, mapTimestamp, mapWorkspaces, mapDevPodOutput) — agent-env returns structured data directly
  - [ ] Parse `{ ok, data, error }` envelope: on `ok: true`, return `data` as `instances`; on `ok: false`, return error
  - [ ] Rename function: `discoverDevPods` → `discoverInstances`
  - [ ] Rename factory export: `discoverDevPods` → `discoverInstances`
  - [ ] Update `discovery.test.ts` with agent-env envelope fixtures and updated assertions
- [ ] Task 4: Update list.ts command (AC: #4)
  - [ ] Update `ListJsonOutput` interface: `devpods` → `instances` field
  - [ ] Update table columns: NAME, STATUS, PURPOSE (not NAME, WORKSPACE, PROVIDER)
  - [ ] Update empty state: "No instances discovered"
  - [ ] Update error suggestion: reference `agent-env --version`
  - [ ] Remove `getWorkspacePath()` helper (no longer needed — no DevPod source object)
  - [ ] Add status and purpose display from Instance fields
  - [ ] Update `list.test.ts` with new output expectations
- [ ] Task 5: Update cli.ts (AC: #5, #6)
  - [ ] Update command description if it references DevPod
  - [ ] Update `cli.test.ts` if needed
- [ ] Task 6: Verify clean (AC: #5, #6)
  - [ ] Run `pnpm --filter @zookanalytics/bmad-orchestrator test:run`
  - [ ] Run `pnpm --filter @zookanalytics/bmad-orchestrator type-check`
  - [ ] Grep for "devpod" (case-insensitive) in `packages/orchestrator/src/` — must be zero

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



### Debug Log References

### Completion Notes List

### File List
