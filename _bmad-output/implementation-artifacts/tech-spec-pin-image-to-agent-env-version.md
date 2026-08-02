---
title: 'Pin Docker image tag to agent-env version'
slug: 'pin-image-to-agent-env-version'
created: '2026-06-05'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4, 5, 6]
tech_stack:
  - TypeScript 5.x (strict, ESM, NodeNext)
  - Node.js >= 24
  - pnpm 11.0.8
  - @devcontainers/cli
  - Docker / ghcr.io
  - Vitest 4.x
  - Ink 6 + React 19 (for menu surface)
  - GitHub Actions (publish-image.yml, publish.yml)
  - Changesets (release flow)
files_to_modify:
  - packages/agent-env/config/baseline/devcontainer.json
  - packages/agent-env/src/lib/devcontainer-merge.ts
  - packages/agent-env/src/lib/devcontainer.ts
  - packages/agent-env/src/lib/rebuild-instance.ts
  - packages/agent-env/src/lib/create-instance.ts          # F1 — managed-image pull in create path
  - packages/agent-env/src/commands/create.ts              # --no-pull flag plumbing
  - packages/agent-env/src/lib/version-drift.ts
  - packages/agent-env/src/lib/menu-deps.ts                # F7 — pass managedConfigPath to detectDriftState
  - packages/agent-env/src/cli.ts                          # R3-F1 — buildMenuDeps(workspaceName) call site at cli.ts:134
  - packages/agent-env/src/components/InteractiveMenu.tsx
  - packages/agent-env/src/lib/container.ts
  - .devcontainer/devcontainer.json
  - .agent-env/devcontainer.json
  - package.json                                           # F15 — build:image:* scripts; version-packages script
  - .github/workflows/ci.yml                               # Task 16
  - .github/workflows/publish.yml                          # Task 16b — version-packages step
  - scripts/sync-dogfood-pin.mjs                           # NEW — Task 16b
  - packages/agent-env/src/lib/devcontainer-merge.test.ts
  - packages/agent-env/src/lib/rebuild-instance.test.ts
  - packages/agent-env/src/lib/devcontainer.test.ts
  - packages/agent-env/src/lib/create-instance.test.ts
  - packages/agent-env/src/lib/container.test.ts           # new dockerPull error-mapping coverage
  - packages/agent-env/src/lib/version-drift.test.ts       # new image-drift coverage
code_patterns:
  - 'Import package.json via: import packageJson from "../../package.json" with { type: "json" } (see version-drift.ts:20). DO NOT use createRequire — see devcontainer-merge.ts:672-680 fallback bug.'
  - 'DI surface: every public function takes a Deps interface with fs/spawn/access overrides (see version-drift.ts:49, devcontainer-merge.ts:22)'
  - 'Result typing: { ok: true; ... } | { ok: false; error: { code; message; suggestion? } } (see rebuild-instance.ts:222, container.ts:67)'
  - 'Atomic write: tmp + rename (see devcontainer-merge.ts:687-700)'
  - 'Logger contract: { warn(msg), info(msg) } passed via deps.logger (see rebuild-instance.ts:90, devcontainer-merge.ts:174)'
  - 'Subprocess: always `reject: false` semantics via shared executor, always check `result.ok` (project-context.md "Subprocess Handling")'
  - 'Lib layer has NO React imports (project-context.md "Layered Architecture")'
test_patterns:
  - 'Co-located *.test.ts files in src/lib/'
  - 'Inline fixture constants (see rebuild-instance.test.ts:158)'
  - 'DI overrides — pass mock fs/spawn/executor into the Deps argument (project-context.md "Dependency Injection Pattern")'
  - 'NEVER mock node:fs via vi.mock — DI only (project-context.md "ESM Mocking Pitfalls")'
  - '`vi.spyOn` only on global objects (process, console)'
---

# Tech-Spec: Pin Docker image tag to agent-env version

**Created:** 2026-06-05

## Overview

### Problem Statement

The managed `devcontainer.json` pins the container image to `ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:latest`. Docker never auto-refreshes a `:latest` tag once cached, and the rebuild pull step (`packages/agent-env/src/lib/rebuild-instance.ts:283`) only iterates Dockerfile `FROM` images — never the devcontainer `image:` field. Consequence: upgrading the agent-env npm package (e.g. `pnpm add -g @zookanalytics/agent-env@1.2.0`) leaves users on the previously-cached image, with no signal that the agent-env CLI and its container image have silently drifted apart.

The `publish-image.yml` workflow already publishes a `:<agent-env-version>` tag whenever `packages/agent-env/package.json` version changes (see `.github/workflows/publish-image.yml:210` — `type=raw,value=${{ needs.prep.outputs.agent-env-version }}`), so the version-pinned tags exist in the registry today — the agent-env CLI just never asks for them.

### Solution

Bind the managed image tag to agent-env's `package.json` version. At every config-merge and every rebuild, rewrite the `image:` field on **agent-env-managed** devcontainer.json files from `:latest` (or any prior pinned version) to `:${packageJson.version}`. Because agent-env owns and rewrites these files (`.agent-env/devcontainer.json` is git-ignored downstream), tag rewrites on rebuild are safe and migrate existing instances automatically.

Add an "image update available" signal to the menu, modeled on the existing `version-drift.ts` reload affordance — so when a newer agent-env version is installed but a long-lived menu session hasn't restarted, the user sees a prompt comparable to the package-moved/installedVersion-newer prompts already in place.

### Scope

**In Scope:**
- Introduce a single source-of-truth constant for the managed image reference (`MANAGED_IMAGE_REPO`) and a `getManagedImage()` helper that returns `${MANAGED_IMAGE_REPO}:${packageJson.version}`
- Replace `:latest` in `packages/agent-env/config/baseline/devcontainer.json` with the version pin at write time
- Dynamic substitution at config-merge time so the tag reflects the *currently running* agent-env version (substitution happens in code, not at build/publish)
- Rewrite the `image:` tag on every rebuild for managed devcontainer.json files (auto-migrate existing instances on first rebuild after upgrade)
- Add managed-image pull to `executePullStep` in `rebuild-instance.ts` so the pinned tag is actually fetched
- Helpful failure mode when the pinned tag doesn't yet exist in `ghcr.io` (manifest unknown / not found) — surface an actionable error referencing the tag mismatch + recovery path
- Fix `getPackageVersion()` at `devcontainer-merge.ts:672-680` — it currently uses `createRequire` and falls back to `'unknown'` (verified by header in `.agent-env/devcontainer.json`: `// AUTO-GENERATED by agent-env vunknown`). This is required because the new pinning logic depends on reliable version resolution.
- Update in-repo `.devcontainer/devcontainer.json` to use the pinned tag (dogfood)
- Extend `VersionDriftState` with an image-drift signal and surface it via the existing `DriftBanner` / `RESTART_REQUIRED_OPTION` UX in `InteractiveMenu.tsx`

**Out of Scope:**
- Gating npm publish on successful image publish (accepted as a recovery scenario; would require workflow re-architecture)
- Modifying `.github/workflows/publish-image.yml` — the `:<agent-env-version>` tag is already produced when `agent-env-changed` is true
- Rewriting `:latest` in user-owned devcontainer.json files (only files agent-env manages — `validateRepoConfig` already warns on this)
- Fallback chain to `:latest` if a pinned tag is missing — explicitly rejected to avoid masking real drift; surface the failure instead
- Backwards-compatibility shims for the `:latest` references in tests or fixtures beyond what's required to keep tests passing (update fixtures to use a versioned tag)
- Changes to the bmad-orchestrator package or the keystone-workflows package — image is consumed only via agent-env

## Context for Development

### Codebase Patterns

**Version source of truth.** `packages/agent-env/package.json` is the canonical version (currently `1.1.0`). The proven import pattern lives at `version-drift.ts:20`:
```ts
import packageJson from '../../package.json' with { type: 'json' };
```
This is the JSON-modules import attribute syntax. It works in both dev (`src/lib/`) and bundled (`dist/`) layouts.

**Existing `getPackageVersion()` is broken.** `devcontainer-merge.ts:672-680` uses:
```ts
function getPackageVersion(): string {
  try {
    const req = createRequire(import.meta.url);
    const pkg = req('../../package.json') as { version: string };
    return pkg.version;
  } catch { return 'unknown'; }
}
```
Verified failure: `.agent-env/devcontainer.json` header reads `// AUTO-GENERATED by agent-env vunknown`. **Root cause (F10 correction):** The `createRequire` machinery works fine post-bundle — but the path `../../package.json` is resolved relative to the bundled file's location (`dist/cli.js`), which means it looks for `packages/package.json`, which doesn't exist. The `try/catch` swallows the ENOENT silently. The proposed fix (JSON-modules `import ... with { type: 'json' }`) sidesteps this because tsup inlines the JSON contents into the bundle at build time — no runtime path resolution involved. Both this header *and* the new pinning logic should consume the same source of truth: there should be exactly one version-resolution call site.

**Bundle-time inlining (F9 nuance).** The JSON-modules import is inlined by tsup, so `packageJson.version` in the published `dist/cli.js` is fixed at build time. For production users (npm install), this is correct — the bundled CLI and the package.json version are produced together by the publish pipeline. For dev contributors using `tsx` against `src/`, the import resolves to the live `package.json`. The only failure mode is: bump `package.json` locally, forget to rebuild, then run the bundled CLI — it reports the stale version. AC22 + Task 15 step 3 catch this manually.

**Single managed-image constant — currently absent.** The full image reference `ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:latest` is duplicated across:
- `packages/agent-env/config/baseline/devcontainer.json:2`
- `packages/agent-env/src/lib/devcontainer.test.ts:204`
- `packages/agent-env/src/lib/rebuild-instance.test.ts:158`
- `packages/agent-env/src/lib/create-instance.test.ts:41`
- `packages/agent-env/src/lib/devcontainer-merge.test.ts:729` (plus several other test cases)

There is no central constant. **Introduce one in a new module** (proposed location: extend `devcontainer.ts` since it already owns baseline path resolution, OR a new `managed-image.ts` if we want a clean home). Both `loadManagedDefaults` and the new pull-step logic consume it.

