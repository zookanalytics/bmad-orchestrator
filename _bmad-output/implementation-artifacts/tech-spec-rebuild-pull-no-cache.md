---
title: 'Add image pull and cache-busting to rebuild command'
slug: 'rebuild-pull-no-cache'
created: '2026-02-14'
status: 'done'
stepsCompleted: [1, 2, 3, 4, 5]
elicitation_methods_applied: ['Pre-mortem Analysis', 'What If Scenarios', 'Failure Mode Analysis', 'Occam''s Razor']
tech_stack: ['TypeScript 5.x', 'Commander.js 14.x', 'Vitest 4.x', 'Docker CLI', 'devcontainer CLI', 'jsonc-parser']
files_to_modify:
  - 'packages/agent-env/package.json'
  - 'packages/agent-env/src/lib/devcontainer.ts'
  - 'packages/agent-env/src/lib/devcontainer.test.ts'
  - 'packages/agent-env/src/lib/container.ts'
  - 'packages/agent-env/src/lib/container.test.ts'
  - 'packages/agent-env/src/lib/rebuild-instance.ts'
  - 'packages/agent-env/src/lib/rebuild-instance.test.ts'
  - 'packages/agent-env/src/lib/interactive-menu.ts'
  - 'packages/agent-env/src/lib/interactive-menu.test.ts'
  - 'packages/agent-env/src/commands/rebuild.ts'
  - 'packages/agent-env/src/commands/rebuild.test.ts'
code_patterns:
  - 'Dependency injection for all I/O — factory functions create default deps, tests inject mocks'
  - 'Result types: { ok: true; ... } | { ok: false; error: { code, message, suggestion? } }'
  - 'Container lifecycle through ContainerLifecycle interface'
  - 'ESM imports with .js extension throughout'
  - 'createContainerLifecycle(executor) factory pattern for ContainerLifecycle'
  - 'mockExecutor(results) pattern in container tests — matches by command prefix'
test_patterns:
  - 'Co-located tests: module.ts → module.test.ts (same directory)'
  - 'Real temp directories via tmpdir() + beforeEach/afterEach cleanup'
  - 'createMockContainer with vi.fn() and satisfies patterns'
  - 'createTestDeps factory with homedir override pointing to tempDir'
  - 'mockExecutor(results: Record<string, ExecuteResult>) in container.test.ts'
  - 'Never call real git, docker, or devcontainer in tests'
---

# Tech-Spec: Add image pull and cache-busting to rebuild command

**Created:** 2026-02-14

## Overview

### Problem Statement

`agent-env rebuild` reuses Docker's locally cached base images and build layers. When the remote `node:22-bookworm-slim` (or any FROM image) is updated, rebuild keeps using the stale local copy. Even `devcontainer up --build-no-cache` only skips the Docker build layer cache — it does not pull fresh base images from the registry.

### Solution

Make rebuild pull fresh base images and skip build cache by default. Parse `FROM` lines from the workspace's `.devcontainer/Dockerfile`, run `docker pull` on each image before building, and pass `--build-no-cache` to `devcontainer up`. Add `--no-pull` and `--use-cache` opt-out flags for speed when a full refresh isn't needed.

### Scope

**In Scope:**
- Default docker pull of all FROM images parsed from the workspace Dockerfile
- Default `--build-no-cache` passthrough to `devcontainer up`
- `--no-pull` opt-out flag to skip pulling fresh base images
- `--use-cache` opt-out flag to allow Docker build layer cache reuse
- FROM parsing for both baseline and repo-provided Dockerfiles

**Out of Scope:**
- Refreshing devcontainer features (managed by devcontainer CLI)
- Automatic staleness detection
- Image pruning/cleanup
- Applying pull/no-cache defaults to `agent-env create` — create uses `devcontainerUp()` but deliberately does not pass `--build-no-cache` or pull images. First-time creation should use whatever Docker has cached for speed. Users who need a fresh create can run `create` then `rebuild`.
- Resolving `ARG`-parameterized `FROM` values (e.g., `ARG BASE=node:22` / `FROM $BASE`) — would require partial Dockerfile evaluation. Parameterized FROM lines are skipped with a warning. This is a **known limitation**: repos using `ARG`-based base image pinning (a Docker best practice) will not get automatic pulls. Users should run `docker pull <image>` manually or refactor to literal FROM lines.

## Context for Development

### Codebase Patterns

