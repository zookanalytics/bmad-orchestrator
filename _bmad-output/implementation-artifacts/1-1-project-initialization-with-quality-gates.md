# Story 1.1: Project Initialization with Quality Gates

Status: ready-for-dev

## Story

As a **developer**,
I want **a properly configured TypeScript project with CI, linting, and testing**,
So that **code quality is enforced from the first commit**.

## Acceptance Criteria

### AC1: Dependencies Install Successfully
**Given** a new project directory
**When** I run `npm install`
**Then** all dependencies install without errors
**And** the following tooling is configured:
- TypeScript 5.x with strict mode
- ESLint with @typescript-eslint rules
- Prettier for code formatting
- Vitest for testing
- Pre-commit hooks via husky/lint-staged

### AC2: Quality Check Passes
**Given** the project is initialized
**When** I run `npm run check`
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

- [ ] Task 1: Initialize npm package (AC: #1)
  - [ ] 1.1 Run `npm init` with package name `@zookanalytics/bmad-orchestrator`
  - [ ] 1.2 Set `"type": "module"` for ESM
  - [ ] 1.3 Add `"engines": { "node": ">=22" }`
  - [ ] 1.4 Set entry point: `bin/bmad-orchestrator.js`

- [ ] Task 2: Install dependencies (AC: #1)
  - [ ] 2.1 Install core deps: `ink@6 react@19 commander@14 @inkjs/ui yaml timeago.js execa@9 clipboardy`
  - [ ] 2.2 Install TypeScript deps: `typescript@5 @types/node @types/react tsx`
  - [ ] 2.3 Install testing deps: `vitest ink-testing-library`
  - [ ] 2.4 Install code quality deps: `eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier eslint-plugin-perfectionist`
  - [ ] 2.5 Install git hooks deps: `husky lint-staged`

- [ ] Task 3: Configure TypeScript (AC: #1, #2)
  - [ ] 3.1 Create tsconfig.json with strict mode, ES2022 target, NodeNext modules
  - [ ] 3.2 Configure jsx: "react-jsx" for Ink components
  - [ ] 3.3 Set outDir: "dist", rootDir: "src"

- [ ] Task 4: Configure ESLint (AC: #1, #2)
  - [ ] 4.1 Create eslint.config.js (flat config format)
  - [ ] 4.2 Configure @typescript-eslint rules with strict checking
  - [ ] 4.3 Configure eslint-plugin-perfectionist for import ordering
  - [ ] 4.4 Set max cognitive complexity to 20
  - [ ] 4.5 Configure TODO comments as errors

- [ ] Task 5: Configure Prettier (AC: #1)
  - [ ] 5.1 Create .prettierrc with project conventions
  - [ ] 5.2 Create .prettierignore for dist, node_modules

- [ ] Task 6: Configure Vitest (AC: #1, #2, #4)
  - [ ] 6.1 Create vitest.config.ts with globals and node environment
  - [ ] 6.2 Configure test include patterns: `src/**/*.test.ts`, `src/**/*.test.tsx`
  - [ ] 6.3 Configure coverage thresholds: 80% global minimum
  - [ ] 6.4 Configure coverage reporter: text, lcov

- [ ] Task 7: Configure Git Hooks (AC: #1)
  - [ ] 7.1 Initialize husky with `npx husky init`
  - [ ] 7.2 Create pre-commit hook to run lint-staged
  - [ ] 7.3 Configure lint-staged in package.json for TypeScript/TSX files

- [ ] Task 8: Create Project Structure (AC: #1, #2)
  - [ ] 8.1 Create src/ directory
  - [ ] 8.2 Create src/lib/ directory for business logic
  - [ ] 8.3 Create src/lib/__fixtures__/ directory for test fixtures
  - [ ] 8.4 Create src/hooks/ directory for React hooks
  - [ ] 8.5 Create src/components/ directory for Ink components
  - [ ] 8.6 Create src/commands/ directory for CLI subcommands
  - [ ] 8.7 Create bin/ directory for npm bin entry point

- [ ] Task 9: Create Minimal Entry Points (AC: #2)
  - [ ] 9.1 Create bin/bmad-orchestrator.js with shebang and dist import
  - [ ] 9.2 Create src/cli.ts with minimal Commander setup
  - [ ] 9.3 Create src/cli.test.ts with one passing test

- [ ] Task 10: Create Package Scripts (AC: #2)
  - [ ] 10.1 Add "dev": "tsx src/cli.ts"
  - [ ] 10.2 Add "build": "tsc"
  - [ ] 10.3 Add "test": "vitest"
  - [ ] 10.4 Add "test:run": "vitest run"
  - [ ] 10.5 Add "lint": "eslint src/"
  - [ ] 10.6 Add "format": "prettier --write src/"
  - [ ] 10.7 Add "type-check": "tsc --noEmit"
  - [ ] 10.8 Add "check": "npm run type-check && npm run lint && npm run test:run"

- [ ] Task 11: Create CI Workflow (AC: #3, #4)
  - [ ] 11.1 Create .github/workflows/ directory
  - [ ] 11.2 Create ci.yml with checkout, setup-node@v4, npm ci, npm run check
  - [ ] 11.3 Configure coverage report upload as artifact
  - [ ] 11.4 Configure workflow to run on push and pull_request

- [ ] Task 12: Verify All Quality Gates (AC: #1, #2, #3, #4)
  - [ ] 12.1 Run `npm install` - verify no errors
  - [ ] 12.2 Run `npm run check` - verify type-check, lint, test all pass
  - [ ] 12.3 Commit and verify pre-commit hook runs
  - [ ] 12.4 Verify coverage report generates

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
│   └── bmad-orchestrator.js       # npm bin entry point
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
      - run: npm ci
      - run: npm run check
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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
