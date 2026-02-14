---
title: 'Add Rebuild Command to agent-env CLI'
slug: 'agent-env-rebuild-command'
created: '2026-02-14'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
elicitation_methods_applied: ['Pre-mortem Analysis', 'What If Scenarios', 'Red Team vs Blue Team']
tech_stack: ['TypeScript 5.x', 'Commander.js 14.x', 'Ink 6 + React 19', 'Vitest 4.x', 'Docker/devcontainer CLI', 'execa 9.x (via shared createExecutor)']
files_to_modify:
  - 'packages/agent-env/src/lib/types.ts'
  - 'packages/agent-env/src/lib/state.ts'
  - 'packages/agent-env/src/lib/create-instance.ts'
  - 'packages/agent-env/src/lib/rebuild-instance.ts'
  - 'packages/agent-env/src/lib/rebuild-instance.test.ts'
  - 'packages/agent-env/src/lib/create-instance.test.ts'
  - 'packages/agent-env/src/lib/state.test.ts'
  - 'packages/agent-env/src/commands/rebuild.ts'
  - 'packages/agent-env/src/lib/interactive-menu.ts'
  - 'packages/agent-env/src/cli.ts'
  - 'packages/agent-env/src/components/InteractiveMenu.tsx'
  - 'packages/agent-env/src/components/InteractiveMenu.test.tsx'
  - 'packages/agent-env/src/lib/interactive-menu.test.ts'
code_patterns:
  - 'Dependency injection for all I/O — factory functions create default deps, tests inject mocks'
  - 'Result types: { ok: true; ... } | { ok: false; error: { code, message, suggestion? } }'
  - 'Atomic state writes via tmp+rename pattern'
  - 'Container lifecycle through ContainerLifecycle interface'
  - 'Workspace lookup via findWorkspaceByName (exact match → suffix match → ambiguous/not-found)'
  - 'Baseline config: copyBaselineConfig + patchContainerName from devcontainer.ts'
  - 'listBaselineFiles() returns known baseline filenames for comparison'
test_patterns:
  - 'Co-located tests: module.ts → module.test.ts (same directory)'
  - 'Real temp directories via tmpdir() + beforeEach/afterEach cleanup'
  - 'createTestState/createTestWorkspace helpers for workspace setup'
  - 'createMockContainer with vi.fn() and satisfies ContainerStopResult/ContainerRemoveResult'
  - 'createTestDeps factory with homedir override pointing to tempDir'
  - 'CLI integration tests in cli.test.ts via subprocess execution'
---

# Tech-Spec: Add Rebuild Command to agent-env CLI

**Created:** 2026-02-14

## Overview

### Problem Statement

There is no way to recreate a devcontainer without fully removing the instance (which also deletes the workspace and git repo). When the baseline devcontainer config changes — such as adding SSH agent forwarding — existing instances are stuck on the old config. Similarly, when a container gets into a bad state, there's no clean way to destroy and recreate just the container while preserving the workspace files.

### Solution

Add an `agent-env rebuild <name>` command that:
1. Re-copies the latest baseline devcontainer config (if the instance uses baseline config) — done *before* teardown so failures don't leave you worse off
2. Stops and removes the existing container
3. Runs `devcontainer up` to create a fresh container

Includes a safety check that warns when the container is currently running, requiring `--force` or interactive confirmation to proceed.

### Scope

**In Scope:**
- Rebuild orchestration library (`rebuild-instance.ts`) with full DI pattern
- Re-copying baseline devcontainer config during rebuild (detecting baseline vs repo-provided config)
- CLI command with `--force` (bypass running check) and `--yes` (skip prompt, implies `--force`) flags
- Interactive menu integration (rebuild action)
- Comprehensive test coverage

**Out of Scope:**
- Docker image cache clearing (`--no-cache`) — deferred to a future iteration
- Partial or incremental container updates

## Context for Development

### Codebase Patterns

- All orchestration functions use dependency injection for testability
- Result types follow the `{ ok: true; ... } | { ok: false; error: { code, message, suggestion? } }` pattern
- Commands are registered in `cli.ts` via Commander.js `addCommand()`
- Container lifecycle operations go through the `ContainerLifecycle` interface
- State is managed via atomic writes (tmp + rename) to `.agent-env/state.json`
- Config source tracking: `state.json` stores `configSource: 'baseline' | 'repo'` to definitively identify how the instance was created (no heuristic detection needed)

### Files to Reference