- All orchestration functions use dependency injection for testability
- Result types follow the `{ ok: true; ... } | { ok: false; error: { code, message, suggestion? } }` pattern
- Container lifecycle operations go through the `ContainerLifecycle` interface
- The rebuild orchestration in `rebuild-instance.ts` uses a step-by-step flow with early returns on failure
- `devcontainerUp()` in `container.ts` calls `devcontainer up --workspace-folder <path>` via the injected executor
- `createContainerLifecycle(executor)` factory wraps all Docker/devcontainer CLI calls with DI
- ESM throughout — all imports use `.js` extension, no CJS patterns
- `DevcontainerFsDeps` interface in `devcontainer.ts` injects `node:fs/promises` operations

### Files to Reference

| File | Purpose | Action |
| ---- | ------- | ------ |
| `packages/agent-env/src/lib/devcontainer.ts` | Devcontainer config utilities (copy, patch, detect) | **Modify** — add `resolveDockerfilePath()` and `parseDockerfileImages()` |
| `packages/agent-env/src/lib/devcontainer.test.ts` | Tests for devcontainer utilities | **Modify** — add tests for new functions |
| `packages/agent-env/src/lib/container.ts` | `ContainerLifecycle` interface + factory | **Modify** — add `dockerPull()`, modify `devcontainerUp()` to accept build options |
| `packages/agent-env/src/lib/container.test.ts` | Container lifecycle tests with mockExecutor | **Modify** — add `dockerPull` tests, update `devcontainerUp` tests |
| `packages/agent-env/src/lib/rebuild-instance.ts` | Rebuild orchestration (9-step flow) | **Modify** — add pull step, pass `buildNoCache`, refactor to `RebuildOptions` |
| `packages/agent-env/src/lib/rebuild-instance.test.ts` | Rebuild orchestration tests | **Modify** — update for `RebuildOptions`, add pull/noCache tests |
| `packages/agent-env/src/lib/interactive-menu.ts` | Interactive menu — calls `rebuildInstance()` | **Modify** — update `rebuildInstance` signature in `InteractiveMenuDeps` |
| `packages/agent-env/src/lib/interactive-menu.test.ts` | Interactive menu tests | **Modify** — update mock signature |
| `packages/agent-env/src/commands/rebuild.ts` | CLI command with `--force`/`--yes` flags | **Modify** — add `--no-pull` and `--use-cache` flags, pass to `RebuildOptions` |
| `packages/agent-env/config/baseline/Dockerfile` | Baseline Dockerfile (FROM node:22-bookworm-slim) | Reference |
| `packages/agent-env/config/baseline/devcontainer.json` | Baseline devcontainer config (`build.dockerfile` = implicit `Dockerfile`) | Reference |
| `packages/agent-env/src/lib/types.ts` | `InstanceState`, `ContainerResult` types | Reference (no changes needed) |

### Technical Decisions

- **Refactor `rebuildInstance()` to options object**: Current signature `(name, deps, force, overrideConfigSource?)` is unwieldy with 4 positional params. Consolidate to `(name, deps, options?: RebuildOptions)` where `RebuildOptions = { force?, configSource?, pull?, noCache? }`. Defaults: `force: false`, `pull: true`, `noCache: true`. This touches 3 call sites (rebuild.ts, interactive-menu.ts, tests) but keeps the API clean and extensible. The `InteractiveMenuDeps.rebuildInstance` type signature also updates to accept `RebuildOptions`.
- **`parseDockerfileImages()` in `devcontainer.ts`**: Pure function. Accepts Dockerfile content as string, returns `string[]` of unique image references. One regex: `/^\s*FROM\s+(?:--\S+\s+)*(\S+)/`. Filters: skip `scratch`, skip refs containing `$`. Warns via optional logger for skipped parameterized lines. Deduplicates results.
- **`resolveDockerfilePath()` in `devcontainer.ts`**: Searches all three devcontainer.json locations (`.devcontainer/`, root `devcontainer.json`, root `.devcontainer.json`) matching `hasDevcontainerConfig` logic. Reads the config and parses it using the `jsonc-parser` package (`parse()` function) — this is the same JSONC library used by `@devcontainers/cli` itself. Checks for `build.dockerfile` field — if present, returns the resolved absolute path relative to the config's directory (does NOT verify the file exists; caller handles read errors with `DOCKERFILE_MISSING` code). Falls back to checking for `Dockerfile` in the config's directory via `stat()`. Returns `null` if no Dockerfile exists (image-based config). Uses `DevcontainerFsDeps` for DI.
- **`dockerPull()` on `ContainerLifecycle`**: Wraps `docker pull <image>` via the injected executor. Returns result type with error code `IMAGE_PULL_FAILED`. Export `DockerPullResult` type from `container.ts` alongside `ContainerStopResult` and `ContainerRemoveResult`. Timeout: 300 seconds (large images like `node:22-bookworm-slim` can take minutes on slow connections). Added to `ContainerLifecycle` interface since it's a Docker CLI operation.
- **`devcontainerUp()` options**: Add optional third parameter `options?: { buildNoCache?: boolean }`. When `buildNoCache` is true, append `--build-no-cache` to the `devcontainer up` args array. Default: `undefined` (no flag). **Timeout**: Increase `DEVCONTAINER_UP_TIMEOUT` from `120_000` to `300_000` (5 minutes) unconditionally. No-cache builds are significantly slower (full `apt-get install` + `npm install -g claude-code`), and builds with cache rarely approach even 60 seconds so the increase has no downside.
- **Rebuild flow ordering — full renumbered sequence (10 steps)**: The pull step inserts between config refresh and container status check. New flow: (1) Find workspace + read state, (2) Check Docker availability, (3) Refresh devcontainer config, **(4) Parse Dockerfile + pull base images** ← NEW, (5) Check container status + running guard, (6) Stop container, (7) Remove container, (8) `devcontainer up --build-no-cache`, (9) Discover actual container name, (10) Update state. Pull failure at step 4 returns error with `--no-pull` suggestion; container remains intact (steps 6-7 not yet reached).
- **CLI flag semantics**: `--no-pull` sets `pull: false` in `RebuildOptions`. `--use-cache` sets `noCache: false`. Commander.js: `.option('--no-pull', 'Skip pulling fresh base images')` and `.option('--use-cache', 'Allow Docker build layer cache reuse')`. Commander.js strips the `--no-` prefix from `--no-pull` and creates `options.pull` defaulting to `true`, set to `false` when `--no-pull` is passed. This is documented Commander.js behavior for negatable boolean options — the property name is always the positive form (`pull`), not camelCased (`noPull`). The `--use-cache` flag is a plain boolean (`options.useCache` is `undefined` by default, `true` when passed); rebuild maps it as `noCache: !options.useCache`. Named `--use-cache` (not `--cache`) to avoid confusion — a user trying `--no-cache` would get a Commander error since `.option('--cache')` doesn't auto-support `--no-cache` negation.
- **Interactive menu**: Passes default options (pull + noCache both true) since the menu user expects a full rebuild. No UI for opt-outs — those are CLI-only power-user flags.

