# Story 2.4: Implement Create Command (Basic)

Status: done

## Story

As a **user**,
I want **to create a new instance from a git repository**,
So that **I can start working in an isolated environment**.

## Acceptance Criteria

1. **Given** I run `agent-env create auth --repo https://github.com/user/bmad-orch`
   **When** the command completes
   **Then** the repo is cloned to `~/.agent-env/workspaces/bmad-orch-auth/`
   **And** the baseline devcontainer is copied (if no .devcontainer exists)
   **And** the container is running
   **And** state.json is written with creation timestamp

2. **Given** I run `agent-env create auth --repo git@github.com:user/repo.git`
   **When** the command completes
   **Then** SSH clone works correctly

3. **Given** the instance name already exists
   **When** I try to create it
   **Then** I get an error "Instance 'auth' already exists"
   **And** no changes are made

4. **Given** the clone fails (invalid URL, no access)
   **When** the error occurs
   **Then** I get a clear error message with code `GIT_ERROR`
   **And** no partial workspace is left behind

5. **Given** container startup fails after clone succeeds
   **When** the error occurs
   **Then** the workspace folder is cleaned up (rolled back)
   **And** I get a clear error message with code `CONTAINER_ERROR`
   **And** the cleanup is logged for debugging

## Tasks / Subtasks

