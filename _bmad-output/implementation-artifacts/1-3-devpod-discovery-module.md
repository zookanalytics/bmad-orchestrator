# Story 1.3: DevPod Discovery Module

Status: ready-for-dev

## Story

As a **developer**,
I want **a discovery module that queries DevPod CLI for active containers**,
So that **the application can find all DevPods on the host machine**.

## Acceptance Criteria

### AC1: Successful Discovery
**Given** DevPod CLI is installed
**When** I call `discoverDevPods()`
**Then** it executes `devpod list --output json`
**And** returns parsed DevPod array with name, workspace, status

### AC2: Empty List Handling
**Given** DevPod CLI returns an empty list
**When** I call `discoverDevPods()`
**Then** it returns `{ devpods: [], error: null }`

### AC3: CLI Failure Handling
**Given** DevPod CLI is not installed or fails
**When** I call `discoverDevPods()`
**Then** it returns `{ devpods: [], error: "DISCOVERY_FAILED: ..." }`
**And** does not throw an exception

### AC4: Dependency Injection for Testing
**Given** the discovery module
**When** I want to test it
**Then** I can inject a mock executor via `createDiscovery(mockExecutor)`

### AC5: Timeout Handling
**Given** a 10-second timeout
**When** DevPod CLI hangs
**Then** the function returns an error result (not throws)

## Tasks / Subtasks