## Implementation Plan

### Tasks

Tasks are ordered by dependency — lowest-level changes first.

- [x] Task 1: Add `resolveDockerfilePath()` to `devcontainer.ts`
  - File: `packages/agent-env/src/lib/devcontainer.ts`
  - Action: Add a new exported async function `resolveDockerfilePath(workspacePath: string, deps: Pick<DevcontainerFsDeps, 'readFile' | 'stat'>): Promise<string | null>`. Implementation:
    1. Search for `devcontainer.json` in three locations (matching `hasDevcontainerConfig` logic): `.devcontainer/devcontainer.json`, root `devcontainer.json`, root `.devcontainer.json`. Use `deps.stat()` + try/catch to find the first that exists.
    2. Read the found config file. **Critical: devcontainer.json supports JSONC** (comments, trailing commas). Parse using `import { parse } from 'jsonc-parser'` — this is the same library used by `@devcontainers/cli` itself. Call `parse(content)` which handles `//` comments, `/* */` blocks, and trailing commas correctly without corrupting string values containing `//` or `,}` patterns.
    3. Check for `build.dockerfile` field. If present, return the absolute path resolved relative to the config file's directory (use `dirname` of the config path + `join` with the dockerfile field). Do NOT verify existence here — let the caller handle the read failure with a specific error code (see Task 7c step 3).
    4. If `build.dockerfile` is absent, check if a `Dockerfile` exists in the same directory as the config file (e.g., `.devcontainer/Dockerfile`) via `deps.stat()`. If yes, return its absolute path. If no, return `null`.
    5. Wrap the entire function in try/catch: if any step fails (config missing, unparseable), return `null`.
  - Notes: Uses existing `DevcontainerFsDeps` for DI. Import `join` and `dirname` from `node:path`. The `null` return signals "no Dockerfile to parse" — caller skips pull step. Use `stat` (not `access`) for existence checks since `access` is not in the `RebuildInstanceDeps.devcontainerFsDeps` Pick.

- [x] Task 2: Add `parseDockerfileImages()` to `devcontainer.ts`
  - File: `packages/agent-env/src/lib/devcontainer.ts`
  - Action: Add a new exported function `parseDockerfileImages(content: string, logger?: { warn: (msg: string) => void }): string[]`. Pure function, no async, no DI needed. Implementation:
    1. Split content by `\n`.
    2. Filter out lines starting with `#` (after trimming).
    3. Match remaining lines against `/^\s*FROM\s+(?:--\S+\s+)*(\S+)/i`.
    4. For each match, extract capture group 1 (the image reference).
    5. If image contains `$`, log via `logger?.warn('Skipping parameterized FROM: <image>')` and skip.
    6. If image equals `scratch` (case-insensitive), skip.
    7. Deduplicate results (use `[...new Set(images)]`).
    8. Return the unique image list.
  - Notes: The regex handles `FROM --platform=linux/amd64 node:22` and `FROM node:22 AS builder` correctly — `AS builder` is a separate token not captured by `(\S+)`.