**Merge seam — `mergeDevcontainerConfigs`.** `devcontainer-merge.ts:555-601` and `buildManagedOnly:537-547` both set `image: managed.image` as the final value (managed always wins over repo's `image` field). The `ManagedConfig.image` field comes from `loadManagedDefaults():661` which reads it from the baseline JSON. **This is the cleanest single seam** — replace `loadManagedDefaults` so that instead of returning the baseline's literal image string, it returns `getManagedImage()` (i.e., baseline repo + current version), discarding whatever tag is in the baseline file.

**Validation contract — `validateRepoConfig`.** `devcontainer-merge.ts:208-231` warns when `repoImage !== managedImage` and rejects `build`/`dockerfile`/`dockerComposeFile`. After our change, `managedImage` always carries the version tag, so the warning naturally fires for users still pinning `:latest` in their own `.devcontainer/devcontainer.json` — desirable behavior.

**Pull step — `executePullStep`.** `rebuild-instance.ts:232-304` resolves a Dockerfile, parses FROM lines, pulls in parallel. The managed `image:` field is never pulled because the managed baseline has no Dockerfile (`"image": "ghcr.io/..."` only). **Add a separate code path** that pulls `managed.image` whenever the merged config uses the `image:` field (no Dockerfile build). Reuse `deps.container.dockerPull` (`container.ts:523`) — it already returns the `IMAGE_PULL_FAILED` result shape with a generic suggestion.

**Manifest-not-found error mapping.** `container.ts:523-541` (`dockerPull`) returns the raw stderr in `message`. For `manifest unknown` / `manifest for ... not found` errors specifically, we need an actionable suggestion pointing the user at the version mismatch. Add error-string detection (parallel to the `isNameConflict` logic in `devcontainerUp:417-421`) — return a `IMAGE_VERSION_NOT_PUBLISHED` code (or extend the existing one) with: "Image tag `<tag>` is not yet published. The agent-env package may have shipped before its image. Check https://github.com/ZookAnalytics/bmad-orchestrator/pkgs/container/bmad-orchestrator%2Fdevcontainer or wait for the publish-image workflow to complete."

**Drift surfacing — `VersionDriftState`.** `version-drift.ts:26-47` defines the composite state consumed by `InteractiveMenu.tsx:14`. Add a new field (proposed: `imageVersionAvailable: string | null`) and a corresponding `hasNewerImageInstall`-style helper. The menu already has three priority lanes for the action-list extra slot (`buildActionOptions:118`); add a fourth or fold image-drift into the existing `updateMessage`/`installedVersion` lanes. **Decision deferred to Step 3** — depends on UX precedence: if image drift is detectable only after a rebuild (when the registry check would happen anyway), it's lower-priority than installedVersion drift; if it's checked at menu startup, it can occupy its own banner row.

**Atomic config write.** `writeGeneratedConfig:687-700` uses tmp + rename. All managed devcontainer.json writes go through here — including any "rewrite tag on rebuild" path — so no new I/O patterns are needed.

**Test pattern landmarks.**
- `devcontainer-merge.test.ts:729` — checks `expect(result.image).toBe('ghcr.io/.../devcontainer:latest')`. Update assertion to read the version dynamically from `packageJson.version` (don't hardcode the new version).
- `create-instance.test.ts:41` and `rebuild-instance.test.ts:158` — fixture constants `image: 'ghcr.io/.../devcontainer:latest'`. Update to either dynamic constant or a regex check.
- `devcontainer-merge.test.ts:419-467` — `validateRepoConfig` tests pass `'ghcr.io/test/managed:latest'` as the managed-image argument. These don't need to change (they test the validator's logic, not the constant).

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/agent-env/config/baseline/devcontainer.json` | Template with the `image:` field that propagates `:latest` everywhere downstream |
| `packages/agent-env/src/lib/devcontainer-merge.ts` | Hosts `loadManagedDefaults` (line 611), `mergeDevcontainerConfigs` (line 555), `buildManagedOnly` (line 537), `validateRepoConfig` (line 208), `getPackageVersion` (line 672 — broken), `writeGeneratedConfig` (line 687) |
| `packages/agent-env/src/lib/devcontainer.ts` | Owns `getBaselineConfigPath` (line 96), `getPackageRoot` (line 60); candidate home for `MANAGED_IMAGE_REPO` |
| `packages/agent-env/src/lib/rebuild-instance.ts` | `executePullStep` (line 232) — needs companion managed-image pull; orchestration in `rebuildInstance` (line 406) |
| `packages/agent-env/src/lib/create-instance.ts` | `setupMergedConfig` (line 263) — initial config write; same pattern as rebuild |
| `packages/agent-env/src/lib/container.ts` | `dockerPull` (line 523) — reuse; consider new error code for manifest-not-found |
| `packages/agent-env/src/lib/version-drift.ts` | Existing drift detection (`VersionDriftState` line 26, `detectDriftState` line 195) — extend with image-drift |
| `packages/agent-env/src/components/InteractiveMenu.tsx` | `buildActionOptions` (line 118), `DriftBanner` (line 137) — extend with image-drift lane |
| `packages/agent-env/package.json` | Version source of truth (`1.1.0`) |
| `.github/workflows/publish-image.yml` | Confirms `:<agent-env-version>` tag publication (lines 199-201) |
| `.devcontainer/devcontainer.json` | In-repo file to dogfood the pinned-tag pattern |
| `.agent-env/devcontainer.json` | Auto-generated; will pick up the pinned tag on next rebuild — also shows the `getPackageVersion()` bug today |

### Technical Decisions

1. **Dynamic substitution at runtime, not build-time templating.** The version-tag substitution happens when agent-env writes/rewrites a managed devcontainer.json, reading `packageJson.version` at runtime via JSON-modules import. No build-time string replacement in the baseline file — keeps the baseline valid JSON and testable in isolation.
2. **Rewrite tag on every rebuild.** Managed devcontainer.json files are owned by agent-env. Rebuild freely rewrites the `image:` tag (via `loadManagedDefaults` returning `getManagedImage()`), so a single rebuild after `pnpm add -g` migrates an instance.
3. **No fallback to `:latest`.** If the pinned tag is missing from the registry (post-publish lag), fail with an actionable `IMAGE_VERSION_NOT_PUBLISHED` error rather than silently using `:latest`. Masking drift was the original bug.
4. **Single managed-image constant.** Introduce `MANAGED_IMAGE_REPO = 'ghcr.io/zookanalytics/bmad-orchestrator/devcontainer'` and a `getManagedImage(): string` helper. Single seam, single test point.
5. **Single version-resolution call site.** Replace the broken `getPackageVersion()` in `devcontainer-merge.ts` with the JSON-modules import pattern from `version-drift.ts:20`. Both the file header (`// AUTO-GENERATED by agent-env v<version>`) and the pinning logic share one resolver.
6. **Drift signal composes with existing `detectDriftState`.** Image-drift is a new field on `VersionDriftState` — not a parallel detection system — so the menu's existing affordances render it the same way as the package/installed-version drift it already surfaces.
7. **Dogfooded in-repo updates land in the same PR.** The in-repo `.devcontainer/devcontainer.json` gets updated in the same change. `.agent-env/devcontainer.json` is regenerated on next rebuild by the new code path, so manual update is unnecessary (but the PR should rebuild once and commit the regenerated file so reviewers can verify the header fix).
8. **Validator behavior unchanged, semantics improve.** `validateRepoConfig` (line 208) already warns when repo's `image:` differs from managed. After this change, any repo still pinning `:latest` will trigger the warning naturally — a free nudge for downstream users to update their pins.
9. **Image-drift detection is fs-only, no network.** Detect drift by comparing the `image:` field already written in `.agent-env/devcontainer.json` against `getManagedImage()`. One async `readFile` per menu startup. No `docker inspect`, no registry lookup. Fast, deterministic, and accurate (the file's image is what the next rebuild *would* request; if it doesn't match `getManagedImage()`, the rebuild will produce a different config).

## Implementation Plan

### Tasks

- [x] Task 1: Replace broken package-version resolution in `devcontainer-merge.ts`
  - File: `packages/agent-env/src/lib/devcontainer-merge.ts`
  - Action: Delete `createRequire` import on line 12 if no longer used. Delete `getPackageVersion()` (lines 672-680). Add `import packageJson from '../../package.json' with { type: 'json' };` at the top (mirror `version-drift.ts:20`). In `writeGeneratedConfig` (line 692), replace `const version = getPackageVersion();` with `const version = packageJson.version;`.
  - Notes: This is foundational — Task 3 also reads `packageJson.version`. Confirms the `vunknown` header bug is gone (verifiable by inspecting any regenerated `.agent-env/devcontainer.json`).

- [x] Task 2: Introduce `MANAGED_IMAGE_REPO` constant and `getManagedImage()` helper
  - File: `packages/agent-env/src/lib/devcontainer.ts`
  - Action: Add near the top of the file (after the existing constants block around line 32):
    ```ts
    import packageJson from '../../package.json' with { type: 'json' };

    export const MANAGED_IMAGE_REPO = 'ghcr.io/zookanalytics/bmad-orchestrator/devcontainer';

    /**
     * Returns the managed image reference pinned to the current agent-env version,
     * e.g. "ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:1.2.0".
     * The image is published by .github/workflows/publish-image.yml whenever
     * packages/agent-env/package.json version changes.
     */
    export function getManagedImage(): string {
      return `${MANAGED_IMAGE_REPO}:${packageJson.version}`;
    }
    ```
  - Notes: Single source of truth. All other code (merge, rebuild, tests) imports from here.

- [x] Task 3: Wire `loadManagedDefaults` to return the pinned image, and mark the baseline field as a sentinel (addresses 2nd-review F5)
  - File: `packages/agent-env/src/lib/devcontainer-merge.ts`
  - Action (code): In `loadManagedDefaults` (line 611), after the `image` validity check (line 639-643), replace `image: config.image` in the returned object (line 661) with `image: getManagedImage()`. Add import `import { getManagedImage } from './devcontainer.js';`. Add an inline comment immediately above the override explaining: the baseline's `image` field is a sentinel; the real image is computed from `packageJson.version` at runtime.
  - File: `packages/agent-env/config/baseline/devcontainer.json`
  - Action (baseline file): Replace the literal `"image": "ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:latest"` with `"image": "MANAGED_BY_AGENT_ENV_DO_NOT_EDIT"`. Above the field, add a JSONC comment: `// This value is replaced at runtime by agent-env. To change the image source, edit MANAGED_IMAGE_REPO in packages/agent-env/src/lib/devcontainer.ts.`
  - File: `packages/agent-env/src/lib/devcontainer.test.ts` (2nd-review F5 fix)
  - Action (test parser swap): The `devcontainer.json content` describe block (line 189-206) currently calls `JSON.parse(content)` directly on the baseline file (line 195). Adding the `//` comment above the `image` field will make this throw. Replace the `JSON.parse` call with `parseJsonc` from `jsonc-parser` (already imported elsewhere; add the import here). Without this swap, every test in the block crashes — not just line 204.
  - Notes: This is the single seam — every downstream caller (`mergeDevcontainerConfigs`, `buildManagedOnly`, `setupMergedConfig`, `refreshMergedConfig`) sees the pinned image automatically. The sentinel value prevents future contributors from believing they can change the image by editing the baseline file. (Schema check at line 639-643 stays — sentinel is still a string.)

- [x] Task 4: Add managed-image pull to BOTH create and rebuild orchestration paths (addresses prior F1, F2, F3 + 2nd-review F8, F11)
  - **Sub-task 4a — extract shared helper into a NEW module.** Create `packages/agent-env/src/lib/managed-image-pull.ts` (resolves 2nd-review F11 — commits to the layering instead of deferring):
    ```ts
    import type { ContainerLifecycle } from './container.js';

    export interface PullManagedImageDeps {
      container: ContainerLifecycle;
      logger?: { warn(m: string): void; info(m: string): void };
    }

    export type PullManagedImageResult =
      | { ok: true }
      | { ok: false; error: { code: string; message: string; suggestion?: string } };

    /**
     * Pull (or skip-with-warning) the agent-env managed container image.
     * Used by both create and rebuild orchestration paths.
     */
    export async function pullManagedImage(
      managedImage: string,
      pull: boolean,
      deps: PullManagedImageDeps
    ): Promise<PullManagedImageResult> {
      if (!pull) {
        // Warning text MUST contain the literal substring asserted by AC15:
        // "Using cached image; not matched to current agent-env version"
        deps.logger?.warn(
          `Using cached image; not matched to current agent-env version. ` +
          `Skipping pull of ${managedImage} (--no-pull). The container will start with whichever ` +
          `image is already cached locally. Re-run without --no-pull to fetch the pinned image.`
        );
        return { ok: true };
      }
      deps.logger?.info(`Pulling ${managedImage}...`);
      const result = await deps.container.dockerPull(managedImage);
      if (!result.ok) return { ok: false, error: result.error };
      deps.logger?.info(`Pulled ${managedImage}`);
      return { ok: true };
    }
    ```
    Both `create-instance.ts` and `rebuild-instance.ts` import from this new module — no cross-import between orchestration files.
  - **Sub-task 4b — wire into rebuild.** In `rebuild-instance.ts:232` (`executePullStep`), invoke `pullManagedImage(managedImage, pull, deps)` BEFORE the Dockerfile FROMs `Promise.allSettled` block. Refactor `refreshMergedConfig` (line 131) to return `managedImage` in its success result; thread through `rebuildInstance` (line 406) to `executePullStep` as a new `managedImage: string` argument. Update the "No Dockerfile found — skipping image pull" log line at 258 to "No Dockerfile found — only managed image pulled."
  - **Sub-task 4c — wire into create, BEFORE clone (addresses 2nd-review F8).** In `createInstance` (line 419), the managed image must be pulled BEFORE `cloneAndPrepareWorkspace` (line 464) — `getManagedImage()` doesn't depend on the clone, so pulling early means a transient `IMAGE_VERSION_NOT_PUBLISHED` failure does NOT nuke a freshly-cloned workspace. New order:
    1. `validateCreateInputs`
    2. `deriveRepoSlug`, derive `wsPath`, `containerName`
    3. `workspaceExists` check
    4. **NEW: `pullManagedImage(getManagedImage(), options.pull ?? true, deps)` — return error without rollback if it fails (nothing exists yet)**
    5. `cloneAndPrepareWorkspace` (existing)
    6. `setupMergedConfig` (existing)
    7. Pre-flight container check
    8. Container start
    9. Write state, ensure git exclude
    Add `pull?: boolean` to `CreateInstanceOptions` (line 314). Wire a `--no-pull` option in `packages/agent-env/src/commands/create.ts` if not already present.
  - **Files modified:** `packages/agent-env/src/lib/managed-image-pull.ts` (new), `packages/agent-env/src/lib/rebuild-instance.ts`, `packages/agent-env/src/lib/create-instance.ts`, `packages/agent-env/src/commands/create.ts`.
  - Notes: Prior F1+F2 resolved; prior F3 resolved by the no-pull branch in 4a (warning text now contains AC15's literal phrase, fixing 2nd-review F3); 2nd-review F8 resolved by moving pull before clone; 2nd-review F11 resolved by extracting to a dedicated module.

- [x] Task 5: Detect manifest-unknown errors in pull path (addresses 2nd-review F15, F17)
  - File: `packages/agent-env/src/lib/container.ts`
  - Action: In `dockerPull` (line 523), **inside** the error branch (line 531-541) **and before** constructing the existing `IMAGE_PULL_FAILED` result, inspect `result.stderr` for substrings: `'manifest unknown'`, `'manifest for'` combined with `'not found'`, `'pull access denied'`. When matched, short-circuit with the `IMAGE_VERSION_NOT_PUBLISHED` result below. When NOT matched, fall through to the existing `IMAGE_PULL_FAILED` result — and **also update that existing suggestion text** to reword the `--no-pull` hint so it carries the same "ONLY if you already have a previously cached image" caveat (F17 fix; otherwise two failure paths recommend `--no-pull` and only one warns about cache existence).
  - Matched-case result:
    ```ts
    {
      ok: false,
      error: {
        code: 'IMAGE_VERSION_NOT_PUBLISHED',
        message: `Image '${image}' is not available in the registry: ${result.stderr.trim()}`,
        suggestion:
          `The container image for this agent-env version may not be published yet. ` +
          `Image publishes complete shortly after each release; check workflow status to estimate readiness.\n` +
          `   • Workflow runs: https://github.com/ZookAnalytics/bmad-orchestrator/actions/workflows/publish-image.yml\n` +
          `   • Available tags: https://github.com/ZookAnalytics/bmad-orchestrator/pkgs/container/bmad-orchestrator%2Fdevcontainer\n` +
          `   • Emergency unblock (ONLY if you already have a previously cached image): ` +
          `retry with --no-pull. The container will start with the locally cached image, which may not match agent-env's current version. ` +
          `If no image is cached, you must wait for the registry tag to publish.`,
      },
    }
    ```
  - Notes: Keep the generic `IMAGE_PULL_FAILED` for all other failures. Detection is substring-based and tolerant of Docker version differences. The `--no-pull` mention is critical: it's the user's emergency exit if image publish is genuinely stuck.

- [x] Task 6: Extend `VersionDriftState` with image-drift signal
  - File: `packages/agent-env/src/lib/version-drift.ts`
  - Action: Add to `VersionDriftState` (line 26):
    ```ts
    /**
     * The image tag pinned in this workspace's `.agent-env/devcontainer.json`
     * does not match the image tag the *current* agent-env version would
     * produce. Rebuild will request the new image. Null when no managed
     * config file exists yet (e.g., uncreated instance).
     */
    imageDrift: { configuredImage: string; expectedImage: string } | null;
    ```
  - Notes: A nullable object (rather than a boolean) lets the menu render the actual versions in the banner.

- [x] Task 7: Implement image-drift detection function (addresses F14)
  - File: `packages/agent-env/src/lib/version-drift.ts`
  - Action: Add a new exported probe near `isPackagePathStale` (line 137):
    ```ts
    import { parse as parseJsonc, type ParseError } from 'jsonc-parser';

    export interface DetectImageDriftDeps {
      readFile?: typeof readFile;
      getExpectedImage?: () => string;
    }

    export interface DetectImageDriftDeps {
      readFile?: typeof readFile;
      getExpectedImage?: () => string;
      logger?: { warn(m: string): void };
    }

    export async function detectImageDrift(
      managedConfigPath: string,
      deps: DetectImageDriftDeps = {}
    ): Promise<VersionDriftState['imageDrift']> {
      const read = deps.readFile ?? readFile;
      const expected = (deps.getExpectedImage ?? getManagedImage)();
      let content: string;
      try {
        content = await read(managedConfigPath, 'utf-8');
      } catch {
        // File missing or unreadable — no drift signal. Common for pre-rebuild instances.
        return null;
      }
      const errors: ParseError[] = [];
      const parsed = parseJsonc(content, errors, { allowTrailingComma: true }) as { image?: unknown } | null;
      if (errors.length > 0 || parsed === null) {
        // Corrupted config: log a warning so the user sees SOMETHING in the menu surface
        // (addresses 2nd-review F16 — silent failure on corruption was the original gap).
        deps.logger?.warn(
          `Could not parse ${managedConfigPath} to check image drift — file may be corrupted. Rebuild to regenerate.`
        );
        return null;
      }
      if (typeof parsed.image !== 'string') return null;
      if (parsed.image === expected) return null;
      return { configuredImage: parsed.image, expectedImage: expected };
    }
    ```
    Add imports for `readFile` (from `node:fs/promises`), `getManagedImage` (from `./devcontainer.js`), and `parse as parseJsonc, type ParseError` (from `jsonc-parser`).
  - Notes: Returns `null` on any failure (image-drift is a hint, not a blocker), but corruption now surfaces via `logger.warn` so a user with a broken config sees SOMETHING. Prior F14 fix preserved: uses `jsonc-parser` instead of a fragile regex header-strip.

- [x] Task 8: Compose image-drift into `detectDriftState` via optional workspace name (addresses prior F7, 2nd-review F6, F7, F9)
  - **Pre-step (mandatory):** Run `grep -rn "detectDriftState\b" packages/ src/ 2>/dev/null | grep -v node_modules | grep -v dist | grep -v _bmad` AND `grep -rn "buildMenuDeps\b" packages/ src/ 2>/dev/null | grep -v node_modules | grep -v dist | grep -v _bmad` and enumerate every caller in the PR description. Verified during spec creation: `MenuContainer.tsx:73` (zero-arg call `detectDriftStateFn()`), `menu-deps.ts:105` (inside `checkForUpdates`: `detectDriftState({}, { forceRefresh: true })`), and `cli.ts:134` (`const menuDeps = buildMenuDeps();` — R3-F1 fix), plus test sites in `version-drift.test.ts`. Confirm there are no others before editing. When changing the signature to `buildMenuDeps(workspaceName)`, **all three** call sites must be updated: `menu-deps.ts:105`, `MenuContainer.tsx:73` (via `detectDriftStateFn`), and `cli.ts:134`.
  - **File: `packages/agent-env/src/lib/version-drift.ts`**
  - Action: Add helper `getManagedConfigPath(workspaceName, wsFsDeps?)` (or inline equivalent) that uses `getWorkspacePathByName` from `./workspace.js` to derive the absolute path to `<wsRoot>/.agent-env/devcontainer.json` via `path.join`. Extend `DetectDriftDeps` (line 49) with `detectImageDrift?: (path: string) => Promise<VersionDriftState['imageDrift']>`. Change `detectDriftState` signature (line 195) to accept an OPTIONAL FIRST positional argument: `detectDriftState(workspaceName?: string, deps: DetectDriftDeps = {}, options: DetectDriftOptions = {}): Promise<VersionDriftState>`. Inside the `Promise.all` (line 208), conditionally call `detectImageDrift(getManagedConfigPath(workspaceName))` when `workspaceName !== undefined`; else `Promise.resolve(null)`. Include `imageDrift` in the returned state (always present — `null` when no workspace).
  - **Backwards-compat guarantee:** Existing zero-arg callers continue to compile (TypeScript treats positional optional arg's absence as `undefined`). Test sites that pass `({}, { forceRefresh: true })` need updates: the deps object becomes the 2nd arg, not the 1st. Sweep `version-drift.test.ts` test sites and add `undefined` as the first arg, OR update each to pass a workspaceName when testing image-drift.
  - **File: `packages/agent-env/src/lib/menu-deps.ts`** (addresses 2nd-review F9)
  - Action: `buildMenuDeps()` currently takes no args. Change to `buildMenuDeps(workspaceName: string): InteractiveMenuDeps` (the menu is launched per-workspace via `launchActionLoop(workspaceName, ...)` in `commands/on.ts:46` — workspaceName is known at construction time). Update line 105: `await detectDriftState(workspaceName, {}, { forceRefresh: true })`. This makes the manual "Check for updates" action ALSO surface image drift, not just registry/install drift. Add a branch in the existing `if/else if` chain that handles `state.imageDrift !== null` by printing `"Container image will refresh on next rebuild: <configuredImage> → <expectedImage>"`. Update all `buildMenuDeps()` call sites to pass the workspace name — verified call sites are `packages/agent-env/src/cli.ts:134` (R3-F1) and any default-flow path (sweep with `grep -rn "buildMenuDeps\b"` before editing).
  - **File: `packages/agent-env/src/components/MenuContainer.tsx`** (addresses 2nd-review F6)
  - Action: Update `detectDriftStateFn?: () => Promise<VersionDriftState>` (line 36) to `detectDriftStateFn?: (workspaceName: string) => Promise<VersionDriftState>` and call as `await detectDriftStateFn(instanceInfo.name)` at the existing call site (line 73). Update `makeNeutralDriftState()` (line ~47) to include `imageDrift: null` in the returned literal — required because Task 6 makes the field non-optional.
  - **File: `packages/agent-env/src/lib/version-drift.test.ts`**
  - Action: For each `detectDriftState(...)` call site in tests, add an explicit `undefined` as the new first arg (or supply a fake workspaceName + mock `detectImageDrift` via `deps.detectImageDrift`). Document this in the diff so the change is visible to reviewers.
  - Notes: First-arg optional design preserves all behavior for zero-arg callers (they get `imageDrift: null`); workspace-aware callers get full drift detection. F6 (makeNeutralDriftState), F7 (hand-waving), F9 (checkForUpdates) all resolved by concrete code in the same task.

- [x] Task 9: Surface image-drift in `InteractiveMenu` (addresses F11, F12)
  - File: `packages/agent-env/src/components/InteractiveMenu.tsx`
  - Action: In `buildActionOptions` (line 118), add a new branch BELOW the existing `packageMoved` and `hasNewerInstall` branches. To avoid duplicate-value `Select` entries (F11), the branch *replaces* the existing rebuild option in-place rather than prepending — same `value: 'rebuild'`, different label:
    ```ts
    if (driftState?.imageDrift) {
      const imageLabel = formatImageTagForLabel(driftState.imageDrift.expectedImage);
      const updatedOptions = BASE_ACTION_OPTIONS.map((o) =>
        o.value === 'rebuild'
          ? { label: `🛠  Rebuild container (image ${imageLabel} available)`, value: 'rebuild' }
          : o
      );
      // R3-F4: when updateMessage is ALSO set (plausible: user upgraded npm AND has a stale
      // local image), preserve CHECK_FOR_UPDATES_OPTION so the user retains access to the
      // refresh affordance — matches the existing updateMessage branch's behavior at
      // InteractiveMenu.tsx:126-129.
      const tail = driftState.updateMessage
        ? [CHECK_FOR_UPDATES_OPTION, EXIT_OPTION]
        : [EXIT_OPTION];
      return [...updatedOptions, ...tail];
    }
    ```
    The other existing branches (lines 119-130) already keep `BASE_ACTION_OPTIONS` intact, so no duplicate rebuild values are introduced anywhere.
  - In `DriftBanner` (line 137), add a corresponding branch BELOW the existing branches that renders `<Text color="cyan">Container image will refresh on next rebuild: {configuredImage} → {expectedImage}</Text>`.
  - **F12 fix — `formatImageTagForLabel` helper.** Instead of split-on-`:` (which corrupts `host:port/repo:tag` and digest-pinned references), use a precise extractor:
    ```ts
    function formatImageTagForLabel(image: string): string {
      // Strip any digest suffix first: foo:bar@sha256:abc... -> foo:bar
      const noDigest = image.split('@')[0];
      // Match the trailing :tag (tag can't contain '/' or ':')
      const m = /:([^:/]+)$/.exec(noDigest);
      return m ? `v${m[1]}` : noDigest; // fall back to full image string if no tag found
    }
    ```
    Unit tests: `host:5000/foo/bar:1.2.0` → `v1.2.0`; `foo/bar:1.2.0@sha256:abc` → `v1.2.0`; `foo/bar` (no tag) → `foo/bar`; `foo/bar:latest` → `vlatest`.
  - Notes: Ordering vs other drift signals: `packageMoved` and newer-installedVersion drift remain higher priority (they require restart before rebuild even makes sense). Image-drift sits below those but above the generic "Check for updates" lane. New AC required: no duplicate `value` in returned options array.

- [x] Task 10: Update in-repo `:latest` references to pinned tags (addresses prior F15, F22; 2nd-review F10)
  - File: `.devcontainer/devcontainer.json`
  - Action: Change `"image": "ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:latest"` to `"image": "ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:1.1.0"` (current `packages/agent-env/package.json` version). Add a JSONC comment above the image line: `// Pinned-by-policy. Synced via scripts/sync-dogfood-pin.mjs (run automatically in the Version Packages PR).`
  - File: `package.json` (monorepo root, lines 15-16) — **F10 fix:**
  - Action: Only `build:image:use-remote` should reference the versioned tag (it pulls from registry and tags it for use as the managed image). `build:image:use-local` must NOT tag the local-dev build with the registry coordinate — that would poison the cache and cause `dockerPull(ghcr.io/.../devcontainer:<version>)` to silently use the dev build instead of the registry image. Concrete changes:
    - `build:image:use-local`: keep using `agent-devcontainer:local` (no remote tag). If the dev wants their local build to be used as the managed image, they must opt in via a separate explicit step (document this in the script comment or README).
    - `build:image:use-remote`: replace `:latest` with `:$(node -p "require('./packages/agent-env/package.json').version")` so devs pull and tag the exact version the CLI will request.
  - **F22 reframing:** These files are not "managed by agent-env" — they're read by host tooling. The accurate term is "pinned-by-policy" — they reference the same image but are kept in sync via the Task 16/16b mechanism rather than runtime substitution. Update the JSONC comment to reflect this honestly.
  - Notes: Files modified: `.devcontainer/devcontainer.json`, root `package.json`. The auto-sync mechanism (Task 16b) keeps these from drifting.

