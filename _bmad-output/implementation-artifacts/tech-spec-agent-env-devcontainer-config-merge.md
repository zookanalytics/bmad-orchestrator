---
title: 'Agent-Env DevContainer Config Merge'
slug: 'agent-env-devcontainer-config-merge'
created: '2026-03-01'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['typescript', 'jsonc-parser', 'devcontainer-cli', 'vitest']
files_to_modify: ['packages/agent-env/src/lib/devcontainer.ts', 'packages/agent-env/src/lib/devcontainer-merge.ts', 'packages/agent-env/src/lib/create-instance.ts', 'packages/agent-env/src/lib/rebuild-instance.ts', 'packages/agent-env/src/lib/attach-instance.ts', 'packages/agent-env/src/lib/state.ts', 'packages/agent-env/src/commands/create.ts', 'packages/agent-env/src/lib/types.ts']
code_patterns: ['dependency-injection via factory functions', 'single read-modify-write for JSON patches', 'reject:false + result.ok for subprocesses', 'atomic file writes (tmp + rename)']
test_patterns: ['co-located tests (*.test.ts)', 'DI with mock executors', 'fixture-based subprocess output', 'existing array dedup tests for filewatcher commands']
---

# Tech-Spec: Agent-Env DevContainer Config Merge

**Created:** 2026-03-01

## Overview

### Problem Statement

Agent-env's baseline and repo devcontainer configs are mutually exclusive. Repos with their own `.devcontainer/devcontainer.json` miss agent-env managed properties (container naming, env injection, status bar). Repos without config get the baseline but can't customize. Keeping multiple repo configs in sync with agent-env's evolving needs is manual and error-prone.

### Solution

Replace the baseline-vs-repo binary choice with a build-time deep merge. During `agent-env create`, read the repo's `.devcontainer/devcontainer.json` (if present), deep-merge agent-env managed properties into it, and write the merged result to `.agent-env/devcontainer.json`. Always use `--config .agent-env/devcontainer.json` when invoking the devcontainer CLI. Repos without config get a generated config from agent-env managed defaults alone.

### Scope

**In Scope:**
- Define which properties are "agent-env managed" vs "repo-owned"
- Merge strategy per property type (objects merge, arrays concatenate/dedupe, scalars: managed wins or repo wins depending on property)
- Eliminate the `--baseline` / `--no-baseline` flag dichotomy
- Update `create-instance`, `rebuild-instance`, and config refresh logic
- Handle edge cases: repo has no config, repo config conflicts with managed properties
- Audit what's in baseline today vs what should move to LABEL vs what stays as managed merge

**Out of Scope:**
- Changes to the Dockerfile LABEL metadata (already solid — though note that the merge behavior creates a new coupling with LABEL lifecycle command strings; see ADR-4 and `LABEL_LIFECYCLE_CMDS` constants)
- New devcontainer features or CLI wrapper changes
- Multi-config (`.devcontainer/<name>/devcontainer.json`) support — future enhancement
- Changes to other repos' `.devcontainer/` files (they'll benefit automatically once agent-env merges)

**LABEL Coupling Note:** While the LABEL itself is not changing, the merge behavior introduces a dependency on LABEL lifecycle command strings. When a repo defines `postCreateCommand` or `postStartCommand`, the merge function composes them with the LABEL's command using object form, effectively superseding the LABEL's scalar value. The `LABEL_LIFECYCLE_CMDS` constants in the merge module must be kept in sync with the Dockerfile LABEL. If they drift, the LABEL command silently stops running for repos that define those lifecycle commands. This is acknowledged as a maintenance coupling, not a code change to the LABEL.

## Architecture Decisions

### ADR-1: Three-Layer Property Ownership

Properties are classified into three ownership layers. Ownership determines merge conflict resolution.

**Layer 1 — Dockerfile LABEL (image infrastructure, not changing):**
- `remoteUser`, `containerUser`, `capAdd`
- Infrastructure `mounts` (shared-data, pnpm-store, node-modules, gitconfig, ssh-auth, ssh-pub-keys, agent-env)
- Infrastructure `containerEnv` (SSH_AUTH_SOCK, PNPM_HOME, SHARED_DATA_DIR, etc.)
- `postCreateCommand` (post-create.sh), `postStartCommand` (sshd + tmux)
- `forwardPorts` ([22])
- Core VS Code extensions (Claude, Gemini, GitLens, Prettier, ESLint)
- Core VS Code settings (terminal default profile)

**Layer 2 — Agent-env managed (always injected by merge):**
- `image` (points to agent-env image)
- `initializeCommand` (init-host.sh — runs on host before container)
- `name` (project display name + instance discriminator)
- `runArgs` for container naming (`--name=...`)
- `containerEnv`: `AGENT_ENV_INSTANCE`, `AGENT_ENV_CONTAINER`, `AGENT_ENV_REPO`, `AGENT_ENV_PURPOSE` (baked into devcontainer.json, persists)
- `remoteEnv` (transient CLI args, NOT in merged config): `AGENT_INSTANCE`, `AGENT_ENV_PURPOSE` — these are passed via `devcontainerUp()` `--remote-env` flags, not merged into the config file. Note: `AGENT_ENV_PURPOSE` intentionally exists in BOTH `containerEnv` (persisted, for tools that read the config) and `remoteEnv` (transient, for current session override). The containerEnv value is the "last known" purpose; the remoteEnv value is the "current session" purpose.
- Status bar template (deployed to `.agent-env/`)

**Important distinction:** `containerEnv` is baked into the devcontainer.json and persists across container restarts. `remoteEnv` is a transient CLI argument passed at `devcontainer up` time. The merge function handles `containerEnv`. The `remoteEnv` values are passed as `devcontainerUp()` options: `AGENT_INSTANCE` is passed in create, rebuild, and attach; `AGENT_ENV_PURPOSE` is passed in create and rebuild but NOT in attach (current behavior — attach uses the containerEnv "last known" purpose instead). `AGENT_ENV_PURPOSE` is intentionally dual-homed: containerEnv carries the "last known" purpose (persisted at create/rebuild time), while remoteEnv carries the "current session" purpose during create/rebuild. Attach does not override purpose via remoteEnv — it relies on the persisted containerEnv value, which is correct since attach re-enters an existing container without changing its purpose.

**Layer 3 — Repo-owned (from `.devcontainer/devcontainer.json`):**
- `name` base text (project display name, used as prefix by Layer 2)
- `runArgs` (non-naming: `--shm-size`, OrbStack labels, etc.)
- `containerEnv` additions (PROJECT_NAME, NODE_OPTIONS, ENABLE_BMAD_ORCHESTRATOR)
- `portsAttributes`
- Additional `mounts`
- Additional VS Code extensions and settings
- Additional lifecycle command steps

### ADR-2: Merge Strategy Per Property Type

| JSON Type | Strategy | Conflict Resolution |
|-----------|----------|---------------------|
| **Scalars** | Managed-owned: managed wins. Repo-owned: repo wins. | Ownership table is definitive. |
| **Objects** (`containerEnv`, `customizations`) | Deep merge — keys from both sides. | Managed-owned keys cannot be overridden by repo. |
| **Arrays** (`mounts`, `extensions`) | Concatenate + deduplicate. | Managed entries first, then repo entries. |
| **`runArgs`** | Flag-aware merge. Managed-owned flags (`--name`) replace. Others concatenate. | Strip managed-owned flags from repo's `runArgs` before concatenating. |
| **Lifecycle commands** | Convert to object form for composition. | Managed key: `"agent-env"`, repo key: `"repo"`. |

### ADR-3: `name` Property Merge

