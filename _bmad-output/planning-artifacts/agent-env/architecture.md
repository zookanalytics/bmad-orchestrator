---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowComplete: true
completedAt: '2026-01-27'
lastUpdated: '2026-02-14'
inputDocuments:
  - '_bmad-output/planning-artifacts/agent-env/prd.md'
  - '_bmad-output/planning-artifacts/agent-env/product-brief.md'
  - '_bmad-output/planning-artifacts/research/technical-ai-dev-environment-tools-research-2026-01-03.md'
  - '_bmad-output/planning-artifacts/research/technical-state-management-devcontainers-research-2026-01-03.md'
workflowType: 'architecture'
project_name: 'agent-env'
user_name: 'Node'
date: '2026-01-27'
revisions:
  - date: '2026-02-14'
    trigger: 'PRD revision (6 new features, validation fixes)'
    changes: 'Revised naming model, baseline config prompt, purpose propagation, CLI inside container, slug compression, repo registry'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
42 FRs spanning 8 categories:
- Instance Lifecycle (FR1-6): create, remove with safety checks, force override
- Instance Discovery & Status (FR7-11): list with git state indicators, never-pushed branch detection
- Instance Access (FR12-14): tmux attach, persistent sessions across attach/detach
- State & Metadata (FR15-18): purpose tracking, timestamps
- Safety & Data Protection (FR19-26): comprehensive git analysis, clear blocker messaging
- Configuration & Environment (FR27-33): baseline devcontainer with Claude Code, git signing, SSH agent, tmux
- CLI Interface (FR34-38): interactive menu (no args), scriptable commands, JSON output, shell completion
- Installation & Platform (FR39-42): npm/pnpm global install, macOS + Linux, Docker dependency

Core value proposition: Isolated, AI-ready dev environments with worktree-like parallelism but full container isolation.

**Non-Functional Requirements:**
21 NFRs with emphasis on:
- Performance: <2s attach, <500ms list, <30s create (cached), <5s time-to-productive, <3s safety check
- Reliability: Zero false negatives on safety (non-negotiable), tmux session persistence, instance state survives restart
- Compatibility: Docker 20.10+, devcontainer.json spec, any git remote, standard SSH configs
- Maintainability: Understandable codebase, clear separation (CLI, container lifecycle, git operations), testable

**Scale & Complexity:**
- Primary domain: CLI + Container Management Tool
- Complexity level: Low-Medium
- Estimated architectural components: 5-7 core modules

### Technical Constraints & Dependencies

| Constraint | Description |
|------------|-------------|
| Host-based execution | CLI runs on host machine, manages containers via Docker |
| OrbStack runtime | Uses OrbStack instead of Docker Desktop - provides predictable `*.orb.local` domains per container |
| devcontainer.json standard | Uses open spec for container configuration |
| Baseline-only MVP | No repo-specific config overrides in Phase 1 |
| TypeScript codebase | Replacing bash claude-instance script for testability |
| Terminal-first | VS Code integration optional; tmux is primary interface |

### Instance Model

**Atomic Unit:** Workspace folder at `~/.agent-env/workspaces/<repo>-<instance>/`

| Layer | Source of Truth | Persistence |
|-------|-----------------|-------------|
| Instance existence | Workspace folder | Until explicitly removed |
| Instance metadata | `.agent-env/state.json` in workspace | Survives container removal |
| Runtime status | Container `ae-<workspace-name>` | Ephemeral - can be recreated |

**Naming Convention:**
- Workspace folder: `<repo>-<instance>` (e.g., `bmad-orch-auth`)
- Container: `ae-<workspace-name>` (e.g., `ae-bmad-orch-auth`)

**Instance States:**

| State | Workspace | Container | Meaning |
|-------|-----------|-----------|---------|
| running | Exists | Running | Active development |
| stopped | Exists | Stopped | Work preserved, not running |
| orphaned | Exists | Missing | Container removed, workspace intact |

**Key Insight:** Workspace is the durable artifact. Container is disposable runtime. This enables:
- `agent-env start <name>` spins up container for existing workspace
- Rebuilding containers without losing work
- Listing instances even when Docker is unavailable
- Clean separation of "what exists" from "what's running"

### Data Sources & State

| Data Need | Source | Method |
|-----------|--------|--------|
| Instance list | Filesystem | Scan `~/.agent-env/workspaces/` |
| Instance metadata | State file | `.agent-env/state.json` per workspace |
| Git state | Workspace | Git CLI in workspace directory |
| Runtime status | OrbStack/Docker | Container API (by name `ae-*`) |
| Container domain | OrbStack | `ae-<name>.orb.local` (when running) |

### Configuration & Image Versioning

| Config Type | Location | Versioning |
|-------------|----------|------------|
| Baseline devcontainer | Ships with npm package | Versioned with agent-env releases |
| Base Docker image | GHCR/Docker Hub | Tagged with agent-env version |
| User overrides | Future: `~/.agent-env/config/` | Post-MVP |

### Technical Decisions (From Party Mode Review)

| Decision | Rationale |
|----------|-----------|
| Assume OrbStack | macOS-first. Linux support deferred to post-MVP if demand exists |
| Detached HEAD blocks delete | Unusual state signals "investigate manually" - safety check prevents removal |
| Error states kept minimal | Add complexity when encountered in practice, not upfront |

### CLI Naming Convention

**Command:** `agent-env create <instance> --repo <repo-url|alias|.>`

| Input | Result |
|-------|--------|
| `create auth --repo https://github.com/user/bmad-orch` | Creates `bmad-orch-auth` |
| `create auth --repo .` | Infers repo from current directory's git remote |
| `create api` (in existing bmad-orch workspace) | Future: infer from context |

**Naming derivation:**
- `<instance>` = user-provided workstream identifier (e.g., `auth`, `api`, `bugfix`)
- `<repo>` = derived from repo URL (last path segment, minus `.git`)
- Workspace folder = `<repo>-<instance>`

**Future consideration:** Registered repo aliases for frequently-used repos (e.g., `bmad` → `bmad-orchestrator`)

### Safety Check Additions

| Check | Behavior |
|-------|----------|
| Detached HEAD | Blocks normal delete - requires `--force` |
| Never-pushed branches | Blocks normal delete - lists affected branches |

### Cross-Cutting Concerns Identified

1. **Git State Analysis** - Complex detection spanning staged, unstaged, untracked, stashed, unpushed on ALL branches including never-pushed
2. **Error Handling** - Partial failures must not block operations on healthy instances
3. **JSON Output Contract** - Consistent schema for scripting and future orchestrator
4. **Performance Targets** - Sub-second operations for list/attach to avoid friction
5. **Safety First** - Every destructive operation gated by comprehensive checks
6. **Image Versioning** - Base images must be versioned and published to registry for reproducibility

## Starter Template Evaluation

### Primary Technology Domain

**CLI Tool with TUI** - TypeScript-based command-line application with interactive terminal interface. Manages Docker containers using devcontainer specification.

