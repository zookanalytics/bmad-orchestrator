---
stepsCompleted: [1, 2, 3, 4, 5]
epicStructureApproved: true
storiesComplete: true
advancedElicitation:
  - pre-mortem-analysis
  - challenge-from-critical-perspective
status: complete
inputDocuments:
  - '_bmad-output/planning-artifacts/agent-env/prd.md'
  - '_bmad-output/planning-artifacts/agent-env/architecture.md'
---

# agent-env - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for agent-env, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Instance Lifecycle (FR1-6)**
- FR1: User can create a new instance with a specified name
- FR2: User can create an instance from a git repository URL
- FR3: User can create an instance from the current directory's git remote
- FR4: User can create an instance and immediately attach in one command
- FR5: User can remove an instance that passes safety checks
- FR6: User can force-remove an instance, bypassing safety checks with explicit warning

**Instance Discovery & Status (FR7-11)**
- FR7: User can list all instances with their current status
- FR8: User can see git state indicators for each instance (clean, uncommitted, unpushed)
- FR9: User can see the last-attached timestamp for each instance
- FR10: User can see the purpose/label for each instance
- FR11: System can detect instances with never-pushed branches

**Instance Access (FR12-14)**
- FR12: User can attach to an instance's tmux session
- FR13: User can attach to any instance from the interactive menu
- FR14: System maintains persistent tmux session per instance across attach/detach cycles

**State & Metadata (FR15-18)**
- FR15: User can get the current purpose of an instance
- FR16: User can set/update the purpose of an instance
- FR17: System tracks instance creation timestamp
- FR18: System tracks last-attached timestamp per instance

**Safety & Data Protection (FR19-26)**
- FR19: System can detect staged changes in an instance
- FR20: System can detect unstaged changes in an instance
- FR21: System can detect untracked files in an instance
- FR22: System can detect stashed changes in an instance
- FR23: System can detect unpushed commits on ALL branches (not just current)
- FR24: System can detect branches that have never been pushed to any remote
- FR25: System displays clear messaging about what blocks a remove operation
- FR26: System warns that force-remove results in permanent data loss

**Configuration & Environment (FR27-33)**
- FR27: System provides a baseline devcontainer configuration
- FR28: Baseline includes Claude Code CLI authenticated and ready
- FR29: Baseline includes git signing configured
- FR30: Baseline includes SSH agent forwarded from host
- FR31: Baseline includes tmux running with persistent session
- FR32: Baseline includes shell properly configured
- FR33: System clones the specified repository into the instance

**CLI Interface (FR34-38)**
- FR34: User can launch interactive menu by running agent-env with no arguments
- FR35: User can run scriptable commands directly with arguments
- FR36: User can get JSON output from list command for scripting/orchestration
- FR37: User can install shell completion for bash/zsh
- FR38: System provides human-readable colored output by default

**Installation & Platform (FR39-42)**
- FR39: User can install agent-env globally via npm/pnpm
- FR40: System runs on macOS (Intel and Apple Silicon)
- FR41: System runs on Linux
- FR42: System requires Docker for container operations

### NonFunctional Requirements

**Performance (NFR1-5)**
- NFR1: Attach to existing instance completes within 2 seconds
- NFR2: List command returns within 500ms for up to 20 instances
- NFR3: Create with cached base image completes within 30 seconds
- NFR4: First command after attach executes within 5 seconds (time-to-productive)
- NFR5: Safety check analysis completes within 3 seconds

**Reliability (NFR6-10)**
- NFR6: Safety checks have zero false negatives (never miss unsafe state)
- NFR7: False positive rate for safety checks is acceptable (may block when technically safe)
- NFR8: tmux sessions persist across attach/detach cycles without data loss
- NFR9: Instance state survives host machine restart (Docker volumes persist)
- NFR10: Partial failures (one instance unreachable) do not block operations on other instances

**Integration & Compatibility (NFR11-16)**
- NFR11: Works with Docker Engine 20.10+
- NFR12: Compatible with devcontainer.json specification
- NFR13: JSON output parseable by standard tools (jq, orchestrator)
- NFR14: Git operations work with any remote (GitHub, GitLab, Bitbucket, etc.)
- NFR15: SSH agent forwarding works with standard SSH configurations
- NFR16: Works in tmux, screen, and bare terminal environments

**Maintainability (NFR17-21)**
- NFR17: Codebase understandable without extensive documentation
- NFR18: Clear separation between CLI, container lifecycle, and git operations
- NFR19: Test coverage sufficient for confidence in changes
- NFR20: No external runtime dependencies beyond Node.js and Docker
- NFR21: Configuration schema is self-documenting

### Additional Requirements

**From Architecture - Starter Template:**
- TypeScript project with Commander 14.0.2, Ink 6.6.0, @inkjs/ui 2.0.0, React 19
- Single package `@zookanalytics/agent-tools` with both CLIs (agent-env + orchestrator)
- Use `@devcontainers/cli` for container lifecycle management
- Vitest + ink-testing-library for testing
- execa 9.x with `reject: false` pattern for subprocess execution

**From Architecture - Instance Model:**
- Workspace folder at `~/.agent-env/workspaces/<repo>-<instance>/` as atomic unit
- Container naming: `ae-<workspace-name>`
- State file: `.agent-env/state.json` per workspace
- Atomic writes for state files (tmp + rename pattern)

**From Architecture - Technical Constraints:**
- OrbStack required (macOS-first, provides predictable `*.orb.local` domains)
- Baseline-only MVP (no repo-specific config overrides)
- Pre-built base image on GHCR for faster cold starts
- Git state detection via shell to git CLI (parallel commands where possible)

**From Architecture - Testing Requirements:**
- Dependency injection for subprocess mocking
- Co-located tests (`*.test.ts` next to source)
- Fixtures in `lib/__fixtures__/`
- CI quality gates must pass before feature code
- Comprehensive git edge case test matrix (clean, dirty, unpushed, never-pushed, stashed, detached HEAD)

