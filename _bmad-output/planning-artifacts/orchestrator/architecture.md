---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
workflowComplete: true
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-bmad-orchestrator-2026-01-06.md'
  - '_bmad-output/planning-artifacts/research/bmad-orchestration-implementation-brief.md'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/research/bmad-completion-detection-research.md'
  - '_bmad-output/planning-artifacts/research/technical-ai-dev-environment-tools-research-2026-01-03.md'
  - '_bmad-output/planning-artifacts/research/technical-nimbalyst-deep-dive-research-2026-01-03.md'
  - '_bmad-output/planning-artifacts/research/technical-state-management-devcontainers-research-2026-01-03.md'
  - 'docs/reference/project-context.md'
  - 'docs/reference/technology-stack.md'
  - 'docs/reference/project-structure.md'
  - 'docs/reference/source-tree.md'
  - 'docs/bmad_reference/planning-artifacts/epics.md'
  - 'docs/bmad_reference/planning-artifacts/architecture.md'
  - 'docs/bmad_reference/planning-artifacts/architecture/orchestration-minimal-fallback.md'
workflowType: 'architecture'
project_name: 'BMAD Orchestrator'
user_name: 'Node'
date: '2026-01-07'
lastValidated: '2026-02-07'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

### Post-Epic-1 Validation Summary (2026-02-07)

This architecture was validated against the actual codebase after Epic 1 completion. Key corrections applied:

| Area | Original Assumption | Actual Implementation |
|------|--------------------|-----------------------|
| Project structure | Standalone TypeScript package | pnpm workspaces monorepo (`packages/orchestrator/`) |
| Error utilities | Local `lib/errors.ts` with `formatError({code, context, suggestion})` | `@zookanalytics/shared` with `createError(code, message, suggestion)` + `formatError(error)` using `AppError` interface |
| Error display | `✗` symbol prefix | `❌` emoji + `💡` suggestion prefix (from shared package) |
| DevPod CLI output | Returns status field | Does NOT return status; returns id, source, provider, ide, machine, timestamps |
| DevPodStatus values | Lowercase (`'running'`, `'stopped'`) | PascalCase (`'Running'`, `'Stopped'`, `'Busy'`, `'NotFound'`) |
| Node.js engine | `>=22` | `>=20` |
| ESLint config | Per-package `.eslintrc` | Root-level ESLint 9 flat config (`eslint.config.js`) |
| tsconfig | Local with all options | Extends `../../tsconfig.base.json` |
| Story file paths | `_bmad-output/implementation-artifacts/stories/*.md` | `_bmad-output/implementation-artifacts/*.md` (flat, no stories/ subdirectory) |
| Epic file paths | `_bmad-output/implementation-artifacts/epics/*.md` | `_bmad-output/planning-artifacts/{component}/epics.md` (single file per component) |
| Versioning | Manual version bumps | Changesets-based versioning (rel-epic-2) |
| Package state | Published | `"private": true` (not yet published) |

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
35 FRs spanning 8 categories:
- DevPod Discovery & Status (FR1-4): Auto-discovery, unified view, config override
- Story & Progress Visibility (FR5-10): Assignment, status, activity tracking, task progress, backlog
- Needs-Input Handling (FR11-15): **Deferred to Phase 2** - requires container modification or SDK
- Inactive Detection (FR16-18): Activity detection via file mtime, visual alerts, SSH commands
- Command Generation (FR19-23): Copy-paste dispatch, SSH commands, tmux attach
- Dashboard Interface (FR24-28): Persistent TUI, navigation, drill-down
- CLI Commands (FR29-32): Scriptable status, list, JSON output, completion
- Installation (FR33-35): pnpm package, host-based filesystem reads

Core value proposition: Unified visibility across all DevPods with actionable commands, derived entirely from existing BMAD artifacts.

**Non-Functional Requirements:**
18 NFRs with emphasis on:
- Performance: <2s render, <1s refresh, <500ms CLI, <3s discovery
- Reliability: Zero false negatives on inactive detection, graceful partial failures
- Platform: macOS (Intel + Apple Silicon) + Linux (Ubuntu 22.04+)
- Maintainability: Readable, maintainable code with clear separation of concerns

**Scale & Complexity:**
- Primary domain: CLI + TUI Developer Tool
- Complexity level: Medium
- Estimated architectural components: 6-8 core modules

### Technical Constraints & Dependencies

| Constraint | Description |
|------------|-------------|
| Host-based execution | Dashboard runs on host machine, not inside containers |
| **Zero container footprint (Phase 1)** | Phase 1 avoids modifications to BMAD workflows or DevPod containers; future phases may allow |
| Read-only observer | Derives ALL state from existing BMAD artifacts - no new file contracts in Phase 1 |
| Git-native state | Uses existing `sprint-status.yaml` and story files only |
| DevPod CLI dependency | Relies on `devpod list --output json` for container discovery |
| **pnpm workspaces monorepo** | Orchestrator is `packages/orchestrator/` in a monorepo with `shared` and `agent-env` packages |

### Data Sources (Existing BMAD Artifacts Only - Phase 1)

| Data Need | Source | Method |
|-----------|--------|--------|
| Story status | `sprint-status.yaml` | Direct read - `development_status` map |
| Current assignment | `sprint-status.yaml` | Filter stories with `in-progress` status |
| Task progress | Story markdown files | Parse `## Tasks` section, regex: `/- \[(x| )\]/g` |
| Last activity | Filesystem | `fs.stat().mtime` on story files |
| Backlog | `sprint-status.yaml` | Filter `ready-for-dev` or `backlog` status |
| DevPod list | DevPod CLI | `devpod list --output json` subprocess (returns id, source, provider, ide, machine, timestamps — does NOT return status) |

### BMAD Artifact Path Contract

| Artifact | Path (relative to DevPod workspace) |
|----------|-------------------------------------|
| Sprint status | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Story files | `_bmad-output/implementation-artifacts/*.md` (flat, NOT in a `stories/` subdirectory) |
| Epic files | `_bmad-output/planning-artifacts/{component}/epics.md` (single file per component, NOT individual files in `epics/` directory) |

**Validation:** If `_bmad-output` not found, mark DevPod as "not BMAD-initialized."