- [x] Task 3: Add tests for `resolveDockerfilePath()` and `parseDockerfileImages()`
  - File: `packages/agent-env/src/lib/devcontainer.test.ts`
  - Action: Add two new `describe` blocks:
    - `resolveDockerfilePath`: (a) returns path when `build.dockerfile` is set in devcontainer.json, (b) returns default `Dockerfile` path when `build.dockerfile` absent but Dockerfile exists, (c) returns `null` when no Dockerfile exists (image-based config), (d) returns `null` when devcontainer.json is missing, (e) returns the configured path even when `build.dockerfile` references a non-existent file (caller handles the error), (f) parses JSONC devcontainer.json correctly (comments, trailing commas, `//` in string values).
    - `parseDockerfileImages`: (a) extracts single FROM image, (b) extracts multiple FROM images and deduplicates, (c) handles `FROM --platform=... image`, (d) handles `FROM image AS stage`, (e) skips `FROM scratch`, (f) skips parameterized `FROM ${VAR}` and calls logger.warn, (g) ignores comment lines, (h) returns empty array for empty/no-FROM content.
  - Notes: Use real temp directories for `resolveDockerfilePath` tests (write devcontainer.json and Dockerfile to tempDir). `parseDockerfileImages` tests are pure string-in/array-out. Add a test case for JSONC devcontainer.json (with `//` comments, `/* */` blocks, trailing commas, and string values containing `//` like `"ghcr.io/user/repo"`) to verify `jsonc-parser` handles all cases correctly. Add a test for `build.dockerfile` pointing to a missing file — should return the configured path (not `null`), and the caller handles the read error.

- [x] Task 4: Add `dockerPull()` to `ContainerLifecycle`
  - File: `packages/agent-env/src/lib/container.ts`
  - Action: Add `DOCKER_PULL_TIMEOUT = 300_000` constant (5 minutes — large images like `node:22-bookworm-slim` can take minutes on slow connections). Add `dockerPull(image: string): Promise<DockerPullResult>` to the `ContainerLifecycle` interface. Define `DockerPullResult = { ok: true } | { ok: false; error: { code: string; message: string; suggestion?: string } }`. Export both the type and add to the interface. Implement in the factory: call `executor('docker', ['pull', image], { timeout: DOCKER_PULL_TIMEOUT })`. On failure, return `{ ok: false, error: { code: 'IMAGE_PULL_FAILED', message: \`Failed to pull '${image}': ${result.stderr}\`, suggestion: 'Check network connectivity and image name. Use --no-pull to skip pulling and use cached images.' } }`.
  - Notes: Follows exact same pattern as `containerStop()` and `containerRemove()`.

- [x] Task 5: Modify `devcontainerUp()` to accept build options
  - File: `packages/agent-env/src/lib/container.ts`
  - Action: Change `devcontainerUp` signature from `(workspacePath: string, containerName: string)` to `(workspacePath: string, containerName: string, options?: { buildNoCache?: boolean })`. In the `ContainerLifecycle` interface, update the type accordingly. In the implementation, build the args array: `const args = ['up', '--workspace-folder', workspacePath]`. If `options?.buildNoCache`, push `'--build-no-cache'` to args. Pass `args` to `executor('devcontainer', args, ...)`. Also increase `DEVCONTAINER_UP_TIMEOUT` from `120_000` to `300_000` (5 minutes) to accommodate no-cache builds.
  - Notes: Default behavior (no options) is unchanged — existing call sites in `create-instance.ts` don't need updating. The timeout increase is unconditional since cached builds rarely approach even 60 seconds.

- [x] Task 6: Add tests for `dockerPull()` and `devcontainerUp()` build options
  - File: `packages/agent-env/src/lib/container.test.ts`
  - Action: Add `describe('dockerPull', ...)` block: (a) calls `docker pull` with image name and timeout, (b) returns `{ ok: true }` on success, (c) returns `IMAGE_PULL_FAILED` error with suggestion on failure. Add tests in existing `devcontainerUp` describe: (d) passes `--build-no-cache` when `buildNoCache: true`, (e) does not pass `--build-no-cache` when option omitted, (f) does not pass `--build-no-cache` when `buildNoCache: false`.
  - Notes: Use existing `mockExecutor` pattern. Match `docker pull` prefix for dockerPull tests.

