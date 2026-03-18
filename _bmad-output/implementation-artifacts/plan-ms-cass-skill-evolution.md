# Plan: Skill Evolution with ms + CASS

## Goal

Continuously improve agent skills based on real usage data. Skills get better automatically from conversation history and feedback, not just when a human manually edits them.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    agent-skills repo                     │
│              (source of truth: SKILL.md files)           │
└──────────┬──────────────────────────────┬───────────────┘
           │                              │
     git pull (read)              git commit+push (write)
           │                              │
           ▼                              │
┌──────────────────┐           ┌──────────┴───────────┐
│   ms index       │           │   ms build --from-cass│
│   (on start)     │           │   (periodic/cron)     │
└────────┬─────────┘           └──────────┬────────────┘
         │                                │
         ▼                                │
┌──────────────────────────────────────────────────────┐
│                    ms (Meta Skill)                     │
│  SQLite + Git archive, search, feedback, experiments  │
│  MCP server: search, load, suggest, feedback          │
└────────┬──────────────────────────────────────────────┘
         │
    ms load / MCP                   cass index
         │                              │
         ▼                              ▼
┌──────────────────┐           ┌──────────────────┐
│   Agent session   │──────────▶│      CASS        │
│   (Claude, etc.)  │  records  │  (session index) │
└──────────────────┘           └──────────────────┘
         │
    npx skills add
    (multi-agent distribution)
         │
         ▼
┌──────────────────┐
│  ~/.claude/skills │
│  ~/.gemini/skills │
│  ~/.codex/skills  │
└──────────────────┘
```

### Key design decisions

1. **agent-skills repo stays the source of truth.** ms indexes from it, writes improved skills back to it. The repo is the durable, portable, Git-versioned store that all containers share.

2. **npx skills add stays for multi-agent distribution.** It handles the per-agent directory layout that Claude Code, Gemini CLI, Codex, etc. each expect. ms doesn't replace this — it adds the evolution layer on top.

3. **ms owns the intelligence.** Feedback tracking, experiment A/B testing, bandit-based suggestions, quality scoring, pattern mining. The repo has the files; ms has the metadata.

4. **CASS is the session memory.** Indexes conversation history from all agents. ms mines CASS sessions to extract patterns and generate skill improvements.

5. **Skills are always plain SKILL.md files.** ms writes them to its Git archive as markdown. No proprietary format, no lock-in. The flow back to the repo is a file copy + git commit.

## Infrastructure Changes

### Dockerfile additions

```dockerfile
# Already done: Trixie base, Rust toolchain, build deps
FROM node:22-trixie
# ... existing setup ...

# Build ms from source (as node user)
RUN git clone https://github.com/Dicklesworthstone/meta_skill.git /tmp/meta_skill && \
    cd /tmp/meta_skill && cargo build --release && \
    cp target/release/ms /home/node/.cargo/bin/ms && \
    rm -rf /tmp/meta_skill

# Build CASS from source (as node user)
RUN git clone https://github.com/Dicklesworthstone/coding_agent_session_search.git /tmp/cass && \
    cd /tmp/cass && cargo build --release && \
    cp target/release/cass /home/node/.cargo/bin/cass && \
    rm -rf /tmp/cass
```

**Note:** Build from source ensures ms and CASS stay in sync. Pre-built CASS binaries may drift from the API that ms expects. Total build time: ~11 min (3 min ms + 8 min CASS).

**Alternative:** Pin specific git commits/tags in the clone to get reproducible builds. Update the pins when upgrading.

### Firewall domain additions (already done)

- `static.rust-lang.org`, `crates.io`, `static.crates.io`, `index.crates.io`
- `cdn.pyke.io` (ONNX Runtime for CASS)

### ms CASS client patches (until upstreamed)

Three patches needed in ms to work with CASS v0.2.2+:

1. **Search format** — `src/cass/client.rs`: map `hits` → `matches`, adapt field names
2. **Session export** — `src/cass/client.rs`: use `cass export --format json` instead of `cass show`, transform raw message array to Session struct
3. **Build path** — `src/cli/commands/build.rs`: pass `session_match.path` instead of `session_match.session_id`

These are surgical, well-tested patches. Options: maintain a fork, carry patches in a build script, or PR upstream.

## Workflow Changes

### install-shared-skills.sh — adapted

The existing script gets two new steps after the `npx skills add`:

```bash
# Step 2 (existing): Install skills for all agents via npx
npx --yes skills@1 add "$SKILLS_REPO_DIR" -g --all

