# Live-Linked Skills: Implementation Plan

**Origin:** Brainstorming session 2026-03-04 — AI-first workflow orchestration
**Experiment Goal:** Validate that making skills instantly editable and live across all environments changes behavior — do you actually create and iterate on rules/skills more when friction drops to "edit a file"?
**Success Criteria:** Over the next few weeks, you find yourself writing/modifying skills that you previously would have dealt with manually.

---

## Architecture Overview

```
HOST (~/.agent-env/repo — mono-repo checkout)
  └── skills/
      ├── superpowers/            (consolidated from zookanalytics/superpowers fork)
      │   ├── brainstorming/SKILL.md
      │   ├── test-driven-development/SKILL.md
      │   ├── systematic-debugging/SKILL.md
      │   └── ...
      └── bmad/
          └── story-creation/SKILL.md

CONTAINER (any project)
  └── /agent-env-repo/               (bind mount of ~/.agent-env/repo)
      └── skills/...
  └── ~/.claude/skills/               (symlinks → /agent-env-repo/skills/...)
  └── ~/.gemini/skills/               (symlinks → /agent-env-repo/skills/...)
  └── ~/.codex/skills/                (symlinks → /agent-env-repo/skills/...)
```

**Key properties:**
- `~/.agent-env/repo` is a real git checkout — agents can modify, commit, and push
- Bind mount means edits are instant — no sync, no rebuild, no deploy
- Symlinks into agent-specific directories make skills discoverable by Claude, Gemini, and Codex
- When working IN the mono-repo itself, the workspace and the mount may be the same checkout or separate; either works

---

## Implementation Steps

### Step 1: Create skills directory structure in mono-repo

Create the directory structure and a consolidation script.

**Files to create:**
- `skills/` — root skills directory
- `skills/README.md` — brief explanation of the live-linked skills model
- `scripts/sync-skills.sh` — pulls skills from the superpowers fork (and potentially other sources) into `skills/superpowers/`

**Consolidation script logic:**
1. Clone or pull `git@github.com:zookanalytics/superpowers.git` into a temp directory
2. Copy `skills/` subdirectories into `skills/superpowers/` in the mono-repo
3. Preserve SKILL.md files and any supporting directories (scripts/, references/, etc.)
4. Script is idempotent — safe to re-run to pull upstream changes
5. **Safeguard:** Script should warn or skip if local modifications exist in `skills/superpowers/` to prevent overwriting local iterations.

**Note:** This is a one-way pull. Local modifications to superpowers skills stay local. Upstream sync is a conscious `./scripts/sync-skills.sh` invocation, not automatic.

### Step 2: Create BMAD story-creation skill

Create `skills/bmad/story-creation/SKILL.md` — a cross-platform skill (Agent Skills standard) focused on:
- Taking a product brief or idea and producing well-structured user stories
- Guided elicitation when requirements are vague
- Outputting stories in a consistent format with acceptance criteria
- Referencing project-local config if present (e.g., story templates, definition of done)

**This is the skill you'll iterate on most** — it's the canary for whether live-linked editing actually changes your behavior.

### Step 3: Update init-host.sh — ensure ~/.agent-env/repo exists

Add to `packages/agent-env/config/baseline/init-host.sh`:

```bash
# Ensure agent-env repo checkout exists for live-linked skills
AGENT_ENV_REPO="$HOME/.agent-env/repo"
if [ ! -d "$AGENT_ENV_REPO" ]; then
  echo "agent-env: Warning: ~/.agent-env/repo not found."
  echo "agent-env: Clone the mono-repo to enable live-linked skills:"
  echo "  git clone git@github.com:zookanalytics/bmad-orchestrator-ideation.git $AGENT_ENV_REPO"
fi
```

**Decision: warn, don't auto-clone.** The first-time setup requires a conscious `git clone`. After that, it's there forever. Auto-cloning would hide the setup step and could surprise users.

### Step 4: Add mount to Dockerfile LABEL metadata

Add to the mounts array in the Dockerfile LABEL:

```
"source=${localEnv:HOME}/.agent-env/repo,target=/agent-env-repo,type=bind"
```

This makes the mono-repo available at `/agent-env-repo` inside every container, read-write.