### Framework Selection (Aligned with BMAD Orchestrator)

| Package | Version | Purpose |
|---------|---------|---------|
| commander | 14.0.2 | CLI argument parsing, subcommands |
| ink | 6.6.0 | React for TUI components |
| @inkjs/ui | 2.0.0 | Spinner, Select, ProgressBar |
| react | 19.x | Required by Ink 6 |
| typescript | 5.x | Type safety, strict mode |
| vitest | 4.x | Testing framework |
| ink-testing-library | latest | Ink component testing |
| execa | 9.x | Subprocess execution (`reject: false` pattern) |
| timeago.js | latest | Relative timestamp formatting ("2h ago") |

### Container Management Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| @devcontainers/cli | Official devcontainer CLI | `devcontainer up`, `devcontainer exec` |

**Decision:** Use `@devcontainers/cli` for container lifecycle (handles devcontainer.json complexity), shell out via execa for git operations.

### Initialization Commands

```bash
# Initialize project
pnpm init

# Core dependencies
pnpm add ink@6 react@19 commander@14 @inkjs/ui timeago.js

# Subprocess & container management
pnpm add execa@9
pnpm add @devcontainers/cli

# Dev dependencies - TypeScript
pnpm add -D typescript@5 @types/node @types/react tsx

# Dev dependencies - Testing
pnpm add -D vitest ink-testing-library

# Dev dependencies - Code Quality
pnpm add -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
pnpm add -D prettier eslint-config-prettier

# Optional: Git hooks
pnpm add -D husky lint-staged
```

### Configuration Files (Adopt from BMAD Orchestrator)

**tsconfig.json:**
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

**vitest.config.ts:**
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

**Package scripts:**
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
    "check": "pnpm type-check && pnpm lint && pnpm test:run"
  }
}
```

### Project Structure

```
agent-env/
├── src/
│   ├── cli.ts                    # Entry point, Commander setup
│   ├── cli.test.ts
│   ├── lib/
│   │   ├── __fixtures__/         # Test fixtures
│   │   │   ├── docker-list.json
│   │   │   └── state.json
│   │   ├── types.ts              # Shared types
│   │   ├── workspace.ts          # Workspace folder operations
│   │   ├── workspace.test.ts
│   │   ├── container.ts          # Docker/devcontainer operations
│   │   ├── container.test.ts
│   │   ├── git.ts                # Git state detection
│   │   ├── git.test.ts
│   │   └── errors.ts             # Error formatting
│   ├── hooks/
│   │   ├── useAgentEnv.ts        # Main state hook
│   │   └── useAgentEnv.test.ts
│   ├── components/
│   │   ├── InstanceList.tsx
│   │   ├── InstanceList.test.tsx
│   │   ├── InteractiveMenu.tsx
│   │   └── StatusIndicator.tsx
│   └── commands/
│       ├── create.ts
│       ├── list.ts
│       ├── attach.ts
│       ├── remove.ts
│       └── purpose.ts
├── config/
│   └── baseline/
│       ├── devcontainer.json     # Base devcontainer config
│       └── Dockerfile            # Base image definition
├── .github/workflows/ci.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── eslint.config.js
```

### Devcontainer Integration Architecture

```
agent-env create <instance> --repo <url>
    │
    ├── 1. Clone repo to ~/.agent-env/workspaces/<repo>-<instance>/
    │
    ├── 2. Copy baseline devcontainer.json if no .devcontainer/ exists
    │
    ├── 3. Run: devcontainer up --workspace-folder <workspace>
    │       └── Handles: image build, feature install, container creation
    │
    └── 4. Write .agent-env/state.json with metadata
```

**Note:** Project initialization with full tooling is the first implementation story. Tests and CI should pass before any feature code is written.

## Existing Infrastructure (Current State)

**IMPORTANT:** This section documents what EXISTS in the codebase as of 2026-01-27. The agent-env CLI will be added to this existing infrastructure.

### Current Package

```json
{
  "name": "@zookanalytics/bmad-orchestrator",
  "version": "0.1.0",
  "bin": {
    "bmad-orchestrator": "./bin/bmad-orchestrator.js"
  }
}
```

### Current Directory Structure

```
bmad-orchestrator/                    # EXISTING repo
├── src/
│   ├── cli.ts                        # Orchestrator entry point
│   ├── cli.test.ts
│   ├── commands/
│   │   ├── list.ts                   # DevPod list command
│   │   └── list.test.ts
│   ├── lib/
│   │   ├── types.ts                  # DevPod types (DevPod, DevPodStatus, etc.)
│   │   ├── types.test.ts
│   │   ├── discovery.ts              # DevPod discovery logic
│   │   ├── discovery.test.ts
│   │   └── __fixtures__/
│   │       ├── devPodList.json
│   │       ├── devPodListEmpty.json
│   │       └── devPodListError.json
│   ├── components/                   # Empty (scaffolded)
│   ├── hooks/                        # Empty (scaffolded)
│   └── types/                        # Empty (scaffolded)
├── bin/
│   └── bmad-orchestrator.js
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
└── .github/workflows/                # CI already configured
```

### Existing Dependencies (Already Installed)

| Package | Version | Status |
|---------|---------|--------|
| commander | 14.0.2 | ✅ Installed |
| ink | 6.6.0 | ✅ Installed |
| @inkjs/ui | 2.0.0 | ✅ Installed |
| react | 19.2.3 | ✅ Installed |
| execa | 9.6.1 | ✅ Installed |
| vitest | 4.0.17 | ✅ Installed |
| ink-testing-library | 4.0.0 | ✅ Installed |
| typescript | 5.9.3 | ✅ Installed |
| timeago.js | 4.0.2 | ✅ Installed |

### What Does NOT Exist Yet

- `src/shared/` directory (no shared utilities extracted)
- `src/agent-env/` directory
- Nested CLI structure (current is flat)
- `@devcontainers/cli` dependency (agent-env specific)

## Core Architectural Decisions

### Decision Priority Analysis

**Already Decided (From Previous Steps):**
- CLI Framework: Commander 14.0.2
- TUI Framework: Ink 6.6.0 + @inkjs/ui 2.0.0
- Container Management: @devcontainers/cli
- Testing: Vitest + ink-testing-library
- Subprocess: execa 9.x with `reject: false`
- Instance Model: Workspace folder as atomic unit

**Critical Decisions (Made This Step):**
- State Management: Single `useAgentEnv` hook
- Git Detection: Shell out to git CLI via execa
- Error Handling: `formatError()` pattern
- Testing Strategy: BMAD patterns (DI, co-located, fixtures)

**Revised Decision - Package Structure:**
- Keep existing `@zookanalytics/bmad-orchestrator` package name
- Add agent-env as `src/agent-env/` alongside existing flat orchestrator code
- Create `src/shared/` for utilities that benefit both CLIs
- Add second bin entry for `agent-env`
- Restructure orchestrator into `src/orchestrator/` for consistency (optional, can defer)

**Deferred Decisions (Post-MVP):**
- Repo-specific config overrides
- Linux/Docker Desktop support
- Registered repo aliases
- `agent-env repair` command for state recovery
- Full restructure of orchestrator code into nested structure

### Package Architecture

**Monorepo Structure:** pnpm workspaces with separate packages

**Packages:**
- `@zookanalytics/bmad-orchestrator` - Orchestrator CLI (existing, will be moved)
- `@zookanalytics/agent-env` - agent-env CLI (new)
- `@zookanalytics/shared` - Shared utilities (new, internal)

```
bmad-orchestrator/                    # Repo root
├── package.json                      # Workspace root
├── pnpm-workspace.yaml
├── packages/
│   ├── orchestrator/                 # @zookanalytics/bmad-orchestrator
│   │   ├── package.json
│   │   └── src/
│   ├── agent-env/                    # @zookanalytics/agent-env
│   │   ├── package.json
│   │   └── src/
│   └── shared/                       # @zookanalytics/shared (internal)
│       ├── package.json
│       └── src/
```

**Root package.json (workspace):**
```json
{
  "name": "bmad-orchestrator-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "dev:orchestrator": "pnpm --filter @zookanalytics/bmad-orchestrator dev",
    "dev:agent-env": "pnpm --filter @zookanalytics/agent-env dev"
  }
}
```

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
```

