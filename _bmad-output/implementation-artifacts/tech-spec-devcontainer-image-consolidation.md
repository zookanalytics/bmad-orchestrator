---
title: 'Devcontainer Image Consolidation'
slug: 'devcontainer-image-consolidation'
created: '2026-02-14'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['docker', 'bash', 'python3', 'github-actions', 'devcontainer-spec', 'jq']
files_to_modify:
  - 'image/ (new — copied from claude-devcontainer)'
  - 'image/Dockerfile (surgical edits: remove obsolete COPYs, remove UV, add LABEL)'
  - 'image/scripts/ (22 scripts copied: 20 to /usr/local/bin/, tmux-session.sh to /home/node/.local/bin/, init-project.sh not COPYd — curl-piped at runtime)'
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

Bring the Docker image (Dockerfile, scripts, hooks, config) into this monorepo under `image/`. Re-introduce `devcontainer.metadata` LABEL with comprehensive defaults so project `devcontainer.json` files only need project-specific overrides. Include the CI/CD pipeline for building and publishing the image. Copy files as-is with surgical edits only — no rewrites.

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
- **Lifecycle:** `postCreateCommand` calls `/usr/local/bin/post-create.sh` which orchestrates 13 setup steps (SSH socket fix is step 1, already present upstream); projects extend via `.devcontainer/post-create-project.sh`
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
| update-keystone.sh | KEEP | Keystone CLI/workflow updates |
| tmux-session.sh | KEEP | Instance-named tmux sessions |
| assemble-managed-settings.sh | KEEP | Modular hook config assembly |
| setup-instance-isolation.sh | KEEP | Instance isolation via shared volume (tech debt: DevPod terminology) |
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
- **Keystone decoupling:** Remove `packages/keystone-workflows` COPY from Dockerfile. `update-keystone.sh` (post-create.sh step 8) already handles install/update from GitHub — let it handle initial install too. **Note:** Keystone install runs after firewall init (step 11 in post-create.sh) — `github.com` and `raw.githubusercontent.com` must be in the image's `allowed-domains.txt` for this to work.
- **CI/CD:** Port `publish.yml` for multi-arch Docker build + GHCR push. `code-quality.yml` and `tests.yml` reference `bmad-dashboard` package (not applicable — this repo has its own CI).
- **Agent-env baseline update: decoupled.** Update `packages/agent-env/config/baseline/devcontainer.json` in a follow-up after the image and LABEL are validated. Not part of this spec. **Note for follow-up:** the baseline currently has `.claude` mount as `readonly` — this must change to writable, since Claude Code writes session data to `~/.claude`.
- **Validation: use the real project.** No formal test harness. After porting, slim down this project's `.devcontainer/devcontainer.json` and run `devcontainer up`. Verify SSH, git identity, and hooks work. The real project is the test.
- **Batteries-included vs general-purpose:** Optimize for zero-config in our use cases. The image serves our team's AI-assisted development — batteries-included is the correct trade-off. Use the layer model below to guide future pruning if/when the image needs to serve a broader audience.
- **What goes in LABEL vs project config:**
  - LABEL: `remoteUser`, `containerUser`, `capAdd`, `containerEnv` (SSH_AUTH_SOCK, POWERLEVEL9K_DISABLE_GITSTATUS, SHARED_DATA_DIR, pnpm config), `mounts` (shared-data, pnpm-store, .gitconfig, .claude, SSH socket), `postCreateCommand`, `postStartCommand`, base VS Code settings, base VS Code extensions (Claude, Gemini, GitLens, Prettier, ESLint)
  - Project config: `name`, `image`, `runArgs` (--shm-size, OrbStack labels, container name), `initializeCommand`, project-specific mounts (node_modules volume), project-specific env vars (CLAUDE_INSTANCE, PROJECT_NAME, NODE_OPTIONS, ENABLE_BMAD_ORCHESTRATOR), `portsAttributes`, VS Code extensions
  - **Lifecycle command constraint:** Per the devcontainer spec, `postCreateCommand` and `postStartCommand` use collected-list merge — all sources run in sequence. Do NOT set these in project config unless you want them to run *in addition to* the LABEL values.
  - **Mount conflict rule:** Per the devcontainer spec, mounts use collected-list merge with "last source wins" for same-target conflicts. Project configs must NOT mount to targets already defined in LABEL (`/shared-data`, `/workspaces/.pnpm-store`, `/home/node/.gitconfig`, `/home/node/.claude`, `/run/host-services/ssh-auth.sock`) — doing so would silently replace the LABEL mount.
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

