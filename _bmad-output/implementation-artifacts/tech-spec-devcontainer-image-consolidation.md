---
title: 'Devcontainer Image Consolidation'
slug: 'devcontainer-image-consolidation'
created: '2026-02-14'
status: 'done'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
tech_stack: ['docker', 'bash', 'python3', 'github-actions', 'devcontainer-spec', 'jq']
files_to_modify:
  - 'image/ (new — copied from claude-devcontainer)'
  - 'image/Dockerfile (surgical edits: remove obsolete COPYs, remove UV, add LABEL)'
  - 'image/scripts/ (21 scripts copied: 20 to /usr/local/bin/, tmux-session.sh to /home/node/.local/bin/)'
  - 'image/hooks/ (7 hooks + 2 configs + lib copied as-is)'
  - 'image/config/ (4 config files copied as-is)'
  - 'image/gemini/ (Gemini settings.json copied as-is)'
  - '.devcontainer/devcontainer.json (slim down to overrides)'
  - '.devcontainer/allowed-domains.txt (unchanged — project-specific firewall domains)'
  - '.devcontainer/post-create-project.sh (unchanged — project-specific setup hook)'
  - '.github/workflows/publish-image.yml (new — adapted from publish.yml)'
  - 'package.json (add build:image script)'
code_patterns:
  - 'Sudoers allowlist: scripts in /usr/local/bin/ with /etc/sudoers.d/node-commands'
  - 'Modular managed-settings: base.json + conditional modules merged by assemble-managed-settings.sh'
  - 'Defense-in-depth hooks: PreToolUse (6 hooks) + Stop (1 hook) + shared patterns.py lib'
  - 'post-create.sh orchestrator: numbered steps calling sudo scripts'
  - 'User model: root for installs, USER node for runtime'
  - 'LABEL written directly in Dockerfile (inline JSON)'
test_patterns:
  - 'Shell tests (bats) for scripts: image/scripts/__tests__/'
  - 'Real-project validation: devcontainer up with slimmed config'
  - 'Manual validation: devcontainer CLI + VS Code both tested'
---

# Tech-Spec: Devcontainer Image Consolidation

**Created:** 2026-02-14

## Overview

### Problem Statement

The Docker image that all devcontainers depend on lives in a separate repo (`claude-devcontainer`), causing cross-repo drift. When the image adds features (SSH socket permissions fix, `.gitconfig` mount), project `devcontainer.json` files don't pick them up — causing bugs like missing git identity and SSH permission denied errors. Infrastructure defaults (mounts, capabilities, env vars, lifecycle commands) are duplicated across every project's `devcontainer.json`, creating maintenance burden and inconsistency.

### Solution

Bring the Docker image (Dockerfile, scripts, hooks, config) into this monorepo under `image/`. Re-introduce `devcontainer.metadata` LABEL with comprehensive defaults so project `devcontainer.json` files only need project-specific overrides. Include the CI/CD pipeline for building and publishing the image. Copy files as-is with surgical edits only — no rewrites. Transition terminology from "claude-devcontainer" to "agent-devcontainer" to reflect broader multi-agent support.

### Scope

**In Scope:**

- Port Dockerfile, scripts, hooks, and config into this repo under `image/`
- Surgical Dockerfile edits: remove obsolete COPYs, remove UV, add LABEL, add SSH fix
- Comprehensive `devcontainer.metadata` LABEL with all infrastructure defaults
- CI/CD pipeline for building and publishing the image
- Slim down this project's `.devcontainer/devcontainer.json` to overrides only
- Validate by running `devcontainer up` with slimmed config (real project = the test)

**Out of Scope:**

- `packages/keystone-workflows` (separate migration PR in progress)
- `packages/claude-instance` (replaced by agent-env)
- `packages/bmad-orchestrator/scripts` (obsolete)
- DevPod compatibility
- Rewriting instance isolation or auth sharing (future iteration)
- Replacing search-history.sh with external tool (future iteration)
- Full `init-host.sh` rewrite (runs on host — a minimal inline `initializeCommand` is included in the slimmed config to ensure bind-mount sources exist; a proper `init-host.sh` script is future iteration)
- Agent-env baseline update (follow-up after LABEL is validated)
- CI LABEL schema validation (add later if error-prone)
- DevPod terminology cleanup in scripts (future iteration)

## Context for Development

### Codebase Patterns

