# Story 1.4: Create agent-env CLI Scaffold

Status: ready-for-dev

## Story

As a **developer**,
I want **a basic `agent-env` CLI that responds to `--help`**,
So that **I can verify the package is correctly set up before adding features**.

## Acceptance Criteria

1. **Given** the agent-env package is installed
   **When** I run `agent-env --help`
   **Then** I see usage information with available commands listed

2. **Given** the agent-env package is installed
   **When** I run `agent-env --version`
   **Then** I see the current version number

3. **Given** the agent-env CLI
   **When** I run `agent-env` with no arguments
   **Then** I see help output (placeholder for future interactive menu)

4. **Given** the agent-env package
   **When** I run `pnpm --filter @zookanalytics/agent-env test`
   **Then** CLI tests pass

## Tasks / Subtasks

- [ ] Task 1: Create agent-env package structure (AC: #1, #2, #3, #4)
  - [ ] 1.1 Create `packages/agent-env/package.json` with name `@zookanalytics/agent-env`
  - [ ] 1.2 Create `packages/agent-env/tsconfig.json` extending `../../tsconfig.base.json`
  - [ ] 1.3 Create `packages/agent-env/vitest.config.ts` for package-specific test config
  - [ ] 1.4 Create `packages/agent-env/bin/agent-env.js` shebang entry point
  - [ ] 1.5 Create directory structure: `src/`, `src/lib/`, `src/commands/`, `src/components/`, `src/hooks/`

- [ ] Task 2: Implement CLI entry point (AC: #1, #2, #3)
  - [ ] 2.1 Create `packages/agent-env/src/cli.ts` with Commander setup
  - [ ] 2.2 Configure program name, version, description
  - [ ] 2.3 Set default action (no args) to display help (placeholder for interactive menu)
  - [ ] 2.4 Import and use `formatError` from `@zookanalytics/shared` for error display

- [ ] Task 3: Add placeholder commands (AC: #1)
  - [ ] 3.1 Create `packages/agent-env/src/commands/create.ts` with placeholder
  - [ ] 3.2 Create `packages/agent-env/src/commands/list.ts` with placeholder
  - [ ] 3.3 Create `packages/agent-env/src/commands/attach.ts` with placeholder
  - [ ] 3.4 Create `packages/agent-env/src/commands/remove.ts` with placeholder
  - [ ] 3.5 Create `packages/agent-env/src/commands/purpose.ts` with placeholder
  - [ ] 3.6 Register all commands in `cli.ts`

- [ ] Task 4: Write CLI tests (AC: #4)
  - [ ] 4.1 Create `packages/agent-env/src/cli.test.ts`
  - [ ] 4.2 Test `--help` outputs usage information
  - [ ] 4.3 Test `--version` outputs version number
  - [ ] 4.4 Test no-args behavior shows help output

- [ ] Task 5: Verify package integration (AC: #1, #2, #3, #4)
  - [ ] 5.1 Run `pnpm install` at root to link workspace packages
  - [ ] 5.2 Run `pnpm --filter @zookanalytics/agent-env build` - TypeScript compiles
  - [ ] 5.3 Run `pnpm --filter @zookanalytics/agent-env test` - all tests pass
  - [ ] 5.4 Run `pnpm dev:agent-env --help` - CLI responds correctly
  - [ ] 5.5 Run `pnpm dev:agent-env --version` - shows version
  - [ ] 5.6 Run `pnpm dev:agent-env` (no args) - shows help

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

**Story 1.3** migrated the orchestrator:
- `packages/orchestrator/` with `@zookanalytics/bmad-orchestrator`
- All existing orchestrator code moved and working
- Uses `@zookanalytics/shared` for error formatting
- CI runs all package tests

**CRITICAL:** Stories 1.1, 1.2, and 1.3 must be completed before starting this story. Verify:
- `pnpm-workspace.yaml` exists
- `packages/shared/` is fully implemented with tests passing
- `packages/orchestrator/` is migrated and all tests pass
- `pnpm install` at root links all packages correctly

### Architecture Requirements

From Architecture Decision Document:

**Package Name:** `@zookanalytics/agent-env`

**CLI Pattern:**
- Commander 14.0.2 for argument parsing
- Same patterns as orchestrator CLI
- Ink 6.6.0 for TUI components (used later in interactive menu)
- Colored output using ANSI codes or Ink

**Command Structure (MVP):**
- `create <name> [--repo] [--attach]` - Create instance
- `list` / `ps` - Show all instances
- `attach <name>` - Attach to instance
- `remove [--force] <name>` - Remove instance
- `purpose <name> [value]` - Get/set purpose

**Default Behavior:**
- No arguments → Show help (placeholder for future interactive menu)
- This story only creates placeholders - actual command implementation comes in later epics

### Technical Implementation Details

#### Package.json Specification

```json
{
  "name": "@zookanalytics/agent-env",
  "version": "0.1.0",
  "description": "CLI for creating isolated, AI-ready development environments",
  "type": "module",
  "bin": {
    "agent-env": "./bin/agent-env.js"
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
    "commander": "^14.0.2",
    "execa": "^9.6.1",
    "ink": "^6.6.0",
    "react": "^19.2.3",
    "timeago.js": "^4.0.2"
  },
  "devDependencies": {
    "@types/node": "^25.0.8",
    "@types/react": "^19.2.8",
    "ink-testing-library": "^4.0.0",
    "tsx": "^4.21.0"
  }
}
```

#### tsconfig.json

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

#### vitest.config.ts

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

#### bin/agent-env.js

```javascript
#!/usr/bin/env node
import '../dist/cli.js';
```

#### CLI Entry Point (cli.ts)

```typescript
#!/usr/bin/env node

import { program } from 'commander';

import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { attachCommand } from './commands/attach.js';
import { removeCommand } from './commands/remove.js';
import { purposeCommand } from './commands/purpose.js';

// Package version from package.json
const version = '0.1.0';

program
  .name('agent-env')
  .description('CLI for creating isolated, AI-ready development environments')
  .version(version);

// Register commands
program.addCommand(createCommand);
program.addCommand(listCommand);
program.addCommand(attachCommand);
program.addCommand(removeCommand);
program.addCommand(purposeCommand);

// Default action: show help (placeholder for future interactive menu)
program.action(() => {
  program.help();
});

// Parse arguments
program.parse();
```

#### Placeholder Command Pattern

Each placeholder command follows this pattern:

```typescript
// commands/create.ts
import { Command } from 'commander';

import { formatError, createError } from '@zookanalytics/shared';

export const createCommand = new Command('create')
  .description('Create a new isolated development environment')
  .argument('<name>', 'Name for the new instance')
  .option('--repo <url>', 'Git repository URL to clone')
  .option('--attach', 'Attach immediately after creation')
  .action((name, options) => {
    // Placeholder - actual implementation in Epic 2
    console.log(`\x1b[33m⚠ create command not yet implemented\x1b[0m`);
    console.log(`Would create instance: ${name}`);
    if (options.repo) console.log(`From repo: ${options.repo}`);
    if (options.attach) console.log(`With immediate attach`);
  });
```

```typescript
// commands/list.ts
import { Command } from 'commander';

export const listCommand = new Command('list')
  .alias('ps')
  .description('List all instances with status')
  .option('--json', 'Output in JSON format')
  .action((options) => {
    // Placeholder - actual implementation in Epic 3
    console.log(`\x1b[33m⚠ list command not yet implemented\x1b[0m`);
  });
```

```typescript
// commands/attach.ts
import { Command } from 'commander';

export const attachCommand = new Command('attach')
  .description('Attach to an instance\'s tmux session')
  .argument('<name>', 'Instance name to attach to')
  .action((name) => {
    // Placeholder - actual implementation in Epic 4
    console.log(`\x1b[33m⚠ attach command not yet implemented\x1b[0m`);
    console.log(`Would attach to: ${name}`);
  });
```

```typescript
// commands/remove.ts
import { Command } from 'commander';

export const removeCommand = new Command('remove')
  .description('Remove an instance with safety checks')
  .argument('<name>', 'Instance name to remove')
  .option('--force', 'Force removal, bypassing safety checks')
  .action((name, options) => {
    // Placeholder - actual implementation in Epic 5
    console.log(`\x1b[33m⚠ remove command not yet implemented\x1b[0m`);
    console.log(`Would remove: ${name}`);
    if (options.force) console.log(`With --force flag`);
  });
```

```typescript
// commands/purpose.ts
import { Command } from 'commander';

export const purposeCommand = new Command('purpose')
  .description('Get or set the purpose/label for an instance')
  .argument('<name>', 'Instance name')
  .argument('[value]', 'New purpose value (omit to get current)')
  .action((name, value) => {
    // Placeholder - actual implementation in Epic 4
    console.log(`\x1b[33m⚠ purpose command not yet implemented\x1b[0m`);
    if (value) {
      console.log(`Would set purpose of ${name} to: ${value}`);
    } else {
      console.log(`Would get purpose of: ${name}`);
    }
  });
```

### Testing Requirements

**CLI Test Cases (cli.test.ts):**

```typescript
import { describe, it, expect } from 'vitest';
import { execa } from 'execa';

describe('agent-env CLI', () => {
  const runCli = async (args: string[]) => {
    return execa('tsx', ['src/cli.ts', ...args], {
      cwd: import.meta.dirname?.replace('/src', '') ?? process.cwd(),
      reject: false,
    });
  };

  describe('--help', () => {
    it('displays usage information', async () => {
      const result = await runCli(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent-env');
      expect(result.stdout).toContain('Usage:');
    });

    it('lists available commands', async () => {
      const result = await runCli(['--help']);

      expect(result.stdout).toContain('create');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('attach');
      expect(result.stdout).toContain('remove');
      expect(result.stdout).toContain('purpose');
    });
  });

  describe('--version', () => {
    it('displays version number', async () => {
      const result = await runCli(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('no arguments', () => {
    it('shows help output', async () => {
      const result = await runCli([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
    });
  });

  describe('placeholder commands', () => {
    it('create shows not implemented message', async () => {
      const result = await runCli(['create', 'test-instance']);

      expect(result.stdout).toContain('not yet implemented');
    });

    it('list shows not implemented message', async () => {
      const result = await runCli(['list']);

      expect(result.stdout).toContain('not yet implemented');
    });
  });
});
```

### Project Structure Notes

**Target structure after this story:**

```
packages/
├── shared/                       # From Story 1.2
│   └── ...
│
├── orchestrator/                 # From Story 1.3
│   └── ...
│
└── agent-env/                    # NEW - This story
    ├── package.json              # @zookanalytics/agent-env
    ├── tsconfig.json             # Extends ../../tsconfig.base.json
    ├── vitest.config.ts
    ├── bin/
    │   └── agent-env.js          # Shebang entry point
    └── src/
        ├── cli.ts                # Commander setup
        ├── cli.test.ts           # CLI tests
        ├── lib/                  # Empty - for future modules
        │   └── .gitkeep
        ├── commands/
        │   ├── create.ts         # Placeholder
        │   ├── list.ts           # Placeholder
        │   ├── attach.ts         # Placeholder
        │   ├── remove.ts         # Placeholder
        │   └── purpose.ts        # Placeholder
        ├── components/           # Empty - for future Ink components
        │   └── .gitkeep
        └── hooks/                # Empty - for future hooks
            └── .gitkeep
```

### Root Package.json Script Updates

Add to root package.json scripts (if not already present from Story 1.1):

```json
{
  "scripts": {
    "dev:agent-env": "pnpm --filter @zookanalytics/agent-env dev"
  }
}
```

### Dependencies

**Story 1.3 must be complete** - provides:
- Monorepo structure with all packages linked
- `@zookanalytics/shared` working and tested
- Pattern for CLI package structure (follow orchestrator)

**Package dependencies:**
- `@zookanalytics/shared` (workspace:*) - error formatting
- `commander` - CLI parsing (same version as orchestrator)
- `ink`, `@inkjs/ui`, `react` - TUI (for future use, establish deps now)
- `execa` - subprocess (for future use)
- `timeago.js` - timestamps (for future use)

### Critical Don't-Miss Rules

1. **ESM imports require .js extension:**
   ```typescript
   // Correct
   import { createCommand } from './commands/create.js';

   // Wrong - will fail at runtime
   import { createCommand } from './commands/create';
   ```

2. **Workspace dependency syntax:**
   ```json
   "dependencies": {
     "@zookanalytics/shared": "workspace:*"
   }
   ```

3. **Bin entry point must use dist:**
   ```javascript
   // packages/agent-env/bin/agent-env.js
   #!/usr/bin/env node
   import '../dist/cli.js';
   ```

4. **Commander program setup:**
   - Use `program.addCommand()` to add subcommands
   - Set default action with `program.action()` for no-args case
   - Call `program.parse()` at the end

5. **Placeholder output:**
   - Use yellow color for "not implemented" messages: `\x1b[33m`
   - Keep placeholders simple but functional
   - Include command arguments in output for visibility

6. **Parallel development:**
   - This package will be developed alongside orchestrator
   - Both use shared utilities
   - CI runs both package tests

### Verification Steps

After implementation, run these commands in order:

```bash
# 1. Relink workspace packages
pnpm install

# 2. Build shared (dependency)
pnpm --filter @zookanalytics/shared build

# 3. Build agent-env
pnpm --filter @zookanalytics/agent-env build

# 4. Run agent-env tests
pnpm --filter @zookanalytics/agent-env test:run

# 5. Test CLI works
pnpm dev:agent-env --help
pnpm dev:agent-env --version
pnpm dev:agent-env
pnpm dev:agent-env create test-name --repo https://github.com/example/repo
pnpm dev:agent-env list
pnpm dev:agent-env attach test-name

# 6. Run all tests (ensure no regressions)
pnpm -r test:run
```

### Git Intelligence (Recent Context)

Recent commits show this is part of the agent-env monorepo setup:
- `8ed7154` - docs: add agent-env planning artifacts
- `61354a7` - docs: add agent-env PRD
- `678c73c` - docs: add agent-env product brief
- `deb9104` - docs(epic-1): complete retrospective (orchestrator Epic 1 done)

This story completes Epic 1 for agent-env by creating the CLI scaffold. After this story:
- Both CLIs exist in the monorepo
- Both use shared utilities
- CI tests both packages
- Ready to implement actual functionality in Epic 2

### What This Story Does NOT Do

- **NO actual command implementations** - just placeholders
- **NO Ink components** - just directory structure
- **NO workspace/container management** - that's Epic 2
- **NO git state detection** - that's Epic 3
- **NO interactive menu** - just help output for now

This is intentionally a minimal scaffold to verify the package structure works before investing in feature implementation.

### References

- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Package-Architecture]
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Project-Structure-Boundaries]
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#CLI-Naming-Convention]
- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-1.4]
- [Source: _bmad-output/project-context.md#Critical-Implementation-Rules]
- [Source: _bmad-output/implementation-artifacts/env-1-1-initialize-pnpm-workspaces-structure.md]
- [Source: _bmad-output/implementation-artifacts/env-1-2-create-shared-utilities-package.md]
- [Source: _bmad-output/implementation-artifacts/env-1-3-migrate-orchestrator-to-packages.md]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