- [ ] Task 1: Create discovery module structure (AC: #4)
  - [ ] 1.1 Create `src/lib/discovery.ts` file
  - [ ] 1.2 Import execa with proper ES module syntax: `import { execa } from 'execa';`
  - [ ] 1.3 Import types from `./types.js`: `DevPod`, `DiscoveryResult`
  - [ ] 1.4 Define `CommandExecutor` type for dependency injection

- [ ] Task 2: Implement factory function pattern (AC: #4)
  - [ ] 2.1 Create `createDiscovery(executor?: CommandExecutor)` factory function
  - [ ] 2.2 Default `executor` to `execa` when not provided
  - [ ] 2.3 Return a `discoverDevPods()` async function from factory
  - [ ] 2.4 Export both `createDiscovery` and a default `discoverDevPods` instance

- [ ] Task 3: Implement DevPod CLI execution (AC: #1, #5)
  - [ ] 3.1 Execute `devpod list --output json` using execa
  - [ ] 3.2 Configure execa with `reject: false` to handle errors in return value
  - [ ] 3.3 Configure 10-second timeout via `timeout: 10000` option
  - [ ] 3.4 Parse JSON output from stdout

- [ ] Task 4: Implement result mapping (AC: #1)
  - [ ] 4.1 Map DevPod CLI JSON structure to internal `DevPod` interface
  - [ ] 4.2 Handle field name differences (CLI may use different names)
  - [ ] 4.3 Extract name, workspacePath, status, optional ide and machine fields
  - [ ] 4.4 Return `DiscoveryResult` with `devpods` array and `error: null`

- [ ] Task 5: Implement empty list handling (AC: #2)
  - [ ] 5.1 Check if parsed result is empty array
  - [ ] 5.2 Return `{ devpods: [], error: null }` for empty list
  - [ ] 5.3 Ensure no special error handling for "no DevPods found"

- [ ] Task 6: Implement error handling (AC: #3, #5)
  - [ ] 6.1 Check execa result for `failed` property
  - [ ] 6.2 Check for timeout via execa result properties
  - [ ] 6.3 Format error message: `DISCOVERY_FAILED: {stderr or reason}`
  - [ ] 6.4 Return `{ devpods: [], error: formattedError }` on failure
  - [ ] 6.5 NEVER throw exceptions - always return error in result object

- [ ] Task 7: Create comprehensive tests (AC: #1, #2, #3, #4, #5)
  - [ ] 7.1 Create `src/lib/discovery.test.ts` (co-located)
  - [ ] 7.2 Test: successful discovery returns parsed DevPods
  - [ ] 7.3 Test: empty list returns `{ devpods: [], error: null }`
  - [ ] 7.4 Test: CLI not found returns error result (not throws)
  - [ ] 7.5 Test: malformed JSON returns error result
  - [ ] 7.6 Test: timeout returns error result
  - [ ] 7.7 Test: mock executor injection works correctly
  - [ ] 7.8 Achieve 90%+ code coverage for discovery.ts

- [ ] Task 8: Verify integration with existing code (AC: #1, #2, #3, #4)
  - [ ] 8.1 Run `npm run check` to verify all quality gates pass
  - [ ] 8.2 Verify imports work with `.js` extension (ESM)
  - [ ] 8.3 Verify types are correctly imported from types.ts
  - [ ] 8.4 Verify fixtures can be used in tests

## Dev Notes

### Architecture Compliance Requirements

**CRITICAL - Follow These Patterns Exactly:**

#### File Location (MANDATORY)
```
src/
└── lib/
    ├── discovery.ts       # Discovery module implementation
    ├── discovery.test.ts  # Co-located tests
    ├── types.ts           # Types from Story 1.2
    └── __fixtures__/      # Test fixtures from Story 1.2
```

#### Execa 9.x Pattern (MANDATORY)

Use the `reject: false` pattern to handle errors in return values, not exceptions:

```typescript
// src/lib/discovery.ts
import { execa, type ResultPromise } from 'execa';

import type { DevPod, DiscoveryResult } from './types.js';

// Type for dependency injection
type CommandExecutor = typeof execa;

export function createDiscovery(executor: CommandExecutor = execa) {
  return async function discoverDevPods(): Promise<DiscoveryResult> {
    const result = await executor('devpod', ['list', '--output', 'json'], {
      timeout: 10000,
      reject: false,  // Errors in return value, NOT thrown
    });

    if (result.failed) {
      return {
        devpods: [],
        error: `DISCOVERY_FAILED: ${result.stderr || result.shortMessage || 'Unknown error'}`,
      };
    }

    try {
      const parsed = JSON.parse(result.stdout);
      const devpods = mapDevPodOutput(parsed);
      return { devpods, error: null };
    } catch (parseError) {
      return {
        devpods: [],
        error: `DISCOVERY_FAILED: Invalid JSON response`,
      };
    }
  };
}

// Default export for production use
export const discoverDevPods = createDiscovery();
```

#### DevPod CLI Output Mapping

The DevPod CLI `list --output json` command returns a JSON structure. Based on research, the structure may look like:

```json
[
  {
    "id": "workspace-name",
    "folder": "/path/to/workspace",
    "provider": { "name": "docker" },
    "status": "Running",
    "ide": { "name": "vscode" }
  }
]
```

Create a mapping function to convert CLI output to internal `DevPod` interface:

```typescript
function mapDevPodOutput(cliOutput: unknown): DevPod[] {
  if (!Array.isArray(cliOutput)) {
    // Handle potential wrapper object
    if (typeof cliOutput === 'object' && cliOutput !== null) {
      const obj = cliOutput as Record<string, unknown>;
      if (Array.isArray(obj.workspaces)) {
        return mapWorkspaces(obj.workspaces);
      }
    }
    return [];
  }
  return mapWorkspaces(cliOutput);
}

function mapWorkspaces(workspaces: unknown[]): DevPod[] {
  return workspaces.map((ws) => {
    const workspace = ws as Record<string, unknown>;
    return {
      name: String(workspace.id || workspace.name || ''),
      workspacePath: String(workspace.folder || workspace.source?.localFolder || ''),
      status: mapStatus(workspace.status),
      ide: typeof workspace.ide === 'object' && workspace.ide !== null
        ? String((workspace.ide as Record<string, unknown>).name || '')
        : undefined,
      machine: typeof workspace.provider === 'object' && workspace.provider !== null
        ? String((workspace.provider as Record<string, unknown>).name || '')
        : undefined,
    };
  });
}

function mapStatus(status: unknown): DevPodStatus {
  const statusStr = String(status || '').toLowerCase();
  if (statusStr === 'running') return 'running';
  if (statusStr === 'stopped') return 'stopped';
  if (statusStr === 'pending') return 'pending';
  return 'error';
}
```

**IMPORTANT:** The exact field names may differ from the expected structure. Task 2 in Story 1.2 researched the actual CLI output. Adjust mapping based on those findings.

#### Testing Pattern with Mock Executor (MANDATORY)

```typescript
// src/lib/discovery.test.ts
import { describe, it, expect, vi } from 'vitest';

import devPodList from './__fixtures__/devPodList.json';
import devPodListEmpty from './__fixtures__/devPodListEmpty.json';

import { createDiscovery } from './discovery.js';

describe('discovery', () => {
  describe('discoverDevPods', () => {
    it('returns parsed DevPods on successful execution', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        stdout: JSON.stringify(devPodList),
        stderr: '',
        failed: false,
      });
      const discover = createDiscovery(mockExecutor as unknown as typeof execa);

      const result = await discover();

      expect(result.error).toBeNull();
      expect(result.devpods).toHaveLength(3);
      expect(result.devpods[0].name).toBeDefined();
      expect(mockExecutor).toHaveBeenCalledWith(
        'devpod',
        ['list', '--output', 'json'],
        expect.objectContaining({ reject: false, timeout: 10000 })
      );
    });

    it('returns empty array when no DevPods exist', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        stdout: JSON.stringify(devPodListEmpty),
        stderr: '',
        failed: false,
      });
      const discover = createDiscovery(mockExecutor as unknown as typeof execa);

      const result = await discover();

      expect(result.error).toBeNull();
      expect(result.devpods).toHaveLength(0);
    });

    it('returns error result when CLI not found', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: 'command not found: devpod',
        failed: true,
        shortMessage: 'Command failed',
      });
      const discover = createDiscovery(mockExecutor as unknown as typeof execa);

      const result = await discover();

      expect(result.devpods).toHaveLength(0);
      expect(result.error).toContain('DISCOVERY_FAILED');
    });

    it('returns error result when JSON is malformed', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        stdout: 'not valid json {{{',
        stderr: '',
        failed: false,
      });
      const discover = createDiscovery(mockExecutor as unknown as typeof execa);

      const result = await discover();

      expect(result.devpods).toHaveLength(0);
      expect(result.error).toContain('DISCOVERY_FAILED');
    });

    it('returns error result on timeout', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        failed: true,
        timedOut: true,
        shortMessage: 'Command timed out',
      });
      const discover = createDiscovery(mockExecutor as unknown as typeof execa);

      const result = await discover();

      expect(result.devpods).toHaveLength(0);
      expect(result.error).toContain('DISCOVERY_FAILED');
    });
  });
});
```

#### Import Patterns (MANDATORY)

```typescript
// Correct - use .js extension for ESM
import { execa } from 'execa';
import type { DevPod, DiscoveryResult, DevPodStatus } from './types.js';

// Incorrect
import { execa } from 'execa';  // OK for external package
import type { DevPod } from './types';  // WRONG - missing .js
```

### Error Handling Philosophy (CRITICAL)

**NEVER THROW EXCEPTIONS from discovery module:**

```typescript
// CORRECT - Return error in result object
if (result.failed) {
  return { devpods: [], error: 'DISCOVERY_FAILED: ...' };
}

// INCORRECT - Never do this
if (result.failed) {
  throw new Error('Discovery failed');  // NO!
}
```

This pattern enables:
1. Clean aggregation with `Promise.allSettled` in later stories
2. Partial failures don't crash the application
3. UI can display error state per-DevPod

### Relationship to Other Stories

**Depends on Story 1.1:**
- TypeScript and Vitest configuration must be in place
- Project structure with `src/lib/` must exist

**Depends on Story 1.2:**
- `DevPod`, `DiscoveryResult`, `DevPodStatus` types in `src/lib/types.ts`
- Test fixtures in `src/lib/__fixtures__/`

**Enables Story 1.4 (List Command):**
- List command will import and use `discoverDevPods()`
- The factory pattern allows the command to use the default instance

### Anti-Patterns to AVOID

| Anti-Pattern | Correct Pattern |
|--------------|-----------------|
| `throw new Error(...)` on CLI failure | Return `{ devpods: [], error: '...' }` |
| `import { foo } from './foo'` | `import { foo } from './foo.js'` |
| Separate `__tests__/discovery.test.ts` | Co-located `discovery.test.ts` |
| Using `execa.command()` | Use `execa(cmd, args, opts)` |
| Mocking global execa | Inject mock via `createDiscovery()` |
| `try/catch` around entire function | Use `reject: false` pattern |

### Execa 9.x Key Points

**Version:** 9.6.1 (latest stable as of Jan 2026)

**Key API Details:**
- `reject: false` - Returns error info in result object instead of throwing
- `timeout` - Timeout in milliseconds (use 10000 for 10 seconds)
- Result object includes: `stdout`, `stderr`, `failed`, `timedOut`, `shortMessage`
- Template string syntax available but we use array syntax for clarity

**Node.js Requirement:** `^18.19.0 || >=20.5.0` (project uses Node 22)

### Coverage Requirements

Per test design document: **90%+ coverage required for lib/discovery.ts**

This is a **Critical priority** module - ensure all edge cases are tested:
- Successful discovery with multiple DevPods
- Empty result set
- CLI not installed
- CLI returns error
- Malformed JSON
- Timeout

### Project Context Notes

- This is Epic 1, Story 3 - Part of "Project Foundation & DevPod Discovery"
- After this story, the core discovery capability is complete
- Story 1.4 will wire this into the CLI `list` command

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Subprocess Handling]
- [Source: _bmad-output/planning-artifacts/architecture.md#Testing Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Handling Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: DevPod Discovery Module]
- [Source: _bmad-output/implementation-artifacts/1-2-test-fixtures-and-discovery-types.md]
- [External: execa npm package](https://www.npmjs.com/package/execa)
- [External: execa GitHub](https://github.com/sindresorhus/execa)
- [External: DevPod CLI docs](https://devpod.sh/docs/quickstart/devpod-cli)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