- [x] Task 11: Update test fixtures and assertions (addresses F5)
  - **Group A — `:latest` literal swaps for the managed image.** For fixture constants (inputs to test scenarios), swap to `getManagedImage()`. For ASSERTIONS, prefer a non-tautological check: read `packages/agent-env/package.json` via a separate `fs.readFileSync` and compare against the *expected* image string (addresses 2nd-review F12 — avoids `expect(getManagedImage()).toBe(getManagedImage())` tautology):
    - `packages/agent-env/src/lib/rebuild-instance.test.ts:158` (fixture constant) — use `getManagedImage()`.
    - `packages/agent-env/src/lib/create-instance.test.ts:41` (fixture constant) — use `getManagedImage()`.
    - `packages/agent-env/src/lib/devcontainer-merge.test.ts:729` (ASSERTION in merge test) — replace with: `const pkgVersion = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version; expect(result.image).toBe('ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:' + pkgVersion);`. The dual-source read (separate `readFileSync`, not the same `import` the implementation uses) catches the case where both implementation and test share a stale symbol.
  - **Group B — baseline-file-direct assertions (F5).** `devcontainer.test.ts:204` reads the baseline `devcontainer.json` *directly* (not through `loadManagedDefaults`). After Task 3 changes the baseline `image` to `MANAGED_BY_AGENT_ENV_DO_NOT_EDIT`, this assertion must change to either: (a) assert the sentinel value `expect(config.image).toBe('MANAGED_BY_AGENT_ENV_DO_NOT_EDIT')` — preferred, tests the actual on-disk contract, OR (b) be deleted and replaced with the new Group C test below that asserts `getManagedImage()` is the *effective* image after the merge layer runs.
  - **Group C — keep `:latest` literals in `validateRepoConfig` tests.** `devcontainer-merge.test.ts:419-467` passes `:latest`-style strings as the *managed-image argument* to `validateRepoConfig` — these test the validator's logic and don't care about the actual managed image value. Leave alone.
  - **Goal:** No test contains a hardcoded semver string for the agent-env version. Audit the diff with `grep -nP "ghcr\\.io/.+/devcontainer:\\d+\\.\\d+\\.\\d+" packages/agent-env/src/` — should return zero hits.
  - Notes: F5 is fully resolved by the explicit Group B handling.