The `name` field uses a composite strategy:

- If repo provides `name` → use as base, append ` - {instance_name}` (e.g., `"Agent Tools - my-feature"`)
- If repo has no `name` → agent-env derives from project/workspace name + instance (e.g., `"bmad-orchestrator - my-feature"`)

The repo's `name` is the "project brand". Agent-env adds the instance discriminator for multi-instance visibility.

### ADR-4: Lifecycle Command Composition

Use the devcontainer spec's object form for lifecycle commands to enable clean Layer 2 + Layer 3 composition:

```json
{
  "initializeCommand": {
    "agent-env": "bash .agent-env/init-host.sh",
    "repo": "bash -c 'touch ~/.gitconfig'"
  }
}
```

- If repo has a string → wrap as `"repo"` key
- If repo has an array → wrap as `"repo"` key (devcontainer CLI handles arrays in object values)
- If repo has an object → merge keys (agent-env reserves the `"agent-env"` key name)
- Managed always injects the `"agent-env"` key

**LABEL collision warning:** `postCreateCommand` and `postStartCommand` are Layer 1 (LABEL). If a repo config sets these, they will pass through `...repoRest` and the devcontainer CLI will use the config value INSTEAD of the LABEL value (config takes precedence over LABEL for scalar lifecycle commands). The merge function handles lifecycle commands in two parts:
1. `initializeCommand` is handled by a standalone `composeLifecycle(managed.initializeCmd, ...)` call — it is Layer 2 managed with its own dedicated field in `ManagedConfig`.
2. `composeAllLifecycle()` handles the REMAINING lifecycle commands: `postCreateCommand`, `postStartCommand`, `postAttachCommand`, `onCreateCommand`, `updateContentCommand`. It does NOT handle `initializeCommand` (already handled) or `waitFor` (see below). For commands that have a LABEL value (postCreateCommand, postStartCommand), the managed key references the LABEL's command so it is preserved. For commands with no LABEL value, `composeLifecycle()` only wraps if the repo defines one.

**Note on `waitFor`:** `waitFor` is NOT a lifecycle command — it is a string enum (`"initializeCommand" | "onCreateCommand" | ...`) that tells the CLI which command to wait for before considering the container ready. It must NOT be passed through `composeLifecycle()`. If the repo defines `waitFor`, it passes through via `...repoRest` unchanged.

### ADR-5: Replace `configSource` State Field

The `configSource: 'baseline' | 'repo'` dichotomy is eliminated. Replace with:

```typescript
repoConfigDetected: boolean
```

- `true`: repo had its own `.devcontainer/devcontainer.json` — during rebuild, re-read and re-merge
- `false`: no repo config found — regenerate from managed defaults alone

### ADR-6: Managed Config Is Thin

Nothing moves to LABEL. The managed config's minimum footprint is:
1. `image` (pointing to the agent-env image)
2. `initializeCommand` (agent-env host setup via `init-host.sh`)
3. Instance-specific patches (`name`, `containerEnv: AGENT_ENV_INSTANCE, AGENT_ENV_CONTAINER, AGENT_ENV_REPO, AGENT_ENV_PURPOSE`, container naming `runArgs`)
4. Merged-in repo additions for everything else
5. VS Code settings: `betterStatusBar.configurationFile` (value: `/etc/agent-env/statusBar.json` — sourced from `CONTAINER_AGENT_ENV_DIR` + `STATUS_BAR_JSON_FILENAME` in `container-env.ts`/`devcontainer.ts`) and `filewatcher.commands` (migrated from `applyVscodeSettingsPatch()`)

Note: `AGENT_INSTANCE` is NOT in the merged config — it is passed as `remoteEnv` CLI arg at `devcontainerUp()` time, same as today. `AGENT_ENV_PURPOSE` is dual-homed: it appears in containerEnv (persisted "last known" purpose) AND as a remoteEnv CLI arg (transient "current session" purpose).

**Known limitation (pre-existing):** When a user runs `agent-env purpose set` to change an instance's purpose, the state.json is updated but the generated `.agent-env/devcontainer.json` is NOT regenerated. The `AGENT_ENV_PURPOSE` in containerEnv becomes stale until the next rebuild. This is identical to current behavior (where `patchContainerEnv()` only runs at create/rebuild time). The remoteEnv `AGENT_ENV_PURPOSE` is always fresh for create/rebuild sessions. A future enhancement could trigger config regeneration on `purpose set`.

All infrastructure remains in LABEL where it already lives.

### ADR-7: Merge Implementation — Declarative Single Function with Named Helpers

Use a single `mergeDevcontainerConfigs()` function that builds the merged object declaratively, with named pure-function helpers for special-case merges. This avoids both over-engineering (schema-driven) and mutation-based patterns (reduce pipeline).

**Rationale:** Evaluated four approaches:
- **A) Single merge function** — most readable, one function tells the full story
- **B) Sequential patch pipeline** — matches existing `applyBaselinePatches`, but mutates
- **C) Template with repo injection** — inverted mental model, drops unknown properties
- **D) Schema-driven** — over-engineered for ~6 managed properties

Selected **A with B's insight**: extract special-case logic into independently testable helpers, but compose them declaratively (not as a reduce pipeline).

**Structure:**

```typescript
// lib/devcontainer-merge.ts
export function mergeDevcontainerConfigs(
  managed: ManagedConfig,
  repoConfig?: ParsedDevcontainerConfig
): DevcontainerConfig {
  if (!repoConfig) return buildManagedOnly(managed);

  const { name, image, initializeCommand, postCreateCommand, postStartCommand,
          postAttachCommand, onCreateCommand, updateContentCommand,
          runArgs, containerEnv, customizations, mounts, ...repoRest } = repoConfig;

  return {
    ...repoRest,                                                    // repo-owned pass-through (includes waitFor if defined)
    image: managed.image,                                           // managed owns
    name: composeName(managed.instanceName, name),                  // composite
    initializeCommand: composeLifecycle(managed.initializeCmd, initializeCommand),  // standalone
    ...composeAllLifecycle(managed.lifecycleCmds, {                 // LABEL-safe composition (NOT initializeCommand, NOT waitFor)
      postCreateCommand, postStartCommand, postAttachCommand,
      onCreateCommand, updateContentCommand }),
    runArgs: mergeRunArgs(managed.runArgs, runArgs),                 // flag-aware
    containerEnv: { ...containerEnv, ...managed.containerEnv },     // managed keys win
    mounts: mergeMounts(managed.mounts, mounts),                    // target-path dedup (managed.mounts is empty by default — LABEL handles infrastructure mounts)
    customizations: deepMergeCustomizations(managed.customizations, customizations),
  };
}
```

**Key properties:**
- Unknown/new devcontainer properties pass through via `...repoRest` spread
- Managed-owned keys are set after spread, so they always win
- Each helper (`composeName`, `composeLifecycle`, `mergeRunArgs`, `deepMergeCustomizations`) is a pure function, independently testable
- No mutation, no pipeline ordering concerns
- **Spread semantics note:** `composeAllLifecycle()` returns an object with only the keys it needs to set (e.g., `{ postCreateCommand: { ... } }` when repo defines it). Keys where neither managed nor repo defines a value are OMITTED (not set to `undefined`). This is safe because the destructuring already removed those keys from `repoRest`, so omitting them from the spread means they simply don't appear in the output. The `containerEnv` spread (`{ ...containerEnv, ...managed.containerEnv }`) is safe even when `containerEnv` is `undefined` — JavaScript handles `...undefined` as a no-op.

## Context for Development

### Codebase Patterns

