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
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

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
- Installation (FR33-35): npm package, host-based filesystem reads

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
| **Single TypeScript package** | Standard `src/` directory structure - not a monorepo |

### Data Sources (Existing BMAD Artifacts Only - Phase 1)

| Data Need | Source | Method |
|-----------|--------|--------|
| Story status | `sprint-status.yaml` | Direct read - `development_status` map |
| Current assignment | `sprint-status.yaml` | Filter stories with `in-progress` status |
| Task progress | Story markdown files | Parse `## Tasks` section, regex: `/- \[(x| )\]/g` |
| Last activity | Filesystem | `fs.stat().mtime` on story files |
| Backlog | `sprint-status.yaml` | Filter `ready-for-dev` or `backlog` status |
| DevPod list | DevPod CLI | `devpod list --output json` subprocess |

### BMAD Artifact Path Contract

| Artifact | Path (relative to DevPod workspace) |
|----------|-------------------------------------|
| Sprint status | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
| Story files | `_bmad-output/implementation-artifacts/stories/*.md` |
| Epic files | `_bmad-output/implementation-artifacts/epics/*.md` |

**Validation:** If `_bmad-output` not found, mark DevPod as "not BMAD-initialized."

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

Without explicit heartbeat or session state, Phase 1 uses activity-based detection:

| Status | Indicator | Detection Method | User Meaning |
|--------|-----------|------------------|--------------|
| Running | ● | Story `in-progress` + recent mtime | Work happening (probably) |
| Idle | ○ | No `in-progress` story assigned | Ready for dispatch |
| Inactive | ⚠ | `in-progress` but stale mtime | Might need attention - check manually |
| Done | ✓ | Story status is `done` | Completed |

**Display with Time Context:** Show duration for inactive: `⚠ Inactive (2h)` - helps users decide whether to investigate.

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
src/
├── cli.ts              # Entry point, Commander setup
├── commands/           # status, list, dispatch (CLI mode)
├── components/         # Ink TUI components
├── lib/
│   ├── discovery.ts    # devpod list subprocess
│   ├── state.ts        # YAML + story file parsing
│   ├── activity.ts     # mtime checks, threshold
│   └── commands.ts     # Command string generation
└── types.ts            # Interfaces
```

**Code Quality Focus:** Meaningful, readable, maintainable code over arbitrary metrics.

### Reference Documentation Note

The `docs/bmad_reference/` folder contains architecture from an archived related project. These documents are **reference for ideas only** - not source of truth for this architecture.

## Starter Template Evaluation

### Primary Technology Domain

CLI tool with TUI (Terminal UI) - host-based dashboard for DevPod orchestration.

### Previous Implementation Reference

Epic 1 from the previous attempt provides a solid foundation pattern - comprehensive quality gates from the start. The key adaptation: this is a standalone project, not a monorepo package.

**What to adopt from previous Epic 1:**
- ESLint with TypeScript strict rules
- Prettier for consistent formatting
- Vitest for testing (co-located tests)
- CI workflow for quality checks
- Pre-commit hooks

**What to adapt:**
- Standalone project structure (not `packages/bmad-dashboard/`)
- No monorepo-specific tooling (pnpm workspace)
- Simpler package scripts

### Technology Versions (Verified 2026-01-07)

| Technology | Version | Purpose |
|------------|---------|---------|
| Ink | 6.6.0 | TUI framework (React for CLIs) |
| Commander | 14.0.2 | CLI argument parsing |
| React | 19.x | Component framework (required by Ink 6) |
| TypeScript | 5.x | Type safety, strict mode |
| Vitest | 4.0.16 | Testing framework |
| ink-testing-library | latest | Ink component testing |
| @inkjs/ui | latest | UI components (Badge, ProgressBar, Spinner) |
| yaml | latest | YAML parsing for sprint-status.yaml |
| timeago.js | latest | Relative timestamp formatting |

### Selected Approach: Manual Setup with Full Tooling

**Rationale:**
- CI and testing should be in place before first line of code
- Previous Epic 1 pattern worked well
- Adapt for standalone project (not monorepo)
- Quality gates from the start prevent technical debt

**Initialization Commands:**

```bash
# Initialize project
npm init -y