**Package dependencies:**
```
@zookanalytics/bmad-orchestrator
  └── @zookanalytics/shared

@zookanalytics/agent-env
  └── @zookanalytics/shared
```

**Note:** Epic 1 includes restructuring existing orchestrator code into `packages/orchestrator/` to establish the monorepo pattern before adding agent-env.

### State Management

**Decision:** Single hook pattern per CLI

| CLI | Hook | Pattern |
|-----|------|---------|
| agent-env | `useAgentEnv` | useReducer + useEffect |
| bmad-orchestrator | `useOrchestrator` | useReducer + useEffect |

### Git State Detection

**Decision:** Shell out to git CLI via execa

| Check | Command |
|-------|---------|
| Staged/unstaged/untracked | `git status --porcelain` |
| Stashed changes | `git stash list` |
| Branch tracking | `git branch -vv` |
| Unpushed commits | `git rev-list @{u}..HEAD` |
| Detached HEAD | `git symbolic-ref HEAD` (fails if detached) |
| Never-pushed branches | Parse `git branch -vv` for no upstream |

**Performance optimization:** Cache git state with TTL during single CLI invocation. Run independent git commands in parallel where possible.

### Error Handling

**Decision:** Adopt `formatError()` pattern from shared module

**Error codes for agent-env:**
- `SAFETY_CHECK_FAILED` - Git state blocks operation
- `WORKSPACE_NOT_FOUND` - Instance doesn't exist
- `CONTAINER_ERROR` - Docker/devcontainer failure
- `GIT_ERROR` - Git command failed
- `ORBSTACK_REQUIRED` - OrbStack not running/installed

### Testing Strategy

**Decision:** Adopt BMAD Orchestrator patterns

| Aspect | Approach |
|--------|----------|
| Subprocess | Dependency injection |
| Fixtures | `lib/__fixtures__/` from Day 1 |
| Location | Co-located `*.test.ts` |
| Components | ink-testing-library + vi.mock |
| CI | Quality gates before feature code |

**Test priority:**

| Module | Priority | Coverage |
|--------|----------|----------|
| `shared/*` | Critical | 100% |
| `agent-env/lib/git.ts` | Critical | 90%+ |
| `agent-env/lib/workspace.ts` | Critical | 90%+ |
| `agent-env/lib/container.ts` | High | 80%+ |
| `agent-env/hooks/` | High | 80%+ |
| `agent-env/components/` | Medium | Key interactions |

**Git edge case test matrix:**
- Clean repo, dirty repo
- Unpushed on current branch, unpushed on other branches
- Never-pushed branches
- Stashed changes (single, multiple)
- Detached HEAD
- Multi-branch scenarios

### Risk Mitigations (From Pre-mortem Analysis)

| Risk | Prevention | Priority |
|------|------------|----------|
| Slow create | Pre-built base image on GHCR, caching strategy | High |
| Missed git state | Comprehensive test matrix for all git edge cases | Critical |
| Shared code breakage | CI runs ALL tests when `shared/` changes | High |
| OrbStack assumption | Clear `ORBSTACK_REQUIRED` error, document in README | Medium |
| State file corruption | Atomic writes (tmp + rename), validation on read, graceful degradation | High |

### Architectural Patterns (From Graph Analysis)

**Critical Path: git.ts**
- On critical path for list, remove, status commands
- Must be fast (parallel git commands), correct (zero false negatives), well-tested
- Consider caching git state with TTL during single invocation

**External Dependency Chain:**
```
agent-env → devcontainer CLI → Docker/OrbStack → Base Image (GHCR)
```
Each layer needs: version requirements, clear error messages, timeout handling

**Shared Code Interface Contract:**
- `shared/` modules must have explicit TypeScript interfaces
- CI triggers all test suites when `shared/` changes
- Breaking changes require updating both CLIs

**State File Handling:**
- Atomic writes: write to `.state.json.tmp`, then rename
- JSON schema validation on read
- Graceful degradation: invalid state shows "unknown state"
- Last-write-wins (no file locking for MVP)

### External Dependency Matrix

| Dependency | Required Version | Detection | Error Code |
|------------|-----------------|-----------|------------|
| Node.js | 20+ | `process.version` | `NODE_VERSION_ERROR` |
| OrbStack | Any | `orb version` or socket check | `ORBSTACK_REQUIRED` |
| git | 2.x | `git --version` | `GIT_NOT_FOUND` |
| devcontainer CLI | Latest | `devcontainer --version` | `DEVCONTAINER_NOT_FOUND` |

### Image Caching Strategy

**Base image:** `ghcr.io/zookanalytics/agent-env-base:<version>`

**Create flow:**
1. Check if base image exists locally
2. If not, pull from GHCR (one-time)
3. `devcontainer up` uses cached base layers
4. Only rebuild on `--no-cache` or version bump

**CI publishes:** Base image on release, tagged with agent-tools version

## Implementation Patterns & Consistency Rules

### Pattern Summary

All patterns aligned with BMAD Orchestrator for single-package consistency.

### Naming Patterns

**File Naming:**

| Type | Convention | Example |
|------|------------|---------|
| React components | PascalCase.tsx | `InstanceList.tsx` |
| Lib modules | lowercase.ts | `workspace.ts`, `git.ts` |
| Tests | Co-located .test.ts | `workspace.test.ts` |
| Types | types.ts per module | `lib/types.ts` |
| Fixtures | camelCase.json | `instanceList.json` |

**Code Naming:**