- **Dependency injection:** Factory functions accept executor/deps parameters for testability. The merge function should accept a `deps` parameter for filesystem operations (reading repo config).
- **Single read-modify-write:** `applyBaselinePatches()` reads the JSON file once, applies all patches to the in-memory object, writes once. The merge function should follow this same pattern.
- **JSONC parsing already available:** `jsonc-parser` v3.3.1 is already a dependency. The `parseJsonc()` function is used in `resolveDockerfilePath()` (devcontainer.ts:443). Use the same function for parsing repo configs.
- **Atomic file writes:** State files use tmp + rename pattern. The generated `.agent-env/devcontainer.json` should follow the same pattern.
- **Existing comment warning:** `applyBaselinePatches()` has an explicit comment (line 360-361): _"Uses JSON.parse (not JSONC). Safe for baseline configs which are strict JSON. Do not extend to repo-provided configs without switching to JSONC."_ — This anticipated the need for JSONC support.

### Files to Modify

| File | Purpose | Change Summary |
| ---- | ------- | -------------- |
| `packages/agent-env/src/lib/devcontainer.ts` | Baseline copy/patch logic | Add `mergeDevcontainerConfigs()` and helpers. Deprecate/remove `applyBaselinePatches()`, `copyBaselineConfig()`. Keep `hasDevcontainerConfig()`, `copyStatusBarTemplate()`, `getBaselineConfigPath()`. |
| `packages/agent-env/src/lib/create-instance.ts` | Create flow orchestration | Replace `resolveConfigChoice()`/`setupDevcontainerConfig()` with always-merge flow. Remove `AskBaselineChoice` callback, `BaselineChoice` type, `deriveBaselineChoice()`. Always write merged config to `.agent-env/devcontainer.json`, always pass `--config`. |
| `packages/agent-env/src/lib/rebuild-instance.ts` | Rebuild/refresh logic | Replace `refreshConfig()` branching. Always re-read repo config (if `repoConfigDetected`) + re-merge + re-write. Remove baseline-vs-repo branches. |
| `packages/agent-env/src/lib/attach-instance.ts` | Attach flow | Update `configSource`-based branching to always use `--config .agent-env/devcontainer.json`. Remove baseline-vs-repo `configPath` derivation. |
| `packages/agent-env/src/lib/state.ts` | State creation/migration | Update `createInitialState()` to write `repoConfigDetected` instead of `configSource`. Add `migrateConfigSource()` to `readState()` so migration runs on every state read (not lazy). |
| `packages/agent-env/src/commands/create.ts` | CLI flag definitions | Remove `--baseline` and `--no-baseline` options. Remove `createBaselinePrompt()`. Add deprecation error for removed flags. |
| `packages/agent-env/src/lib/types.ts` | State schema | Replace `configSource?: 'baseline' \| 'repo'` with `repoConfigDetected: boolean`. Update `InstanceState` interface. |
| `packages/agent-env/src/lib/devcontainer.test.ts` | Tests for devcontainer module | Add tests for `mergeDevcontainerConfigs()` and all helpers. Cover: no repo config, JSONC comments, variable passthrough, runArgs flag dedup, lifecycle composition, name composition, build/compose rejection. |
| `packages/agent-env/src/lib/create-instance.test.ts` | Tests for create flow | Update tests: remove baseline/repo choice tests, add merged-config tests, verify `--config` always passed. |
| `packages/agent-env/src/lib/rebuild-instance.test.ts` | Tests for rebuild flow | Update tests: remove baseline/repo branching, verify re-merge on rebuild. |
| `packages/agent-env/src/commands/create.test.ts` | Tests for CLI flags | Remove `--baseline`/`--no-baseline` tests. Add deprecation error tests. |
| `packages/agent-env/src/lib/attach-instance.test.ts` | Tests for attach flow | Update `configSource` branching tests. Verify `--config` always passed. |
| `packages/agent-env/src/lib/cli.test.ts` | CLI integration tests | Update workspace helper factories that construct test state objects — replace `configSource: 'baseline'` with `repoConfigDetected: false` (and `'repo'` with `true`). These helpers are likely shared across test suites, so verify no cascade failures. Search for all `configSource` references in test helpers/fixtures. |

### Files to Reference (Read-Only)

| File | Purpose |
| ---- | ------- |
| `image/Dockerfile` (lines 249-293) | LABEL `devcontainer.metadata` — Layer 1 reference |
| `.devcontainer/devcontainer.json` | Example repo config for this monorepo — test case |
| `packages/agent-env/config/baseline/devcontainer.json` | Current baseline config — reference for managed defaults |
| `packages/agent-env/config/baseline/init-host.sh` | Host init script — managed `initializeCommand` target |
| `packages/agent-env/config/templates/statusBar.template.json` | Status bar template — deployed separately by `copyStatusBarTemplate()` |

### Technical Decisions

1. **New file vs extend existing:** Create a new `devcontainer-merge.ts` module for the merge function and helpers. Keep `devcontainer.ts` for discovery/detection functions (`hasDevcontainerConfig`, `getBaselineConfigPath`, `copyStatusBarTemplate`). This separates the new merge logic from legacy code being removed.
2. **No new dependencies:** `jsonc-parser` already available. No need for deep-merge libraries — the merge is domain-specific enough that a generic deep-merge would need wrapping anyway.
3. **Generated file header and format:** The generated `.agent-env/devcontainer.json` is a JSONC file (not strict JSON). Write `// AUTO-GENERATED by agent-env v{version}. Source: .devcontainer/devcontainer.json + managed defaults. Do not edit.\n` as the first line (where `{version}` is read from the agent-env package.json), followed by `JSON.stringify(config, null, 2)`. The version stamp aids debugging stale configs after upgrades. The devcontainer CLI natively reads JSONC, so this is safe. Any agent-env code that re-reads this file (e.g., during rebuild) MUST use `parseJsonc()`, not `JSON.parse()`. The `writeGeneratedConfig()` function owns this format.
4. **Backwards compatibility:** Existing instances with `configSource: 'baseline'` or `configSource: 'repo'` need migration. On first rebuild after upgrade, treat `'baseline'` as `repoConfigDetected: false` and `'repo'` as `repoConfigDetected: true`. Write updated state.
5. **Config type validation:** During merge, if repo config has `build`, `dockerFile`, `dockerfile` (lowercase variant), or `dockerComposeFile` properties, reject with a clear error: "agent-env requires the managed image. Remove build/compose config from .devcontainer/devcontainer.json to use agent-env." If the repo config specifies an `image` property (which is silently overridden by managed `image`), log a warning: `"Repo config specifies image '${repoImage}' which will be overridden by agent-env managed image."` This makes the override visible rather than silent.
6. **`containerEnv` key ownership:** The managed merge injects `AGENT_ENV_INSTANCE`, `AGENT_ENV_CONTAINER`, `AGENT_ENV_REPO`, and `AGENT_ENV_PURPOSE` into `containerEnv`. This monorepo's `.devcontainer/devcontainer.json` currently sets `AGENT_INSTANCE` in `containerEnv` — this is a different key name and will NOT be overwritten (it passes through as a repo-owned key). However, repos should be aware that `AGENT_ENV_INSTANCE` is the canonical containerEnv key managed by agent-env. The `AGENT_INSTANCE` remoteEnv continues to be injected at CLI invocation time via `--remote-env`, not in the merged config. **Note on `AGENT_ENV_CONTAINER` redundancy:** This key appears in three places: (1) Dockerfile LABEL containerEnv, (2) managed merge containerEnv, and (3) potentially in repo configs. This is intentional — the LABEL sets it at the image level, managed merge sets it for the generated config, and the merge's "managed keys win" strategy ensures consistency. The redundancy is harmless (same value `"true"` in all layers) and defensive (ensures the key is always present regardless of which layers are active).
7. **`ManagedConfig.image` source:** The image URL is sourced from the baseline config file at `packages/agent-env/config/baseline/devcontainer.json`. The merge module reads this value from the baseline file (via `getBaselineConfigPath()`) rather than hardcoding it, so image updates only require changing one file.

