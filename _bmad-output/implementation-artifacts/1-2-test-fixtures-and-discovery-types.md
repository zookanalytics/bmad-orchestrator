# Story 1.2: Test Fixtures and Discovery Types

Status: done

## Story

As a **developer**,
I want **test fixtures and type definitions for DevPod discovery**,
So that **I can develop and test the discovery module with realistic data**.

## Acceptance Criteria

### AC1: Fixture Files Exist
**Given** the project structure
**When** I look in `src/lib/__fixtures__/`
**Then** I find these fixture files:
- `devPodList.json` - Normal response with 3 DevPods
- `devPodListEmpty.json` - Empty array response
- `devPodListError.json` - CLI error response

### AC2: Type Definitions Available
**Given** the type definitions in `src/lib/types.ts`
**When** I import DevPod-related types
**Then** I can use:
- `DevPod` interface (name, workspace path, status)
- `DiscoveryResult` interface (devpods array, error)
- `DevPodStatus` type (running, stopped, etc.)

### AC3: Fixture Type Compatibility
**Given** fixture files exist
**When** tests import them
**Then** they load correctly and match type definitions

## Tasks / Subtasks

- [x] Task 1: Create DevPod type definitions (AC: #2)
  - [x] 1.1 Create `src/lib/types.ts` file
  - [x] 1.2 Define `DevPodStatus` type union: `'Running' | 'Stopped' | 'Busy' | 'NotFound'` (updated to match actual DevPod CLI)
  - [x] 1.3 Define `DevPod` interface with fields matching actual CLI output: `id`, `source`, `provider`, `ide?`, `machine?`, etc.
  - [x] 1.4 Define `DiscoveryResult` interface with fields: `devpods: DevPod[]`, `error: string | null`
  - [x] 1.5 Export all types with named exports

- [x] Task 2: Research DevPod CLI output format (AC: #1, #3)
  - [x] 2.1 Run `devpod list --output json` locally and researched DevPod GitHub source code
  - [x] 2.2 Document the actual JSON schema DevPod CLI outputs (fields: id, uid, source, provider, ide, machine, timestamps, etc.)
  - [x] 2.3 Ensure types match CLI output - adjusted field names to match actual DevPod CLI (e.g., `id` not `name`, status values are PascalCase)

- [x] Task 3: Create normal DevPod list fixture (AC: #1, #3)
  - [x] 3.1 Create `src/lib/__fixtures__/devPodList.json`
  - [x] 3.2 Include 3 DevPods with mixed configurations:
    - DevPod 1: git repository source, docker provider, vscode IDE
    - DevPod 2: local folder source, docker provider
    - DevPod 3: git repository source, kubernetes provider, cursor IDE
  - [x] 3.3 Use realistic naming convention (e.g., `bmad-orchestrator`, `other-project`)
  - [x] 3.4 Include realistic source configurations (gitRepository, localFolder)

- [x] Task 4: Create empty DevPod list fixture (AC: #1, #3)
  - [x] 4.1 Create `src/lib/__fixtures__/devPodListEmpty.json`
  - [x] 4.2 Content is an empty array `[]`

- [x] Task 5: Create error response fixture (AC: #1, #3)
  - [x] 5.1 Create `src/lib/__fixtures__/devPodListError.json`
  - [x] 5.2 Include realistic error structure with error, code, stderr fields
  - [x] 5.3 Simulates "devpod command not found" error

- [x] Task 6: Create fixture type tests (AC: #3)
  - [x] 6.1 Create `src/lib/types.test.ts`
  - [x] 6.2 Test that `devPodList.json` imports and matches `DevPod[]` type
  - [x] 6.3 Test that `devPodListEmpty.json` imports as empty `DevPod[]`
  - [x] 6.4 Test type narrowing works correctly for DevPodStatus
  - [x] 6.5 All 10 tests pass with `pnpm test:run`

- [x] Task 7: Verify integration with Story 1.1 (AC: #1, #2, #3)
  - [x] 7.1 Run `pnpm check` - all quality gates pass (type-check, lint, test with 100% coverage)
  - [x] 7.2 Verify types.ts has no lint errors
  - [x] 7.3 Verify fixtures are properly formatted (prettier)

### Review Follow-ups (AI)

- [ ] [AI-Review][Low] Documentation Gap: The reason for including `esModuleInterop: true` in `tsconfig.json` is not explicitly documented as a task or AC. Consider adding a task to clarify its necessity for JSON imports.
- [ ] [AI-Review][Low] Code Quality / Naming Consistency: The `DevPodStatus` type union uses PascalCase string literals (e.g., `'Running'`). While claimed to match CLI output, verify if this is consistent with broader DevPod CLI output conventions for string enums. If not, consider standardizing to `snake_case` or `lowercase` for robustness.
- [ ] [AI-Review][Low] Test Quality / Exhaustive Fixture Validation: The tests in `src/lib/types.test.ts` do not exhaustively validate all fields of all 3 DevPods in `devPodList.json` against the detailed descriptions provided in Task 3.2. Enhance tests to ensure full coverage of fixture data as per story requirements.

## Dev Notes

### Architecture Compliance Requirements

**CRITICAL - Follow These Patterns Exactly:**

#### File Location (MANDATORY)
```
src/
└── lib/
    ├── __fixtures__/           # Test fixtures go HERE, not src/__fixtures__/
    │   ├── devPodList.json
    │   ├── devPodListEmpty.json
    │   └── devPodListError.json
    └── types.ts                # All shared types in this ONE file
```

#### Types File Structure (MANDATORY)
The `types.ts` file will grow to include all shared types for the project. For this story, only DevPod-related types are needed:

```typescript
// src/lib/types.ts

/**
 * Status of a DevPod container as reported by DevPod CLI
 */
export type DevPodStatus = 'running' | 'stopped' | 'pending' | 'error';

/**
 * DevPod information from `devpod list --output json`
 */
export interface DevPod {
  /** DevPod name (e.g., "devpod-myproject") */
  name: string;
  /** Workspace path on host machine */
  workspacePath: string;
  /** Current status of the DevPod */
  status: DevPodStatus;
  /** Optional IDE integration */
  ide?: string;
  /** Optional machine provider */
  machine?: string;
}

/**
 * Result of DevPod discovery operation
 */
export interface DiscoveryResult {
  /** List of discovered DevPods */
  devpods: DevPod[];
  /** Error message if discovery failed, null otherwise */
  error: string | null;
}
```

#### Naming Conventions (MANDATORY)

| Type | Pattern | Example | Anti-Pattern |
|------|---------|---------|--------------|
| Interfaces | PascalCase, NO prefix | `DevPod` | `IDevPod` |
| Types | PascalCase, NO prefix | `DevPodStatus` | `TDevPodStatus` |
| Fixture files | camelCase | `devPodList.json` | `dev-pod-list.json` |

#### Import Patterns (MANDATORY)

```typescript
// Correct - use .js extension for ESM
import type { DevPod, DiscoveryResult } from './types.js';

// Incorrect - missing .js extension
import type { DevPod, DiscoveryResult } from './types';
```

#### Fixture JSON Structure

Based on DevPod CLI output format, fixtures should match this structure:

```json
// devPodList.json - 3 DevPods, mixed states
[
  {
    "name": "devpod-bmad-orchestrator",
    "workspacePath": "/Users/node/.devpod/workspaces/bmad-orchestrator",
    "status": "running",
    "ide": "vscode",
    "machine": "docker"
  },
  {
    "name": "devpod-other-project",
    "workspacePath": "/Users/node/.devpod/workspaces/other-project",
    "status": "stopped"
  },
  {
    "name": "devpod-third-project",
    "workspacePath": "/Users/node/.devpod/workspaces/third-project",
    "status": "running",
    "ide": "cursor"
  }
]

// devPodListEmpty.json
[]

// devPodListError.json - represents CLI execution failure
{
  "error": "devpod command not found",
  "stderr": "bash: devpod: command not found"
}
```

**Note:** The exact fixture structure may need adjustment after running `devpod list --output json` to see the actual field names. Task 2 addresses this research step.

### Testing Patterns (MANDATORY)

**Co-located test files:**
```
src/lib/
├── types.ts
└── types.test.ts    # Co-located, NOT in __tests__/
```

**Test file structure:**
```typescript
// src/lib/types.test.ts
import { describe, it, expect } from 'vitest';

import type { DevPod, DevPodStatus, DiscoveryResult } from './types.js';

// Import fixtures for type validation
import devPodList from './__fixtures__/devPodList.json';
import devPodListEmpty from './__fixtures__/devPodListEmpty.json';

describe('types', () => {
  describe('DevPod', () => {
    it('fixture matches DevPod[] type', () => {
      const pods: DevPod[] = devPodList;
      expect(pods).toHaveLength(3);
      expect(pods[0].name).toBeDefined();
      expect(pods[0].workspacePath).toBeDefined();
      expect(pods[0].status).toBeDefined();
    });

    it('empty fixture matches DevPod[] type', () => {
      const pods: DevPod[] = devPodListEmpty;
      expect(pods).toHaveLength(0);
    });
  });

  describe('DevPodStatus', () => {
    it('accepts valid status values', () => {
      const statuses: DevPodStatus[] = ['running', 'stopped', 'pending', 'error'];
      expect(statuses).toContain('running');
    });
  });
});
```

### TypeScript Configuration for JSON Imports

Ensure `tsconfig.json` has `resolveJsonModule: true` to allow JSON imports:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true
    // ... other options from Story 1.1
  }
}
```

### Relationship to Other Stories

**Depends on Story 1.1:**
- This story assumes the project structure from Story 1.1 exists
- `src/lib/__fixtures__/` directory should already exist
- Vitest and TypeScript should already be configured

**Enables Story 1.3 (Discovery Module):**
- Types defined here will be used by `discovery.ts`
- Fixtures will be used to test the discovery module
- `DiscoveryResult` interface defines the contract for `discoverDevPods()`

### Anti-Patterns to AVOID

| Anti-Pattern | Correct Pattern |
|--------------|-----------------|
| `src/__fixtures__/` | `src/lib/__fixtures__/` |
| `interface IDevPod` | `interface DevPod` |
| `type TStatus = ...` | `type DevPodStatus = ...` |
| `import { DevPod } from './types'` | `import type { DevPod } from './types.js'` |
| `__tests__/types.test.ts` | `types.test.ts` (co-located) |
| Separate type files per entity | All types in `lib/types.ts` |

### Test Priority

Per the test design document, `lib/types.ts` tests are **Medium priority** but blocking for Stories 1.3 and 1.4. Ensure tests pass before proceeding.

### Project Structure Notes

- All types will live in `src/lib/types.ts` - this is the central location for shared types
- As more stories are implemented, types.ts will grow to include `SprintStatus`, `StoryState`, `BmadState`, etc.
- Keep types.ts well-organized with JSDoc comments for maintainability

### DevPod CLI Research Notes

The actual DevPod CLI output structure needs to be verified. Options:
1. Run `devpod list --output json` locally if DevPod is installed
2. Check DevPod documentation at https://devpod.sh/docs
3. Check DevPod GitHub for CLI source code

Expected structure (may vary):
```json
{
  "workspaces": [
    {
      "id": "workspace-id",
      "folder": "/path/to/folder",
      "provider": "docker",
      "status": "Running"
    }
  ]
}
```

**Action:** Adjust types and fixtures based on actual CLI output discovered in Task 2.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure (Refined)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Test Fixtures (Required for Step 1)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Test Fixtures and Discovery Types]
- [Source: _bmad-output/test-design-system.md#Test Fixtures Required (Sprint 0)]
- [Source: _bmad-output/implementation-artifacts/1-1-project-initialization-with-quality-gates.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- DevPod CLI research: Analyzed DevPod GitHub source code (pkg/provider/workspace.go, pkg/client/client.go)
- Status values confirmed: Running, Stopped, Busy, NotFound (PascalCase)
- JSON structure verified from DevPod source: id, uid, source, provider, ide, machine, timestamps

### Completion Notes List

- ✅ Created comprehensive type definitions based on actual DevPod CLI output structure
- ✅ DevPodStatus type uses actual CLI values: 'Running' | 'Stopped' | 'Busy' | 'NotFound'
- ✅ DevPod interface matches CLI JSON output with id, source, provider, ide, machine, timestamps
- ✅ Added supporting types: DevPodSource, DevPodMachineConfig, DevPodProviderConfig, DevPodIDEConfig, DevPodTimestamp
- ✅ Created 3 realistic fixtures matching actual CLI structure
- ✅ All 10 tests passing with 100% code coverage
- ✅ Added `resolveJsonModule: true` to tsconfig.json for JSON imports
- ✅ Used `with { type: 'json' }` import attribute for NodeNext module compliance

### File List

- `src/lib/types.ts` (new) - Type definitions for DevPod discovery
- `src/lib/types.test.ts` (new) - Test suite for types and fixtures (10 tests)
- `src/lib/__fixtures__/devPodList.json` (new) - Normal response fixture with 3 DevPods
- `src/lib/__fixtures__/devPodListEmpty.json` (new) - Empty array fixture
- `src/lib/__fixtures__/devPodListError.json` (new) - Error response fixture
- `tsconfig.json` (modified) - Added resolveJsonModule: true
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) - Updated sprint status

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (code-review workflow)
**Date:** 2026-01-18
**Outcome:** ✅ APPROVED

### Verification Summary

| Check | Result |
|-------|--------|
| All ACs Implemented | ✓ 3/3 verified |
| All Tasks Complete | ✓ 18/18 audited |
| Quality Gates | ✓ `pnpm check` passes |
| Test Coverage | ✓ 100% on types.ts |
| Architecture Compliance | ✓ lib/__fixtures__/ pattern followed |
| Code Quality | ✓ Clean types, proper JSDoc |
| Security | ✓ No vulnerabilities (type definitions only) |

### Findings

**High/Medium Issues:** None

**Low Issues (4):**
1. Alphabetic ordering of DevPodStatus values (cosmetic preference)
2. JSON fixtures show 0% coverage (expected - not executable code)
3. devPodListError.json not tested yet (reserved for Story 1.3)
4. Import attribute syntax is modern (correct usage)

### Notes

- Implementation improved upon Dev Notes specification based on actual DevPod CLI research
- Types match real DevPod CLI output structure (id, source, provider vs simplified name/workspacePath/status)
- All previously logged Review Follow-ups remain valid low-priority items

## Change Log

- 2026-01-18: Senior Developer Review (AI) - APPROVED, status updated to done
- 2026-01-18: Story 1.2 implemented - test fixtures and discovery types created with comprehensive type definitions matching actual DevPod CLI output