| File | Purpose | Status |
| ---- | ------- | ------ |
| `packages/agent-env/src/lib/types.ts` | `InstanceState` type — add optional `configSource` field | **Modify** |
| `packages/agent-env/src/lib/state.ts` | `createInitialState` — accept + set `configSource`; `isValidState` — do NOT modify | **Modify** |
| `packages/agent-env/src/lib/create-instance.ts` | Set `configSource` based on `hasDevcontainerConfig` result | **Modify** |
| `packages/agent-env/src/lib/rebuild-instance.ts` | Add baseline config refresh step before teardown; add devcontainer DI deps | **Modify** (already exists) |
| `packages/agent-env/src/lib/rebuild-instance.test.ts` | Add tests for config refresh, ordering, repo config missing, backwards compat | **Modify** (already exists) |
| `packages/agent-env/src/lib/create-instance.test.ts` | Add tests verifying `configSource` is set correctly | **Modify** |
| `packages/agent-env/src/lib/state.test.ts` | Add test that `isValidState` still accepts state without `configSource` | **Modify** |
| `packages/agent-env/src/lib/devcontainer.ts` | `copyBaselineConfig`, `patchContainerName`, `listBaselineFiles` — read-only reference | Reference |
| `packages/agent-env/src/lib/container.ts` | `ContainerLifecycle` interface — read-only reference | Reference |
| `packages/agent-env/src/lib/attach-instance.ts` | `findWorkspaceByName` — read-only reference | Reference |
| `packages/agent-env/src/lib/workspace.ts` | `getWorkspacePathByName`, `FsDeps` — read-only reference | Reference |
| `packages/agent-env/src/commands/rebuild.ts` | CLI command — fix: pass `force: true` when user confirms prompt; `--yes` implies `--force` | **Fix** |
| `packages/agent-env/src/cli.ts` | Command registration + interactive menu wiring — already wired | Done |
| `packages/agent-env/src/lib/interactive-menu.ts` | Rebuild action handler — already wired; change `force: false` to `force: true` (menu selection IS confirmation) | **Fix** |
| `packages/agent-env/src/components/InteractiveMenu.tsx` | Action menu with rebuild option — already implemented | Done |
| `packages/agent-env/config/baseline/` | 4 files: `devcontainer.json`, `Dockerfile`, `init-host.sh`, `post-create.sh` | Reference |

### Technical Decisions

- **Config source tracking via `state.json`**: During `create`, record `configSource: 'baseline' | 'repo'` in `InstanceState`. This gives rebuild a definitive signal — no heuristic (e.g., checking `--name=ae-` in runArgs) needed. Existing instances without the field default to `'baseline'` since all current instances use baseline config. **Critical**: `configSource` must be an optional field on `InstanceState` (`configSource?: 'baseline' | 'repo'`). Do NOT add it to `isValidState` checks — this preserves backwards compatibility with existing state files. Rebuild reads `state.configSource ?? 'baseline'`.
- **Config refresh on rebuild**: When `configSource === 'baseline'`, delete `.devcontainer/` directory, re-copy latest baseline from `config/baseline/`, and re-patch container name. Before deleting, log any extra files in `.devcontainer/` that aren't part of the baseline set (user may have added custom scripts). When `configSource === 'repo'`, preserve the existing config as-is — but verify it still exists on disk. If missing, fail with a clear message rather than silently proceeding.
- **Operation ordering — config before teardown**: The full orchestration order is: (1) find workspace + read state, (2) check Docker, (3) refresh config if baseline, (4) check container status + running guard, (5) stop + remove container, (6) `devcontainer up`. Config refresh runs *before* the container status check and teardown. If config refresh fails (e.g., missing baseline package files), the existing container is still intact and running. This prevents the scenario where teardown succeeds but config refresh fails, leaving the user with no container and no config. **Note**: This means if `CONTAINER_RUNNING` is returned (force=false), the baseline config may already be refreshed on disk — this is intentional and harmless since config refresh is idempotent and the running container still uses its in-memory state. The user can re-run with `--force` and the config is already up to date.
- **Running container safety**: The library (`rebuildInstance`) checks if the container is running and returns `CONTAINER_RUNNING` error when `force` is false. The CLI command layer handles UX: `--force` bypasses the check directly; if the user is on a TTY without `--yes`, the command prompts for confirmation and passes `force: true` to the library when the user confirms. `--yes` skips the prompt and implies `--force`. The interactive menu always passes `force: true` since the user explicitly selected "Rebuild" from the action menu (the menu selection IS the confirmation).
- **No workspace deletion**: Unlike `remove`, rebuild preserves the entire workspace directory including git repo.
- **Failure recovery**: If rebuild fails mid-way (e.g., `devcontainer up` fails after container removal), the workspace and all files remain on disk. The user can re-run `agent-env rebuild` or `agent-env attach` (which calls `devcontainer up`) to retry. Errors should be logged clearly with actionable suggestions.
- **Rebuild recreates the container, not the image**: Docker build cache is reused. Config-level changes (mounts, runArgs, features in `devcontainer.json`) take effect immediately. Dockerfile-level changes (package installs, base image) require image cache busting, which is deferred to the `--no-cache` flag in a future iteration.