# Core dependencies
npm install ink@6 react@19 commander@14 @inkjs/ui yaml timeago.js

# Dev dependencies - TypeScript
npm install -D typescript@5 @types/node @types/react tsx

# Dev dependencies - Testing
npm install -D vitest ink-testing-library

# Dev dependencies - Code Quality
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
npm install -D prettier eslint-config-prettier

# Dev dependencies - Git hooks (optional, can use git-workflow skill)
npm install -D husky lint-staged
```

**TypeScript Configuration (tsconfig.json):**

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

**Vitest Configuration (vitest.config.ts):**

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

**Package Scripts:**

```json
{
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "type-check": "tsc --noEmit",
    "check": "npm run type-check && npm run lint && npm run test:run"
  }
}
```

**CI Workflow (.github/workflows/ci.yml):**

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

**Project Structure with Tests:**

```
bmad-orchestrator/
├── src/
│   ├── cli.ts              # Entry point
│   ├── cli.test.ts         # Co-located test
│   ├── commands/
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.test.tsx
│   ├── lib/
│   │   ├── discovery.ts
│   │   ├── discovery.test.ts
│   │   ├── state.ts
│   │   └── state.test.ts
│   └── types.ts
├── .github/workflows/ci.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
└── .prettierrc
```

**Note:** Project initialization with full tooling is the first implementation story. Tests and CI should pass before any feature code is written.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- State management approach: Single orchestrator hook
- Subprocess handling: execa 9.x with thin wrapper
- Distribution method: Scoped npm package

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

**Version:** 9.6.1 (verified 2026-01-07)

**Rationale:**
- 16,553+ npm dependents - battle-tested
- `reject: false` returns errors in values, not exceptions
- Cleaner aggregation with Promise.allSettled
- Dependency injection enables testing without global mocks

**Wrapper Pattern:**

```typescript
import { execa, type ExecaReturnValue } from 'execa';

type CommandExecutor = typeof execa;

export function createDiscovery(executor: CommandExecutor = execa) {
  return async function discoverDevPods(): Promise<DiscoveryResult> {
    const result = await executor('devpod', ['list', '--output', 'json'], {
      timeout: 10000,
      reject: false,  // Errors in return value, not thrown
    });

    if (result.failed) {
      return { devpods: [], error: result.stderr };
    }

    return { devpods: JSON.parse(result.stdout), error: null };
  };
}

// Production usage
const discoverDevPods = createDiscovery();

// Test usage - inject mock
const mockExecutor = vi.fn().mockResolvedValue({ stdout: '[]', failed: false });
const discoverDevPods = createDiscovery(mockExecutor);
```

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

**Decision:** Scoped npm package

**Package Name:** `@zookanalytics/bmad-orchestrator`

**Rationale:**
- Namespace prevents name collision
- Groups related ZookAnalytics packages
- Modern convention

**Publishing:**

```bash
npm publish --access public  # First publish
npm publish                  # Subsequent
```

### Project Structure (Refined)

```
bmad-orchestrator/
├── src/
│   ├── cli.ts                    # Entry point
│   ├── cli.test.ts
│   ├── __fixtures__/             # Test fixtures (step 1)
│   │   ├── devpod-list.json
│   │   ├── sprint-status.yaml
│   │   └── story-1-1.md
│   ├── lib/
│   │   ├── types.ts              # Types live with code
│   │   ├── discovery.ts
│   │   ├── discovery.test.ts
│   │   ├── state.ts
│   │   └── state.test.ts
│   ├── hooks/
│   │   ├── useOrchestrator.ts
│   │   └── useOrchestrator.test.ts
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   └── Dashboard.test.tsx
│   └── commands/
│       └── status.ts
├── .github/workflows/ci.yml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**Key Refinement:** Types in `lib/types.ts`, not root level. Types serve the lib modules.

### Decisions Not Applicable

| Category | Why N/A |
|----------|---------|
| Database | Filesystem reads only |
| Authentication | Local CLI tool |
| API Server | Subprocess consumer only |
| Hosting | npm package, runs locally |

