---
stepsCompleted: [1, 2, 3, 4, 5, 'env2-step1', 'env2-step2', 'env2-step2-approved', 'env2-step3']
epicStructureApproved: true
storiesComplete: true
advancedElicitation:
  - pre-mortem-analysis
  - challenge-from-critical-perspective
  - architecture-decision-records
status: in-progress-expansion
previousStatus: complete
expansionRound: 2
inputDocuments:
  - '_bmad-output/planning-artifacts/agent-env/prd.md'
  - '_bmad-output/planning-artifacts/agent-env/architecture.md'
  - '_bmad-output/planning-artifacts/monorepo-brief.md'
notes:
  - 'Epics 1-5 implemented, covering FR1-FR42, NFR1-NFR21'
  - 'PRD revised 2026-02-14: added FR43-FR54, NFR22-NFR24'
  - 'Architecture revised 2026-02-14: naming model, baseline prompt, purpose propagation, CLI inside container'
  - 'FR44 missing from PRD numbering (jumps FR43 to FR45)'
  - 'Epics 6-8 designed via pre-mortem + challenge + ADR elicitation'
  - 'Key ADR decisions: jq for tmux, no migration, opaque AGENT_ENV_INSTANCE, CLI-in-container with dev mode, VS Code regen in purpose command'
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

## New Requirements (PRD Revision 2026-02-14)

### New Functional Requirements

**Multi-Instance & Naming (FR43, FR45)**
- FR43: User can create multiple instances from the same repository, each with a distinct user-chosen name
- FR45: User can see the source repository for each instance in list output

**Purpose at Creation & In-Container Visibility (FR46-FR50)**
- FR46: User can set instance purpose at creation time via `--purpose` flag
- FR47: System exposes instance name as `$AGENT_ENV_INSTANCE` environment variable inside the container
- FR48: System exposes instance purpose as `$AGENT_ENV_PURPOSE` environment variable inside the container
- FR49: System displays instance name and purpose in the tmux status bar inside the container
- FR50: System updates tmux status bar purpose live when purpose changes externally (within 30 seconds)

**Repo Management — Growth (FR51-FR53)**
- FR51: System tracks repositories used for instance creation in a local registry
- FR52: User can list tracked repositories
- FR53: User can create a new instance from a registered repository without re-entering the URL

**VS Code Purpose Visibility — Growth (FR54)**
- FR54: System displays instance purpose in VS Code window title when attached via VS Code

### New Non-Functional Requirements

- NFR22: Purpose displayed in tmux status bar within 1 second of attach
- NFR23: Live purpose updates reflected in tmux status bar within 30 seconds of change
- NFR24: tmux status bar integration does not interfere with user's tmux configuration outside agent-env instances

### Additional Requirements from Architecture Revision (2026-02-14)

**Revised Naming Model (supersedes flat workspace layout):**
- Instance name is user-chosen, scoped to a repository. Unique key is `(repo-slug, instance-name)`
- Workspace folder structure: `~/.agent-env/workspaces/<repo-slug>-<instance>/` (flat, globally unique basename)
- Repo slug derived from git remote URL (last path segment, minus `.git`)
- Slug compression for slugs > 39 chars: `<first 15>_<6-char SHA-256>_<last 15>`
- Instance name max 20 chars, validated at create time
- Container naming: `ae-<repo-slug>-<instance>` (max 63 chars)
- Two-phase repo resolution: (1) resolve repo from `--repo` or cwd, (2) resolve instance — unambiguous resolves directly, ambiguous errors with suggestion
- BREAKING CHANGE: existing flat workspaces use old compound naming (ad-hoc); new naming uses explicit `<repo-slug>-<instance>`. Old workspaces are NOT detected.
- BREAKING CHANGE: existing state.json schema changes (`name` → `instance`, adds `repoSlug`, `repoUrl`)

**Baseline Config Prompt (supersedes silent copy-if-missing):**
- Repos with `.devcontainer/`: prompt user ("Use repo config or agent-env baseline?")
- `--baseline` flag: force agent-env baseline over repo config, no prompt
- `--no-baseline` flag: use repo config, no prompt
- Create command signature: `agent-env create <name> [--repo <url|.>] [--attach] [--purpose <text>] [--baseline | --no-baseline]`

**Purpose Propagation into Container:**
- Bind-mount `.agent-env/` to `/etc/agent-env/` inside container (read-write)
- Container env vars set in devcontainer.json: `AGENT_ENV_CONTAINER=true`, `AGENT_ENV_INSTANCE=<name>`, `AGENT_ENV_REPO=<repo-slug>`
- tmux status bar reads from `/etc/agent-env/state.json`, `status-interval` set to 15s
- Purpose env var (`$AGENT_ENV_PURPOSE`) set via baseline shell init scripts, reads from state.json per shell session

**agent-env CLI Inside Container:**
- Installed globally via `post-create.sh` (`pnpm add -g @zookanalytics/agent-env`)
- Environment-aware: detects container via `AGENT_ENV_CONTAINER` env var
- Resolves state path to `/etc/agent-env/state.json` when inside container
- Purpose update pipeline: state.json atomic write → VS Code template processing → tmux auto-refresh
- VS Code: `.vscode/statusBar.template.json` → `statusBar.json` with `{{PURPOSE}}` substitution (skipped silently if no template exists)