**Note (Post-Epic-1 correction):** Story files live directly in `implementation-artifacts/` alongside `sprint-status.yaml`, not in a nested `stories/` subdirectory. Epic definitions are in planning artifacts, not implementation artifacts.

### MVP FR Adjustments (Phase 1)

**Achievable in Phase 1 (Zero Container Modification):**
- FR1-10: DevPod discovery, story visibility, progress tracking ✓
- FR16-18: Inactive detection + SSH command for investigation ✓
- FR19-23: Command generation (dispatch, SSH) ✓
- FR24-28: Dashboard interface ✓
- FR29-35: CLI and installation ✓

**Deferred to Phase 2+ (May Require Container Modification or SDK):**

| FR | Capability | Why Deferred |
|----|------------|--------------|
| FR12 | See Claude's question | No mechanism to capture question text without container modification |
| FR13 | Session ID visibility | Claude CLI session IDs are ephemeral, not persisted |
| FR14-15 | Resume with answer | Depends on FR12-13 |

**FR18 Reframed:** "User can see suggested diagnostic actions" becomes "User can see SSH command to investigate inactive DevPods."

### Honest Status Language

Without explicit heartbeat or session state, Phase 1 uses activity-based detection. **Note:** These statuses are derived from BMAD state files, NOT from DevPod CLI (which only returns `'Running'|'Stopped'|'Busy'|'NotFound'` for the container itself).

| Status | Indicator | Detection Method | User Meaning |
|--------|-----------|------------------|--------------|
| Running | ● | Story `in-progress` + recent mtime | Work happening (probably) |
| Idle | ○ | No `in-progress` story assigned | Ready for dispatch |
| Inactive | ⚠ | `in-progress` but stale mtime | Might need attention - check manually |
| Done | ✓ | Story status is `done` | Completed |

**Display with Time Context:** Show duration for inactive: `⚠ Inactive (2h)` - helps users decide whether to investigate.

**DevPod CLI Status vs BMAD Status:** `DevPodStatus` (from CLI) tracks container state (`Running`/`Stopped`/`Busy`/`NotFound`). The orchestrator status language above tracks *work* state derived from BMAD artifacts. These are two different dimensions - a DevPod can be `Running` (container up) but `Idle` (no story assigned).

### Activity Detection Configuration

| Setting | Default | Rationale |
|---------|---------|-----------|
| Inactive threshold | **1 hour** | 30 minutes too aggressive - Claude may be thinking on complex tasks |
| Configuration | Environment variable (Phase 2) | Keep Phase 1 simple, allow tuning later |

### Discovery Pipeline

```
1. devpod list --output json
   └── Get DevPod names + workspace paths

2. For each DevPod (parallel):
   └── Validate workspace path exists
   └── Check for _bmad-output directory
   └── If missing: mark "not BMAD-initialized"
   └── If present: read sprint-status.yaml + story files

3. Aggregate results
   └── Successful reads → devpods[]
   └── Failed reads → errors[]
   └── Promise.allSettled for error isolation
```

### Cross-Cutting Concerns

1. **Error Resilience** - Partial failures (one DevPod unreachable) must not block other DevPods
2. **Activity Detection** - File mtime as proxy for "last activity" - threshold 1 hour default
3. **State Derivation** - All state inferred from existing files in Phase 1; future phases may add contracts
4. **Command Generation** - SSH commands for investigation; dispatch commands for starting work
5. **Honest UX** - Status language reflects what we can actually detect, not aspirational features

### Project Structure

```
packages/orchestrator/
├── bin/
│   └── bmad-orchestrator.js    # CLI entry point (shebang wrapper)
├── src/
│   ├── cli.ts                  # Entry point, Commander setup
│   ├── commands/               # status, list, dispatch (CLI mode)
│   │   └── list.ts             # List command (implemented in Epic 1)
│   ├── components/             # Ink TUI components (Epic 3)
│   └── lib/
│       ├── types.ts            # All shared types
│       ├── discovery.ts        # devpod list subprocess (implemented in Epic 1)
│       ├── state.ts            # YAML + story file parsing (Epic 2)
│       ├── activity.ts         # mtime checks, threshold (Epic 2)
│       ├── commands.ts         # Command string generation (Epic 4)
│       └── __fixtures__/       # Test fixtures
├── package.json
├── tsconfig.json               # Extends ../../tsconfig.base.json
└── vitest.config.ts
```

**Monorepo Context:** Orchestrator is one package in a pnpm workspaces monorepo alongside `@zookanalytics/shared` (error utilities, types) and `@zookanalytics/agent-env`.

**Code Quality Focus:** Meaningful, readable, maintainable code over arbitrary metrics.

### Reference Documentation Note

The `docs/bmad_reference/` folder contains architecture from an archived related project. These documents are **reference for ideas only** - not source of truth for this architecture.

## Starter Template Evaluation

### Primary Technology Domain

CLI tool with TUI (Terminal UI) - host-based dashboard for DevPod orchestration.

### Previous Implementation Reference

Epic 1 established the project as a pnpm workspaces monorepo package (not standalone as originally planned). This was the right decision - it enabled shared utilities (`@zookanalytics/shared`) and co-location with `agent-env`.

**What was adopted from previous patterns:**
- ESLint 9 flat config with TypeScript strict rules (root-level `eslint.config.js`)
- Prettier for consistent formatting (root-level `.prettierrc`)
- Vitest for testing (co-located tests, per-package `vitest.config.ts`)
- CI workflow for quality checks
- `eslint-plugin-perfectionist` for import ordering

**Monorepo adaptations:**
- `packages/orchestrator/` directory structure
- `tsconfig.json` extends `../../tsconfig.base.json`
- `@zookanalytics/shared` workspace dependency for error utilities
- Root-level ESLint and Prettier configs shared across packages

### Technology Versions (Verified post-Epic-1)

| Technology | Version | Purpose |
|------------|---------|---------|
| Ink | ^6.6.0 | TUI framework (React for CLIs) |
| Commander | ^14.0.2 | CLI argument parsing |
| React | ^19.2.3 | Component framework (required by Ink 6) |
| TypeScript | 5.x | Type safety, strict mode (ES2022 target, NodeNext modules) |
| Vitest | (workspace) | Testing framework (v8 coverage provider) |
| ink-testing-library | ^4.0.0 | Ink component testing |
| @inkjs/ui | ^2.0.0 | UI components (Badge, ProgressBar, Spinner) |
| yaml | ^2.8.2 | YAML parsing for sprint-status.yaml |
| timeago.js | ^4.0.2 | Relative timestamp formatting |
| execa | ^9.6.1 | Subprocess execution with `reject: false` pattern |
| clipboardy | ^5.0.2 | Cross-platform clipboard access |
| @zookanalytics/shared | workspace:* | Shared error utilities (`createError`, `formatError`, `AppError`) |

