---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
workflowType: 'research'
lastStep: 5
research_type: 'technical'
research_topic: 'container-mock-strategy'
research_goals: 'Define testing/mocking strategy for agent-env container operations given devcontainer constraints'
user_name: 'Node'
date: '2026-01-30'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical - Container Mock Strategy

**Date:** 2026-01-30
**Author:** Node
**Research Type:** Technical

---

## Research Overview

[Research overview and methodology will be appended here]

---

## Technical Research Scope Confirmation

**Research Topic:** Container Mock Strategy for agent-env
**Research Goals:** Define testing/mocking strategy for agent-env container operations given the constraint that development happens inside a devcontainer with no Docker or devcontainer CLI access during automated testing.

**Technical Research Scope:**

- Which functions need mocking — mapping all container operations in agent-env
- createExecutor() DI pattern usage — applying existing shared package pattern for container ops
- Fixture structure per operation — JSON format for devcontainer up/exec, docker ps/inspect, git clone, OrbStack commands
- Integration test strategy — human validation approach for operations requiring real Docker
- Example mock implementations — concrete code following established codebase patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights
- Grounded in existing codebase patterns from @zookanalytics/shared and orchestrator packages

**Scope Confirmed:** 2026-01-30

## Technology Stack Analysis

### Core Runtime & Testing Framework

The agent-env package uses **TypeScript** targeting Node.js 20+, with **Vitest** as the test runner. Vitest provides native ESM support, built-in mocking via `vi.fn()` / `vi.mock()`, and first-class TypeScript support without separate compilation.

