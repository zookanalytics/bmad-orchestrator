---
title: 'Status bar template resolution and output relocation'
slug: 'status-bar-template-resolution'
created: '2026-02-26'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript', 'Node.js', 'Vitest']
files_to_modify: ['status-bar.ts', 'create-instance.ts', 'devcontainer.ts', 'status-bar.test.ts', 'state.ts', 'purpose-instance.ts', 'rebuild-instance.ts', 'devcontainer.test.ts', 'create-instance.test.ts', 'rebuild-instance.test.ts', 'purpose-instance.test.ts']
code_patterns: ['dependency-injection', 'fallback-resolution', 'atomic-writes', 'devcontainer-patching', 'consolidated-patching']
test_patterns: ['DI-mock-executor', 'fixture-based']
---

# Tech-Spec: Status bar template resolution and output relocation

**Created:** 2026-02-26

## Overview

### Problem Statement

Two problems with the current status bar implementation:

1. **Template overwrite:** `agent-env create` copies a default `.vscode/statusBar.template.json` into the workspace via `copyStatusBarTemplate()`, overwriting any repo-provided template. Agent-env shouldn't write files into repo-managed territory, and repos that don't want a template shouldn't have one forced on them.

2. **Extension config never set:** The `better-status-bar` extension does NOT read from any default file location. It requires an explicit `betterStatusBar.configurationFile` setting with a fully resolved absolute path. This setting was never configured, so the generated `statusBar.json` file is never read by the extension — the feature is non-functional.

### Solution

1. **Copy bundled template to `.agent-env/` at create time:** Instead of copying to `.vscode/`, write the default template to `.agent-env/statusBar.template.json`. This is agent-env's own territory, safe to write, and accessible from both host and container (the workspace is mounted into containers).

2. **Runtime template resolution chain:** Update `regenerateStatusBar()` with a two-location fallback when purpose is set:
   1. `.vscode/statusBar.template.json` (repo-provided override)
   2. `.agent-env/statusBar.template.json` (agent-env default, deployed at create time)
   3. Neither found → error (template missing)

3. **Move generated output to `.agent-env/`:** Write `statusBar.json` to `.agent-env/statusBar.json` instead of `.vscode/statusBar.json`. This keeps generated files in agent-env's territory (already gitignored via `.agent-env/` exclude pattern).

4. **Patch devcontainer.json with extension config:** At create time, patch `customizations.vscode.settings` to include `betterStatusBar.configurationFile` pointing to the absolute path of `.agent-env/statusBar.json`. Follows the existing `patchContainerName()` / `patchContainerEnv()` pattern. Must deep-merge into existing settings, not replace.

5. **Consolidate baseline patching into `applyBaselinePatches()`:** Extract all per-instance devcontainer.json patches (container name, env vars, vscode settings) into a single function. Both `create-instance.ts` and `rebuild-instance.ts` call this function, preventing future patches from being accidentally omitted in one code path. (Addresses the existing gap where `rebuild-instance.ts` already misses `patchContainerEnv`.)

### Scope

**In Scope:**
- Retarget `copyStatusBarTemplate()` to write to `.agent-env/statusBar.template.json` instead of `.vscode/`
- Update `regenerateStatusBar()` with fallback resolution: `.vscode/` repo template → `.agent-env/` default template → error
- Move generated output from `.vscode/statusBar.json` to `.agent-env/statusBar.json`
- Add `patchVscodeSettings()` to inject `betterStatusBar.configurationFile` into devcontainer.json at create time (deep-merge with existing settings)
- Add `applyBaselinePatches()` to consolidate all devcontainer.json patching — used by both create and rebuild flows
- Update `rebuild-instance.ts` `refreshConfig()` to use `applyBaselinePatches()` (fixes existing gap where `patchContainerEnv` was also missing)
- Remove `.vscode/statusBar.json` from `.git/info/exclude` patterns (`.agent-env/` already covers)
- Update all affected tests