### Selected Approach: Monorepo with Full Tooling (As Implemented)

**Rationale:**
- CI and testing should be in place before first line of code
- Monorepo enables shared utilities (`@zookanalytics/shared`) across packages
- Quality gates from the start prevent technical debt
- Root-level configs (ESLint, Prettier) ensure consistency across packages

**TypeScript Configuration (packages/orchestrator/tsconfig.json):**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts", "src/**/*.test.tsx"]
}
```

**Root tsconfig.base.json (shared):**

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
    "declarationMap": true,
    "resolveJsonModule": true
  }
}
```

**Vitest Configuration (packages/orchestrator/vitest.config.ts):**

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
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  },
});
```

**Package Scripts (packages/orchestrator/package.json):**

```json
{
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit",
    "check": "pnpm type-check && pnpm lint && pnpm test:run"
  }
}
```

**Actual Project Structure (Post-Epic-1):**

```
packages/orchestrator/
├── bin/
│   └── bmad-orchestrator.js    # #!/usr/bin/env node → ../dist/cli.js
├── src/
│   ├── cli.ts                  # Entry point (Commander setup)
│   ├── cli.test.ts             # Co-located test
│   ├── commands/
│   │   ├── list.ts             # List command handler
│   │   └── list.test.ts
│   └── lib/
│       ├── types.ts            # All shared types (DevPod, DiscoveryResult, etc.)
│       ├── types.test.ts       # Type validation tests
│       ├── discovery.ts        # DevPod CLI subprocess (DI factory)
│       ├── discovery.test.ts   # Comprehensive discovery tests
│       └── __fixtures__/
│           ├── devPodList.json
│           ├── devPodListEmpty.json
│           └── devPodListError.json
├── package.json
├── tsconfig.json               # Extends ../../tsconfig.base.json
└── vitest.config.ts
```

**Note:** ESLint config (`eslint.config.js`) and Prettier config (`.prettierrc`) live at root level, shared across all packages.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- State management approach: Single orchestrator hook
- Subprocess handling: execa 9.x with thin wrapper
- Distribution method: Scoped pnpm package

**Already Decided (from Previous Steps):**
- TUI Framework: Ink 6.6.0 + React 19.x
- CLI Framework: Commander 14.0.2
- Testing: Vitest 4.0.16 + ink-testing-library
- Data Source: Existing BMAD artifacts only (Phase 1)
- Error Isolation: Promise.allSettled pattern

**Deferred Decisions (Post-MVP/Phase 2+):**
- Configuration file support (Phase 2)
- Container modification for session state (Phase 2+)
- Claude Agent SDK integration (Phase 3)

### State Management

**Decision:** Single `useOrchestrator` hook built on useReducer

**Rationale:**
- One hook = one file to understand (not three separate hooks)
- useReducer for complex state transitions
- Testable in isolation without rendering
- Clean component separation

**Implementation Pattern:**

```typescript
// Single hook, single source of truth
function useOrchestrator() {
  const [state, dispatch] = useReducer(orchestratorReducer, initialState);

  // All effects in one place
  useEffect(() => { /* initial load */ }, []);
  useInput((input, key) => { /* keyboard handling */ });

  // All actions
  const refresh = useCallback(async () => {
    dispatch({ type: 'REFRESH_START' });
    const result = await discoverAndAggregate();
    dispatch({ type: 'REFRESH_COMPLETE', payload: result });
  }, []);

  const select = useCallback((index: number) => {
    dispatch({ type: 'SELECT', payload: index });
  }, []);

  return { ...state, refresh, select };
}

// Component stays declarative
function Dashboard() {
  const { devpods, selected, loading, refresh } = useOrchestrator();
  return <Box>...</Box>;
}
```

### Subprocess Handling

**Decision:** execa 9.x with thin wrapper using `reject: false` pattern

**Version:** ^9.6.1

**Rationale:**
- Battle-tested subprocess library
- `reject: false` returns errors in values, not exceptions
- Cleaner aggregation with Promise.allSettled
- Dependency injection enables testing without global mocks

**Actual Implementation Pattern (from `packages/orchestrator/src/lib/discovery.ts`):**

```typescript
import { execa } from 'execa';
import type { DevPod, DiscoveryResult, RawObject } from './types.js';

const DEFAULT_TIMEOUT = 10000;
type CommandExecutor = typeof execa;

export function createDiscovery(executor: CommandExecutor = execa) {
  return async function discoverDevPods(): Promise<DiscoveryResult> {
    const result = await executor('devpod', ['list', '--output', 'json'], {
      timeout: DEFAULT_TIMEOUT,
      reject: false,  // Errors in return value, NOT thrown
    });

    if (result.failed) {
      let errorMessage: string;
      if (result.timedOut) {
        errorMessage = `Command timed out after ${DEFAULT_TIMEOUT}ms`;
      } else {
        errorMessage = result.stderr || result.shortMessage || 'Unknown error';
      }
      return { devpods: [], error: `DISCOVERY_FAILED: ${errorMessage}` };
    }

    try {
      const parsed = JSON.parse(result.stdout);
      const devpods = mapDevPodOutput(parsed);  // Handles array + wrapper object formats
      return { devpods, error: null };
    } catch {
      return { devpods: [], error: 'DISCOVERY_FAILED: Invalid JSON response' };
    }
  };
}

// Production usage
export const discoverDevPods = createDiscovery();

