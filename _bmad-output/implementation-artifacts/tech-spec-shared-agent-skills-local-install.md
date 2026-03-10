---
title: 'Shared Agent Skills via Local Path Installation'
slug: 'shared-agent-skills-local-install'
created: '2026-03-06'
status: 'in-progress'
stepsCompleted: [1, 2, 3]
tech_stack:
  - 'skills.sh CLI (npx skills add, v1.4.4+)'
  - 'SKILL.md format (Vercel skills.sh standard)'
  - 'Docker volume (agent-devcontainer-shared-data)'
  - 'Shell scripts (bash, set -euo pipefail)'
  - 'Devcontainer lifecycle (postCreateCommand, postStartCommand)'
  - 'Git (SSH clone via agent socket)'
files_to_modify:
  - 'image/scripts/post-create.sh'
  - 'image/Dockerfile'
  - 'image/scripts/install-shared-skills.sh'
  - 'image/scripts/devcontainer-sanity-check.sh'
  - 'image/config/allowed-domains.txt'
code_patterns:
  - 'Scripts in image/scripts/, COPY to /usr/local/bin/'
  - 'Echo-based step progress with numbered steps'
  - 'Graceful failure with warnings for optional tooling'
  - 'set -euo pipefail in all scripts'
  - 'Pattern match: register-plugin-marketplaces.sh'
test_patterns:
  - 'Integration testing via container runs'
  - 'devcontainer-sanity-check.sh for post-setup validation'
  - 'FAIL_AT_STEP pattern for rollback testing (setup-instance-isolation.sh)'
---

# Tech-Spec: Shared Agent Skills via Local Path Installation

**Created:** 2026-03-06

## Overview

### Problem Statement

No shared set of general-purpose skills is available across all agent-env instances. Each repo/instance operates in isolation with no common skill library. When skills are developed or updated, there is no mechanism to distribute them to all running containers.

### Solution

Create a new private git repo (`zookanalytics/agent-skills`) containing general-purpose SKILL.md files. Make it available at a shared filesystem location inside the container. Run `npx skills add <path> -g --all` on every container start/attach to install and refresh skills for all supported agent platforms (41+ agents including Claude Code, Gemini CLI, Codex CLI).

### Scope

**In Scope:**
- New private repo structure (`zookanalytics/agent-skills`) with SKILL.md format
- Shared filesystem strategy for making the repo available inside containers
- Integration with agent-env container lifecycle to run `npx skills add` on attach
- Global installation (`-g`) so skills apply across all repos in every instance
- Mechanism to keep skills fresh (re-run on every attach)

**Out of Scope:**
- Migrating existing superpowers/git-workflow plugins to this system
- Public distribution or npm publishing
- Writing actual skill content (just the infrastructure)
- Replacing the existing plugin marketplace system (`register-plugin-marketplaces.sh`)

## Context for Development

### Codebase Patterns

- Scripts live in `image/scripts/`, get COPY'd to `/usr/local/bin/` in Dockerfile, and chmod'd 755
- All scripts use `set -euo pipefail` header
- Progress output uses `echo "[Step N] Description..."` followed by `echo "✓ Step complete"`
- Optional/non-critical steps use graceful failure with `⚠` warnings rather than hard exits
- `register-plugin-marketplaces.sh` is the closest pattern match — external tool registration during post-create
- Shared data directory at `/shared-data/` with subdirectories per concern (`claude/`, `gemini/`, `gh/`)
- First-time bootstrapping pattern: check if exists, create if not (see `setup-instance-isolation.sh`)
- Devcontainer LABEL metadata in Dockerfile defines `postCreateCommand` (once) and `postStartCommand` (every start)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `image/scripts/post-create.sh` | 13-step container init — new skills step goes here |
| `image/scripts/register-plugin-marketplaces.sh` | Closest pattern match — external tool registration |
| `image/scripts/setup-instance-isolation.sh` | `/shared-data/` bootstrapping pattern to follow |
| `image/Dockerfile` | COPY scripts, chmod, LABEL with postStartCommand |
| `image/scripts/devcontainer-sanity-check.sh` | Validation step — may need skills check added |
| `image/config/allowed-domains.txt` | Firewall allowlist — skills.sh domain may be needed for npx |

### Technical Decisions

- **Installation mechanism:** `npx skills add <path> -g --all` (local path, global install, all skills and agents)
- **Freshness strategy:** Re-run `npx skills add` on every container attach/start to pick up new skills and edits
- **Remote sync:** `git pull --ff-only` before `npx skills add` to pick up remote commits
- **Source format:** SKILL.md with YAML frontmatter per skills.sh standard
- **Repo:** Private `zookanalytics/agent-skills` (already created, empty)
- **skills.sh behavior:** Copies files to `.agents/skills/` canonical location, symlinks per-agent directories. Does NOT symlink back to source, hence re-run needed for updates.
- **postStartCommand chaining:** Use `;` separator (not `&&`) so skills refresh failure doesn't block container start

