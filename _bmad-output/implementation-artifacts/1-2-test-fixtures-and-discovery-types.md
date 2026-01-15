# Story 1.2: Test Fixtures and Discovery Types

Status: ready-for-dev

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

- [ ] Task 1: Create DevPod type definitions (AC: #2)
  - [ ] 1.1 Create `src/lib/types.ts` file
  - [ ] 1.2 Define `DevPodStatus` type union: `'running' | 'stopped' | 'pending' | 'error'`
  - [ ] 1.3 Define `DevPod` interface with fields: `name`, `workspacePath`, `status`, `ide?`, `machine?`
  - [ ] 1.4 Define `DiscoveryResult` interface with fields: `devpods: DevPod[]`, `error: string | null`
  - [ ] 1.5 Export all types with named exports

- [ ] Task 2: Research DevPod CLI output format (AC: #1, #3)
  - [ ] 2.1 Run `devpod list --output json` locally or research docs to get exact field names
  - [ ] 2.2 Document the actual JSON schema DevPod CLI outputs
  - [ ] 2.3 Ensure types match CLI output (may need to adjust field names)

- [ ] Task 3: Create normal DevPod list fixture (AC: #1, #3)
  - [ ] 3.1 Create `src/lib/__fixtures__/devPodList.json`
  - [ ] 3.2 Include 3 DevPods with mixed states:
    - DevPod 1: running state, with workspace path
    - DevPod 2: stopped state, with workspace path
    - DevPod 3: running state, different workspace path
  - [ ] 3.3 Use realistic naming convention (e.g., `devpod-myproject`, `devpod-another`)
  - [ ] 3.4 Include workspace paths pointing to `~/.devpod/workspaces/` or similar

- [ ] Task 4: Create empty DevPod list fixture (AC: #1, #3)
  - [ ] 4.1 Create `src/lib/__fixtures__/devPodListEmpty.json`
  - [ ] 4.2 Content should be an empty array `[]`

- [ ] Task 5: Create error response fixture (AC: #1, #3)
  - [ ] 5.1 Create `src/lib/__fixtures__/devPodListError.json`
  - [ ] 5.2 Include realistic error structure from DevPod CLI
  - [ ] 5.3 Simulate "devpod not found" or connection error

- [ ] Task 6: Create fixture type tests (AC: #3)
  - [ ] 6.1 Create `src/lib/types.test.ts`
  - [ ] 6.2 Test that `devPodList.json` imports and matches `DevPod[]` type
  - [ ] 6.3 Test that `devPodListEmpty.json` imports as empty `DevPod[]`
  - [ ] 6.4 Test type narrowing works correctly for DevPodStatus
  - [ ] 6.5 Ensure all tests pass with `pnpm test:run`

- [ ] Task 7: Verify integration with Story 1.1 (AC: #1, #2, #3)
  - [ ] 7.1 Run `pnpm check` to verify full quality gates pass
  - [ ] 7.2 Verify types.ts has no lint errors
  - [ ] 7.3 Verify fixtures are properly formatted (prettier)

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