**Repo Registry (Growth — FR51-53):**
- Derived from existing workspaces, no separate registry file
- `agent-env repos` scans `~/.agent-env/workspaces/*/` and cross-references state.json for full URLs
- Repos disappear from list when all their instances are removed (acceptable for convenience shortcut)

**From Monorepo Brief — Ecosystem Context:**
- agent-env serves the "Isolate" concern
- CLI contracts (`--json` output) are the integration mechanism between tools
- agent-env owns the workspace data directory structure, including reserved path for workflow state
- Components are independently upgradeable — agent-env upgrades without requiring orchestrator changes

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
| FR27 | Epic 2 (original), Epic 7 (revision) | Baseline devcontainer; opt-in prompt added in Epic 7 |
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

| FR43 | Epic 7 | Multi-instance per repo with user-chosen names |
| FR45 | Epic 7 | Source repo visible in list output |
| FR46 | Epic 6 | Purpose set at creation via --purpose flag |
| FR47 | Epic 6 | $AGENT_ENV_INSTANCE env var inside container |
| FR48 | Epic 6 | $AGENT_ENV_PURPOSE env var inside container |
| FR49 | Epic 6 | Instance name + purpose in tmux status bar |
| FR50 | Epic 6 | Live tmux purpose updates (within 30s) |
| FR51 | Epic 8 | Track repos in local registry |
| FR52 | Epic 8 | List tracked repos |
| FR53 | Epic 8 | Create from registered repo |
| FR54 | Epic 8 | VS Code window title shows purpose |

**Coverage:** 53/54 FRs mapped (100% of existing FRs; FR44 absent from PRD numbering)

### NFR Touchpoints by Epic