## Implementation Plan

### Tasks

Tasks are ordered by dependency — each task builds on the previous.

- [x] **Task 1: Create merge module (`devcontainer-merge.ts` + tests)**
  - File: `packages/agent-env/src/lib/devcontainer-merge.ts` (NEW)
  - File: `packages/agent-env/src/lib/devcontainer-merge.test.ts` (NEW)
  - Action: Create the core merge function and all helpers:
    - `readRepoConfig(workspacePath, deps)` — searches for repo devcontainer config as FILES at three locations: (1) `.devcontainer/devcontainer.json`, (2) root-level `devcontainer.json`, (3) root-level `.devcontainer.json`. Checks for each file's existence (NOT directory existence — unlike `hasDevcontainerConfig()` which returns true for a bare `.devcontainer/` directory). Reads the first found using `parseJsonc()`, returns parsed object or `undefined` if none found. **On parse error (invalid JSONC):** throw a descriptive error including the file path — do NOT silently return `undefined`, as this would mask real syntax errors the user should fix. Must handle ENOENT gracefully at each location — if `.devcontainer/` dir exists but no `devcontainer.json` inside, continue checking other locations. If no config file found at any location, return `undefined` (treat as no repo config). The search order matches `resolveDockerfilePath()` which also checks for the file, not the directory. **Feedback loop guard:** After reading the RAW file content (before calling `parseJsonc()`), check if the first line starts with `// AUTO-GENERATED by agent-env`. This must happen on the raw string, not the parsed result, because `parseJsonc()` strips comments. If the header is detected, log a warning (`"Skipping auto-generated config at {path} — this appears to be agent-env's own output, not a repo config"`) and treat it as not found (continue to next location or return `undefined`). This prevents merge-of-a-merge if someone symlinks or copies the generated file into a config search location.
    - `validateRepoConfig(config, logger?)` — rejects configs with `build`, `dockerFile`, `dockerfile` (lowercase — devcontainer spec supports both cases), or `dockerComposeFile` properties. If `image` is present, logs a warning via the optional `logger` parameter (default: `console.warn`). The logger is optional to keep the function easily testable — tests can pass a mock logger to capture warnings.
    - `mergeDevcontainerConfigs(managed, repoConfig?)` — main merge function per ADR-7
    - `buildManagedOnly(managed)` — generates a `DevcontainerConfig` when no repo config exists. Returns: `{ image, name, initializeCommand, runArgs, containerEnv, mounts, customizations }`. `initializeCommand` is emitted as a **plain string** (e.g., `"bash .agent-env/init-host.sh"`), NOT object form — there is no repo command to compose with, so wrapping in `{ "agent-env": "..." }` is unnecessary and plain string is the simplest form the devcontainer CLI handles. **Critically: OMIT `postCreateCommand` and `postStartCommand`** — these are Layer 1 (LABEL) commands and the LABEL handles them natively when no config file overrides them. Emitting them in object form would needlessly override the LABEL's scalar form. Other lifecycle commands (`postAttachCommand`, `onCreateCommand`, `updateContentCommand`) are also omitted since neither managed nor repo defines them in this path.
    - `composeName(instanceName, repoName?)` — name merge per ADR-3
    - `composeLifecycle(managedCmd: string, repoCmd?: unknown)` — lifecycle composition per ADR-4 for a single command. The `repoCmd` is `unknown` (from JSONC parsing). Narrow at runtime: if `string` → wrap as `"repo"` key; if `Array.isArray` → wrap as `"repo"` key; if non-null `object` → merge keys. If `undefined`, `null`, `number`, `boolean`, or other unexpected type → treat as absent (return managed command as plain string, not object form).
    - `composeAllLifecycle(managedLifecycleCmds, repoLifecycleCmds)` — applies `composeLifecycle()` to the remaining lifecycle command properties: `postCreateCommand`, `postStartCommand`, `postAttachCommand`, `onCreateCommand`, `updateContentCommand`. Does NOT handle `initializeCommand` (handled separately by the standalone `composeLifecycle()` call) or `waitFor` (not a lifecycle command — it's a string enum that passes through via `...repoRest`). For commands with a LABEL value (postCreateCommand, postStartCommand), the managed key references the LABEL's command string. For commands with no LABEL value, only wraps if repo defines one. Returns an object spread into the merged config. Omits properties where neither managed nor repo defines a value.
    - `mergeRunArgs(managedArgs, repoArgs?)` — flag-aware merge, strips `--name` from repo args. Must handle both forms: `--name=value` (single element) and `--name value` (two consecutive elements where `--name` is followed by its value). Filter logic: iterate with an index, remove any element where it starts with exact `--name=` prefix, AND if an element is exactly `--name` (strict equality, NOT prefix match — must not match `--hostname` or similar), also skip the next element (the value). **Boundary guard:** if `--name` is the last element with no following value, only remove `--name` itself (do not read past array end). Use exact string operations, not regex, to prevent future regressions from loose pattern matching.
    - `mergeMounts(managedMounts: string[], repoMounts?: unknown)` — concatenates mount arrays (narrows `repoMounts` from `unknown`: must be array of strings/objects, else treated as absent). Deduplication key is the `target` path extracted from the mount. For string-form mounts (`"source=...,target=...,type=..."`), parse the `target=` segment. For object-form mounts (`{ source, target, type }`), read the `target` property (also check `destination` as a Docker synonym). If both managed and repo define a mount to the same target, managed wins (repo mount is dropped).
    - `deepMergeCustomizations(managed, repo?)` — deep merge for VS Code extensions (concat+dedupe) and settings (object merge). **Critical:** Must incorporate the VS Code settings previously injected by `applyVscodeSettingsPatch()` in the old `applyBaselinePatches()` — specifically `betterStatusBar.configurationFile` (path to status bar template) and `filewatcher.commands` (array of watcher configs, append managed watcher to existing array, deduplicate by `match` field). The `ManagedConfig.customizations` field carries these settings, and `deepMergeCustomizations()` merges them into the repo's customizations.
    - `writeGeneratedConfig(outputPath, config, deps)` — writes with `// AUTO-GENERATED by agent-env v{version}` header comment, then `JSON.stringify(config, null, 2)`. The version is obtained by importing from the package's own `package.json` (use `createRequire(import.meta.url)` to read it, or a build-time constant if available). Atomic write pattern: write to `{outputPath}.tmp` then `rename` to `{outputPath}` (matching `state.ts` pattern with `STATE_FILE_TMP`).
  - Action: Define types:
    - `ManagedConfig` — image (sourced from baseline config via `loadManagedDefaults()`), instanceName, containerName, initializeCmd (sourced from baseline config via `loadManagedDefaults()`), lifecycleCmds (sourced from `LABEL_LIFECYCLE_CMDS` constants, NOT from baseline config — see `loadManagedDefaults` note above; Record mapping lifecycle command names to their LABEL command strings for `postCreateCommand` and `postStartCommand`), runArgs (string array — the managed `--name=<containerName>` flag; built by callers from `containerName`), containerEnv (includes `AGENT_ENV_INSTANCE`, `AGENT_ENV_CONTAINER: "true"`, `AGENT_ENV_REPO`, `AGENT_ENV_PURPOSE`), mounts (empty array by default — the `.agent-env` → `/etc/agent-env` bind mount is already in the Dockerfile LABEL and should NOT be duplicated in ManagedConfig; adding it would cause the devcontainer CLI to see the mount from both LABEL and config, and Docker's behavior for duplicate bind mounts to the same target is version-dependent), customizations (nested structure matching devcontainer spec: `{ vscode: { settings: { "betterStatusBar.configurationFile": "/etc/agent-env/statusBar.json", "filewatcher.commands": [...] }, extensions: [] } }` — mirrors the nesting from `applyVscodeSettingsPatch()` in the current codebase)
    - `ParsedDevcontainerConfig` — loose type for parsed JSONC: `Record<string, unknown>`. Since all values are `unknown` after JSONC parsing, each helper function must narrow its input (e.g., `composeLifecycle` accepts `unknown` for `repoCmd` and checks `typeof repoCmd === 'string'`, `Array.isArray(repoCmd)`, or `typeof repoCmd === 'object'` before processing; other types are silently ignored, treating the command as absent). The destructuring in `mergeDevcontainerConfigs()` extracts named keys from this record — each destructured variable is typed `unknown` and passed to the appropriate helper for narrowing.
    - `DevcontainerConfig` — the output type of `mergeDevcontainerConfigs()` and `buildManagedOnly()`. This is a concrete typed interface (NOT Record-based) with known fields: `image: string`, `name: string`, `initializeCommand: string | Record<string, string>`, `runArgs: string[]`, `containerEnv: Record<string, string>`, `mounts: string[]`, `customizations: object`, plus optional lifecycle command fields (`postCreateCommand?`, `postStartCommand?`, etc.) and an index signature `[key: string]: unknown` for pass-through repo properties via `...repoRest`.
    - `DevcontainerMergeDeps` — dependency injection interface for filesystem operations used by the merge module. Must follow the established DI pattern: mirror raw `fs/promises` function signatures (like `StateFsDeps` and `DevcontainerFsDeps`). Fields: `readFile: typeof readFile` (from `node:fs/promises`), `writeFile: typeof writeFile`, `rename: typeof rename` (for atomic writes via tmp+rename), `access: typeof access` (for file existence checks — use `access(path, constants.F_OK)` instead of an abstract `fileExists`). This is a superset of `DevcontainerFsDeps` (which has `readFile`, `writeFile`, `access`, `readdir`). The merge module needs `rename` additionally for atomic writes. **Integration with `CreateInstanceDeps`:** The existing `CreateInstanceDeps` interface (create-instance.ts) should be updated in Task 4 to replace its `devcontainerFsDeps` property with `devcontainerMergeDeps: DevcontainerMergeDeps`. Since `DevcontainerMergeDeps` is a superset of the fields needed by `copyStatusBarTemplate()` and `copyManagedAssets()` (both need `readFile`/`writeFile`/`access`), a single deps object can serve all callees. Tests provide mocks with the same signatures.
  - Action: Add `loadManagedDefaults(deps)` helper that reads `config/baseline/devcontainer.json` (via `getBaselineConfigPath()`) and SELECTIVELY extracts only: `image`, `initializeCommand` (used as `ManagedConfig.initializeCmd`). Note: The baseline config file also contains `mounts` and `containerEnv` that duplicate the Dockerfile LABEL — `loadManagedDefaults()` must NOT extract these fields. Extract `containerEnv` ONLY for the `AGENT_ENV_CONTAINER: "true"` key (which is also in the LABEL but needed defensively in managed config). Implementation: read the file, extract `image` and `initializeCommand` by key, extract only the `AGENT_ENV_CONTAINER` key from `containerEnv`, ignore `mounts` entirely. The baseline config file itself is NOT cleaned up (it remains as documentation of what was originally in the baseline), but `loadManagedDefaults()` is selective about what it extracts. Returns a partial `ManagedConfig` with `image`, `initializeCmd`, and base `containerEnv`. Callers fill in instance-specific fields (instanceName, containerName, runArgs, etc.) and VS Code settings (betterStatusBar, filewatcher). **Error path:** If the baseline config file is missing or unparseable (corrupt JSON), throw a descriptive error: `"Failed to load managed defaults from baseline config: {path}. Ensure agent-env package is intact."` This is a fatal error — the package itself is broken if this file is missing.
  - Action: Define LABEL lifecycle command strings as constants in the merge module:
    ```typescript
    // These strings must match the Dockerfile LABEL devcontainer.metadata values.
    // Source of truth: image/Dockerfile lines 275-276
    const LABEL_LIFECYCLE_CMDS: Record<string, string> = {
      postCreateCommand: '/usr/local/bin/post-create.sh',
      postStartCommand: 'sudo /usr/local/bin/start-sshd.sh; tmux new-session -d -s main 2>/dev/null || true',
    };
    ```
    These are NOT read from the baseline config (which doesn't contain them) or from the Docker image (not accessible at build time). They are constants that must be manually kept in sync with the Dockerfile LABEL. Add a `// SYNC:` comment linking to the Dockerfile line numbers. The `composeAllLifecycle()` helper uses these constants as the managed key values for `postCreateCommand` and `postStartCommand` when a repo config defines those commands.
  - Action: Write comprehensive tests covering all helpers and the main merge function (see Testing Strategy)
  - Notes: Pure functions, no side effects except `readRepoConfig` and `writeGeneratedConfig`. DI via deps parameter for filesystem operations.

- [x] **Task 2: Update state schema (`types.ts` + `state.ts`)**
  - File: `packages/agent-env/src/lib/types.ts`
  - File: `packages/agent-env/src/lib/state.ts`
  - Action in `types.ts`: Replace `configSource?: 'baseline' | 'repo'` with `repoConfigDetected: boolean` in `InstanceState` interface (required, not optional — ADR-5 is definitive). Update JSDoc comment. Note: the field is required in the TypeScript interface, but the `migrateConfigSource()` post-processing step in `readState()` ensures it is always populated before any caller sees the state.
  - Action in `state.ts`:
    - Add `migrateConfigSource(state)` helper — converts `configSource: 'baseline'` → `repoConfigDetected: false`, `configSource: 'repo'` → `repoConfigDetected: true`, absent → `repoConfigDetected: false`. Deletes the old `configSource` key from the state object. Returns the mutated state.
    - **Critical: `readState()` pipeline restructuring.** The current `readState()` flow is: `isValidState(parsed)` → if fails → `migrateOldState(parsed)` → if fails → `createFallbackState()`. Do NOT change `isValidState()` to check for `repoConfigDetected` — this would cause every existing state file with `configSource` to fail validation, fall through `migrateOldState()` (which only handles pre-Epic-7 `name`/`repo` format), and silently degrade to `createFallbackState()` destroying all metadata. Instead, hook `migrateConfigSource()` as a POST-PROCESSING step that runs AFTER any successful state load:
      ```
      readState() {
        parsed = JSON.parse(content)
        state = isValidState(parsed) ? parsed
              : migrateOldState(parsed) ?? createFallbackState()
        return migrateConfigSource(state)  // always runs on the result
      }
      ```
      This means `isValidState()` remains unchanged (does NOT check for `repoConfigDetected`). The `migrateOldState()` function already preserves `configSource` from old-format files (state.ts:183-201). The `migrateConfigSource()` step then normalizes `configSource` → `repoConfigDetected` on the already-valid state object, regardless of which path produced it (isValidState, migrateOldState, or createFallbackState).
      **TypeScript type-safety note:** Since `isValidState()` returns `value is InstanceState` but the updated `InstanceState` interface requires `repoConfigDetected`, the type guard would be a lie for objects that pass validation but lack the field. To resolve this, introduce a `RawInstanceState` type (identical to `InstanceState` but with `repoConfigDetected` optional and `configSource` optional). `isValidState()` returns `value is RawInstanceState`. The `migrateConfigSource()` function takes `RawInstanceState` and returns `InstanceState` (with required `repoConfigDetected`). This keeps the type system honest without changing `isValidState()`'s runtime checks. The `readState()` return type is `InstanceState` (post-migration).
    - Update `createInitialState()` to accept `repoConfigDetected: boolean` (required, not optional) in its options parameter instead of the optional `configSource`. Since `repoConfigDetected` is always known at create time (determined by `readRepoConfig()` result), there is no need for a default.
    - Update `createFallbackState()` in `types.ts` to include `repoConfigDetected: false` in the returned object (required for TypeScript compilation after the interface change).
  - Notes: `migrateConfigSource()` is a post-processing normalization, not a pre-validation migration. `isValidState()` and `migrateOldState()` continue working unchanged. The pipeline order is: read file → parse JSON → validate/migrate (existing flow) → `migrateConfigSource()` (new post-processing) → return. Write-back of the normalized state happens on next `writeStateAtomic()` call.

- [x] **Task 3: Refactor `devcontainer.ts` — managed asset copy**
  - File: `packages/agent-env/src/lib/devcontainer.ts`
  - File: `packages/agent-env/src/lib/devcontainer.test.ts`
  - Action: Add `copyManagedAssets(workspacePath, deps)` — copies `init-host.sh` from baseline config dir to `.agent-env/` (without copying `devcontainer.json`). Creates `.agent-env/` dir if needed.
  - Action: Mark deprecated ONLY (do NOT delete yet): Add `@deprecated` JSDoc annotations to `copyBaselineConfig()`, `applyBaselinePatches()`, `patchContainerName()`, `patchContainerEnv()` and their internal helpers. **Do not remove these exports in Task 3** — `create-instance.ts` and `rebuild-instance.ts` still import them. Actual removal happens in Task 4 (create/attach) and Task 5 (rebuild) alongside the caller rewrites that eliminate the imports. This prevents a broken compilation state between tasks.
  - Action: Keep unchanged: `hasDevcontainerConfig()`, `copyStatusBarTemplate()`, `getBaselineConfigPath()`, `getTemplatesPath()`, `listBaselineFiles()`, `resolveDockerfilePath()`, `parseDockerfileImages()`
  - Action: Update tests — add tests for `copyManagedAssets()`. Do NOT remove tests for deprecated functions yet (they are still called by `create-instance.ts` and `rebuild-instance.ts` until Tasks 4 and 5 rewrite those callers). Tests for deprecated functions are removed in Task 6 alongside the function deletion.
  - Notes: `hasDevcontainerConfig()` is retained for non-merge callers (e.g., `resolveDockerfilePath()` uses it). The merge flow does NOT use `hasDevcontainerConfig()` — it calls `readRepoConfig()` directly, which handles all three config locations and returns `undefined` if none found.

- [x] **Task 4: Update create and attach flows**
  - File: `packages/agent-env/src/lib/create-instance.ts`
  - File: `packages/agent-env/src/lib/attach-instance.ts`
  - File: `packages/agent-env/src/commands/create.ts`
  - File: `packages/agent-env/src/lib/create-instance.test.ts`
  - File: `packages/agent-env/src/lib/attach-instance.test.ts`
  - File: `packages/agent-env/src/commands/create.test.ts`
  - Action in `create-instance.ts`:
    - Replace `setupDevcontainerConfig()` with new `setupMergedConfig()`:
      1. Call `readRepoConfig()` to attempt reading the repo's devcontainer config (handles all three config locations internally)
      2. If `readRepoConfig()` returned a config, call `validateRepoConfig()`
      3. Set `repoConfigDetected = readRepoConfig() !== undefined` — this is based on the ACTUAL parse result, not directory existence. A bare `.devcontainer/` directory with no `devcontainer.json` inside results in `repoConfigDetected: false` (not `true`).
      4. Build `ManagedConfig` from instance parameters (containerName, instanceName, purpose, repoSlug, etc.)
      5. Call `mergeDevcontainerConfigs(managed, repoConfig)`
      6. Call `copyManagedAssets()` to copy `init-host.sh` — **HARD REQUIREMENT: must complete before `devcontainerUp()` is called.** The `initializeCommand` in the generated config runs `bash .agent-env/init-host.sh` on the HOST before the container starts. If `init-host.sh` isn't in place when `devcontainerUp()` fires, `initializeCommand` fails. This matches the current flow where `copyBaselineConfig()` runs before `devcontainerUp()`.
      7. Call `copyStatusBarTemplate()` to deploy status bar
      8. Call `writeGeneratedConfig()` to write merged config to `.agent-env/devcontainer.json`
      9. Call `ensureGitExclude()` to ensure `.agent-env/` is excluded from git tracking (preserves existing behavior from current create flow)
      10. Return `{ repoConfigDetected: boolean }` — where `repoConfigDetected` is based on whether `readRepoConfig()` found a parseable config (step 1), NOT on directory existence
    - Remove from `create-instance.ts`: `resolveConfigChoice()`, `deriveBaselineChoice()`, `AskBaselineChoice` type, `BaselineChoice` type, and imports of `copyBaselineConfig`/`applyBaselinePatches` from `devcontainer.ts`
    - Update `configPath` to ALWAYS be `.agent-env/devcontainer.json` (no more `undefined` case)
    - Store `repoConfigDetected` in state instead of `configSource`
  - Action in `commands/create.ts`:
    - Remove `--baseline` and `--no-baseline` option definitions from Commander
    - Remove `createBaselinePrompt()` function
    - Remove mutual exclusion validation for those flags
    - **Complete removal of flags:** Remove `--baseline` and `--no-baseline` option definitions from Commander. Since agent-env now always merges managed config with the repo's config, these flags are obsolete and no longer supported. Any attempt to use them will result in a standard Commander "unknown option" error. This satisfies AC-14.
    - Simplify option passing to `createInstance()`
  - Action in `attach-instance.ts`:
    - Update `configSource`-based branching to always derive `configPath` as `.agent-env/devcontainer.json`. Remove the conditional that sets `configPath` to `undefined` when `configSource === 'repo'`.
    - Since `readState()` now runs `migrateConfigSource()` eagerly, attach can read `repoConfigDetected` directly from state.
  - Action: Update all affected tests (create-instance, attach-instance, create command). Remove baseline/repo choice tests. Add tests verifying merged config is always generated. Verify `--config` is always passed to `devcontainerUp()`. Ensure no `--baseline`/`--no-baseline` tests remain as they are now invalid.

- [x] **Task 5: Update rebuild flow**
  - File: `packages/agent-env/src/lib/rebuild-instance.ts`
  - File: `packages/agent-env/src/lib/rebuild-instance.test.ts`
  - Action: Replace `refreshConfig()` with new `refreshMergedConfig()`:
    1. Read instance state via `readState()` — migration from `configSource` to `repoConfigDetected` happens automatically in `readState()` (see Task 2)
    2. If `repoConfigDetected`: re-read repo config via `readRepoConfig()`. If `readRepoConfig()` returns `undefined` (config was deleted since creation), return a `CONFIG_MISSING` error with recovery guidance: `"Repo devcontainer config was expected but is missing. Either: (1) restore your .devcontainer/devcontainer.json, or (2) destroy and recreate the instance with 'agent-env destroy <name> && agent-env create'."` Do NOT silently fall back to managed-only (this would be a surprising behavioral change). If found, validate and re-merge.
    3. If not `repoConfigDetected`: regenerate from managed defaults via `buildManagedOnly()`
    4. Call `copyManagedAssets()` to refresh `init-host.sh`
    5. Call `copyStatusBarTemplate()` if missing
    6. Call `writeGeneratedConfig()` to write fresh merged config
    7. Write updated state (with migrated `repoConfigDetected` field)
  - Action: Remove baseline-vs-repo branching in `refreshConfig()`. Remove imports of `applyBaselinePatches`/`copyBaselineConfig` from `devcontainer.ts`.
  - Action: Update `configPath` to ALWAYS be `.agent-env/devcontainer.json`
  - Action: Update tests — remove baseline/repo branching tests, add re-merge tests, add state migration test

- [x] **Task 6: Validation and cleanup**
  - File: `packages/agent-env/config/baseline/devcontainer.json` — keep as reference but it's no longer copied as-is. Add a comment explaining it's superseded by the merge module.
  - File: `packages/agent-env/src/lib/cli.test.ts` — update references to `configSource: 'baseline'` in workspace helpers to use `repoConfigDetected`.
  - Action: Verify `.agent-env/devcontainer.json` is in `.gitignore` for repos using agent-env (this is handled by `init-host.sh` which creates `.agent-env/` — check if the gitignore setup covers generated files)
  - Action: Delete the `@deprecated` functions from `devcontainer.ts` that were marked in Task 3 (`copyBaselineConfig()`, `applyBaselinePatches()`, `patchContainerName()`, `patchContainerEnv()`). All callers should now be removed by Tasks 4 and 5. Verify no imports remain. Also delete the corresponding tests from `devcontainer.test.ts` that were retained in Task 3.
  - Action: Grep for any remaining references to `configSource` across the entire `packages/agent-env/src/` directory. Fix any stragglers not caught by earlier tasks.
  - Action: Run full test suite (`pnpm check`) to verify no regressions
  - Action: Manual smoke test: `agent-env create` on a repo with `.devcontainer/`, inspect generated `.agent-env/devcontainer.json` to verify merge is correct
  - Notes: The baseline `devcontainer.json` file stays in the repo as documentation of what managed defaults look like, but is no longer used by `copyBaselineConfig()`.

### Acceptance Criteria

**Happy Path:**

- [x] AC-1: Given a repo with `.devcontainer/devcontainer.json`, when `agent-env create` runs, then `.agent-env/devcontainer.json` contains merged config with both managed properties (image, name, initializeCommand, containerEnv, runArgs) and repo-specific properties (extensions, settings, portsAttributes, extra mounts).

- [x] AC-2: Given a repo without any devcontainer config, when `agent-env create` runs, then `.agent-env/devcontainer.json` contains managed-only config with image, initializeCommand, name, containerEnv, runArgs, and customizations — and does NOT contain `postCreateCommand` or `postStartCommand` (these are Layer 1 LABEL commands that run natively without config override).

- [x] AC-3: Given any `agent-env create` invocation, when the devcontainer CLI is called, then `--config .agent-env/devcontainer.json` is always passed (no more `undefined` configPath).

- [x] AC-4: Given a repo config with `name: "My Project"` and instance name `feature-x`, when merged, then the output name is `"My Project - feature-x"`.

- [x] AC-5: Given a repo config with `initializeCommand: "bash -c 'touch ~/.gitconfig'"`, when merged, then the output `initializeCommand` is `{ "agent-env": "bash .agent-env/init-host.sh", "repo": "bash -c 'touch ~/.gitconfig'" }`.

- [x] AC-6: Given a repo config with `runArgs: ["--name=old-name", "--shm-size=1gb"]`, when merged, then `--name=old-name` is stripped and replaced with the managed `--name`, and `--shm-size=1gb` is preserved.

- [x] AC-7: Given a repo config with VS Code extensions `["ext-a", "ext-b"]` and managed extensions `["ext-c"]`, when merged, then the output extensions array contains all three, deduplicated.

**Error Handling:**

- [x] AC-8: Given a repo config with `"build": { "dockerfile": "Dockerfile" }`, when `agent-env create` runs, then it returns an error with code and message indicating agent-env requires the managed image.

- [x] AC-9: Given a repo config with JSONC comments (`// this is a comment`), when merged, then the config parses successfully and all properties are preserved.

- [x] AC-10: Given a repo config containing `${localWorkspaceFolderBasename}` variable references, when merged, then the variables pass through as literal strings (not resolved or mangled).

**Rebuild and Migration:**

- [x] AC-11: Given an existing instance with `configSource: 'repo'` in state, when `agent-env rebuild` runs, then the state is migrated to `repoConfigDetected: true` and the repo config is re-merged.

- [x] AC-12: Given an existing instance with `configSource: 'baseline'` (or absent) in state, when `agent-env rebuild` runs, then the state is migrated to `repoConfigDetected: false` and managed-only config is regenerated.

- [x] AC-13: Given a rebuild of an instance where the repo's `.devcontainer/devcontainer.json` has been updated since creation, when rebuild runs, then the generated `.agent-env/devcontainer.json` reflects the updated repo config.

**CLI:**

- [x] AC-14: Given the updated CLI, when `--baseline` or `--no-baseline` flags are passed, then the CLI rejects with an error indicating these flags have been removed.

**Edge Cases:**

- [x] AC-15: Given a repo with a `.devcontainer/` directory but no `devcontainer.json` inside it, when `agent-env create` runs, then `readRepoConfig()` returns `undefined`, `repoConfigDetected` is set to `false`, and managed-only config is generated. On subsequent rebuild, the `repoConfigDetected: false` state correctly skips repo config re-read (no CONFIG_MISSING error, no crash).

- [x] AC-16: Given a repo config containing `"AGENT_ENV_CONTAINER": "false"` in `containerEnv`, when merged, then the managed `AGENT_ENV_CONTAINER: "true"` wins and the repo value is overwritten (managed containerEnv keys always win).

- [x] AC-17: Given a repo config with `runArgs: ["--name", "old-name", "--shm-size=1gb"]` (space-separated `--name`), when merged, then both `--name` and `old-name` are stripped (two elements removed) and replaced with the managed `--name=...`, and `--shm-size=1gb` is preserved.

**Generated Output:**

- [x] AC-18: Given any merged config write, when `.agent-env/devcontainer.json` is created, then it begins with `// AUTO-GENERATED by agent-env v{version}` header comment (including the agent-env package version) and the devcontainer CLI can parse it as JSONC.

**Rebuild Error:**

- [x] AC-19: Given an instance with `repoConfigDetected: true` but the repo's `.devcontainer/devcontainer.json` has been deleted since creation, when `agent-env rebuild` runs, then it returns a clear error with recovery guidance indicating the repo config was expected but is missing, rather than silently falling back to managed-only.

## Additional Context

### Dependencies

- **`jsonc-parser`** (already installed, v3.3.1) — for parsing repo devcontainer.json files with comments
- No new runtime dependencies required
- **Backwards compatibility:** Must handle existing instances with `configSource` field during migration
- **Task dependencies (strictly sequential):** Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6. Tasks 1 and 2 are foundational (new merge module + state schema). Task 3 removes the old baseline functions that Tasks 4 and 5 replace callers of. Task 4 rewrites create/attach which Task 5's rebuild depends on for patterns. Task 6 validates the whole chain. Do NOT parallelize Tasks 3-5.

### Testing Strategy

**Unit Tests (devcontainer-merge.test.ts):**
- `composeName()`: with repo name, without repo name, with empty string
- `composeLifecycle()`: string input, array input, object input, no repo input
- `composeAllLifecycle()`: repo defines postCreateCommand (must compose with LABEL value), repo defines postStartCommand (must compose with LABEL value), repo defines postAttachCommand (no LABEL value — only wraps if repo defines), no repo lifecycle commands at all, does NOT process `initializeCommand` or `waitFor`
- `mergeRunArgs()`: strips `--name=value` form, strips `--name value` (space-separated two-element) form, strips `--name` as last element (boundary guard — no out-of-bounds), preserves `--hostname` (must NOT match), preserves other flags, no repo args
- `mergeMounts()`: dedup by target path, managed mount wins on collision, both string and object mount forms, no repo mounts
- `deepMergeCustomizations()`: extension dedup, settings merge, betterStatusBar config injected, filewatcher commands appended and deduped by `match` field, nested objects, no repo customizations
- `validateRepoConfig()`: rejects `build`, `dockerFile`, `dockerfile` (lowercase), `dockerComposeFile`; accepts clean config; logs warning when repo specifies `image` (silently overridden)
- `mergeDevcontainerConfigs()`: full merge with all property types, no-repo-config path (verify `buildManagedOnly()` omits LABEL lifecycle commands and emits `initializeCommand` as plain string), variable passthrough, JSONC comments in input, managed `containerEnv` keys override repo keys, mounts merged with target-path dedup, lifecycle commands composed for all command types, `LABEL_LIFECYCLE_CMDS` constants used correctly for postCreateCommand/postStartCommand composition
- `LABEL_LIFECYCLE_CMDS` sync test: read the Dockerfile LABEL metadata, extract `postCreateCommand` and `postStartCommand` strings, assert they match the constants in the merge module. This test fails if the Dockerfile LABEL changes without updating the constants. (Implementation: read `image/Dockerfile`, parse the LABEL JSON, compare values.)
- `readRepoConfig()` feedback loop guard: file starting with `// AUTO-GENERATED by agent-env` is skipped
- `readRepoConfig()`: found at `.devcontainer/devcontainer.json`, found at root `devcontainer.json`, found at root `.devcontainer.json`, not found at any location, bare `.devcontainer/` dir without `devcontainer.json` (returns undefined), JSONC parsing, invalid JSON (throws with descriptive error including file path — do NOT silently treat corrupt config as absent, as this would mask real syntax errors), feedback loop guard (auto-generated header detected → skipped)
- `writeGeneratedConfig()`: header comment present, output parseable as JSONC, atomic write, **round-trip test**: write a config via `writeGeneratedConfig()`, then read it back via `parseJsonc()` and verify all properties survive the round-trip (header comment doesn't corrupt parsing, no data loss)
- `loadManagedDefaults()`: reads image, initializeCommand, and containerEnv from baseline config file (NOT mounts — those are LABEL-only); throws descriptive error if baseline file is missing or corrupt

**Integration Tests (create-instance.test.ts, rebuild-instance.test.ts, attach-instance.test.ts):**
- Create with repo config → verify merged output and `--config` passed
- Create without repo config → verify managed-only output and `--config` passed
- Create with `--baseline` flag → verify deprecation error
- Attach → verify `--config` always passed (no `undefined` configPath)
- Rebuild with state migration → verify `configSource` → `repoConfigDetected` via `readState()` post-processing (state metadata preserved, NOT destroyed by fallback)
- `readState()` with existing valid state (has `configSource`, no `repoConfigDetected`) → verify `migrateConfigSource()` post-processing adds `repoConfigDetected`, does NOT trigger `createFallbackState()`
- `readState()` with pre-Epic-7 state (has `name`/`repo`) → verify `migrateOldState()` runs first, then `migrateConfigSource()` normalizes
- Rebuild re-merges updated repo config
- Rebuild with `repoConfigDetected: true` but config deleted → verify `CONFIG_MISSING` error (not silent fallback)
- Rebuild does NOT call `hasDevcontainerConfig()` — uses `readRepoConfig()` directly (regression guard for bare-directory bug)
- `cli.test.ts` → verify workspace helper factories use `repoConfigDetected`

**Manual Smoke Test:**
- `agent-env create` on this monorepo (which has `.devcontainer/devcontainer.json`) → inspect generated config
- `agent-env rebuild` → verify config is refreshed

### Notes

- The Dockerfile LABEL metadata already covers infrastructure core (mounts, user, lifecycle, security caps, VS Code extensions). This is Layer 1 and is not changing.
- Agent-env managed properties (Layer 2) should always be applied regardless of whether the repo has its own config.
- Repo-specific additions (Layer 3) come from the repo's `.devcontainer/devcontainer.json` and are preserved through the merge.
- The `--baseline` / `--no-baseline` flags and the user prompt asking which config to use are eliminated. Agent-env always merges.

### Pre-mortem: Identified Risks and Required Mitigations

| # | Risk | Prevention | Priority |
|---|------|-----------|----------|
| 1 | Duplicate `--name` flag in `runArgs` — Docker rejects | Flag-aware `runArgs` merge: managed-owned flags (`--name`) replace, not append. Strip managed flags from repo `runArgs` before concatenating. | Must |
| 2 | Repo config uses JSONC (comments) — `JSON.parse()` fails | Use a JSONC parser (e.g., `jsonc-parser` or `strip-json-comments`). Virtually every real devcontainer.json has comments. | Must |
| 3 | Repo uses `build.dockerfile` or `dockerComposeFile` — merged config has conflicting `image` + `build` | Detect non-image config types during merge. Error with clear message: "agent-env requires the managed image — repo cannot use custom Dockerfile/Compose." | Must |
| 4 | Rebuild uses stale `.agent-env/devcontainer.json` instead of re-merging | Rebuild must ALWAYS re-read repo config + re-apply managed merge. `.agent-env/devcontainer.json` is a generated artifact, never source of truth. Add header comment: `// AUTO-GENERATED by agent-env — do not edit`. | Must |
| 5 | `${localWorkspaceFolderBasename}` and other devcontainer variables mangled during merge | Merge operates on raw parsed objects — no variable resolution. Variables pass through as opaque strings. Test with `${...}` variables to confirm survival. | Must |
| 6 | Generated `.agent-env/devcontainer.json` accidentally committed to git | Verify `.agent-env/devcontainer.json` is covered by `.gitignore`. Add header comment signaling "generated, do not commit". | Should |
| 7 | Object-form lifecycle commands fail on older `@devcontainers/cli` | Validate minimum CLI version. Consider fallback to chained string form if object form proves fragile. Document required CLI version. | Should — **Deferred**: Object form is part of the devcontainer spec and widely supported. If breakage is reported, add version detection and string-form fallback as a follow-up. |
| 8 | `.devcontainer/` directory exists but no standard `devcontainer.json` inside (multi-config layout) | During discovery, if `.devcontainer/` exists but no config found, scan for subdirectories and warn: "Found configs in subdirectories — agent-env supports .devcontainer/devcontainer.json only." | Nice — **Deferred**: Multi-config support is explicitly out of scope. `readRepoConfig()` already handles bare `.devcontainer/` gracefully (returns `undefined`). Add subdirectory scanning as a future enhancement. |

## Review Notes

- Adversarial review completed
- Findings: 12 total, 3 fixed, 9 skipped (noise/undecided)
- Resolution approach: auto-fix
- F1 (fixed): Coerce repo containerEnv values to strings during merge to prevent runtime type violations
- F2 (fixed): Remove hardcoded `.devcontainer/devcontainer.json` path from REPO_CONFIG_MISSING error message
- F3 (fixed): Resolve LABEL sync test Dockerfile path via `import.meta.url` instead of `process.cwd()`