- [x] Task 7: Refactor `rebuildInstance()` to `RebuildOptions` and wire pull + noCache
  - File: `packages/agent-env/src/lib/rebuild-instance.ts`
  - **7a — Define `RebuildOptions` type.** Add exported interface:
    ```typescript
    export interface RebuildOptions {
      force?: boolean;       // default false
      configSource?: 'baseline' | 'repo';
      pull?: boolean;        // default true
      noCache?: boolean;     // default true
    }
    ```
  - **7b — Change `rebuildInstance()` signature.** From `(instanceName, deps, force, overrideConfigSource?)` to `(instanceName, deps, options?: RebuildOptions)`. Destructure with defaults: `const { force = false, configSource: overrideConfigSource, pull = true, noCache = true } = options ?? {}`.
  - **7c — Resolve Dockerfile and optionally pull.** After config refresh (step 3) and before container status check (step 4), insert new step. Import `resolveDockerfilePath` and `parseDockerfileImages` from `./devcontainer.js`.
    1. **Always** call `resolveDockerfilePath(wsPath.root, deps.devcontainerFsDeps)` — regardless of the `pull` flag. This is needed by both pull and `--build-no-cache` logic.
    2. Set `hasDockerfile = result !== null`.
    3. If `pull` is true AND `hasDockerfile` is true: read the file via `deps.devcontainerFsDeps.readFile(dockerfilePath, 'utf-8')`. Wrap in try/catch — if the file doesn't exist (e.g., `build.dockerfile` points to a deleted file), return hard error with code `DOCKERFILE_MISSING`, message including the path, and suggestion `'Check build.dockerfile in devcontainer.json, or use --no-pull to skip.'`.
    4. Call `parseDockerfileImages(content, deps.logger)` to get image list.
    5. If empty, log info: "No pullable FROM images found."
    6. For each image, call `deps.container.dockerPull(image)`. If any returns `!ok`, return the error immediately (fail fast). The container is still intact at this point.
    7. If `pull` is true AND `hasDockerfile` is false: log info: "No Dockerfile found — skipping image pull."
    8. If `pull` is false: skip steps 3-7 entirely (no read, no parse, no pull). `hasDockerfile` is still set from step 2 for use by 7d.
  - **7d — Pass `buildNoCache` to `devcontainerUp`.** Change step 8 (`devcontainerUp` call) from `deps.container.devcontainerUp(wsPath.root, containerName)` to `deps.container.devcontainerUp(wsPath.root, containerName, { buildNoCache })`. The `buildNoCache` value is `noCache` (from options) AND only when a Dockerfile was found (step 4 above). If `resolveDockerfilePath` returned `null` (image-based config), set `buildNoCache` to `false` regardless of the `noCache` option — `--build-no-cache` is meaningless without a Dockerfile to build. Track this with a `hasDockerfile` boolean set during the pull step.
  - Notes: The ordering is critical — pull happens before teardown. If pull fails, the old container is still running/available. **Implementation note**: Task 7a+7b (type + signature refactor) should be implemented first and tested via Task 8a (call site migration) before adding 7c+7d (pull + noCache wiring). This avoids a circular dependency where 7c needs `dockerPull` mocks from 8b. Suggested sequence: 7a → 7b → 8a → 7c → 7d → 8b → 8c → 8d.

- [x] Task 8: Update rebuild-instance tests for `RebuildOptions` + pull + noCache
  - File: `packages/agent-env/src/lib/rebuild-instance.test.ts`
  - Action:
    - **8a — Update all existing call sites.** Calls with `true` → `{ force: true }`. Calls with `false` → `{}` or `{ force: false }`. Calls with 4 args like `rebuildInstance('auth', deps, false, 'repo')` → `rebuildInstance('auth', deps, { force: false, configSource: 'repo' })`. Calls with no third argument (e.g., `rebuildInstance('auth', deps)`) need no changes — the optional `options?` parameter defaults correctly. There are ~20+ call sites in this file; do a mechanical search for `rebuildInstance(` to find all. Update `createTestDeps` to include a mock `dockerPull` on the container mock: `dockerPull: vi.fn().mockResolvedValue({ ok: true })`.
    - **8b — Add pull tests:** (a) Default rebuild calls `dockerPull` for each FROM image found in Dockerfile. (b) `{ pull: false }` skips `dockerPull` but `devcontainerUp` still receives `buildNoCache: true` (these flags are independent). (c) Pull failure returns `IMAGE_PULL_FAILED` error and container is NOT stopped/removed. (d) No Dockerfile found → pull skipped, rebuild continues. (e) Parameterized FROM lines are skipped with logger.warn.
    - **8c — Add noCache tests:** (a) Default rebuild passes `buildNoCache: true` to `devcontainerUp`. (b) `{ noCache: false }` passes `buildNoCache: false` (or omits it).
    - **8d — Verify ordering:** Pull step runs after config refresh but before container stop. Mock `dockerPull` that fails → verify `containerStop` was never called.
  - Notes: Write Dockerfile content to the test workspace's `.devcontainer/Dockerfile` in `createTestWorkspace` helper. **Critical mock fix:** The existing `devcontainerFsDeps.readFile` mock returns `'{}'` unconditionally. For pull tests, either (a) use real filesystem reads by passing real `readFile` from `node:fs/promises` in test deps (preferred — matches the temp directory pattern), or (b) make the mock path-aware so it returns devcontainer.json content for `devcontainer.json` paths and Dockerfile content for `Dockerfile` paths. Option (a) is simpler since tests already use real temp directories with real files. Also note: the existing `devcontainerFsDeps.stat` mock may return directory-like results for `.devcontainer/Dockerfile` paths. Use real `stat` or make the mock path-aware for the new test cases.

