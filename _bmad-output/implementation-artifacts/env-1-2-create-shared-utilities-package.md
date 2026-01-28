# Story 1.2: Create Shared Utilities Package

Status: done

## Story

As a **developer**,
I want **common utilities in a shared package**,
So that **both CLIs use consistent error handling and subprocess patterns**.

## Acceptance Criteria

1. **Given** the `packages/shared/` package exists
   **When** I import `formatError` from `@zookanalytics/shared`
   **Then** I can format errors consistently with code, message, and suggestion

2. **Given** an error object with code `WORKSPACE_NOT_FOUND`
   **When** I call `formatError(error)`
   **Then** it returns a human-readable colored string for terminal output

3. **Given** the shared package
   **When** I run `pnpm --filter @zookanalytics/shared test`
   **Then** all shared utility tests pass with >90% coverage

## Tasks / Subtasks

- [x] Task 1: Create shared package structure (AC: #1, #3)
  - [x] 1.1 Create `packages/shared/package.json` with name `@zookanalytics/shared`
  - [x] 1.2 Create `packages/shared/tsconfig.json` extending `tsconfig.base.json`
  - [x] 1.3 Create `packages/shared/vitest.config.ts` for shared-specific test config
  - [x] 1.4 Create `packages/shared/src/index.ts` exporting public API

- [x] Task 2: Implement shared types (AC: #1, #2)
  - [x] 2.1 Create `packages/shared/src/types.ts` with `AppError` interface
  - [x] 2.2 Add `JsonOutput<T>` interface for standardized CLI JSON output
  - [x] 2.3 Export types from index.ts

- [x] Task 3: Implement error formatting (AC: #1, #2)
  - [x] 3.1 Create `packages/shared/src/errors.ts` with `formatError()` function
  - [x] 3.2 Implement colored terminal output using chalk or ANSI codes
  - [x] 3.3 Include error code, message, and optional suggestion in formatted output
  - [x] 3.4 Create `packages/shared/src/errors.test.ts` with comprehensive tests

- [x] Task 4: Implement subprocess utilities (AC: #1, #3)
  - [x] 4.1 Create `packages/shared/src/subprocess.ts` with execa wrapper
  - [x] 4.2 Implement `reject: false` pattern as default
  - [x] 4.3 Create factory function `createExecutor()` for dependency injection in tests
  - [x] 4.4 Create `packages/shared/src/subprocess.test.ts` with tests

- [x] Task 5: Verify package integration (AC: #1, #3)
  - [x] 5.1 Run `pnpm install` at root to link workspace packages
  - [x] 5.2 Run `pnpm --filter @zookanalytics/shared test` and verify all tests pass
  - [x] 5.3 Run `pnpm --filter @zookanalytics/shared build` to verify TypeScript compilation
  - [x] 5.4 Verify coverage is >90% for all shared modules

## Dev Notes

### Previous Story Context (1.1)

Story 1.1 created the workspace infrastructure:
- `pnpm-workspace.yaml` with `packages: ['packages/*']`
- Root `package.json` configured as workspace root (`private: true`)
- `tsconfig.base.json` with shared TypeScript configuration
- Empty `packages/` directory with placeholders

**CRITICAL:** Story 1.1 must be completed before starting this story. Verify `pnpm-workspace.yaml` exists and `packages/` directory is created.

### Architecture Requirements

From Architecture Decision Document:

**Shared Package Purpose:**
- Cross-CLI utilities for error handling and subprocess execution
- Internal package (not published to npm)
- Both `@zookanalytics/bmad-orchestrator` and `@zookanalytics/agent-env` depend on this

**Error Code Standards:**
- `SAFETY_CHECK_FAILED` - Git state blocks operation
- `WORKSPACE_NOT_FOUND` - Instance doesn't exist
- `CONTAINER_ERROR` - Docker/devcontainer failure
- `GIT_ERROR` - Git command failed
- `ORBSTACK_REQUIRED` - OrbStack not running/installed

### Technical Implementation Details

#### Package.json Specification

```json
{
  "name": "@zookanalytics/shared",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "type-check": "tsc --noEmit",
    "lint": "eslint src/",
    "check": "pnpm type-check && pnpm lint && pnpm test:run"
  },
  "devDependencies": {
    "vitest": "workspace:*"
  },
  "peerDependencies": {
    "execa": "^9.0.0"
  }
}
```

#### Type Definitions

```typescript
// types.ts

/**
 * Standardized error type for all CLI operations
 */
export interface AppError {
  /** Machine-readable error code (e.g., "GIT_ERROR") */
  code: string;
  /** Human-readable error description */
  message: string;
  /** Optional actionable suggestion for the user */
  suggestion?: string;
}

/**
 * Standardized JSON output for --json flag
 */
export interface JsonOutput<T> {
  ok: boolean;
  data: T | null;
  error: AppError | null;
}
```

#### Error Formatting

```typescript
// errors.ts

import type { AppError } from './types.js';

/**
 * Format an AppError for terminal display with colors
 *
 * Output format:
 * ❌ [ERROR_CODE] Error message
 *    💡 Suggestion text (if provided)
 */
export function formatError(error: AppError): string {
  const lines: string[] = [];

  // Red color for error prefix
  lines.push(`\x1b[31m❌ [${error.code}]\x1b[0m ${error.message}`);

  if (error.suggestion) {
    // Cyan color for suggestion
    lines.push(`   \x1b[36m💡 ${error.suggestion}\x1b[0m`);
  }

  return lines.join('\n');
}

/**
 * Create an AppError with required fields
 */
export function createError(
  code: string,
  message: string,
  suggestion?: string
): AppError {
  return { code, message, ...(suggestion && { suggestion }) };
}
```

#### Subprocess Execution

```typescript
// subprocess.ts

import { execa, type ExecaReturnValue, type Options } from 'execa';

export type Executor = typeof execa;

export interface ExecuteResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Create a subprocess executor with the reject: false pattern
 *
 * @param executor - The execa function (injectable for testing)
 * @returns Wrapped executor that never throws
 */
export function createExecutor(executor: Executor = execa) {
  return async function execute(
    command: string,
    args: string[] = [],
    options: Options = {}
  ): Promise<ExecuteResult> {
    const result = await executor(command, args, {
      reject: false,
      ...options,
    });

    return {
      ok: !result.failed,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.exitCode ?? -1,
    };
  };
}

/**
 * Default executor using execa
 */
export const execute = createExecutor();
```

### Testing Requirements

**Coverage Target:** >90% for all shared modules (CRITICAL - shared code affects all CLIs)

**Test Cases for errors.ts:**
- formatError returns colored output with error code and message
- formatError includes suggestion when provided
- formatError handles missing suggestion gracefully
- createError creates AppError with all fields
- createError omits undefined suggestion

**Test Cases for subprocess.ts:**
- createExecutor returns function that never throws
- execute returns ok: true for successful commands
- execute returns ok: false for failed commands
- execute captures stdout, stderr, exitCode
- createExecutor accepts custom executor (DI pattern)

**Test Cases for types.ts:**
- AppError interface has required fields (type checking)
- JsonOutput generic type works with various data types

### Project Structure Notes

**Target structure after this story:**

```
packages/
└── shared/
    ├── package.json              # @zookanalytics/shared
    ├── tsconfig.json             # Extends ../../tsconfig.base.json
    ├── vitest.config.ts
    └── src/
        ├── index.ts              # Re-exports public API
        ├── types.ts              # AppError, JsonOutput<T>
        ├── types.test.ts         # Type tests (compile-time checks)
        ├── errors.ts             # formatError(), createError()
        ├── errors.test.ts
        ├── subprocess.ts         # createExecutor(), execute()
        └── subprocess.test.ts
```

### Dependencies

**Story 1.1 must be complete** - provides:
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `packages/` directory

**No external dependencies** beyond what's already installed at root:
- TypeScript, Vitest at root
- execa already installed (use workspace:* or peerDependency)

### ANSI Color Codes Reference

For terminal color output (no chalk dependency needed):
- Red: `\x1b[31m` (errors)
- Green: `\x1b[32m` (success)
- Yellow: `\x1b[33m` (warnings)
- Cyan: `\x1b[36m` (suggestions/info)
- Reset: `\x1b[0m`

### Critical Don't-Miss Rules

1. **ESM imports require .js extension:**
   ```typescript
   // ✅ Correct
   import { AppError } from './types.js';

   // ❌ Wrong - will fail at runtime
   import { AppError } from './types';
   ```

2. **reject: false is mandatory for subprocess:**
   ```typescript
   // ✅ Correct - never throws
   const result = await execa('git', ['status'], { reject: false });

   // ❌ Wrong - throws on non-zero exit
   const result = await execa('git', ['status']);
   ```

3. **Type-only exports:**
   ```typescript
   // In index.ts
   export type { AppError, JsonOutput } from './types.js';
   export { formatError, createError } from './errors.js';
   ```

4. **Co-located tests:**
   - `errors.ts` → `errors.test.ts` (same directory)
   - NOT in a separate `__tests__` folder

### References

- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Error-Handling]
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Testing-Strategy]
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Package-Architecture]
- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-1.2]
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed TypeScript build error in subprocess.ts: execa returns complex types for stdout/stderr, needed `String()` coercion
- Fixed ESLint import order errors: type imports must come before value imports per perfectionist/sort-imports rule
- Removed invalid `workspace:*` protocol for vitest (external package, hoisted from root)

### Completion Notes List

- Created complete shared package structure with package.json, tsconfig.json, vitest.config.ts
- Implemented AppError and JsonOutput<T> interfaces for standardized error handling
- Implemented formatError() with ANSI color codes for terminal output (red errors, cyan suggestions)
- Implemented createError() helper function with proper undefined suggestion handling
- Implemented createExecutor() factory with dependency injection pattern for testability
- Implemented execute() default executor with reject: false pattern
- All 25 tests passing with 100% coverage on errors.ts and subprocess.ts
- Full test suite (76 tests) passes with no regressions
- TypeScript compilation successful
- ESLint passes

### File List

- packages/shared/package.json (modified - full spec with scripts, exports, dependencies)
- packages/shared/tsconfig.json (created)
- packages/shared/vitest.config.ts (created, modified by code review)
- packages/shared/src/index.ts (created)
- packages/shared/src/types.ts (created)
- packages/shared/src/types.test.ts (created)
- packages/shared/src/errors.ts (created)
- packages/shared/src/errors.test.ts (created, modified by code review)
- packages/shared/src/subprocess.ts (created)
- packages/shared/src/subprocess.test.ts (created)
- packages/shared/.gitkeep (deleted)
- pnpm-lock.yaml (modified - workspace dependency resolution)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (claude-opus-4-5-20251101)
**Date:** 2026-01-28
**Outcome:** APPROVED (with fixes applied)

### Review Summary

| Severity | Found | Fixed |
|----------|-------|-------|
| HIGH     | 1     | 1     |
| MEDIUM   | 4     | 4     |
| LOW      | 2     | 2     |

### Issues Found & Fixed

1. **[HIGH] execa was direct dependency in lockfile but peerDependency in package.json**
   - Changed to explicit `dependencies` with `devDependencies` for vitest
   - Makes package self-contained and lockfile consistent

2. **[MEDIUM] Missing devDependencies section**
   - Added vitest and @vitest/coverage-v8 to devDependencies
   - Documents development-time dependencies explicitly

3. **[MEDIUM] pnpm-lock.yaml not in File List**
   - Added to File List

4. **[MEDIUM] Sprint status sync (pending)**
   - Status updated to "done" as part of this review

5. **[LOW] types.ts showing 0% coverage (type-only file)**
   - Added to vitest coverage exclude list

6. **[LOW] Misleading test comment about empty string suggestion**
   - Fixed comment to accurately describe falsy behavior

### Verification

- All 25 tests passing
- 100% coverage on errors.ts and subprocess.ts
- TypeScript build succeeds
- ESLint passes
- All Acceptance Criteria verified:
  - AC #1: ✅ formatError importable from @zookanalytics/shared
  - AC #2: ✅ WORKSPACE_NOT_FOUND formats with colors
  - AC #3: ✅ Tests pass with >90% coverage (100% on code files)

## Change Log

- 2026-01-28: Code review complete - Fixed dependency management, coverage config, test comment (Claude Opus 4.5)
- 2026-01-28: Story completed - Created @zookanalytics/shared package with error handling and subprocess utilities