### ADR: Filesystem Strategy — Docker Volume (Option B)

**Decision:** Skills repo lives inside the existing shared Docker volume (`agent-devcontainer-shared-data`) at `/shared-data/agent-skills/`.

**Context:** Two options evaluated — host-level git checkout with bind mount (Option A) vs git clone inside the shared Docker volume (Option B).

**Rationale:**
- Follows the established `/shared-data/*` pattern used by Claude credentials, Gemini config, and GitHub CLI config
- Self-bootstrapping: first container clones the repo, subsequent containers find it already present
- No host prerequisites — containers are self-contained
- No UID/permission mapping issues (volume owned by container user)
- Git operations (commit, push, pull) work from any container (SSH keys already available via agent socket)
- Host-side convenience tooling (Option C) can be added later if needed without changing the underlying strategy

**Rejected:** Option A (host bind mount) — requires host-level clone step, UID mapping risks, couples container to host state
**Noted:** Option C (hybrid with host convenience) — valid future enhancement, not needed now

## Implementation Plan

### Tasks

- [x] Task 1: Create `install-shared-skills.sh` script
  - File: `image/scripts/install-shared-skills.sh` (NEW)
  - Action: Create a bash script that handles both initial clone and refresh of shared skills
  - Script logic:
    1. Header: `set -euo pipefail`
    2. Accept optional `SHARED_DATA` path (default: `${SHARED_DATA_DIR:-/shared-data}`)
    3. Set `SKILLS_REPO_DIR="$SHARED_DATA/agent-skills"`
    4. Set `SKILLS_REPO_URL="git@github.com:zookanalytics/agent-skills.git"`
    5. **If `$SKILLS_REPO_DIR` does not exist:** use `flock` on `$SHARED_DATA/.agent-skills-clone.lock` to prevent concurrent clone races, then double-check inside the lock. Clone via `git clone "$SKILLS_REPO_URL" "$SKILLS_REPO_DIR"` (full clone, no `--depth` flag).
    6. **If `$SKILLS_REPO_DIR` exists:** run `git -C "$SKILLS_REPO_DIR" pull --ff-only` to sync remote changes
    7. Run `npx skills add "$SKILLS_REPO_DIR" -g --all` to install/refresh all skills for all agents
    8. All steps use graceful failure (warnings, not hard exits) — wrap git and npx calls in `if ! ...; then echo "⚠ ..."; fi`
    9. Echo-based progress output matching existing patterns
  - Notes: Model after `register-plugin-marketplaces.sh` — similar scope, similar failure tolerance. Script should work both during post-create (initial clone + install) and postStartCommand (pull + refresh). Uses flock pattern from `setup-instance-isolation.sh` credential promotion for clone race safety.

- [x] Task 2: Add new step to `post-create.sh`
  - File: `image/scripts/post-create.sh`
  - Action: Add a new step between current Step 8 (register plugin marketplaces) and Step 9 (start dnsmasq). This positions it after SSH setup (Step 2) and CLI tool installation (Step 7) but before firewall init (Step 11), ensuring network access for git clone and npx.
  - Change: Insert new step. Renumber subsequent steps (9→10, 10→11, 11→12, 12→13, 13→14).
  - Content:
    ```bash
    # Step 9: Install shared agent skills
    echo ""
    echo "[Step 9] Installing shared agent skills..."
    if /usr/local/bin/install-shared-skills.sh; then
      echo "✓ Shared agent skills installed"
    else
      echo "⚠ Shared agent skills installation had issues (see above)"
    fi
    ```
  - Notes: Must come after Step 7 (CLI tools installed, so `npx` is available) and after Step 8 (plugin marketplaces registered). Must come before Step 12 (firewall init, was Step 11) to allow git clone network access on first run. Update the existing Step 8 comment (`# NOTE: Must run BEFORE firewall init (step 11)`) to reference the new step number (step 12).

- [x] Task 3: Update Dockerfile — COPY script and update LABEL
  - File: `image/Dockerfile`
  - Action A: Add COPY line for the new script alongside other script COPY statements (~line 172-188):
    ```dockerfile
    COPY image/scripts/install-shared-skills.sh /usr/local/bin/
    ```
  - Action B: Add chmod line alongside other chmod statements (~line 191-223):
    ```dockerfile
    chmod 755 /usr/local/bin/install-shared-skills.sh && \
    ```
  - Action C: Update `postStartCommand` in the LABEL metadata (~line 275) to include skills refresh:
    ```
    "postStartCommand": "sudo /usr/local/bin/start-sshd.sh; tmux new-session -d -s main 2>/dev/null || true; /usr/local/bin/install-shared-skills.sh >> /tmp/install-shared-skills.log 2>&1 || true"
    ```
  - Notes: Use `;` separator and `|| true` so skills refresh failure never blocks container start. Redirect output to log file (`/tmp/install-shared-skills.log`) for debuggability rather than `/dev/null`.