// Test usage - inject mock
const mockExecutor = vi.fn().mockResolvedValue({ stdout: '[]', failed: false });
const discover = createDiscovery(mockExecutor);
```

**Note:** The discovery module includes mapper functions (`mapSource`, `mapProvider`, `mapIde`, `mapMachine`, `mapTimestamp`, `mapWorkspaces`) to safely convert raw CLI JSON to typed `DevPod` interfaces, handling both direct array and `{ workspaces: [] }` wrapper formats.

**Timeout Strategy:**
- DevPod discovery: 10 seconds
- Individual state reads: 5 seconds per DevPod
- `reject: false` means timeouts return error state, not throw

### Testing Strategy

**Decision:** Dependency injection for subprocess mocking, test fixtures from day 1

**Rationale:**
- No global mocks - tests are explicit about what they mock
- Fixtures enable TUI development without running DevPods
- Never test against real DevPod CLI in CI

**Test Priority:**

| Category | Priority | Coverage Target |
|----------|----------|-----------------|
| lib/discovery.ts | **Critical** | 90%+ |
| lib/state.ts | **Critical** | 90%+ (YAML edge cases) |
| hooks/useOrchestrator.ts | **High** | 80%+ |
| components/*.tsx | **Medium** | Snapshot + key interactions |
| cli.ts | **Low** | Integration test only |

**Required Test Fixtures (Step 1):**

```
src/
└── __fixtures__/
    ├── devpod-list.json          # Mock devpod list output
    ├── devpod-list-empty.json    # No DevPods
    ├── devpod-list-error.json    # CLI error response
    ├── sprint-status.yaml        # Valid sprint status
    ├── sprint-status-minimal.yaml
    ├── story-1-1.md              # Story with tasks
    └── story-1-1-complete.md     # All tasks checked