- [x] Task 9: Update interactive menu signature
  - File: `packages/agent-env/src/lib/interactive-menu.ts`
  - Action: Update `InteractiveMenuDeps.rebuildInstance` type from `(name: string, deps: RebuildInstanceDeps, force: boolean) => Promise<RebuildResult>` to `(name: string, deps: RebuildInstanceDeps, options?: RebuildOptions) => Promise<RebuildResult>`. Import `RebuildOptions` from `./rebuild-instance.js`. Update the rebuild case to pass `{ force: true }` instead of `true`.
  - Notes: Interactive menu always uses defaults (pull: true, noCache: true) — full rebuild.

- [x] Task 10: Update interactive menu tests
  - File: `packages/agent-env/src/lib/interactive-menu.test.ts`
  - Action: Update mock `rebuildInstance` signature to accept `RebuildOptions`. **Note:** The existing mock at ~line 62 is already mistyped — it omits the `force: boolean` from the generic type parameter (`vi.fn<(name: string, deps: RebuildInstanceDeps) => Promise<RebuildResult>>()`), even though the actual interface accepts 3 params. Fix this by updating the generic to match the new interface: `vi.fn<(name: string, deps: RebuildInstanceDeps, options?: RebuildOptions) => Promise<RebuildResult>>()`. Update assertions from positional `true` to `{ force: true }`. Pass `{ force: true }` explicitly (not relying on defaults) to match AC 11.

- [x] Task 11: Add `--no-pull` and `--use-cache` flags to CLI command
  - File: `packages/agent-env/src/commands/rebuild.ts`
  - Action: Add `.option('--no-pull', 'Skip pulling fresh base images')` and `.option('--use-cache', 'Allow Docker build layer cache reuse')`. Commander.js strips the `--no-` prefix and creates `options.pull` defaulting to `true`, set to `false` when `--no-pull` is passed. This is documented Commander.js negatable boolean behavior — the property name is the positive form (`pull`), not camelCased (`noPull`). Update the options type to include `pull?: boolean` and `useCache?: boolean`. Build `RebuildOptions`: `{ force, pull: options.pull, noCache: !options.useCache }`. Import `RebuildOptions` type. Pass options to `rebuildInstance(name, deps, rebuildOptions)`. Update log message to indicate what's happening: if pulling, log "Pulling fresh base images..."; if no-cache, log "Building without cache...".
  - Notes: `--use-cache` is a plain boolean opt-in — named to avoid confusion with a `--no-cache` flag that Commander wouldn't auto-support from `.option('--cache')`.

- [x] Task 12: Run `pnpm check` and verify all tests pass
  - Action: Run `pnpm check` (type-check + lint + test) to confirm the full suite passes with all changes applied.
  - Notes: Fix any type errors, lint issues, or test failures before marking complete.

### Acceptance Criteria