# Step 3 (new): Index skills into ms for search/feedback/evolution
echo "  Indexing skills into ms..."
if command -v ms &>/dev/null; then
  ms init 2>/dev/null || true
  if ! ms index "$SKILLS_REPO_DIR/skills"; then
    echo "  ⚠ ms index failed"
  else
    echo "  ✓ Skills indexed in ms"
  fi
else
  echo "  ⚠ ms not installed, skipping skill indexing"
fi

# Step 4 (new): Index session history into CASS
echo "  Indexing session history into CASS..."
if command -v cass &>/dev/null; then
  if ! cass index --full 2>/dev/null; then
    echo "  ⚠ CASS index failed"
  else
    echo "  ✓ Session history indexed"
  fi
else
  echo "  ⚠ CASS not installed, skipping session indexing"
fi
```

### MCP server setup

Add to postStartCommand or as a background daemon:

```bash
# Start ms MCP server for Claude Code integration
ms mcp serve &
```

And configure Claude Code to use it. Since `ms setup --claude-code` has a bug (skips config), manually add to `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "ms": {
      "command": "ms",
      "args": ["mcp", "serve"]
    }
  }
}
```

This gives Claude Code native MCP tools: `search`, `load`, `suggest`, `feedback`.

### Feedback collection

Two approaches, not mutually exclusive:

**A. Hook-based (automatic):** Add a Claude Code hook that calls `ms feedback` after each skill invocation. When the Skill tool is called, a post-hook records which skill was loaded. When the session ends successfully, record a positive outcome.

**B. Agent-driven (via MCP):** The `using-superpowers` skill instructs agents to call the `feedback` MCP tool after using a skill. This is more flexible but depends on the agent actually following through.

### Skill evolution cycle

A periodic job (cron, `/loop`, or manual trigger) runs the improvement cycle:

```bash
#!/bin/bash
# evolve-skills.sh — run periodically to improve skills from session data

SKILLS_REPO_DIR="/shared-data/agent-skills"

# 1. Refresh CASS index with latest sessions
cass index --full

