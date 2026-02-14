---
title: 'Keystone Workflows Installation and Publication'
slug: 'keystone-installation'
created: '2026-02-14'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - npm (global install, postinstall scripts)
  - pnpm (monorepo package manager)
  - changesets (versioning)
  - GitHub Actions (CI/CD publish via changesets/action@v1)
  - Trusted Publishing / OIDC (npm auth, per-package config)
  - sh (postinstall script, POSIX-compatible)
files_to_modify:
  - packages/keystone-workflows/package.json
  - packages/keystone-workflows/scripts/postinstall.sh
  - packages/keystone-workflows/config/keystone-config.yaml
  - .github/workflows/publish.yml
files_to_create:
  - packages/keystone-workflows/LICENSE
code_patterns:
  - 'pnpm workspaces under packages/*'
  - 'changesets with @changesets/changelog-github'
  - 'publish.yml auto-discovers packages via pnpm -r + changesets/action'
  - 'Trusted Publishing (OIDC) configured per-package on npmjs.com'
  - 'No publishConfig needed — changeset config.json sets access: public globally'
  - 'Static-only packages (no build step) are valid — pnpm -r build is a no-op'
test_patterns:
  - 'Manual verification: npm pack --dry-run to check published contents'
  - 'Manual verification: global install in clean environment'
  - 'CI: publish.yml is idempotent and handles already-published versions'
---

# Tech-Spec: Keystone Workflows Installation and Publication

**Created:** 2026-02-14

## Overview

### Problem Statement

The `keystone-workflows` package has a broken installation story. The `postinstall.sh` script forcibly overwrites user workflow files without awareness, the `package.json` repository URL points to the wrong repo (`claude-devcontainer` instead of `bmad-orchestrator`), no publish pipeline is configured for this package, and it doesn't follow the monorepo's established patterns for changesets, Trusted Publishing, or package metadata.

### Solution

Rework the package for clean installation via `npm install -g @zookanalytics/keystone-workflows`. The postinstall script will always install the latest workflows (they are the product and should be current), manage config with single-backup `.bak` protection, and produce clean user-facing output. The package will be fully integrated into the monorepo's existing changesets + CI/CD publish pipeline with Trusted Publishing (OIDC) configured on npm.

### Why postinstall (not removal)

The reference tech-spec (`tech-spec-keystone-installation-rework.md`) proposed removing postinstall entirely and shifting resource management to `keystone-cli`. That approach assumed keystone-cli lives in the same monorepo. It doesn't — keystone-cli is a separate repo, and changes to it are out of scope. The postinstall approach is self-contained: installing the npm package is sufficient to place files where keystone-cli expects them, without requiring any coordination. A future keystone-cli enhancement could add direct package-path discovery (via `require.resolve`), making the postinstall copy unnecessary. That's a future optimization, not a blocker.

### Scope

**In Scope:**
- Fix `package.json`: repository URL, description, keywords, `files` array, postinstall invocation
- Rewrite `postinstall.sh`: non-fatal, clean messaging, config backup-then-overwrite
- Add LICENSE file (package declares MIT but ships no license file)
- Fix stale `claude-devcontainer` reference in `keystone-config.yaml`
- Update `publish.yml` OIDC documentation comments
- First publish to npm (manual bootstrap, then configure OIDC for automation)
- Clean upgrade path (`npm update -g` works correctly)

**Out of Scope:**
- keystone-cli changes (separate repo, can be coordinated separately)
- New workflow definitions beyond the existing three
- Workflow-level intelligence or orchestrator integration
- Engine evaluation or keystone-cli fork enhancements
- Config file content changes (model references, provider settings) — only the stale comment is fixed
- CI pipeline smoke-test for this package (deferred — risk is low for a static-file package)

## Context for Development

### Codebase Patterns