- [ ] Task 4: Initialize `zookanalytics/agent-skills` repo (manual — external repo)
  - Repo: `zookanalytics/agent-skills` (exists on GitHub, currently empty)
  - Action: Push initial structure:
    ```
    agent-skills/
    ├── README.md
    ├── .gitignore
    └── skills/
        └── .gitkeep
    ```
  - Notes: Minimal skeleton. README should document the repo purpose and how skills are installed. `.gitkeep` ensures the `skills/` directory is tracked. Actual skill content is out of scope for this spec.

### Acceptance Criteria

- [ ] AC 1: Given a fresh container with no `/shared-data/agent-skills/` directory, when `post-create.sh` runs, then the `zookanalytics/agent-skills` repo is cloned to `/shared-data/agent-skills/` and `npx skills add` runs successfully.

- [ ] AC 2: Given `/shared-data/agent-skills/` already exists with skills from a previous container, when a new container runs `post-create.sh`, then `git pull --ff-only` fetches latest changes and `npx skills add` refreshes the installed skills.

- [ ] AC 3: Given a container restarts (postStartCommand runs), when `install-shared-skills.sh` executes, then skills are refreshed from the existing local repo without requiring network access for the skills CLI.

- [ ] AC 4: Given the git clone fails (network issue, SSH key not available), when `install-shared-skills.sh` runs, then it logs a `⚠` warning and returns success (does not block container setup).

- [ ] AC 5: Given the skills repo contains SKILL.md files in `skills/` subdirectories, when `npx skills add -g --all` completes, then skills are available in `~/.claude/skills/`, `~/.gemini/skills/`, and other agent skills directories.

- [ ] AC 6: Given the skills repo is empty (no SKILL.md files), when `install-shared-skills.sh` runs, then it completes without error.

- [ ] AC 7: Given `install-shared-skills.sh` fails during postStartCommand, when the container starts, then sshd and tmux still start successfully (non-blocking chaining).

## Additional Context

### Dependencies

- `npx skills` (skills.sh CLI, v1.4.4+) — available via npx, no pre-install needed (firewall allows npm registry)
- `zookanalytics/agent-skills` private GitHub repo (exists, empty)
- SSH agent socket (for git clone of private repo) — configured in post-create Step 1-2
- `git` — installed in Docker image
- agent-env container lifecycle hooks (`postCreateCommand`, `postStartCommand`)

### Testing Strategy

- **Manual integration testing:** Rebuild container, verify clone happens on first create, verify refresh on restart
- **Verification commands:**
  - `ls /shared-data/agent-skills/` — repo exists
  - `ls ~/.claude/skills/` — skills installed for Claude
  - `ls ~/.gemini/skills/` — skills installed for Gemini
  - `git -C /shared-data/agent-skills/ log --oneline -1` — repo is cloned and has history
- **Failure testing:** Temporarily remove SSH key access, verify graceful failure with warning
- **Sanity check:** Optionally add skills verification to `devcontainer-sanity-check.sh` in a follow-up

### Notes

- `npx skills update` does NOT work with local sources — must use `npx skills add` each time
- `npx skills add` discovers all SKILL.md files in standard locations (`skills/`, `.agent/skills/`, etc.) up to 5 levels deep
- Global install (`-g`) places skills at user level, applying to all repos
- The `--all` flag skips interactive prompts, installing all discovered skills for all agents
- Step renumbering in `post-create.sh` affects all steps after the insertion point (9→10 through 13→14). Also update the Step 8 comment that references "step 11" (firewall) to say "step 12"
- Future enhancement: add skills status to `devcontainer-sanity-check.sh`
- Future enhancement: host-side convenience tooling (Option C from ADR)

## Review Notes

- Adversarial review (2026-03-09) identified several issues.
- Findings: 8 total (2 High, 4 Medium, 2 Low).
- Resolution approach: auto-fix applied for code and documentation gaps.
- Fixed: missing files in File List (F1), missing skills.sh domains in firewall (F2), missing sanity check (F3), script robustness improvements (F5).
- Pending: Verification of AC 4 & AC 7 (requires container testing environment), Task 4 (initialize zookanalytics/agent-skills repo - manual external step).
