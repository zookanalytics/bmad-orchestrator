---
date: '2026-03-02'
author: Node
research_type: 'design'
research_topic: 'Cross-Platform AI Agent Skill Distribution'
research_goals: 'Determine how to distribute development process skills across Claude Code, Gemini CLI, and Codex CLI from a single source of truth'
web_research_enabled: true
source_verification: true
---

# Cross-Platform AI Agent Skill Distribution

**Date:** 2026-03-02
**Type:** Design — Architecture Decision Record

---

## Problem

We need to distribute development process skills (code review policies, commit conventions, testing standards, doc-sync verification) across three AI coding CLIs — Claude Code, Gemini CLI, and Codex CLI — from a single source of truth. This must work across multiple repositories, since the skills are part of a framework applied to many projects.

## Decision

**Use [Vercel skills.sh](https://github.com/vercel-labs/skills) for skill distribution.** Author skills in the standard SKILL.md format (agentskills.io specification). Consumers install via `npx skills add`.

For the narrow case of hook-based enforcement (e.g., git-workflow's commit gate), continue using npm postinstall to wire platform-specific hook configurations.

## Key Findings

### All Three Platforms Support Standard SKILL.md

As of early 2026, Claude Code, Gemini CLI, and Codex CLI all natively support the Agent Skills specification (SKILL.md with YAML frontmatter + markdown body). No format conversion is needed.

| Platform | Skills Directory | Native SKILL.md Support | Since |
|----------|-----------------|------------------------|-------|
| Claude Code | `.claude/skills/<name>/SKILL.md` | Yes | Late 2025 |
| Codex CLI | `.codex/skills/<name>/SKILL.md` | Yes | Late 2025 |
| Gemini CLI | `.gemini/skills/<name>/SKILL.md` | Yes | v0.23.0 (Jan 2026) |

Gemini CLI also has an older `.gemini/commands/*.toml` system, but this is a separate feature for user-invoked prompt shortcuts. The newer `.gemini/skills/` system reads standard SKILL.md files and supports progressive disclosure (metadata at startup, full body on activation).

### The SKILL.md Standard

The [Agent Skills specification](https://agentskills.io/specification) is maintained by Anthropic under the Agentic AI Foundation (Linux Foundation). Required format:

```
<skill-name>/
  SKILL.md           # Required — YAML frontmatter + markdown instructions
  scripts/           # Optional — executable code
  references/        # Optional — long-form documentation
  assets/            # Optional — templates, resources
```

SKILL.md frontmatter requires `name` and `description`. The body is freeform markdown. Progressive disclosure keeps startup overhead low (~100 tokens per skill for metadata).

### Tool Evaluation

Four cross-platform distribution tools were evaluated against our core requirement: distributing skills FROM npm packages or Git repos TO consumer environments across all three platforms.

| Tool | Verdict | Reason |
|------|---------|--------|
| **[skills.sh](https://github.com/vercel-labs/skills)** (Vercel) | **Adopted** | 40+ agents, 353k weekly downloads, installs from GitHub repos with monorepo subpath support, standard SKILL.md format, non-interactive mode for CI/Docker |
| **[Ruler](https://github.com/intellectronica/ruler)** | Rejected | Best for single-project rule management (33 agents, 2.2k stars), but skill source hardcoded to `.ruler/skills` — cannot distribute from external packages without a wrapper |
| **[PRPM](https://github.com/pr-pm/prpm)** | Rejected | Separate package registry (not npm), requires consumers to install prpm CLI, registry-dependent. The `@pr-pm/converters` library is useful but low adoption (500/mo downloads) |
| **[npm-agentskills](https://github.com/onmax/npm-agentskills)** | Rejected | Right architecture (scans node_modules, programmatic API), but 2-day-old prototype, single author, zero community usage, no Gemini support, broken CLI for non-Nuxt projects |

### Why skills.sh

1. **Monorepo subpath support** — `npx skills add org/repo/packages/git-workflow` clones the repo and scopes skill discovery to the specified subdirectory
2. **Non-interactive mode** — `-y --all` flags enable fully automated installation in Dockerfiles and CI
3. **Update mechanism** — `npx skills update -y` pulls latest from source repos
4. **No format lock-in** — uses the standard SKILL.md format; skills work without skills.sh
5. **Broad agent coverage** — 40+ agents including all three of our targets
6. **Active maintenance** — 7.4k stars, releases every 3-4 days, MIT license, Vercel-backed

## Architecture

### Two-Layer Model

```
Skills (cross-platform, via skills.sh)
  └─ SKILL.md files teaching conventions and workflows
  └─ Distributed via: npx skills add org/repo
  └─ Works on: Claude Code, Gemini CLI, Codex CLI, 37+ others

Hooks (platform-specific, via npm postinstall)
  └─ PreToolUse / BeforeTool enforcement gates
  └─ Distributed via: npm install (postinstall wires settings.json)
  └─ Works on: Claude Code (PreToolUse), Gemini CLI (BeforeTool)
  └─ Codex CLI: no hook system yet (proposed Feb 2026)
  └─ Git hooks: universal backstop regardless of AI CLI
```

Most skill packages only need the first layer. The hook layer is for packages like git-workflow that need deterministic enforcement (e.g., blocking `git commit` unless the commit skill was followed).

### Skill Authoring in This Repo

Skills live in a `skills/` directory within the relevant package (or at the repo root for repo-wide skills):

```
packages/git-workflow/
  skills/
    commit/
      SKILL.md
    create-pull-request/
      SKILL.md
    code-review/
      SKILL.md
```

Or at the repo root for framework-wide skills:

```
skills/
  doc-sync-verification/
    SKILL.md
  testing-standards/
    SKILL.md
```

### Consumer Installation

```bash
# Install all skills from a package in the monorepo
npx skills add zookanalytics/bmad-orchestrator-bugs2/packages/git-workflow -y --all

# Install a specific skill
npx skills add zookanalytics/bmad-orchestrator-bugs2@doc-sync-verification -y

# Install all repo-wide skills
npx skills add zookanalytics/bmad-orchestrator-bugs2 -y --all

# Update all installed skills
npx skills update -y
```

In a Dockerfile or devcontainer setup script:

```bash
npx skills add zookanalytics/bmad-orchestrator-bugs2 -y --all
```

### Converting Existing Skills

Existing Claude-specific skills (in `.claude/commands/` or the superpowers plugin) need minor conversion:

| Current | Standard SKILL.md |
|---------|-------------------|
| `disable-model-invocation: true` | Remove (not in spec) |
| XML tags (`<steps>`, `<action>`) | Convert to markdown headings/lists |
| `@{project-root}` template vars | Explicit paths or context-setting instructions |
| `.claude/commands/<name>.md` | `skills/<name>/SKILL.md` |

The `name`, `description`, and `allowed-tools` frontmatter fields carry over unchanged. The markdown body just needs XML tags replaced with standard markdown.

## Hook Enforcement (Platform-Specific)

### Claude Code

Skills can define hooks in YAML frontmatter (scoped to skill lifecycle):

```yaml
---
name: commit
description: Stage and commit following conventional commits
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-commit.sh"
---
```

Project-level hooks go in `.claude/settings.json`. Managed policy hooks for enterprise enforcement.

### Gemini CLI

Similar hook system (since v0.26.0) with `BeforeTool` as the blocking event. Different JSON schema and event names. Configuration in `.gemini/settings.json`.

### Codex CLI

No hook system yet. Proposed in [issue #12190](https://github.com/openai/codex/issues/12190) (Feb 2026).

### Git Hooks

The universal enforcement backstop. `pre-commit` and `commit-msg` hooks work regardless of which AI CLI (or human) initiated the action. Distributed via npm postinstall (existing pattern in this monorepo via keystone-workflows).

## Superseded Approach

`scripts/install-skills.mjs` was built during this research as a custom cross-platform installer that converted SKILL.md to Gemini TOML format. It is now unnecessary because:

1. Gemini CLI natively supports SKILL.md (since v0.23.0)
2. skills.sh handles multi-agent distribution with 40+ agent support
3. Maintaining custom format conversion logic adds cost with no benefit

The script has been deleted.

## Open Questions

1. **git-workflow skill brief** — a separate agent is drafting the brief for folding git-workflow skills into this repo. The hook enforcement layer for git-workflow will need design once that brief is complete.
2. **Private repo support** — skills.sh has known bugs with private GitHub repos (issues #436, #418). If skills move to a private repo, this needs validation.
3. **skills.sh `experimental_sync`** — an experimental command scans `node_modules` for skills (the npm postinstall pattern). Worth monitoring — if it stabilizes, it provides a second distribution channel alongside GitHub repo installation.

## Sources

- [Agent Skills Specification](https://agentskills.io/specification)
- [Vercel skills.sh CLI](https://github.com/vercel-labs/skills) — 7.4k stars, MIT
- [Ruler](https://github.com/intellectronica/ruler) — 2.2k stars, MIT
- [PRPM](https://github.com/pr-pm/prpm) — 88 stars, MIT
- [npm-agentskills](https://github.com/onmax/npm-agentskills) — MIT
- [Gemini CLI Agent Skills](https://geminicli.com/docs/cli/skills/)
- [Gemini CLI Skills Epic (Issue #15327)](https://github.com/google-gemini/gemini-cli/issues/15327)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Gemini CLI Hooks Reference](https://geminicli.com/docs/hooks/reference/)
- [Codex CLI Governance Hooks Proposal](https://github.com/openai/codex/issues/12190)
- [AGENTS.md Open Standard](https://agents.md/)
- [Agentic AI Foundation (Linux Foundation)](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