- [x] AC 1: Given a default rebuild (`agent-env rebuild <name>`), when the Dockerfile contains `FROM node:22-bookworm-slim`, then `docker pull node:22-bookworm-slim` is executed before the container is torn down.
- [x] AC 2: Given a default rebuild, when the Dockerfile contains multiple FROM lines (multi-stage), then each unique image is pulled exactly once (deduplicated).
- [x] AC 3: Given a default rebuild, when `docker pull` fails (network error, auth failure, missing image), then rebuild returns a hard error with code `IMAGE_PULL_FAILED` and suggestion mentioning `--no-pull`, and the existing container is NOT stopped or removed.
- [x] AC 4: Given `agent-env rebuild <name> --no-pull`, when rebuild runs, then no `docker pull` commands are executed.
- [x] AC 5: Given a default rebuild, when `devcontainer up` is called, then `--build-no-cache` flag is passed.
- [x] AC 6: Given `agent-env rebuild <name> --use-cache`, when `devcontainer up` is called, then `--build-no-cache` flag is NOT passed.
- [x] AC 7: Given a Dockerfile with `FROM ${VARIABLE}`, when parsing FROM images, then the parameterized line is skipped with a warning logged, and rebuild continues.
- [x] AC 8: Given a Dockerfile with `FROM scratch`, when parsing FROM images, then `scratch` is filtered out and not pulled.
- [x] AC 9: Given a devcontainer.json with no Dockerfile (image-based config using `"image"` property), when rebuild runs with default pull, then the pull step is skipped with an info log, and `--build-no-cache` is NOT passed to `devcontainer up` (flag is meaningless without a Dockerfile to build).
- [x] AC 10: Given a devcontainer.json with `build.dockerfile: "Dockerfile.dev"`, when parsing, then `Dockerfile.dev` is read instead of `Dockerfile`.
- [x] AC 11: Given the interactive menu rebuild action, when a user selects "Rebuild", then the rebuild runs with defaults (pull: true, noCache: true, force: true).
- [x] AC 12: Given a Dockerfile with `FROM --platform=linux/amd64 node:22`, when parsing FROM images, then `node:22` is extracted (not `--platform=linux/amd64`).
- [x] AC 13: Given all changes applied, when `pnpm check` is run, then type-checking, linting, and all existing + new tests pass.

## Additional Context

### Dependencies

- **New package dependency**: `jsonc-parser` — used to parse `devcontainer.json` files which support JSONC (JSON with Comments). This is the same library used by `@devcontainers/cli` itself. Install as a production dependency in `packages/agent-env`: `pnpm add jsonc-parser`. Type definitions are included in the package (no `@types/` needed).
- Uses existing modules: `ContainerLifecycle` (container.ts), `DevcontainerFsDeps` (devcontainer.ts), `rebuildInstance` (rebuild-instance.ts).
- Extends existing interfaces: `ContainerLifecycle` (add `dockerPull`), `DevcontainerFsDeps` (no change — `readFile` already available).

### Testing Strategy

**Unit tests (DI mocked):**
- `devcontainer.test.ts`: `resolveDockerfilePath` (6 cases: build.dockerfile set, default Dockerfile, no Dockerfile, no devcontainer.json, build.dockerfile referencing missing file, JSONC parsing) + `parseDockerfileImages` (8 cases: single, multi-stage, --platform, AS stage, scratch, parameterized, comments, empty)
- `container.test.ts`: `dockerPull` (3 cases: success, failure, timeout args) + `devcontainerUp` build options (3 cases: buildNoCache true, false, omitted)
- `rebuild-instance.test.ts`: Pull integration (5 cases: default pull, --no-pull skip, pull failure safety, no Dockerfile skip, parameterized warning) + noCache integration (2 cases: default passes flag, --use-cache omits flag) + ordering verification (1 case: pull before teardown)
- `interactive-menu.test.ts`: Updated signature (mock accepts RebuildOptions, passes { force: true })

**Integration tests:**
- `cli.test.ts` may need updates if rebuild CLI integration tests exist — verify existing tests still pass with new flags.

**Manual verification:**
- Run `pnpm check` (type-check + lint + test) to confirm full suite passes

### Notes

- This feature was explicitly deferred as "future iteration" in the original rebuild tech spec (line 69: "Docker image cache clearing (`--no-cache`) — deferred to a future iteration").
- The key insight driving the default-on behavior: "rebuild" semantically means "give me a clean slate." Quick restarts use `attach`.

### Elicitation Findings

**Pre-mortem Analysis:**
- Pull failure must be a hard error (not a soft warning) with actionable suggestion to use `--no-pull`. Silent fallback to stale images creates unexpected state.
- Upstream base image changes that break builds are correct behavior — the user asked for fresh. They can use `--no-pull` to work around.
- `devcontainer up --build-no-cache` is confirmed to exist and maps to `docker build --no-cache`.

**What If Scenarios — Edge Cases Identified:**
- Multi-stage builds: multiple FROM lines, possibly different images. Parse all, deduplicate before pulling.
- `FROM image AS stage` syntax: extract image portion only (ignore `AS` alias).
- Parameterized FROM (`FROM ${VAR}`): skip with warning — can't resolve ARG values without Docker's build system.
- No Dockerfile (image-based or compose-based devcontainer.json): skip pull step with info log, do NOT pass `--build-no-cache` (flag is meaningless without a Dockerfile to build).
- Private registries: `docker pull` respects existing `docker login` auth. Auth failures surface as the hard error with `--no-pull` suggestion.
- Comment lines and whitespace in Dockerfile: regex must ignore `#` lines and handle extra whitespace.