- **Source repo:** `claude-devcontainer` (github.com/zookanalytics/claude-devcontainer) — Dockerfile, `image/scripts/`, `image/hooks/`, `image/config/`
- **Previous LABEL attempt:** Commit `4781913` removed `devcontainer.metadata` LABEL due to DevPod compatibility issues (DevPod is now deprecated, no longer a concern)
- **Sudoers pattern:** Image uses allowlisted sudo scripts in `/usr/local/bin/` with `/etc/sudoers.d/node-commands`
- **Lifecycle:** `postCreateCommand` calls `/usr/local/bin/post-create.sh` which orchestrates 12 setup steps (SSH socket fix is step 1); projects extend via `.devcontainer/post-create-project.sh`
- **User model:** Container runs as `node` (UID 1000), image built as root then switches to `USER node`
- **Security hooks:** Claude Code and Gemini managed settings + hook scripts in `/etc/claude-code/hooks/`. Defense-in-depth: file access layer, bash command layer, git workflow layer, platform safety layer, business logic layer. All hooks fail-closed.
- **Managed settings assembly:** `assemble-managed-settings.sh` merges `managed-settings.base.json` with optional modules (e.g., `managed-settings.bmad.json` when `ENABLE_BMAD_ORCHESTRATOR=true`) using jq
- **Multi-arch builds:** CI publishes `linux/amd64` + `linux/arm64` via Docker Buildx + QEMU
- **Build context:** Repo root, Dockerfile at `image/Dockerfile`. All COPY paths use `image/...` prefix.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `claude-devcontainer/image/Dockerfile` | Source Dockerfile to copy and edit |
| `claude-devcontainer/image/scripts/` | 22 bash scripts for container lifecycle |
| `claude-devcontainer/image/hooks/` | 7 hook scripts + 2 config JSONs + shared lib |
| `claude-devcontainer/image/config/` | allowed-domains.txt, dnsmasq.conf, tmux.conf, ulogd.conf |
| `claude-devcontainer/image/gemini/` | Gemini settings.json |
| `claude-devcontainer/.github/workflows/publish.yml` | Docker image build + GHCR push workflow |
| `.devcontainer/devcontainer.json` | This project's config (to be slimmed down) |
| `.devcontainer/allowed-domains.txt` | Project-specific firewall domain allowlist (loaded by `init-firewall.sh` at runtime — unchanged) |
| `.devcontainer/post-create-project.sh` | Project-specific post-create hook (called by `post-create.sh` step 13 — unchanged) |

### Script Assessment

| Script | Assessment | Notes |
|--------|------------|-------|
| post-create.sh | KEEP | Core orchestrator — 13 setup steps |
| fix-ssh-socket-permissions.sh | KEEP | New — fixes OrbStack socket UID mismatch |
| init-firewall.sh | KEEP | Core security — iptables allowlist |
| start-dnsmasq.sh | KEEP | DNS logging for firewall |
| start-ulogd.sh | KEEP | Packet logging for firewall |
| read-firewall-logs.sh | KEEP | Restricted log access wrapper |
| find-blocked-domain.sh | KEEP | Firewall debugging utility |
| test-firewall-logging.sh | KEEP | Firewall diagnostic tool |
| fix-node-modules-ownership.sh | KEEP | Fixes Docker volume permissions |
| fix-shared-data-permissions.sh | KEEP | Fixes shared-data volume permissions |
| check-daily-updates.sh | KEEP | Daily apt update check |
| update-packages.sh | KEEP | apt-get update wrapper |
| derive-project-name.sh | KEEP | Extracts project name from git remote |
| init-project.sh | KEEP | Bootstrap script for new projects (curl-piped — URL update needed post-move, see Notes) |
| devcontainer-sanity-check.sh | KEEP | Post-setup validation |
| register-plugin-marketplaces.sh | KEEP | Claude Code plugin registration |
| update-keystone.sh | DELETE | Logic integrated into `post-create.sh` |
| tmux-session.sh | KEEP | Instance-named tmux sessions |
| assemble-managed-settings.sh | KEEP | Modular hook config assembly |
| setup-instance-isolation.sh | KEEP | Instance isolation via shared volume |
| setup-claude-auth-sharing.sh | KEEP | Claude credential sharing (tech debt: manual invocation) |
| search-history.sh | KEEP | Cross-instance history search (tech debt: may adopt external tool) |

### Hook Assessment

All hooks KEEP — security-critical, defense-in-depth system:

| Hook | Type | Purpose |
|------|------|---------|
| prevent-main-push.sh | PreToolUse/Bash | Blocks push to main/master |
| prevent-no-verify.sh | PreToolUse/Bash | Enforces pre-commit hooks |
| prevent-admin-flag.sh | PreToolUse/Bash | Blocks `gh --admin` (shared Claude/Gemini) |
| prevent-bash-sensitive-args.py | PreToolUse/Bash | Blocks sensitive filenames in commands |
| prevent-env-leakage.py | PreToolUse/Bash | Blocks credential env var exposure |
| prevent-sensitive-files.py | PreToolUse/Read,Edit,Write | Blocks access to credential files |
| bmad-phase-complete.sh | Stop | BMAD orchestrator phase signaling |
| lib/patterns.py | Shared library | Central sensitive pattern definitions |
| managed-settings.base.json | Config | Base hook registration |
| managed-settings.bmad.json | Config | Conditional BMAD module |

### Technical Decisions

- **LABEL directly in Dockerfile:** Write the LABEL inline rather than a separate JSON file + injection mechanism. The LABEL changes rarely (stable infrastructure defaults). Extract to a separate file later only if it becomes painful.
- **Image location:** `image/` at repo root (no reason to anticipate multiple images)
- **Copy, don't rewrite:** Port scripts/hooks by copying as-is. Surgical edits only: remove 3 obsolete COPY lines (claude-instance, bmad-orchestrator, keystone-workflows), remove UV, add LABEL. No script rewrites — DevPod terminology cleanup is future iteration.
- **Keystone installation:** `keystone-cli` is installed via `bun` in the Dockerfile to ensure availability. `post-create.sh` performs an update/re-install of both `keystone-cli` and `keystone-workflows` to ensure the latest versions are always used.
- **CI/CD:** Port `publish.yml` for multi-arch Docker build + GHCR push. New file is `.github/workflows/publish-image.yml`.
- **Naming:** Unified under "Agent" tools. Image name: `agent-devcontainer`. Instance ID: `AGENT_INSTANCE`.
- **Validation: use the real project.** No formal test harness. After porting, slim down this project's `.devcontainer/devcontainer.json` and run `devcontainer up`.
- **Batteries-included vs general-purpose:** Optimize for zero-config in our use cases. The image serves our team's AI-assisted development — batteries-included is the correct trade-off. Use the layer model below to guide future pruning if/when the image needs to serve a broader audience.
- **What goes in LABEL vs project config:**
  - LABEL: `remoteUser`, `containerUser`, `capAdd`, `containerEnv` (SSH_AUTH_SOCK, POWERLEVEL9K_DISABLE_GITSTATUS, SHARED_DATA_DIR, pnpm config), `mounts` (shared-data, pnpm-store, .gitconfig, SSH socket), `postCreateCommand`, `postStartCommand`, base VS Code settings, base VS Code extensions
  - Project config: `name`, `image`, `runArgs`, `initializeCommand`, project-specific mounts (node_modules volume), project-specific env vars (`AGENT_INSTANCE`, `PROJECT_NAME`, `NODE_OPTIONS`, `ENABLE_BMAD_ORCHESTRATOR`), `portsAttributes`, VS Code extensions
  - **Lifecycle command constraint:** `postCreateCommand` and `postStartCommand` in LABEL are primary.
  - **Mount conflict rule:** Projects must NOT mount to targets already defined in LABEL.
  - **`containerEnv` conflict rule:** Per the devcontainer spec, `containerEnv` uses per-variable last-value-wins (NOT additive per-object). Project configs must NOT redefine LABEL `containerEnv` keys (`SSH_AUTH_SOCK`, `POWERLEVEL9K_DISABLE_GITSTATUS`, `SHARED_DATA_DIR`, `PNPM_HOME`, `npm_config_store_dir`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`) — doing so would silently override the LABEL value.
  - Unchanged project files: `.devcontainer/allowed-domains.txt` (project-specific firewall domains loaded at runtime by `init-firewall.sh`), `.devcontainer/post-create-project.sh` (project-specific setup hook invoked by `post-create.sh` step 13)
  - TBD (validation gate): `${localEnv:HOME}` mounts — test if variables resolve in LABEL; fall back to project config if not
- **`.gitconfig` mount is new behavior:** The `.gitconfig` bind mount exists in the `agent-env` baseline but was never in this project's `devcontainer.json`. Adding it via LABEL introduces new behavior (host git identity available inside the container). This is the fix for the missing git identity bug. If the host `~/.gitconfig` doesn't exist, the bind mount will fail — `initializeCommand` should verify this (handled by `init-host.sh`).

### Image Layer Model (First Principles)

```
Layer 0: node:22 base                              (irreducible)
Layer 1: Core tools (git, pnpm, zsh, tmux, delta)  (developer essentials)
Layer 2: Security (hooks, managed-settings, fw)     (agent guardrails)
Layer 3: AI tooling (Claude Code, Gemini CLI)       (the purpose of the image)
Layer 4: Instance mgmt (isolation, auth, keystone)  (multi-agent support)
Layer 5: Project conveniences (Playwright, lint)    (batteries-included)
```

**Layers 0-4:** Fundamental — always in the image.
**Layer 5:** Batteries-included for our use cases. Keep for now; move to project-level `postCreateCommand` if image generalizes.

**Flagged for future removal:**
- **UV:** No Python projects developed in these containers. Hooks use Python 3 from base image. CUT in this spec.
- **bun:** Only needed for keystone-cli. Re-evaluate after keystone-workflows migration completes — may be eliminable if keystone-cli can run on Node.js/pnpm.
- **Playwright deps:** Keep for now (zero-config value), but candidate for project-level install if image generalizes.
- **actionlint:** Keep for now (our repos have workflows), but candidate for project-level install.

### Risk Analysis (Red Team / Blue Team)

**Identified risks and mitigations:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| LABEL JSON maintenance (no syntax highlighting, escape hell, unreadable diffs) | Medium | Write LABEL inline — it changes rarely. Extract to separate file only if it becomes painful. Reduced from High: YAGNI on the build mechanism. |
| Merge semantics between LABEL and project config are underspecified (array concat vs replace?) | High | Empirically test merge behavior with both devcontainer CLI and VS Code during validation; document results. **Note:** `mounts` merge as collected list (last source wins for same target). `containerEnv` merges per-variable (last value wins per key). Per the devcontainer spec, lifecycle commands (`postCreateCommand`, `postStartCommand`) use **collected list** semantics — all values from all sources execute in sequence. This means: DO NOT set lifecycle commands in project config unless you want them to run *in addition to* the LABEL values. Validation gate #3 verifies the LABEL lifecycle command runs. |
| `runArgs` can't go in LABEL (`--shm-size`, OrbStack `--label` flags) | Medium | Accept: `capAdd` works via LABEL but `--shm-size` and custom labels stay in project config as documented "minimum project config" |
| `initializeCommand` runs on host before container exists — can't be in LABEL | Low | Accept: stays in project config; provide reference `init-host.sh` in image that projects can call |
| `${localEnv:HOME}` variable substitution may not work in LABEL (static strings at build time) | High | Test variable resolution during validation; fallback to requiring host-path mounts in project config (small, documented set) |
| Debugging opacity — config split between LABEL and local file | Medium | Add header comment in project devcontainer.json explaining where defaults come from; document `docker inspect` command for viewing LABEL |
| Implicit version coupling — `:latest` propagates LABEL changes to all projects instantly | Medium | Use semver-tagged images; breaking LABEL changes = major version bump |
| No build-time LABEL validation — typo produces valid image that fails at `devcontainer up` time | Low | Validate manually when LABEL changes (rare). Add CI validation later if it proves error-prone. |
| Writable `.claude` bind mount — container processes can modify host `~/.claude` (credentials, config) | Low | Accepted: Claude Code requires write access. Hook system guards against reading sensitive files but not writes. Mitigated by single-user devcontainer trust model. |

**Validation gates (build it, then verify — bail if it doesn't work):**
1. After implementing the LABEL, verify merge behavior: slim down this project's `devcontainer.json`, run `devcontainer up`, verify LABEL defaults + local overrides both apply. **Test array merge:** confirm project `mounts` are additive to LABEL `mounts` (not replacing them).
2. After including `${localEnv:HOME}` mounts in the LABEL, verify the variable resolves correctly at runtime — confirm `~/.gitconfig` is mounted inside the container. If it fails, move those mounts to project config (small, documented set).
3. Verify `postCreateCommand` from LABEL executes — per the devcontainer spec, lifecycle commands use collected-list semantics (all sources run in sequence). Confirm the LABEL's `postCreateCommand` runs. **Do not** add `postCreateCommand` to the project config — it would cause duplicate execution.

## Implementation Plan

### Tasks

- [x] **Task 1: Copy image files into `image/`**
- [x] **Task 2: Surgical Dockerfile edits**
- [x] **Task 3: Add `devcontainer.metadata` LABEL**
- [x] **Task 4: Port CI/CD publish workflow**
- [x] **Task 5: Add `build:image` script to package.json**
- [x] **Task 6: Slim down `.devcontainer/devcontainer.json`**
- [x] **Task 7: Validate**

### Acceptance Criteria

- [x] AC 1: Given the image is built from `image/Dockerfile`, when a project specifies only `"image"` + project-specific overrides in its `devcontainer.json`, then `devcontainer up` creates a working container with all infrastructure defaults applied from the LABEL.
- [x] AC 2: Given a container created from the image, when running `ssh -T git@github.com`, then the SSH agent socket is accessible and authentication succeeds.
- [x] AC 3: Given a container created from the image and a host `~/.gitconfig`, when running `git config user.name`, then the host's git identity is available.
- [x] AC 4: Given a container created from the image, when Claude Code starts, then managed-settings.json contains all security hooks.
- [x] AC 5: Given a push to the `main` branch modifying files under `image/**`, then a multi-arch Docker image is built and pushed to GHCR.
- [x] AC 6: Given a GitHub release is published, the image is tagged with the semver version.
- [x] AC 7: Given this project's `.devcontainer/devcontainer.json` contains only overrides, when `devcontainer up` runs, the merged config is correct.
- [x] AC 8: Given the Dockerfile does not contain obsolete COPY lines, the build succeeds.
- [x] AC 9: Given the Dockerfile does not install UV, Python 3 is still available and hooks execute.
- [x] AC 10: Given a container created from the image, `tmux ls` shows an active session.
- [x] AC 11: Local build via `pnpm build:image` completes without errors.

## Additional Context

### Dependencies

- SSH socket permissions fix (included in Task 2 — from our earlier patch)
- `.gitconfig` mount (included in LABEL — Task 3) — **new behavior**: this mount exists in agent-env baseline but was never in this project's `devcontainer.json`; LABEL introduces it for the first time
- Host `~/.gitconfig` must exist — `initializeCommand` (`init-host.sh`) should verify bind-mount source files exist before container creation
- Access to `claude-devcontainer` repo (for copying source files — Task 1)

### Testing Strategy

- **Real-project validation:** After porting, slim down this project's `.devcontainer/devcontainer.json` and run `devcontainer up`. Verify: SSH agent works, git identity works, hooks load, firewall initializes. The real project is the test — no separate harness.
- **Existing tests:** Port bats tests from `image/scripts/__tests__/` (search-history, setup-instance-isolation)
- **VS Code validation:** Open the slimmed devcontainer in VS Code to confirm LABEL merge works there too
- **CI validation:** Push to a branch, verify `publish-image.yml` builds successfully

### Notes

- The old LABEL (removed in commit `4781913`) covered ~80% of needed defaults but was missing: SSH socket mount + env, `.gitconfig` mount, `--shm-size`, `POWERLEVEL9K_DISABLE_GITSTATUS`, `postStartCommand`, `initializeCommand`
- The image currently publishes to `ghcr.io/zookanalytics/claude-devcontainer:latest` — new image will publish to `ghcr.io/<this-repo-owner>/<this-repo-name>/devcontainer` (the `/devcontainer` suffix distinguishes the image package from the repo)
- Dockerfile references packages that won't exist in this repo: `packages/claude-instance` (replaced by agent-env), `packages/bmad-orchestrator` (obsolete), `packages/keystone-workflows` (separate migration). All three COPY blocks removed in Task 2.
- `init-project.sh` is a standalone bootstrap script (curl-piped from GitHub) — will need its URL updated after the repo move (future iteration, not blocking)
- CI publish workflow uses multi-arch (amd64 + arm64) via QEMU + Buildx, caches with GitHub Actions cache
- Registry: GHCR with `GITHUB_TOKEN` — no external secrets needed
- **Known tech debt:** `managed-settings.base.json` contains `extraKnownMarketplaces` URL and `enabledPlugins` referencing `claude-devcontainer` repo. These will be stale after migration. Per "copy, don't rewrite" — leave as-is for now; update when marketplace config is next touched.
- `.devcontainer/post-create-project.sh` in this repo is project-specific setup (called by `post-create.sh` step 13). It references "Signal Loom" branding — may want to update, but not part of this spec. This file is NOT copied into `image/` — it stays in the project. **Known redundancy:** This script installs actionlint via curl, but actionlint is already baked into the image. Also references `/workspace/scripts/claude-instance` which won't exist after migration (guarded, but prints a warning). Both are cleanup follow-ups.
- `.devcontainer/allowed-domains.txt` is the project-specific firewall domain allowlist. It is loaded at runtime by `init-firewall.sh` from `$WORKSPACE_ROOT/.devcontainer/allowed-domains.txt`. The image also contains base domains at `/etc/allowed-domains.txt`. Both are combined — project domains are additive.