**Ordering:** Tasks 1→2→3 are sequential (copy, then edit, then add LABEL). Tasks 4 and 5 are independent. Task 6 depends on Task 3 (LABEL content determines what's removed from project config) and Task 4 (image name). Task 7 depends on all prior tasks.

- [ ] **Task 1: Copy image files into `image/`**
  - Action: Copy from `claude-devcontainer` repo into this repo
  - Files to create:
    - `image/Dockerfile` — copy from `claude-devcontainer/image/Dockerfile`
    - `image/scripts/` — copy all 22 scripts from `claude-devcontainer/image/scripts/`
    - `image/scripts/__tests__/` — copy bats tests and fixtures
    - `image/hooks/` — copy all hooks, configs, and lib from `claude-devcontainer/image/hooks/`
    - `image/config/` — copy all 4 config files from `claude-devcontainer/image/config/`
    - `image/gemini/` — copy `settings.json` from `claude-devcontainer/image/gemini/`
  - Notes: Straight copy, no modifications. Verify all files present after copy. **COPY paths need no changes** — the source Dockerfile already uses `image/...` prefix paths (e.g., `COPY image/scripts/init-firewall.sh /usr/local/bin/`), which will resolve correctly with repo root as build context. Project-level files (`.devcontainer/allowed-domains.txt`, `.devcontainer/post-create-project.sh`) are NOT part of the image — they remain in the project and are consumed at runtime by image scripts.

- [ ] **Task 2: Surgical Dockerfile edits**
  - File: `image/Dockerfile`
  - Actions:
    1. **Remove UV installation:** Delete `RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR="/usr/local" sh`
    2. **Remove keystone-workflows COPY + postinstall:** Delete `COPY --chown=node:node packages/keystone-workflows ...` and `RUN /home/node/.local/lib/keystone-workflows/scripts/postinstall.sh` — `update-keystone.sh` handles install from GitHub
    3. **Remove claude-instance + bmad-orchestrator (combined block):** These are interleaved in a single block at the end of the Dockerfile. Delete ALL of the following:
       - `COPY packages/claude-instance/bin/claude-instance /usr/local/bin/claude-instance`
       - `COPY packages/bmad-orchestrator/scripts/ /usr/local/lib/bmad/`
       - The `RUN` block: `chmod 755 /usr/local/bin/claude-instance && ln -s /usr/local/lib/bmad/bmad-cli /usr/local/bin/bmad-cli && chmod 755 /usr/local/lib/bmad/bmad-cli`
       - **Warning:** These lines are adjacent. Delete the entire block — do not leave orphaned `ln -s` or `chmod` lines.
    4. **Verify fix-ssh-socket-permissions.sh:** Already present in copied scripts (added upstream). Verify COPY, chmod 755, and sudoers entry are in Dockerfile.
    5. **Verify post-create.sh:** Already updated upstream with SSH socket fix as step 1 of 13 total steps.
  - Notes: Build context is repo root. All `image/scripts/...` COPY paths remain valid.

- [ ] **Task 3: Add `devcontainer.metadata` LABEL**
  - File: `image/Dockerfile`
  - Action: Add LABEL in the root section of the Dockerfile (between the last `USER root` block and the final `USER node` line), containing:
    ```
    LABEL devcontainer.metadata='[ \
      { \
        "remoteUser": "node", \
        "containerUser": "node", \
        "capAdd": ["NET_ADMIN", "NET_RAW", "SYSLOG"], \
        "mounts": [ \
          "source=claude-devcontainer-shared-data,target=/shared-data,type=volume", \
          "source=pnpm-store,target=/workspaces/.pnpm-store,type=volume", \
          "source=${localEnv:HOME}/.gitconfig,target=/home/node/.gitconfig,type=bind,readonly", \
          "source=${localEnv:HOME}/.claude,target=/home/node/.claude,type=bind", \
          "source=/run/host-services/ssh-auth.sock,target=/run/host-services/ssh-auth.sock,type=bind" \
        ], \
        "containerEnv": { \
          "SSH_AUTH_SOCK": "/run/host-services/ssh-auth.sock", \
          "POWERLEVEL9K_DISABLE_GITSTATUS": "true", \
          "SHARED_DATA_DIR": "/shared-data", \
          "PNPM_HOME": "/pnpm", \
          "npm_config_store_dir": "/workspaces/.pnpm-store", \
          "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "true" \
        }, \
        "postCreateCommand": "/usr/local/bin/post-create.sh", \
        "postStartCommand": "tmux new-session -d -s main 2>/dev/null || true", \
        "customizations": { \
          "vscode": { \
            "settings": { \
              "terminal.integrated.defaultProfile.linux": "zsh" \
            }, \
            "extensions": [ \
              "Anthropic.claude-code", \
              "google.gemini-cli-vscode-ide-companion", \
              "eamodio.gitlens", \
              "esbenp.prettier-vscode", \
              "dbaeumer.vscode-eslint" \
            ] \
          } \
        } \
      } \
    ]'
    ```
  - Notes: `${localEnv:HOME}` is a validation gate — if it doesn't resolve in LABEL, move `.gitconfig` and `.claude` mounts to project config. `capAdd` is the devcontainer spec equivalent of `runArgs --cap-add`. `.claude` mount is writable (not `readonly`) because Claude Code writes session data, credentials, and config to `~/.claude`. **Whitespace note:** Dockerfile LABEL continuation may preserve whitespace and/or newlines in the stored value — the exact behavior depends on the Docker parser version. The stored JSON will still parse correctly (JSON ignores whitespace between tokens). Task 7 step 2 validates the stored value parses correctly. `PNPM_HOME=/pnpm` mirrors the Dockerfile's `ENV PNPM_HOME="/pnpm"` (line 50 of source Dockerfile) — `containerEnv` must match.
  - **Env vars intentionally omitted from old LABEL:**
    - `CLAUDE_CODE_VERSION` / `GEMINI_CLI_VERSION`: Omitted from LABEL — `post-create.sh` defaults to `latest` when unset, which is the desired behavior. Projects can override in their `containerEnv` if they need to pin a version.
    - `CLAUDE_CONFIG_DIR`: Omitted — Claude Code uses `~/.claude` by default, which is the standard location. Only needed if config dir differs from default.
    - `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`: **Include in LABEL `containerEnv`** as safe default (`"true"`). This was a security setting in the old LABEL that disables non-essential telemetry. Better to include and remove later if unnecessary than to omit and regress on security.

- [ ] **Task 4: Port CI/CD publish workflow**
  - File: `.github/workflows/publish-image.yml` (new)
  - Action: Adapt from `claude-devcontainer/.github/workflows/publish.yml`
  - Changes from source:
    1. Update trigger paths: `image/**` and `.github/workflows/publish-image.yml` (remove `packages/claude-instance/**` and `packages/bmad-orchestrator/**`)
    2. Update image name: Use `ghcr.io/${{ github.repository }}/devcontainer` (appends `/devcontainer` to distinguish the image from the repo itself). Update `.devcontainer/devcontainer.json` image reference to match.
    3. Keep multi-arch build (linux/amd64 + linux/arm64)
    4. Keep tagging strategy (latest on main, SHA, semver on release)
    5. Keep build args (TZ, GIT_DELTA_VERSION, ZSH_IN_DOCKER_VERSION)
    6. Check ACTIONLINT_VERSION: Dockerfile has `ARG ACTIONLINT_VERSION=1.7.10` as default. If CI passes it as build arg, keep it in workflow; if CI doesn't pass it, the Dockerfile default applies — either way is fine.
    7. Keep GitHub Actions cache (type=gha, mode=max)
  - Concurrency: Use group `publish-image` (distinct from existing `publish.yml`'s group) with `cancel-in-progress: false`
  - Permissions: `contents: read`, `packages: write`
  - Notes: Uses `GITHUB_TOKEN` — no external secrets needed. **Warning:** This repo already has `.github/workflows/publish.yml` for npm/changesets publishing — do not modify it. The new file is `publish-image.yml`, a separate workflow for Docker image publishing.

- [ ] **Task 5: Add `build:image` script to package.json**
  - File: `package.json`
  - Action: Add script `"build:image": "docker build -f image/Dockerfile -t claude-devcontainer:local ."`
  - Notes: Enables local image builds for testing. Build context is repo root.

- [ ] **Task 6: Slim down `.devcontainer/devcontainer.json`**
  - File: `.devcontainer/devcontainer.json`
  - Action: Remove everything now provided by the LABEL. Keep only project-specific overrides:
    ```jsonc
    {
      // Base config from image LABEL — run: docker inspect <image> | jq '.[0].Config.Labels["devcontainer.metadata"]'
      "name": "Agent Tools - ${localWorkspaceFolderBasename}",
      "image": "ghcr.io/<owner>/<repo>/devcontainer:latest",
      "initializeCommand": "bash -c 'touch ~/.gitconfig; mkdir -p ~/.claude'",  // prevents bind-mount failure; does NOT provide git identity — user must have pre-existing ~/.gitconfig
      "runArgs": [
        "--name=agenttools-${localWorkspaceFolderBasename}",
        "--shm-size=1gb",
        "--label=dev.orbstack.domains=${localWorkspaceFolderBasename}.agenttools.local",
        "--label=dev.orbstack.http-port=3000"
      ],
      "mounts": [
        "source=agent-tools-node-modules-${localWorkspaceFolderBasename},target=/workspaces/${localWorkspaceFolderBasename}/node_modules,type=volume"
      ],
      "containerEnv": {
        "CLAUDE_INSTANCE": "${localWorkspaceFolderBasename}",
        "PROJECT_NAME": "agent-tools",
        "NODE_OPTIONS": "--max-old-space-size=4096",
        "ENABLE_BMAD_ORCHESTRATOR": "true"  // NEW: enables BMAD stop hook (managed-settings.bmad.json) — was not in previous config
      },
      "portsAttributes": {
        "6006": { "onAutoForward": "ignore" }
      },
      "customizations": {
        "vscode": {
          "settings": {
            "window.title": "Agent Tools - ${containerEnv:CLAUDE_INSTANCE}${separator}${activeRepositoryBranchName}${dirty}",
            "terminal.integrated.defaultProfile.linux": "zsh",  // duplicated from LABEL as safety — VS Code settings merge is tool-defined, may shallow-replace
            "terminal.integrated.profiles.linux": {
              "zsh": { "path": "/bin/zsh" },
              "tmux": { "path": "/home/node/.local/bin/tmux-session" }
            },
            "geminicodeassist.agentYoloMode": true
          },
          "extensions": [
            "appulate.filewatcher",
            "bierner.markdown-mermaid",
            "bierner.markdown-footnotes",
            "bradlc.vscode-tailwindcss",
            "DavidAnson.vscode-markdownlint",
            "github.vscode-github-actions",
            "ms-playwright.playwright",
            "ms-vscode.live-server",
            "RobertOstermann.better-status-bar",
            "usernamehw.errorlens",
            "vitest.explorer",
            "yoavbls.pretty-ts-errors"
          ]
        }
      }
    }
    ```
  - Notes: If `${localEnv:HOME}` mounts fail in LABEL validation, add `.gitconfig` and `.claude` mounts back here. Remove `DEVPOD_WORKSPACE_ID` (deprecated). Remove `postCreateCommand` (comes from LABEL — lifecycle commands use collected-list merge, so adding it here would cause duplicate execution). Remove `remoteUser` (comes from LABEL). The minimal `initializeCommand` ensures bind-mount sources (`~/.gitconfig`, `~/.claude/`) exist on the host before container creation.

- [ ] **Task 7: Validate**
  - Action: Build image locally and test with this project
  - Steps:
    1. Run `pnpm build:image` to build locally
    2. Verify LABEL JSON is valid: `docker inspect claude-devcontainer:local | jq -r '.[0].Config.Labels["devcontainer.metadata"]' | jq .` — must parse as valid JSON
    3. Update `.devcontainer/devcontainer.json` image reference to `claude-devcontainer:local`
    4. Run `devcontainer up --workspace-folder .` (or rebuild in VS Code)
    5. Verify SSH: `ssh -T git@github.com` succeeds
    6. Verify git identity: `git config user.name` and `git config user.email` return values
    7. Verify hooks: `cat /etc/claude-code/managed-settings.json | jq '.hooks'` — confirm all 6 PreToolUse + 1 Stop hook registered
    8. Verify postCreateCommand ran: check post-create output in container logs; verify `sudo iptables -L -n` shows firewall rules (proves init-firewall.sh ran)
    9. Verify tmux: `tmux ls` shows a session (proves postStartCommand ran)
    10. Verify LABEL merge: `mount | grep -E '(shared-data|pnpm-store|\.gitconfig|\.claude|ssh-auth)'` — confirm all 5 LABEL mounts present
    11. Verify project overrides applied: `mount | grep node_modules` — confirms project-specific mount merged with LABEL mounts (not replaced)
    12. Verify keystone cold-start: `which keystone` and `ls /home/node/.local/lib/keystone-workflows/` — confirms `update-keystone.sh` successfully installed from GitHub without the COPY'd package
    13. Verify `containerEnv` merge: `env | grep -E '(SSH_AUTH_SOCK|SHARED_DATA_DIR|PNPM_HOME|npm_config_store_dir|CLAUDE_INSTANCE|PROJECT_NAME|ENABLE_BMAD_ORCHESTRATOR)'` — confirm all variables from both LABEL and project config are present
    14. **VS Code only:** Verify LABEL VS Code settings merge — open in VS Code, check that `terminal.integrated.defaultProfile.linux` is `zsh` (from LABEL) and `window.title` contains project name (from project config). If VS Code shallow-merges settings (replacing instead of deep-merging), move `defaultProfile.linux` back to project config.
    15. If `${localEnv:HOME}` mounts failed: move those mounts to project config, re-test
  - Bail condition: If LABEL merge doesn't work with devcontainer CLI, abandon LABEL approach and use comprehensive project devcontainer.json instead.
  - Notes: Also test with VS Code (Open Folder in Container) to confirm VS Code handles LABEL correctly. Pay special attention to array merge semantics — step 11 verifies that project `mounts` are additive to LABEL `mounts` (not replacing them).

### Acceptance Criteria

- [ ] AC 1: Given the image is built from `image/Dockerfile`, when a project specifies only `"image"` + project-specific overrides in its `devcontainer.json`, then `devcontainer up` creates a working container with all infrastructure defaults (SSH, git identity, hooks, firewall, tmux) applied from the LABEL.

- [ ] AC 2: Given a container created from the image, when running `ssh -T git@github.com`, then the SSH agent socket is accessible and authentication succeeds (assuming host SSH agent has keys).

- [ ] AC 3: Given a container created from the image and a host `~/.gitconfig` with identity configured, when running `git config user.name`, then the host's git identity is available (via mounted `.gitconfig`). Note: `initializeCommand` only ensures the file exists — it does not populate git identity.

- [ ] AC 4: Given a container created from the image, when Claude Code starts, then managed-settings.json contains all security hooks (prevent-main-push, prevent-no-verify, prevent-admin-flag, prevent-env-leakage, prevent-bash-sensitive-args, prevent-sensitive-files).

- [ ] AC 5: Given a push to the `main` branch modifying files under `image/**`, when the CI workflow triggers, then a multi-arch Docker image (amd64 + arm64) is built and pushed to GHCR with `latest` + SHA tags.

- [ ] AC 6: Given a GitHub release is published, when the CI workflow triggers, then the image is tagged with the semver version (e.g., `1.0.0`, `1.0`).

- [ ] AC 7: Given this project's `.devcontainer/devcontainer.json` contains only project-specific overrides (no duplicated infrastructure defaults), when `devcontainer up` runs, then the merged config includes both LABEL defaults and local overrides.

- [ ] AC 8: Given the Dockerfile does not contain COPY lines for `claude-instance`, `bmad-orchestrator`, or `keystone-workflows`, when the image builds, then the build succeeds without errors.

- [ ] AC 9: Given the Dockerfile does not install UV, when the image builds, then Python 3 is still available (from node:22 base) and hook scripts execute correctly.

- [ ] AC 10: Given a container created from the image, when `postStartCommand` executes, then `tmux ls` shows an active session (verifies LABEL `postStartCommand` is honored).

- [ ] AC 11: Given the image is built locally via `pnpm build:image`, then the Docker build completes without errors.

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
