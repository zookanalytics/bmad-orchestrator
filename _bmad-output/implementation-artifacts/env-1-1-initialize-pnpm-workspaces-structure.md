# Story 1.1: Initialize pnpm Workspaces Structure

Status: ready-for-dev

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

- [ ] Task 1: Create pnpm-workspace.yaml (AC: #1, #2)
  - [ ] 1.1 Create `pnpm-workspace.yaml` with `packages: ['packages/*']`
  - [ ] 1.2 Verify pnpm version >= 8.0 requirement in package.json engines

- [ ] Task 2: Create root workspace configuration (AC: #1, #2)
  - [ ] 2.1 Update root `package.json` to be workspace root (`private: true`, remove current bin/main entries)
  - [ ] 2.2 Add workspace-level scripts (`pnpm -r build`, `pnpm -r test`, etc.)
  - [ ] 2.3 Keep shared devDependencies at root (typescript, eslint, prettier, vitest)

- [ ] Task 3: Create shared TypeScript configuration (AC: #2)
  - [ ] 3.1 Rename current `tsconfig.json` to `tsconfig.base.json`
  - [ ] 3.2 Configure base settings for all packages to extend

- [ ] Task 4: Create packages directory structure (AC: #1)
  - [ ] 4.1 Create `packages/` directory
  - [ ] 4.2 Create placeholder directories: `packages/orchestrator/`, `packages/agent-env/`, `packages/shared/`
  - [ ] 4.3 Add `.gitkeep` files to preserve empty directories if needed

- [ ] Task 5: Verify workspace configuration (AC: #1, #2)
  - [ ] 5.1 Run `pnpm install` and verify no errors
  - [ ] 5.2 Verify `pnpm -r list` recognizes workspace packages (will be empty initially, but command should work)

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
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

### References

- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Package-Architecture]
- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md#Project-Structure-Boundaries]
- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-1.1]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