- [x] Task 12: Add new unit tests (addresses F6, F18, F19-digest case)
  - File: `packages/agent-env/src/lib/devcontainer.test.ts`
  - Action: Add `describe('getManagedImage')` with two tests:
    (a) **shape (2nd-review F13 fix):** assert the return value starts with `MANAGED_IMAGE_REPO + ':'`, contains at least one `.`, and tag portion matches `/^\d+\.\d+\.\d+(?:[-+].+)?$/` — the relaxed pattern accepts prerelease/build-metadata suffixes (e.g. `1.1.0-beta.1`, `1.1.0+local`) that `normaliseVersion` already tolerates;
    (b) **non-tautological:** read `packages/agent-env/package.json` via a *separate `readFileSync`* (not the same import the implementation uses) and assert `getManagedImage()` equals `${MANAGED_IMAGE_REPO}:${parsed.version}`. The dual-source check catches the case where both implementation and test get the wrong value from the same stale symbol (F18).
  - File: `packages/agent-env/src/lib/devcontainer-merge.test.ts`
  - Action (F6 fix): Add a test for `loadManagedDefaults` confirming the returned `image` equals `getManagedImage()` regardless of the value in the baseline file. The fixture passes `image: 'arbitrary-string-from-baseline'` via mocked `readFile` and asserts `result.image === getManagedImage()`. Do NOT specifically use `:latest` — the test verifies the override behavior, not a specific input. (After Task 3 the actual baseline contains the sentinel, but the test is independent.)
  - File: `packages/agent-env/src/lib/rebuild-instance.test.ts`
  - Action: Add a test for `executePullStep` confirming the managed image is pulled when no Dockerfile is present. Inject a mocked `container.dockerPull` and assert it was called with `getManagedImage()`. Add a second test for the `--no-pull` warning path: invoke `pullManagedImage(image, false, deps)` and assert `logger.warn` was called with a message containing both the repo portion and the version-pinned reference.
  - File: `packages/agent-env/src/lib/create-instance.test.ts` (F1 follow-up)
  - Action: Add a test for `createInstance` end-to-end confirming `container.dockerPull` is called with `getManagedImage()` exactly once, before `findContainerByWorkspaceLabel`.
  - File: `packages/agent-env/src/lib/container.test.ts` (or wherever `dockerPull` is tested)
  - Action: Add tests for the new `IMAGE_VERSION_NOT_PUBLISHED` mapping — three test cases for the three stderr substrings (`manifest unknown`, `manifest for X not found`, `pull access denied`). Confirm the existing `IMAGE_PULL_FAILED` still fires for unmatched stderr. Assert the `IMAGE_VERSION_NOT_PUBLISHED` suggestion text contains: workflow URL, packages URL, `--no-pull` mention, AND the literal phrase `"ONLY if you already have a previously cached image"` (2nd-review F14 fix — AC5's conditional clause is now verified by test). Also assert the post-F17 update to the generic `IMAGE_PULL_FAILED` suggestion includes the same cached-image caveat.
  - File: `packages/agent-env/src/lib/version-drift.test.ts`
  - Action: Add `describe('detectImageDrift')` with tests covering: (1) image matches `getManagedImage()` → returns null; (2) image differs → returns `{configuredImage, expectedImage}`; (3) file missing → returns null; (4) file with INVALID JSONC → returns null; (5) image field missing → returns null; (6) file with multiple `//` JSONC comments → parses correctly via `jsonc-parser` (F14 regression test); (7) digest-pinned image (`:1.1.0@sha256:abc`) where the tag portion matches → returns null (F19 digest handling — see Known Limitations for the strictness rationale).
  - File: `packages/agent-env/src/lib/devcontainer-merge.test.ts`
  - Action (F13/throttle tests): Add tests for the new `validateRepoConfig` throttle: (a) same workspace + same image pair warns once across multiple calls; (b) same workspace + DIFFERENT image pair warns again; (c) DIFFERENT workspace + same image pair warns again (no cross-workspace suppression — F13 fix verification).
  - Notes: All tests use DI per project-context.md ESM Mocking Pitfalls. The dual-source check in `getManagedImage` test is the key defense against the F18 tautology.

- [x] Task 13: Add component test for menu image-drift surfacing
  - File: `packages/agent-env/src/components/InteractiveMenu.test.tsx` (likely exists; add if not)
  - Action: Add tests covering: (1) `imageDrift: null` → menu renders normally; (2) `imageDrift: {configuredImage, expectedImage}` with no higher-priority signal → rebuild option is highlighted at top + banner shows version diff; (3) `imageDrift` + `packageMoved` → packageMoved wins (restart banner shown).
  - Notes: Use `ink-testing-library` per project-context.md "Component Testing".

- [x] Task 14: Add changeset
  - File: `.changeset/pin-image-tag.md` (new)
  - Action: Create a changeset with `minor` bump for `@zookanalytics/agent-env` (user-visible behavior change — image now pulls reliably on upgrade). Body should explain: "Pin Docker image tag to agent-env version. Image is now requested as `:<agent-env-version>` instead of `:latest`, ensuring `pnpm add -g @zookanalytics/agent-env` reliably picks up the matching container image on the next rebuild."
  - Notes: Minor not patch — visible behavior change for users. The `:1.2.0` (or whatever the bumped version becomes) image tag must exist before users upgrade — the existing `publish-image.yml` produces it on the "Version Packages" PR merge, so the ordering works out.

- [x] Task 15: Manual verification on this very workspace (addresses F9, F10)
  - Action: After Tasks 1-14 land in the working tree (not yet committed):
    1. Run `pnpm install && pnpm -r build`
    2. Run `pnpm --filter @zookanalytics/agent-env build`
    3. **Bundle-output verification (2nd-review F4 fix, R3-F5 refinement):** Run:
       ```bash
       BUNDLED=$(node packages/agent-env/dist/cli.js --version | sed 's/+.*$//')
       SOURCE=$(jq -r .version packages/agent-env/package.json | sed 's/+.*$//')
       [ "$BUNDLED" = "$SOURCE" ] && echo "✓ bundled version matches source" || echo "✗ MISMATCH: bundled=$BUNDLED source=$SOURCE"
       ```
       The `sed` strips only the BUILD-METADATA suffix (`+...`) — NOT prerelease identifiers (`-...`). `cli.ts:40` appends `+local` when run from the monorepo, `+dev` from the baked image — both are intentional and unrelated to the inlined `package.json` version. Prerelease identifiers (`-beta.1`, `-alpha.1`) ARE part of the inlined version and must be preserved; stripping them would falsely pass a bundled `1.1.0-alpha.1` against a source `1.1.0-beta.2`. If the stripped values diverge, the build is stale; rebuild and retry.
    4. **`vunknown` regression probe (F10):** Inspect any `.agent-env/devcontainer.json` generated by the rebuild path; header MUST read `// AUTO-GENERATED by agent-env v<semver>`. The original bug was path-resolution failure (bundled `dist/cli.js` + `../../package.json` → non-existent `packages/package.json`); the new JSON-modules import sidesteps this by inlining at bundle time.
    5. Run `agent-env rebuild bmad-orchestrator-bugs` (or whatever the active instance is)
    6. Confirm log output shows `Pulling ghcr.io/.../devcontainer:<version>...` and `Pulled ghcr.io/.../devcontainer:<version>`
    7. Inspect `.agent-env/devcontainer.json` — `"image"` should be `:<current package.json version>` (NOT `:latest` or sentinel)
    8. **`--no-pull` warning probe:** Run `agent-env rebuild bmad-orchestrator-bugs --no-pull` and confirm the warning ("Skipping managed image pull...") is emitted
    9. **Drift-banner probe:** Open the long-running menu (`agent-env on bmad-orchestrator-bugs`), bump the local `packages/agent-env/package.json` patch version, restart menu — confirm the image-drift banner appears with the configured-vs-expected image diff
    10. **`create` flow probe (F1):** Create a throwaway instance and confirm `Pulling .../devcontainer:<version>` log fires during create, AND the generated config has the pinned tag
  - Notes: Frontend/UI verification per CLAUDE.md guidance. The dual-bundle/source check at step 3 is the only way to catch tsup regressions — the test suite tests source files, not the bundled artifact.

- [x] Task 16: CI check enforcing in-repo dogfood pin matches agent-env version (addresses F24)
  - File: `.github/workflows/ci.yml`
  - Action: Add a new step "Verify dogfood image pin". `ubuntu-latest` ships `jq` and `node` pre-installed (verified — these are standard for `actions/runner-images`); no install step needed. Use `jq` for *both* extraction sides (no `sed` regex hackery):
    ```yaml
    - name: Verify dogfood image pin
      shell: bash
      run: |
        EXPECTED=$(jq -r .version packages/agent-env/package.json)
        if [ -z "$EXPECTED" ] || [ "$EXPECTED" = "null" ]; then
          echo "❌ packages/agent-env/package.json has no .version field (got: '$EXPECTED')"
          exit 1
        fi
        IMAGE=$(jq -r .image .devcontainer/devcontainer.json)
        # Strip any digest, then extract the trailing tag (after the last colon NOT inside a port)
        ACTUAL=$(node -e "const i=process.argv[1].split('@')[0]; const m=/:([^:/]+)$/.exec(i); console.log(m?m[1]:'')" "$IMAGE")
        if [ -z "$ACTUAL" ]; then
          echo "❌ Could not extract tag from .devcontainer/devcontainer.json image: $IMAGE"
          exit 1
        fi
        if [ "$EXPECTED" != "$ACTUAL" ]; then
          echo "❌ .devcontainer/devcontainer.json image tag ($ACTUAL) does not match packages/agent-env/package.json version ($EXPECTED)."
          echo "   Run: node scripts/sync-dogfood-pin.mjs"
          exit 1
        fi
        echo "✓ Dogfood image pin matches agent-env version ($EXPECTED)"
    ```
  - Notes: F24 resolved — `jq` availability is verified (not hedged), and tag extraction uses a robust regex via `node -e` instead of fragile `sed`.

- [x] Task 16b: Auto-sync dogfood pin during the Changesets `version` step (addresses prior F8; 2nd-review F1)
  - **Problem (prior F8):** Without this task, every Changesets-bot-created "Version Packages" PR will FAIL the Task 16 CI check until a human pushes a manual fixup commit. Unacceptable workflow friction.
  - **2nd-review F1 fix:** Earlier draft used `jsonc-parser`, which is only declared in `packages/agent-env/package.json` — under pnpm's strict isolation, transitives don't hoist to the root `node_modules`, so importing it from `scripts/` at the repo root throws `ERR_MODULE_NOT_FOUND`. Solution: use targeted regex replacement on the `image` line. The script edits exactly one field with a known shape; full JSONC parsing is overkill and brings the dependency-hoisting issue along.
  - File: `scripts/sync-dogfood-pin.mjs` (new)
  - Action: Create a Node script with zero external deps:
    ```js
    import { readFile, writeFile } from 'node:fs/promises';

    const pkg = JSON.parse(await readFile('packages/agent-env/package.json', 'utf8'));
    const version = pkg.version;
    const IMAGE_REPO = 'ghcr.io/zookanalytics/bmad-orchestrator/devcontainer';
    const expectedImage = `${IMAGE_REPO}:${version}`;

    // 1. .devcontainer/devcontainer.json — regex-replace the image line only.
    //    Matches: "image": "<IMAGE_REPO>:<any-tag-with-optional-digest>"
    //    Preserves: all surrounding JSONC comments, whitespace, formatting.
    {
      const path = '.devcontainer/devcontainer.json';
      const original = await readFile(path, 'utf8');
      const updated = original.replace(
        new RegExp(`("image"\\s*:\\s*")${IMAGE_REPO.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}:[^"]+(")`),
        `$1${expectedImage}$2`
      );
      if (updated === original) {
        console.error(`✗ Could not locate ${IMAGE_REPO}:<tag> in ${path}`);
        process.exit(1);
      }
      await writeFile(path, updated);
      console.log(`✓ Updated ${path} → ${expectedImage}`);
    }

    // 2. Root package.json scripts — replace the version pin in build:image:use-remote only.
    //    build:image:use-local must NOT carry the registry tag (see Task 10 F10 fix).
    //    R3-F2: error when IMAGE_REPO is present but no versioned tag matches (pin
    //    format silently changed); silently skip when IMAGE_REPO is absent entirely
    //    (script entries are optional).
    {
      const path = 'package.json';
      const original = await readFile(path, 'utf8');
      const updated = original.replace(
        new RegExp(`(${IMAGE_REPO.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}:)\\d+\\.\\d+\\.\\d+(?:[-+][^"\\s]*)?`),
        `$1${version}`
      );
      if (updated !== original) {
        await writeFile(path, updated);
        console.log(`✓ Updated ${path} script pins → ${version}`);
      } else if (original.includes(IMAGE_REPO)) {
        console.error(`✗ Found ${IMAGE_REPO} in ${path} but could not match a versioned tag to replace.`);
        process.exit(1);
      }
    }
    ```
  - File: `package.json` (monorepo root)
  - Action: Add a `version-packages` script: `"version-packages": "changeset version && node scripts/sync-dogfood-pin.mjs"`
  - File: `.github/workflows/publish.yml`
  - Action: In the `changesets/action` step (line 156-170), add `version: pnpm run version-packages` so the Version Packages PR includes the dogfood-pin sync automatically. The action will commit both the `package.json` version bumps AND the synced dogfood files in the same PR.
  - Notes: 2nd-review F1 resolved — no root-level dependency required, regex preserves all JSONC formatting/comments. Prior F8 resolved — Version Packages PR now passes CI without human intervention. The sync script is also runnable manually (referenced in Task 16's error message).

- [x] Task 17: Throttle `validateRepoConfig` image-mismatch warning per-workspace (addresses F13, F20)
  - **Ordering dependency (F20):** This task assumes Task 3 has landed — `defaults.image` callers see is `getManagedImage()` (not the baseline literal). Implement in order Task 3 → Task 17 or the warning text references the wrong value.
  - File: `packages/agent-env/src/lib/devcontainer-merge.ts`
  - Action: In `validateRepoConfig` (line 208), the image-mismatch branch (line 223-230) currently fires `logger.warn` every call. After this change, it would fire on every rebuild for any user pinning `:latest`. Extend the function signature with a `workspaceKey?: string` argument (passes through from `setupMergedConfig` and `refreshMergedConfig` as `wsPath.root`). Wrap the warning in a module-level `Set<string>` keyed by `<workspaceKey>|<repo-image>|<managed-image>` so cross-workspace warnings are NOT suppressed (F13 fix):
    ```ts
    // R3-F6: cap the Set to prevent unbounded growth in long-lived `agent-env on`
    // sessions. FIFO eviction (oldest insertion order) keeps the memory footprint
    // bounded. The cap is a hygiene measure for long-lived menu sessions; the
    // eviction strategy is best-effort (a re-warned mismatch after eviction is
    // acceptable — strictly preferable to leaking memory across a workday).
    const MAX_WARNED = 100;
    const warnedMismatches = new Set<string>();
    // ... inside validateRepoConfig(config, managedImage, logger, workspaceKey):
    if ('image' in config && config.image !== undefined) {
      const repoImage = String(config.image);
      if (repoImage !== managedImage) {
        const key = `${workspaceKey ?? '*'}|${repoImage}|${managedImage}`;
        if (!warnedMismatches.has(key)) {
          if (warnedMismatches.size >= MAX_WARNED) {
            // Evict oldest (insertion order) to keep the Set bounded.
            const first = warnedMismatches.values().next().value;
            if (first !== undefined) warnedMismatches.delete(first);
          }
          warnedMismatches.add(key);
          logger?.warn(
            `Repo config specifies image '${repoImage}' which will be overridden by agent-env managed image '${managedImage}'.`
          );
        }
      }
    }
    ```
    Add an exported `_resetWarningCache()` function (marked `@internal` in JSDoc) that clears the Set.
  - Files: `packages/agent-env/src/lib/devcontainer-merge.ts`, callers in `create-instance.ts:288` and `rebuild-instance.ts:169` (pass `wsPath.root` as the fourth arg).
  - **F13 verification:** Cross-workspace warning isolation is asserted by the test added in Task 12 ("DIFFERENT workspace + same image pair warns again").
  - **2nd-review F18 fix — test isolation strategy:** Every test file that calls `validateRepoConfig` must add `beforeEach(() => _resetWarningCache())` to prevent cross-test pollution. This avoids `vi.resetModules()` (which is incompatible with the project's ESM-mocking rules per `project-context.md`). Files requiring the `beforeEach`: `devcontainer-merge.test.ts` (existing tests at lines 419-467 plus the new throttle tests), and any other test file that imports `validateRepoConfig`. Audit with `grep -rn "validateRepoConfig" packages/agent-env/src/`.
  - Notes: Default `workspaceKey ?? '*'` preserves backward-compat for any test that calls `validateRepoConfig` with three args. **AC11 depends on the new warning text in this task. Copy the warning string verbatim from the snippet above; do NOT preserve the existing single-image warning text** (`devcontainer-merge.ts:226-228` currently mentions only the repo image, which would leave AC11 unsatisfied).

### Acceptance Criteria

- [x] AC1: Given agent-env package version is `X.Y.Z`, when `agent-env create` runs, then the generated `.agent-env/devcontainer.json` contains `"image": "ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:X.Y.Z"` AND the file header reads `// AUTO-GENERATED by agent-env vX.Y.Z. Do not edit.`
- [x] AC2: Given an existing instance with `.agent-env/devcontainer.json` referencing an older image tag, and agent-env package version is now `X.Y.Z`, when `agent-env rebuild <instance>` runs, then the regenerated config has `image: ".../devcontainer:X.Y.Z"` AND `dockerPull(".../devcontainer:X.Y.Z")` is invoked before the container is recreated.
- [x] AC3: Given a managed config with `image: ".../devcontainer:X.Y.Z"` and no Dockerfile in the workspace, when `executePullStep` runs with `pull: true`, then `dockerPull(".../devcontainer:X.Y.Z")` is called exactly once AND the result is logged via `logger.info`.
- [x] AC4: Given a managed config AND a user Dockerfile with `FROM node:24`, when `executePullStep` runs with `pull: true`, then both `node:24` and the managed image are pulled in parallel.
- [x] AC5: Given a docker pull request that returns stderr containing `manifest unknown`, when `dockerPull` runs, then the result is `{ ok: false, error: { code: 'IMAGE_VERSION_NOT_PUBLISHED', message: includes the requested tag } }` AND the suggestion contains all three: (a) the Actions workflow URL, (b) the GitHub Packages URL, (c) a clearly-conditional `--no-pull` emergency-unblock hint that mentions "ONLY if you already have a previously cached image".
- [x] AC6: Given `.agent-env/devcontainer.json` has an `image` tag that differs from `getManagedImage()`, when `detectImageDrift` runs against the file path, then it returns `{ configuredImage: <file's tag>, expectedImage: <current> }`.
- [x] AC7: Given `.agent-env/devcontainer.json` has an `image` tag equal to `getManagedImage()`, when `detectImageDrift` runs, then it returns `null`.
- [x] AC8: Given `driftState.imageDrift` is non-null AND `packageMoved` is false AND no newer-installedVersion drift is set, when `InteractiveMenu` renders, then a cyan banner displays the configured-vs-expected image diff AND the existing `'rebuild'` action's label is replaced in-place with `"🛠  Rebuild container (image <vTAG> available)"` (no duplicate `'rebuild'` value introduced — verified by AC19). The position of the rebuild option within the action list is unchanged from BASE_ACTION_OPTIONS.
- [x] AC9: Given the in-repo `.devcontainer/devcontainer.json` file, when inspected, then its `image:` field uses a versioned tag matching `packages/agent-env/package.json` (NOT `:latest`).
- [x] AC10: Given any agent-env-managed devcontainer.json regenerated by the new code path, when inspected, then the file header reads `// AUTO-GENERATED by agent-env v<actual semver>` (NOT `vunknown`).
- [x] AC11: Given a repo `.devcontainer/devcontainer.json` with `image: ".../devcontainer:latest"` and the managed image is `:X.Y.Z`, when `validateRepoConfig` runs, then `logger.warn` is called with a message containing both the repo image and the managed image. Verified by Task 17's warning text update — both `${repoImage}` and `${managedImage}` must appear in the warning string.
- [x] AC12: Given the entire test suite, when `pnpm -r test:run` runs, all tests pass. **Falsifiable form:** Running `grep -nP "ghcr\\.io/.+/devcontainer:\\d+\\.\\d+\\.\\d+" packages/agent-env/src/` returns ZERO hits (no hardcoded version-in-image-tag literals in source or tests).
- [x] AC13: Given the changeset is added, when `pnpm changeset status` runs, then it reports a `minor` bump pending for `@zookanalytics/agent-env`.
- [x] AC14: Given the bundled output at `packages/agent-env/dist/cli.js`, when invoked with `--version`, then it prints a real semver string matching `packages/agent-env/package.json` version (NOT `unknown`). Verifies the JSON-modules import survives tsup bundling (F2 guard).
- [x] AC15: Given the registry returns "manifest unknown" for the pinned tag AND a previously-cached managed image exists locally, when the user re-runs `agent-env rebuild --no-pull`, then the rebuild succeeds using the cached image AND emits a warning via `logger.warn` whose message contains the literal substring `"Using cached image; not matched to current agent-env version"` (Task 4a's `pullManagedImage` helper produces this exact phrase when invoked with `pull=false`).
- [x] AC16: Given a repo config with `image: "<X>"` and managed image `<Y>` where `X !== Y`, when `validateRepoConfig` is called twice in the same process with the same args, then `logger.warn` is invoked exactly once. Given a third call with a *different* repo image `<Z>` (still ≠ Y), then `logger.warn` is invoked once more (total: 2).
- [x] AC17: Given the baseline `packages/agent-env/config/baseline/devcontainer.json`, when inspected, then its `image` field is the sentinel string `MANAGED_BY_AGENT_ENV_DO_NOT_EDIT` AND a JSONC comment above the field explains the runtime override pointing to `MANAGED_IMAGE_REPO`.
- [x] AC18: Given the in-repo `.devcontainer/devcontainer.json` image tag differs from `packages/agent-env/package.json` version, when CI runs, then the "Verify dogfood image pin" step fails with a message indicating the mismatch and the required value. Conversely, when they match, the step passes.
- [x] AC19 (F11 guard): Given `driftState.imageDrift` is non-null, when `buildActionOptions` returns its option array, then no two options share the same `value` field. Verified by an in-test assertion `expect(new Set(options.map(o => o.value)).size).toBe(options.length)`.
- [x] AC20 (F13 guard): Given two `validateRepoConfig` calls with different `workspaceKey` arguments but identical `repoImage`/`managedImage`, when both are made in the same process, then `logger.warn` is invoked exactly twice (no cross-workspace suppression).
- [x] AC21 (F8 guard): Given the Version Packages PR generated by Changesets, when CI runs against it, then the "Verify dogfood image pin" step passes (Task 16b's `version-packages` script kept `.devcontainer/devcontainer.json` in sync). Verifiable by running `pnpm run version-packages` locally on a branch with a pending changeset and observing the dogfood file is updated.
- [x] AC22 (prior F9/F10 guard, addresses 2nd-review F4, R3-F5): Given the bundled `packages/agent-env/dist/cli.js`, when `node packages/agent-env/dist/cli.js --version` runs, then its output **with any `+suffix` (build-metadata) stripped — but prerelease `-suffix` PRESERVED** equals `jq -r .version packages/agent-env/package.json` (also `+suffix`-stripped). The build-metadata strip is required because `cli.ts:40` appends `+local` in monorepo contexts and `+dev` from baked dev images — both are correct behavior and not part of the inlined `package.json` version. Prerelease identifiers (`-beta.1`, `-alpha.1`) are NOT stripped because they ARE part of the inlined version; stripping them would falsely pass when a bundled `1.1.0-alpha.1` is compared against a source `1.1.0-beta.2`. Drift in the build-metadata-stripped values indicates a stale build.
- [x] AC23 (R3-F4 guard): Given `driftState.imageDrift` is non-null AND `driftState.updateMessage` is also set, when `buildActionOptions` returns its option array, then the array includes BOTH the relabeled rebuild option (`"🛠  Rebuild container (image <vTAG> available)"`) AND `CHECK_FOR_UPDATES_OPTION`. This guards against silently dropping the refresh affordance when image-drift and registry-update drift coincide.

## Additional Context

### Dependencies

- **No new runtime dependencies.** All required machinery (JSON-modules imports, `docker pull`, `readFile`, Ink components) already exists in the codebase.
- **Depends on `.github/workflows/publish-image.yml` continuing to publish `:<agent-env-version>` tags.** Already produces these on the "Version Packages" PR merge (verified at `publish-image.yml:210`). No workflow changes required.
- **Depends on the Changesets release flow.** When this change merges to `main`, the Version Packages PR is created. When that PR merges, npm publish (publish.yml) and image publish (publish-image.yml) both run in parallel. There is a brief window where npm has the new version but ghcr.io may not yet — this is the documented recovery scenario; `IMAGE_VERSION_NOT_PUBLISHED` provides an actionable error in that window.
- **No upstream task dependencies.** This is a self-contained change.

### Testing Strategy

**Unit tests (DI-based, per project-context.md ESM Mocking Pitfalls):**
- `getManagedImage()` returns the expected concatenation
- `loadManagedDefaults` overrides baseline `image` with `getManagedImage()`
- `executePullStep` pulls managed image when no Dockerfile present
- `executePullStep` pulls managed image AND Dockerfile FROMs in parallel
- `dockerPull` maps three distinct stderr substrings to `IMAGE_VERSION_NOT_PUBLISHED`
- `dockerPull` retains `IMAGE_PULL_FAILED` for generic errors
- `detectImageDrift` covers: match, mismatch, missing file, invalid JSON, missing field
- `writeGeneratedConfig` header reflects `packageJson.version` (NOT `unknown`)

**Component tests (ink-testing-library):**
- `InteractiveMenu` renders correctly with `imageDrift: null`
- `InteractiveMenu` prepends rebuild option + cyan banner when `imageDrift` is set
- `InteractiveMenu` prioritizes `packageMoved` over `imageDrift`
- `InteractiveMenu` prioritizes installedVersion drift over `imageDrift`

**Integration tests:**
- `rebuildInstance` end-to-end: mocked container ops, fake fs, assert managed image was pulled AND config was rewritten with the pinned tag.

**Manual verification (per CLAUDE.md "for UI or frontend changes" + golden-path testing):**
- Build agent-env from this branch
- Rebuild this very workspace; observe pull and config rewrite
- Start menu, simulate version bump, restart, observe image-drift banner

### Notes

**Failure-mode traceability (pre-mortem PMx + adversarial review Fx, all addressed):**

Pre-mortem (PM1–PM6):

| # | Failure mode | Addressed by |
|---|---|---|
| PM1 | Release-day lockout: image lag traps users with no escape | Task 5 (expanded suggestion + `--no-pull` exit), AC5, AC15 |
| PM2 | Bundle quirk leaves `vunknown` in production | Task 15 step 3, AC14, AC22 |
| PM3 | Dogfood file drifts silently across releases | Task 16 (CI check) + Task 16b (auto-sync), AC18, AC21 |
| PM4 | `detectDriftState` signature change breaks unknown callers | Task 8 pre-step + optional-arg backwards-compat |
| PM5 | `validateRepoConfig` warning becomes deafening | Task 17 (per-workspace throttle), AC16 |
| PM6 | Dead `image` field in baseline misleads contributors | Task 3 (sentinel + JSONC comment), AC17 |

Adversarial review (F1–F24):

| # | Severity | Addressed by |
|---|---|---|
| F1  | Critical | Task 4c (create flow now pulls managed image) + create-instance.ts in scope + AC1 testable |
| F2  | Critical | Task 4a (shared `pullManagedImage` helper is the orchestration-layer seam) |
| F3  | High | Task 4a `--no-pull` warning branch satisfies AC15 |
| F4  | High | Task 5 suggestion text clarifies `--no-pull` only works with a previously cached image |
| F5  | High | Task 11 Group B explicitly updates `devcontainer.test.ts:204` to sentinel |
| F6  | High | Task 12 test mocks an arbitrary baseline image string (not `:latest`); decoupled from Task 3 |
| F7  | High | Task 8 makes `managedConfigPath` OPTIONAL; backwards-compat preserved; `menu-deps.ts` resolves the path |
| F8  | High | Task 16b auto-syncs dogfood pin during Changesets `version` step; AC21 verifies |
| F9  | Medium | Context for Development clarifies tsup inlining; AC22 verifies bundled value matches source |
| F10 | Medium | Context for Development corrects root-cause diagnosis (path resolution, not bundling survival) |
| F11 | Medium | Task 9 swaps in-place rather than prepending; AC19 asserts no duplicate `value` |
| F12 | Medium | Task 9 `formatImageTagForLabel` handles port + digest cases correctly |
| F13 | Medium | Task 17 keys throttle by `<workspaceKey>|<repo-image>|<managed-image>`; AC20 verifies cross-workspace isolation |
| F14 | Medium | Task 7 uses `jsonc-parser` instead of regex header-strip; Task 12 test (6) regression-covers |
| F15 | Medium | Task 10 updates root `package.json` build:image:* scripts |
| F16 | Medium | Documented as accepted limitation; follow-up item filed |
| F17 | Medium | Task 5 suggestion replaces "10–15 minutes" with non-specific "shortly after each release; check workflow status" |
| F18 | Medium | Task 12 dual-source check (read package.json via separate fs read); AC12 replaced with falsifiable grep |
| F19 | Medium | Multi-arch + digest cases documented in Known Limitations; Task 12 test (7) covers digest |
| F20 | Medium | Task 17 explicit ordering note: must land after Task 3 |
| F21 | Low | Documented as accepted-limitation note |
| F22 | Low | Task 10 reframes in-repo files as "pinned-by-policy" with accurate JSONC comment |
| F23 | Low | Documented as accepted-limitation; follow-up item for post-rebuild refresh hook |
| F24 | Low | Task 16 hardens jq use, replaces sed with `node -e` regex; jq availability verified for ubuntu-latest |

Second-pass adversarial review (R2-F1–R2-F20), all addressed:

| # | Severity | Addressed by |
|---|---|---|
| R2-F1  | Critical | Task 16b rewritten — sync script uses targeted regex replacement, no root-level `jsonc-parser` dependency required |
| R2-F2  | High | AC8 rewritten to match Task 9's in-place swap (was incorrectly saying "prepended") |
| R2-F3  | High | Task 4a warning text now contains the literal "Using cached image; not matched to current agent-env version" substring AC15 requires |
| R2-F4  | High | AC22 + Task 15 step 3 strip `+suffix`/`-suffix` before comparison (handles `+local`, `+dev`, `-beta.1`) |
| R2-F5  | High | Task 3 adds an explicit instruction to swap `JSON.parse` → `parseJsonc` in `devcontainer.test.ts:189-206` block |
| R2-F6  | High | Task 8 explicitly updates `makeNeutralDriftState()` to include `imageDrift: null` |
| R2-F7  | High | Task 8 replaces hand-waving with concrete code: `buildMenuDeps(workspaceName)`, `getManagedConfigPath()` helper, real callsite updates |
| R2-F8  | High | Task 4c reorders: pull happens BEFORE clone in `createInstance`, so transient pull failures don't nuke a fresh workspace |
| R2-F9  | High | Task 8 explicitly updates the `checkForUpdates` callsite (`menu-deps.ts:103-121`) to surface image drift |
| R2-F10 | High | Task 10 explicitly forbids tagging the local-dev build with the registry coord (cache poisoning prevention) |
| R2-F11 | Medium | Task 4a commits to a NEW dedicated module `managed-image-pull.ts` (no cross-import between orchestration files) |
| R2-F12 | Medium | Task 11 Group A specifies a non-tautological assertion at `devcontainer-merge.test.ts:729` using a separate `readFileSync` |
| R2-F13 | Medium | Task 12 shape regex relaxed to `/^\d+\.\d+\.\d+(?:[-+].+)?$/` to accept prerelease/build-metadata suffixes |
| R2-F14 | Medium | Task 12's container test now explicitly asserts the literal "ONLY if you already have a previously cached image" phrase |
| R2-F15 | Medium | Task 5 instructions corrected: detection happens INSIDE the error branch before constructing the existing result |
| R2-F16 | Medium | Task 7 `detectImageDrift` now emits `logger.warn` on JSONC parse errors / corrupted files (visibility) |
| R2-F17 | Medium | Task 5 explicitly extends to update the existing `IMAGE_PULL_FAILED` generic-suggestion text with the cached-image caveat |
| R2-F18 | Medium | Task 17 specifies `beforeEach(() => _resetWarningCache())` as the test isolation strategy (avoids `vi.resetModules`) |
| R2-F19 | Low | Spec line citation corrected: `publish-image.yml:210` (was `:201` / `:199-201`) |
| R2-F20 | Low | Task 16 CI script now validates `EXPECTED` is non-empty and not the literal "null" |

Third-pass adversarial review (R3-F1–R3-F6 addressed; remaining items deferred):

| # | Severity | Addressed by |
|---|---|---|
| R3-F1 | High | Task 8 pre-step updated to include `cli.ts:134`; `files_to_modify` adds `cli.ts` |
| R3-F2 | High | Task 16b script's `package.json` block now errors when `IMAGE_REPO` is present but no versioned tag matches (silent no-op only when `IMAGE_REPO` is absent entirely) |
| R3-F3 | High | AC11 text + Task 17 Notes explicitly cross-reference; warning text update is now contract-bound |
| R3-F4 | Medium | Task 9 snippet conditionally appends `CHECK_FOR_UPDATES_OPTION` when `updateMessage` is also set; new AC23 verifies |
| R3-F5 | Medium | AC22 + Task 15 step 3 strip only build metadata (`+...`), preserving prerelease identifiers (`-beta.1`) for detection |
| R3-F6 | Medium | Task 17 caps `warnedMismatches` Set at 100 entries with FIFO eviction (long-lived menu session hygiene) |

**Deferred (Low / Noise / Speculative — not addressed in this pass):**
- R3 review's speculative `BASE_ACTION_OPTIONS` type-widening item — will surface at compile time if real; no preemptive change.
- R3-F8 (image publish lag for manual rebuild on `main`) — accepted limitation; same recovery surface as `IMAGE_VERSION_NOT_PUBLISHED` (Task 5 + AC5 + AC15).
- R3-F9, F10, F11, F12, F13, F14, F15, F16, F17, F18, F19, F20, F21, F22 — low-severity polish items; address opportunistically during implementation.

(Naming note: R3-F6 above refers to the third-pass throttle-cap fix in this spec. The third review's speculative `BASE_ACTION_OPTIONS` widening item — also tagged F6 in that review — is the deferred entry listed above; they are distinct items.)

**Remaining high-risk items (not eliminated, just understood):**
- **Test brittleness on version bumps.** Any test that hardcodes the agent-env version will break on the next changeset-driven bump. Task 11 + AC12's falsifiable grep address this.
- **Publish-image workflow predicate fragility (F16, accepted).** `publish-image.yml`'s `agent-env-changed` check (line 46) compares `HEAD~1:packages/agent-env/package.json` vs current. Force-pushes, squash-merges, or non-monotonic commit sequences can skip publishing — leaving an npm version with no matching image tag. The `IMAGE_VERSION_NOT_PUBLISHED` error surfaces this for users; fixing the predicate is out of scope for this change but should be filed as a follow-up.
- **Multi-arch publish failure (F19, accepted).** `publish-image.yml` has separate `build-amd64` and `build-arm64` jobs. If one fails, the manifest merge step (line 184) may complete with only one arch — users on the other arch hit "manifest unknown" identically to "never published." `IMAGE_VERSION_NOT_PUBLISHED` is the right error code; the suggestion text covers both cases.

**Known limitations:**
- Image-drift detection only fires for workspaces with an existing `.agent-env/devcontainer.json` — new workspaces (pre-create) have no config to compare against, so drift returns `null`. This is correct behavior — there's nothing to rebuild yet.
- The drift detection doesn't verify the image exists locally in Docker — only that the *desired* tag differs from what's pinned in the workspace config.
- **Digest-pinned user images (F19 digest case).** A user who pins `:1.1.0@sha256:abc...` in their *own* devcontainer config (not the agent-env-managed one) will see the validator warning every session (caught only by Task 17's throttle) and image-drift detection will tolerate the digest portion (per the AC12 test). The managed image itself never carries a digest.
- **Banner UX after rebuild (F23, accepted).** The drift banner is computed at menu poll time. When the user clicks "Rebuild" and the rebuild rewrites the file mid-action, the banner persists until the next poll cycle. This is mildly confusing but self-corrects within `pollIntervalMs`. A follow-up could trigger an immediate re-poll after rebuild completes.
- **`package.json` not in `files` array (F21, accepted).** The published npm package always includes `package.json` regardless of the `files` array, so the JSON-modules import works. If runtime strategy ever changes (e.g., reading from a sibling location), this becomes a latent bug. Note for future maintainers.

**Future considerations (out of scope):**
- A `--check-image-version` flag on `agent-env list` to surface drift across all workspaces at once.
- Gating npm publish on successful image publish (would eliminate the lag-window recovery scenario entirely; non-trivial workflow reorder).
- Fixing the brittle `HEAD~1` predicate in `publish-image.yml` (F16) to use a "publish if image tag absent" check instead.
- An immediate post-rebuild drift-state refresh hook in `MenuContainer` (F23).
- Migrating the `validateRepoConfig` warning into an interactive prompt that offers to rewrite the user's `.devcontainer/devcontainer.json` to the pinned tag.

## Review Notes

- Adversarial review completed via `bmad-review-adversarial-general` against the full diff (1907-line patch + 4 new files).
- Findings: 20 total, 9 fixed, 11 skipped/deferred (5 noise, 6 low-impact or out-of-spec).
- Resolution approach: auto-fix of real findings.

**Fixed (post-review):**
- F1 (Critical): Added `isDockerAvailable()` gate in `createInstance` BEFORE managed-image pull so Docker-down case surfaces `ORBSTACK_REQUIRED` instead of a confusing `IMAGE_PULL_FAILED`.
- F5 (High): Added `MenuContainer.test.tsx` covering the workspace-name threading through `detectDriftStateFn` and the image-drift banner render path.
- F6/F20 (High/Low): Tightened the "workspace-name through" test in `version-drift.test.ts` to assert the resolved managed-config path.
- F7 (Medium): Removed `pull access denied` from `IMAGE_VERSION_NOT_PUBLISHED` triggers — that pattern surfaces for genuine private-registry auth failures, a different problem class. Added a regression test.
- F9 (Medium): Anchored the CI "Verify dogfood image pin" grep to the top-level `^  "image"` indent so a future nested `image` field can't be picked up by accident.
- F10 (Medium): Wrapped `imageProbe` in `Promise.all` with `.catch(() => null)` so an override rejection can't reject the entire drift state — added a regression test.
- F13 (Medium): Made `build:image:use-remote` read the agent-env version dynamically via `node -p` so devs pulling mid-branch get the in-flight version, not a stale literal pin. Updated `scripts/sync-dogfood-pin.mjs` accordingly (errors if a literal pin is reintroduced).
- F17 (Low): `formatImageTagForLabel` now returns `'refresh'` for non-semver tags (`:latest`, branch names, untagged) — avoids grammatically nonsensical labels like "image vlatest available". Added unit tests covering port/digest/latest/untagged/prerelease cases.
- F19 (Low): Updated `.changeset/pin-image-tag.md` to document the new image-drift banner UX and `--no-pull` recovery hint.

**Skipped:**
- F2, F3, F4, F8, F14, F15 — verified noise on re-read (incorrect premise or covered elsewhere).
- F11 (throttle key collapse): production callers all pass `wsPath.root`; backward-compat is intentional per Task 17.
- F12, F16, F18: stylistic / trivial.

### Second Review Round (2026-07-31, quick-dev resume)

- Fresh-context adversarial review of the full uncommitted diff: 14 findings (0 Critical, 1 High). Resolution approach: auto-fix of "real" findings.

**Fixed (2nd round):**
- F2 (Medium): `buildActionOptions` imageDrift lane now always keeps `CHECK_FOR_UPDATES_OPTION` (was dropped unless `updateMessage` was also set); regression test added.
- F3 (Medium): `rebuildInstance` reordered — managed-image pull now runs BEFORE `refreshMergedConfig`, so a failed pull no longer rewrites the config and erases the image-drift signal; `ConfigRefreshResult.managedImage` removed (pull uses `getManagedImage()` directly); regression assertion added to the IMAGE_PULL_FAILED test.
- F4 (Medium): Added root `build:image:tag-local-as-managed` script — the explicit opt-in step (per Task 10's decision) to tag a local build as the managed image.
- F5 (Low): `.devcontainer/devcontainer.json` comment now documents the post-release "manifest unknown" lag window and recovery.
- F6 (Low): `detectImageDrift` docstring corrected (warn only fires when a logger is provided); the manual `checkForUpdates` path now wires `console.warn` so corruption is genuinely surfaced where console output is safe.
- F7 (Low): `checkForUpdates` reports `updateMessage` AND `imageDrift` independently (was else-if, hiding the npm update when both fired).
- F8 (Low): `rebuild --no-pull` help text updated to mention the managed-image pull.
- F9 (Low): `DOCKER_PULL_TIMEOUT` raised 300s → 900s (pull is now mandatory and the image is multi-GB); pull log line sets expectations about missing progress output.
- F11 (Low): `sync-dogfood-pin.mjs` resolves paths from its own location (cwd-insensitive); CI pin-check grep anchors on the repo coordinate instead of 2-space indentation.

**Deferred / skipped (2nd round):**
- F1 (High): missing force-publish lever for the `:X.Y.Z` image tag in `publish-image.yml` — the spec explicitly out-of-scopes that workflow (accepted limitation F16). **Follow-up recommended:** add a `workflow_dispatch` input to force-publish a version tag, or switch the predicate to "publish if tag absent".
- F10 (undecided): whether `changesets/action` (github-api commit mode) commits root-level files from the custom version command — verify on the first real release.
- F12, F13, F14: noise.

**Verification (2nd round):**
- `pnpm -r type-check`: clean; `pnpm -r lint`: clean
- `pnpm -r test:run`: 1089 (agent-env) + 45 (orchestrator) + 29 (shared) = 1163 tests pass
- AC12 grep: ZERO hits; CI dogfood pin check simulated locally: OK (1.1.0)
- `sync-dogfood-pin.mjs` run from a foreign cwd: OK (idempotent)

**Verification (1st round):**
- `pnpm -r type-check`: clean
- `pnpm -r lint`: clean
- `pnpm -r test:run`: 1088 (agent-env) + 45 (orchestrator) + 29 (shared) = 1162 tests pass
- AC12 falsifiable grep: ZERO hits (`grep -nP "ghcr\.io/.+/devcontainer:\d+\.\d+\.\d+" packages/agent-env/src/`)
- AC22 bundle probe: `dist/cli.js --version` (stripped) == `package.json .version` (stripped)
- AC18 dogfood probe: local CI script run reports `OK` (dogfood pin matches agent-env version)
