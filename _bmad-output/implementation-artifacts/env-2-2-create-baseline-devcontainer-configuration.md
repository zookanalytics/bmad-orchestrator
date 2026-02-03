# Story 2.2: Create Baseline Devcontainer Configuration

Status: done

## Story

As a **user**,
I want **new instances to come with a fully-configured dev environment**,
So that **I can start coding immediately with all tools ready**.

## Acceptance Criteria

1. **Given** I create a new instance
   **When** the container starts
   **Then** Claude Code CLI is installed and authenticated
   **And** authentication uses host credentials via mounted `~/.claude/` config directory

2. **Given** a running instance
   **When** I make a git commit
   **Then** the commit is signed (git signing configured)

3. **Given** a running instance
   **When** I run `ssh -T git@github.com`
   **Then** I see "Hi username! You've successfully authenticated" (SSH agent forwarding verified)

4. **Given** a running instance
   **When** I attach
   **Then** I'm connected to a tmux session that persists across attach/detach

5. **Given** a running instance
   **When** I open a shell
   **Then** the shell is properly configured (zsh/bash with expected dotfiles)

6. **Given** a cached base image exists locally
   **When** I run `agent-env create`
   **Then** the container is ready in <30 seconds (NFR3)

## Tasks / Subtasks

- [x] Task 1: Create baseline devcontainer.json configuration (AC: #1, #2, #3, #4, #5)
  - [x] 1.1 Create `config/baseline/devcontainer.json` with base image and container settings
  - [x] 1.2 Configure Claude Code auth via host mount: `~/.claude:/home/node/.claude:ro`
  - [x] 1.3 Configure SSH agent socket forwarding (handle macOS SSH_AUTH_SOCK path)
  - [x] 1.4 Configure git signing (GPG or SSH)
  - [x] 1.5 Configure tmux to auto-start with persistent session
  - [x] 1.6 Configure shell (zsh preferred)

- [x] Task 2: Create baseline Dockerfile (AC: #1, #6)
  - [x] 2.1 Create `config/baseline/Dockerfile` based on Node.js image
  - [x] 2.2 Install Claude Code CLI, tmux, zsh, git, and SSH tools
  - [x] 2.3 Configure non-root user (node)
  - [x] 2.4 Set up post-create script for runtime initialization

- [x] Task 3: Create devcontainer config module (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Create `packages/agent-env/src/lib/devcontainer.ts` with config generation
  - [x] 3.2 Implement `getBaselineConfigPath()` to locate bundled baseline config
  - [x] 3.3 Implement `copyBaselineConfig(workspacePath)` to copy config to workspace
  - [x] 3.4 Implement `hasDevcontainerConfig(workspacePath)` to check if repo already has config

- [x] Task 4: Write comprehensive tests (AC: #1, #2, #3, #4, #5)
  - [x] 4.1 Create `packages/agent-env/src/lib/devcontainer.test.ts`
  - [x] 4.2 Test getBaselineConfigPath() returns valid path
  - [x] 4.3 Test copyBaselineConfig() copies devcontainer.json and Dockerfile correctly
  - [x] 4.4 Test copyBaselineConfig() creates .devcontainer/ directory if missing
  - [x] 4.5 Test hasDevcontainerConfig() detects existing config
  - [x] 4.6 Test hasDevcontainerConfig() returns false when no config exists
  - [x] 4.7 Validate devcontainer.json is valid JSON with required fields
  - [x] 4.8 Validate Dockerfile has correct base image and installs

- [x] Task 5: Run full test suite and verify no regressions (AC: all)
  - [x] 5.1 Run `pnpm --filter @zookanalytics/agent-env test:run`
  - [x] 5.2 Run `pnpm -r test:run` for all packages
  - [x] 5.3 Run `pnpm --filter @zookanalytics/agent-env type-check`

## Dev Notes

### Previous Story Context

**Story 2.1 (complete)** established:
- `packages/agent-env/src/lib/types.ts` with InstanceState, WorkspacePath interfaces
- `packages/agent-env/src/lib/workspace.ts` with createWorkspace(), scanWorkspaces(), etc.
- `packages/agent-env/src/lib/state.ts` with readState(), writeStateAtomic(), createInitialState()
- DI pattern for all filesystem operations
- Co-located test pattern with fixtures

### Architecture Requirements

**Baseline Configuration:**
- Ships with npm package, versioned with agent-env releases
- Located at `config/baseline/` relative to package root
- Contains `devcontainer.json` and `Dockerfile`
- Base image: `ghcr.io/zookanalytics/agent-env-base:<version>`
- Baseline-only MVP (no repo-specific config overrides)

**Configuration Features:**
- Claude Code CLI installed and authenticated via host mount (~/.claude)
- Git signing (SSH preferred for modern setups)
- SSH agent socket forwarding from host
- tmux auto-start with persistent session
- zsh shell configuration
- Non-root user (node)

**Create Flow Integration:**
- Step 2 of create: "Copy baseline devcontainer.json if no .devcontainer/ exists"
- This module provides the copy logic that create command will use

**Critical Rules:**
- Use `.js` extension for all ESM imports
- Follow dependency injection pattern for testability
- Co-located tests
- Use node:fs/promises for async filesystem operations

### References

- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md]
- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-2.2]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Created `packages/agent-env/config/baseline/devcontainer.json` with full baseline configuration:
  - Claude Code auth via read-only host mount of `~/.claude/`
  - SSH agent socket forwarding via bind mount of `SSH_AUTH_SOCK`
  - zsh as default shell
  - tmux auto-start via `postStartCommand` creating persistent "main" session
  - Non-root `node` user
  - Git and git-lfs devcontainer features
  - `postCreateCommand` for runtime initialization
- Created `packages/agent-env/config/baseline/Dockerfile` based on `node:22-bookworm-slim`:
  - Installs Claude Code CLI (`@anthropic-ai/claude-code`) globally
  - Installs tmux, zsh, git, gnupg, openssh-client, curl
  - Configures non-root `node` user with sudo access
  - Sets zsh as default shell
- Created `packages/agent-env/config/baseline/git-config` with SSH-based git signing defaults
- Created `packages/agent-env/config/baseline/post-create.sh` for runtime initialization (git config include, SSH permissions, tool verification)
- Created `packages/agent-env/src/lib/devcontainer.ts` with DI-injectable functions:
  - `getBaselineConfigPath()` - locates bundled config using `import.meta.url`
  - `hasDevcontainerConfig()` - detects existing `.devcontainer/` dir or `.devcontainer.json` file
  - `copyBaselineConfig()` - copies baseline to workspace `.devcontainer/`
  - `listBaselineFiles()` - lists baseline directory contents
- Created 35 comprehensive tests covering:
  - Path resolution (3 tests)
  - Config detection with edge cases (5 tests)
  - Config copying with verification of all files (7 tests)
  - File listing (4 tests)
  - devcontainer.json validation (7 tests: JSON validity, required fields, Claude auth mount, SSH agent, tmux, zsh)
  - Dockerfile validation (9 tests: base image, all tool installs, non-root user, shell config, gnupg)
- Updated `package.json` to include `config/` in `files` field for npm publishing
- All 167 tests pass across all packages (0 regressions)
- TypeScript type-check passes cleanly

### Change Log

- 2026-02-02: Implemented baseline devcontainer configuration with Dockerfile, config module, and 35 tests
- 2026-02-02: Code review fixes - fixed post-create.sh race condition, added .devcontainer.json detection, added test

### File List

**New Files:**
- packages/agent-env/config/baseline/devcontainer.json
- packages/agent-env/config/baseline/Dockerfile
- packages/agent-env/config/baseline/git-config
- packages/agent-env/config/baseline/post-create.sh
- packages/agent-env/src/lib/devcontainer.ts
- packages/agent-env/src/lib/devcontainer.test.ts

**Deleted Files:**
- packages/agent-env/src/lib/.gitkeep (no longer needed, real files exist in directory)

**Modified Files:**
- packages/agent-env/package.json (added `config` to `files` array)
- _bmad-output/implementation-artifacts/sprint-status.yaml (env-2-2 status updated)