### Implementation Sequence (Refined)

Types emerge with code, not before. Each step ships something testable:

1. **Project init** - Tooling, CI, one passing test, test fixtures
2. **Discovery module** - Start with hardcoded return, then real execa
3. **State module** - YAML parsing with fixture tests
4. **Orchestrator hook** - Compose discovery + state
5. **Dashboard component** - Render with hardcoded, then hooks
6. **CLI entry point** - Commander wrapper
7. **Polish and publish**

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
| Fixtures | camelCase in `lib/__fixtures__/` | `devPodList.json` |

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
// 1. React imports
import { useState, useCallback, useReducer } from 'react';

// 2. Ink imports
import { Box, Text, useInput } from 'ink';
import { Spinner } from '@inkjs/ui';

// 3. External type imports
import type { ExecaReturnValue } from 'execa';

// 4. External value imports (node builtins, packages)
import { execaCommand } from 'execa';
import path from 'node:path';

// 5. Internal imports (types then values)
import type { DevPod, BmadState } from '../lib/types.js';

import { formatError } from '../lib/errors.js';
import { useOrchestrator } from '../hooks/useOrchestrator.js';
```

**Import Rules:**
- Use `.js` extension for relative imports (ESM requirement)
- ESLint auto-fixes import order on save
- `import type` syntax required for type-only imports

### Structure Patterns

**Project Organization:**

```
src/
├── cli.ts                    # Entry point only - no business logic
├── types.ts                  # Root-level type re-exports (optional)
├── lib/                      # Business logic (no React)
│   ├── __fixtures__/         # Test fixtures (mock data)
│   │   ├── devPodList.json
│   │   └── sprintStatus.yaml
│   ├── types.ts              # All shared types
│   ├── discovery.ts          # DevPod discovery
│   ├── discovery.test.ts
│   ├── state.ts              # BMAD state parsing
│   ├── state.test.ts
│   ├── errors.ts             # Error formatting
│   └── errors.test.ts
├── hooks/                    # React hooks
│   ├── useOrchestrator.ts
│   └── useOrchestrator.test.ts
├── components/               # Ink components
│   ├── Dashboard.tsx
│   ├── Dashboard.test.tsx
│   ├── DevPodPane.tsx
│   └── StatusBadge.tsx
└── commands/                 # CLI subcommands
    ├── status.ts
    └── list.ts
```

**Key Rules:**
- Types live in `lib/types.ts`
- Tests are always co-located with source
- Fixtures in `lib/__fixtures__/` (not src root)
- `lib/` contains pure functions (no React imports)
- `hooks/` contains React hooks only
- `components/` contains Ink components only

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

**Error Message Template Function:**

```typescript
interface AppError {
  code: string;
  context?: string;
  suggestion?: string;
}

function formatError(error: AppError): string {
  const parts = [`✗ ${error.code}`];
  if (error.context) parts[0] += `: ${error.context}`;
  if (error.suggestion) parts.push(`  Suggestion: ${error.suggestion}`);
  return parts.join('\n');
}

// Usage
formatError({
  code: 'CONNECTION_TIMEOUT',
  context: 'devpod-3',
  suggestion: 'Check if DevPod is running with `devpod list`'
});

// Output:
// ✗ CONNECTION_TIMEOUT: devpod-3
//   Suggestion: Check if DevPod is running with `devpod list`
```

**Error Handling in Async Functions:**

```typescript
// Use reject: false pattern with execa
const result = await executor('devpod', ['list'], { reject: false });
if (result.failed) {
  return { devpods: [], error: formatError({ code: 'DISCOVERY_FAILED', ... }) };
}