**From Architecture - Error Handling:**
- `formatError()` pattern from shared module
- Error codes: `SAFETY_CHECK_FAILED`, `WORKSPACE_NOT_FOUND`, `CONTAINER_ERROR`, `GIT_ERROR`, `ORBSTACK_REQUIRED`
- JSON output contract: `{ ok: boolean, data: T | null, error: AppError | null }`

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 2 | Create instance with name |
| FR2 | Epic 2 | Create from repo URL |
| FR3 | Epic 2 | Create from current directory |
| FR4 | Epic 2 | Create and attach in one command |
| FR5 | Epic 5 | Remove with safety checks |
| FR6 | Epic 5 | Force-remove with warning |
| FR7 | Epic 3 | List all instances |
| FR8 | Epic 3 | Git state indicators |
| FR9 | Epic 3 | Last-attached timestamp |
| FR10 | Epic 3 | Purpose/label visibility |
| FR11 | Epic 3 | Never-pushed branch detection |
| FR12 | Epic 4 | Attach to tmux session |
| FR13 | Epic 4 | Attach from interactive menu |
| FR14 | Epic 4 | Persistent tmux sessions |
| FR15 | Epic 4 | Get purpose |
| FR16 | Epic 4 | Set/update purpose |
| FR17 | Epic 4 | Creation timestamp tracking |
| FR18 | Epic 4 | Last-attached timestamp tracking |
| FR19 | Epic 5 | Detect staged changes |
| FR20 | Epic 5 | Detect unstaged changes |
| FR21 | Epic 5 | Detect untracked files |
| FR22 | Epic 5 | Detect stashed changes |
| FR23 | Epic 5 | Detect unpushed on ALL branches |
| FR24 | Epic 5 | Detect never-pushed branches |
| FR25 | Epic 5 | Clear blocker messaging |
| FR26 | Epic 5 | Force-remove warning |
| FR27 | Epic 2 | Baseline devcontainer |
| FR28 | Epic 2 | Claude Code ready |
| FR29 | Epic 2 | Git signing configured |
| FR30 | Epic 2 | SSH agent forwarded |
| FR31 | Epic 2 | tmux running |
| FR32 | Epic 2 | Shell configured |
| FR33 | Epic 2 | Clone repository |
| FR34 | Epic 4 | Interactive menu |
| FR35 | Epic 1 | Scriptable commands |
| FR36 | Epic 3 | JSON output |
| FR37 | Epic 4 | Shell completion |
| FR38 | Epic 1 | Colored output |
| FR39 | Epic 1 | npm/pnpm install |
| FR40 | Epic 1 | macOS support |
| FR41 | Epic 1 | Linux support |
| FR42 | Epic 1 | Docker requirement |

**Coverage:** 42/42 FRs mapped (100%)

### NFR Touchpoints by Epic