| Type | Convention | Example |
|------|------------|---------|
| Functions | camelCase | `getGitState()`, `listInstances()` |
| Variables | camelCase | `instanceList`, `gitState` |
| Constants | SCREAMING_SNAKE | `DEFAULT_TIMEOUT`, `MAX_RETRIES` |
| Types/Interfaces | PascalCase | `Instance`, `GitState`, `AppError` |
| Reducer actions | SCREAMING_SNAKE | `INSTANCES_LOAD_START`, `INSTANCE_SELECT` |

**JSON Fields:**

| Context | Convention | Example |
|---------|------------|---------|
| state.json | camelCase | `{ "lastAttached": "...", "gitState": {...} }` |
| --json output | camelCase | `{ "ok": true, "data": [...] }` |
| Error objects | camelCase | `{ "code": "...", "message": "..." }` |

### Structure Patterns

**Project Organization (Actual Implementation):**

The implementation evolved to use orchestration modules in `lib/` instead of React hooks. This provides better testability and separation of concerns.

```
packages/
├── agent-env/
│   ├── src/
│   │   ├── cli.ts               # Entry point, Commander setup
│   │   ├── cli.test.ts
│   │   ├── lib/                 # Pure business logic & orchestration
│   │   │   ├── types.ts         # Shared types (GitState, InstanceState, etc.)
│   │   │   ├── workspace.ts     # Workspace folder operations
│   │   │   ├── state.ts         # State file management (atomic writes)
│   │   │   ├── container.ts     # Docker/devcontainer lifecycle
│   │   │   ├── git.ts           # Git state detection
│   │   │   ├── devcontainer.ts  # Devcontainer config handling
│   │   │   ├── completion.ts    # Shell completion generation
│   │   │   ├── interactive-menu.ts  # Interactive menu logic
│   │   │   ├── create-instance.ts   # Create orchestration
│   │   │   ├── attach-instance.ts   # Attach orchestration
│   │   │   ├── list-instances.ts    # List orchestration
│   │   │   ├── purpose-instance.ts  # Purpose orchestration
│   │   │   ├── remove-instance.ts   # Remove orchestration with safety checks
│   │   │   ├── safety-report.ts     # Safety check formatting with severity tags
│   │   │   ├── audit-log.ts         # Force-remove audit logging (JSON Lines)
│   │   │   └── *.test.ts        # Co-located tests
│   │   ├── components/          # Ink React components
│   │   │   ├── InstanceList.tsx
│   │   │   ├── InteractiveMenu.tsx
│   │   │   └── StatusIndicator.tsx
│   │   └── commands/            # Commander subcommands
│   │       ├── create.ts
│   │       ├── list.ts
│   │       ├── attach.ts
│   │       ├── remove.ts        # Remove with --force/--yes flags
│   │       ├── purpose.ts
│   │       └── completion.ts
│   └── config/
│       └── baseline/            # Baseline devcontainer config
│           ├── devcontainer.json
│           ├── Dockerfile
│           ├── post-create.sh
│           ├── init-host.sh
│           └── git-config
├── orchestrator/                # bmad-orchestrator CLI (same structure)
└── shared/                      # Cross-CLI utilities
    └── src/
        ├── index.ts
        ├── errors.ts
        ├── subprocess.ts
        └── types.ts
```

**Note:** The `hooks/` directory was not implemented. Instead, orchestration logic lives in `lib/*-instance.ts` modules which are called directly by commands and components. This provides equivalent functionality with better testability through dependency injection.

**Import Order (ESLint enforced):**
1. Node built-ins (`node:fs`, `node:path`)
2. External packages (`execa`, `ink`, `react`)
3. Internal shared (`../shared/errors.js`)
4. Local imports (`./hooks/useAgentEnv.js`)

### Format Patterns

**JSON Output Contract (--json flag):**
```typescript
interface JsonOutput<T> {
  ok: boolean;
  data: T | null;
  error: AppError | null;
}

// Success
{ "ok": true, "data": [...], "error": null }

// Failure
{ "ok": false, "data": null, "error": { "code": "...", "message": "..." } }
```

**State File Schema (.agent-env/state.json):**
```typescript
interface InstanceState {
  name: string;           // "bmad-orch-auth"
  repo: string;           // Git remote URL
  createdAt: string;      // ISO 8601
  lastAttached: string;   // ISO 8601
  purpose: string | null; // User-provided description
  containerName: string;  // "ae-bmad-orch-auth"
}
```

**Error Format:**
```typescript
interface AppError {
  code: string;           // "SAFETY_CHECK_FAILED"
  message: string;        // Human-readable description
  suggestion?: string;    // "Run `git status` to see changes"
}
```

### State Management Patterns

**Implementation Note:** The original architecture specified a React hooks pattern (`useAgentEnv` with `useReducer`). The actual implementation uses orchestration modules with dependency injection instead. This provides equivalent functionality with better testability.

**Orchestration Module Pattern (Actual Implementation):**
```typescript
// Each operation has a dedicated orchestration module
// e.g., lib/attach-instance.ts

export interface AttachInstanceDeps {
  executor: Execute;
  container: ContainerLifecycle;
  workspaceFsDeps: FsDeps;
  stateFsDeps: StateFsDeps;
}

export async function attachInstance(
  instanceName: string,
  deps: AttachInstanceDeps
): Promise<AttachResult> {
  // 1. Find workspace
  // 2. Check Docker availability
  // 3. Check/start container
  // 4. Attach to tmux
  // 5. Update state
}
```

**Factory Pattern for Dependencies:**
```typescript
export function createAttachDefaultDeps(): AttachInstanceDeps {
  const executor = createExecutor();
  return {
    executor,
    container: createContainerLifecycle(executor),
    workspaceFsDeps: { mkdir, readdir, stat, homedir },
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
  };
}
```

This pattern enables:
- Full testability through dependency injection
- Clear separation of concerns
- No React dependency for core logic
- Easy mocking of filesystem and subprocess operations

### Process Patterns

**Subprocess Execution:**
```typescript
// Always use reject: false, handle errors in return value
const result = await execa('git', ['status', '--porcelain'], {
  cwd: workspacePath,
  timeout: 5000,
  reject: false,
});

if (result.failed) {
  return { ok: false, error: { code: 'GIT_ERROR', message: result.stderr } };
}
```

**Atomic File Writes:**
```typescript
// Write to temp, then rename
const tempPath = `${statePath}.tmp`;
await fs.writeFile(tempPath, JSON.stringify(state, null, 2));
await fs.rename(tempPath, statePath);
```

### Enforcement Guidelines

**All AI Agents MUST:**
1. Follow file naming conventions (PascalCase components, lowercase lib)
2. Use camelCase for all JSON fields
3. Use SCREAMING_SNAKE for reducer actions with domain prefix
4. Co-locate tests with source files
5. Use dependency injection for subprocess mocking
6. Return `{ ok, data, error }` for --json output
7. Use `formatError()` from shared for error display
8. Follow import ordering (enforced by ESLint)