_Test Configuration:_ Vitest with v8 coverage provider, `node` test environment, include pattern `src/**/*.test.ts`.
_Source: [Vitest Documentation](https://vitest.dev/guide/mocking)_

### Subprocess Execution: execa 9.x (ESM-only)

The codebase uses **execa 9.x** for all subprocess execution. Since execa v6+, the package is **ESM-only**, which impacts mocking strategy. The project wraps execa through `createExecutor()` in `@zookanalytics/shared/subprocess.ts`, providing dependency injection rather than module-level mocking.

_Key Characteristic:_ The `reject: false` pattern ensures subprocess failures return error results rather than throwing exceptions, making mock behavior deterministic.
_Source: [execa GitHub](https://github.com/sindresorhus/execa), [npm](https://www.npmjs.com/package/execa)_

### @devcontainers/cli

The **@devcontainers/cli** package is the reference implementation of the Dev Containers specification. Key commands relevant to agent-env:

| Command | Purpose | JSON Output |
|---------|---------|-------------|
| `devcontainer up --workspace-folder <path>` | Create and start container | `{ outcome: "success", containerId: "...", remoteUser: "...", remoteWorkspaceFolder: "..." }` |
| `devcontainer exec <cmd> [args]` | Execute command in container | `{ outcome: "success" }` |
| `devcontainer read-configuration` | Parse devcontainer.json | Configuration JSON (works without Docker) |
| `devcontainer build` | Build container image | Build result JSON |

_Important:_ `devcontainer up` requires Docker to be running. `read-configuration` is the only command that works without Docker access.
_Source: [devcontainers/cli GitHub](https://github.com/devcontainers/cli), [VS Code Docs](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli)_

### Docker CLI Operations

The agent-env tool invokes Docker CLI for container lifecycle management:

| Command | Purpose | Epic |
|---------|---------|------|
| `docker ps --filter name=ae-*` | List running containers | Epic 3 |
| `docker inspect <container>` | Get container details/status | Epic 3, 4 |
| `docker stop <container>` | Stop container (30s timeout) | Epic 5 |
| `docker stop <container> --force` | Force stop on timeout | Epic 5 |

_Source: [Docker CLI Reference](https://docs.docker.com/reference/cli/docker/)_

### OrbStack (macOS-specific)

OrbStack provides lightweight container runtime on macOS with automatic DNS routing (`*.orb.local`). Detection via `orb version` command. Agent-env containers use OrbStack labels for domain routing:

```
--label=dev.orbstack.domains=${name}.agenttools.local
--label=dev.orbstack.http-port=3000
```

_Source: Codebase `.devcontainer/devcontainer.json`, [OrbStack Documentation](https://docs.orbstack.dev/)_

### Git CLI Operations

Git commands are used for repository operations and safety checks:

| Command | Purpose | Epic |
|---------|---------|------|
| `git clone <url>` | Clone repository into workspace | Epic 2 |
| `git remote get-url origin` | Infer repo URL from cwd | Epic 2 |
| `git status --porcelain` | Staged/unstaged/untracked detection | Epic 3, 5 |
| `git stash list` | Stash detection | Epic 3, 5 |
| `git branch -vv` | Branch tracking info | Epic 3 |
| `git rev-list @{u}..HEAD` | Unpushed commits count | Epic 3, 5 |
| `git symbolic-ref HEAD` | Detached HEAD detection | Epic 3, 5 |

_Source: Codebase architecture document, PRD_

### Existing DI Pattern: createExecutor() + createDiscovery()

The codebase already establishes the factory-with-DI pattern in two places:

1. **`createExecutor(executor)`** in `packages/shared/src/subprocess.ts` — Low-level executor wrapper
2. **`createDiscovery(executor)`** in `packages/orchestrator/src/lib/discovery.ts` — Higher-level domain function

Both follow identical patterns: factory function accepts optional executor (defaults to execa), returns async function that never throws, errors in return value. Tests use `vi.fn().mockResolvedValue()` with typed casts.

_Fixture Convention:_ JSON files in `__fixtures__/` directories, imported with `import data from './__fixtures__/file.json' with { type: 'json' }`.
_Source: Codebase `packages/shared/src/subprocess.ts`, `packages/orchestrator/src/lib/discovery.ts`_

### Technology Adoption Trends

The project's approach aligns with current best practices for testing CLI tools with external dependencies:

- **DI over module mocking** [High Confidence] — The community consensus for ESM-only packages (execa 9.x) is constructor/factory injection over `vi.mock()`, avoiding hoisting complexity.
- **Never-throw pattern** [High Confidence] — Returning errors in result objects (vs throwing) is the dominant pattern in modern CLI tools, enabling deterministic test assertions.
- **JSON fixtures** [High Confidence] — Static fixture files with `import ... with { type: 'json' }` is the standard Vitest pattern for reproducible test data.

_Source: [Vitest Mocking Guide](https://vitest.dev/guide/mocking), [LogRocket Vitest Guide](https://blog.logrocket.com/advanced-guide-vitest-testing-mocking/)_

## Integration Patterns Analysis

### CLI-to-Function Integration Interfaces

Agent-env integrates with four external CLI tools. Each presents a distinct interface contract that must be captured in fixtures:

#### Devcontainer CLI Interface

The `devcontainer` CLI produces structured JSON on stdout. The integration contract:

| Operation | Command | Success stdout | Error stdout | Exit Code |
|-----------|---------|---------------|--------------|-----------|
| Create & start | `devcontainer up --workspace-folder <path>` | `{"outcome":"success","containerId":"...","remoteUser":"...","remoteWorkspaceFolder":"..."}` | `{"outcome":"error","message":"...","description":"..."}` | 0 / 1 |
| Execute command | `devcontainer exec --workspace-folder <path> <cmd> [args]` | `{"outcome":"success"}` | `{"outcome":"error","message":"..."}` | 0 / 1 / 126 |
| Read config | `devcontainer read-configuration --workspace-folder <path>` | Configuration JSON | Error message | 0 / 1 |

**Critical integration detail:** The JSON outcome object appears as the **last line of stdout**. Earlier lines may contain progress/log text. When using `--log-format=json`, some error conditions emit plain-text lines that break JSON parsing (known issue [devcontainers/cli#990](https://github.com/devcontainers/cli/issues/990)).

_Source: [devcontainers/cli GitHub](https://github.com/devcontainers/cli), [VS Code Docs](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli)_

#### Docker CLI Interface

Docker CLI returns JSON by default for `inspect` and supports `--format` for field extraction:

| Operation | Command | Output Format |
|-----------|---------|--------------|
| List containers | `docker ps --filter name=ae-* --format json` | JSON per line |
| Container status | `docker inspect -f '{{json .State}}' <name>` | `{"Status":"running","Running":true,"Pid":6609,"ExitCode":0,...}` |
| Stop container | `docker stop <name>` | Container ID on stdout |
| Force stop | `docker stop -t 0 <name>` | Container ID on stdout |

**State object structure** (from `docker inspect`):
```json
{
  "Status": "running|exited|paused|restarting|dead",
  "Running": true,
  "Paused": false,
  "ExitCode": 0,
  "Error": "",
  "StartedAt": "2026-01-15T10:30:00Z",
  "FinishedAt": "0001-01-01T00:00:00Z"
}
```

_Source: [Docker inspect docs](https://docs.docker.com/reference/cli/docker/inspect/), [Docker formatting](https://docs.docker.com/engine/cli/formatting/)_

#### Git CLI Interface

Git operations produce plain-text stdout. Each command has a well-defined output format:

| Operation | Command | Success stdout | Failure |
|-----------|---------|---------------|---------|
| Clone | `git clone <url> <dir>` | Progress on stderr, empty stdout | Exit code 128 |
| Remote URL | `git remote get-url origin` | URL string | Exit code 2 (no remote) |
| Status (porcelain) | `git status --porcelain` | `M file.ts\n?? new.ts\n...` | Exit code 128 (not a repo) |
| Stash list | `git stash list` | `stash@{0}: WIP on main: abc1234 msg` | Empty (no stashes) |
| Unpushed | `git rev-list @{u}..HEAD` | One SHA per line | Exit code 128 (no upstream) |
| Branch info | `git branch -vv` | Branch listing with tracking | Exit code 0 always |
| HEAD ref | `git symbolic-ref HEAD` | `refs/heads/main` | Exit code 128 (detached) |

_Source: Git documentation, codebase architecture document_

#### OrbStack Interface

OrbStack detection uses a simple availability check:

| Operation | Command | Success | Failure |
|-----------|---------|---------|---------|
| Detect | `orb version` | Version string | ENOENT (not installed) |

_Source: Codebase devcontainer.json, [OrbStack Docs](https://docs.orbstack.dev/)_

### Factory-with-DI Integration Pattern

The codebase establishes a two-tier integration pattern for all external tool access:

**Tier 1 — Low-level executor** (`createExecutor()`):
```
execa (real) or vi.fn() (mock) → createExecutor(executor) → execute(cmd, args, opts) → ExecuteResult
```

**Tier 2 — Domain-specific factories** (`createContainer()`, `createGitOps()`, etc.):
```
createExecutor(mock) → execute → createContainer(execute) → { devcontainerUp, containerStatus, ... }
```

This two-tier approach means:
- **Unit tests** inject mock at Tier 1 (mock executor returning fixture data)
- **Integration tests** inject real executor but may mock at Tier 2 boundaries
- **E2E tests** use default production exports with real Docker

_Source: Codebase `packages/shared/src/subprocess.ts`, `packages/orchestrator/src/lib/discovery.ts`_

### Data Flow: Command Invocation to Result

The integration data flow follows a consistent pipeline:

```
Command Args → execa(cmd, args, {reject:false}) → {failed, stdout, stderr, exitCode}
    → createExecutor normalize → {ok, stdout, stderr, exitCode}
    → Domain function parse → Domain result (typed)
```

Each boundary in this pipeline is a testable seam:
1. **Executor boundary:** Mock returns raw execa-shaped result
2. **Normalize boundary:** ExecuteResult with `ok` boolean
3. **Domain boundary:** Parsed typed result (e.g., `ContainerStatus`, `GitState`)

### Error Propagation Contract

All external tool integrations follow the never-throw contract established by `createExecutor()`:

- External tool errors → `ok: false` with stderr captured
- JSON parse errors → domain-level error code (e.g., `DISCOVERY_FAILED: Invalid JSON response`)
- Timeout errors → `timedOut: true` flag on execa result, mapped to descriptive error
- ENOENT (command not found) → `failed: true` with stderr containing "command not found"

This contract is critical for mocking: **every mock must return the same shape** regardless of success/failure, and **domain functions must handle all error paths** without throwing.

_Source: [AppSignal DI Guide](https://blog.appsignal.com/2022/02/16/dependency-injection-in-javascript-write-testable-code-easily.html), [DEV Community DI vs jest.mock](https://dev.to/keithbro/comparing-jest-mock-and-dependency-injection-in-typescript-khj)_

## Architectural Patterns and Design

### Ports and Adapters (Hexagonal) Architecture for Testing

The agent-env testing strategy maps directly to the **Hexagonal Architecture** (Ports and Adapters) pattern. Each external CLI tool represents a **driven adapter** (secondary adapter), while the CLI commands themselves are **driving adapters** (primary adapters). The domain logic sits in `lib/` functions.

```
Driving Adapters          Ports (Interfaces)         Driven Adapters
─────────────────         ──────────────────         ───────────────
CLI commands (create,  →  ContainerOps interface  →  devcontainer CLI (real)
list, remove, attach)     GitOps interface        →  git CLI (real)
                          DockerOps interface     →  docker CLI (real)
                          OrbStackOps interface   →  orb CLI (real)
Tests (Vitest)         →  Same port interfaces    →  Mock executors (test)
```

The key insight: **tests are just another driving adapter**. By defining ports (TypeScript interfaces) for each external dependency, the same domain logic runs with either real or mock adapters.

[High Confidence] This maps exactly to the existing codebase pattern where `createDiscovery(executor)` accepts either `execa` (production) or `vi.fn()` (test) through the same port interface.

_Source: [AWS Hexagonal Architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html), [Hexagonal Architecture with TDD](https://craftbettersoftware.com/p/hexagonal-architecture-with-tdd)_

### Test Double Strategy by Layer

Following Martin Fowler's test double taxonomy, the agent-env mock strategy uses different test doubles at different architectural layers:

| Layer | Test Double Type | Rationale |
|-------|-----------------|-----------|
| **Executor level** (execa replacement) | **Stub** | Returns canned `{failed, stdout, stderr, exitCode}` responses from fixture data. No interaction verification needed. |
| **Domain function level** (e.g., `containerStatus()`) | **Mock** | Verifies correct command invocation (command, args, options). Tests both the call and the return. |
| **Integration level** (multi-function workflows) | **Fake** | Working simplified implementations that chain multiple stubs to simulate realistic multi-step operations (e.g., create = clone + devcontainer up + write state). |
| **E2E level** (real CLI execution) | **None** (real) | Human-validated tests with actual Docker. |

[High Confidence] This aligns with the established pattern in `discovery.test.ts` which uses **stubs** (canned fixture responses) combined with **mock verification** (checking `mockExecutor` was called with expected args).

_Source: [Martin Fowler — Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html), [xUnit Test Patterns](http://xunitpatterns.com/Mocks,%20Fakes,%20Stubs%20and%20Dummies.html)_

### Fixture Architecture: Factory Functions over Raw JSON

The codebase currently uses raw JSON fixtures (`__fixtures__/*.json`). For Epic 2, the research recommends evolving to **fixture factory functions** while maintaining backward compatibility:

**Current pattern** (raw JSON import):
```typescript
import devPodList from './__fixtures__/devPodList.json' with { type: 'json' };
mockExecutor.mockResolvedValue({ stdout: JSON.stringify(devPodList), ... });
```

**Recommended pattern** (factory function wrapping JSON):
```typescript
// __fixtures__/devcontainer-up.ts
import successData from './devcontainer-up-success.json' with { type: 'json' };
import errorData from './devcontainer-up-error.json' with { type: 'json' };

export function devcontainerUpFixture(overrides?: Partial<DevcontainerUpResult>) {
  return { ...structuredClone(successData), ...overrides };
}

export function devcontainerUpErrorFixture(overrides?: Partial<DevcontainerUpError>) {
  return { ...structuredClone(errorData), ...overrides };
}
```

**Rationale:** Raw JSON imports share a single object reference across tests. Factory functions with `structuredClone()` provide fresh copies per test, preventing cross-test contamination while keeping fixture data in readable JSON files.

[High Confidence] `structuredClone()` is available in Node.js 17+ (project requires 20+) and is the correct deep-copy mechanism for this use case.

_Source: [DEV Community — Test Fixture Generators](https://dev.to/jcteague/make-testing-easier-with-test-fixture-generators-5485), [Vitest Test Context](https://vitest.dev/guide/test-context)_

### Three-Tier Testing Architecture

The constraint — no Docker/devcontainer CLI in automated test environment — dictates a three-tier testing architecture:

**Tier 1: Unit Tests (automated, in-devcontainer, CI)**
- All domain logic tested with mock executors
- Fixture-driven: JSON files define expected CLI outputs
- Runs in `pnpm test:run` — no Docker required
- Coverage target: 100% of domain logic branches

**Tier 2: Integration Tests (automated, in-devcontainer, CI)**
- Multi-module workflows tested with coordinated mocks
- Validates command assembly, error propagation, state transitions
- Still no real Docker — uses fakes for multi-step operations
- Runs in `pnpm test:run` alongside unit tests

**Tier 3: E2E/Smoke Tests (manual, host machine, human)**
- Real `devcontainer up`, real Docker, real OrbStack
- Validates actual container creation, networking, persistence
- Human-executed checklist with documented pass/fail criteria
- Required before Epic completion (per env-2 human validation protocol)

[High Confidence] This three-tier approach is consistent with the system-level test design document which identifies container operations as "Partially Observable" requiring Docker/OrbStack to be running.

_Source: Codebase `test-design-system.md`, [Software Testing Magazine — Test Doubles](https://www.softwaretestingmagazine.com/knowledge/unit-testing-fakes-mocks-and-stubs/)_

### Module Boundary Design for Testability

Based on the architecture document's control seams, Epic 2 should create these module boundaries:

```
packages/agent-env/src/lib/
├── container.ts      ← createContainer(execute) → {devcontainerUp, containerStatus}
├── git.ts            ← createGitOps(execute)    → {clone, getRemoteUrl, getGitState}
├── workspace.ts      ← createWorkspace(fs?)     → {create, exists, readState, writeState}
├── orbstack.ts       ← createOrbstack(execute)  → {detect, isAvailable}
└── __fixtures__/
    ├── devcontainer-up-success.json
    ├── devcontainer-up-error.json
    ├── docker-inspect-running.json
    ├── docker-inspect-stopped.json
    ├── git-clone-success.json
    ├── git-status-clean.json
    ├── git-status-dirty.json
    └── orb-version.json
```

Each module follows the factory-with-DI pattern: `createX(execute) → domain functions`. Tests inject mock executor. Production code uses default `execute` from `@zookanalytics/shared`.

_Source: Codebase architecture document, `packages/shared/src/subprocess.ts`_

## Implementation Approaches and Concrete Examples

### Functions Requiring Mocking (Complete Inventory)

Based on the PRD, architecture document, and epic files, the following functions will invoke external CLI commands and **must** be tested via mock executors:

#### Epic 2: Container Creation

| Function | External Command | Module |
|----------|-----------------|--------|
| `devcontainerUp(workspacePath)` | `devcontainer up --workspace-folder <path>` | `container.ts` |
| `containerStatus(workspacePath)` | `docker inspect -f '{{json .State}}' ae-<name>` | `container.ts` |
| `cloneRepo(url, targetDir)` | `git clone <url> <dir>` | `git.ts` |
| `getRemoteUrl(cwd)` | `git remote get-url origin` | `git.ts` |
| `detectOrbstack()` | `orb version` | `orbstack.ts` |

#### Epic 3: List & Git State

| Function | External Command | Module |
|----------|-----------------|--------|
| `getGitState(workspacePath)` | Multiple: `git status --porcelain`, `git stash list`, `git branch -vv`, `git rev-list @{u}..HEAD`, `git symbolic-ref HEAD` | `git.ts` |
| `listContainers()` | `docker ps --filter name=ae-* --format json` | `container.ts` |

#### Epic 4: Attach

| Function | External Command | Module |
|----------|-----------------|--------|
| `execInContainer(workspace, cmd)` | `devcontainer exec --workspace-folder <path> <cmd>` | `container.ts` |
| `startContainer(name)` | `docker start <name>` | `container.ts` |

#### Epic 5: Remove

| Function | External Command | Module |
|----------|-----------------|--------|
| `stopContainer(name, timeout?)` | `docker stop <name>` / `docker stop -t 0 <name>` | `container.ts` |

### createExecutor() DI Pattern: How to Apply

Each module follows the identical factory pattern established by `createDiscovery()`:

```typescript
// packages/agent-env/src/lib/container.ts
import { createExecutor, type ExecuteResult } from '@zookanalytics/shared';

type Execute = ReturnType<typeof createExecutor>;

export interface ContainerUpResult {
  ok: boolean;
  containerId?: string;
  remoteUser?: string;
  remoteWorkspaceFolder?: string;
  error?: string;
}

export function createContainer(execute: Execute = createExecutor()) {
  async function devcontainerUp(workspacePath: string): Promise<ContainerUpResult> {
    const result = await execute('devcontainer', [
      'up', '--workspace-folder', workspacePath
    ], { timeout: 120000 });

    if (!result.ok) {
      return { ok: false, error: result.stderr || 'Container startup failed' };
    }

    // Parse last line of stdout as JSON (devcontainer CLI convention)
    const lines = result.stdout.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    try {
      const parsed = JSON.parse(lastLine);
      if (parsed.outcome === 'success') {
        return {
          ok: true,
          containerId: parsed.containerId,
          remoteUser: parsed.remoteUser,
          remoteWorkspaceFolder: parsed.remoteWorkspaceFolder,
        };
      }
      return { ok: false, error: parsed.message || parsed.description };
    } catch {
      return { ok: false, error: 'Failed to parse devcontainer output' };
    }
  }

  async function containerStatus(name: string): Promise<'running' | 'stopped' | 'not-found'> {
    const result = await execute('docker', [
      'inspect', '-f', '{{json .State.Status}}', `ae-${name}`
    ], { timeout: 10000 });

    if (!result.ok) return 'not-found';
    const status = result.stdout.trim().replace(/"/g, '');
    return status === 'running' ? 'running' : 'stopped';
  }

  return { devcontainerUp, containerStatus };
}

// Production default
export const container = createContainer();
```

**Testing this module:**

```typescript
// packages/agent-env/src/lib/container.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createContainer } from './container.js';
import { devcontainerUpSuccess, devcontainerUpError } from './__fixtures__/container-fixtures.js';

describe('container', () => {
  describe('devcontainerUp', () => {
    it('returns parsed result on success', async () => {
      const mockExecute = vi.fn().mockResolvedValue(devcontainerUpSuccess());
      const { devcontainerUp } = createContainer(mockExecute);

      const result = await devcontainerUp('/workspace/my-project');

      expect(result.ok).toBe(true);
      expect(result.containerId).toBe('f0a055ff056c...');
      expect(mockExecute).toHaveBeenCalledWith(
        'devcontainer',
        ['up', '--workspace-folder', '/workspace/my-project'],
        expect.objectContaining({ timeout: 120000 })
      );
    });

    it('returns error on CLI failure', async () => {
      const mockExecute = vi.fn().mockResolvedValue(devcontainerUpError());
      const { devcontainerUp } = createContainer(mockExecute);

      const result = await devcontainerUp('/workspace/my-project');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Docker daemon not running');
    });
  });
});
```

### Fixture Structure Per Operation

All fixtures follow the `ExecuteResult` shape from `@zookanalytics/shared`:

```typescript
interface ExecuteResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

#### Fixture File Organization

```
packages/agent-env/src/lib/__fixtures__/
├── container-fixtures.ts          ← Factory functions
├── git-fixtures.ts                ← Factory functions
├── orbstack-fixtures.ts           ← Factory functions
├── raw/                           ← JSON data files
│   ├── devcontainer-up-success.json
│   ├── devcontainer-up-error-no-docker.json
│   ├── devcontainer-up-error-build-fail.json
│   ├── docker-inspect-running.json
│   ├── docker-inspect-stopped.json
│   ├── docker-inspect-not-found.json
│   ├── docker-ps-multiple.json
│   ├── docker-ps-empty.json
│   ├── git-clone-success.json
│   ├── git-clone-error-auth.json
│   ├── git-status-clean.json
│   ├── git-status-dirty.json
│   ├── git-stash-list-nonempty.json
│   ├── git-revlist-unpushed.json
│   ├── git-symbolic-ref-main.json
│   ├── git-symbolic-ref-detached.json
│   ├── orb-version-success.json
│   └── orb-version-not-found.json
```

#### Example JSON Fixtures

**`raw/devcontainer-up-success.json`:**
```json
{
  "ok": true,
  "stdout": "Building image...\nStarting container...\n{\"outcome\":\"success\",\"containerId\":\"f0a055ff056c1c1bb99cc09930efbf3a0437c54d9b4644695aa23c1d57b4bd11\",\"remoteUser\":\"node\",\"remoteWorkspaceFolder\":\"/workspaces/my-project\"}",
  "stderr": "",
  "exitCode": 0
}
```

**`raw/devcontainer-up-error-no-docker.json`:**
```json
{
  "ok": false,
  "stdout": "{\"outcome\":\"error\",\"message\":\"Docker daemon not running\",\"description\":\"Cannot connect to the Docker daemon. Is the Docker daemon running?\"}",
  "stderr": "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?",
  "exitCode": 1
}
```

**`raw/docker-inspect-running.json`:**
```json
{
  "ok": true,
  "stdout": "\"running\"",
  "stderr": "",
  "exitCode": 0
}
```

**`raw/docker-inspect-not-found.json`:**
```json
{
  "ok": false,
  "stdout": "",
  "stderr": "Error: No such container: ae-my-project",
  "exitCode": 1
}
```

**`raw/git-status-dirty.json`:**
```json
{
  "ok": true,
  "stdout": " M src/lib/container.ts\n?? src/lib/new-file.ts\n",
  "stderr": "",
  "exitCode": 0
}
```

**`raw/orb-version-not-found.json`:**
```json
{
  "ok": false,
  "stdout": "",
  "stderr": "command not found: orb",
  "exitCode": 127
}
```

#### Example Fixture Factory

```typescript
// packages/agent-env/src/lib/__fixtures__/container-fixtures.ts
import type { ExecuteResult } from '@zookanalytics/shared';

import successRaw from './raw/devcontainer-up-success.json' with { type: 'json' };
import errorNoDockerRaw from './raw/devcontainer-up-error-no-docker.json' with { type: 'json' };
import inspectRunningRaw from './raw/docker-inspect-running.json' with { type: 'json' };
import inspectStoppedRaw from './raw/docker-inspect-stopped.json' with { type: 'json' };
import inspectNotFoundRaw from './raw/docker-inspect-not-found.json' with { type: 'json' };

export function devcontainerUpSuccess(overrides?: Partial<ExecuteResult>): ExecuteResult {
  return { ...structuredClone(successRaw), ...overrides } as ExecuteResult;
}

export function devcontainerUpError(overrides?: Partial<ExecuteResult>): ExecuteResult {
  return { ...structuredClone(errorNoDockerRaw), ...overrides } as ExecuteResult;
}

export function dockerInspectRunning(overrides?: Partial<ExecuteResult>): ExecuteResult {
  return { ...structuredClone(inspectRunningRaw), ...overrides } as ExecuteResult;
}

export function dockerInspectStopped(overrides?: Partial<ExecuteResult>): ExecuteResult {
  return { ...structuredClone(inspectStoppedRaw), ...overrides } as ExecuteResult;
}

export function dockerInspectNotFound(overrides?: Partial<ExecuteResult>): ExecuteResult {
  return { ...structuredClone(inspectNotFoundRaw), ...overrides } as ExecuteResult;
}
```

[High Confidence] `structuredClone()` is available in Node.js 17+ and handles all JSON-compatible types. The project requires Node.js 20+, so this is safe to use.

_Source: [Vitest Test Context](https://vitest.dev/guide/test-context), [Test Fixture Factory](https://george.czabania.com/post/focused-tests-with-vitest-and-test-fixture-factory/)_

### Integration Test Strategy: Coordinated Multi-Mock Scenarios

For testing multi-step operations (e.g., the `create` command which clones, sets up config, and starts a container), use sequenced mock responses:

```typescript
describe('create command workflow', () => {
  it('clones repo, copies config, and starts container', async () => {
    const mockExecute = vi.fn()
      // 1. git clone
      .mockResolvedValueOnce(gitCloneSuccess())
      // 2. devcontainer up
      .mockResolvedValueOnce(devcontainerUpSuccess())
      // 3. container status check
      .mockResolvedValueOnce(dockerInspectRunning());

    const gitOps = createGitOps(mockExecute);
    const containerOps = createContainer(mockExecute);

    // Execute workflow
    const cloneResult = await gitOps.clone('https://github.com/user/repo', '/workspace/repo');
    expect(cloneResult.ok).toBe(true);

    const upResult = await containerOps.devcontainerUp('/workspace/repo');
    expect(upResult.ok).toBe(true);

    const status = await containerOps.containerStatus('repo');
    expect(status).toBe('running');

    // Verify all three commands were called in order
    expect(mockExecute).toHaveBeenCalledTimes(3);
    expect(mockExecute.mock.calls[0][0]).toBe('git');
    expect(mockExecute.mock.calls[1][0]).toBe('devcontainer');
    expect(mockExecute.mock.calls[2][0]).toBe('docker');
  });

  it('rolls back workspace on container startup failure', async () => {
    const mockExecute = vi.fn()
      .mockResolvedValueOnce(gitCloneSuccess())       // clone succeeds
      .mockResolvedValueOnce(devcontainerUpError());   // container fails

    // ... test rollback behavior
  });
});
```

### Human Validation Protocol for E2E Tests

Since automated tests cannot exercise real Docker/devcontainer operations inside the development environment, E2E validation requires human execution on a host machine with Docker/OrbStack available.

**Smoke Test Checklist (per Epic 2):**

| # | Test | Command | Expected | Pass/Fail |
|---|------|---------|----------|-----------|
| 1 | Create from remote repo | `agent-env create test-1 --repo https://github.com/...` | Container `ae-test-1` running | |
| 2 | Create from local repo | `agent-env create test-2 --repo .` | Container `ae-test-2` running, cloned from cwd remote | |
| 3 | Create with attach | `agent-env create test-3 --repo ... --attach` | Container running, tmux session attached | |
| 4 | Create with bad repo | `agent-env create test-4 --repo https://invalid/repo` | Error message, no workspace created, exit code non-zero | |
| 5 | Create without Docker | Stop Docker, `agent-env create test-5 --repo ...` | Error: Docker/OrbStack not available | |
| 6 | Duplicate name | `agent-env create test-1 --repo ...` (already exists) | Error: workspace already exists | |
| 7 | Container status | `docker inspect ae-test-1` | Status matches `agent-env list` output | |
| 8 | OrbStack domain | `curl http://test-1.agenttools.local:3000` | Response from container (if web server running) | |

**When to run:** After all Epic 2 unit/integration tests pass, before marking Epic complete.
**How to document:** Fill checklist in sprint status file with pass/fail and date.

_Source: [Peter Evans — Smoke Testing Containers](https://peterevans.dev/posts/smoke-testing-containers/), [Docker Docs — Run Tests](https://docs.docker.com/guides/java/run-tests/)_

### Risk Assessment and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Mock fixtures drift from real CLI output | Tests pass but production fails | Medium | Include version-pinned fixture headers; re-validate fixtures when upgrading @devcontainers/cli |
| `devcontainer up` stdout format changes | JSON parsing breaks | Low | Pin @devcontainers/cli version; parse defensively (last-line extraction with JSON.parse try/catch) |
| Docker API format changes | `docker inspect` output differs | Very Low | Docker maintains backward compatibility; format template acts as contract |
| OrbStack not available on non-macOS | Missing OrbStack detection | High (CI is Linux) | OrbStack detection returns graceful `not-found`; never required for unit tests |
| Cross-test fixture contamination | Flaky tests | Medium | Factory functions with `structuredClone()`; never mutate imported raw data |
| Mock executor doesn't match execa API | Type mismatch at runtime | Low | Use `as unknown as Executor` cast pattern (established in codebase); consider typed mock helper |

## Technical Research Recommendations

### Implementation Roadmap

1. **Create fixture infrastructure first** — Set up `__fixtures__/raw/` JSON files and factory functions in `container-fixtures.ts`, `git-fixtures.ts`, `orbstack-fixtures.ts` before writing any domain code
2. **Implement modules with TDD** — Write tests using fixture factories, then implement `createContainer()`, `createGitOps()`, `createOrbstack()`, `createWorkspace()`
3. **Integration tests after modules** — Wire multi-step mock scenarios after individual modules are tested
4. **Human E2E last** — Run smoke checklist on host machine as final validation

### Technology Stack Recommendations

- **Keep factory-with-DI pattern** — The existing `createExecutor()` / `createDiscovery()` pattern is the correct approach. Avoid `vi.mock()` for ESM-only execa.
- **Use `structuredClone()` in fixture factories** — Prevents cross-test contamination without external dependencies.
- **JSON fixture files in `raw/` subdirectory** — Separates data (JSON) from logic (factory functions). JSON files are easy to update from real CLI output.
- **Pin external CLI versions** — Add version comments to fixture files noting which `@devcontainers/cli` and Docker version the fixture was captured from.

### Success Metrics

- 100% branch coverage on all `lib/` domain modules (container, git, workspace, orbstack)
- Every fixture covers both success and at least one failure path per external command
- Zero `vi.mock()` usage for subprocess mocking — all DI-based
- All human E2E checklist items pass before Epic completion
- No test flakiness from shared fixture state
