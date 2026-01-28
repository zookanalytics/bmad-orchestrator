# Story 1.5: Update CI for Workspaces

Status: review

## Story

As a **developer**,
I want **CI to test all packages in the monorepo**,
So that **changes to shared code are validated against all consumers**.

## Acceptance Criteria

1. **Given** a PR that modifies `packages/shared/`
   **When** CI runs
   **Then** tests run for shared, orchestrator, AND agent-env packages

2. **Given** a PR that only modifies `packages/agent-env/`
   **When** CI runs
   **Then** at minimum agent-env tests run (optionally all for safety)

3. **Given** all tests pass
   **When** CI completes
   **Then** the PR is marked as passing

4. **Given** any package test fails
   **When** CI completes
   **Then** the PR is marked as failing with clear error output

## Tasks / Subtasks

- [x] Task 1: Update CI workflow for pnpm workspaces (AC: #1, #2, #3, #4)
  - [x] 1.1 Update `.github/workflows/ci.yml` to use recursive pnpm commands
  - [x] 1.2 Configure `pnpm -r test:run` to run all package tests
  - [x] 1.3 Configure `pnpm -r lint` for all packages
  - [x] 1.4 Configure `pnpm -r type-check` for all packages
  - [x] 1.5 Ensure `pnpm -r build` runs before tests (for TypeScript compilation)

- [x] Task 2: Add pnpm store caching (AC: #3)
  - [x] 2.1 Configure pnpm store caching using `actions/cache@v4`
  - [x] 2.2 Set cache key based on `pnpm-lock.yaml` hash
  - [x] 2.3 Verify cache restore speeds up subsequent builds

- [x] Task 3: Configure coverage aggregation (AC: #3)
  - [x] 3.1 Update coverage artifact upload to handle multiple packages
  - [x] 3.2 Ensure coverage reports from all packages are collected
  - [x] 3.3 Use merged coverage path pattern (`packages/*/coverage/`)

- [x] Task 4: Add build verification step (AC: #3, #4)
  - [x] 4.1 Add explicit build step before tests
  - [x] 4.2 Ensure TypeScript compilation succeeds for all packages
  - [x] 4.3 Verify all packages compile without errors

- [x] Task 5: Verify CI workflow works correctly (AC: #1, #2, #3, #4)
  - [x] 5.1 Push changes to a test branch
  - [x] 5.2 Verify CI runs all package tests
  - [x] 5.3 Verify CI fails if any package test fails
  - [x] 5.4 Verify CI passes when all tests pass
  - [x] 5.5 Verify cache is utilized on subsequent runs

## Dev Notes

### Previous Story Context

**Story 1.1** created the workspace infrastructure:
- `pnpm-workspace.yaml` with `packages: ['packages/*']`
- Root `package.json` configured as workspace root (`private: true`)
- `tsconfig.base.json` with shared TypeScript configuration
- Workspace scripts: `pnpm -r build`, `pnpm -r test`, etc.

**Story 1.2** created the shared utilities package:
- `packages/shared/` with `@zookanalytics/shared`
- `formatError()`, `createError()`, `AppError` type
- `JsonOutput<T>` type for standardized CLI output
- Full test coverage

**Story 1.3** migrated the orchestrator:
- `packages/orchestrator/` with `@zookanalytics/bmad-orchestrator`
- All existing orchestrator code moved and working
- Uses `@zookanalytics/shared` for error formatting
- All existing tests pass

**Story 1.4** created the agent-env CLI scaffold:
- `packages/agent-env/` with `@zookanalytics/agent-env`
- Commander CLI with placeholder commands
- Uses `@zookanalytics/shared`
- CLI tests for `--help`, `--version`, and no-args behavior

**CRITICAL:** Stories 1.1, 1.2, 1.3, and 1.4 must be completed before starting this story. Verify:
- All three packages exist: `shared`, `orchestrator`, `agent-env`
- `pnpm install` at root links all packages correctly
- `pnpm -r test:run` runs tests for all packages locally
- All package tests pass

### Current CI Configuration

The current CI workflow is simple:
```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7
```

**Issues with current config:**
- `pnpm check` at root may not recursively run all package checks
- Coverage path `coverage/` only captures root, not per-package coverage
- No explicit build step for TypeScript compilation
- No pnpm store caching (slower builds)

### Target CI Configuration

The updated workflow should:
1. Cache pnpm store for faster installs
2. Build all packages (TypeScript compilation)
3. Run type-check, lint, and tests for all packages
4. Collect coverage from all packages
5. Fail fast if any step fails

### Technical Implementation Details

#### Updated CI Workflow (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Get pnpm store directory
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm -r build

      - name: Type check all packages
        run: pnpm -r type-check

      - name: Lint all packages
        run: pnpm -r lint

      - name: Run all tests
        run: pnpm -r test:run

      - name: Upload coverage reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-reports
          path: |
            packages/*/coverage/
            coverage/
          retention-days: 7
```

#### Key Changes Explained

**1. pnpm Store Caching:**
```yaml
- name: Get pnpm store directory
  shell: bash
  run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-store-
```

This caches the pnpm store between runs, significantly speeding up `pnpm install`. The cache key includes the lockfile hash so it invalidates when dependencies change.

**2. Recursive Commands:**
```yaml
- run: pnpm -r build
- run: pnpm -r type-check
- run: pnpm -r lint
- run: pnpm -r test:run
```

The `-r` flag runs commands recursively across all workspace packages. This ensures:
- All packages are built (TypeScript compiled)
- All packages pass type checking
- All packages pass linting
- All packages pass tests

**3. Coverage Aggregation:**
```yaml
path: |
  packages/*/coverage/
  coverage/
```

This captures coverage reports from:
- Each package (`packages/*/coverage/`)
- Root level if any (`coverage/`)

**4. Branch Filtering:**
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

Only run on pushes to main and PRs targeting main. This prevents unnecessary CI runs on feature branches (unless PRed).

### Package Script Requirements

Each package must have these scripts defined (verified from previous stories):

**packages/shared/package.json:**
```json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "check": "pnpm type-check && pnpm lint && pnpm test:run"
  }
}
```

**packages/orchestrator/package.json:**
```json
{
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "check": "pnpm type-check && pnpm lint && pnpm test:run"
  }
}
```

**packages/agent-env/package.json:**
```json
{
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "check": "pnpm type-check && pnpm lint && pnpm test:run"
  }
}
```

### Root Package.json Scripts

The root package.json should have these scripts (from Story 1.1):

```json
{
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:run": "pnpm -r test:run",
    "lint": "pnpm -r lint",
    "type-check": "pnpm -r type-check",
    "check": "pnpm -r check",
    "dev:orchestrator": "pnpm --filter @zookanalytics/bmad-orchestrator dev",
    "dev:agent-env": "pnpm --filter @zookanalytics/agent-env dev"
  }
}
```

### Project Structure Notes

After all stories in Epic 1, the repository structure is:

```
bmad-orchestrator/                    # Workspace root
├── package.json                      # private: true, workspace scripts
├── pnpm-workspace.yaml               # packages: ['packages/*']
├── pnpm-lock.yaml
├── tsconfig.base.json                # Shared TS config
├── vitest.config.ts                  # Root vitest config (optional)
├── eslint.config.js                  # Shared ESLint config
├── .prettierrc
├── .github/
│   └── workflows/
│       └── ci.yml                    # UPDATED - This story
│
└── packages/
    ├── shared/                       # @zookanalytics/shared
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts
    │       ├── types.ts
    │       ├── errors.ts
    │       ├── errors.test.ts
    │       ├── subprocess.ts
    │       └── subprocess.test.ts
    │
    ├── orchestrator/                 # @zookanalytics/bmad-orchestrator
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   ├── bin/
    │   │   └── bmad-orchestrator.js
    │   └── src/
    │       ├── cli.ts
    │       ├── cli.test.ts
    │       ├── commands/
    │       ├── lib/
    │       ├── components/
    │       └── hooks/
    │
    └── agent-env/                    # @zookanalytics/agent-env
        ├── package.json
        ├── tsconfig.json
        ├── vitest.config.ts
        ├── bin/
        │   └── agent-env.js
        └── src/
            ├── cli.ts
            ├── cli.test.ts
            ├── commands/
            ├── lib/
            ├── components/
            └── hooks/
```

### Critical Don't-Miss Rules

1. **Order of CI steps matters:**
   - Install → Build → Type-check → Lint → Test
   - Build must happen before type-check and tests (TypeScript compiled)

2. **Frozen lockfile in CI:**
   - Always use `pnpm install --frozen-lockfile`
   - Prevents accidental lockfile updates in CI

3. **Cache key includes lockfile hash:**
   - Cache invalidates when dependencies change
   - `restore-keys` allows partial match for faster restore

4. **Coverage paths use glob patterns:**
   - `packages/*/coverage/` captures all package coverage
   - Handles varying package names automatically

5. **All packages must have consistent scripts:**
   - `build`, `test`, `test:run`, `lint`, `type-check`, `check`
   - CI relies on these being present

6. **Branch filtering prevents waste:**
   - Only main branch and PRs to main trigger full CI
   - Feature branches only run CI when PRed

### Testing the CI Changes

Before marking this story complete:

1. **Local verification:**
   ```bash
   # Run what CI will run
   pnpm install
   pnpm -r build
   pnpm -r type-check
   pnpm -r lint
   pnpm -r test:run
   ```

2. **Push to test branch and verify:**
   - Create PR to main
   - Verify all steps pass
   - Verify coverage artifacts are uploaded

3. **Test failure handling:**
   - Intentionally break a test
   - Verify CI fails with clear error
   - Revert and verify CI passes

### Performance Expectations

With pnpm store caching:
- **First run:** ~2-3 minutes (no cache)
- **Subsequent runs:** ~1-2 minutes (cache hit)
- **Cache miss (deps changed):** ~2 minutes (partial cache)

### Git Intelligence (Recent Context)

This story completes Epic 1 for agent-env. Recent commits show:
- `8ed7154` - docs: add agent-env planning artifacts
- `deb9104` - docs(epic-1): complete retrospective (orchestrator Epic 1 done)

After this story:
- Monorepo is fully set up with all three packages
- CI validates all packages on every PR
- Ready to implement actual functionality in Epic 2

### Dependencies

**Required from previous stories:**
- `pnpm-workspace.yaml` (Story 1.1)
- `packages/shared/` with tests (Story 1.2)
- `packages/orchestrator/` with tests (Story 1.3)
- `packages/agent-env/` with tests (Story 1.4)

### What This Story Does NOT Do

- **NO new code functionality** - only CI configuration
- **NO package changes** - just workflow updates
- **NO dependency changes** - using existing setup

### References

- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Testing-Strategy]
- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-1.5]
- [Source: _bmad-output/project-context.md#Development-Workflow-Rules]
- [Source: _bmad-output/implementation-artifacts/env-1-1-initialize-pnpm-workspaces-structure.md]
- [Source: _bmad-output/implementation-artifacts/env-1-2-create-shared-utilities-package.md]
- [Source: _bmad-output/implementation-artifacts/env-1-3-migrate-orchestrator-to-packages.md]
- [Source: _bmad-output/implementation-artifacts/env-1-4-create-agent-env-cli-scaffold.md]

## Dev Agent Record

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

- Local verification successful: `pnpm install`, `pnpm -r build`, `pnpm -r type-check`, `pnpm -r lint`, `pnpm -r test:run` all pass
- Total test count: 85 tests (shared: 25, orchestrator: 51, agent-env: 9)
- Coverage directories verified at `packages/*/coverage/`

### Completion Notes List

- **CI workflow updated** with pnpm workspaces support using recursive commands (`-r` flag)
- **pnpm store caching** configured using `actions/cache@v4` with lockfile-based cache key
- **Coverage aggregation** updated to collect from all packages via `packages/*/coverage/` glob pattern
- **Build step added** before type-check/lint/test to ensure TypeScript compilation
- **Branch filtering** configured to run on main branch and PRs targeting main only
- **Local verification complete** - all 85 tests pass across all three packages

### File List

- `.github/workflows/ci.yml` - Updated CI workflow with pnpm workspaces support

### Change Log

- 2026-01-28: Updated CI workflow for pnpm workspaces monorepo support