// Never let exceptions bubble up unhandled
// Always return error state, not throw
```

**Null Usage:**
- `null` is allowed and preferred for intentional absence (API semantics)
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
5. Use the `formatError()` template for all error messages
6. Use SCREAMING_SNAKE_CASE for reducer action types and enum members
7. Use function declarations for components (not arrow functions)
8. Place all shared types in `lib/types.ts`
9. Do NOT import React explicitly (only import hooks)
10. Never leave TODO comments (track work externally)

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

## Project Structure & Boundaries

### Complete Project Structure

```
bmad-orchestrator/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Quality gates: type-check, lint, test
├── bin/
│   └── bmad-orchestrator.js       # npm bin entry point (FR33-35)
├── src/
│   ├── cli.ts                     # Entry point - Commander setup only
│   ├── cli.test.ts
│   ├── lib/                       # Pure business logic (NO React imports)
│   │   ├── __fixtures__/          # Test fixtures for all lib modules
│   │   │   ├── devPodList.json
│   │   │   ├── devPodListEmpty.json
│   │   │   ├── devPodListError.json
│   │   │   ├── sprintStatus.yaml
│   │   │   ├── sprintStatusMinimal.yaml
│   │   │   ├── sprintStatusMalformed.yaml
│   │   │   ├── story-1-1.md
│   │   │   └── story-1-1-complete.md
│   │   ├── types.ts               # All shared types
│   │   ├── discovery.ts           # DevPod CLI subprocess (FR1-4)
│   │   ├── discovery.test.ts
│   │   ├── state.ts               # YAML + story file parsing (FR5-10)
│   │   ├── state.test.ts
│   │   ├── activity.ts            # mtime detection only (FR16-18)
│   │   ├── activity.test.ts
│   │   ├── commands.ts            # Command string generation (FR19-23)
│   │   ├── commands.test.ts
│   │   ├── errors.ts              # formatError() template
│   │   └── errors.test.ts
│   ├── hooks/
│   │   ├── useOrchestrator.ts     # Single state hook (reducer pattern)
│   │   └── useOrchestrator.test.ts
│   ├── components/                # Ink TUI components (FR24-28)
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.test.tsx
│   │   ├── DevPodPane.tsx
│   │   ├── DevPodPane.test.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── CommandPanel.tsx
│   │   └── BacklogPanel.tsx
│   └── commands/                  # CLI subcommands (FR29-32)
│       ├── status.ts
│       ├── status.test.ts
│       ├── list.ts
│       └── list.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
└── .prettierrc
```

### Architectural Boundaries

| Layer | Purpose | Import Rules |
|-------|---------|--------------|
| `lib/` | Pure business logic | NO React imports. Only node builtins + external packages |
| `hooks/` | React state bridge | May import from `lib/`. NO component imports |
| `components/` | UI rendering | May import from `hooks/` and `lib/types.ts` |
| `commands/` | CLI entry points | May import from `lib/`. NO React imports |
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
└── Dashboard.tsx      ──→ useOrchestrator.ts
                            ├── lib/discovery.ts
                            ├── lib/state.ts
                            └── lib/activity.ts
```

All arrows point toward `lib/`. No circular dependencies.

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

### bin Entry Point

```javascript
#!/usr/bin/env node
// bin/bmad-orchestrator.js
import '../dist/cli.js';
```

**package.json bin configuration:**

```json
{
  "bin": {
    "bmad-orchestrator": "./bin/bmad-orchestrator.js"
  }
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
| NFR17 | No external deps | npm packages only | ✓ |
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

### Technology Version Validation

| Technology | Architecture Version | Latest Stable | Risk |
|------------|---------------------|---------------|------|
| Ink | 6.6.0 | 6.x | ✓ Current |
| React | 19.x | 19.x | ✓ Current |
| Commander | 14.0.2 | 14.x | ✓ Current |
| Vitest | 4.0.16 | 4.x | ✓ Current |
| execa | 9.6.1 | 9.x | ✓ Current |
| TypeScript | 5.x | 5.x | ✓ Current |

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

**Ready for Epic/Story creation:**
- Project structure defined with clear boundaries
- FR-to-file mapping complete
- Test fixtures specified
- Patterns documented for AI agent consistency

**Recommended Epic Sequence:**

1. **Epic 1: Project Foundation** - CI, tooling, one passing test
2. **Epic 2: Discovery & State** - lib modules with fixtures
3. **Epic 3: Dashboard Core** - TUI with useOrchestrator
4. **Epic 4: CLI Commands** - status, list with JSON output
5. **Epic 5: Polish & Publish** - npm package ready

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