### Step 5: Add mount to agent-env baseline devcontainer.json

Add to `packages/agent-env/config/baseline/devcontainer.json` mounts array:

```json
"source=${localEnv:HOME}/.agent-env/repo,target=/agent-env-repo,type=bind"
```

**Note:** Both the Dockerfile LABEL and the baseline config need the mount. The LABEL provides it for image-based devcontainer creation; the baseline provides it for agent-env managed instances. The devcontainer-merge pipeline handles deduplication.

### Step 6: Add post-create step for skill symlinks

Add a new step to `image/scripts/post-create.sh` (after Step 8, before Step 9):

```bash
# Step 8.5: Link live skills from agent-env repo
echo ""
echo "[Step 8.5] Linking live skills from agent-env repo..."
SKILLS_SOURCE="/agent-env-repo/skills"
if [ -d "$SKILLS_SOURCE" ]; then
  # Create skills directories for each agent platform
  mkdir -p "$HOME/.claude/skills" "$HOME/.gemini/skills" "$HOME/.codex/skills"

  # Symlink each skill package into all three platforms
  for skill_dir in "$SKILLS_SOURCE"/*/; do
    if [ -d "$skill_dir" ]; then
      category=$(basename "$skill_dir")
      for skill in "$skill_dir"*/; do
        if [ -f "$skill/SKILL.md" ]; then
          skill_name=$(basename "$skill")
          link_name="${category}-${skill_name}"
          ln -sfn "$skill" "$HOME/.claude/skills/$link_name"
          ln -sfn "$skill" "$HOME/.gemini/skills/$link_name"
          ln -sfn "$skill" "$HOME/.codex/skills/$link_name"
          echo "  ✓ Linked: $link_name"
        fi
      done
    fi
  done
  echo "✓ Live skills linked"
else
  echo "⚠ No agent-env repo found at $SKILLS_SOURCE — skipping live skills"
  echo "  Clone mono-repo to ~/.agent-env/repo to enable live-linked skills"
fi
```

**Key behaviors:**
- Non-blocking — if repo isn't mounted, container still starts fine
- Symlinks, not copies — edits to `/agent-env-repo/skills/...` are immediately visible
- Naming convention: `{category}-{skill_name}` prevents collisions (e.g., `superpowers-brainstorming`, `bmad-story-creation`)
- **Structure Enforcement:** Only links directories following the `category/skill/SKILL.md` pattern.
- Runs once at container creation, but symlinks point to live mount so content changes are instant

### Step 7: Verify multi-platform skill discovery

Manual verification checklist:
- [ ] `claude /skills` lists the linked skills
- [ ] Gemini CLI discovers skills in `~/.gemini/skills/`
- [ ] Codex CLI discovers skills in `~/.codex/skills/`
- [ ] Modifying a SKILL.md in `/agent-env-repo/skills/` is immediately reflected
- [ ] `cd /agent-env-repo && git add && git commit` works from inside a container

---

## What This Does NOT Include (Deliberately)

- No rule database (JSONL, SQLite, Beads) — files are the store for now
- No template injection system — direct skill editing, not rule overlays
- No execution loop or bead orchestration — that's a future experiment
- No UI or visualization — CLI only
- No feedback/effectiveness tracking — manual observation for now

These are future experiments gated on Assumption A being validated.

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Mount fails if repo not cloned | init-host.sh warns; post-create.sh degrades gracefully |
| Symlink naming collisions | `{category}-{skill_name}` convention prevents this |
| Agent modifies skill and creates merge conflict | Same as any shared git resource — normal git workflow |
| Skills directory grows too large for agent context | Agent Skills standard limits: agents load SKILL.md on demand, not all at once |
| Superpowers fork diverges from upstream | sync-skills.sh is manual — conscious pull, diff, decide |

---

## Implementation Order

1. **Step 1** — Create `skills/` directory and consolidation script
2. **Step 2** — Create BMAD story-creation skill
3. **Steps 3-6** — Infrastructure changes (init-host, Dockerfile, baseline config, post-create) — these must be implemented sequentially to ensure configuration consistency.
4. **Step 7** — Verify end-to-end

Steps 1-2 are immediately useful even before the infrastructure changes — you can manually symlink skills in your current environment to start iterating today.