# 2. For each skill, check if there's enough feedback to improve
for skill_dir in "$SKILLS_REPO_DIR"/skills/*/; do
  skill_name=$(basename "$skill_dir")

  # Mine sessions related to this skill's domain
  ms build --from-cass "$skill_name" \
    --auto \
    --name "${skill_name}-improved" \
    --min-sessions 3 \
    --min-patterns 5 \
    --min-confidence 0.7 \
    --generalize llm \
    -o "/tmp/ms-evolution/$skill_name" \
    2>/dev/null

  # If build succeeded, create an experiment
  if [ -f "/tmp/ms-evolution/$skill_name/SKILL.md" ]; then
    echo "Improved variant generated for $skill_name"
    # Could auto-create experiment, or stage for human review
  fi
done

# 3. Check experiments that have enough data to conclude
# (future: ms experiment auto-conclude)
```

**LLM synthesis note:** The `--generalize llm` flag needs an API key. Configure via:
```bash
ms config search.api_key_env "ANTHROPIC_API_KEY"  # or OPENAI_API_KEY
ms config search.api_model "claude-sonnet-4-5-20250514"
```

## Phased Rollout

### Phase 1: ms as skill index (low risk, immediate value)

- Add ms to Dockerfile
- Update `install-shared-skills.sh` to run `ms index` after `npx skills add`
- Skills served via both npx (file-based) and ms (search/load)
- No CASS yet, no feedback yet
- **Value:** Hybrid search across all skills, token-budgeted loading, quality scoring

### Phase 2: Feedback collection (medium effort)

- Configure MCP server for Claude Code
- Add feedback hook or update `using-superpowers` skill to call `ms feedback`
- Record outcomes per skill usage
- **Value:** Data accumulation — every skill use generates a signal

### Phase 3: CASS + session mining (higher effort)

- Add CASS to Dockerfile
- Update `install-shared-skills.sh` to run `cass index`
- Apply the 3 ms patches for CASS compatibility
- Run `ms build --from-cass` manually to validate pattern extraction
- **Value:** Mine real sessions for skill improvement patterns

### Phase 4: Automated evolution (full flywheel)

- Set up periodic `evolve-skills.sh` runs
- Configure LLM synthesis for skill generation
- Wire up `ms experiment` for A/B testing variants
- Auto-commit improved skills back to agent-skills repo
- **Value:** Skills improve automatically from usage

## Skill Format Migration

### Current superpowers/git-workflow skills

Already proper SKILL.md format — index directly with `ms index <path>`.

### git-workflow commands (the heavy ones)

These need conversion from command format to SKILL.md:
- `orchestrate.md` (506 lines) — state machine for full PR lifecycle
- `cleanup.md` (304 lines) — branch cleanup workflow
- `create-pull-request.md` (279 lines) — PR creation
- `merge-pull-request.md` (252 lines) — merge workflow
- `receiving-code-review.md` (229 lines) — review processing

Conversion requires adding proper frontmatter (`name`, `description`) and ensuring the content structure works as a skill (not just a command prompt). The `commit.md` command is already a thin wrapper and doesn't need separate conversion.

### ms import for conversion

`ms import <file> --lint --fix` can help with conversion — it classifies content blocks (rules, examples, pitfalls, checklists) and generates structured SKILL.md. Use `--dry-run --verbose-signals` first to preview.

## Decision: ms root lives in agent-skills repo

The agent-skills repo (`/shared-data/agent-skills/`) is the ms root. Run `ms init` there so `.ms/` (SQLite, Git archive, feedback, experiments) lives alongside the skills it tracks.

```
/shared-data/agent-skills/
├── .ms/                    # ms state (SQLite, archive, config)
│   ├── archive/            # Git archive of indexed skills
│   ├── ms.db               # SQLite (search index, feedback, experiments)
│   └── config.toml         # ms config
├── skills/                 # Source SKILL.md files
│   ├── creating-commits/
│   ├── systematic-debugging/
│   └── ...
├── .gitignore              # Ignore .ms/ms.db (derived), keep .ms/archive/
└── README.md
```

**Why this works:**
- Shared across all containers via Docker volume (already synced on start)
- Feedback and experiment data accumulate across container lifetimes
- Git-versioned: evolved skills get committed, pulled by other containers
- `ms index` on start rebuilds SQLite from files if needed (SQLite is a cache)
- No separate sync mechanism needed — the existing git pull/push handles it

**What to .gitignore:**
- `.ms/ms.db` — derived from SKILL.md files, rebuilt by `ms index`
- `.ms/archive/` — mirrors the skills/ directory, not needed in repo

**What to keep in Git:**
- `skills/` — the source SKILL.md files (source of truth)
- `.ms/config.toml` — shared ms configuration (search weights, bandit params, etc.)

The `install-shared-skills.sh` script becomes:

```bash
# Step 2: Index skills into ms (from within the agent-skills repo)
cd "$SKILLS_REPO_DIR"
ms init 2>/dev/null || true
ms index "$SKILLS_REPO_DIR/skills"
```

And the evolution cycle writes improved skills directly into `$SKILLS_REPO_DIR/skills/`, commits, and pushes — other containers pick them up on next `git pull`.

## Open Questions

1. **LLM for synthesis:** Use Claude API (already available) or OpenAI (ms default)? May need to check if ms supports Anthropic API for `--generalize llm`.

2. **Experiment lifecycle:** Who concludes experiments? An automated job that checks p-values, or human review? ms has `experiment status` with significance analysis but no auto-conclude yet.

3. **Feedback granularity:** Per-skill-invocation feedback vs per-session outcome? Both are supported (`ms feedback` vs `ms outcome`) but the hook/automation differs.

4. **CASS Gemini support:** `cass export` can't parse Gemini sessions (confirmed bug in CASS). Only Claude Code sessions are mineable currently. Worth filing upstream.