- [x] Task 1: Add URL parsing utility and create error codes (AC: #1, #2, #4)
  - [x] 1.1 Create `extractRepoName(url)` function to extract repo name from HTTPS and SSH URLs
  - [x] 1.2 Add GIT_CLONE_TIMEOUT constant
  - [x] 1.3 Write tests for URL parsing (HTTPS, SSH, .git suffix, edge cases)

- [x] Task 2: Implement create instance orchestration logic (AC: #1, #2, #3, #4, #5)
  - [x] 2.1 Create `packages/agent-env/src/lib/create-instance.ts` with DI pattern
  - [x] 2.2 Implement `createInstance(instanceName, repoUrl)` orchestrating: clone → copy baseline → devcontainer up → write state
  - [x] 2.3 Implement duplicate instance detection (check workspace exists before starting)
  - [x] 2.4 Implement git clone via subprocess executor
  - [x] 2.5 Implement rollback on failure (clean up workspace folder if any step fails)
  - [x] 2.6 Write comprehensive tests with mocked subprocess (13 createInstance tests + 10 extractRepoName tests)

- [x] Task 3: Replace create command placeholder with real implementation (AC: #1, #2, #3, #4, #5)
  - [x] 3.1 Update `packages/agent-env/src/commands/create.ts` with real action handler
  - [x] 3.2 Validate --repo flag is required (MISSING_OPTION error)
  - [x] 3.3 Show progress messages and colored success/error output
  - [x] 3.4 Update CLI tests for new create command behavior

- [x] Task 4: Run full test suite and verify no regressions (AC: all)
  - [x] 4.1 Run `pnpm --filter @zookanalytics/agent-env test:run` — 133 tests pass
  - [x] 4.2 Run `pnpm -r test:run` for all packages — 209 tests pass (25 shared + 51 orchestrator + 133 agent-env)
  - [x] 4.3 Run `pnpm --filter @zookanalytics/agent-env type-check` — clean

## Dev Notes

### Previous Story Context

**Story 2.1 (complete)** established:
- `packages/agent-env/src/lib/types.ts` with InstanceState, WorkspacePath interfaces
- `packages/agent-env/src/lib/workspace.ts` with createWorkspace(), scanWorkspaces(), workspaceExists()
- `packages/agent-env/src/lib/state.ts` with readState(), writeStateAtomic(), createInitialState()
- DI pattern for all filesystem and subprocess operations
- Co-located test pattern with fixtures

**Story 2.2 (complete)** established:
- `packages/agent-env/config/baseline/` with devcontainer.json, Dockerfile, git-config, post-create.sh
- `packages/agent-env/src/lib/devcontainer.ts` with hasDevcontainerConfig(), copyBaselineConfig()
- Baseline devcontainer configuration with Claude Code, SSH, tmux, git signing

**Story 2.3 (complete)** established:
- `packages/agent-env/src/lib/container.ts` with createContainerLifecycle() factory
- devcontainerUp(), containerStatus(), isDockerAvailable()
- ContainerStatus, ContainerResult types
- Timeout constants and error handling patterns

### Architecture Requirements

**Create Command Flow:**
1. Parse `--repo` flag for repository URL
2. Extract repo name from URL (last path segment, minus .git)
3. Derive workspace name: `<repo-name>-<instance-name>`
4. Check if workspace already exists (error if duplicate)
5. Clone repo using git CLI to workspace path
6. Copy baseline config if no .devcontainer/ exists in cloned repo
7. Call `devcontainerUp()` to start the container
8. Write initial state.json with creation timestamp
9. On any failure after workspace creation, rollback (rm -rf workspace)

**Subprocess Pattern:**
- Use `createExecutor()` from `@zookanalytics/shared` for subprocess calls
- Always `reject: false` pattern
- Check `result.ok` before using stdout
- Inject executor for testability

**Error Codes:**
- `GIT_ERROR` - Git clone failure
- `CONTAINER_ERROR` - Container startup failure
- `INSTANCE_EXISTS` - Instance name already taken
- `MISSING_OPTION` - Required CLI option not provided

**Critical Rules:**
- Use `.js` extension for all ESM imports
- Follow dependency injection pattern for testability
- Co-located tests
- Never call real `git`, `docker`, or `devcontainer` in tests - mock subprocess

### References

- [Source: _bmad-output/planning-artifacts/agent-env/architecture.md]
- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-2.4]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Created `packages/agent-env/src/lib/create-instance.ts` with full create orchestration:
  - `extractRepoName(url)` - Extracts repo name from HTTPS and SSH git URLs, strips `.git` suffix
  - `createInstance(instanceName, repoUrl, deps)` - Full create flow: validate URL → check duplicates → git clone → copy baseline devcontainer → start container → write state.json
  - `createDefaultDeps()` - Factory for production dependencies
  - `GIT_CLONE_TIMEOUT` constant (120 seconds)
  - `safeRollback()` - Removes workspace directory on failure without throwing
  - `CreateInstanceDeps` interface with full DI for executor, container lifecycle, fs ops, and rm
  - `CreateResult` interface for structured success/error responses
- Created comprehensive test suite in `create-instance.test.ts` with 23 tests:
  - 10 tests for `extractRepoName` (HTTPS, SSH, .git suffix, trailing slashes, nested paths, edge cases)
  - 13 tests for `createInstance` (success paths for HTTPS/SSH, git clone args/timeout, devcontainerUp call, state.json write, INSTANCE_EXISTS, GIT_ERROR, cleanup on clone failure, CONTAINER_ERROR, cleanup on container failure, invalid URL, baseline config copy/skip)
- Updated `packages/agent-env/src/commands/create.ts` from placeholder to real implementation:
  - Validates `--repo` flag is required (MISSING_OPTION error)
  - Calls `createInstance` with default deps
  - Shows progress message during creation
  - Colored success output with workspace path and container name
  - Formatted error output using `formatError`/`createError` from shared package
- Updated CLI test to expect MISSING_OPTION error instead of NotImplemented
- All 209 tests pass across all packages (0 regressions), TypeScript type-check clean

### Change Log

- 2026-02-02: Implemented create command with full orchestration (clone → baseline → container → state), URL parsing, rollback on failure, and 23 tests
- 2026-02-02: Code review fixes — replaced unsafe `undefined as unknown as T` DI factory with real production deps, removed dynamic imports in favor of injected deps

### File List

**New Files:**
- packages/agent-env/src/lib/create-instance.ts
- packages/agent-env/src/lib/create-instance.test.ts

**Modified Files:**
- packages/agent-env/src/commands/create.ts (replaced placeholder with real implementation)
- packages/agent-env/src/cli.test.ts (updated create command test for new behavior)
- packages/agent-env/package.json (added "config" to files array, updated @types/node version)
- _bmad-output/implementation-artifacts/sprint-status.yaml (env-2-4 status updated)
- _bmad-output/implementation-artifacts/env-2-4-implement-create-command-basic.md (this file)

**Deleted Files:**
- packages/agent-env/src/lib/.gitkeep (removed — real files now exist in directory)