**Out of Scope:**
- Non-container VS Code settings injection (`.vscode/settings.json` — up to repo owner)
- `agent-env init-template` scaffold command (tracked: [#36](https://github.com/zookanalytics/bmad-orchestrator/issues/36))
- Template validation or migration tooling
- Merging repo templates with bundled defaults
- Migration tooling for pre-existing instances (see Migration Notes)

## Context for Development

### Codebase Patterns

- **Dependency injection:** All I/O via deps parameter. Factory functions create default deps (e.g., `createPurposeDefaultDeps()`, `createContainerPurposeDefaultDeps()`, `createDefaultDeps()`). Tests inject mocks.
- **Atomic file writes:** Write to `.tmp`, rename. Used in `writeStateAtomic()` at `state.ts:80-94`.
- **Devcontainer patching:** Read JSON → modify → write back. `patchContainerName()` at `devcontainer.ts:199-215` and `patchContainerEnv()` at `devcontainer.ts:230-248` show the pattern — both read existing values, merge with new, write back. **Note:** These use `JSON.parse` (not JSONC parser). Safe for baseline configs which are strict JSON. Do not extend to repo-provided configs without switching to JSONC.
- **Container environment detection:** `isInsideContainer()` checks `AGENT_ENV_CONTAINER` env var. Container paths use `/etc/agent-env` constants. See `container-env.ts:12-15`.
- **Template resolution:** `getTemplatesPath()` at `devcontainer.ts:61-65` uses `fileURLToPath(import.meta.url)` to resolve `config/templates/` relative to source file. `getBaselineConfigPath()` at `devcontainer.ts:45-50` uses the same pattern for `config/baseline/`.
- **Git exclude:** `ensureGitExclude()` at `state.ts:259-289` — reads `.git/info/exclude`, finds missing patterns, appends. Currently includes `.vscode/statusBar.json` in `GIT_EXCLUDE_PATTERNS` at `state.ts:234`.
- **Rebuild config refresh:** `refreshConfig()` at `rebuild-instance.ts:119-183` copies fresh baseline and patches container name — but currently omits `patchContainerEnv` (pre-existing gap). Note: unlike `create-instance.ts` which separates copy and patch operations into two try/catch blocks with different error messages, `refreshConfig` uses a single try/catch. This is a pre-existing design difference — the rebuild error message is generic ("Failed to refresh baseline config") regardless of whether the copy or patch step failed. Splitting into two blocks would improve debuggability but is not required for this spec.

### Files to Reference (with anchor points)

All paths relative to `packages/agent-env/`.

| File | Lines | Purpose |
| ---- | ----- | ------- |
| `src/lib/status-bar.ts` | :1-80 | `regenerateStatusBar(workspaceRoot, purpose, deps)` — currently reads from `.vscode/statusBar.template.json`, writes to `.vscode/statusBar.json`. Needs fallback chain + new output path. |
| `src/lib/status-bar.test.ts` | :1-143 | 6 tests — all use `.vscode/` paths. Need rewrite for fallback chain + `.agent-env/` output. |
| `src/lib/create-instance.ts` | :298-353 | `setupDevcontainerConfig()` — calls `copyBaselineConfig()` at :316, `copyStatusBarTemplate()` at :317, `patchContainerName()` at :330, `patchContainerEnv()` at :331-339. Replace individual patch calls with `applyBaselinePatches()`. |
| `src/lib/devcontainer.ts` | :163-185 | `copyStatusBarTemplate()` — copies `config/templates/.vscode/` dir to workspace `.vscode/`. Needs retarget: copy single template file to `.agent-env/`. |
| `src/lib/devcontainer.ts` | :199-248 | `patchContainerName()` + `patchContainerEnv()` — the merge pattern to follow for `patchVscodeSettings()`. Both use `AGENT_ENV_DIR` as configDir parameter. |
| `src/lib/rebuild-instance.ts` | :119-183 | `refreshConfig()` — copies fresh baseline, only calls `patchContainerName()`. Needs to use `applyBaselinePatches()` instead. |
| `src/lib/purpose-instance.ts` | :145-146 | `setPurpose()` calls `regenerateStatusBar(wsPath.root, newPurpose, deps.statusBarDeps)` — update signature. |
| `src/lib/purpose-instance.ts` | :274-275 | `setContainerPurpose()` calls `regenerateStatusBar(deps.workspaceRoot, newPurpose, deps.statusBarDeps)` — pass `deps.agentEnvDir`. |
| `src/lib/purpose-instance.ts` | :41-45 | `PurposeInstanceDeps` interface — no changes needed (`setPurpose` gets `agentEnvDir` from `wsPath`). |
| `src/lib/purpose-instance.ts` | :153-161 | `ContainerPurposeDeps` interface — already has `agentEnvDir` field (defaults to `CONTAINER_AGENT_ENV_DIR`). No changes needed. |
| `src/lib/container-env.ts` | :12-15 | `CONTAINER_STATE_PATH` and `CONTAINER_AGENT_ENV_DIR` constants. No new constants needed (output path derived from `CONTAINER_AGENT_ENV_DIR` + `STATUS_BAR_JSON`). |
| `src/lib/state.ts` | :234 | `GIT_EXCLUDE_PATTERNS` — remove `.vscode/statusBar.json` from array. |
| `src/lib/state.test.ts` | :671,700 | Two tests assert `.vscode/statusBar.json` in exclude output — update. |
| `config/templates/.vscode/statusBar.template.json` | — | Bundled default template. Move to `config/templates/statusBar.template.json`. |
| `config/baseline/devcontainer.json` | — | Baseline config — no `workspaceFolder`, has `.agent-env` → `/etc/agent-env` bind mount. |

### Technical Decisions

- **Template deployed to `.agent-env/` at create time:** Bundled default copied to `.agent-env/statusBar.template.json` — agent-env's territory, accessible from host and container via bind mount
- **Template resolution order:** `.vscode/statusBar.template.json` (repo override) → `.agent-env/statusBar.template.json` (agent-env default) → error
- **Repo template takes full precedence:** No merging, no validation — if the repo has a `.vscode/statusBar.template.json`, use it as-is
- **Generated output in agent-env territory:** `statusBar.json` written to `.agent-env/statusBar.json` on host, `/etc/agent-env/statusBar.json` in container (same physical file via bind mount)
- **Environment-aware output path:** `regenerateStatusBar()` writes to `join(agentEnvDir, 'statusBar.json')`. In host mode `agentEnvDir` is `wsPath.agentEnvDir` (e.g., `<ws>/.agent-env`). In container mode it is `CONTAINER_AGENT_ENV_DIR` (`/etc/agent-env`). Same pattern as `state.json`.
- **Extension `configurationFile` is a constant:** `/etc/agent-env/statusBar.json` — hardcoded in devcontainer settings patch, no workspace path derivation needed. The `/etc/agent-env` bind mount provides a stable absolute path regardless of workspace folder name or mount configuration.
- **Extension config via devcontainer patching:** `betterStatusBar.configurationFile` set in `customizations.vscode.settings` during create — must deep-merge, not replace existing settings. Follow `patchContainerEnv` merge pattern at `devcontainer.ts:230-248`.
- **Consolidated baseline patching:** All devcontainer.json patches extracted into `applyBaselinePatches()` in `devcontainer.ts`. Performs a **single read-modify-write cycle** using internal pure helper functions (`applyContainerNamePatch`, `applyContainerEnvPatch`, `applyVscodeSettingsPatch`) that operate on the parsed config object. Both `create-instance.ts` and `rebuild-instance.ts` call this single function. Adding a new patch in the future means updating one location.
- **Bundled template source location:** Move from `config/templates/.vscode/statusBar.template.json` to `config/templates/statusBar.template.json` (no longer pretending to be a `.vscode/` file)
- **`regenerateStatusBar` signature change:** Adds `agentEnvDir` parameter. Callers provide the appropriate value for their context. No new deps interfaces needed — `PurposeInstanceDeps` derives `agentEnvDir` from `wsPath`, `ContainerPurposeDeps` already has it.
- **Error behavior on missing template:** `regenerateStatusBar` throws `TEMPLATE_NOT_FOUND` when neither template location has a file (via `Object.assign(new Error('...'), { code: 'TEMPLATE_NOT_FOUND' })`). Callers (`setPurpose`, `setContainerPurpose`) catch this and return a structured error result with code `TEMPLATE_NOT_FOUND` and a user-facing suggestion. This replaces the previous silent-skip behavior. The `PurposeSetResult` error type uses `code: string` (not a union of literal codes) — this matches the existing codebase pattern and is acceptable. Tightening to a discriminated union of known codes is a future improvement, not required for this spec.
- **JSON-only patching:** Patch functions use `JSON.parse` (not JSONC). This is safe because they only operate on baseline configs (strict JSON). Document this limitation so future contributors don't extend to repo configs without switching to JSONC.
- **`resolveDockerfilePath` does not search `.agent-env/`:** This is pre-existing behavior — the function searches `.devcontainer/`, root `devcontainer.json`, and root `.devcontainer.json` (see `devcontainer.ts:284-288`). For baseline configs the devcontainer.json lives in `.agent-env/`, so the rebuild pull step silently skips Dockerfile resolution. Today this is harmless (baseline uses an image, not a Dockerfile). Extending `resolveDockerfilePath` to search `.agent-env/` is out of scope for this spec but should be addressed if baseline configs ever switch to Dockerfile-based builds.
- **Container-mode `workspaceRoot` for `.vscode/` template check:** Inside containers, `workspaceRoot` comes from `deps.workspaceRoot` which defaults to `process.cwd()`. This works because the devcontainer CLI sets the working directory to the workspace folder (typically `/workspaces/<repo-name>`). This is the same assumption used by `setContainerPurpose` for `state.json` access. The baseline `devcontainer.json` has no explicit `workspaceFolder` setting — the devcontainer CLI uses its default. This is a pre-existing pattern, not introduced by this spec.

## Implementation Plan

### Tasks

- [ ] Task 1: Move bundled template file
  - **⚠️ ATOMIC: Must be implemented in the same commit as Task 2.** After Task 1 removes `config/templates/.vscode/`, `copyStatusBarTemplate()` checks `stat(join(templatesPath, '.vscode'))` which will throw ENOENT, causing the function to silently return without copying anything. No test catches this between tasks because `create-instance.test.ts` uses fully mocked deps and Task 11's tests don't exist yet.
  - File: `packages/agent-env/config/templates/.vscode/statusBar.template.json` → `packages/agent-env/config/templates/statusBar.template.json`
  - Action: Move the template file out of the `.vscode/` subdirectory. Remove the now-empty `config/templates/.vscode/` directory.
  - Verify: `npm pack --dry-run` confirms `config/templates/statusBar.template.json` is included in the package.

- [ ] Task 2: Retarget `copyStatusBarTemplate()` to write to `.agent-env/`
  - **⚠️ ATOMIC: Must be implemented in the same commit as Task 1.** See Task 1 warning.
  - File: `packages/agent-env/src/lib/devcontainer.ts` (:163-185)
  - Action: Change `copyStatusBarTemplate()` to copy the single template file from `config/templates/statusBar.template.json` to `<workspace>/.agent-env/statusBar.template.json` instead of copying the `.vscode/` directory. Update `getTemplatesPath()` usage accordingly — resolve to the single file, not a directory. Simplify to: stat source file → mkdir `.agent-env/` → cp single file.
  - Mechanism: Continue using `deps.cp` for the single file copy (not `readFile`+`writeFile`). `fs.cp` works for single files without `{ recursive: true }`. The current function signature `Pick<DevcontainerFsDeps, 'cp' | 'mkdir' | 'stat'>` remains correct — no deps changes needed.
  - Notes: The `.agent-env/` directory is already created by `cloneAndPrepareWorkspace()` at `create-instance.ts:430`, so `mkdir` with `{ recursive: true }` is safe but redundant in the create flow. Keep it for standalone robustness (rebuild also calls this function).

- [ ] Task 3: Add `patchVscodeSettings()` and `applyBaselinePatches()` functions
  - File: `packages/agent-env/src/lib/devcontainer.ts`
  - Action (patchVscodeSettings): **Optional — implement only if API symmetry with `patchContainerName`/`patchContainerEnv` is desired.** Unlike those two, `patchVscodeSettings` has no existing callers — the pure helper `applyVscodeSettingsPatch` (used inside `applyBaselinePatches`) is sufficient. If implemented, add a standalone function that deep-merges `customizations.vscode.settings` into devcontainer.json. Follow the `patchContainerEnv()` pattern at :230-248 (read JSON → merge → write). The function should:
    1. Read devcontainer.json (using `JSON.parse` — baseline configs are strict JSON)
    2. Ensure `customizations.vscode.settings` object path exists (create if missing)
    3. **Defensive checks:** If `customizations` exists but is not a plain object, overwrite it with `{}`. Same for `customizations.vscode` and `customizations.vscode.settings`. Follow the `patchContainerEnv` pattern: `typeof val === 'object' && val !== null`.
    4. Spread existing settings, overlay new keys: `{ ...existing, "betterStatusBar.configurationFile": "/etc/agent-env/statusBar.json" }`
    5. Write back
  - Action (applyBaselinePatches): Add new function that consolidates all baseline devcontainer.json patching into a **single read-modify-write cycle** (not three sequential read-parse-write calls). This avoids 3 disk round-trips and prevents mock-based tests from losing earlier patches (mocked `readFile` always returns `'{}'`, so sequential patches overwrite each other):
    ```typescript
    export async function applyBaselinePatches(
      workspacePath: string,
      containerName: string,
      envVars: Record<string, string>,
      deps: Pick<DevcontainerFsDeps, 'readFile' | 'writeFile'>,
      configDir: string
    ): Promise<void> {
      const configPath = join(workspacePath, configDir, 'devcontainer.json');
      const content = await deps.readFile(configPath, 'utf-8');
      let config = JSON.parse(content);

      // Apply all patches to in-memory config object
      config = applyContainerNamePatch(config, containerName);
      config = applyContainerEnvPatch(config, envVars);
      config = applyVscodeSettingsPatch(config);

      await deps.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
    }
    ```
    The `apply*Patch` helpers are **private (non-exported) pure functions** that take a config object and return the modified object. They contain the same merge logic as the existing `patchContainerName`/`patchContainerEnv` functions but without I/O. The existing standalone `patchContainerName()`, `patchContainerEnv()`, and `patchVscodeSettings()` functions remain as public API for callers that need to patch a single property.
  - Notes:
    - Use `CONTAINER_AGENT_ENV_DIR` constant from `container-env.ts` to build the `configurationFile` path inside `applyVscodeSettingsPatch`.
    - The `configDir` parameter has **no default value** — both call sites (create and rebuild) always pass `AGENT_ENV_DIR` explicitly. A default would mislead future developers into thinking baseline patching might work with other config directories.
    - The deps subset (`Pick<DevcontainerFsDeps, 'readFile' | 'writeFile'>`) must remain within the **intersection** of `CreateInstanceDeps.devcontainerFsDeps` and `RebuildInstanceDeps.devcontainerFsDeps`. Both include `readFile` and `writeFile`, so this is satisfied. Do not add `readdir` (present in rebuild deps but not create deps).
    - Export `applyBaselinePatches` for use by both create and rebuild.

- [ ] Task 4: Update create-instance flow to use `applyBaselinePatches()`
  - File: `packages/agent-env/src/lib/create-instance.ts` (:298-353, `setupDevcontainerConfig()`)
  - Action: Replace the individual `patchContainerName()` and `patchContainerEnv()` calls at :330-339 with a single `applyBaselinePatches()` call. Import `applyBaselinePatches` from `devcontainer.js` (replacing individual patch imports). Pass `AGENT_ENV_DIR` explicitly as `configDir` (no default).
  - Notes:
    - Only called for baseline configs.
    - **Preserve the two-block try/catch structure.** `setupDevcontainerConfig()` has two separate try/catch blocks: the first (lines 315-327) handles file copy operations (`copyBaselineConfig`, `copyStatusBarTemplate`), the second (lines 329-351) handles JSON patching. `applyBaselinePatches()` replaces the individual patch calls in the **second** try/catch block. Do NOT collapse the blocks — a template copy failure should return "Failed to copy baseline devcontainer config" (first block), while a patch failure should return "Failed to patch baseline devcontainer.json" (second block). Different error semantics for different failure modes.

- [ ] Task 5: Update rebuild-instance flow to use `applyBaselinePatches()` and add `copyStatusBarTemplate()`
  - File: `packages/agent-env/src/lib/rebuild-instance.ts` (:119-183, `refreshConfig()`)
  - Action:
    1. **Add `envVars` parameter to `refreshConfig`:** The current private function signature is `refreshConfig(wsRoot, containerName, configSource, deps)`. Change to:
       ```typescript
       async function refreshConfig(
         wsRoot: string,
         containerName: string,
         configSource: 'baseline' | 'repo',
         envVars: Record<string, string>,
         deps: Pick<RebuildInstanceDeps, 'devcontainerFsDeps' | 'rm' | 'rename' | 'logger'>
       ): Promise<ConfigRefreshResult>
       ```
    2. **Replace `patchContainerName()` at :135 with `applyBaselinePatches()`:** Pass `containerName`, `envVars`, and `AGENT_ENV_DIR` explicitly. This fixes the existing gap where `patchContainerEnv` was missing from rebuild, and also adds `patchVscodeSettings`.
    3. **Add `copyStatusBarTemplate()` call** inside the baseline branch of `refreshConfig`, after the `cp(getBaselineConfigPath(), agentEnvDir)` call and before `applyBaselinePatches()`. **Use "copy if not exists" semantics:** check whether `.agent-env/statusBar.template.json` already exists (via `stat`), and only call `copyStatusBarTemplate` if it does not. **Important:** The stat catch must check `err.code === 'ENOENT'` specifically — re-throw non-ENOENT errors (e.g., `EACCES`). A bare `catch {}` would treat permission errors as "file not found" and silently attempt an overwrite. Pattern:
       ```typescript
       const templatePath = join(agentEnvDir, 'statusBar.template.json');
       try {
         await deps.devcontainerFsDeps.stat(templatePath);
         // exists — skip, preserve user customizations
       } catch (err: unknown) {
         if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
         await copyStatusBarTemplate(wsRoot, deps.devcontainerFsDeps);
       }
       ```
       This prevents rebuild from overwriting user customizations to the template file. Users who want to reset to the bundled default can delete `.agent-env/statusBar.template.json` and rebuild. Users who want repo-level customization should place their template in `.vscode/statusBar.template.json` (which takes precedence in the resolution chain regardless).
    4. **Update the `refreshConfig` call site** in `rebuildInstance()` (search for `await refreshConfig(` — do not rely on line numbers as earlier edits shift them): Build env vars from state and pass to `refreshConfig`:
       ```typescript
       const envVars: Record<string, string> = {
         AGENT_ENV_INSTANCE: wsPath.name,
         AGENT_ENV_REPO: state.repoSlug ?? '',
         AGENT_ENV_PURPOSE: state.purpose ?? '',
       };
       const configResult = await refreshConfig(wsPath.root, containerName, configSource, envVars, deps);
       ```
    5. **Update `devcontainerUp` `remoteEnv`** in `rebuildInstance()` (currently at :439-443) to include `AGENT_ENV_PURPOSE` alongside `AGENT_INSTANCE`. The create flow at `create-instance.ts:554-560` passes both `AGENT_INSTANCE` and `AGENT_ENV_PURPOSE` as `remoteEnv`. Without this, the rebuild `remoteEnv` is asymmetric with create — and since `remoteEnv` overrides `containerEnv` per the devcontainer spec, a purpose set via `containerEnv` (from `applyBaselinePatches`) could be overridden at runtime. Update to:
       ```typescript
       remoteEnv: { AGENT_INSTANCE: wsPath.name, AGENT_ENV_PURPOSE: state.purpose ?? '' },
       ```
    6. Import `applyBaselinePatches` and `copyStatusBarTemplate` from `devcontainer.js`.
  - Notes:
    - `state.purpose` can be `null` or `undefined` (`InstanceState` type has `purpose: string | null`, but `isValidState` guard at `state.ts:226` accepts `undefined`). The `??` operator handles both cases, falling back to `''`. Do not use `||` — while harmless here, `??` is semantically correct for nullish coalescing.
    - `state.repoSlug` may also be absent on older instances. Use `?? ''` for safety.
    - The `copyStatusBarTemplate` call in `refreshConfig` should be: `await copyStatusBarTemplate(wsRoot, deps.devcontainerFsDeps)`. The function takes `(workspacePath: string, deps: Pick<DevcontainerFsDeps, 'cp' | 'mkdir' | 'stat'>)`. The rebuild's `devcontainerFsDeps` is a superset that includes `cp`, `mkdir`, and `stat`, so it satisfies the constraint.

- [ ] Task 6: Update `regenerateStatusBar()` with fallback chain and new output path
  - **⚠️ ATOMIC: Must be implemented in the same commit as Task 7.** Changing the signature here without updating callers creates a silent runtime bug — both `workspaceRoot` and `purpose` are `string`, so TypeScript won't catch the argument order mismatch. The old call `regenerateStatusBar(wsPath.root, newPurpose, deps)` would pass `newPurpose` as `agentEnvDir`.
  - File: `packages/agent-env/src/lib/status-bar.ts` (:1-80)
  - Action: Change the function signature to `regenerateStatusBar(workspaceRoot, agentEnvDir, purpose, deps)`. New logic:
    1. Try reading `statusBar.template.json` from `join(workspaceRoot, '.vscode')` — **repo-provided template takes precedence**
    2. If ENOENT, try reading `statusBar.template.json` from `agentEnvDir` — **agent-env default fallback**
    3. If both ENOENT, throw an error with a `.code` property set to `'TEMPLATE_NOT_FOUND'`. Use `Object.assign(new Error('...'), { code: 'TEMPLATE_NOT_FOUND' })` to attach the code (the codebase has no custom error class pattern). The message should suggest `agent-env init-template` (issue #36) or manual template creation. Callers in Task 7 match on `error.code === 'TEMPLATE_NOT_FOUND'` — if `.code` is missing, the catch won't match and the error surfaces as an unhandled exception.
    4. Replace `{{PURPOSE}}` placeholders (unchanged)
    5. Write output to `join(agentEnvDir, STATUS_BAR_JSON)` instead of `.vscode/`
  - Precedence rule: When both `.vscode/statusBar.template.json` and `.agent-env/statusBar.template.json` exist, the `.vscode/` template wins. The `.agent-env/` template is never read in this case. This is the "repo override" behavior — repos customize by placing their own template.
  - Notes: `agentEnvDir` is `<ws>/.agent-env` on host, `/etc/agent-env` in container. Existing exported constants `STATUS_BAR_TEMPLATE_JSON` and `STATUS_BAR_JSON` are reused as-is (they are just filenames).

- [ ] Task 7: Update `purpose-instance.ts` callers for new `regenerateStatusBar` signature
  - **⚠️ ATOMIC: Must be implemented in the same commit as Task 6.** See Task 6 warning.
  - File: `packages/agent-env/src/lib/purpose-instance.ts`
  - Action:
    - `setPurpose()` at :145-146: Change call to `regenerateStatusBar(wsPath.root, wsPath.agentEnvDir, newPurpose, deps.statusBarDeps)`. Wrap in try/catch — if error has code `TEMPLATE_NOT_FOUND`, return `{ ok: false, error: { code: 'TEMPLATE_NOT_FOUND', message: ..., suggestion: 'Create a status bar template...' } }`.
    - `setContainerPurpose()` at :274-275: Change call to `regenerateStatusBar(deps.workspaceRoot, deps.agentEnvDir, newPurpose, deps.statusBarDeps)`. Same try/catch pattern.
    - Update comments at :145 and :274 (remove ".vscode" references)
  - Notes: `ContainerPurposeDeps` already has `agentEnvDir` field (at :153-161, defaults to `CONTAINER_AGENT_ENV_DIR`). `PurposeInstanceDeps` (at :41-45) doesn't need one — `setPurpose` derives it from `wsPath.agentEnvDir`.

- [ ] Task 8: Remove `.vscode/statusBar.json` from git exclude patterns
  - File: `packages/agent-env/src/lib/state.ts` (:234)
  - Action: Remove `.vscode/statusBar.json` from `GIT_EXCLUDE_PATTERNS` array. The array becomes `['.agent-env/']` only (which already covers the new output location).
  - Notes: Old instances with the pattern in `.git/info/exclude` are unaffected — harmless stale entry.

- [ ] Task 9: Rewrite `status-bar.test.ts` for new behavior
  - File: `packages/agent-env/src/lib/status-bar.test.ts` (:1-143)
  - Action: Rewrite all 6 tests for the new fallback chain + output location:
    1. Repo template in `.vscode/` exists → uses it, writes output to `agentEnvDir/statusBar.json`
    2. No repo template, `.agent-env/` template exists → uses it, writes output to `agentEnvDir/statusBar.json`
    3. Neither template exists → throws error with `TEMPLATE_NOT_FOUND`
    4. Purpose is null → replaces with `(no purpose set)`
    5. Multiple `{{PURPOSE}}` occurrences all replaced
    6. `.vscode/` template takes precedence over `.agent-env/` template when both exist
    7. Container-mode scenario: `workspaceRoot` and `agentEnvDir` are at **different absolute paths** (e.g., `/tmp/test-workspace` and `/tmp/test-agent-env`). Verify resolution chain still works correctly with `.vscode/` template in the workspace and `.agent-env/` template at the separate `agentEnvDir` path. This simulates the container layout where workspace is at `/workspaces/<repo>` and agent-env is at `/etc/agent-env`.
  - Notes: Tests use real filesystem in temp dirs. Create both `.vscode/` and a subdirectory for `agentEnvDir` as needed per test. For test case 7, use two separate temp directories to simulate the container layout. Pass the `agentEnvDir` path as the second argument.

- [ ] Task 10: Update `state.test.ts` for git exclude pattern change
  - File: `packages/agent-env/src/lib/state.test.ts` (:671, :700)
  - Action: Update two test assertions that reference `.vscode/statusBar.json`:
    - :671 — `'# no trailing newline\n.agent-env/\n.vscode/statusBar.json\n'` → `'# no trailing newline\n.agent-env/\n'`
    - :700 — `'.agent-env/\n.vscode/statusBar.json\n'` → `'.agent-env/\n'`

- [ ] Task 11: Add tests for `copyStatusBarTemplate`, `patchVscodeSettings`, and `applyBaselinePatches`
  - File: `packages/agent-env/src/lib/devcontainer.test.ts`
  - Action: Add tests for:
    - `copyStatusBarTemplate()`: copies single file to `.agent-env/statusBar.template.json`, not to `.vscode/`
    - `patchVscodeSettings()` (standalone, if implemented — see Task 3): merges into existing `customizations.vscode.settings`, creates `customizations` path if missing, preserves other keys. Also test defensive handling: non-object `customizations`, non-object `customizations.vscode`, non-object `customizations.vscode.settings` — all should be overwritten with `{}` before merging. If standalone function is skipped, test the defensive handling via `applyBaselinePatches` instead.
    - `applyBaselinePatches()`: verify the **final written JSON** contains all three patches (container name, env vars, vscode settings). Since it does a single read-modify-write, a real-filesystem test or a mock that captures the final `writeFile` call is sufficient to verify all patches are present. This is the key advantage of the single-cycle approach — no need to chain mock reads.

- [ ] Task 12: Fix `purpose-instance.test.ts` — add template fixtures to test workspace setup
  - File: `packages/agent-env/src/lib/purpose-instance.test.ts`
  - Action: The `createTestWorkspace()` helper (line 43-49) creates `.agent-env/state.json` but does NOT create `statusBar.template.json`. After Task 6, `regenerateStatusBar` throws `TEMPLATE_NOT_FOUND` when no template exists — this will break all 17 `setPurpose`/`setContainerPurpose` tests that call it.
  - Fix: Update `createTestWorkspace()` to also write a minimal `statusBar.template.json` to the `.agent-env/` directory:
    ```typescript
    await writeFile(join(agentEnvDir, 'statusBar.template.json'), JSON.stringify({
      "betterStatusBar.commands": [{ id: "agent-env-purpose", label: "$(bookmark) {{PURPOSE}}" }]
    }), 'utf-8');
    ```
  - Also update container-mode test helpers (`createContainerPurposeDeps` and similar) to write a template file to the temp `agentEnvDir`.

- [ ] Task 13: Update `create-instance.test.ts` and `rebuild-instance.test.ts`
  - File: `packages/agent-env/src/lib/create-instance.test.ts`
  - Action: Update tests for `setupDevcontainerConfig()` to verify `applyBaselinePatches` is called (rather than individual `patchContainerName`/`patchContainerEnv`). Verify `patchVscodeSettings` is now included via the consolidated function.
  - **Important:** The current mock `devcontainerReadFile` at line 107 always returns `'{}'`. Since `applyBaselinePatches` does a single read-modify-write, at least one test should use a **realistic mock return value** matching the baseline `devcontainer.json` content (with `image`, `containerEnv.AGENT_ENV_CONTAINER`, etc.). This verifies that `applyBaselinePatches` correctly deep-merges patches into existing baseline properties rather than only proving patches apply to an empty object. Inspect the final `writeFile` call argument to confirm all three patches are present AND existing baseline properties are preserved.
  - File: `packages/agent-env/src/lib/rebuild-instance.test.ts`
  - Action: Update tests for `refreshConfig()` to verify `applyBaselinePatches` is called. This also verifies the fix for the pre-existing gap where `patchContainerEnv` was missing. Additionally, add two tests for the "copy if not exists" rebuild template behavior:
    1. When `.agent-env/statusBar.template.json` already exists before rebuild, verify it is NOT overwritten (content preserved).
    2. When `.agent-env/statusBar.template.json` does NOT exist before rebuild, verify `copyStatusBarTemplate` deploys it.

- [ ] Task 14: Run full test suite and type-check
  - Action: Run `pnpm -r type-check && pnpm -r test:run`
  - Verify: All tests pass, no type errors, no regressions

### Acceptance Criteria

- [ ] AC 1: Given a workspace with NO `.vscode/statusBar.template.json`, when `agent-env purpose <instance> "JWT auth"` is run on the host, then `regenerateStatusBar` reads from `.agent-env/statusBar.template.json`, replaces `{{PURPOSE}}` with `JWT auth`, and writes output to `.agent-env/statusBar.json`.

- [ ] AC 2: Given a workspace WITH `.vscode/statusBar.template.json` (repo-provided), when `agent-env purpose <instance> "OAuth"` is run, then `regenerateStatusBar` uses the `.vscode/` template (not the `.agent-env/` one), replaces `{{PURPOSE}}`, and writes output to `.agent-env/statusBar.json`.

- [ ] AC 3: Given a workspace with NEITHER `.vscode/statusBar.template.json` NOR `.agent-env/statusBar.template.json`, when `regenerateStatusBar` is called, then it throws an error with code `TEMPLATE_NOT_FOUND`.

- [ ] AC 4: Given a new instance is created with baseline config, when `agent-env create` completes, then `.agent-env/statusBar.template.json` exists (copied from bundled default) and `.vscode/statusBar.template.json` does NOT exist.

- [ ] AC 5: Given a new instance is created with baseline config, when `agent-env create` completes, then the devcontainer.json contains `customizations.vscode.settings.betterStatusBar.configurationFile` set to `"/etc/agent-env/statusBar.json"`.

- [ ] AC 6: Given a devcontainer.json that already has `customizations.vscode.settings` with other keys, when `patchVscodeSettings()` runs, then the existing settings are preserved and `betterStatusBar.configurationFile` is added (deep-merge, not replace).

- [ ] AC 7: Given the purpose is set inside a container, when `setContainerPurpose` calls `regenerateStatusBar`, then the output is written to `/etc/agent-env/statusBar.json` (the bind-mounted path).

- [ ] AC 8: Given a new instance is created, when `ensureGitExclude` runs, then `.agent-env/` is in `.git/info/exclude` but `.vscode/statusBar.json` is NOT added.

- [ ] AC 9: Given an instance is rebuilt with baseline config, when `refreshConfig()` completes, then the devcontainer.json contains container name, container env vars, AND `betterStatusBar.configurationFile` — all applied via `applyBaselinePatches()`.

- [ ] AC 10: Given `setPurpose` is called on an instance where neither template file exists, when `regenerateStatusBar` throws `TEMPLATE_NOT_FOUND`, then `setPurpose` catches it and returns `{ ok: false, error: { code: 'TEMPLATE_NOT_FOUND', ... } }` (not an unhandled exception).

- [ ] AC 11: Given the bundled template has been moved, when `npm pack --dry-run` is run, then `config/templates/statusBar.template.json` appears in the output and `config/templates/.vscode/` does not.

- [ ] AC 12: Given all changes are complete, when `pnpm -r type-check && pnpm -r test:run` is executed, then all tests pass with zero type errors.

- [ ] AC 13: Given a pre-existing baseline instance that lacks `.agent-env/statusBar.template.json`, when `agent-env rebuild` is run, then `copyStatusBarTemplate()` deploys the bundled template to `.agent-env/statusBar.template.json` and `applyBaselinePatches()` adds `betterStatusBar.configurationFile` to devcontainer.json. If `.agent-env/statusBar.template.json` already exists (user-customized), it is NOT overwritten.

## Additional Context

### Dependencies

- No new external dependencies required
- `better-status-bar` VS Code extension behavior: requires explicit `configurationFile` setting with fully resolved absolute path
- Existing `CONTAINER_AGENT_ENV_DIR` constant from `container-env.ts`

### Testing Strategy

**Unit tests — `status-bar.test.ts` (rewrite):**
- Fallback chain: `.vscode/` template → `.agent-env/` template → error
- Precedence: `.vscode/` wins when both exist
- Output written to `agentEnvDir/statusBar.json`
- Null purpose → `(no purpose set)`
- Multiple `{{PURPOSE}}` replacements

**Unit tests — `devcontainer.test.ts` (new):**
- `copyStatusBarTemplate()`: copies to `.agent-env/statusBar.template.json`, not `.vscode/`
- `patchVscodeSettings()`: merges into existing settings, creates `customizations` path if missing, preserves other keys, handles non-object intermediate paths defensively
- `applyBaselinePatches()`: single read-modify-write — verify final written JSON contains all three patches (container name, env vars, vscode settings)

**Unit test updates:**
- `state.test.ts`: Remove `.vscode/statusBar.json` from exclude assertions
- `purpose-instance.test.ts`: Add template fixture to `createTestWorkspace()` and container test helpers. All 17 `setPurpose`/`setContainerPurpose` tests must pass.
- `create-instance.test.ts`: Verify `applyBaselinePatches` replaces individual patch calls
- `rebuild-instance.test.ts`: Verify `applyBaselinePatches` replaces standalone `patchContainerName` (also fixes pre-existing `patchContainerEnv` gap)

**Verification:**
- `pnpm -r type-check` — all packages clean
- `pnpm -r test:run` — all tests pass
- `npm pack --dry-run` — verify `config/templates/statusBar.template.json` included in package

### Pre-mortem Findings (applied)

1. **Bundled template in npm package:** Verify `config/templates/` is included in published package (`package.json` `files` array or `npm pack --dry-run`).
2. **Settings clobber risk:** `patchVscodeSettings()` must deep-merge into existing `customizations.vscode.settings`, not replace the object. Follow `patchContainerEnv` merge pattern.
3. **Non-standard workspace mounts:** Eliminated as a concern — `configurationFile` uses the fixed `/etc/agent-env/statusBar.json` path via bind mount, no workspace path derivation needed.
4. **Container-mode template access:** Solved by copying template to `.agent-env/` — bind-mounted to `/etc/agent-env` inside containers, accessible from both host and container.

### First Principles Findings (applied)

1. **Agent-env owns `.agent-env/`, not `.vscode/`:** All writes (template + generated output) now target `.agent-env/` territory.
2. **`/etc/agent-env` is the stable container path:** Already established pattern for `state.json`. The bind mount provides a fixed absolute path — no workspace folder derivation needed for `configurationFile`.
3. **`configurationFile` is a hardcoded constant:** `/etc/agent-env/statusBar.json` — eliminates all workspace path complexity.
4. **Template is justified over codegen:** The `.agent-env/statusBar.template.json` file serves as both the data source and self-documenting scaffold for repo customization.
5. **Two write contexts, same pattern:** Host writes to `<ws>/.agent-env/statusBar.json`, container writes to `/etc/agent-env/statusBar.json` — same physical file via bind mount.

### Adversarial Review Findings (applied)

| ID | Severity | Resolution |
|----|----------|------------|
| F1 | High | Added `applyBaselinePatches()` consolidation (Task 3) and rebuild-instance update (Task 5). Both create and rebuild now use the same function. |
| F2 | High | Fixed line references: `PurposeInstanceDeps` at `:41-45`, `ContainerPurposeDeps` at `:153-161`. |
| F3 | Medium | Added Task 11 with explicit tests for `copyStatusBarTemplate`, `patchVscodeSettings`, and `applyBaselinePatches`. |
| F4 | Medium | Documented as pre-existing behavior. Container-mode `workspaceRoot` defaults to `process.cwd()` — this is the same pattern used for `state.json` and is acceptable. |
| F5 | Medium | Removed `CONTAINER_STATUS_BAR_PATH` from Task 1 — not needed. Output path derived from `CONTAINER_AGENT_ENV_DIR` + `STATUS_BAR_JSON`. |
| F6 | Medium | Added JSON-only limitation note to Codebase Patterns and Technical Decisions. |
| F7 | Medium | Added Task 12 with exact fix: update `createTestWorkspace()` to write template fixture. |
| F8 | Medium | Fixed line reference to `:298-353` for `setupDevcontainerConfig()`. |
| F9 | Low | Added Task 13 for `create-instance.test.ts` and `rebuild-instance.test.ts`. |
| F10 | Low | Added AC 11 for bundled template file move verification via `npm pack --dry-run`. |
| F11 | Low | Removed redundant `STATUS_BAR_TEMPLATE_FILE` — existing `STATUS_BAR_TEMPLATE_JSON` constant is reused. |
| F12 | Low | Added error handling spec in Task 7: `setPurpose`/`setContainerPurpose` catch `TEMPLATE_NOT_FOUND` and return structured error. Added AC 10. |
| F13 | Low | Added Migration Notes section below. |
| F14 | High | Explicit `refreshConfig` signature change: add `envVars: Record<string, string>` parameter. New signature and call site spelled out in Task 5. |
| F15 | High | `applyBaselinePatches` rewritten as single read-modify-write cycle with internal pure helper functions. Prevents mock readFile from losing earlier patches. |
| F16 | High | `resolveDockerfilePath` not searching `.agent-env/` is pre-existing behavior, not a regression. Documented in Technical Decisions. Out of scope. |
| F17 | Medium | Added `copyStatusBarTemplate()` call to rebuild flow inside `refreshConfig` (Task 5, step 3). Ensures pre-existing instances get template on rebuild. |
| F18 | Medium | Added defensive checks for `patchVscodeSettings`: validate `customizations`, `customizations.vscode`, and `customizations.vscode.settings` are objects before spreading. |
| F19 | Medium | Tasks 6+7 marked as ATOMIC — must be in same commit. Silent `string`→`string` argument order mismatch if done separately. |
| F20 | Medium | Container-mode `workspaceRoot` reliance on `process.cwd()` documented in Technical Decisions. Pre-existing pattern, not introduced by this spec. |
| F21 | Medium | Task 4 explicitly specifies: preserve two-block try/catch structure. Different error messages for copy vs patch failures. |
| F22 | Low | Task 2 clarifies: use `deps.cp` for single file copy, no `{ recursive: true }` needed, existing signature unchanged. |
| F23 | Low | Task 3 notes: `applyBaselinePatches` deps must remain within intersection of create and rebuild deps. `readFile`+`writeFile` satisfies both. |
| F24 | Low | Task 6 now explicitly states precedence rule: `.vscode/` wins when both templates exist. Test case 6 follows directly. |
| F25 | Low | Removed default value for `configDir` parameter in `applyBaselinePatches` — both call sites always pass `AGENT_ENV_DIR` explicitly. |
| F26 | Medium | Task 5 notes: `state.purpose` can be `null` or `undefined`. Use `??` (not `||`). Same for `state.repoSlug`. |
| F27 | High | Rebuild `devcontainerUp` `remoteEnv` missing `AGENT_ENV_PURPOSE`. Added step 5 to Task 5: update `remoteEnv` to match create flow parity. |
| F28 | Low | `copyStatusBarTemplate` deps compatibility in rebuild verified — rebuild's `devcontainerFsDeps` is a superset. Documented in Task 5 notes. |
| F29 | Medium | Line reference `:400` in Task 5 replaced with search-based reference ("search for `await refreshConfig(`"). Line numbers shift after earlier edits in same task. |
| F30 | High | `create-instance.test.ts` mock returns `'{}'` — at least one test must use realistic baseline content to verify `applyBaselinePatches` preserves existing properties. Added to Task 13. |
| F31 | Medium | `copyStatusBarTemplate` call arguments in rebuild spelled out explicitly: `copyStatusBarTemplate(wsRoot, deps.devcontainerFsDeps)`. Added to Task 5 notes. |
| F32 | High | Tasks 1+2 marked ATOMIC — after Task 1 removes `config/templates/.vscode/`, `copyStatusBarTemplate` silently becomes a no-op. No test catches it between tasks. |
| F33 | Medium | Added container-mode test case (test 7) to Task 9: `workspaceRoot` and `agentEnvDir` at different absolute paths, simulating `/workspaces/<repo>` vs `/etc/agent-env`. |
| F34 | Medium | Rebuild template copy changed to "copy if not exists" — check whether `.agent-env/statusBar.template.json` exists before calling `copyStatusBarTemplate`. Prevents overwriting user customizations. |
| F35 | Low | `TEMPLATE_NOT_FOUND` code uses generic `string` type in `PurposeSetResult` — matches existing codebase pattern. Documented as acceptable. |
| F36 | Medium | Specified throw mechanism: `Object.assign(new Error('...'), { code: 'TEMPLATE_NOT_FOUND' })`. Callers match on `error.code`. |
| F37 | Low | Defensive checks for non-object `customizations` assessed as noise — reasonable defensive programming even if baseline never has that key. No change needed. |
| F38 | Medium | "Copy if not exists" stat catch must check `err.code === 'ENOENT'` specifically — bare catch treats permission errors as "not found". Added ENOENT guard pattern to Task 5 step 3. Added two rebuild test cases to Task 13. |
| F39 | Low | Standalone `patchVscodeSettings()` has zero callers — marked as optional in Task 3. Pure helper `applyVscodeSettingsPatch` is sufficient. Task 11 tests made conditional. |
| F40 | Low | Unused imports after Task 4 — noise, compiler/linter catches automatically. No change needed. |
| F41 | Low | Rebuild `refreshConfig` single try/catch vs create's two-block separation — documented as pre-existing asymmetry in Codebase Patterns. Not required to fix for this spec. |

### Migration Notes (existing instances)

Instances created before this change will have:
- `.vscode/statusBar.template.json` (old default template location)
- `.vscode/statusBar.json` (old output, stale `.git/info/exclude` entry — harmless)
- No `.agent-env/statusBar.template.json`
- No `betterStatusBar.configurationFile` in devcontainer.json

**Impact:**
- Running `agent-env purpose` on a pre-existing instance: Works — the `.vscode/statusBar.template.json` is found by the fallback chain (first location checked). Output now goes to `.agent-env/statusBar.json` instead of `.vscode/statusBar.json`.
- The extension still won't read the output (no `configurationFile` setting) — but this was already broken before this change.
- Running `agent-env rebuild` on a pre-existing baseline instance: `applyBaselinePatches()` will add `configurationFile` to devcontainer.json, fixing the extension config. `copyStatusBarTemplate()` is called during rebuild with "copy if not exists" semantics (added in Task 5) — `.agent-env/statusBar.template.json` will be deployed if absent, but existing customizations are preserved.
- No active migration code needed. Users can rebuild to pick up the fix.

### Notes

- `copyStatusBarTemplate` is repurposed (not removed): changes target from `.vscode/` to `.agent-env/`, copies a single file instead of a directory
- Future `init-template` command (issue [#36](https://github.com/zookanalytics/bmad-orchestrator/issues/36)) would copy `.agent-env/statusBar.template.json` to `.vscode/statusBar.template.json` for repo customization
- Container-mode template resolution: `.vscode/` check uses workspace root (via `deps.workspaceRoot`), `.agent-env/` fallback uses `deps.agentEnvDir` which defaults to `CONTAINER_AGENT_ENV_DIR` in container mode