## Implementation Plan

### Tasks

Tasks are ordered by dependency — lowest-level changes first.

- [x] Task 1: Add `configSource` to `InstanceState` type
  - File: `packages/agent-env/src/lib/types.ts`
  - Action: Add `configSource?: 'baseline' | 'repo'` as an optional field on the `InstanceState` interface (after `containerName`). Add JSDoc: `/** How the devcontainer config was provisioned. Absent = 'baseline' for backwards compat. */`
  - Action: Do NOT modify `createFallbackState` — absence of the field means baseline.
  - Notes: Optional field ensures backwards compatibility with existing state files.

- [x] Task 2: Update `createInitialState` to accept `configSource`
  - File: `packages/agent-env/src/lib/state.ts`
  - Action: Replace the current positional optional params with an options object to avoid ambiguity. Change signature from `(name, repo, containerName?)` to `(name, repo, options?: { containerName?: string; configSource?: 'baseline' | 'repo' })`. Update the body to destructure: `const { containerName, configSource } = options ?? {}`. Set `configSource: configSource ?? 'baseline'` in the returned object.
  - Action: Update the single existing call site in `create-instance.ts` to pass `{ containerName: actualContainerName, configSource }` as the options object.
  - Action: Do NOT modify `isValidState` — it must continue to accept state files without `configSource`.
  - Notes: The options object pattern avoids the positional ambiguity of two adjacent optional parameters (`containerName?` then `configSource?`). When `options` is omitted entirely, both default correctly (`containerName` → prefix-derived, `configSource` → `'baseline'`).

- [x] Task 3: Set `configSource` during instance creation
  - File: `packages/agent-env/src/lib/create-instance.ts`
  - Action: In `createInstance`, after the `hasDevcontainerConfig` check, determine `configSource`: if `hasConfig` is true (repo provided its own), set `'repo'`. If false (baseline was copied), set `'baseline'`.
  - Action: Update the `createInitialState` call to use the new options object: `createInitialState(wsPath.name, repoUrl, { containerName: actualContainerName, configSource })`.
  - Notes: `hasDevcontainerConfig` is already called and its result determines the baseline-vs-repo branch. Use the same boolean to derive `configSource`.

- [x] Task 4: Add devcontainer deps to `RebuildInstanceDeps`, update factory, and implement config refresh
  - File: `packages/agent-env/src/lib/rebuild-instance.ts`
  - **4a — Extend deps interface.** Add to `RebuildInstanceDeps`:
    ```typescript
    devcontainerFsDeps: Pick<DevcontainerFsDeps, 'cp' | 'mkdir' | 'readdir' | 'readFile' | 'stat' | 'writeFile'>;
    rm: typeof rm;
    logger?: { warn: (message: string) => void; info: (message: string) => void };
    ```
    Note: `readdir` is required for listing `.devcontainer/` contents and by `listBaselineFiles()`.
  - **4b — Update factory.** Add `cp` and `rm` to imports from `node:fs/promises`. Import `DevcontainerFsDeps` type from `./devcontainer.js`. Update `createRebuildDefaultDeps` to provide:
    ```typescript
    devcontainerFsDeps: { cp, mkdir, readdir, readFile, stat, writeFile },
    rm,
    logger: { warn: (msg) => console.warn(msg), info: (msg) => console.info(msg) },
    ```
    Matches the pattern from `createDefaultDeps` in `create-instance.ts`.
  - **4c — Import devcontainer functions.** Import `copyBaselineConfig`, `patchContainerName`, `listBaselineFiles`, `hasDevcontainerConfig` from `./devcontainer.js`. Import `join` from `node:path` (needed for constructing `.devcontainer/` path in step 4d). (No `deriveContainerName` import — the container name is already available from `state.containerName`.)
  - **4d — Insert config refresh step.** Place it after the Docker availability check (Step 2 in current code) and before the container status check (Step 3). The refresh logic:
    1. Read `state.configSource ?? 'baseline'`.
    2. If `'baseline'`:
       a. List files in `.devcontainer/` directory via `deps.devcontainerFsDeps.readdir(devcontainerDir)` (without `{ withFileTypes: true }` — returns `string[]` for direct comparison against `listBaselineFiles()` output).
       b. Compare against `listBaselineFiles()`. Log any extras via `deps.logger?.warn()`.
       c. Delete `.devcontainer/` directory via `deps.rm(join(wsPath.root, '.devcontainer'), { recursive: true, force: true })`.
       d. Call `copyBaselineConfig(wsPath.root, deps.devcontainerFsDeps)`.
       e. Call `patchContainerName(wsPath.root, containerName, deps.devcontainerFsDeps)`.
       f. If any step fails, return error — container is still intact (not yet torn down).
    3. If `'repo'`:
       a. Call `hasDevcontainerConfig(wsPath.root, deps.devcontainerFsDeps)`.
       b. If false, return `{ ok: false, error: { code: 'CONFIG_MISSING', message: 'Repo-provided devcontainer config is missing.', suggestion: 'Re-clone the repository or provide a devcontainer config manually.' } }`.
  - Notes: The key invariant is that config refresh happens before teardown. If refresh fails, the old container is still running/available.