**Pattern Verification:**
- ESLint enforces naming and import order
- TypeScript enforces interface contracts
- CI runs all tests on shared/ changes
- PR review checks pattern compliance

## Project Structure & Boundaries

### Target Project Directory Structure (pnpm Workspaces)

**Note:** This shows the TARGET state after monorepo restructure. See "Existing Infrastructure" section for CURRENT state.

```
bmad-orchestrator/                    # Repo root (workspace root)
├── README.md
├── CONTRIBUTING.md
├── package.json                      # Workspace root (private)
├── pnpm-workspace.yaml               # NEW
├── pnpm-lock.yaml
├── tsconfig.base.json                # Shared TS config
├── vitest.workspace.ts               # Workspace-level vitest config
├── .eslintrc.js                      # Shared ESLint config
├── .prettierrc
├── .gitignore
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # Runs all package tests
│
├── packages/
│   │
│   │  # ═══════════════════════════════════════════════════
│   │  # SHARED UTILITIES (internal package)
│   │  # ═══════════════════════════════════════════════════
│   ├── shared/
│   │   ├── package.json              # @zookanalytics/shared
│   │   ├── tsconfig.json             # Extends base
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types.ts              # AppError, JsonOutput
│   │       ├── errors.ts             # formatError()
│   │       ├── errors.test.ts
│   │       ├── subprocess.ts         # execa patterns
│   │       └── subprocess.test.ts
│   │
│   │  # ═══════════════════════════════════════════════════
│   │  # ORCHESTRATOR CLI (restructured from root src/)
│   │  # ═══════════════════════════════════════════════════
│   ├── orchestrator/
│   │   ├── package.json              # @zookanalytics/bmad-orchestrator
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── bin/
│   │   │   └── bmad-orchestrator.js
│   │   └── src/
│   │       ├── cli.ts                # MOVED from root src/
│   │       ├── cli.test.ts
│   │       ├── commands/
│   │       │   ├── list.ts
│   │       │   └── list.test.ts
│   │       ├── lib/
│   │       │   ├── types.ts
│   │       │   ├── discovery.ts
│   │       │   ├── discovery.test.ts
│   │       │   └── __fixtures__/
│   │       ├── components/
│   │       └── hooks/
│   │
│   │  # ═══════════════════════════════════════════════════
│   │  # AGENT-ENV CLI (new package)
│   │  # ═══════════════════════════════════════════════════
│   └── agent-env/
│       ├── package.json              # @zookanalytics/agent-env
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── bin/
│       │   └── agent-env.js
│       └── src/
│           ├── index.ts
│           ├── cli.ts
│           ├── cli.test.ts
│           ├── lib/
│           │   ├── __fixtures__/
│           │   │   ├── instanceList.json
│           │   │   ├── stateValid.json
│           │   │   ├── gitStatusClean.txt
│           │   │   └── gitBranchVV.txt
│           │   ├── types.ts
│           │   ├── workspace.ts
│           │   ├── workspace.test.ts
│           │   ├── container.ts
│           │   ├── container.test.ts
│           │   ├── git.ts
│           │   ├── git.test.ts
│           │   ├── state.ts
│           │   └── state.test.ts
│           ├── hooks/
│           │   ├── useAgentEnv.ts
│           │   └── useAgentEnv.test.ts
│           ├── components/
│           │   ├── InstanceList.tsx
│           │   ├── InteractiveMenu.tsx
│           │   ├── SafetyPrompt.tsx
│           │   └── StatusIndicator.tsx
│           └── commands/
│               ├── create.ts
│               ├── list.ts
│               ├── attach.ts
│               ├── remove.ts
│               └── purpose.ts
│
├── config/
│   └── baseline/                     # agent-env baseline devcontainer
│       ├── devcontainer.json
│       ├── Dockerfile
│       └── features.json
│
└── docs/
    ├── orchestrator.md
    └── agent-env.md
```

### Package Configuration

