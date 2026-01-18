# Story 1.1: Project Initialization with Quality Gates

Status: review

## Story

As a **developer**,
I want **a properly configured TypeScript project with CI, linting, and testing**,
So that **code quality is enforced from the first commit**.

## Acceptance Criteria

### AC1: Dependencies Install Successfully
**Given** a new project directory
**When** I run `pnpm install`
**Then** all dependencies install without errors
**And** the following tooling is configured:
- TypeScript 5.x with strict mode
- ESLint with @typescript-eslint rules
- Prettier for code formatting
- Vitest for testing
- Pre-commit hooks via husky/lint-staged

### AC2: Quality Check Passes
**Given** the project is initialized
**When** I run `pnpm check`
**Then** type-check, lint, and tests all pass

### AC3: CI Workflow Executes
**Given** a pull request is opened
**When** CI runs on GitHub Actions
**Then** the workflow executes type-check, lint, and test
**And** fails if any check fails

### AC4: Coverage Gate Enforced
**Given** the CI workflow runs tests
**When** code coverage is calculated
**Then** the build fails if coverage drops below 80% global threshold (TD3)
**And** coverage report is generated for review

## Tasks / Subtasks

- [x] Task 1: Initialize pnpm package (AC: #1)
  - [x] 1.1 Run `pnpm init` with package name `@zookanalytics/bmad-orchestrator`
  - [x] 1.2 Set `"type": "module"` for ESM
  - [x] 1.3 Add `"engines": { "node": ">=22" }`
  - [x] 1.4 Set entry point: `bin/bmad-orchestrator.js`

- [x] Task 2: Install dependencies with pnpm (AC: #1)
  - [x] 2.1 Install core deps: `ink@6 react@19 commander@14 @inkjs/ui yaml timeago.js execa@9 clipboardy`
  - [x] 2.2 Install TypeScript deps: `typescript@5 @types/node @types/react tsx`
  - [x] 2.3 Install testing deps: `vitest ink-testing-library`
  - [x] 2.4 Install code quality deps: `eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier eslint-plugin-perfectionist`
  - [x] 2.5 Install git hooks deps: `husky lint-staged`

- [x] Task 3: Configure TypeScript (AC: #1, #2)
  - [x] 3.1 Create tsconfig.json with strict mode, ES2022 target, NodeNext modules
  - [x] 3.2 Configure jsx: "react-jsx" for Ink components
  - [x] 3.3 Set outDir: "dist", rootDir: "src"

- [x] Task 4: Configure ESLint (AC: #1, #2)
  - [x] 4.1 Create eslint.config.js (flat config format)
  - [x] 4.2 Configure @typescript-eslint rules with strict checking
  - [x] 4.3 Configure eslint-plugin-perfectionist for import ordering
  - [x] 4.4 Set max cognitive complexity to 20
  - [x] 4.5 Configure TODO comments as errors

- [x] Task 5: Configure Prettier (AC: #1)
  - [x] 5.1 Create .prettierrc with project conventions
  - [x] 5.2 Create .prettierignore for dist, node_modules

- [x] Task 6: Configure Vitest (AC: #1, #2, #4)
  - [x] 6.1 Create vitest.config.ts with globals and node environment
  - [x] 6.2 Configure test include patterns: `src/**/*.test.ts`, `src/**/*.test.tsx`
  - [x] 6.3 Configure coverage thresholds: 80% global minimum
  - [x] 6.4 Configure coverage reporter: text, lcov

- [x] Task 7: Configure Git Hooks (AC: #1)
  - [x] 7.1 Initialize husky with `pnpm exec husky init`
  - [x] 7.2 Create pre-commit hook to run lint-staged
  - [x] 7.3 Configure lint-staged in package.json for TypeScript/TSX files

- [x] Task 8: Create Project Structure (AC: #1, #2)
  - [x] 8.1 Create src/ directory
  - [x] 8.2 Create src/lib/ directory for business logic
  - [x] 8.3 Create src/lib/__fixtures__/ directory for test fixtures
  - [x] 8.4 Create src/hooks/ directory for React hooks
  - [x] 8.5 Create src/components/ directory for Ink components
  - [x] 8.6 Create src/commands/ directory for CLI subcommands
  - [x] 8.7 Create bin/ directory for CLI bin entry point

- [x] Task 9: Create Minimal Entry Points (AC: #2)
  - [x] 9.1 Create bin/bmad-orchestrator.js with shebang and dist import
  - [x] 9.2 Create src/cli.ts with minimal Commander setup
  - [x] 9.3 Create src/cli.test.ts with one passing test

- [x] Task 10: Create Package Scripts (AC: #2)
  - [x] 10.1 Add "dev": "tsx src/cli.ts"
  - [x] 10.2 Add "build": "tsc"
  - [x] 10.3 Add "test": "vitest"
  - [x] 10.4 Add "test:run": "vitest run"
  - [x] 10.5 Add "lint": "eslint src/"
  - [x] 10.6 Add "format": "prettier --write src/"
  - [x] 10.7 Add "type-check": "tsc --noEmit"
  - [x] 10.8 Add "check": "pnpm type-check && pnpm lint && pnpm test:run"

- [x] Task 11: Create CI Workflow (AC: #3, #4)
  - [x] 11.1 Create .github/workflows/ directory
  - [x] 11.2 Create ci.yml with checkout, setup-node@v4, pnpm install, pnpm check
  - [x] 11.3 Configure coverage report upload as artifact
  - [x] 11.4 Configure workflow to run on push and pull_request

- [x] Task 12: Verify All Quality Gates (AC: #1, #2, #3, #4)
  - [x] 12.1 Run `pnpm install` - verify no errors
  - [x] 12.2 Run `pnpm check` - verify type-check, lint, test all pass
  - [x] 12.3 Commit and verify pre-commit hook runs
  - [x] 12.4 Verify coverage report generates

## Dev Notes

### Architecture Compliance Requirements

**Critical - Follow These Patterns Exactly:**

#### Project Structure (from architecture.md)
```
bmad-orchestrator/
├── .github/
│   └── workflows/
│       └── ci.yml
├── bin/
│   └── bmad-orchestrator.js       # CLI bin entry point
├── src/
│   ├── cli.ts                     # Entry point - Commander setup only
│   ├── cli.test.ts
│   ├── lib/                       # Pure business logic (NO React imports)
│   │   ├── __fixtures__/          # Test fixtures
│   │   └── types.ts               # All shared types (created in Story 1.2)
│   ├── hooks/                     # React hooks
│   ├── components/                # Ink TUI components
│   └── commands/                  # CLI subcommands
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
└── .prettierrc
```

#### TypeScript Configuration (EXACT)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### Vitest Configuration (EXACT)
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
```

#### CI Workflow (EXACT)
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
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
```

### Naming Conventions (MANDATORY)

| Type | Pattern | Example |
|------|---------|---------|
| React Components | PascalCase | `Dashboard.tsx` |
| Hooks | camelCase with `use` prefix | `useOrchestrator.ts` |
| Lib modules | camelCase | `discovery.ts` |
| Test files | Co-located `.test.ts` | `discovery.test.ts` |
| Fixtures | camelCase in `lib/__fixtures__/` | `devPodList.json` |

### Import Patterns (MANDATORY)

- Use `.js` extension for relative imports (ESM requirement)
- Use `import type` syntax for type-only imports
- Do NOT import React explicitly (React 19 handles this automatically)

```typescript
// Correct
import { useState, useCallback } from 'react';
import { formatError } from './errors.js';
import type { DevPod } from './types.js';

// Incorrect
import React from 'react';
import { formatError } from './errors';  // Missing .js
```

### ESLint Configuration (MANDATORY)

Use flat config format (eslint.config.js), NOT .eslintrc:

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import perfectionist from 'eslint-plugin-perfectionist';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    plugins: {
      perfectionist,
    },
    rules: {
      'perfectionist/sort-imports': 'error',
      'no-warning-comments': ['error', { terms: ['todo', 'fixme'] }],
      complexity: ['error', 20],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  }
);
```

### Package.json Required Fields

```json
{
  "name": "@zookanalytics/bmad-orchestrator",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "bmad-orchestrator": "./bin/bmad-orchestrator.js"
  },
  "engines": {
    "node": ">=22"
  },
  "files": ["dist", "bin"]
}
```

### bin Entry Point (EXACT)

```javascript
#!/usr/bin/env node
// bin/bmad-orchestrator.js
import '../dist/cli.js';
```

### Minimal CLI Entry Point for Testing

```typescript
// src/cli.ts
import { Command } from 'commander';

const program = new Command();

program
  .name('bmad-orchestrator')
  .description('Unified command center for multi-DevPod development')
  .version('0.1.0');

program.parse();
```

### Minimal Test for Coverage

```typescript
// src/cli.test.ts
import { describe, it, expect } from 'vitest';

describe('cli', () => {
  it('should be importable', async () => {
    // Verify the module can be imported without errors
    expect(true).toBe(true);
  });
});
```

### Anti-Patterns to AVOID

| Anti-Pattern | Correct Pattern |
|--------------|-----------------|
| `__tests__/` directory | Co-located `.test.ts` files |
| `.eslintrc.json` | `eslint.config.js` (flat config) |
| `import React from 'react'` | `import { useState } from 'react'` |
| `import { Foo } from './foo'` | `import { Foo } from './foo.js'` |
| `src/__fixtures__/` | `src/lib/__fixtures__/` |
| `interface IDevPod` | `interface DevPod` |

### Dependencies - Exact Versions

| Package | Version | Purpose |
|---------|---------|---------|
| ink | 6.6.0 | TUI framework |
| react | 19.x | Component framework (required by Ink 6) |
| commander | 14.0.2 | CLI argument parsing |
| typescript | 5.x | Type safety |
| vitest | 4.0.16 | Testing framework |
| execa | 9.6.1 | Subprocess handling |
| @inkjs/ui | latest | UI components |
| yaml | latest | YAML parsing |
| timeago.js | latest | Timestamp formatting |
| clipboardy | latest | Clipboard access |

### Project Structure Notes

- This is a **standalone project**, not a monorepo
- All source code in `src/`
- Tests co-located with source files
- Fixtures in `src/lib/__fixtures__/`
- Types in `src/lib/types.ts` (created in Story 1.2)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template Evaluation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Core Architectural Decisions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure & Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Project Initialization with Quality Gates]
- [Source: _bmad-output/planning-artifacts/prd.md#Technical Architecture]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debugging required

### Completion Notes List

- Initialized pnpm package with @zookanalytics/bmad-orchestrator name, ESM type, Node >=22 engine requirement
- Installed all dependencies: ink@6, react@19, commander@14, TypeScript 5.x, Vitest 4.x, ESLint 9.x with flat config
- Created tsconfig.json matching architecture spec exactly (strict mode, ES2022, NodeNext, react-jsx)
- Created eslint.config.js with flat config, typescript-eslint strict, perfectionist import sorting
- Created .prettierrc and .prettierignore for code formatting
- Created vitest.config.ts with 80% coverage thresholds on all metrics
- Configured husky with lint-staged pre-commit hook for TS/TSX files
- Created full project directory structure: src/{lib/__fixtures__, hooks, components, commands}, bin/
- Created minimal CLI entry point with Commander setup
- Created bin/bmad-orchestrator.js entry point with shebang
- Created cli.test.ts with passing test
- Added all required package scripts: dev, build, test, test:run, lint, format, type-check, check
- Created CI workflow at .github/workflows/ci.yml with coverage artifact upload
- Verified: pnpm install, pnpm check (type-check + lint + test), pnpm build all pass

### Change Log

- 2026-01-15: Initial project setup complete - all quality gates verified passing

### File List

**New Files:**
- package.json
- pnpm-lock.yaml
- tsconfig.json
- eslint.config.js
- vitest.config.ts
- .prettierrc
- .prettierignore
- .husky/pre-commit
- .github/workflows/ci.yml
- bin/bmad-orchestrator.js
- src/cli.ts
- src/cli.test.ts
- dist/cli.js (build output)
- dist/cli.d.ts (build output)
- dist/cli.test.js (build output)
- dist/cli.test.d.ts (build output)

**New Directories:**
- src/
- src/lib/
- src/lib/__fixtures__/
- src/hooks/
- src/components/
- src/commands/
- bin/
- .github/workflows/
- dist/ (build output)