| Epic | Key NFRs to Address |
|------|---------------------|
| Epic 1 | NFR17 (understandable codebase), NFR18 (clear separation), NFR19 (test coverage), NFR20 (minimal dependencies) |
| Epic 2 | NFR3 (create < 30s cached), NFR4 (time-to-productive < 5s), NFR11-12 (Docker/devcontainer compat), NFR15 (SSH forwarding) |
| Epic 3 | NFR2 (list < 500ms), NFR10 (partial failures don't block), NFR13 (JSON parseable), NFR14 (any git remote) |
| Epic 4 | NFR1 (attach < 2s), NFR8 (tmux persists), NFR16 (works in tmux/screen/bare) |
| Epic 5 | NFR5 (safety check < 3s), NFR6 (zero false negatives), NFR7 (false positives acceptable), NFR9 (state survives restart) |

## Existing Infrastructure

**CRITICAL CONTEXT:** agent-env is being added to an EXISTING codebase via monorepo restructure.

### What Already Exists

| Component | Status | Notes |
|-----------|--------|-------|
| Package `@zookanalytics/bmad-orchestrator` | ✅ Exists | Will become `packages/orchestrator/` |
| TypeScript + Commander + Ink | ✅ Installed | All deps ready |
| Vitest + testing infrastructure | ✅ Configured | CI already runs |
| ESLint + Prettier | ✅ Configured | Code quality ready |
| `src/cli.ts` (orchestrator) | ✅ Implemented | Will move to `packages/orchestrator/src/` |
| `src/lib/` (orchestrator) | ✅ Implemented | types.ts, discovery.ts |
| `src/commands/list.ts` | ✅ Implemented | DevPod list command |
| `.github/workflows/ci.yml` | ✅ Configured | Needs update for workspaces |

### What Needs to Be Created

| Component | Epic | Notes |
|-----------|------|-------|
| `pnpm-workspace.yaml` | Epic 1 | Workspace configuration |
| `packages/` directory | Epic 1 | Monorepo structure |
| `packages/shared/` | Epic 1 | Shared utilities package |
| `packages/orchestrator/` | Epic 1 | Move existing code here |
| `packages/agent-env/` | Epic 1 | New CLI package |
| `config/baseline/` | Epic 2 | Devcontainer config |

## Epic List

### Epic 1: Monorepo Setup & agent-env CLI Scaffold
**User Value:** Developers can run `agent-env --help` alongside existing `bmad-orchestrator` in a proper pnpm workspaces monorepo

This restructures the repo into pnpm workspaces and adds agent-env:

**Phase 1 - Monorepo Foundation:**
- Create `pnpm-workspace.yaml` and root `package.json`
- Create `packages/` directory structure
- Create `packages/shared/` with extracted utilities

**Phase 2 - Orchestrator Migration:**
- Move existing `src/` code to `packages/orchestrator/src/`
- Update imports to use `@zookanalytics/shared`
- Verify all existing tests pass

**Phase 3 - agent-env Scaffold:**
- Create `packages/agent-env/` with CLI skeleton
- Add `bin/agent-env.js` entry point
- Basic Commander setup with `--help` and `--version`

**FRs covered:** FR35, FR38, FR39, FR40, FR41, FR42

**Creates:**
- `pnpm-workspace.yaml` - Workspace config
- `packages/shared/` - `@zookanalytics/shared` package
- `packages/orchestrator/` - Migrated orchestrator (same functionality)
- `packages/agent-env/` - `@zookanalytics/agent-env` scaffold

**Implementation Note:** This epic includes restructuring existing code. All orchestrator tests MUST pass after migration. CI must run all package tests.

#### Story 1.1: Initialize pnpm workspaces structure

As a developer,
I want the repository configured as a pnpm workspaces monorepo,
So that I can manage multiple packages with shared dependencies efficiently.

**Acceptance Criteria:**

**Given** the existing flat repository structure
**When** I run `pnpm install` at the root
**Then** pnpm recognizes the workspace configuration
**And** the `packages/` directory exists

**Given** a fresh clone of the repository
**When** I run `pnpm install`
**Then** all workspace packages are linked correctly
**And** no errors occur during installation

**Technical Requirements:**
- Verify pnpm version >= 8.0 (error if older version detected)
- Create `pnpm-workspace.yaml` with `packages: ['packages/*']`
- Create root `package.json` with `private: true` and workspace scripts
- Create `tsconfig.base.json` with shared TypeScript configuration
- Create empty `packages/` directory structure

---

#### Story 1.2: Create shared utilities package

As a developer,
I want common utilities in a shared package,
So that both CLIs use consistent error handling and subprocess patterns.

**Acceptance Criteria:**

**Given** the `packages/shared/` package exists
**When** I import `formatError` from `@zookanalytics/shared`
**Then** I can format errors consistently with code, message, and suggestion

**Given** an error object with code `WORKSPACE_NOT_FOUND`
**When** I call `formatError(error)`
**Then** it returns a human-readable colored string for terminal output

**Given** the shared package
**When** I run `pnpm --filter @zookanalytics/shared test`
**Then** all shared utility tests pass with >90% coverage

**Technical Requirements:**
- Create `packages/shared/package.json` with name `@zookanalytics/shared`
- Implement `errors.ts` with `formatError()`, `AppError` type
- Implement `types.ts` with `JsonOutput<T>` interface
- Implement `subprocess.ts` with execa wrapper using `reject: false` pattern
- Co-located tests for all modules

---

#### Story 1.3: Migrate orchestrator to packages/

As a developer,
I want the existing orchestrator code moved to `packages/orchestrator/`,
So that both CLIs follow the same monorepo structure.

**Acceptance Criteria:**

**Given** the existing `src/` orchestrator code
**When** I run `bmad-orchestrator list`
**Then** it works exactly as before with no behavioral changes

**Given** the migrated orchestrator package
**When** I run `pnpm --filter @zookanalytics/bmad-orchestrator test`
**Then** all existing tests pass (zero regressions)

**Given** the orchestrator package imports shared utilities
**When** I check the imports
**Then** `@zookanalytics/shared` is used for error formatting

**Given** I run `pnpm pack` in packages/orchestrator
**When** I install the resulting tarball in a fresh directory
**Then** `bmad-orchestrator --help` works correctly (publish smoke test)

**Technical Requirements:**
- Move `src/` contents to `packages/orchestrator/src/`
- Create `packages/orchestrator/package.json` with workspace dependency on shared
- Update `packages/orchestrator/bin/bmad-orchestrator.js` entry point
- Update all imports to use new paths
- Update `tsconfig.json` to extend base config
- NO functional changes - migration only
- CI should run `pnpm pack` + install test to verify publishable package

---

#### Story 1.4: Create agent-env CLI scaffold

As a developer,
I want a basic `agent-env` CLI that responds to `--help`,
So that I can verify the package is correctly set up before adding features.

**Acceptance Criteria:**

**Given** the agent-env package is installed
**When** I run `agent-env --help`
**Then** I see usage information with available commands listed

**Given** the agent-env package is installed
**When** I run `agent-env --version`
**Then** I see the current version number

**Given** the agent-env CLI
**When** I run `agent-env` with no arguments
**Then** I see help output (placeholder for future interactive menu)

**Given** the agent-env package
**When** I run `pnpm --filter @zookanalytics/agent-env test`
**Then** CLI tests pass

**Technical Requirements:**
- Create `packages/agent-env/package.json` with name `@zookanalytics/agent-env`
- Create `packages/agent-env/src/cli.ts` with Commander setup
- Create `packages/agent-env/bin/agent-env.js` shebang entry point
- Add dependency on `@zookanalytics/shared`
- Add placeholder commands: `create`, `list`, `attach`, `remove`, `purpose`
- Colored output using Ink or chalk

---

#### Story 1.5: Update CI for workspaces

As a developer,
I want CI to test all packages in the monorepo,
So that changes to shared code are validated against all consumers.

**Acceptance Criteria:**

**Given** a PR that modifies `packages/shared/`
**When** CI runs
**Then** tests run for shared, orchestrator, AND agent-env packages

**Given** a PR that only modifies `packages/agent-env/`
**When** CI runs
**Then** at minimum agent-env tests run (optionally all for safety)

**Given** all tests pass
**When** CI completes
**Then** the PR is marked as passing

**Given** any package test fails
**When** CI completes
**Then** the PR is marked as failing with clear error output

**Technical Requirements:**
- Update `.github/workflows/ci.yml` for pnpm workspaces
- Run `pnpm install` at root
- Run `pnpm -r test:run` to test all packages
- Run `pnpm -r lint` for all packages
- Run `pnpm -r type-check` for all packages
- Cache pnpm store for faster builds

---

### Epic 2: Instance Creation & Baseline Environment
**User Value:** User can spin up isolated, AI-ready dev environments with a single command

Delivers the core creation experience:
- `create <name>` - Create instance with specified name
- `create <name> --repo <url>` - Create from git repository URL
- `create <name> --repo .` - Create from current directory's git remote
- `create <name> --attach` - Create and immediately attach
- Baseline devcontainer with Claude Code, git signing, SSH agent, tmux, shell
- Clone repository into workspace folder
- Write instance state to `.agent-env/state.json`

**FRs covered:** FR1, FR2, FR3, FR4, FR27, FR28, FR29, FR30, FR31, FR32, FR33

**Builds:** `workspace.ts`, `container.ts`, `state.ts` (complete module - read + write), `commands/create.ts`, `config/baseline/*`

**Note:** This is the largest epic (11 FRs) because the baseline devcontainer IS the core value proposition. Splitting would fragment the user story "I can create an AI-ready environment."

**POST-MVP Note:** Explicit `stop` and `start` commands for containers are deferred to Growth Features. MVP relies on: (1) attach auto-starts stopped containers, (2) remove stops containers before deletion. Users can use `docker stop/start` directly if needed before Growth phase adds first-class commands.

#### Story 2.1: Implement workspace management

As a developer,
I want workspaces stored in a predictable location with persistent state,
So that instances survive restarts and can be discovered reliably.

**Acceptance Criteria:**

**Given** I want to create a workspace for repo "bmad-orch" with instance name "auth"
**When** `createWorkspace()` is called
**Then** a folder is created at `~/.agent-env/workspaces/bmad-orch-auth/`

**Given** a workspace folder exists
**When** I write state using `writeStateAtomic()`
**Then** the state is written to `.agent-env/state.json` inside the workspace
**And** the write uses tmp+rename pattern for atomicity

**Given** multiple workspaces exist
**When** I call `scanWorkspaces()`
**Then** I get a list of all workspace folders with their metadata

**Given** a corrupted or missing state.json
**When** `readState()` is called
**Then** it returns a graceful fallback with "unknown" status
**And** does not throw an error

**Technical Requirements:**
- Create `packages/agent-env/src/lib/workspace.ts`
- Create `packages/agent-env/src/lib/state.ts`
- Implement `createWorkspace(repo: string, instance: string): WorkspacePath`
- Implement `scanWorkspaces(): Workspace[]`
- Implement `readState(workspacePath): InstanceState`
- Implement `writeStateAtomic(workspacePath, state): void`
- Co-located tests with fixtures for valid/invalid state files

---

#### Story 2.2: Create baseline devcontainer configuration

As a user,
I want new instances to come with a fully-configured dev environment,
So that I can start coding immediately with all tools ready.

**Acceptance Criteria:**

**Given** I create a new instance
**When** the container starts
**Then** Claude Code CLI is installed and authenticated
**And** authentication uses host credentials via mounted `~/.claude/` config directory

**Given** a running instance
**When** I make a git commit
**Then** the commit is signed (git signing configured)

**Given** a running instance
**When** I run `ssh -T git@github.com`
**Then** I see "Hi username! You've successfully authenticated" (SSH agent forwarding verified)

**Given** a running instance
**When** I attach
**Then** I'm connected to a tmux session that persists across attach/detach

**Given** a running instance
**When** I open a shell
**Then** the shell is properly configured (zsh/bash with expected dotfiles)

**Given** a cached base image exists locally
**When** I run `agent-env create`
**Then** the container is ready in <30 seconds (NFR3)

**Technical Requirements:**
- Create `config/baseline/devcontainer.json` with features
- Create `config/baseline/Dockerfile` for base image
- Configure Claude Code feature/installation
- Configure Claude Code auth via host mount: `~/.claude:/home/node/.claude:ro`
- Configure git signing (GPG or SSH)
- Configure SSH agent socket forwarding (handle macOS SSH_AUTH_SOCK path)
- Configure tmux to auto-start
- Shell configuration (zsh preferred)
- Publish base image to `ghcr.io/zookanalytics/agent-env-base:<version>`
- Document base image versioning strategy
- Add troubleshooting docs for SSH agent issues

---

#### Story 2.3: Implement container lifecycle

As a developer,
I want to manage container lifecycle via devcontainer CLI,
So that I get standard devcontainer behavior and compatibility.

**Acceptance Criteria:**

**Given** a workspace with devcontainer.json
**When** I call `devcontainerUp(workspacePath)`
**Then** the container starts with name `ae-<workspace-name>`
**And** the function returns when container is ready

**Given** a running container
**When** I call `containerStatus(workspacePath)`
**Then** I get the current status (running, stopped, not found)

**Given** devcontainer up fails
**When** the error is caught
**Then** a structured error with code `CONTAINER_ERROR` is returned
**And** the original error message is preserved

**Given** OrbStack is not running
**When** I try to start a container
**Then** I get error code `ORBSTACK_REQUIRED` with helpful message

**Technical Requirements:**
- Create `packages/agent-env/src/lib/container.ts`
- Use `@devcontainers/cli` or shell out to `devcontainer` CLI
- Implement `devcontainerUp(workspacePath): Promise<ContainerResult>`
- Implement `containerStatus(workspacePath): Promise<ContainerStatus>`
- Container naming convention: `ae-<workspace-name>`
- Timeout handling for long operations
- Co-located tests with mocked subprocess

---

#### Story 2.4: Implement create command (basic)

As a user,
I want to create a new instance from a git repository,
So that I can start working in an isolated environment.

**Acceptance Criteria:**

**Given** I run `agent-env create auth --repo https://github.com/user/bmad-orch`
**When** the command completes
**Then** the repo is cloned to `~/.agent-env/workspaces/bmad-orch-auth/`
**And** the baseline devcontainer is copied (if no .devcontainer exists)
**And** the container is running
**And** state.json is written with creation timestamp

**Given** I run `agent-env create auth --repo git@github.com:user/repo.git`
**When** the command completes
**Then** SSH clone works correctly

**Given** the instance name already exists
**When** I try to create it
**Then** I get an error "Instance 'auth' already exists"
**And** no changes are made

**Given** the clone fails (invalid URL, no access)
**When** the error occurs
**Then** I get a clear error message with code `GIT_ERROR`
**And** no partial workspace is left behind

**Given** container startup fails after clone succeeds
**When** the error occurs
**Then** the workspace folder is cleaned up (rolled back)
**And** I get a clear error message with code `CONTAINER_ERROR`
**And** the cleanup is logged for debugging

**Technical Requirements:**
- Create `packages/agent-env/src/commands/create.ts`
- Parse `--repo` flag for repository URL
- Extract repo name from URL (last path segment, minus .git)
- Clone repo using git CLI
- Copy baseline config if no .devcontainer/ exists
- Call `devcontainerUp()`
- Write initial state.json
- Show progress with Ink spinner
- Colored success/error output
- Implement rollback on failure: if any step fails after workspace creation, clean up the workspace folder

---

#### Story 2.5: Implement create command variants

As a user,
I want convenient shortcuts for common create scenarios,
So that I can work faster with less typing.

**Acceptance Criteria:**

**Given** I'm in a directory with a git remote
**When** I run `agent-env create feature --repo .`
**Then** the repo URL is inferred from the current directory's git remote
**And** the instance is created with that repo

**Given** I run `agent-env create auth --repo <url> --attach`
**When** the container is ready
**Then** I'm automatically attached to the tmux session
**And** I see the container shell (not returned to host)

**Given** I'm in a directory without a git remote
**When** I run `agent-env create test --repo .`
**Then** I get an error "No git remote found in current directory"

**Technical Requirements:**
- Add `--repo .` handling to detect current directory remote
- Use `git remote get-url origin` to get remote URL
- Add `--attach` flag to create command
- After successful create, call attach logic (from Epic 4, or inline for now)
- Tests for both variants

---

### Epic 3: Instance Discovery & Git State
**User Value:** User can see all instances and their git state at a glance

Delivers the "morning standup" visibility:
- `list` / `ps` - Show all instances with status
- Git state indicators (✓ clean, ● uncommitted, ↑ unpushed)
- Last-attached timestamp display
- Purpose/label visibility
- Never-pushed branch detection
- `list --json` for scripting/orchestrator integration

**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR36

**Builds:** `git.ts` (complete module - reused by Epic 5), `commands/list.ts`, `components/InstanceList.tsx`, `components/StatusIndicator.tsx`

**Uses:** `workspace.ts`, `state.ts` from Epic 2

**Critical:** The `git.ts` module built here is the foundation for Epic 5's safety checks. Must have comprehensive test coverage including edge cases (detached HEAD, never-pushed branches, multi-branch scenarios).

#### Story 3.1: Implement git state detection

As a developer,
I want comprehensive git state analysis for any workspace,
So that I can show users exactly what's at risk before destructive operations.

**Acceptance Criteria:**

**Given** a workspace with staged changes
**When** I call `getGitState(workspacePath)`
**Then** `hasStaged` is true

**Given** a workspace with unstaged changes
**When** I call `getGitState(workspacePath)`
**Then** `hasUnstaged` is true

**Given** a workspace with untracked files
**When** I call `getGitState(workspacePath)`
**Then** `hasUntracked` is true

**Given** a workspace with stashed changes
**When** I call `getGitState(workspacePath)`
**Then** `stashCount` is greater than 0

**Given** a workspace with unpushed commits on any branch
**When** I call `getGitState(workspacePath)`
**Then** `unpushedBranches` contains those branch names

**Given** unpushed commits exist on branch 'feature' while I'm on branch 'main'
**When** I call `getGitState(workspacePath)`
**Then** `unpushedBranches` includes 'feature' (cross-branch detection)

**Given** a workspace with branches never pushed to any remote
**When** I call `getGitState(workspacePath)`
**Then** `neverPushedBranches` contains those branch names

**Given** a workspace in detached HEAD state
**When** I call `getGitState(workspacePath)`
**Then** `isDetachedHead` is true

**Given** a clean repository with everything pushed
**When** I call `getGitState(workspacePath)`
**Then** `isClean` is true

**Technical Requirements:**
- Create `packages/agent-env/src/lib/git.ts`
- Use parallel git commands where possible for performance (<500ms target)
- Commands: `git status --porcelain`, `git stash list`, `git branch -vv`
- For unpushed: iterate ALL branches, not just current (`git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads`)
- Handle detached HEAD: `git symbolic-ref HEAD` fails if detached
- Return structured `GitState` object
- Comprehensive test matrix with fixtures for all edge cases
- CRITICAL: Test must include multi-branch scenario (unpushed on non-current branch)

**Dev Notes:**
- **Reliability over completeness:** Every implemented detection function must reliably catch its target state. Missing a check is acceptable; a broken check that silently passes is not. Avoid over-engineering detection logic — if a verification block adds latency or fragility without proportional safety value, omit it. This principle was established in the Epic env-2 retrospective after over-engineered checks caused test failures (e.g., 45-line name verification block removed from Story 2.3).

---

#### Story 3.2: Implement list command (basic)

As a user,
I want to see all my instances at a glance,
So that I know what environments I have available.

**Acceptance Criteria:**

**Given** I have 3 instances created
**When** I run `agent-env list`
**Then** I see a table with all 3 instances

**Given** an instance is running
**When** I run `agent-env list`
**Then** the status column shows "running" (green)

**Given** an instance is stopped
**When** I run `agent-env list`
**Then** the status column shows "stopped" (yellow)

**Given** an instance workspace exists but container is missing
**When** I run `agent-env list`
**Then** the status column shows "orphaned" (red)

**Given** Docker/OrbStack is not running
**When** I run `agent-env list`
**Then** I see workspace-level info (name, purpose, last attached from state.json)
**And** container status shows "unknown (Docker unavailable)"
**And** git state indicators show "?" (cannot access workspace in container)

**Given** an instance was attached 2 hours ago
**When** I run `agent-env list`
**Then** the "Last Attached" column shows "2h ago"

**Given** I run `agent-env ps`
**When** the command executes
**Then** it behaves identically to `agent-env list` (alias)

**Technical Requirements:**
- Create `packages/agent-env/src/commands/list.ts`
- Create `packages/agent-env/src/components/InstanceList.tsx`
- Use Ink for table rendering
- Columns: Name, Status, Last Attached, Purpose
- Use timeago.js for relative timestamps
- Register `ps` as alias for `list`
- Colored output based on status
- Graceful degradation: if Docker unavailable, show state.json data with "Docker unavailable" status

---

#### Story 3.3: Add git state indicators to list

As a user,
I want to see git state at a glance in the instance list,
So that I know which instances have uncommitted or unpushed work.

**Acceptance Criteria:**

**Given** an instance with clean git state
**When** I run `agent-env list`
**Then** I see ✓ (green) next to the instance

**Given** an instance with uncommitted changes (staged, unstaged, or untracked)
**When** I run `agent-env list`
**Then** I see ● (yellow) next to the instance

**Given** an instance with unpushed commits
**When** I run `agent-env list`
**Then** I see ↑ (blue) next to the instance

**Given** an instance with never-pushed branches
**When** I run `agent-env list`
**Then** I see ⚠ (red) indicator with branch count

**Given** an instance with both uncommitted AND unpushed
**When** I run `agent-env list`
**Then** I see both ● and ↑ indicators

**Technical Requirements:**
- Create `packages/agent-env/src/components/StatusIndicator.tsx`
- Integrate `getGitState()` into list command
- Run git state detection in parallel for all instances
- Show combined indicators when multiple states apply
- Performance: list should complete in <500ms for 20 instances (NFR2)

---

#### Story 3.4: Implement JSON output

As a script or orchestrator,
I want machine-readable output from list command,
So that I can programmatically discover and manage instances.

**Acceptance Criteria:**

**Given** I run `agent-env list --json`
**When** instances exist
**Then** I get JSON output: `{ "ok": true, "data": [...], "error": null }`

**Given** the JSON output data array
**When** I inspect an instance object
**Then** it includes: name, status, lastAttached, purpose, gitState

**Given** an error occurs during list
**When** I run `agent-env list --json`
**Then** I get: `{ "ok": false, "data": null, "error": { "code": "...", "message": "..." } }`

**Given** I pipe output through jq
**When** I run `agent-env list --json | jq '.data[].name'`
**Then** I get a list of instance names

**Technical Requirements:**
- Add `--json` flag to list command
- Use `JsonOutput<T>` type from shared
- Suppress colored/formatted output when --json
- Exit code 0 for success, non-zero for error
- Ensure output is valid JSON (no console.log mixing)

---

### Epic 4: Instance Access & Management
**User Value:** User can seamlessly attach to environments and manage instance metadata

Delivers the "attach and work" experience:
- `attach <name>` - Attach to instance's tmux session
- Interactive menu (no-args mode) - Select instance to attach
- `purpose <name>` - Get current purpose
- `purpose <name> "new purpose"` - Set/update purpose
- Timestamp tracking (creation, last-attached)
- Shell completion for bash/zsh
- Persistent tmux sessions across attach/detach cycles

**FRs covered:** FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR34, FR37

**Builds:** `commands/attach.ts`, `commands/purpose.ts`, `components/InteractiveMenu.tsx`, `hooks/useAgentEnv.ts`

**Uses:** `workspace.ts`, `state.ts`, `git.ts` from previous epics

**Note:** Bundles diverse interaction modes (menu, attach, purpose, completion) unified by context: "working with existing instances."

#### Story 4.1: Implement attach command

As a user,
I want to attach to an instance's tmux session,
So that I can continue working where I left off.

**Acceptance Criteria:**

**Given** a running instance named "auth"
**When** I run `agent-env attach auth`
**Then** I'm connected to the tmux session inside the container
**And** my terminal is replaced by the tmux session

**Given** I'm attached to a tmux session
**When** I detach (Ctrl+B, D)
**Then** I return to my host terminal
**And** the session remains running in the container

**Given** I previously detached from an instance
**When** I run `agent-env attach auth` again
**Then** I reconnect to the same tmux session with my previous work intact

**Given** the container is running but no tmux session exists
**When** I run `agent-env attach auth`
**Then** a new tmux session named "main" is created automatically
**And** I'm attached to the new session

**Given** the instance is stopped
**When** I run `agent-env attach auth`
**Then** I see "Starting container..." spinner
**And** the container is started
**And** then I'm attached to the tmux session

**Given** the instance does not exist
**When** I run `agent-env attach nonexistent`
**Then** I get error "Instance 'nonexistent' not found"

**Given** I successfully attach
**When** the attach completes
**Then** the `lastAttached` timestamp is updated in state.json

**Given** OrbStack is not running
**When** I run `agent-env attach auth`
**Then** I get error code `ORBSTACK_REQUIRED` within 5 seconds
**And** the message suggests starting OrbStack

**Given** container start takes too long
**When** 60 seconds pass without container ready
**Then** the operation times out with clear error message

**Technical Requirements:**
- Create `packages/agent-env/src/commands/attach.ts`
- Use `devcontainer exec` or direct Docker exec to connect to tmux
- Start container if stopped before attaching (with spinner)
- Update state.json with lastAttached timestamp
- Attach should complete within 2 seconds for running containers (NFR1)
- Handle tmux session not existing (create new session named "main")
- tmux session creation: `tmux new-session -d -s main` if not exists, then `tmux attach -t main`
- Check OrbStack availability before attempting container operations
- Timeout container start after 60 seconds

---

#### Story 4.2: Implement purpose command

As a user,
I want to label instances with their purpose,
So that I remember what each environment is for.

**Acceptance Criteria:**

**Given** an instance "auth" with purpose set to "Authentication feature"
**When** I run `agent-env purpose auth`
**Then** I see "Authentication feature"

**Given** an instance "auth" with no purpose set
**When** I run `agent-env purpose auth`
**Then** I see "(no purpose set)"

**Given** I run `agent-env purpose auth "OAuth implementation"`
**When** the command completes
**Then** the purpose is saved to state.json
**And** I see confirmation "Purpose updated"

**Given** I run `agent-env purpose auth ""`
**When** the command completes
**Then** the purpose is cleared
**And** I see confirmation "Purpose cleared"

**Given** the instance does not exist
**When** I run `agent-env purpose nonexistent`
**Then** I get error "Instance 'nonexistent' not found"

**Technical Requirements:**
- Create `packages/agent-env/src/commands/purpose.ts`
- Read purpose from state.json
- Write purpose using atomic write
- Support both get (1 arg) and set (2 args) modes
- Colored output for confirmation

---

#### Story 4.3: Implement interactive menu

As a user,
I want an interactive menu when I run agent-env with no arguments,
So that I can quickly select and attach to an instance.

**Acceptance Criteria:**

**Given** I have multiple instances
**When** I run `agent-env` with no arguments
**Then** I see an interactive menu listing all instances

**Given** the interactive menu is displayed
**When** I use arrow keys to navigate
**Then** the selected instance is highlighted

**Given** I select an instance and press Enter
**When** the selection is confirmed
**Then** I'm attached to that instance's tmux session

**Given** I'm in the interactive menu
**When** I press 'q' or Escape
**Then** the menu exits without attaching

**Given** the menu is displayed
**When** I look at each instance row
**Then** I see: name, status, git state indicator, purpose (truncated to fit terminal width)

**Given** a terminal with narrow width (< 80 columns)
**When** the menu is displayed
**Then** purpose is truncated with "..." to fit available space
**And** core info (name, status, git state) is always visible

**Given** no instances exist
**When** I run `agent-env`
**Then** I see "No instances found. Create one with: agent-env create <name> --repo <url>"

**Given** 50 instances exist
**When** I run `agent-env` with no arguments
**Then** the menu loads within 3 seconds

**Technical Requirements:**
- Create `packages/agent-env/src/components/InteractiveMenu.tsx`
- Use Ink + @inkjs/ui Select component
- Show git state indicators inline
- Truncate long purpose to fit terminal width
- Keyboard navigation: arrows, enter, q/escape
- After selection, call attach logic
- Performance: Lazy-load git state or show menu immediately with "loading" indicators
- Consider: Show 20 most recently used, with "Show all" option for large counts
- Terminal width handling: Use `process.stdout.columns` to detect width, truncate purpose column

---

#### Story 4.4: Add shell completion

As a power user,
I want tab completion for agent-env commands and instance names,
So that I can work faster without typing full names.

**Acceptance Criteria:**

**Given** I run `agent-env completion bash`
**When** I view the output
**Then** I see a bash completion script

**Given** I run `agent-env completion zsh`
**When** I view the output
**Then** I see a zsh completion script

**Given** I've installed the completion script
**When** I type `agent-env att<TAB>`
**Then** it completes to `agent-env attach`

**Given** I've installed the completion script and have instances "auth" and "api"
**When** I type `agent-env attach a<TAB>`
**Then** I see both "auth" and "api" as options

**Given** I run `agent-env completion --help`
**When** I view the output
**Then** I see installation instructions for bash and zsh

**Technical Requirements:**
- Create `packages/agent-env/src/commands/completion.ts`
- Use Commander's built-in completion generation or custom script
- Complete commands: create, list, attach, remove, purpose, completion
- Complete instance names dynamically by scanning workspaces
- Provide installation instructions in --help

---

### Epic 5: Safe Instance Removal & Data Protection
**User Value:** User can safely clean up environments without ever losing work

Delivers the "safety saves the day" experience:
- `remove <name>` - Remove instance after passing safety checks
- `remove --force <name>` - Force-remove with explicit data loss warning
- Comprehensive safety detection:
  - Staged changes
  - Unstaged changes
  - Untracked files
  - Stashed changes
  - Unpushed commits on ALL branches (not just current)
  - Branches never pushed to any remote
  - Detached HEAD state
- Clear blocker messaging showing exactly what's at risk
- Force-remove warning that data loss is permanent

**FRs covered:** FR5, FR6, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26

**Uses:** `git.ts` from Epic 3 (safety policy built on top of detection)
**Builds:** `commands/remove.ts`, `components/SafetyPrompt.tsx`

**Critical:** Zero false negatives (NFR6). If in doubt, block the removal. False positives are acceptable (NFR7).

#### Story 5.1: Implement remove command with safety checks

As a user,
I want remove to block when I have unsaved work,
So that I never accidentally lose code.

**Acceptance Criteria:**

**Given** an instance "auth" with clean git state (nothing uncommitted, nothing unpushed)
**When** I run `agent-env remove auth`
**Then** the instance is removed (container stopped, workspace deleted)
**And** I see confirmation "Instance 'auth' removed"

**Given** an instance "auth" with a running container
**When** I run `agent-env remove auth`
**Then** the container is stopped before workspace deletion
**And** the removal proceeds normally after container stops

**Given** container stop times out (> 30 seconds)
**When** removal is in progress
**Then** the operation fails with clear error message
**And** suggests "docker stop <container> --force" if user wants to proceed manually

**Given** an instance with staged changes
**When** I run `agent-env remove auth`
**Then** the removal is blocked
**And** I see "Cannot remove: staged changes detected"

**Given** an instance with unstaged changes
**When** I run `agent-env remove auth`
**Then** the removal is blocked
**And** I see "Cannot remove: unstaged changes detected"

**Given** an instance with untracked files
**When** I run `agent-env remove auth`
**Then** the removal is blocked
**And** I see "Cannot remove: untracked files detected"

**Given** an instance with stashed changes
**When** I run `agent-env remove auth`
**Then** the removal is blocked
**And** I see "Cannot remove: stashed changes detected (N stashes)"

**Given** an instance with unpushed commits on ANY branch
**When** I run `agent-env remove auth`
**Then** the removal is blocked
**And** I see "Cannot remove: unpushed commits on branches: feature-x, bugfix-y"

**Given** an instance with never-pushed branches
**When** I run `agent-env remove auth`
**Then** the removal is blocked
**And** I see "Cannot remove: branches never pushed: new-feature"

**Given** an instance in detached HEAD state
**When** I run `agent-env remove auth`
**Then** the removal is blocked
**And** I see "Cannot remove: detached HEAD state (investigate manually)"

**Given** the instance does not exist
**When** I run `agent-env remove nonexistent`
**Then** I get error "Instance 'nonexistent' not found"

**Technical Requirements:**
- Create `packages/agent-env/src/commands/remove.ts`
- Use `getGitState()` from Epic 3 for safety checks
- Stop container before removing workspace (30 second timeout)
- Handle running container: stop gracefully, then remove
- Delete workspace folder only if all checks pass
- Safety check should complete in <3 seconds (NFR5)
- Error code: `SAFETY_CHECK_FAILED`
- Error code: `CONTAINER_STOP_TIMEOUT` for container stop failures

---

#### Story 5.2: Implement safety prompt UI

As a user,
I want to see exactly what's at risk before removal is blocked,
So that I understand what I need to do to safely remove.

**Acceptance Criteria:**

**Given** removal is blocked due to multiple issues
**When** I see the error output
**Then** all issues are listed clearly with severity indicators

**Given** there are uncommitted changes
**When** I see the safety prompt
**Then** I see the count of staged, unstaged, and untracked files

**Given** there are unpushed commits
**When** I see the safety prompt
**Then** I see which branches have unpushed commits and how many

**Given** there are never-pushed branches
**When** I see the safety prompt
**Then** I see the branch names highlighted in red (highest risk)

**Given** there are stashes
**When** I see the safety prompt
**Then** I see the stash count and first stash message

**Given** the safety prompt is displayed
**When** I look at the suggestions
**Then** I see actionable next steps (e.g., "Run `git push` to push changes")

**Technical Requirements:**
- Create `packages/agent-env/src/components/SafetyPrompt.tsx`
- Color coding: red for data loss risk, yellow for warnings
- Show file/commit counts, not full lists (unless --verbose)
- Include actionable suggestions for each blocker
- Use Ink for formatted terminal output

---

#### Story 5.3: Implement force remove

As a user,
I want to force-remove an instance when I'm certain I don't need the work,
So that I can clean up without resolving every git issue.

**Acceptance Criteria:**

**Given** an instance with unsafe git state
**When** I run `agent-env remove auth --force`
**Then** I see a warning listing everything that will be lost
**And** I'm prompted to type the instance name to confirm

**Given** the force confirmation prompt
**When** I type the instance name correctly
**Then** the instance is removed regardless of git state
**And** I see "Instance 'auth' force-removed. Data permanently deleted."

**Given** the force confirmation prompt
**When** I type the wrong name or press Ctrl+C
**Then** the removal is cancelled
**And** I see "Removal cancelled"

**Given** an instance with clean git state
**When** I run `agent-env remove auth --force`
**Then** it removes without the extra confirmation (not needed)

**Given** I run `agent-env remove auth --force --yes`
**When** used in a script
**Then** it skips the confirmation prompt entirely (for automation)
**And** this is documented as dangerous

**Given** a force remove completes (with or without --yes)
**When** the instance is deleted
**Then** an entry is written to `~/.agent-env/audit.log`
**And** the entry includes: timestamp, instance name, git state at removal, user confirmation method

**Technical Requirements:**
- Add `--force` flag to remove command
- Add `--yes` flag for non-interactive force (scripts only)
- Show comprehensive warning before force remove
- Require exact instance name match for confirmation
- Write audit log entry for ALL force removals to `~/.agent-env/audit.log`
- Audit log format: JSON lines (one JSON object per line) for easy parsing
- Exit code 0 on success, non-zero on cancel
- Document --yes flag dangers prominently in --help and README

---

## Epic Dependencies

```
Epic 1 (Foundation)
    ↓
Epic 2 (Create) ──→ Epic 3 (List/Git) ──→ Epic 5 (Remove)
                          ↓
                    Epic 4 (Access)
```

**Dependency Notes:**
- Epic 1 must complete first (project infrastructure)
- Epic 2 can proceed independently after Epic 1
- Epic 3 depends on Epic 2 (needs instances to list)
- Epic 4 depends on Epic 2 (needs instances to attach to)
- Epic 5 depends on Epic 3 (uses `git.ts` module)
- Epics 3 and 4 can be developed in parallel after Epic 2

**Standalone Guarantee:** Each epic delivers complete, usable functionality. Epic 2 works without needing list/remove. Epic 3 works without attach. Epic 4 works without remove.

## Cross-Cutting Concerns

### Network Failure Handling

All network-dependent operations (clone, container pull, push) should follow this pattern:
- Timeout after reasonable duration (30s for clone, 60s for container operations)
- Clear error messages indicating network issue vs authentication issue
- Exit codes distinguish between transient failures (retry-able) and permanent failures
- No partial state left behind on failure (rollback or atomic operations)