**Root package.json (workspace root):**
```json
{
  "name": "bmad-orchestrator-monorepo",
  "private": true,
  "packageManager": "pnpm@10.x",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test:run",
    "test:watch": "pnpm -r test",
    "lint": "pnpm -r lint",
    "check": "pnpm -r check",
    "dev:orchestrator": "pnpm --filter @zookanalytics/bmad-orchestrator dev",
    "dev:agent-env": "pnpm --filter @zookanalytics/agent-env dev"
  },
  "devDependencies": {
    "typescript": "^5.x"
  }
}
```

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
```

**packages/shared/package.json:**
```json
{
  "name": "@zookanalytics/shared",
  "private": true,
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

**packages/orchestrator/package.json:**
```json
{
  "name": "@zookanalytics/bmad-orchestrator",
  "version": "0.1.0",
  "bin": {
    "bmad-orchestrator": "./bin/bmad-orchestrator.js"
  },
  "dependencies": {
    "@zookanalytics/shared": "workspace:*"
  }
}
```

**packages/agent-env/package.json:**
```json
{
  "name": "@zookanalytics/agent-env",
  "version": "0.1.0",
  "bin": {
    "agent-env": "./bin/agent-env.js"
  },
  "dependencies": {
    "@zookanalytics/shared": "workspace:*",
    "@devcontainers/cli": "^0.x"
  }
}
```

### Public API Exports

**agent-env/index.ts:**
```typescript
// Types (for orchestrator or external integration)
export type { Instance, GitState, InstanceState } from './lib/types.js';

// Functions (programmatic use)
export { getGitState } from './lib/git.js';
export { scanWorkspaces } from './lib/workspace.js';
```

**shared/index.ts:**
```typescript
export { formatError } from './errors.js';
export type { AppError, JsonOutput } from './types.js';
export { createExecutor } from './subprocess.js';
```

### FR to Structure Mapping (agent-env)

| FR Category | Files |
|-------------|-------|
| FR1-6: Instance Lifecycle | `commands/create.ts`, `remove.ts`, `start.ts`, `stop.ts` |
| FR7-11: Discovery & Status | `lib/workspace.ts`, `lib/git.ts`, `commands/list.ts` |
| FR12-14: Instance Access | `commands/attach.ts` |
| FR15-18: State & Metadata | `lib/state.ts`, `commands/purpose.ts` |
| FR19-26: Safety & Data Protection | `lib/git.ts`, `components/SafetyPrompt.tsx` |
| FR27-33: Configuration | `config/baseline/*`, `lib/container.ts` |
| FR34-38: CLI Interface | `cli.ts`, `components/InteractiveMenu.tsx` |
| FR39-42: Installation | `package.json`, `bin/agent-env.js` |

### Architectural Boundaries

**Layer Responsibilities:**

| Layer | Location | Responsibility | Can Import |
|-------|----------|----------------|------------|
| CLI Entry | `cli.ts` | Commander setup, arg parsing | commands, components |
| Commands | `commands/` | Validate input, call lib, format output | lib, shared |
| Components | `components/` | Ink UI rendering | hooks, lib/types |
| Hooks | `hooks/` | State management, effects | lib |
| Lib | `lib/` | Pure business logic | shared only |
| Shared | `shared/` | Cross-CLI utilities | nothing internal |

**Dependency Rule:** Lower layers never import from higher layers.

### Shared Code Governance

**Ownership:** Changes to `shared/` require review from both CLI maintainers.

**CI Enforcement:** When `shared/` changes, CI runs ALL tests (both CLIs).

### Development Workflow

**Adding a new agent-env command:**
1. Create `src/agent-env/commands/foo.ts`
2. Create `src/agent-env/commands/foo.test.ts`
3. Register in `src/agent-env/cli.ts`
4. Run `pnpm test:agent-env`

**Adding shared code:**
1. Add to `src/shared/`
2. Export from `src/shared/index.ts`
3. Run `pnpm test` (all tests)

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices verified compatible. Commander + Ink + execa proven in BMAD Orchestrator. Single package structure supports both CLIs.

**Pattern Consistency:** 100% alignment with BMAD Orchestrator patterns. Same JSON output format, error handling, state management, naming conventions.

**Structure Alignment:** Layered architecture (lib → hooks → components → commands) enforces clean dependencies. Shared code isolated with governance rules.

### Requirements Coverage ✅

**Functional Requirements:** 42/42 FRs have explicit architectural support mapped to specific files.

**Non-Functional Requirements:** 21/21 NFRs addressed:
- Performance: Parallel git commands, caching, pre-built images
- Reliability: Atomic writes, comprehensive git checks, graceful degradation
- Compatibility: OrbStack + devcontainer CLI
- Maintainability: DI pattern, co-located tests, clear boundaries

### Implementation Readiness ✅

**Ready for AI agents to implement consistently:**
- All decisions documented with exact versions
- Implementation patterns comprehensive with examples
- Project structure complete (50+ files specified)
- Enforcement via ESLint, TypeScript, CI

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (Low-Medium)
- [x] Technical constraints identified (OrbStack, devcontainer, TypeScript)
- [x] Cross-cutting concerns mapped (git detection, error handling, JSON output)

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined (devcontainer CLI, OrbStack)
- [x] Performance considerations addressed (caching, parallel execution)

**✅ Implementation Patterns**
- [x] Naming conventions established (files, JSON, actions)
- [x] Structure patterns defined (layered architecture)
- [x] Communication patterns specified (JSON output contract)
- [x] Process patterns documented (error handling, atomic writes)

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established (lib/hooks/components/commands)
- [x] Integration points mapped (shared/ governance)
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
- Full alignment with proven BMAD Orchestrator patterns
- Workspace-as-atomic-unit model is clean and robust
- Comprehensive safety checks for git state
- Single package simplifies adoption

**Areas for Future Enhancement:**
- Linux/Docker Desktop support (post-MVP)
- Registered repo aliases
- Config file overrides per-repo
- `agent-env repair` command for state recovery

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Run `pnpm check` before every commit
- Refer to this document for all architectural questions

**First Implementation Priority:**
1. Initialize project with `pnpm init`
2. Install dependencies per Starter Template section
3. Set up CI workflow (must pass before feature code)
4. Create `shared/errors.ts` and `shared/subprocess.ts` first
5. Then proceed to agent-env lib modules

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-27
**Document Location:** `_bmad-output/planning-artifacts/architecture-agent-env.md`

### Final Architecture Deliverables

**Complete Architecture Document**
- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**
- 15+ architectural decisions made
- 8+ implementation pattern categories defined
- 50+ files specified in project structure
- 42 FRs + 21 NFRs fully supported

**AI Agent Implementation Guide**
- Technology stack with verified versions (Commander 14.0.2, Ink 6.6.0, etc.)
- Consistency rules that prevent implementation conflicts
- Project structure with clear layer boundaries
- Integration patterns and JSON output contract

### Quality Assurance Checklist

**✅ Architecture Coherence**
- [x] All decisions work together without conflicts
- [x] Technology choices are compatible (proven in BMAD Orchestrator)
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**
- [x] All 42 functional requirements are supported
- [x] All 21 non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined

**✅ Implementation Readiness**
- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

### Project Success Factors

**Clear Decision Framework**
Every technology choice was made collaboratively with clear rationale. Monorepo with `@zookanalytics/agent-env`, `@zookanalytics/bmad-orchestrator`, and `@zookanalytics/shared` provides clean separation with shared foundations.

**Consistency Guarantee**
Implementation patterns align 100% with BMAD Orchestrator. Multiple AI agents produced compatible, consistent code across all 5 epics.

**Complete Coverage**
All project requirements are architecturally supported, with clear mapping from FRs to specific files.

**Solid Foundation**
Workspace-as-atomic-unit model provides clean separation of durable state (workspace folders) from ephemeral compute (containers).

---

**Architecture Status:** ✅ IMPLEMENTATION COMPLETE (All 5 Epics)

**Completed:** 2026-02-06. All epics (1-5) delivered. See Implementation Status section for drift log and known limitations.

**Document Maintenance:** Update this architecture when post-MVP enhancements or new epics introduce architectural changes.

---

## Implementation Status (Updated 2026-02-06)

This section tracks actual implementation against the architecture to identify drift and maintain alignment.

### Epic Implementation Status

| Epic | Status | Notes |
|------|--------|-------|
| Epic 1: Monorepo Setup | ✅ Complete | pnpm workspaces, shared package, agent-env scaffold |
| Epic 2: Instance Creation | ✅ Complete | create command, baseline devcontainer, container lifecycle |
| Epic 3: Instance Discovery & Git State | ✅ Complete | list command, git state detection, JSON output |
| Epic 4: Instance Access & Management | ✅ Complete | attach, purpose, interactive menu, shell completion |
| Epic 5: Safe Instance Removal | ✅ Complete | remove command with safety checks, force-remove, audit log |

### Architecture Drift Log

**Drift #1: Hooks Pattern → Orchestration Modules** (Epics 2-4)
- Original: `hooks/useAgentEnv.ts` with React useReducer pattern
- Actual: `lib/*-instance.ts` orchestration modules with dependency injection
- Rationale: Better testability, no React dependency for core logic
- Impact: Positive - improved separation of concerns

**Drift #2: Additional Lib Modules** (Epics 2-4)
- Original: workspace.ts, container.ts, git.ts, state.ts
- Actual: Added devcontainer.ts, completion.ts, interactive-menu.ts, and orchestration modules
- Rationale: Emerged from implementation needs
- Impact: Neutral - follows same patterns

**Drift #3: Baseline Config Files** (Epic 2)
- Original: devcontainer.json, Dockerfile, features.json
- Actual: devcontainer.json, Dockerfile, post-create.sh, init-host.sh, git-config
- Rationale: Shell scripts needed for proper container initialization
- Impact: Positive - better container setup

**Drift #4: SafetyPrompt Component → safety-report Module** (Epic 5)
- Original: `components/SafetyPrompt.tsx` React component specified
- Actual: Implemented as `lib/safety-report.ts` text-based module with `formatSafetyReport()` and `getSuggestions()`
- Rationale: Consistent with Drift #1 — orchestration logic lives in `lib/` modules, not React components. Safety output is formatted terminal text, not interactive UI
- Impact: Positive — follows established lib-first pattern, better testability

**Drift #5: New Modules for Epic 5** (Epic 5)
- Original: Only `remove-instance.ts` and `SafetyPrompt.tsx` specified
- Actual: Added `lib/audit-log.ts` (force-remove audit logging) and `lib/safety-report.ts` (severity-tagged safety formatting with suggestions)
- Rationale: Clean separation of concerns — audit logging and safety formatting are distinct responsibilities
- Impact: Positive — follows DI pattern with `AuditLogDeps` and co-located tests

**Drift #6: GitState Type Limitations** (Epic 5)
- Original: Story 5.2 ACs expected file counts per type (staged/unstaged/untracked), unpushed commit counts per branch, and first stash message
- Actual: `GitState` from Epic 3 only provides booleans (`hasStaged`, `hasUnstaged`, `hasUntracked`) and arrays of branch names without counts
- Rationale: GitState was designed for Epic 3's list display (indicators only). Enriching it for detailed safety reports would require upstream changes to `git.ts`
- Impact: Minor — safety report shows presence/absence rather than counts. Functionally sufficient for safety blocking decisions. Enhancement candidate for post-MVP
- Status: Documented as known limitation in Story 5.2

### Epic 5 Implementation Checklist (Completed 2026-02-06)

**Existing Modules Used:**
- [x] `lib/git.ts` - Full git state detection (staged, unstaged, untracked, stashed, unpushed, never-pushed, detached HEAD)
- [x] `lib/workspace.ts` - Workspace path resolution, scanning, and deletion (`deleteWorkspace()`)
- [x] `lib/state.ts` - State file reading
- [x] `lib/container.ts` - Container status, stop (`containerStop()`), and remove (`containerRemove()`)

**New Modules Delivered:**
- [x] `lib/remove-instance.ts` - Remove orchestration with safety checks and force mode
- [x] `lib/safety-report.ts` - Severity-tagged safety report formatting with actionable suggestions (replaces planned `SafetyPrompt.tsx`)
- [x] `lib/audit-log.ts` - Force-remove audit logging to `~/.agent-env/audit.log` (JSON Lines)
- [x] `commands/remove.ts` - Full CLI command with `--force` and `--yes` flags, interactive confirmation

**Container Functionality Added:**
- [x] `containerStop(containerName)` - `docker stop` with 30s timeout, idempotent
- [x] `containerRemove(containerName)` - `docker rm` with 10s timeout, idempotent

**Audit Log:**
- [x] `~/.agent-env/audit.log` - JSON Lines format tracking: timestamp, action, instanceName, gitState, confirmationMethod

## Architecture Update: PRD Revision (2026-02-14)

This section documents architectural decisions made in response to the 2026-02-14 PRD revision. These decisions supersede conflicting statements in earlier sections.

### PRD Deviations Identified

| PRD Statement | Architecture Decision | Action |
|---|---|---|
| FR27: Baseline "always" overrides repo `.devcontainer/` | Baseline override is opt-in via prompt or flag, not forced | PRD update required |
| "Environments, not containers" framing | Unintended by product owner. Tool manages containers. | PRD update required |

### Decision: Instance Naming Model (Revised)

**Supersedes:** "Naming Convention" in Project Context Analysis section.

**Previous model:** Compound name `<repo>-<instance>` as flat workspace identifier. User must type full compound name for all commands.

**New model:** Instance name is user-chosen, scoped to a repository. The unique key is `(repo-slug, instance-name)`.

**Workspace folder structure:**
```
~/.agent-env/workspaces/
├── bmad-orch/
│   ├── auth/
│   │   └── .agent-env/state.json
│   └── api/
│       └── .agent-env/state.json
└── awesome-cli/
    └── bugfix/
        └── .agent-env/state.json
```

**Repo slug derivation:** Last path segment of git remote URL, minus `.git`. Example: `https://github.com/user/bmad-orchestrator.git` → `bmad-orchestrator`.

**Repo slug compression:** If the derived slug exceeds 39 characters, apply deterministic compression:

```typescript
function compressSlug(slug: string): string {
  if (slug.length <= 39) return slug;
  const hash = createHash('sha256').update(slug).digest('hex').slice(0, 6);
  return `${slug.slice(0, 15)}_${hash}_${slug.slice(-15)}`;
}
```

Format: `<first 15 chars>_<6 char SHA-256 hex>_<last 15 chars>` = 38 characters max. Deterministic — same input always produces the same compressed slug. Underscores stand out visually against typical hyphenated repo names.

**Instance name constraints:** Maximum 20 characters. Validated at create time — reject with clear error if exceeded.

**Container naming:** `ae-<repo-slug>-<instance>` (flat string, internal only — user never types this). Maximum 63 characters enforced by Docker: `ae-` (3) + repo slug (≤39) + `-` (1) + instance (≤20) = 63.

**Known limitation:** Slug compression can theoretically collide if two repos share the same first 15 and last 15 characters but differ in the middle. Extremely unlikely for a single-user tool. Documented, not mitigated.

**Repo resolution for commands (two-phase):**

Phase 1 — Resolve repo context:

| Priority | Context | Resolution |
|---|---|---|
| 1 | `--repo` provided | Explicit — use provided repo |
| 2 | cwd is a git repo | Implicit — detect from `git remote get-url origin` |
| 3 | Neither | No repo context — proceed to phase 2 without scoping |

Phase 2 — Resolve instance:

| Repo Context | Instance Found | Result |
|---|---|---|
| Known (from phase 1) | Exists for that repo | Resolve directly |
| Known (from phase 1) | Not found for that repo | Fall through to global search |
| None or fell through | Unambiguous across all repos | Resolve to single match |
| None or fell through | Ambiguous (multiple repos) | Error: "Multiple instances named '<name>' exist. Specify --repo." |

**Key behavior:** cwd narrows the search scope but does not block resolution. If you're in the `awesome-cli` directory but `auth` only exists under `bmad-orch`, it resolves correctly.

**Command examples:**
```bash
# In a git repo directory
agent-env create auth                     # repo from cwd
agent-env attach auth                     # scoped to cwd repo
agent-env purpose auth "JWT work"         # scoped to cwd repo

# Explicit repo
agent-env create auth --repo https://...  # explicit URL
agent-env attach auth --repo bmad-orch    # explicit repo slug

# Not in a repo directory
agent-env attach auth                     # works if unambiguous
agent-env attach auth --repo bmad-orch    # explicit when ambiguous
```

**`list` behavior:** Always shows all instances across all repos. `--repo` flag available to filter.

**Instance scanning:** Scan `~/.agent-env/workspaces/*/` for repo-slug directories, then `~/.agent-env/workspaces/*/*/` for instance directories containing `.agent-env/state.json`.

### Decision: Baseline Config (Prompt with Flag Override)

**Supersedes:** FR27 interpretation in existing architecture ("copy if not exists").

**Behavior:**
- If cloned repo has **no** `.devcontainer/`: Apply agent-env baseline automatically (default, unchanged)
- If cloned repo **has** `.devcontainer/` and no flag provided: Prompt user — "This repo has a .devcontainer/ config. Use it, or apply agent-env baseline? [repo/baseline]"
- `--baseline` flag: Override repo config with agent-env baseline, no prompt
- `--no-baseline` flag: Use repo's config, no prompt
- When baseline is applied: Overwrite the repo's `.devcontainer/` contents. No backup.

**Create command signature update:**
```
agent-env create <name> [--repo <url|.>] [--attach] [--purpose <text>] [--baseline | --no-baseline]
```

Three states: force-baseline, force-repo-config, ask-user (default when repo has `.devcontainer/`).

### Decision: Purpose Propagation into Container

**New capability for:** FR47, FR48, FR49, FR50, NFR22, NFR23.

**Mechanism:** Bind-mount the workspace's `.agent-env/` directory to `/etc/agent-env/` inside the container (read-write).

**Single source of truth:** `/etc/agent-env/state.json` — the same `state.json` already managed by the host-side CLI. No duplicate files.

**Mount is read-write:** Purpose can be updated from both host and inside the container. Last-write-wins with atomic writes (tmp + rename). Concurrent write collisions are near-zero probability for a single-user tool with infrequent writes. Documented as known constraint.

**Devcontainer mount config:**
```json
{
  "mounts": [
    "source=${localWorkspaceFolder}/.agent-env,target=/etc/agent-env,type=bind"
  ]
}
```

**Container environment variables (set in devcontainer.json at creation):**
```json
{
  "containerEnv": {
    "AGENT_ENV_CONTAINER": "true",
    "AGENT_ENV_INSTANCE": "<instance-name>",
    "AGENT_ENV_REPO": "<repo-slug>"
  }
}
```

These env vars enable the CLI to detect it's running inside a container and resolve paths accordingly. The same env vars could technically be set on the host but have no expected use case there today.

**tmux status bar integration:**
- Reads instance name and purpose from `/etc/agent-env/state.json`
- Parsing method is a baseline config implementation detail (jq, helper script, or Node.js one-liner — all viable since Node.js is guaranteed in the container)
- tmux `status-interval` set to 15s to meet NFR23's 30-second requirement with margin

**Double-mount acknowledgment:** The `.agent-env/` directory is visible both within the workspace mount and at `/etc/agent-env/`. Intentional — the fixed path provides predictable access regardless of workspace folder nesting.

### Decision: agent-env CLI Inside Container

**Rationale:** Purpose updates involve a multi-step pipeline (state.json write + VS Code template processing). Maintaining two implementations (host script + in-container script) guarantees drift. One CLI, environment-aware.

**Installation:** `pnpm add -g @zookanalytics/agent-env` in baseline `post-create.sh`.

**Environment detection:**
```typescript
function isInsideContainer(): boolean {
  return process.env.AGENT_ENV_CONTAINER === 'true';
}

function resolveStatePath(): string {
  if (isInsideContainer()) {
    return '/etc/agent-env/state.json';
  }
  // Host path resolution via workspaces directory
  return path.join(homedir(), '.agent-env/workspaces', repoSlug, instance, '.agent-env/state.json');
}
```

**Purpose update pipeline (same logic on host and in container):**

```
agent-env purpose <name> "text"
  ├── 1. Update .agent-env/state.json (purpose field, atomic write)
  ├── 2. If .vscode/statusBar.template.json exists in workspace:
  │      Read template → replace {{PURPOSE}} → write .vscode/statusBar.json
  └── 3. tmux picks up state.json change on next status-interval refresh
        VS Code extension picks up statusBar.json change via file watcher
```

**VS Code template processing:**
- `.vscode/statusBar.template.json` is repo-specific content (checked in) — contains project-specific buttons, tasks, and `{{PURPOSE}}` placeholder
- `.vscode/statusBar.json` is generated output (gitignored) — VS Code extension watches this file
- Template varies per project; agent-env only performs the `{{PURPOSE}}` substitution
- If no template exists, this step is skipped silently

### Decision: Repo Registry (Growth — FR51-53)

**Approach:** Derive from existing workspaces. No separate registry file.

`agent-env repos` scans `~/.agent-env/workspaces/*/` directory names and cross-references with `state.json` for full URLs.

**Implication:** Once all instances for a repo are removed, that repo disappears from the list. Acceptable — the registry is a convenience shortcut, not a persistent record.

### Updated State Model

**InstanceState schema update:**
```typescript
interface InstanceState {
  instance: string;       // "auth" (user-chosen name, max 20 chars)
  repoSlug: string;       // "bmad-orch" (derived from URL, max 39 chars)
  repoUrl: string;        // Full git remote URL
  createdAt: string;      // ISO 8601
  lastAttached: string;   // ISO 8601
  purpose: string | null; // User-provided description
  containerName: string;  // "ae-bmad-orch-auth" (internal, max 63 chars)
}
```

**Instance states remain unchanged:**

| State | Workspace Dir | Container | Meaning |
|---|---|---|---|
| running | Exists | Running | Active development |
| stopped | Exists | Stopped | Work preserved, not running |
| orphaned | Exists | Missing | Container removed, workspace intact |

### Impact on Existing Architecture Sections

| Section | Impact |
|---|---|
| Instance Model / Naming Convention | Superseded by revised naming model above |
| Devcontainer Integration Architecture | Step 2 updated: baseline application depends on prompt/flag; mount is read-write |
| Container Management Dependencies | agent-env CLI now installed inside container via post-create |
| Project Structure (commands/) | `create.ts` gains `--baseline`/`--no-baseline` flag handling and prompt logic |
| Project Structure (lib/) | `workspace.ts` scanning changes from flat to nested; `compressSlug()` added |
| FR to Structure Mapping | FR3, FR43, FR46-50 mapped to updated modules |
| CLI Naming Convention | Superseded — instance name is no longer compound |
| State File Schema | Updated with revised field names and constraints |

### Architecture Update Validation (2026-02-14)

**Coherence:** All new decisions are compatible with existing architecture and with each other. Superseded sections clearly documented.

**Requirements Coverage:** 53/54 FRs fully covered. FR48 (`$AGENT_ENV_PURPOSE` env var) addressed via baseline shell init — implementation detail, no architectural change needed. All 24 NFRs covered.

**Gap Resolution:** FR48 resolved by adding `export AGENT_ENV_PURPOSE=...` to baseline shell init scripts. Purpose env var is set fresh per shell session from state.json.

**Implementation Readiness:** Update introduces 7 new architectural decisions, all with clear rationale, examples, and impact analysis. AI agents can implement from this document.