```

### Distribution & Versioning

**Decision:** Scoped package within monorepo, versioned via changesets

**Package Name:** `@zookanalytics/bmad-orchestrator`
**Currently:** `"private": true` (not yet published; release infrastructure established in rel-epic-1 & rel-epic-2)

**Rationale:**
- Namespace prevents name collision
- Groups related ZookAnalytics packages
- Modern convention
- Changesets-based versioning established for the monorepo

**Publishing (when ready):**

```bash
pnpm changeset  # Create changeset
pnpm changeset version  # Apply version bumps
pnpm publish --access public  # Publish
```

### Project Structure (Actual Post-Epic-1 + Planned)

```
packages/orchestrator/
├── bin/
│   └── bmad-orchestrator.js       # CLI bin entry point
├── src/
│   ├── cli.ts                     # Entry point (Commander setup)
│   ├── cli.test.ts
│   ├── lib/
│   │   ├── types.ts               # All shared types
│   │   ├── types.test.ts          # Type validation tests
│   │   ├── discovery.ts           # DevPod CLI subprocess (✓ implemented)
│   │   ├── discovery.test.ts      # (✓ implemented)
│   │   ├── state.ts               # YAML + story parsing (Epic 2)
│   │   ├── state.test.ts
│   │   ├── activity.ts            # mtime detection (Epic 2)
│   │   ├── activity.test.ts
│   │   └── __fixtures__/          # Test fixtures
│   │       ├── devPodList.json     # (✓ implemented)
│   │       ├── devPodListEmpty.json # (✓ implemented)
│   │       └── devPodListError.json # (✓ implemented)
│   ├── hooks/                     # React hooks (Epic 3)
│   │   ├── useOrchestrator.ts
│   │   └── useOrchestrator.test.ts
│   ├── components/                # Ink TUI components (Epic 3)
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.test.tsx
│   └── commands/
│       ├── list.ts                # (✓ implemented)
│       ├── list.test.ts           # (✓ implemented)
│       └── status.ts              # (Epic 5)
├── package.json
├── tsconfig.json                  # Extends ../../tsconfig.base.json
└── vitest.config.ts
```

**Key Points:**
- Types in `lib/types.ts` (not root level)
- Fixtures in `lib/__fixtures__/` (not src root)
- ESLint/Prettier configs at monorepo root, not per-package

### Decisions Not Applicable

| Category | Why N/A |
|----------|---------|
| Database | Filesystem reads only |
| Authentication | Local CLI tool |
| API Server | Subprocess consumer only |
| Hosting | Package runs locally |

### Implementation Sequence (Updated Post-Epic-1)

Types emerge with code, not before. Each step ships something testable:

1. **Project init** - ✓ Done: Tooling, CI, test fixtures, monorepo setup
2. **Discovery module** - ✓ Done: `createDiscovery()` with DI, execa subprocess
3. **List command** - ✓ Done: Text table + JSON output
4. **State module** - Next (Epic 2): YAML parsing with fixture tests
5. **Activity module** - Epic 2: mtime-based inactive detection
6. **Enhanced list** - Epic 2: BMAD state in list output
7. **Orchestrator hook** - Epic 3: Compose discovery + state
8. **Dashboard components** - Epic 3: Ink TUI
9. **Command generation** - Epic 4: SSH, dispatch, tmux commands
10. **CLI polish and publish** - Epic 5

**Principle:** Don't plan the whole tree upfront. Each step ships something testable.

### Cross-Component Dependencies

```
cli.ts
  └── Commander (mode detection)
      ├── TUI Mode → Dashboard
      │                └── useOrchestrator
      │                     └── createDiscovery (execa)
      │                     └── parseState (yaml)
      └── CLI Mode → commands/*.ts
                      └── Same discovery/state modules
```

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 8 areas where AI agents could make different choices, all now resolved with explicit patterns.

### Naming Patterns

**File Naming Conventions:**

| Type | Pattern | Example |
|------|---------|---------|
| React Components | PascalCase | `Dashboard.tsx`, `DevPodPane.tsx` |
| Hooks | camelCase with `use` prefix | `useOrchestrator.ts` |
| Lib modules | camelCase | `discovery.ts`, `devPodParser.ts` |
| Test files | Co-located `.test.ts` | `discovery.test.ts` |
| Type files | camelCase | `types.ts` |
| Fixtures | camelCase in `src/lib/__fixtures__/` | `devPodList.json` |

**TypeScript Naming Conventions:**

| Type | Pattern | Example | Anti-Pattern |
|------|---------|---------|--------------|
| Interfaces | PascalCase, no prefix | `DevPod` | `IDevPod` |
| Types | PascalCase, no prefix | `Status` | `TStatus` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_TIMEOUT` | `defaultTimeout` |
| Reducer Actions | SCREAMING_SNAKE_CASE | `'REFRESH_START'` | `'refreshStart'` |
| Enum Members | SCREAMING_SNAKE_CASE | `Status.RUNNING` | `Status.Running` |

**Async Function Naming:**

No prefix required. The `async` keyword and `Promise<T>` return type communicate async behavior.

```typescript
// Correct
async function discoverDevPods(): Promise<DevPod[]> { ... }
async function parseState(): Promise<BmadState> { ... }

// Incorrect - unnecessary prefix
async function fetchDevPodsAsync(): Promise<DevPod[]> { ... }
```

### Import Patterns

**Import Ordering (enforced by eslint-plugin-perfectionist):**

Types are grouped with their category, not all at the end. Blank lines separate groups.

```typescript
// 1. External package imports (including monorepo shared)
import { createError, formatError } from '@zookanalytics/shared';

// 2. React imports (when in hooks/components)
import { useState, useCallback, useReducer } from 'react';

// 3. Ink imports
import { Box, Text, useInput } from 'ink';
import { Spinner } from '@inkjs/ui';

// 4. External type imports
import type { ExecaReturnValue } from 'execa';

// 5. External value imports (node builtins, packages)
import { execa } from 'execa';
import path from 'node:path';

// 6. Internal imports (types then values)
import type { DevPod, BmadState } from '../lib/types.js';

import { useOrchestrator } from '../hooks/useOrchestrator.js';
```

**Import Rules:**
- Use `.js` extension for relative imports (ESM requirement)
- ESLint auto-fixes import order on save
- `import type` syntax required for type-only imports
- Import error utilities from `@zookanalytics/shared`, NOT local files

### Structure Patterns

**Project Organization:**

```
packages/orchestrator/src/
├── cli.ts                    # Entry point only - Commander setup, no business logic
├── lib/                      # Business logic (no React)
│   ├── __fixtures__/         # Test fixtures (mock data)
│   │   ├── devPodList.json
│   │   ├── devPodListEmpty.json
│   │   ├── devPodListError.json
│   │   └── sprintStatus.yaml    # (Epic 2)
│   ├── types.ts              # All shared types
│   ├── types.test.ts         # Type validation tests
│   ├── discovery.ts          # DevPod discovery
│   ├── discovery.test.ts
│   ├── state.ts              # BMAD state parsing (Epic 2)
│   ├── state.test.ts
│   ├── activity.ts           # mtime detection (Epic 2)
│   └── activity.test.ts
├── hooks/                    # React hooks (Epic 3)
│   ├── useOrchestrator.ts
│   └── useOrchestrator.test.ts
├── components/               # Ink components (Epic 3)
│   ├── Dashboard.tsx
│   ├── Dashboard.test.tsx
│   ├── DevPodPane.tsx
│   └── StatusBadge.tsx
└── commands/                 # CLI subcommands
    ├── list.ts               # (✓ implemented)
    ├── list.test.ts
    ├── status.ts             # (Epic 5)
    └── status.test.ts
```

**Key Rules:**
- Types live in `lib/types.ts`
- Tests are always co-located with source
- Fixtures in `lib/__fixtures__/` (not src root)
- `lib/` contains pure functions (no React imports)
- `hooks/` contains React hooks only
- `components/` contains Ink components only
- **Error utilities** live in `@zookanalytics/shared`, NOT in orchestrator's `lib/errors.ts`

### Format Patterns

**JSON Output Format (CLI `--json` flag):**

```typescript
interface JsonOutput {
  version: '1';
  devpods: DevPod[];
  errors: OutputError[];
}

// Always wrap in this structure
{
  "version": "1",
  "devpods": [...],
  "errors": [...]
}
```

**Status Indicators (TUI display):**

| Symbol | Meaning | When Used |
|--------|---------|-----------|
| `✓` | Success/Complete | Story done |
| `●` | In progress/Running | Active work |
| `○` | Pending/Idle | Ready for work |
| `⚠` | Warning/Inactive | Needs attention |
| `✗` | Error/Failed | Connection failed |

### Error Handling Patterns

**Error utilities live in `@zookanalytics/shared` package:**

```typescript
// From packages/shared/src/types.ts
interface AppError {
  code: string;      // Machine-readable error code (e.g., "DISCOVERY_FAILED")
  message: string;   // Human-readable error description
  suggestion?: string;  // Optional actionable suggestion
}

// From packages/shared/src/errors.ts
function createError(code: string, message: string, suggestion?: string): AppError;
function formatError(error: AppError): string;
// Output format:
// ❌ [ERROR_CODE] Error message
//    💡 Suggestion text (if provided)
```

**Usage in orchestrator commands:**

```typescript
import { createError, formatError } from '@zookanalytics/shared';

// In list command error handling:
formatError(
  createError(
    'DISCOVERY_FAILED',
    result.error.replace('DISCOVERY_FAILED: ', ''),
    'Check if DevPod CLI is installed with `devpod version`'
  )
);
```

**Error Handling in Async Functions:**

```typescript
// Discovery module uses reject: false pattern with execa
// Errors are embedded in DiscoveryResult.error string, NOT thrown
// Commands layer then wraps these in AppError via createError()

// Never let exceptions bubble up unhandled
// Always return error state, not throw
```

**Null Usage:**
- `null` is allowed and preferred for intentional absence (API semantics, e.g., `DiscoveryResult.error: string | null`)
- `undefined` for optional/unset values

### State Management Patterns

**Reducer Action Types:**

```typescript
// Actions use SCREAMING_SNAKE_CASE
type OrchestratorAction =
  | { type: 'REFRESH_START' }
  | { type: 'REFRESH_COMPLETE'; payload: RefreshResult }
  | { type: 'REFRESH_ERROR'; payload: string }
  | { type: 'SELECT_DEVPOD'; payload: number }
  | { type: 'NAVIGATE_UP' }
  | { type: 'NAVIGATE_DOWN' };

// Reducer follows standard pattern
function orchestratorReducer(
  state: OrchestratorState,
  action: OrchestratorAction
): OrchestratorState {
  switch (action.type) {
    case 'REFRESH_START':
      return { ...state, loading: true };
    case 'REFRESH_COMPLETE':
      return { ...state, loading: false, devpods: action.payload.devpods };
    // ...
  }
}
```

### Component Patterns

**Function Declaration Style:**

```typescript
// Correct: Function declaration
function Dashboard({ onQuit }: DashboardProps) {
  const { devpods, selected, loading } = useOrchestrator();
  return <Box>...</Box>;
}

// Incorrect: Arrow function
const Dashboard: FC<DashboardProps> = ({ onQuit }) => { ... }
```

**Props Interface Naming:**

```typescript
// Props interfaces use ComponentNameProps
interface DashboardProps {
  onQuit: () => void;
}

interface DevPodPaneProps {
  devpod: DevPod;
  selected: boolean;
}
```

**React Import:**
- Do NOT import React explicitly (React 19 handles this automatically)
- Only import hooks: `import { useState } from 'react';`

### Testing Patterns

**Test File Structure:**

```typescript
import { describe, it, expect, vi } from 'vitest';

import { createDiscovery } from './discovery.js';

describe('discovery', () => {
  describe('discoverDevPods', () => {
    it('returns empty array when DevPod CLI not installed', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        failed: true,
        stderr: 'command not found'
      });
      const discover = createDiscovery(mockExecutor);

      const result = await discover();

      expect(result.devpods).toEqual([]);
      expect(result.error).toContain('DISCOVERY_FAILED');
    });
  });
});
```

**Dependency Injection for Mocking:**

```typescript
// Production: use default
const discover = createDiscovery();

// Test: inject mock
const mockExecutor = vi.fn();
const discover = createDiscovery(mockExecutor);
```

### Code Quality Rules

**Enforced by ESLint:**
- Maximum cognitive complexity: 20
- TODO comments are errors (must be tracked, not left in code)
- Strict TypeScript type checking enabled

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow file naming conventions exactly (PascalCase components, camelCase lib)
2. Use co-located tests (never separate `__tests__/` directory)
3. Use `import type` syntax for type-only imports
4. Use `.js` extension for relative imports
5. Use `createError()` + `formatError()` from `@zookanalytics/shared` for all user-facing error messages
6. Use SCREAMING_SNAKE_CASE for reducer action types and enum members
7. Use function declarations for components (not arrow functions)
8. Place all shared types in `lib/types.ts`
9. Do NOT import React explicitly (only import hooks)
10. Never leave TODO comments (track work externally)
11. Extend `../../tsconfig.base.json` in per-package tsconfig (monorepo pattern)

**Pattern Verification:**
- ESLint with `eslint-plugin-perfectionist` enforces import ordering
- ESLint with `@typescript-eslint/naming-convention` enforces naming
- TypeScript strict mode catches type issues
- Code review validates error handling patterns

### Anti-Patterns to Avoid

| Anti-Pattern | Correct Pattern |
|--------------|-----------------|
| `interface IDevPod` | `interface DevPod` |
| `const Dashboard: FC = () => {}` | `function Dashboard() {}` |
| `src/types.ts` (root level) | `src/lib/types.ts` |
| `__tests__/discovery.test.ts` | `lib/discovery.test.ts` |
| `src/__fixtures__/` | `src/lib/__fixtures__/` |
| `dispatch({ type: 'refreshStart' })` | `dispatch({ type: 'REFRESH_START' })` |
| `throw new Error(...)` in async | Return error state |
| `async function fetchDataAsync()` | `async function fetchData()` |
| `import React from 'react'` | `import { useState } from 'react'` |
| `import { Foo } from './foo'` | `import { Foo } from './foo.js'` |
| `devpod-parser.ts` (kebab-case) | `devPodParser.ts` (camelCase) |
| `// TODO: fix later` | Track in issue tracker |
| Local `errors.ts` in orchestrator | Use `@zookanalytics/shared` createError/formatError |
| Per-package `.eslintrc` / `eslint.config.js` | Root-level ESLint 9 flat config shared across packages |

## Project Structure & Boundaries

### Complete Project Structure

```
packages/orchestrator/                # Within pnpm workspaces monorepo
├── bin/
│   └── bmad-orchestrator.js          # CLI bin entry point (FR33-35)
├── src/
│   ├── cli.ts                        # Entry point - Commander setup only
│   ├── cli.test.ts
│   ├── lib/                          # Pure business logic (NO React imports)
│   │   ├── __fixtures__/             # Test fixtures for all lib modules
│   │   │   ├── devPodList.json       # (✓ implemented)
│   │   │   ├── devPodListEmpty.json  # (✓ implemented)
│   │   │   ├── devPodListError.json  # (✓ implemented)
│   │   │   ├── sprintStatus.yaml             # (Epic 2)
│   │   │   ├── sprintStatusMinimal.yaml      # (Epic 2)
│   │   │   ├── sprintStatusMalformed.yaml    # (Epic 2)
│   │   │   ├── story-1-1.md                  # (Epic 2)
│   │   │   └── story-1-1-complete.md         # (Epic 2)
│   │   ├── types.ts                  # All shared types
│   │   ├── types.test.ts             # Type validation tests
│   │   ├── discovery.ts              # DevPod CLI subprocess (FR1-4) (✓ implemented)
│   │   ├── discovery.test.ts         # (✓ implemented)
│   │   ├── state.ts                  # YAML + story file parsing (FR5-10) (Epic 2)
│   │   ├── state.test.ts
│   │   ├── activity.ts               # mtime detection only (FR16-18) (Epic 2)
│   │   ├── activity.test.ts
│   │   ├── commands.ts               # Command string generation (FR19-23) (Epic 4)
│   │   └── commands.test.ts
│   ├── hooks/                        # (Epic 3)
│   │   ├── useOrchestrator.ts        # Single state hook (reducer pattern)
│   │   └── useOrchestrator.test.ts
│   ├── components/                   # Ink TUI components (FR24-28) (Epic 3)
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.test.tsx
│   │   ├── DevPodPane.tsx
│   │   ├── DevPodPane.test.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── CommandPanel.tsx
│   │   └── BacklogPanel.tsx
│   └── commands/                     # CLI subcommands (FR29-32)
│       ├── list.ts                   # (✓ implemented)
│       ├── list.test.ts              # (✓ implemented)
│       ├── status.ts                 # (Epic 5)
│       └── status.test.ts
├── package.json                      # @zookanalytics/bmad-orchestrator
├── tsconfig.json                     # Extends ../../tsconfig.base.json
└── vitest.config.ts                  # v8 coverage provider

# Root-level shared configs (NOT per-package):
# eslint.config.js  - ESLint 9 flat config
# .prettierrc       - Prettier config
# tsconfig.base.json - Shared TypeScript base config
```

**Note:** Error utilities (`createError`, `formatError`, `AppError`) live in `@zookanalytics/shared`, not in orchestrator's `lib/`. No `errors.ts` in the orchestrator package.

### Architectural Boundaries

| Layer | Purpose | Import Rules |
|-------|---------|--------------|
| `lib/` | Pure business logic | NO React imports. Only node builtins + external packages + `@zookanalytics/shared` |
| `hooks/` | React state bridge | May import from `lib/`. NO component imports |
| `components/` | UI rendering | May import from `hooks/` and `lib/types.ts` |
| `commands/` | CLI entry points | May import from `lib/` and `@zookanalytics/shared`. NO React imports |
| `cli.ts` | Entry point | Routes to `commands/` or renders `Dashboard` |

### Module Responsibility Clarification

**`state.ts` vs `activity.ts` boundary:**

| Module | Responsibility | Data Source |
|--------|----------------|-------------|
| `state.ts` | Parse BMAD artifacts: sprint-status.yaml, story files, task counts | File contents |
| `activity.ts` | Detect staleness via mtime, calculate inactive threshold | File stats only |

These modules share types from `lib/types.ts` but have no logic dependency. `state.ts` answers "what is the current state?" while `activity.ts` answers "when did it last change?"

### FR-to-File Mapping

| FR Range | Capability | Primary Files |
|----------|------------|---------------|
| FR1-4 | DevPod Discovery | `lib/discovery.ts` |
| FR5-10 | Story & Progress | `lib/state.ts` |
| FR11-15 | Needs-Input | **Deferred to Phase 2** |
| FR16-18 | Inactive Detection | `lib/activity.ts` |
| FR19-23 | Command Generation | `lib/commands.ts` |
| FR24-28 | Dashboard Interface | `components/*.tsx`, `hooks/useOrchestrator.ts` |
| FR29-32 | CLI Commands | `commands/status.ts`, `commands/list.ts` |
| FR33-35 | Installation | `package.json`, `bin/bmad-orchestrator.js` |

### Dependency Flow (No Cycles)

```
cli.ts
├── commands/status.ts ──→ lib/discovery.ts
│                      ──→ lib/state.ts
│                      ──→ lib/commands.ts
├── commands/list.ts   ──→ lib/discovery.ts
│                      ──→ @zookanalytics/shared (createError, formatError)
└── Dashboard.tsx      ──→ useOrchestrator.ts
                            ├── lib/discovery.ts
                            ├── lib/state.ts
                            └── lib/activity.ts
```

All arrows point toward `lib/` and `@zookanalytics/shared`. No circular dependencies.

### Test Fixtures (Required for Step 1)

| Fixture | Purpose | Edge Case |
|---------|---------|-----------|
| `devPodList.json` | Normal DevPod list | 3 DevPods, mixed states |
| `devPodListEmpty.json` | No DevPods | Empty array |
| `devPodListError.json` | CLI error | stderr output |
| `sprintStatus.yaml` | Normal sprint | Multiple stories, various statuses |
| `sprintStatusMinimal.yaml` | Minimal valid | One story, defaults |
| `sprintStatusMalformed.yaml` | Invalid YAML | Tests error handling |
| `story-1-1.md` | In-progress story | Some tasks checked |
| `story-1-1-complete.md` | Completed story | All tasks checked |

### Component Test Mocking Pattern

Components that use `useOrchestrator` need mock state for isolated testing:

```typescript
// Dashboard.test.tsx
import { vi } from 'vitest';

// Mock the hook module
vi.mock('../hooks/useOrchestrator.js', () => ({
  useOrchestrator: () => ({
    devpods: mockDevPods,
    selected: 0,
    loading: false,
    error: null,
    refresh: vi.fn(),
    select: vi.fn(),
  }),
}));
```

This pattern keeps component tests focused on rendering logic, not state management.

### bin Entry Point (Implemented)

```javascript
#!/usr/bin/env node
// packages/orchestrator/bin/bmad-orchestrator.js
import '../dist/cli.js';
```

**package.json configuration (actual):**

```json
{
  "name": "@zookanalytics/bmad-orchestrator",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "bmad-orchestrator": "./bin/bmad-orchestrator.js"
  },
  "main": "dist/cli.js",
  "types": "dist/cli.d.ts",
  "engines": {
    "node": ">=20"
  },
  "files": ["dist", "bin"]
}
```

## Architecture Validation

### FR Coverage Matrix

| FR Range | Capability | Architecture Component | Status |
|----------|------------|------------------------|--------|
| FR1-4 | DevPod Discovery | `lib/discovery.ts` + execa | ✓ Covered |
| FR5-10 | Story & Progress | `lib/state.ts` + YAML parsing | ✓ Covered |
| FR11-15 | Needs-Input | **Deferred to Phase 2** | ⏸ Intentionally scoped out |
| FR16-18 | Inactive Detection | `lib/activity.ts` + mtime | ✓ Covered (via file mtime) |
| FR19-23 | Command Generation | `lib/commands.ts` | ✓ Covered |
| FR24-28 | Dashboard Interface | `components/*.tsx` + `hooks/useOrchestrator.ts` | ✓ Covered |
| FR29-32 | CLI Commands | `commands/status.ts`, `list.ts` + Commander | ✓ Covered |
| FR33-35 | Installation | `package.json` + `bin/` entry point | ✓ Covered |

**Phase 1 FR Coverage:** 30 of 35 FRs addressed. FR11-15 intentionally deferred (requires container modification).

### NFR Coverage Matrix

| NFR | Requirement | Architecture Approach | Status |
|-----|-------------|----------------------|--------|
| NFR1 | <2s initial render | Parallel discovery via Promise.allSettled | ✓ |
| NFR2 | <1s refresh | Interval-based refresh with file stat | ✓ |
| NFR3 | <500ms CLI | Direct subprocess, no TUI overhead | ✓ |
| NFR4 | <3s discovery | 10s timeout, parallel reads | ✓ |
| NFR5 | Zero false negatives on stale | Conservative 1-hour threshold | ✓ |
| NFR6 | Acceptable false positives | Activity detection via mtime | ✓ |
| NFR7 | Graceful DevPod failures | `reject: false` + Promise.allSettled | ✓ |
| NFR8 | Partial failure handling | Error isolation per DevPod | ✓ |
| NFR9 | macOS support | Node.js + Ink (cross-platform) | ✓ |
| NFR10 | Linux support | Node.js + Ink (cross-platform) | ✓ |
| NFR11 | DevPod CLI integration | execa subprocess | ✓ |
| NFR12 | BMAD file parsing | yaml package + regex | ✓ |
| NFR13 | Claude JSON output | Future Phase 2+ | ⏸ |
| NFR14 | tmux session naming | SSH command generation | ✓ |
| NFR15 | Owner understandability | Clean module boundaries | ✓ |
| NFR16 | Clear separation | lib/hooks/components/commands layers | ✓ |
| NFR17 | No external deps | Node.js packages only | ✓ |
| NFR18 | Self-documenting config | Zero-config Phase 1 | ✓ |

**NFR Coverage:** 17 of 18 NFRs addressed. NFR13 deferred with Phase 2+ features.

### UX Specification Alignment

| UX Pattern | Architecture Support |
|------------|---------------------|
| Pane-based grid layout | `DevPodPane.tsx` component with props |
| j/k keyboard navigation | `useOrchestrator` hook with useInput |
| Status indicators (✓●○⏸⚠✗) | STATE_CONFIG in `lib/types.ts` |
| Command bar with copy-paste | `CommandPanel.tsx` + clipboard integration |
| Auto-refresh | useEffect interval in `useOrchestrator` |
| Responsive breakpoints | `useStdoutDimensions()` in Dashboard |
| Double-border for needs-input | Component prop `borderStyle` conditional |
| Backlog overlay | `BacklogPanel.tsx` + keyboard trigger |

### Technology Version Validation (Post-Epic-1)

| Technology | Installed Version | Risk |
|------------|------------------|------|
| Ink | ^6.6.0 | ✓ Current |
| React | ^19.2.3 | ✓ Current |
| Commander | ^14.0.2 | ✓ Current |
| Vitest | (workspace) | ✓ Current |
| execa | ^9.6.1 | ✓ Current |
| TypeScript | 5.x | ✓ Current |
| @inkjs/ui | ^2.0.0 | ✓ Current |
| yaml | ^2.8.2 | ✓ Current |
| timeago.js | ^4.0.2 | ✓ Current |
| clipboardy | ^5.0.2 | ✓ Current |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DevPod path discovery fails | Medium | High | Validate early in Story 1; document path contract |
| Ink 6 + React 19 incompatibility | Low | High | Test all @inkjs/ui components in Story 1 |
| mtime detection unreliable | Low | Medium | Document 1-hour threshold rationale; allow config Phase 2 |
| YAML parsing edge cases | Medium | Medium | Comprehensive fixture coverage from Day 1 |
| Clipboard unavailable | Low | Low | Show command inline as fallback |

### Gaps and Deferred Items

| Gap | Reason | Resolution |
|-----|--------|------------|
| FR11-15 (Needs-Input) | Requires container modification | Phase 2+ when SDK available |
| Real-time file watching | Polling sufficient for MVP | Phase 2 enhancement |
| Configuration file | Zero-config first | Phase 2 optional config |
| Kanban view | MVP focus on pane grid | Future enhancement |

### Architecture Completeness Checklist

- [x] All Phase 1 FRs have mapped components
- [x] All critical NFRs have implementation approach
- [x] UX patterns supported by component structure
- [x] Test strategy defined with fixture requirements
- [x] Error handling patterns documented
- [x] Dependency injection enables testability
- [x] No circular dependencies in module graph
- [x] Technology versions verified current

### Implementation Readiness

**Epic 1 Complete (orch-epic-1: done):**
- Project structure established as monorepo package
- CI, tooling, quality gates all working
- DevPod discovery implemented with full DI pattern
- `list` command with text + JSON output modes
- Comprehensive test coverage with fixtures

**Epic 2 (orch-epic-2: backlog) - Ready for Development:**
- Requires: BMAD state fixtures (sprintStatus.yaml, story markdown files)
- Requires: `state.ts` (YAML parsing) and `activity.ts` (mtime detection) modules
- All patterns established in Epic 1 carry forward
- Note: Cross-dependency on `env-epic-3` for integration testing with real agent-env instances

**Epic Sequence:**

1. **Epic 1: Project Foundation** - ✓ Done (CI, tooling, discovery, list command)
2. **Epic 2: BMAD State Parsing & Activity Detection** - Next (state.ts, activity.ts, enhanced list)
3. **Epic 3: Dashboard Experience** - TUI with useOrchestrator
4. **Epic 4: Command Generation & Clipboard Actions** - commands.ts, CommandBar
5. **Epic 5: CLI Polish & Package Publishing** - status command, shell completion, publish

## Phase 3+ Considerations: Execution Engine Architecture

Phase 3 introduces autonomous execution within DevPods. Rather than building from scratch, an **execution engine abstraction** allows multiple approaches:

| Engine | Description | Availability |
|--------|-------------|--------------|
| **Direct Claude** | Single-story execution via CLI | Now (Phase 1-2) |
| **Autopilot** | Full epic automation (bash-based) | Fork available |
| **Custom Engine** | TypeScript + Claude Agent SDK | Future build |

### Execution Engine Contract

All engines write to `.execution/status.json` for orchestrator visibility:

```typescript
interface ExecutionStatus {
  engine: 'autopilot' | 'direct-claude' | 'custom';
  phase: 'idle' | 'developing' | 'reviewing' | 'needs-input' | 'completed' | 'failed';
  epicId?: string;
  storyId?: string;
  progress?: { tasksCompleted: number; tasksTotal: number };
  needsInput: boolean;
  lastQuestion?: string;
  lastActivity: string;  // ISO timestamp
}
```

### Integration with Discovery

```typescript
// lib/discovery.ts enhancement for Phase 3
interface DevPodInfo {
  // ... existing fields
  executionEngine?: {
    type: 'autopilot' | 'direct-claude' | 'custom' | 'none';
    status?: ExecutionStatus;
  };
}
```

**Reference:** See [Autopilot Integration Architecture](./research/autopilot-integration-architecture.md) for detailed integration sketch, decision matrix, and implementation phases.