- [x] Task 5: Update and add `configSource` tests to `state.test.ts`
  - File: `packages/agent-env/src/lib/state.test.ts`
  - Action: Update the existing `'accepts custom container name'` test to use the new options object syntax: change `createInitialState('test', 'repo-url', 'custom-container')` to `createInitialState('test', 'repo-url', { containerName: 'custom-container' })`. Without this, the test will fail to compile after Task 2's signature change.
  - Action: Add test: `isValidState` accepts state without `configSource` (write a state.json without the field, read it, verify it doesn't fall back).
  - Action: Add test: `createInitialState` sets `configSource` when provided via `{ configSource: 'repo' }`.
  - Action: Add test: `createInitialState` defaults `configSource` to `'baseline'` when not provided.

- [x] Task 6: Add `configSource` tests to `create-instance.test.ts`
  - File: `packages/agent-env/src/lib/create-instance.test.ts`
  - Action: Add test: when repo has no devcontainer config (baseline copied), state.json has `configSource: 'baseline'`.
  - Action: Add test: when repo has its own devcontainer config, state.json has `configSource: 'repo'`.
  - Notes: Mock `hasDevcontainerConfig` return value via the devcontainer fs deps.

- [x] Task 7: Update rebuild-instance tests for config refresh
  - File: `packages/agent-env/src/lib/rebuild-instance.test.ts`
  - Action: Update `createTestDeps` to include new deps (`devcontainerFsDeps`, `rm`, `logger`).
  - Action: Update `createTestState` to optionally accept `configSource`.
  - Action: Add tests:
    - Config refresh: `configSource: 'baseline'` → `.devcontainer/` deleted and re-copied from baseline before teardown.
    - Config preserved: `configSource: 'repo'` → `.devcontainer/` not touched.
    - Missing `configSource` defaults to baseline refresh.
    - Extra files in `.devcontainer/` logged via `logger.warn` before deletion.
    - Missing repo config: `configSource: 'repo'` + no `.devcontainer/` → `CONFIG_MISSING` error.
    - Config refresh failure: if `copyBaselineConfig` throws, container is NOT stopped/removed.
    - Operation ordering: verify config refresh call order is before `containerStop`.
    - Existing tests still pass with updated deps.

- [x] Task 8: Fix `--force`/`--yes` semantics in CLI command and interactive menu
  - Files: `packages/agent-env/src/commands/rebuild.ts`, `packages/agent-env/src/lib/interactive-menu.ts`
  - **8a — CLI command (`rebuild.ts`).** Change the `rebuildInstance` call to pass `force: true` when the user confirms the prompt (currently passes `options.force ?? false` regardless of prompt result). When `--yes` is set, also treat it as implying `--force`: compute `const force = options.force || options.yes || confirmed` and pass that to `rebuildInstance(name, deps, force)`.
  - **8b — Interactive menu (`interactive-menu.ts`).** In the `'rebuild'` case, change `deps.rebuildInstance(name, rebuildDeps, false)` to `deps.rebuildInstance(name, rebuildDeps, true)`. The menu selection IS the user's confirmation — passing `force: false` creates a dead-end where running containers can never be rebuilt from the interactive menu.
  - Notes: Without this fix, the CLI prompt is cosmetic (user confirms but library still rejects running containers) and the interactive menu always fails for running containers.

### Acceptance Criteria

- [x] AC 1: Given an instance created with baseline config, when `agent-env rebuild <name>` is run, then `.devcontainer/` is deleted and re-copied from the latest baseline config before the container is torn down.
- [x] AC 2: Given an instance created with a repo-provided config, when `agent-env rebuild <name>` is run, then `.devcontainer/` is preserved as-is and the container is rebuilt using the existing config.
- [x] AC 3: Given an instance with extra files in `.devcontainer/` beyond the baseline set, when rebuild refreshes the config, then the extra filenames are logged as a warning before deletion.
- [x] AC 4: Given an instance with `configSource: 'repo'` but `.devcontainer/` is missing from disk, when rebuild is run, then it returns a `CONFIG_MISSING` error with a clear suggestion.
- [x] AC 5: Given a baseline config refresh that fails (e.g., baseline package files missing), when rebuild encounters the error, then the existing container is NOT stopped or removed — the user is left in a working state.
- [x] AC 6: Given a running container and no `--force` flag, when `agent-env rebuild <name>` is run, then it returns a `CONTAINER_RUNNING` error with a suggestion to use `--force`.
- [x] AC 7: Given a running container and `--force` flag, when `agent-env rebuild <name> --force` is run, then the container is stopped, removed, and a new container is created.
- [x] AC 8: Given no existing container (not-found status), when rebuild is run, then stop/remove steps are skipped and `devcontainer up` is called directly — functioning as a "retry creation" recovery path.
- [x] AC 9: Given an existing state.json without `configSource` (pre-existing instance), when rebuild is run, then it defaults to `'baseline'` behavior and refreshes the config.
- [x] AC 10: Given a newly created instance, when `agent-env create <name> --repo <url>` is run on a repo without devcontainer config, then state.json contains `configSource: 'baseline'`.
- [x] AC 11: Given a newly created instance, when `agent-env create <name> --repo <url>` is run on a repo with its own devcontainer config, then state.json contains `configSource: 'repo'`.
- [x] AC 12: Given all changes applied, when `pnpm check` is run, then type-checking, linting, and all existing + new tests pass.

## Additional Context

### Dependencies

- No new package dependencies required.
- Uses existing modules: `ContainerLifecycle` (container.ts), `copyBaselineConfig`/`patchContainerName`/`listBaselineFiles`/`hasDevcontainerConfig` (devcontainer.ts), `readState`/`writeStateAtomic`/`createInitialState` (state.ts), `findWorkspaceByName` (attach-instance.ts), `getWorkspacePathByName` (workspace.ts).

### Testing Strategy

**Unit tests (DI mocked):**
- `state.test.ts`: `isValidState` backwards compat, `createInitialState` with/without `configSource`
- `create-instance.test.ts`: `configSource` set correctly for baseline vs repo-provided configs
- `rebuild-instance.test.ts`: config refresh flow, ordering, repo config missing, extra file logging, backwards compat, all existing tests updated for new deps

**Integration tests:**
- `cli.test.ts`: rebuild command CLI integration (already has basic coverage from initial implementation)

**Manual verification:**
- Run `pnpm check` (type-check + lint + test) to confirm full suite passes

### Risk Mitigations (Pre-mortem)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Custom baseline edits lost on rebuild | High | `configSource` tracking is definitive; log extra files before deleting; document that baseline configs are refreshed on rebuild |
| Mid-rebuild crash leaves no container | Medium | Workspace preserved on disk; `attach` or re-run `rebuild` retries `devcontainer up` |
| Config refresh fails after teardown | Medium | Mitigated by operation ordering: config refresh runs before container teardown |
| Missing `.devcontainer/` with `configSource: 'repo'` | Medium | Explicit check + clear error message before proceeding |
| Rebuild as creation retry (no container exists) | Positive | Works naturally — skip stop/remove, go straight to `devcontainer up`. Document as recovery path |
| Image cache masks Dockerfile changes | Low (deferred) | Document limitation; `--no-cache` flag addresses in future iteration |
| Users expect "rebuild" = clean image | Low | Document that rebuild recreates the container, not the image |

### Notes

- The rebuild command, CLI wiring, interactive menu integration, and basic tests were implemented earlier in this session. This spec covers the remaining work: `configSource` tracking and baseline config refresh.
- `configSource` is optional on `InstanceState`. Do NOT add to `isValidState`. `createFallbackState` does not set it. Absence = `'baseline'`.
- Baseline files are: `devcontainer.json`, `Dockerfile`, `init-host.sh`, `post-create.sh`. Use `listBaselineFiles()` from `devcontainer.ts` to compare at runtime rather than hardcoding.
- **No concurrency guard**: Concurrent rebuilds of the same instance are not protected by a lock file. This is acceptable for a single-user CLI tool. If concurrent usage becomes a concern, a PID-based lock file in `.agent-env/` can be added later.
- Future iteration: `--no-cache` flag to bust Docker image cache for Dockerfile-level changes.
