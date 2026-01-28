# Story 1.1: Initialize pnpm Workspaces Structure

Status: done

## Story

As a **developer**,
I want **the repository configured as a pnpm workspaces monorepo**,
So that **I can manage multiple packages with shared dependencies efficiently**.

## Acceptance Criteria

1. **Given** the existing flat repository structure
   **When** I run `pnpm install` at the root
   **Then** pnpm recognizes the workspace configuration
   **And** the `packages/` directory exists

2. **Given** a fresh clone of the repository
   **When** I run `pnpm install`
   **Then** all workspace packages are linked correctly
   **And** no errors occur during installation

## Tasks / Subtasks

- [x] Task 1: Create pnpm-workspace.yaml (AC: #1, #2)
  - [x] 1.1 Create `pnpm-workspace.yaml` with `packages: ['packages/*']`
  - [x] 1.2 Verify pnpm version >= 8.0 requirement in package.json engines

- [x] Task 2: Create root workspace configuration (AC: #1, #2)
  - [x] 2.1 Update root `package.json` to be workspace root (`private: true`, remove current bin/main entries)
  - [x] 2.2 Add workspace-level scripts (`pnpm -r build`, `pnpm -r test`, etc.)
  - [x] 2.3 Keep shared devDependencies at root (typescript, eslint, prettier, vitest)

- [x] Task 3: Create shared TypeScript configuration (AC: #2)
  - [x] 3.1 Rename current `tsconfig.json` to `tsconfig.base.json`
  - [x] 3.2 Configure base settings for all packages to extend

- [x] Task 4: Create packages directory structure (AC: #1)
  - [x] 4.1 Create `packages/` directory
  - [x] 4.2 Create placeholder directories: `packages/orchestrator/`, `packages/agent-env/`, `packages/shared/`
  - [x] 4.3 Add `.gitkeep` files to preserve empty directories if needed

- [x] Task 5: Verify workspace configuration (AC: #1, #2)
  - [x] 5.1 Run `pnpm install` and verify no errors
  - [x] 5.2 Verify `pnpm -r list` recognizes workspace packages (will be empty initially, but command should work)

## Dev Notes

### Current State

The repository is currently a flat TypeScript package:
- Package name: `@zookanalytics/bmad-orchestrator`
- Single `src/` directory with orchestrator code
- All dependencies and scripts at root level
- Working CI, ESLint, Prettier, Vitest configuration

### Target State

pnpm workspaces monorepo structure ready for:
- `packages/orchestrator/` - existing orchestrator code (migration in Story 1.3)
- `packages/agent-env/` - new CLI (scaffold in Story 1.4)
- `packages/shared/` - shared utilities (created in Story 1.2)

### Critical Constraints

1. **DO NOT move existing code** - This story only creates workspace infrastructure. Code migration happens in Story 1.3.

2. **Keep existing functionality working** - After this story, `pnpm dev` should still work for orchestrator development (via `tsx src/cli.ts`).

3. **Preserve all existing configuration** - ESLint, Prettier, Vitest configs stay at root and will be shared by all packages.

### File Changes Summary

| Action | File | Notes |
|--------|------|-------|
| CREATE | `pnpm-workspace.yaml` | Workspace definition |
| MODIFY | `package.json` | Add `private: true`, workspace scripts, update engines |
| RENAME | `tsconfig.json` → `tsconfig.base.json` | Base TypeScript config |
| CREATE | `packages/` | Directory structure |
| CREATE | `packages/orchestrator/.gitkeep` | Placeholder |
| CREATE | `packages/agent-env/.gitkeep` | Placeholder |
| CREATE | `packages/shared/.gitkeep` | Placeholder |

### Project Structure Notes

**Target directory structure after this story:**

```
bmad-orchestrator/                    # Workspace root
├── package.json                      # private: true, workspace scripts
├── pnpm-workspace.yaml               # packages: ['packages/*']
├── pnpm-lock.yaml
├── tsconfig.base.json                # Shared TS config (renamed)
├── vitest.config.ts                  # Stays at root (shared)
├── eslint.config.js                  # Stays at root (shared)
├── .prettierrc                       # Stays at root
├── .github/workflows/ci.yml          # No changes needed yet
│
├── src/                              # UNCHANGED - existing orchestrator code
│   ├── cli.ts
│   ├── commands/
│   ├── lib/
│   └── ...
│
├── bin/                              # UNCHANGED
│   └── bmad-orchestrator.js
│
└── packages/                         # NEW - empty structure
    ├── orchestrator/.gitkeep         # Placeholder for Story 1.3
    ├── agent-env/.gitkeep            # Placeholder for Story 1.4
    └── shared/.gitkeep               # Placeholder for Story 1.2
```

### Configuration Specifications

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
```

**Root package.json changes:**
```json
{
  "name": "bmad-orchestrator-monorepo",
  "private": true,
  "packageManager": "pnpm@10.26.2",
  "engines": {
    "node": ">=20",
    "pnpm": ">=8"
  },
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:run": "pnpm -r test:run",
    "lint": "pnpm -r lint",
    "check": "pnpm -r check",
    "type-check": "tsc --noEmit"
  }
}
```

**tsconfig.base.json (renamed from tsconfig.json):**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### References

- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Package-Architecture]
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Project-Structure-Boundaries]
- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-1.1]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

- Created `pnpm-workspace.yaml` with `packages: ['packages/*']` to define workspace structure
- Updated `package.json`: name changed to `bmad-orchestrator-monorepo`, added `private: true`, removed `bin` and `main` entries (monorepo root is not publishable), added engines requirement for pnpm >= 8, added workspace-level scripts with `:all` suffix pattern (e.g., `build:all`, `test:all`, `lint:all`, `check:all`)
- Created `tsconfig.base.json` with shared compiler options for all packages to extend (jsx, declaration, declarationMap retained for packages that need them)
- Created new `tsconfig.json` that extends base config for current root-level orchestrator code, adding project-specific settings (outDir, rootDir, include, exclude)
- Created `packages/` directory with placeholder subdirectories: `orchestrator/`, `agent-env/`, `shared/`
- Added `.gitkeep` files to preserve empty directories
- Created minimal `packages/shared/package.json` stub for pnpm workspace recognition
- Verified: `pnpm install` succeeds, `pnpm -r list` recognizes workspace
- Verified: All existing functionality preserved - type-check, lint, and all 51 tests pass

### File List

| Action | File |
|--------|------|
| CREATE | `pnpm-workspace.yaml` |
| MODIFY | `package.json` |
| CREATE | `tsconfig.base.json` |
| MODIFY | `tsconfig.json` (now extends base) |
| CREATE | `packages/orchestrator/.gitkeep` |
| CREATE | `packages/orchestrator/package.json` |
| CREATE | `packages/agent-env/.gitkeep` |
| CREATE | `packages/agent-env/package.json` |
| CREATE | `packages/shared/.gitkeep` |
| CREATE | `packages/shared/package.json` |
| MODIFY | `vitest.config.ts` |
| MODIFY | `eslint.config.js` |
| MODIFY | `pnpm-lock.yaml` |

## Senior Developer Review (AI)

### Review Outcome: ✅ APPROVED (with fixes applied)

**Reviewer:** Code Review Agent (Claude Opus 4.5)
**Date:** 2026-01-27

### Issues Found & Resolved

| Severity | Issue | Resolution |
|----------|-------|------------|
| HIGH | package.json still had `bin` and `main` entries (should be removed per Task 2.1) | ✅ FIXED: Removed bin, main, and files entries |
| HIGH | Story completion notes inaccurately claimed jsx/declaration/declarationMap were removed from tsconfig.base.json | ✅ FIXED: Corrected completion notes to reflect actual implementation |
| MEDIUM | pnpm-lock.yaml not listed in File List | ✅ FIXED: Added to File List |
| MEDIUM | packages/shared/package.json not listed in File List | ✅ FIXED: Added to File List |
| MEDIUM | files array present in root package.json | ✅ FIXED: Removed with bin/main |
| LOW | Workspace scripts use `:all` suffix pattern vs spec's direct `pnpm -r` approach | Acceptable deviation - documented in completion notes |

### Verification Results

```
✓ pnpm install - succeeds
✓ pnpm type-check - passes
✓ pnpm lint - passes
✓ pnpm test:run - 51 tests pass
✓ pnpm -r list - recognizes workspace (2 projects)
```

### Acceptance Criteria Verification

- [x] AC#1: pnpm recognizes workspace config, packages/ exists ✅
- [x] AC#2: Fresh clone → pnpm install works, packages linked, no errors ✅

### Notes

The implementation successfully establishes pnpm workspaces infrastructure. Minor deviations from spec (`:all` script suffix pattern, retaining jsx/declaration options in base config) are reasonable choices that improve flexibility for future packages.

---

### Review #2 Outcome: ✅ APPROVED (with fixes applied)

**Reviewer:** Code Review Agent (Claude Opus 4.5)
**Date:** 2026-01-27

#### Issues Found & Resolved

| Severity | Issue | Resolution |
|----------|-------|------------|
| MEDIUM | `packages/shared/package.json` missing `type: "module"` and scripts - workspace commands like `pnpm -r test:run` would skip the shared package silently | ✅ FIXED: Added `type: "module"` and placeholder script stubs |
| MEDIUM | Workspace script naming inconsistency with Architecture spec (`:all` suffix vs direct names) | Acceptable deviation - already documented |
| LOW | tsconfig.base.json includes `jsx: "react-jsx"` for all packages | Acceptable deviation - packages that don't need JSX can override |
| LOW | Missing TypeScript project references | Deferred to Story 1.2/1.3 |

#### Verification Results (Post-Fix)

```
✓ pnpm install - succeeds
✓ pnpm type-check - passes
✓ pnpm lint - passes
✓ pnpm test:run - 51 tests pass
✓ pnpm -r test:run - now traverses to shared package correctly
```

#### Acceptance Criteria Verification

- [x] AC#1: pnpm recognizes workspace config, packages/ exists ✅
- [x] AC#2: Fresh clone → pnpm install works, packages linked, no errors ✅

---

### Review #3 Outcome: ✅ APPROVED (with fixes applied)

**Reviewer:** Code Review Agent (Claude Opus 4.5)
**Date:** 2026-01-27

#### Issues Found & Resolved

| Severity | Issue | Resolution |
|----------|-------|------------|
| MEDIUM | `packages/orchestrator/` and `packages/agent-env/` lack `package.json` stubs - pnpm doesn't recognize them as workspace packages | ✅ FIXED: Created package.json files with `type: "module"` and placeholder scripts |
| MEDIUM | `vitest.config.ts` only includes `src/**/*.test.ts`, missing `packages/**/src/**/*.test.ts` pattern | ✅ FIXED: Added packages test file patterns |
| MEDIUM | `eslint.config.js` ignores only `dist/**`, not `packages/**/dist/**` | ✅ FIXED: Added packages dist ignore pattern |
| LOW | tsconfig.base.json has more options than spec (declaration, declarationMap, resolveJsonModule) | Acceptable deviation - more complete than spec |
| LOW | Missing vitest.workspace.ts per Architecture spec | Acceptable - single config works for MVP |

#### Verification Results (Post-Fix)

```
✓ pnpm install - succeeds (recognizes all 4 workspace packages)
✓ pnpm ls -r --depth -1 - shows root + shared + orchestrator + agent-env (4 projects)
✓ pnpm type-check - passes
✓ pnpm lint - passes
✓ pnpm test:run - 51 tests pass
```

#### Acceptance Criteria Verification

- [x] AC#1: pnpm recognizes workspace config, packages/ exists ✅
- [x] AC#2: Fresh clone → pnpm install works, all 4 packages linked, no errors ✅

#### File List Update

| Action | File |
|--------|------|
| CREATE | `packages/orchestrator/package.json` |
| CREATE | `packages/agent-env/package.json` |
| MODIFY | `vitest.config.ts` |
| MODIFY | `eslint.config.js` |

## Change Log

| Date | Change |
|------|--------|
| 2026-01-27 | Initial implementation - pnpm workspaces structure created with placeholder directories |
| 2026-01-27 | Code review #1 - Fixed: removed bin/main/files from package.json, corrected completion notes, updated File List |
| 2026-01-27 | Code review #2 - Fixed: packages/shared/package.json now includes `type: "module"` and script stubs for workspace commands to traverse correctly |
| 2026-01-27 | Code review #3 - Fixed: Added package.json stubs for orchestrator and agent-env packages, updated vitest/eslint configs for workspace patterns |
| 2026-01-28 | Code review #4 - Verified: All ACs implemented, all tasks completed as claimed. No blocking issues. 3 MEDIUM (acceptable deviations), 4 LOW issues documented. Story approved. |
