# Story 1.3: Migrate Orchestrator to packages/

Status: ready-for-dev

## Story

As a **developer**,
I want **the existing orchestrator code moved to `packages/orchestrator/`**,
So that **both CLIs follow the same monorepo structure**.

## Acceptance Criteria

1. **Given** the existing `src/` orchestrator code
   **When** I run `bmad-orchestrator list`
   **Then** it works exactly as before with no behavioral changes

2. **Given** the migrated orchestrator package
   **When** I run `pnpm --filter @zookanalytics/bmad-orchestrator test`
   **Then** all existing tests pass (zero regressions)

3. **Given** the orchestrator package imports shared utilities
   **When** I check the imports
   **Then** `@zookanalytics/shared` is used for error formatting

4. **Given** I run `pnpm pack` in packages/orchestrator
   **When** I install the resulting tarball in a fresh directory
   **Then** `bmad-orchestrator --help` works correctly (publish smoke test)

## Tasks / Subtasks

- [ ] Task 1: Move orchestrator source files (AC: #1, #2)
  - [ ] 1.1 Create `packages/orchestrator/` directory structure
  - [ ] 1.2 Move `src/cli.ts` and `src/cli.test.ts` to `packages/orchestrator/src/`
  - [ ] 1.3 Move `src/commands/` to `packages/orchestrator/src/commands/`
  - [ ] 1.4 Move `src/lib/` to `packages/orchestrator/src/lib/`
  - [ ] 1.5 Move empty `src/components/`, `src/hooks/`, `src/types/` directories
  - [ ] 1.6 Move `bin/bmad-orchestrator.js` to `packages/orchestrator/bin/`
  - [ ] 1.7 Remove old root `src/` and `bin/` directories after verification

- [ ] Task 2: Create orchestrator package configuration (AC: #1, #2, #4)
  - [ ] 2.1 Create `packages/orchestrator/package.json` with workspace dependency on shared
  - [ ] 2.2 Create `packages/orchestrator/tsconfig.json` extending `../../tsconfig.base.json`
  - [ ] 2.3 Create `packages/orchestrator/vitest.config.ts` for package-specific test config
  - [ ] 2.4 Update `packages/orchestrator/bin/bmad-orchestrator.js` entry point path

- [ ] Task 3: Update imports to use shared package (AC: #3)
  - [ ] 3.1 Import `formatError` from `@zookanalytics/shared` where needed
  - [ ] 3.2 Update all relative imports to use `.js` extension (ESM requirement)
  - [ ] 3.3 Verify no circular dependencies exist

- [ ] Task 4: Update root workspace configuration (AC: #1, #2)
  - [ ] 4.1 Remove `src/` and `bin/` references from root `package.json`
  - [ ] 4.2 Update root scripts to use workspace commands
  - [ ] 4.3 Move orchestrator-specific devDependencies to `packages/orchestrator/package.json`

- [ ] Task 5: Verify migration completeness (AC: #1, #2, #4)
  - [ ] 5.1 Run `pnpm install` at root to relink packages
  - [ ] 5.2 Run `pnpm --filter @zookanalytics/bmad-orchestrator test` - all tests must pass
  - [ ] 5.3 Run `pnpm --filter @zookanalytics/bmad-orchestrator build` - TypeScript compiles
  - [ ] 5.4 Run `pnpm dev:orchestrator list` - CLI works correctly
  - [ ] 5.5 Run `pnpm pack` in `packages/orchestrator/` and verify tarball
  - [ ] 5.6 Verify fixture files in `lib/__fixtures__/` are correctly located

## Dev Notes

### Previous Story Context

**Story 1.1** created the workspace infrastructure:
- `pnpm-workspace.yaml` with `packages: ['packages/*']`
- Root `package.json` configured as workspace root (`private: true`)
- `tsconfig.base.json` with shared TypeScript configuration
- Empty `packages/` directory structure with placeholders

**Story 1.2** created the shared utilities package:
- `packages/shared/` with `@zookanalytics/shared`
- `formatError()`, `createError()`, `AppError` type
- `JsonOutput<T>` type for standardized CLI output
- `createExecutor()` with execa wrapper using `reject: false` pattern

**CRITICAL:** Stories 1.1 and 1.2 must be completed before starting this story. Verify:
- `pnpm-workspace.yaml` exists
- `packages/shared/` is fully implemented with tests passing
- `pnpm install` at root links all packages correctly

### Current Orchestrator Structure (What Exists)

```
bmad-orchestrator/                    # CURRENT ROOT
├── src/
│   ├── cli.ts                        # Entry point
│   ├── cli.test.ts                   # CLI tests
│   ├── commands/
│   │   ├── list.ts                   # DevPod list command
│   │   └── list.test.ts
│   ├── lib/
│   │   ├── types.ts                  # DevPod types
│   │   ├── types.test.ts
│   │   ├── discovery.ts              # DevPod discovery
│   │   ├── discovery.test.ts
│   │   └── __fixtures__/
│   │       ├── devPodList.json
│   │       ├── devPodListEmpty.json
│   │       └── devPodListError.json
│   ├── components/                   # Empty
│   ├── hooks/                        # Empty
│   └── types/                        # Empty
├── bin/
│   └── bmad-orchestrator.js
├── package.json                      # @zookanalytics/bmad-orchestrator
└── tsconfig.json
```

### Target Structure (After Migration)

```
bmad-orchestrator/                    # WORKSPACE ROOT
├── package.json                      # Workspace root (private: true)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts                  # Root vitest config
├── eslint.config.js
│
├── packages/
│   ├── shared/                       # From Story 1.2
│   │   └── ...
│   │
│   └── orchestrator/                 # MIGRATED HERE
│       ├── package.json              # @zookanalytics/bmad-orchestrator
│       ├── tsconfig.json             # Extends ../../tsconfig.base.json
│       ├── vitest.config.ts
│       ├── bin/
│       │   └── bmad-orchestrator.js
│       └── src/
│           ├── cli.ts
│           ├── cli.test.ts
│           ├── commands/
│           │   ├── list.ts
│           │   └── list.test.ts
│           ├── lib/
│           │   ├── types.ts
│           │   ├── types.test.ts
│           │   ├── discovery.ts
│           │   ├── discovery.test.ts
│           │   └── __fixtures__/
│           │       ├── devPodList.json
│           │       ├── devPodListEmpty.json
│           │       └── devPodListError.json
│           ├── components/
│           ├── hooks/
│           └── types/
```

### Critical Constraints

1. **ZERO BEHAVIORAL CHANGES** - The `bmad-orchestrator list` command must work identically before and after migration. This is a pure restructure.

2. **ALL TESTS MUST PASS** - Run `pnpm --filter @zookanalytics/bmad-orchestrator test` and ensure zero regressions.

3. **USE SHARED PACKAGE** - Update imports to use `@zookanalytics/shared` for error formatting. Do not create duplicate utilities.

4. **PRESERVE ALL FIXTURES** - The `__fixtures__/` directory with test data must be correctly moved and all fixture imports updated.

### Configuration Specifications

**packages/orchestrator/package.json:**
```json
{
  "name": "@zookanalytics/bmad-orchestrator",
  "version": "0.1.0",
  "description": "Unified command center for multi-DevPod development",
  "type": "module",
  "bin": {
    "bmad-orchestrator": "./bin/bmad-orchestrator.js"
  },
  "main": "dist/cli.js",
  "types": "dist/cli.d.ts",
  "exports": {
    ".": {
      "types": "./dist/cli.d.ts",
      "import": "./dist/cli.js"
    }
  },
  "engines": {
    "node": ">=20"
  },
  "files": [
    "dist",
    "bin"
  ],
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "check": "pnpm type-check && pnpm lint && pnpm test:run"
  },
  "dependencies": {
    "@zookanalytics/shared": "workspace:*",
    "@inkjs/ui": "^2.0.0",
    "clipboardy": "^5.0.2",
    "commander": "^14.0.2",
    "execa": "^9.6.1",
    "ink": "^6.6.0",
    "react": "^19.2.3",
    "timeago.js": "^4.0.2",
    "yaml": "^2.8.2"
  },
  "devDependencies": {
    "@types/node": "^25.0.8",
    "@types/react": "^19.2.8",
    "ink-testing-library": "^4.0.0",
    "tsx": "^4.21.0"
  }
}
```

**packages/orchestrator/tsconfig.json:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**packages/orchestrator/vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

**packages/orchestrator/bin/bmad-orchestrator.js:**
```javascript
#!/usr/bin/env node
import '../dist/cli.js';
```

### Import Updates Required

**Current import pattern (in discovery.ts):**
```typescript
import { execa } from 'execa';
import type { DevPod, DevPodStatus } from './types.js';
```

**After migration - add shared import:**
```typescript
import { execa } from 'execa';

import { formatError } from '@zookanalytics/shared';

import type { DevPod, DevPodStatus } from './types.js';
```

**Import order (ESLint enforced):**
1. Node built-ins (`node:fs`, `node:path`)
2. External packages (`execa`, `ink`, `react`)
3. Internal shared (`@zookanalytics/shared`)
4. Local imports (`./types.js`, `./lib/discovery.js`)

### Root Package.json Updates

**Remove from root (moves to packages/orchestrator):**
- `bin` field
- `main` field
- `files` field
- CLI-specific dependencies (keep only workspace tooling)

**Keep at root:**
- Workspace scripts (`pnpm -r build`, etc.)
- Shared devDependencies (typescript, eslint, prettier, vitest, husky)
- lint-staged configuration

**Updated root package.json scripts:**
```json
{
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:run": "pnpm -r test:run",
    "lint": "pnpm -r lint",
    "check": "pnpm -r check",
    "type-check": "tsc --noEmit",
    "dev:orchestrator": "pnpm --filter @zookanalytics/bmad-orchestrator dev",
    "dev:agent-env": "pnpm --filter @zookanalytics/agent-env dev"
  }
}
```

### Testing Verification Steps

After migration, run these commands in order:

```bash
# 1. Relink workspace packages
pnpm install

# 2. Build shared first (orchestrator depends on it)
pnpm --filter @zookanalytics/shared build

# 3. Build orchestrator
pnpm --filter @zookanalytics/bmad-orchestrator build

# 4. Run orchestrator tests
pnpm --filter @zookanalytics/bmad-orchestrator test:run

# 5. Test CLI works
pnpm dev:orchestrator list
# or
pnpm --filter @zookanalytics/bmad-orchestrator dev list

# 6. Publish smoke test
cd packages/orchestrator
pnpm pack
# Creates @zookanalytics-bmad-orchestrator-0.1.0.tgz
```

### Shared Package Integration

The orchestrator should use these exports from `@zookanalytics/shared`:

```typescript
// Types
import type { AppError, JsonOutput } from '@zookanalytics/shared';

// Error formatting
import { formatError, createError } from '@zookanalytics/shared';

// Subprocess execution (if needed)
import { createExecutor, execute } from '@zookanalytics/shared';
```

**Note:** The current orchestrator has its own error handling. During this migration, refactor to use the shared `formatError()` pattern where errors are displayed to users.

### Files to Modify/Create

| Action | File | Notes |
|--------|------|-------|
| CREATE | `packages/orchestrator/package.json` | New package config |
| CREATE | `packages/orchestrator/tsconfig.json` | Extends base |
| CREATE | `packages/orchestrator/vitest.config.ts` | Test config |
| MOVE | `src/cli.ts` → `packages/orchestrator/src/cli.ts` | |
| MOVE | `src/cli.test.ts` → `packages/orchestrator/src/cli.test.ts` | |
| MOVE | `src/commands/*` → `packages/orchestrator/src/commands/` | |
| MOVE | `src/lib/*` → `packages/orchestrator/src/lib/` | |
| MOVE | `src/components/` → `packages/orchestrator/src/components/` | |
| MOVE | `src/hooks/` → `packages/orchestrator/src/hooks/` | |
| MOVE | `src/types/` → `packages/orchestrator/src/types/` | |
| MOVE | `bin/bmad-orchestrator.js` → `packages/orchestrator/bin/` | Update path |
| MODIFY | Root `package.json` | Remove bin/main, update scripts |
| DELETE | Root `src/` | After verification |
| DELETE | Root `bin/` | After verification |

### Critical Don't-Miss Rules

1. **ESM imports require .js extension:**
   ```typescript
   // Correct
   import { DevPod } from './types.js';

   // Wrong - will fail at runtime
   import { DevPod } from './types';
   ```

2. **Workspace dependency syntax:**
   ```json
   "dependencies": {
     "@zookanalytics/shared": "workspace:*"
   }
   ```

3. **Bin entry point must use dist:**
   ```javascript
   // packages/orchestrator/bin/bmad-orchestrator.js
   #!/usr/bin/env node
   import '../dist/cli.js';
   ```

4. **Do NOT commit intermediate broken states:**
   - Complete the entire migration in one commit
   - All tests must pass before committing
   - Use `pnpm check` to verify

5. **Preserve git history (optional but recommended):**
   Use `git mv` for file moves to preserve history:
   ```bash
   git mv src/cli.ts packages/orchestrator/src/cli.ts
   ```

### Git Intelligence (Recent Context)

Recent commits show this is part of the agent-env monorepo setup:
- `8ed7154` - docs: add agent-env planning artifacts
- `61354a7` - docs: add agent-env PRD
- `678c73c` - docs: add agent-env product brief
- `deb9104` - docs(epic-1): complete retrospective (orchestrator Epic 1 done)
- `bae5954` - feat(epic-1): Project Foundation & DevPod Discovery

The orchestrator CLI (Epic 1) is complete and working. This migration preserves all that functionality while restructuring for the monorepo.

### References

- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Package-Architecture]
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Project-Structure-Boundaries]
- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-1.3]
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules]
- [Source: _bmad-output/implementation-artifacts/env-1-1-initialize-pnpm-workspaces-structure.md]
- [Source: _bmad-output/implementation-artifacts/env-1-2-create-shared-utilities-package.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