| Epic | Key NFRs to Address |
|------|---------------------|
| Epic 1 | NFR17 (understandable codebase), NFR18 (clear separation), NFR19 (test coverage), NFR20 (minimal dependencies) |
| Epic 2 | NFR3 (create < 30s cached), NFR4 (time-to-productive < 5s), NFR11-12 (Docker/devcontainer compat), NFR15 (SSH forwarding) |
| Epic 3 | NFR2 (list < 500ms), NFR10 (partial failures don't block), NFR13 (JSON parseable), NFR14 (any git remote) |
| Epic 4 | NFR1 (attach < 2s), NFR8 (tmux persists), NFR16 (works in tmux/screen/bare) |
| Epic 5 | NFR5 (safety check < 3s), NFR6 (zero false negatives), NFR7 (false positives acceptable), NFR9 (state survives restart) |
| Epic 6 | NFR22 (purpose in tmux < 1s attach), NFR23 (live purpose updates < 30s), NFR24 (tmux integration non-interfering) |
| Epic 7 | NFR17 (understandable naming model), NFR18 (clear separation) |
| Epic 8 | NFR17 (understandable codebase) |

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
- Create `packages/agent-env/src/lib/remove-instance.ts` orchestration module (follows attach-instance.ts DI pattern)
- Update `packages/agent-env/src/commands/remove.ts` (replace placeholder)
- Use `getGitState()` from Epic 3 for safety checks
- Add `containerStop(containerName)` to `ContainerLifecycle` interface in `container.ts` — uses `docker stop` with 30 second timeout
- Add `containerRemove(containerName)` to `ContainerLifecycle` interface in `container.ts` — uses `docker rm` to remove stopped container
- Add `deleteWorkspace(wsPath)` to `workspace.ts` — recursively removes the workspace folder at `~/.agent-env/workspaces/<name>/`
- Removal order: run safety checks → stop container → remove container → delete workspace folder
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

### Epic 6: In-Container Purpose & Tmux Visibility
**User Value:** Users always know what they're working on — purpose is visible in the tmux status bar, accessible via env vars, and updatable from anywhere (host CLI or inside the container).

This delivers the "context is always visible" experience from Journey 5 in the PRD. Works with the current flat naming model — no dependency on Epic 7.

**What it delivers:**
- `--purpose` flag on `create` command
- `$AGENT_ENV_INSTANCE`, `$AGENT_ENV_PURPOSE`, `$AGENT_ENV_CONTAINER`, `$AGENT_ENV_REPO` env vars inside container
- tmux status bar shows instance name + purpose
- Live tmux updates within 30 seconds when purpose changes
- Bind-mount `.agent-env/` to `/etc/agent-env/` (read-write)
- agent-env CLI installed inside containers (with dev mode bind-mount for testing unreleased versions)

**FRs covered:** FR46, FR47, FR48, FR49, FR50
**NFRs covered:** NFR22, NFR23, NFR24

**Architecture Decisions (from ADR review):**
- **tmux reads purpose via jq:** `jq -r '"\(.instance // "?") | \(.purpose // "")"' /etc/agent-env/state.json 2>/dev/null || echo "?"` — single invocation for both fields, file guard for missing state. jq is a hard dependency — baseline guarantees it. Non-baseline containers without jq get a clear error message, not a silent fallback. If you opt out of the baseline, you need jq in your image for purpose display.
- **`AGENT_ENV_INSTANCE` is opaque:** With current flat model it's the ad-hoc compound name (e.g., `bmad-orch-auth`). Epic 7 changes it to the explicit `<repo-slug>-<instance>` compound name (still globally unique — flat layout preserved). Consumers treat it as opaque. Zero runtime consumers in image scripts confirmed. The value change is non-breaking.
- **First story is tmux spike:** Validate jq parsing, tmux `status-interval 15`, status bar format before building the full pipeline.
- **CLI-in-container with dev mode:** `post-create.sh` checks for local dev mount at `/opt/agent-env-dev` and runs `pnpm link --global`. Falls back to `pnpm add -g @zookanalytics/agent-env`. Full CLI inside container from day one — required for VS Code template regeneration in Epic 8.
- **Purpose update writes state.json only.** tmux refreshes on its 15s interval. VS Code template regeneration added in Epic 8 by extending the purpose command.

**UX Decisions (from War Room):**
- **Purpose truncation in tmux:** Truncate purpose at 40 characters with `…` in the tmux status script. Full purpose always available via `agent-env purpose <name>`. The bar is a reminder, not the source of truth.
- **No-purpose display:** If purpose is null/empty, show instance name only — no trailing pipe, no placeholder text. Clean and intentional.
- **tmux display improves retroactively after Epic 7:** The tmux status bar reads `.instance` from state.json (via jq), which will be the short user-chosen name (`auth`) instead of the current `.name` compound value (`bmad-orch-auth`). Display changes from `bmad-orch-auth | JWT auth` to `auth | JWT auth`. Note: the `AGENT_ENV_INSTANCE` env var remains a compound name (`<repo-slug>-<instance>`) derived from `localWorkspaceFolderBasename` — the short display is tmux-specific because it reads from state.json. No action needed — it just gets better.
- **tmux testing strategy:** Unit test the jq data extraction command against fixture JSON files (various states: purpose set, purpose null, file missing, malformed JSON). Manual validation for tmux wiring in the spike story. Don't try to mock tmux in vitest.
- **Existing instances:** New baseline features (bind-mount, env vars, tmux status bar, CLI installation) only apply to newly created instances. Existing instances must be recreated. A `rebuild` command is being spec'd separately to address this for future baseline updates. Document in release notes.
- **Parallel development note:** Recommended order is Epic 6 first, then Epic 7. While architecturally independent, simultaneous development creates merge conflicts in 4+ shared files (`create.ts`, `devcontainer.json`, `state.ts`, `workspace.ts`). Sequential development is significantly cleaner.

**Dependencies:** Requires Epics 1-5 (complete). Independent of Epics 7 and 8.

#### Story 6.1: Baseline devcontainer updates for purpose infrastructure

As a user,
I want my container environment to be purpose-aware,
So that the tmux status bar shows what I'm working on as soon as I attach.

**Acceptance Criteria:**

**Given** a newly created instance with purpose "JWT authentication"
**When** I attach to the instance
**Then** the tmux status bar shows `bmad-orch-auth | JWT authentication`
**And** it appears within 1 second of attach (NFR22)

**Given** a newly created instance with no purpose set
**When** I attach to the instance
**Then** the tmux status bar shows only the instance name (e.g., `bmad-orch-auth`)
**And** there is no trailing pipe or placeholder text

**Given** a purpose longer than 40 characters
**When** the tmux status bar renders
**Then** the purpose is truncated at 40 characters with `…`

**Given** the container is running
**When** I check the environment variables
**Then** `$AGENT_ENV_CONTAINER` is `true`
**And** `$AGENT_ENV_INSTANCE` contains the workspace identifier
**And** `$AGENT_ENV_REPO` contains the repo slug

**Given** a non-baseline container image without jq
**When** the tmux status bar script runs
**Then** a clear error message indicates jq is required for purpose display

**Given** the container starts before state.json exists
**When** the tmux status bar refreshes
**Then** it shows `?` (graceful fallback, no crash)

**Technical Requirements:**
- Update `config/baseline/devcontainer.json`: add bind-mount of `.agent-env/` → `/etc/agent-env/` (read-write)
- Update `config/baseline/devcontainer.json`: add `containerEnv` for `AGENT_ENV_CONTAINER`, `AGENT_ENV_INSTANCE`, `AGENT_ENV_REPO`
- Ensure jq available in baseline Dockerfile
- Create tmux status bar script: single jq invocation for instance + purpose, file guard, truncation at 40 chars
- Configure tmux: `status-interval 15`, `status-right` calls the purpose script
- Unit tests: jq extraction against fixture JSON files (purpose set, purpose null, file missing, malformed JSON, purpose >40 chars)
- Manual validation protocol: document exact steps to verify tmux wiring in a running container
- FR47, FR49 covered. NFR22, NFR24 addressed.

---

#### Story 6.2: --purpose flag on create and AGENT_ENV_PURPOSE env var

As a user,
I want to set an instance's purpose at creation time,
So that the context is visible from the very first attach.

**Acceptance Criteria:**

**Given** I run `agent-env create auth --repo <url> --purpose "JWT authentication"`
**When** the instance is created
**Then** state.json contains `"purpose": "JWT authentication"`
**And** the tmux bar shows the purpose on first attach

**Given** I run `agent-env create auth --repo <url>` without `--purpose`
**When** the instance is created
**Then** state.json contains `"purpose": null`
**And** the tmux bar shows instance name only

**Given** an instance with purpose "JWT work"
**When** I open a new shell inside the container
**Then** `$AGENT_ENV_PURPOSE` is set to `JWT work`

**Given** an instance with no purpose
**When** I open a shell inside the container
**Then** `$AGENT_ENV_PURPOSE` is set to an empty string

**Technical Requirements:**
- Add `--purpose <text>` option to create command in `commands/create.ts`
- Write purpose to state.json during instance creation
- Add shell init in baseline config (`.bashrc`/`.zshrc`): `export AGENT_ENV_PURPOSE=$(jq -r '.purpose // ""' /etc/agent-env/state.json 2>/dev/null)`
- Note: env var is set at shell startup, not live-updated. Live updates are via tmux bar (Story 6.1) and purpose command (Story 6.3).
- FR46, FR48 covered.

---

#### Story 6.3: agent-env CLI inside containers with live purpose updates

As a user,
I want to update an instance's purpose from inside the container,
So that I can change context without leaving my working environment.

**Acceptance Criteria:**

**Given** I'm inside a running instance
**When** I run `agent-env purpose "OAuth implementation"`
**Then** the purpose is updated in `/etc/agent-env/state.json`
**And** the tmux status bar reflects the change within 30 seconds (NFR23)

**Given** I'm inside a running instance
**When** I run `agent-env purpose`
**Then** I see the current purpose

**Given** I'm inside a running instance
**When** the purpose command writes state.json
**Then** it uses atomic write (tmp + rename) to prevent corruption

**Given** a newly created instance
**When** the container starts
**Then** `agent-env` CLI is installed globally and available on `$PATH`

**Given** development of agent-env itself
**When** a local dev mount exists at `/opt/agent-env-dev`
**Then** `post-create.sh` links the local build instead of installing from npm

**Given** no local dev mount exists
**When** `post-create.sh` runs
**Then** it installs the published version via `pnpm add -g @zookanalytics/agent-env`

**Given** the purpose command runs inside a container
**When** it detects `$AGENT_ENV_CONTAINER=true`
**Then** it resolves state path to `/etc/agent-env/state.json`

**Given** the purpose command runs on the host
**When** it detects no `$AGENT_ENV_CONTAINER` env var
**Then** it resolves state path via the normal workspace directory lookup

**Technical Requirements:**
- Update `config/baseline/post-create.sh`: install agent-env CLI (dev mode check for `/opt/agent-env-dev`, fallback to npm)
- Add `isInsideContainer()` helper to detect container environment via `$AGENT_ENV_CONTAINER`
- Add `resolveStatePath()` that returns `/etc/agent-env/state.json` inside container, normal workspace path on host
- Update existing purpose command (`commands/purpose.ts` and `lib/purpose-instance.ts`) to be environment-aware
- Verify atomic write works across bind-mount (tmp + rename in same filesystem)
- FR50, NFR23 covered.

---

### Epic 7: Naming Model, Multi-Instance & Baseline Prompt
**User Value:** Users can create multiple instances from the same repo with clean, user-friendly names, see which repo each instance belongs to, and choose their container configuration preference.

Focused on the naming/workspace refactor plus baseline config prompt. No migration code — negligible existing instances.

**What it delivers:**
- Multiple instances from same repo with user-chosen names
- Flat workspace layout with repo-scoped naming: `~/.agent-env/workspaces/<repo-slug>-<instance>/`
- Repo slug derivation and compression for long names (>39 chars)
- Two-phase repo resolution (repo context from `--repo`/cwd, then instance lookup)
- Source repo visible in `list` output
- Updated state schema (`name` → `instance`, adds `repoSlug`, `repoUrl`)
- Baseline config prompt for repos with `.devcontainer/` (+ `--baseline`/`--no-baseline` flags)

**FRs covered:** FR43, FR45, FR27 (revision)

**Architecture Decisions (from ADR review):**
- **No migration code.** Negligible existing instances. Old flat-layout workspaces are NOT detected by the new code. This is intentional — documented as such in code comments and epic description. Users recreate instances if needed.
- **Two-phase resolution edge case matrix in ACs:** no remote, multiple remotes, fork remote, subdirectory of git repo, no .git directory, bare repo, remote URL mismatch.
- **AGENT_ENV_INSTANCE updates:** When Epic 7 lands, the env var value changes from old ad-hoc compound name to new explicit `<repo-slug>-<instance>`. Non-breaking — consumers treat it as opaque per ADR-E6-2. Confirmed: zero runtime consumers in image scripts.
- **Baseline prompt stories:** (1) prompt logic when repo has `.devcontainer/`, (2) `--baseline`/`--no-baseline` flag handling. Three states: force-baseline, force-repo-config, ask-user (default when repo has `.devcontainer/`).

**UX Decisions (from War Room):**
- **Baseline prompt default:** When user presses Enter without choosing, default to "use repo config" (respect repo authors' intent). `--baseline` flag exists for users who know they want agent-env's setup.
- **First story is state schema + naming refactor:** Story 7.1 updates `createWorkspace()` to use `<repo-slug>-<instance>` naming, updates state.json schema (`name` → `instance`, adds `repoSlug`/`repoUrl`), and updates ALL consumers: `list-instances.ts`, `attach-instance.ts`, `remove-instance.ts`, `purpose-instance.ts`, `interactive-menu.ts`, `commands/list.ts`, plus Epic 6 state.json consumers (`tmux-purpose.sh`, `purpose-instance.ts` container handlers, `tmux-purpose.test.ts`). Scanning glob (`workspaces/*/`) is unchanged. This is the foundation — subsequent stories add new features (slug compression, two-phase resolution, baseline prompt) on top.
- **Flat layout decision:** Nested layout (`workspaces/<repo-slug>/<instance>/`) was rejected because `localWorkspaceFolderBasename` would lose global uniqueness, breaking named Docker volumes, `AGENT_INSTANCE`, and any system using the folder basename as a unique key. Flat layout with `<repo-slug>-<instance>` naming preserves global uniqueness with zero workarounds. See architecture.md "Decision: Instance Naming Model (Revised)" for full rationale.

**Dependencies:** Requires Epics 1-5 (complete). Independent of Epics 6 and 8.

#### Story 7.1: Refactor workspace naming and state schema for repo-scoped instances

As a developer,
I want workspaces named with explicit repo-slug-instance format and state.json carrying structured fields,
So that instances are scoped to repositories with globally unique workspace identifiers.

**Acceptance Criteria:**

**Given** I create an instance "auth" for repo `bmad-orchestrator`
**When** the workspace is created
**Then** it exists at `~/.agent-env/workspaces/bmad-orchestrator-auth/`
**And** state.json contains `"instance": "auth"`, `"repoSlug": "bmad-orchestrator"`, `"repoUrl": "<full URL>"`

**Given** workspaces exist at `~/.agent-env/workspaces/bmad-orch-auth/` and `~/.agent-env/workspaces/awesome-cli-bugfix/`
**When** `scanWorkspaces()` is called
**Then** both instances are returned with their repo slug and instance name (from state.json, not parsed from directory name)

**Given** old-format workspaces exist (pre-Epic 7 compound names like `bmad-orch-auth`)
**When** `scanWorkspaces()` is called
**Then** old workspaces with missing `repoSlug`/`instance` fields in state.json are NOT detected
**And** this is documented in code comments as intentional

**Given** I run `agent-env list`
**When** instances exist across multiple repos
**Then** all instances are listed correctly with updated field names

**Given** I run `agent-env attach auth`
**When** the instance exists
**Then** attach works with the new naming scheme

**Given** I run `agent-env remove auth`
**When** the instance passes safety checks
**Then** remove works with the new naming scheme

**Given** I run `agent-env purpose auth "new purpose"`
**When** the instance exists
**Then** purpose command works with the new naming scheme

**Technical Requirements:**
- Update `lib/workspace.ts`: `createWorkspace()` uses `<repo-slug>-<instance>` naming; scanning glob unchanged (`workspaces/*/`)
- Update `lib/state.ts`: schema change (`name` → `instance`, add `repoSlug`, `repoUrl`)
- Update `lib/types.ts`: `InstanceState` interface reflects new fields; preserve existing `configSource?: 'baseline' | 'repo'` and `lastRebuilt?: string` fields
- Update ALL consumers: `list-instances.ts`, `attach-instance.ts`, `remove-instance.ts`, `purpose-instance.ts`, `interactive-menu.ts`, `commands/list.ts`, `rebuild-instance.ts`, `commands/rebuild.ts`
- Update ALL state.json consumers added in Epic 6:
  - `image/scripts/tmux-purpose.sh`: reads `.name` from state.json via jq; update field reference `.name` to `.instance`
  - `packages/agent-env/src/lib/purpose-instance.ts`: `getContainerPurpose()` and `setContainerPurpose()` read/write state.json; update for new schema (`name` → `instance`, new `repoSlug`/`repoUrl`). `setContainerPurpose()` constructs a `WorkspacePath` with `name: read.state.name` — must change to match new field.
  - `packages/agent-env/src/lib/tmux-purpose.test.ts`: test fixtures with state.json format; update to new schema
- Note: `AGENT_INSTANCE` and `AGENT_ENV_INSTANCE` are unaffected — flat layout preserves `localWorkspaceFolderBasename` as globally unique compound name. No image script changes needed for the naming refactor.
- Fix `grep -q` → `grep -qF` and add sed marker escaping in `image/scripts/setup-instance-isolation.sh` Steps 9 and 11: marker strings contain bracket characters (`[setup-instance-isolation:...]`) treated as regex metacharacters. Step 11b (added in Epic 6) already uses `grep -qF` and escapes the marker for sed via `ESCAPED_MARKER=$(printf '%s' "$MARKER" | sed 's/[][\\.^$*]/\\&/g')`. Steps 9 and 11 predate Epic 6 and must be updated to match both patterns: (1) `grep -q` → `grep -qF` for fixed-string detection, (2) add `ESCAPED_MARKER` for sed replacement patterns.
- Update test fixtures to new state schema
- All existing tests must pass after refactor (adapt to new schema)
- FR43 (partially — workspace structure), FR45 (partially — state has repo info)

---

#### Story 7.2: Repo slug derivation, compression, and instance name validation

As a user,
I want instance names to be short and user-chosen,
So that I can type quick names like `auth` instead of `bmad-orchestrator-auth`.

**Acceptance Criteria:**

**Given** a repo URL `https://github.com/user/bmad-orchestrator.git`
**When** the slug is derived
**Then** it is `bmad-orchestrator` (last path segment, minus `.git`)

**Given** a repo URL `https://github.com/user/bmad-orchestrator` (no `.git`)
**When** the slug is derived
**Then** it is `bmad-orchestrator`

**Given** a repo slug longer than 39 characters (e.g., `my-extremely-long-repository-name-that-exceeds-limit`)
**When** the slug is compressed
**Then** it becomes `my-extremely-lo_<6-char SHA-256>_ceeds-limit` (38 chars max)
**And** compression is deterministic (same input → same output)

**Given** I run `agent-env create auth --repo <url>`
**When** the instance name "auth" is 20 characters or fewer
**Then** the instance is created successfully

**Given** I run `agent-env create this-name-is-way-too-long --repo <url>`
**When** the instance name exceeds 20 characters
**Then** I get a clear error: "Instance name must be 20 characters or fewer"
**And** no workspace is created

**Given** I run `agent-env create auth --repo <url>` and instance "auth" already exists for that repo
**When** the create is attempted
**Then** I get error "Instance 'auth' already exists for repo 'bmad-orchestrator'"

**Given** the container is created
**When** the container name is generated
**Then** it follows the pattern `ae-<repo-slug>-<instance>` (max 63 chars)

**Technical Requirements:**
- Create `deriveRepoSlug(url: string): string` in `lib/workspace.ts`
- Create `compressSlug(slug: string): string` with SHA-256 deterministic compression
- Add instance name validation: max 20 chars, reject with clear error
- Update `createWorkspace()` to use slug derivation
- Container naming: `ae-${repoSlug}-${instance}`
- Comprehensive unit tests: various URL formats (HTTPS, SSH, with/without .git), slug compression edge cases, name validation
- FR43 covered.

---

#### Story 7.3: Two-phase repo resolution for commands

As a user,
I want commands to resolve instance names intelligently,
So that I can type `agent-env attach auth` without specifying the repo every time.

**Acceptance Criteria:**

**Given** I'm in a directory with git remote `bmad-orchestrator` and instance "auth" exists for that repo
**When** I run `agent-env attach auth`
**Then** it resolves to the `bmad-orchestrator-auth` workspace (cwd provides repo context)

**Given** I run `agent-env attach auth --repo bmad-orchestrator`
**When** instance "auth" exists for that repo
**Then** it resolves directly (explicit repo takes priority over cwd)

**Given** I'm NOT in a git directory and instance "auth" exists for exactly one repo
**When** I run `agent-env attach auth`
**Then** it resolves to the single match (unambiguous global lookup)

**Given** instance "auth" exists for both `bmad-orchestrator` and `awesome-cli`
**When** I run `agent-env attach auth` without `--repo` and not in either repo's directory
**Then** I get error: "Multiple instances named 'auth' exist. Specify --repo."

**Given** I'm in the `awesome-cli` directory but "auth" only exists under `bmad-orchestrator`
**When** I run `agent-env attach auth`
**Then** it resolves to `bmad-orchestrator-auth` (cwd narrows scope but doesn't block resolution)

**Given** I'm in a subdirectory of a git repo
**When** I run `agent-env attach auth`
**Then** repo context is detected from the parent git root (not just the current directory)

**Given** I'm in a directory with no git remote (no origin)
**When** I run `agent-env create feature --repo .`
**Then** I get error: "No git remote found in current directory"

**Given** I'm in a directory with multiple git remotes
**When** repo context is inferred
**Then** `origin` is used as the default remote

**Technical Requirements:**
- Create `resolveInstance(name: string, opts: { repo?: string }): ResolvedInstance` in `lib/workspace.ts`
- Phase 1: resolve repo from `--repo` flag (explicit) → cwd git remote (implicit) → none
- Phase 2: resolve instance scoped to repo → fallback to global unambiguous search → error on ambiguity
- Apply resolution to all commands: `attach`, `remove`, `purpose`, `list --repo` filter
- Edge case test matrix: no remote, multiple remotes, fork remote, subdirectory, no .git, bare repo, remote URL mismatch
- Unit tests for each resolution scenario

---

#### Story 7.4: Source repo in list output

As a user,
I want to see which repo each instance belongs to in the list output,
So that I can distinguish instances from different repos at a glance.

**Acceptance Criteria:**

**Given** instances exist across multiple repos
**When** I run `agent-env list`
**Then** each instance shows its repo slug in a "Repo" column

**Given** I run `agent-env list --json`
**When** instances exist
**Then** each instance object includes `"repoSlug": "..."` and `"repoUrl": "..."`

**Given** I run `agent-env list --repo bmad-orchestrator`
**When** instances exist for that repo and others
**Then** only instances for `bmad-orchestrator` are shown

**Technical Requirements:**
- Update `components/InstanceList.tsx`: add Repo column
- Update `commands/list.ts`: add `--repo` filter option
- Update JSON output to include `repoSlug` and `repoUrl`; preserve existing `sshConnection` field in JSON mapping
- FR45 covered.

---

#### Story 7.5: Baseline config prompt with flag overrides

As a user,
I want to choose whether to use a repo's devcontainer config or agent-env's baseline,
So that I get the right environment for each use case.

**Acceptance Criteria:**

**Given** I create an instance from a repo WITHOUT `.devcontainer/`
**When** the create command runs
**Then** agent-env baseline is applied automatically (no prompt)

**Given** I create an instance from a repo WITH `.devcontainer/`
**When** the create command runs without `--baseline` or `--no-baseline`
**Then** I'm prompted: "This repo has a .devcontainer/ config. Use repo config or agent-env baseline?"
**And** pressing Enter without choosing defaults to "use repo config"

**Given** I run `agent-env create auth --repo <url> --baseline`
**When** the repo has its own `.devcontainer/`
**Then** agent-env baseline overrides the repo config without prompting

**Given** I run `agent-env create auth --repo <url> --no-baseline`
**When** the repo has its own `.devcontainer/`
**Then** the repo's config is used without prompting

**Given** I pass both `--baseline` and `--no-baseline`
**When** the command parses arguments
**Then** I get an error: "Cannot specify both --baseline and --no-baseline"

**Technical Requirements:**
- Add `--baseline` and `--no-baseline` mutually exclusive flags to create command
- Detect `.devcontainer/` in cloned repo before applying config
- Interactive prompt using Ink Select component
- Default selection: "Use repo config" (first option, selected on Enter)
- Three states: force-baseline, force-repo-config, ask-user
- Non-TTY fallback: when stdin is not a TTY (piped, CI, scripted), default to "use repo config" without prompting
- FR27 (revision) covered.

---

### Epic 8: Growth — Repo Registry & VS Code Purpose
**User Value:** Users can quickly spin up new instances from known repos without re-entering URLs, and see instance purpose in VS Code window titles.

**What it delivers:**
- `agent-env repos` command lists tracked repositories
- Repo registry derived from existing workspaces (no separate file)
- Create from registered repo without re-entering URL
- VS Code window title shows purpose via `better-status-bar` extension integration

**FRs covered:** FR51, FR52, FR53, FR54

**VS Code integration (proven pattern, ADR-E8-1):**
1. User installs `RobertOstermann.better-status-bar` VS Code extension — reads `.vscode/statusBar.json` and renders status bar items
2. Baseline ships a default `.vscode/statusBar.template.json` with `{{PURPOSE}}` placeholder following the better-status-bar schema (repos can customize)
3. Purpose value lives in `state.json` (single source of truth)
4. `agent-env purpose` command (already inside container via Epic 6) reads purpose, does string replacement of `{{PURPOSE}}` in template, writes result to `.vscode/statusBar.json`
5. Regeneration is conditional — if `.vscode/statusBar.template.json` exists, regenerate. If not, skip silently.
6. `.vscode/statusBar.json` is gitignored (generated file). Template is checked in.
7. No file watchers — deliberate regeneration triggered by purpose command only.

**Confirmed:** By end of Epic 8, `agent-env purpose <name> "text"` inside container:
1. Updates `/etc/agent-env/state.json` (atomic write)
2. Regenerates `.vscode/statusBar.json` from template if template exists
3. tmux picks up the change on next 15s refresh

#### Story 8.1: Repo registry command

As a user,
I want to see which repositories I've used before,
So that I can quickly create new instances from known repos without re-entering URLs.

**Acceptance Criteria:**

**Given** I have instances for repos `bmad-orchestrator` and `awesome-cli`
**When** I run `agent-env repos`
**Then** I see a list showing each repo slug and its full URL

**Given** I have no instances
**When** I run `agent-env repos`
**Then** I see "No repositories tracked. Create an instance with: agent-env create <name> --repo <url>"

**Given** I remove all instances for `awesome-cli`
**When** I run `agent-env repos`
**Then** `awesome-cli` no longer appears (registry derived from existing workspaces)

**Given** I run `agent-env repos --json`
**When** repos exist
**Then** I get JSON output: `{ "ok": true, "data": [{ "slug": "...", "url": "...", "instanceCount": N }], "error": null }`

**Technical Requirements:**
- Create `commands/repos.ts`
- Scan `~/.agent-env/workspaces/*/` directory names for repo slugs
- Cross-reference with `state.json` in each instance for full URLs
- Display: repo slug, full URL, number of instances
- `--json` flag for scripted output
- FR51, FR52 covered.

---

#### Story 8.2: Create from registered repo

As a user,
I want to create instances from known repos by slug instead of full URL,
So that I can spin up new environments faster.

**Acceptance Criteria:**

**Given** I previously created an instance from `https://github.com/user/bmad-orchestrator`
**When** I run `agent-env create feature --repo bmad-orchestrator`
**Then** the repo slug is recognized and the full URL is resolved from the registry
**And** the instance is created normally

**Given** I run `agent-env create feature --repo unknown-repo`
**When** the slug matches no tracked repository
**Then** I get error: "Repository 'unknown-repo' not found. Use a full URL or run `agent-env repos` to see tracked repos."

**Given** I run `agent-env create feature --repo https://github.com/user/new-repo`
**When** the value looks like a URL (contains `://` or starts with `git@`)
**Then** it's treated as a URL directly (not a slug lookup)

**Technical Requirements:**
- Update create command to detect slug vs URL input
- URL detection: contains `://` or starts with `git@`
- Slug resolution: scan workspace directories, find matching repo slug, read state.json for full URL
- FR53 covered.

---

#### Story 8.3: VS Code purpose visibility via better-status-bar

As a user,
I want to see my instance purpose in the VS Code status bar,
So that I know which workstream I'm in when using VS Code.

**Acceptance Criteria:**

**Given** a `.vscode/statusBar.template.json` exists in the workspace with `{{PURPOSE}}` placeholder
**When** I run `agent-env purpose auth "JWT authentication"`
**Then** `.vscode/statusBar.json` is generated with `{{PURPOSE}}` replaced by `JWT authentication`

**Given** NO `.vscode/statusBar.template.json` exists in the workspace
**When** I run `agent-env purpose auth "JWT authentication"`
**Then** no `.vscode/statusBar.json` is generated (skipped silently)
**And** state.json is still updated normally

**Given** the baseline devcontainer config
**When** a new instance is created
**Then** a default `.vscode/statusBar.template.json` is included with purpose display following the better-status-bar schema

**Given** `agent-env purpose auth "OAuth"` is run inside the container
**When** the purpose command completes
**Then** both state.json AND statusBar.json are updated atomically

**Given** the `.vscode/statusBar.json` file
**When** I check `.gitignore`
**Then** `.vscode/statusBar.json` is gitignored (generated file)

**Given** the better-status-bar extension is installed in VS Code
**When** `.vscode/statusBar.json` is regenerated
**Then** the VS Code status bar updates to show the new purpose

**Technical Requirements:**
- Update purpose command pipeline: after writing state.json, check for `.vscode/statusBar.template.json` in workspace root
- If template exists: read template, replace all `{{PURPOSE}}` occurrences, write to `.vscode/statusBar.json`
- Ship default template in baseline config based on the `statusBarTemplate.example` pattern
- Add `.vscode/statusBar.json` to baseline `.gitignore`
- Works from both host and inside container (same code path — template is in workspace, accessible from both)
- FR54 covered.

---

**Deferrability:** System is fully functional without Epic 8. Repo registry is a convenience — `--repo .` covers most cases without re-entering URLs. VS Code purpose is polish for users who work in VS Code alongside tmux. Neither feature is a hidden dependency for Epics 6 or 7.

**Dependencies:** Requires Epic 7 (repo registry needs repo-scoped workspace structure for scanning). VS Code purpose story requires Epic 6 (purpose in state.json + CLI inside container).

---

## Epic Dependencies

```
Epics 1-5 (Complete)
    ↓
Epic 1 (Foundation)
    ↓
Epic 2 (Create) ──→ Epic 3 (List/Git) ──→ Epic 5 (Remove)
                          ↓
                    Epic 4 (Access)

    ↓ (All complete)

    ├── Epic 6 (Purpose & Tmux)  ─────┐
    │                                  ├──→ Epic 8 (Growth)
    └── Epic 7 (Naming & Baseline) ───┘
```

**Dependency Notes (Epics 1-5, unchanged):**
- Epic 1 must complete first (project infrastructure)
- Epic 2 can proceed independently after Epic 1
- Epic 3 depends on Epic 2 (needs instances to list)
- Epic 4 depends on Epic 2 (needs instances to attach to)
- Epic 5 depends on Epic 3 (uses `git.ts` module)
- Epics 3 and 4 can be developed in parallel after Epic 2

**Dependency Notes (Epics 6-8, new):**
- Epics 6 and 7 can be done in any order (no mutual dependency)
- Epic 8 requires both Epic 6 (purpose pipeline + CLI inside container) and Epic 7 (repo-scoped workspaces for scanning)
- Recommended order: Epic 6 first (most user-visible, immediate daily value), then Epic 7 (architectural improvement), then Epic 8 (Growth polish)
- Epics 6 and 7 both touch the create command — if developed concurrently, expect merge conflicts

**Standalone Guarantee:** Each epic delivers complete, usable functionality. Epic 2 works without needing list/remove. Epic 3 works without attach. Epic 4 works without remove. Epic 6 works without naming refactor. Epic 7 works without purpose propagation.

## Cross-Cutting Concerns

### Network Failure Handling

All network-dependent operations (clone, container pull, push) should follow this pattern:
- Timeout after reasonable duration (30s for clone, 60s for container operations)
- Clear error messages indicating network issue vs authentication issue
- Exit codes distinguish between transient failures (retry-able) and permanent failures
- No partial state left behind on failure (rollback or atomic operations)