- **pnpm workspaces** — All packages under `packages/*`. Recursive commands (`pnpm -r build/test/lint`) auto-discover all packages.
- **Changesets** — `@changesets/changelog-github` for changelogs. Config: `access: "public"`, empty `ignore` list, `baseBranch: "main"`. New packages are automatically included.
- **publish.yml** — Uses `changesets/action@v1` with Trusted Publishing (OIDC). Runs on push to main. Auto-discovers packages with pending version bumps. Idempotent — safe to re-run.
- **No `publishConfig` needed** — The changeset config sets `"access": "public"` globally for all packages. agent-env also doesn't use `publishConfig`.
- **Static packages are valid** — keystone-workflows has no build/lint/test scripts. `pnpm -r build` is a no-op for it. This is fine.
- **Repository URL pattern** — agent-env uses `https://github.com/zookanalytics/bmad-orchestrator` (no `.git` suffix). Follow this convention.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/keystone-workflows/package.json` | Package metadata — needs repository URL fix, description update |
| `packages/keystone-workflows/scripts/postinstall.sh` | Current postinstall — needs full rewrite |
| `packages/keystone-workflows/config/keystone-config.yaml` | Default config — has stale `claude-devcontainer` comment |
| `packages/keystone-workflows/workflows/*.yaml` | Three workflow definitions (bmad-story, bmad-epic, bmad-epic-status) |
| `packages/agent-env/package.json` | Reference for publication metadata patterns |
| `.changeset/config.json` | Changesets configuration (verified: no ignore list, public access) |
| `.github/workflows/publish.yml` | CI/CD publish pipeline (verified: auto-discovers packages) |
| `LICENSE` | Root MIT license — copy to packages/keystone-workflows/ |

### Technical Decisions

- **Workflows always overwrite**: Workflow YAML files are the product — they encode operational knowledge and improve with each release. Users always get the latest on install/upgrade. The postinstall copies `*.yaml` files from the package's `workflows/` directory. **Known limitation**: stale workflow files are not removed — if a future release drops a workflow, the old file persists in `~/.keystone/workflows/`. This is acceptable for now; cleanup can be added when workflows are actually removed.
- **Config overwrites with single backup**: `config.yaml` is overwritten on install/upgrade, but the previous version is preserved as `config.yaml.bak` (single file, not timestamped, no accumulation). Note: the source file is named `keystone-config.yaml` in the package but installed as `config.yaml` because keystone-cli expects `~/.config/keystone/config.yaml`.
- **Postinstall is non-fatal**: Errors in the postinstall script produce warnings but do NOT block `npm install`. This prevents opaque install failures from filesystem permission issues. The trade-off: if postinstall silently fails, the user must manually check file placement.
- **Postinstall invocation**: The `package.json` uses `"postinstall": "sh ./scripts/postinstall.sh"` (invoking `sh` explicitly) rather than `"./scripts/postinstall.sh"` to avoid execute-permission issues. Using `sh` instead of `bash` because the script is POSIX-compatible and `sh` is available everywhere (including Alpine-based containers where `bash` may not be installed).
- **Trusted Publishing (OIDC)**: Follows the same pattern as agent-env. Requires manual configuration on npmjs.com. Must be done AFTER the first publish (package must exist on npm before OIDC can be linked).
- **No CI/CD functional changes needed**: `publish.yml` and `ci.yml` use `pnpm -r` recursive commands and `changesets/action` — both auto-discover packages in the workspace. Only comment updates for documentation.
- **`files` array is the sole determinant**: No `.npmignore` exists. The `files` array in `package.json` controls what gets published.
- **Postinstall runs on both install and update**: `npm install -g` and `npm update -g` both trigger the postinstall script identically.

## Implementation Plan

### Tasks

Tasks 1-5 are implementable by a dev agent. Tasks 6-8 are **manual/human-only** steps requiring npm credentials and browser access.

- [x] Task 1: Fix `package.json` metadata and add LICENSE
  - File: `packages/keystone-workflows/package.json`
  - Actions:
    - Change `repository.url` from `"https://github.com/zookanalytics/claude-devcontainer.git"` to `"https://github.com/zookanalytics/bmad-orchestrator"` (no `.git` suffix — matches agent-env convention)
    - Change `description` from `"BMAD keystone workflows for claude-devcontainer"` to `"Declarative automation workflows for AI-assisted development on keystone-cli"`
    - Update `keywords`: replace `"claude-devcontainer"` with `"automation"`, add `"agent"`, `"pipeline"`
    - Add `"LICENSE"` to the `files` array → `["workflows/", "config/", "scripts/", "LICENSE"]`
    - Change `scripts.postinstall` from `"./scripts/postinstall.sh"` to `"sh ./scripts/postinstall.sh"` (invoke `sh` explicitly — avoids execute-permission issues and works on Alpine/minimal containers where bash may not be installed)
    - No `publishConfig` needed (handled by changeset config `access: "public"`)
  - File: `packages/keystone-workflows/LICENSE`
  - Action: Copy `LICENSE` from the repository root (`/workspaces/bmad-orchestrator-keystone/LICENSE`). This is the same MIT license used by agent-env.
  - After making changes: Run `pnpm install` to regenerate lockfile. Note: metadata-only changes to `package.json` (description, keywords, repository) may not change the lockfile — this is expected. If the lockfile does not change, that's fine. If it does change, commit it.
  - Verification: `npm pack --dry-run` in `packages/keystone-workflows/` shows correct files

- [x] Task 2: Fix stale reference in `keystone-config.yaml`
  - File: `packages/keystone-workflows/config/keystone-config.yaml`
  - Action: Change the comment on line 2 from `# Default configuration for BMAD workflows in claude-devcontainer` to `# Default configuration for BMAD workflows`
  - **Do NOT modify any other content in this file** (provider settings, model references, etc. are out of scope for this spec)

- [x] Task 3: Rewrite `postinstall.sh`
  - File: `packages/keystone-workflows/scripts/postinstall.sh`
  - Action: Replace the entire file with the following script:

  ```sh
  #!/bin/sh
  # Keystone Workflows postinstall
  # Installs workflow files and config to user directories.
  # Non-fatal: warnings are printed but npm install is never blocked.
  # POSIX sh compatible — works on Alpine, minimal containers, and anywhere sh exists.

  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  PACKAGE_DIR="$SCRIPT_DIR/.."
  WORKFLOWS_DIR="$PACKAGE_DIR/workflows"
  CONFIG_DIR="$PACKAGE_DIR/config"

  # Validate prerequisites
  if [ -z "${HOME:-}" ]; then
    echo "keystone-workflows: WARNING: \$HOME is not set. Skipping resource installation." >&2
    exit 0
  fi

  if [ ! -d "$WORKFLOWS_DIR" ]; then
    echo "keystone-workflows: WARNING: Workflows directory not found in package. Skipping." >&2
    exit 0
  fi

  # --- Workflows ---
  # Workflows are the product — always install latest version
  # Workflow and config sections are independent — failure in one does not skip the other
  WORKFLOW_TARGET="$HOME/.keystone/workflows"
  IS_UPGRADE=false
  [ -d "$WORKFLOW_TARGET" ] && IS_UPGRADE=true

  if mkdir -p "$WORKFLOW_TARGET" 2>/dev/null; then
    WORKFLOW_COUNT=0
    for f in "$WORKFLOWS_DIR"/*.yaml; do
      [ -e "$f" ] || continue
      if cp -f "$f" "$WORKFLOW_TARGET/$(basename "$f")" 2>/dev/null; then
        WORKFLOW_COUNT=$((WORKFLOW_COUNT + 1))
      fi
    done

    if [ "$WORKFLOW_COUNT" -gt 0 ]; then
      if [ "$IS_UPGRADE" = true ]; then
        echo "keystone-workflows: Updated $WORKFLOW_TARGET ($WORKFLOW_COUNT files)"
      else
        echo "keystone-workflows: Installed workflows to $WORKFLOW_TARGET ($WORKFLOW_COUNT files)"
      fi
    else
      echo "keystone-workflows: WARNING: No workflow files installed." >&2
    fi
  else
    echo "keystone-workflows: WARNING: Cannot create $WORKFLOW_TARGET. Skipping workflows." >&2
  fi

  # --- Config ---
  # Config is overwritten with single-backup protection
  # Source: keystone-config.yaml -> installed as config.yaml (keystone-cli convention)
  # Attempted independently of workflow installation
  CONFIG_TARGET="$HOME/.config/keystone"
  if ! mkdir -p "$CONFIG_TARGET" 2>/dev/null; then
    echo "keystone-workflows: WARNING: Cannot create $CONFIG_TARGET. Skipping config." >&2
    exit 0
  fi

  CONFIG_SRC="$CONFIG_DIR/keystone-config.yaml"
  CONFIG_DEST="$CONFIG_TARGET/config.yaml"

  if [ -f "$CONFIG_SRC" ]; then
    if [ -f "$CONFIG_DEST" ]; then
      if cp -f "$CONFIG_DEST" "$CONFIG_DEST.bak" 2>/dev/null; then
        echo "keystone-workflows: Previous config backed up to $CONFIG_DEST.bak"
      else
        echo "keystone-workflows: WARNING: Failed to backup existing config." >&2
      fi
    fi
    if cp -f "$CONFIG_SRC" "$CONFIG_DEST" 2>/dev/null; then
      echo "keystone-workflows: Config installed to $CONFIG_DEST"
    else
      echo "keystone-workflows: WARNING: Failed to install config." >&2
    fi
  else
    echo "keystone-workflows: WARNING: Default config not found in package. Skipping." >&2
  fi
  ```

  - Key design decisions in this script:
    - **POSIX `sh` compatible**: Uses `#!/bin/sh` — no bash-isms. Works on Alpine, minimal containers, anywhere.
    - **Non-fatal**: No `set -e`. Every file operation checks its return code. npm install always succeeds (exit 0).
    - **Upgrade detection**: Based on existence of `~/.keystone/workflows/` directory before creating it. If it exists, this is an upgrade → "Updated" message. If not → "Installed" message.
    - **$HOME guard**: If `$HOME` is unset (e.g., some CI environments), the script warns and exits 0.
    - **Config backup with verification**: The `.bak` copy is checked — message only prints on success. If backup fails, a warning is emitted but config installation still proceeds (the user is informed).
    - **Config rename**: Source file `keystone-config.yaml` is installed as `config.yaml` because keystone-cli expects `~/.config/keystone/config.yaml`.
    - **Prefix**: All output lines start with `keystone-workflows:` for clear attribution in npm install output.
    - **Partial workflow failure**: If some (but not all) workflow files fail to copy, the count reflects what actually succeeded. This is a known limitation — accepted because the only realistic cause is a full disk, at which point many other things are also broken.

- [x] Task 4: Update `publish.yml` OIDC documentation
  - File: `.github/workflows/publish.yml`
  - Action: Find the comment block containing these existing lines:
    ```
    #   - Package: @zookanalytics/agent-env
    #   - Repository: ZookAnalytics/bmad-orchestrator
    #   - Workflow: publish.yml
    #   - npm settings: https://www.npmjs.com/package/@zookanalytics/agent-env/access
    ```
    Insert immediately after `#   - npm settings: https://www.npmjs.com/package/@zookanalytics/agent-env/access`:
    ```
    #
    #   - Package: @zookanalytics/keystone-workflows
    #   - Repository: ZookAnalytics/bmad-orchestrator
    #   - Workflow: publish.yml
    #   - npm settings: https://www.npmjs.com/package/@zookanalytics/keystone-workflows/access
    ```
  - Notes: This is a documentation-only change. No functional changes to the workflow.

- [x] Task 5: Create changeset, commit, and push
  - **Important**: Create a feature branch BEFORE making any changes (or before committing if changes are already staged on main).
  - Actions:
    1. Create and switch to a feature branch: `git checkout -b feat/keystone-install-rework`
    2. Create changeset file directly (do NOT use interactive `pnpm changeset`). Write the file `.changeset/keystone-install-rework.md` with this EXACT content (no leading blank lines — the first line must be `---`):
       ```
       ---
       "@zookanalytics/keystone-workflows": minor
       ---

       Rework installation for clean global install and upgrade path

       - Fix package.json metadata (repository URL, description, keywords)
       - Rewrite postinstall.sh for non-fatal, backup-aware installation
       - Add LICENSE file
       - Fix stale claude-devcontainer references
       ```
    3. Run `pnpm install` — if the lockfile changes, include it in the commit. If it doesn't change (metadata-only edits may not affect it), that's fine.
    4. Stage and commit all changes:
       - `packages/keystone-workflows/package.json`
       - `packages/keystone-workflows/scripts/postinstall.sh`
       - `packages/keystone-workflows/config/keystone-config.yaml`
       - `packages/keystone-workflows/LICENSE`
       - `.github/workflows/publish.yml`
       - `.changeset/keystone-install-rework.md`
       - `pnpm-lock.yaml` (if changed)
    5. Push branch to origin and create a PR via `gh pr create`
  - Notes: A `minor` bump (0.1.0 → 0.2.0) is appropriate because the postinstall behavior has changed (config handling) — this is a behavioral change, not a bug fix. It's not `major` because the package has never been publicly consumed.

- [ ] Task 6: First publish (MANUAL — not automatable by dev agent)
  - This requires npm credentials and may require browser access.
  - **WARNING**: Do NOT use `npm publish` directly. Scoped packages default to `restricted` access. Always use `pnpm changeset publish` which respects the changeset config's `access: "public"` setting.
  - Order of operations:
    1. After the PR from Task 5 merges to main, `publish.yml` creates a "Version Packages" PR
    2. Merge the "Version Packages" PR
    3. `publish.yml` runs `pnpm changeset publish`
    4. **If OIDC is not yet configured** (likely for first publish), it will fail with a 403
    5. In that case, do the first publish manually from a local checkout:
       ```bash
       git checkout main && git pull
       pnpm install && pnpm -r build
       npm login  # authenticate to @zookanalytics org
       pnpm changeset publish  # NOT npm publish
       ```
    6. After the package exists on npm, configure OIDC (Task 7)

- [ ] Task 7: Configure Trusted Publishing on npmjs.com (MANUAL — browser required)
  - **Prerequisite**: Task 6 must be completed first — the package must exist on npm.
  - Steps:
    1. Go to `https://www.npmjs.com/package/@zookanalytics/keystone-workflows/access`
    2. Under "Publishing access" → "Trusted Publishing", add a new linked repository
    3. Set Repository: `ZookAnalytics/bmad-orchestrator`
    4. Set Workflow: `publish.yml`
    5. Verify the configuration is saved
  - After this, all subsequent publishes via the CI pipeline will use OIDC automatically.

- [ ] Task 8: Verify end-to-end installation (MANUAL — requires published package)
  - Actions:
    1. After publish, run `npm install -g @zookanalytics/keystone-workflows` in a clean environment
    2. Verify `~/.keystone/workflows/` contains all three workflow files
    3. Verify `~/.config/keystone/config.yaml` contains default config
    4. Run `npm install -g @zookanalytics/keystone-workflows` again (reinstall — should be idempotent)
    5. Verify `config.yaml.bak` was created with previous config content
    6. Verify `config.yaml` has the new factory default
    7. Verify workflows were overwritten with latest content
    8. If `keystone` CLI is available: run `keystone run bmad-story --help` or equivalent to verify workflow discovery. If not available, verify manually that `~/.keystone/workflows/bmad-story.yaml` content matches the package source.

### Acceptance Criteria

- [ ] AC1: Given a fresh system with no `~/.keystone/` directory, when `npm install -g @zookanalytics/keystone-workflows` is run, then `~/.keystone/workflows/` contains `bmad-story.yaml`, `bmad-epic.yaml`, and `bmad-epic-status.yaml`, and `~/.config/keystone/config.yaml` exists with default content, and output includes "Installed workflows" message.

- [ ] AC2: Given an existing `~/.config/keystone/config.yaml` with user modifications, when `npm install -g @zookanalytics/keystone-workflows` (upgrade) is run, then `config.yaml.bak` contains the previous config content and `config.yaml` contains the new factory default, and output includes "Previous config backed up" message.

- [ ] AC3: Given an existing `config.yaml.bak` from a previous upgrade, when another upgrade is run, then only one `config.yaml.bak` exists (replaced, not accumulated) and it contains the content from the most recent pre-upgrade `config.yaml`.

- [ ] AC4: Given the package is built, when `npm pack --dry-run` is run in `packages/keystone-workflows/`, then the tarball contains `package.json`, `LICENSE`, `workflows/` (3 YAML files), `config/` (1 YAML file), and `scripts/` (1 shell script). Additional auto-included files (e.g., `CHANGELOG.md` after changesets runs) are acceptable.

- [ ] AC5: Given the `package.json`, when `repository` is inspected, then `url` is `https://github.com/zookanalytics/bmad-orchestrator` (no `.git` suffix) and `directory` is `packages/keystone-workflows`.

- [ ] AC6: Given the package is published to npm, when `npm view @zookanalytics/keystone-workflows` is run, then the package exists on the registry with correct metadata.

- [ ] AC7: Given an upgrade where workflow files changed, when the postinstall runs, then the workflow files in `~/.keystone/workflows/` reflect the updated content from the new package version, and output includes "Updated" message (not "Installed").

- [ ] AC8: Given `$HOME` is unset, when the postinstall runs, then it prints a warning to stderr and exits 0 (does not block npm install).

- [ ] AC9: Given `~/.keystone/` cannot be created (e.g., permissions), when the postinstall runs, then it prints a warning about workflows to stderr, still attempts config installation independently (since `~/.config/keystone/` is a different path), and exits 0 (does not block npm install).

- [ ] AC10: Given the config backup `cp` fails (e.g., read-only filesystem), when the postinstall runs, then it prints a warning about the backup failure to stderr, still attempts to install the new config, and exits 0. If both backup and install fail, the user sees two warnings ("Failed to backup" and "Failed to install config") and the script still exits 0.

## Additional Context

### Dependencies

- **npm registry access**: Publish permissions for `@zookanalytics` scope on npmjs.com
- **npmjs.com Trusted Publishing**: Manual OIDC configuration required AFTER first publish (one-time, per-package)
- **keystone-cli** (external): Must already support reading workflows from `~/.keystone/workflows/` and config from `~/.config/keystone/config.yaml` — confirmed it does
- **No code dependencies**: This package has zero runtime `dependencies` — it's purely static files + a shell postinstall script
- **pnpm-lock.yaml**: Run `pnpm install` after `package.json` changes. Metadata-only changes may or may not update the lockfile — either outcome is fine. Commit the lockfile if it changes.

### Testing Strategy

**No automated tests** — this package contains no executable code (only YAML workflows, a config file, and a shell postinstall script). Testing is manual:

1. **Pre-publish validation**: `npm pack --dry-run` in the package directory — verify correct files are included (AC4)
2. **Local postinstall test**: Run `sh ./scripts/postinstall.sh` manually in a temp environment:
   - Set `HOME` to a temp directory
   - Run once — verify first-install behavior (dirs created, files copied, "Installed" message)
   - Run again — verify upgrade behavior (`.bak` created, files overwritten, "Updated" message)
   - Run a third time — verify `.bak` is replaced (not accumulated)
   - Unset `HOME`, run — verify warning and exit 0
3. **Global install test**: `npm install -g @zookanalytics/keystone-workflows` in a clean devcontainer
4. **Upgrade test**: Modify config, run `npm install -g` again, verify backup + overwrite
5. **Integration test**: If `keystone` CLI is available, verify workflow discovery

### Notes

- **keystone-cli coordination**: keystone-cli is in a separate repo. A future companion change there could add package-path discovery (reading workflows directly from the npm global install path via `require.resolve`), which would eventually make the postinstall copy-step unnecessary.
- **First publish bootstrapping**: The very first npm publish must be done manually (via `npm login` + local publish) because Trusted Publishing OIDC requires the package to already exist on npm before it can be linked. This is the same bootstrapping pattern used for agent-env.
- **Changeset bump rationale**: `minor` bump (0.1.0 → 0.2.0) — the postinstall behavior has changed (config is now overwritten with backup instead of skipped if exists). This is a behavioral change, not a bug fix. Not `major` because the package has never been publicly consumed.
- **Known limitation — stale workflow files**: The postinstall copies workflow files into `~/.keystone/workflows/` but does NOT remove stale files. If a future version drops a workflow, the old file persists. This is acceptable for now — cleanup logic can be added when workflows are actually removed from the package.
- **Known limitation — partial workflow copy**: If some workflow files fail to copy (e.g., disk full), the count reflects what succeeded. The user sees a count but may not realize it's incomplete. Accepted risk — the only realistic cause is system-level failure where many other things are also broken.
- **Config content**: This spec only fixes the stale `claude-devcontainer` comment in `keystone-config.yaml`. All other config content (provider settings, model references, engine allowlists) is untouched and out of scope.
- **Known limitation — sudo installs**: If the package is installed via `sudo npm install -g`, the postinstall runs as root and installs files to `/root/.keystone/` and `/root/.config/keystone/` — inaccessible to the actual user. This is a general npm global-install limitation, not specific to this package. Users should use a Node version manager (nvm, volta) or configure npm's global prefix to avoid needing sudo.

## Review Notes
- Adversarial review completed
- Findings: 15 total, 1 fixed, 14 skipped (by-design/out-of-scope/noise)
- Resolution approach: auto-fix
- F14 fixed: narrowed `files` array from `"scripts/"` to `"scripts/postinstall.sh"`
- F6 acknowledged: postinstall writing to $HOME is an accepted architectural risk
- F11 acknowledged: Windows/sh limitation is inherent to shell-based postinstall