**Failure Mode Analysis — Component Breakdown:**

*Dockerfile Locator:*
- No Dockerfile in `.devcontainer/` (image-based config): skip pull, log info, do NOT pass `--build-no-cache`.
- Dockerfile path may not be `Dockerfile` — check `devcontainer.json`'s `build.dockerfile` field to resolve actual filename, fall back to `Dockerfile`.
- `.devcontainer/` missing is already handled by config refresh step earlier in rebuild flow.

*FROM Line Parser — 4 edge cases:*
- `--platform=linux/amd64` flags before image: regex must skip `--flag=value` tokens. Pattern: `/^\s*FROM\s+(?:--\S+\s+)*(\S+)/`
- `AS stage` aliases: first token after FROM (and flags) is the image, `AS` is separate.
- `${VAR}` parameterization: detect `$` in image ref → skip that line, warn user.
- `FROM scratch`: filter out — reserved Docker keyword, not pullable.

*Docker Pull Executor:*
- Fail fast on first pull error — hard error with `--no-pull` suggestion. No multi-error collection (most Dockerfiles have 1-2 FROM lines; collection logic isn't worth the complexity).
- Network timeout, registry auth failure, missing image: all surface as hard error with `--no-pull` escape hatch.

*`--build-no-cache` Passthrough:*
- Only pass when `--use-cache` opt-out is NOT set AND a Dockerfile exists (image-based configs have no build step).
- `devcontainerUp()` signature must be modified to accept build options.

*Integration Ordering (Critical):*
- Pull must happen AFTER config refresh (parse updated Dockerfile) but BEFORE container teardown (failure leaves old container intact).
- Final sequence: config refresh → parse & pull → teardown → `devcontainer up --build-no-cache`.

**Occam's Razor — Simplified Design:**

3 touch points, no new files:
1. `devcontainer.ts` — add `parseDockerfileImages()` (one regex + filters) + `resolveDockerfilePath()` (read `build.dockerfile` from devcontainer.json, fall back to `Dockerfile`)
2. `container.ts` — add `dockerPull(image)` to `ContainerLifecycle`, modify `devcontainerUp()` to accept `{ buildNoCache?: boolean }` options
3. `rebuild-instance.ts` — wire pull step between config refresh and teardown, pass `--build-no-cache` conditionally, add `--no-pull` and `--use-cache` CLI flags

Removed complexity:
- No new file for parser — goes in existing `devcontainer.ts` alongside config utilities
- No multi-error collection on pull — fail fast on first failure
- No Dockerfile "parser" — one regex (`/^\s*FROM\s+(?:--\S+\s+)*(\S+)/`) + two filters (`scratch`, `$`)

## Review Notes

- Adversarial review completed
- Findings: 15 total, 8 fixed, 7 skipped (noise/undecided/out-of-scope)
- Resolution approach: auto-fix
- Fixed: F1 (top-level dockerfile field), F6 (conditional timeout), F7 (ContainerResult type), F8 (concrete types), F9 (JSDoc placement), F11 (CLI option tests), F12 (shared DockerOperationResult), F14 (pull logging)
- Skipped: F2 (build.context — edge case, acknowledged limitation), F3 (image-based pull — out of scope per spec), F4 (space-separated --platform — rare edge case), F5 (input validation — low risk), F10 (flag asymmetry — intentional design), F13 (TOCTOU — handled by error path), F15 (--no-pull semantics — different concept)

## Senior Developer Review (AI)

**Reviewer:** BMad
**Date:** 2026-02-15
**Outcome:** Approved (with auto-fixes)

### Findings Summary
- **M1: Sequential Pulls**: Images were pulled sequentially. Fixed by parallelizing with `Promise.all`.
- **M2: Lack of Pull Progress**: Added "Pulling..." logs for better visibility during long operations.
- **M4: Silent Fallback for Unparseable JSONC**: Updated `resolveDockerfilePath` to throw clear errors for invalid config files.
- **L2: Set Optimization**: Refactored `parseDockerfileImages` to use `Set` directly.
- **L3: Misleading Error Suggestion**: Clarified Dockerfile missing error message.
- **L4: Test Coverage**: Added test case for invalid JSON in devcontainer.json.

### Verified ACs
- [x] AC 1: Docker pull executed for base image
- [x] AC 2: Multi-stage images deduplicated and pulled
- [x] AC 3: Pull failure handled safely
- [x] AC 4: --no-pull flag supported
- [x] AC 5: --build-no-cache passed by default
- [x] AC 6: --use-cache flag supported
- [x] AC 11: Interactive menu updated
- [x] AC 13: Full test suite passing (549 tests)
