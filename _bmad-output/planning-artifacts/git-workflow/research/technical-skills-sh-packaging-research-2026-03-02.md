---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowComplete: true
completedAt: '2026-03-03'
inputDocuments:
  - '_bmad-output/planning-artifacts/git-workflow/product-brief.md'
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'skills.sh packaging and distribution standard'
research_goals: 'Understand packaging format, naming conventions, and distribution mechanics for shipping git-workflow; identify existing similar git-related skills packages'
user_name: 'Node'
startedAt: '2026-03-02'
web_research_enabled: true
source_verification: true
---

# Packaging git-workflow for the Agent Skills Ecosystem: Technical Research

**Date:** 2026-03-02 to 2026-03-03
**Author:** Node
**Research Type:** Technical — skills.sh packaging and distribution standard

---

## Executive Summary

The Agent Skills standard, created by Anthropic in December 2025 and now adopted by 40+ AI coding agents, provides a clear and well-specified packaging format for distributing git-workflow. The ecosystem is young but maturing rapidly — 57,000+ skills indexed on skills.sh within two months of launch, with major vendors (Stripe, Supabase, Vercel, Nx) already shipping official skill packages.

**The packaging question has a clear answer:** git-workflow should ship as a multi-skill package with six skill directories under `skills/`, a shared `lib/` for scripts used by both skills and hooks, and an npm-installable hooks layer for deterministic enforcement without an AI agent. Skills and hooks require **separate distribution channels** — `npx skills add` (git-based sources only) for skills, `npm install` for hooks — because the skills CLI does not support npm packages as an installation source.

**Key Findings:**

- **No competitor covers the full git lifecycle.** Existing git skills are fragmented — single-operation (commit only), standards documents (describe but don't enforce), or partial workflows (obra/superpowers covers some phases as part of a broader methodology). git-workflow's six-skill, goal-oriented approach fills a clear gap.
- **The SKILL.md format maps perfectly to git-workflow's design.** Shell scripts handle deterministic checks (low freedom), AI judgment handles message crafting and assessment (high freedom), and progressive disclosure keeps context costs minimal.
- **The shared `lib/` pattern is non-standard but practical.** The Agent Skills spec defines per-skill directories only. A shared `lib/` requires the thin-wrapper pattern (per-skill `scripts/` calling shared `lib/`) and full-package installation — both acceptable constraints.
- **A dedicated GitHub repo (or subtree publish) is needed for clean skills.sh identity.** `npx skills add` only accepts git-based sources — not npm packages. Installing from the monorepo would produce the awkward `ZookAnalytics/bmad-orchestrator/commit` identity. A dedicated `zookanalytics/git-workflow` repo gives the clean `zookanalytics/git-workflow/commit` identity.

**Top Recommendations:**

1. Use action-oriented skill names: `commit`, `pr-update`, `pr-merge`, `rebase`, `sync`, `cleanup`
2. Write "pushy" descriptions in third person — descriptions are the trigger mechanism and Claude undertriggers
3. Keep each SKILL.md under 500 lines with workflow-as-checklist structure
4. Use `skills-ref validate` in CI, ShellSpec for script testing, Claude A/B iteration for workflow quality
5. Distribute skills via dedicated GitHub repo (subtree from monorepo), hooks via npm changesets — `npx skills add` does NOT support npm packages

---

## Table of Contents

1. [Technology Stack Analysis](#technology-stack-analysis) — The ecosystem, SKILL.md format, multi-skill packages, distribution, cross-agent compatibility, competitive landscape
2. [Integration Patterns Analysis](#integration-patterns-analysis) — Discovery/activation mechanism, SKILL.md + scripts pattern, inter-skill dependencies, hooks alongside skills, portability, security
3. [Architectural Patterns and Design](#architectural-patterns-and-design) — Naming, descriptions, progressive disclosure, shared library, dual distribution, monorepo structure, script architecture
4. [Implementation Approaches and Technology Adoption](#implementation-approaches-and-technology-adoption) — Validation tooling, development workflow, shell testing, publishing, portability, risk assessment
5. [Technical Research Recommendations](#technical-research-recommendations) — Roadmap, naming, architecture, key design decisions

---

## Research Methodology

**Research Topic:** skills.sh packaging and distribution standard
**Research Goals:** Understand packaging format, naming conventions, and distribution mechanics for shipping git-workflow; identify existing similar git-related skills packages

**Approach:**
- Current web data (March 2026) verified against official specifications and documentation
- Multi-source validation — claims checked across Anthropic docs, Vercel CLI, OpenAI Codex docs, VS Code docs, and independent reviews
- Confidence levels applied: HIGH (spec-sourced), MEDIUM-HIGH (multi-source verified), MEDIUM (single-source or evolving)
- 20+ web searches across ecosystem documentation, package registries, competitive analysis, and implementation guides

**Key Sources:**
- [Agent Skills Specification](https://agentskills.io/specification) — the canonical format definition
- [Anthropic Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) — official authoring guidance
- [Vercel skills CLI](https://github.com/vercel-labs/skills) — the `npx skills add` distribution tool
- [skills.sh](https://skills.sh/) — the ecosystem directory and leaderboard
- [anthropics/skills](https://github.com/anthropics/skills) — Anthropic's reference implementation

## Technology Stack Analysis

### The Agent Skills Ecosystem

The Agent Skills format was developed by Anthropic and released as an open standard in late 2025 (December 2025). What started as a Claude Code feature has become an industry-wide standard adopted by OpenAI (Codex CLI), Google (Gemini CLI, Antigravity), GitHub Copilot, Cursor, Windsurf, and 30+ other agents. The open specification lives at [agentskills.io](https://agentskills.io/specification) and the reference implementation at [github.com/anthropics/skills](https://github.com/anthropics/skills) (81k stars, 8.5k forks).

On January 20, 2026, Vercel launched the **skills CLI** (`npx skills`) and **skills.sh** — a directory and leaderboard platform for discovering and tracking skill packages. Skills.sh has indexed 57,000+ skills with the top package exceeding 26,000 all-time installs as of January 2026.

_Confidence: HIGH — verified across multiple authoritative sources (Anthropic docs, Vercel changelog, agentskills.io)_
_Sources: [Anthropic Skills repo](https://github.com/anthropics/skills), [Agent Skills specification](https://agentskills.io/specification), [Vercel changelog](https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem), [skills.sh](https://skills.sh/)_

### SKILL.md Format and Directory Structure

A skill is a directory containing at minimum a `SKILL.md` file. The specification defines:

**Required YAML frontmatter fields:**
- `name` — 1-64 characters, lowercase alphanumeric + hyphens only, no leading/trailing/consecutive hyphens, **must match parent directory name**
- `description` — 1-1024 characters, describes what the skill does AND when to use it (serves as the AI trigger mechanism)

**Optional frontmatter fields:**
- `license` — Short identifier (e.g., `Apache-2.0`) or reference to bundled file
- `compatibility` — Max 500 chars, environment requirements (e.g., `Requires git, docker, jq`)
- `metadata` — Arbitrary key-value pairs (author, version, etc.)
- `allowed-tools` — Space-delimited pre-approved tools (experimental)

**Directory structure:**

```
skill-name/
├── SKILL.md          # Required — instructions and metadata
├── scripts/          # Optional — executable code (Bash, Python, JS)
├── references/       # Optional — additional documentation, loaded on demand
├── templates/        # Optional — file templates
└── assets/           # Optional — static resources (images, data files)
```

**Size guidelines:**
- SKILL.md body: < 5000 tokens recommended, < 500 lines
- Reference files: < 200 lines each
- File references: one level deep from SKILL.md (no nested chains)

**Progressive disclosure model (4 layers):**
1. **Metadata** (~100 tokens): `name` and `description` loaded at startup for ALL installed skills
2. **Instructions** (< 5000 tokens): Full SKILL.md body loaded when skill activates
3. **Resources** (as needed): `references/`, `templates/` loaded on demand
4. **Executable code** (as needed): `scripts/` invoked when required

This means a skill can have unbounded complexity while consuming minimal context when not in use — directly supporting git-workflow's "progressive disclosure" design goal.

_Confidence: HIGH — sourced directly from the official specification_
_Source: [Agent Skills Specification](https://agentskills.io/specification)_

### Multi-Skill Package Architecture

A single GitHub repository can contain multiple skills. This is the standard model for packages like `obra/superpowers` and `vercel-labs/agent-skills`. Structure:

```
repo-root/
├── skills/
│   ├── skill-one/
│   │   └── SKILL.md
│   ├── skill-two/
│   │   ├── SKILL.md
│   │   └── scripts/
│   └── skill-three/
│       ├── SKILL.md
│       └── references/
├── README.md
└── package.json        # Optional, for npm distribution
```

Skills are discovered in standardized locations: root directory (if containing SKILL.md), `skills/` directory, `.claude/skills/`, `.cursor/skills/`, and agent-specific paths.

**Installation options:**
- Install entire package: `npx skills add owner/repo`
- Install specific skill: `npx skills add owner/repo --skill "skill-name"` or `npx skills add owner/repo/skill-name`
- Install from URL, GitLab, or local path
- Install to specific agent: `npx skills add owner/repo -a claude-code`
- Project-local or global install scope

**Naming convention on skills.sh:** Skills are identified as `owner/repo/skill-name` (e.g., `obra/superpowers/creating-commits`). The `owner/repo` comes from the GitHub repository, so the repo name becomes the package identity.

_Confidence: HIGH — verified from Vercel CLI docs, skills.sh pages, and multiple package examples_
_Sources: [Vercel skills CLI](https://github.com/vercel-labs/skills), [skills.sh](https://skills.sh/obra/superpowers)_

### Distribution and Publishing

**Publishing is friction-free:** Put skills in a git repo. Share the repo. There is no registry submission flow. Skills appear on the skills.sh leaderboard automatically through anonymous telemetry when users run `npx skills add`. Once installed by users, the package is tracked and ranked by installation count.

**CORRECTION: `npx skills add` does NOT support npm packages as a source.** The CLI only supports git-based sources (GitHub shorthand, full URLs, GitLab, generic git URLs) and local file paths. There is no npm registry lookup. The product brief's `npx skills add @zookanalytics/git-workflow` would not work — the `@` prefix is not recognized as an npm scope by the skills CLI.

**Separate npm-based approach exists:** Anthony Fu's [skills-npm](https://github.com/antfu/skills-npm) is a complementary tool that discovers skills bundled inside `node_modules` after `npm install` and symlinks them to agent directories. This is a separate tool, not part of the Vercel skills CLI. An [npm boilerplate](https://github.com/neovateai/agent-skill-npm-boilerplate) also exists for npm-based skill distribution.

**Actual distribution options for git-workflow:**

| Option | Install command | skills.sh identity | Pros | Cons |
|--------|----------------|-------------------|------|------|
| **From monorepo** | `npx skills add ZookAnalytics/bmad-orchestrator` | `ZookAnalytics/bmad-orchestrator/commit` | No extra repos | Awkward identity; installs all monorepo skills |
| **Dedicated GitHub repo** | `npx skills add zookanalytics/git-workflow` | `zookanalytics/git-workflow/commit` | Clean identity; standard pattern | Extra repo to maintain |
| **Subtree/mirror publish** | `npx skills add zookanalytics/git-workflow` | `zookanalytics/git-workflow/commit` | Clean identity; automated from monorepo | CI complexity for subtree push |
| **npm + skills-npm** | `npm install @zookanalytics/git-workflow && npx skills-npm` | No skills.sh presence | Versioned via npm; hooks + skills in one install | Two-step install; no leaderboard visibility; skills-npm is third-party |
| **Local path** | `npx skills add ./packages/git-workflow` | None | Works during development | Not distributable |

**Recommended approach:** A **dedicated GitHub repo** (or automated subtree publish from the monorepo) provides the cleanest distribution story — standard `npx skills add` command, clean skills.sh identity, and compatibility with the ecosystem's expectations. The monorepo continues to own CI, testing, and changeset infrastructure; the dedicated repo serves as the distribution target.

**Quality concern:** Skills.sh has no quality control — ranking is purely by install count, which can be gamed. Reviewer consensus is to stick to vendor-provided or trusted community skills.

_Confidence: HIGH — verified by direct inspection of the skills CLI source and documentation. The CLI accepts only git URLs and local paths, not npm package names._
_Sources: [Vercel skills CLI](https://github.com/vercel-labs/skills), [skills-npm](https://github.com/antfu/skills-npm), [npm boilerplate](https://github.com/neovateai/agent-skill-npm-boilerplate), [Skills.sh review](https://www.toolworthy.ai/tool/skills-sh)_

### Cross-Agent Compatibility

The Agent Skills standard is supported across all major AI coding agents. Skills using only standard fields work across all platforms; platform-specific fields are silently ignored.

**Confirmed compatible agents (as of Feb 2026):** amp, antigravity, claude-code, clawdbot, codex, cursor, droid, gemini, gemini-cli, github-copilot, goose, kilo, kiro-cli, opencode, roo, trae, windsurf, and others.

**Agent-specific installation paths:**
- Claude Code: `.claude/skills/`
- Cursor: `.cursor/skills/`
- GitHub Copilot: follows VS Code agent skills path
- The CLI handles path selection automatically via `-a` flag

**Portability constraint:** Skills that use `allowed-tools` (experimental) or platform-specific features may degrade on some agents. For maximum portability, stick to standard frontmatter fields and reference scripts via relative paths.

_Confidence: HIGH — confirmed by Vercel, Anthropic, and OpenAI documentation_
_Sources: [Claude Code skills docs](https://code.claude.com/docs/en/skills), [VS Code agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills), [OpenAI Codex skills](https://developers.openai.com/codex/skills/)_

### Existing Git-Related Skills (Competitive Landscape)

Several git-related skills already exist on skills.sh and other registries. None provide the comprehensive, goal-oriented workflow coverage that git-workflow targets.

**On skills.sh:**

| Skill | Author | Description | Coverage |
|-------|--------|-------------|----------|
| **git-commit** | github/awesome-copilot | Conventional Commits-based commit workflow | Commit only |
| **using-git-worktrees** | obra/superpowers | Git worktree setup and management | Worktrees only |
| **finishing-a-development-branch** | obra/superpowers | End-of-branch workflow (merge/PR/keep/discard) | Branch completion |
| **creating-commits** | obra/superpowers | Pre-commit checks and conventional commits | Commit only |
| **github** | dimillian/skills | gh CLI interactions (CI, PRs) | GitHub API wrapper |
| **github** | clawdbot/clawdbot | GitHub workflow assistance | GitHub API wrapper |

**On other registries (LobeHub, Playbooks):**

| Skill | Author | Description | Coverage |
|-------|--------|-------------|----------|
| **git-flow** | sandlerz | Automates git+GitHub workflow (save/update/pr) | Commit + PR |
| **git-conventions** | davidcwhite | Conventional Commits, branching, PR practices | Standards doc |
| **git-commit-workflow** | laurigates | Focused commit workflow with conventions | Commit only |
| **git-workflow** | agno-agi | Git guidance for commits, branches, PRs | Standards doc |
| **create-pull-request** | cline | PR creation with gh CLI | PR creation only |

**Key observation:** The landscape is fragmented. Existing skills are either:
1. **Single-operation** (commit only, PR creation only) — no end-to-end workflow
2. **Standards documents** (conventions/guidelines) — describe what to do, don't enforce it
3. **Partial workflows** (obra/superpowers) — cover specific phases but not the full git lifecycle

**No existing package covers the full Commit → PR → Merge → Rebase → Sync → Cleanup lifecycle with enforced completeness.** This is git-workflow's clear differentiation.

**Notable:** The `obra/superpowers` package is the closest analog structurally — it's a multi-skill package on skills.sh with git-related skills. However, superpowers is a broader development methodology, not a focused git operations package. Its git skills (creating-commits, finishing-a-development-branch, using-git-worktrees) are supporting pieces of a larger framework, not standalone git workflow enforcement.

_Confidence: MEDIUM-HIGH — based on skills.sh directory search, LobeHub, Playbooks.com, and individual repo inspection. New skills appear daily; landscape could shift._
_Sources: [skills.sh/obra/superpowers](https://skills.sh/obra/superpowers), [skills.sh git-commit](https://skills.sh/github/awesome-copilot/git-commit), [LobeHub git-flow](https://lobehub.com/skills/sandlerz-skills-git-flow), [Playbooks git-commit-workflow](https://playbooks.com/skills/laurigates/claude-plugins/git-commit-workflow)_

### Technology Adoption Trends

_Ecosystem velocity:_ The Agent Skills standard went from Anthropic internal feature to industry-wide adoption in ~3 months (Dec 2025 → Feb 2026). 57,000+ skills indexed. Major vendors (Stripe, Supabase, Vercel) shipping official skills alongside their products.

_Distribution model maturing:_ The `npx skills add` CLI is at v1.4.3 as of March 2026. Skills.sh leaderboard provides organic discovery. No registry submission required — just push to GitHub and installs are tracked automatically.

_Quality gap:_ The ecosystem prioritizes quantity and frictionless publishing over quality curation. This creates opportunity for well-crafted, focused packages to stand out through reliability rather than install count.

_Multi-skill packages are the norm for serious tools:_ Single-SKILL.md repos exist but professional packages (Anthropic's own skills, obra/superpowers, vercel-labs/agent-skills) all use the multi-skill directory structure.

_Source: [Skills.sh review](https://vibecoding.app/blog/skills-sh-review), [Awesome Agent Skills](https://github.com/skillmatic-ai/awesome-agent-skills)_

## Integration Patterns Analysis

### Skill Discovery and Activation Mechanism

Agents integrate with skills through a standardized three-stage progressive disclosure protocol. Understanding this mechanism is critical for designing git-workflow's SKILL.md descriptions to trigger reliably.

**Stage 1 — Discovery/Advertise (~100 tokens per skill):** At session start, the agent scans configured skill directories and extracts `name` + `description` from each SKILL.md frontmatter. These are injected into the system prompt as a lightweight "table of contents." The agent knows what skills exist and when to use them, but doesn't load instructions yet.

**Stage 2 — Activation/Load (< 5000 tokens recommended):** When a task matches a skill's description, the agent calls an internal `load_skill` tool to retrieve the full SKILL.md body. This is where the skill's instructions, workflow steps, and decision logic are loaded into context.

**Stage 3 — Resource Access (as needed):** The agent reads supplementary files (`references/`, `scripts/`, `templates/`) only when the loaded instructions reference them. Script output — not source code — enters the context window, making scripts far more context-efficient than inline code.

**Implication for git-workflow:** Each skill's `description` field is the primary trigger. Descriptions must include specific keywords and contexts that agents match against (e.g., "Use when creating git commits" or "Use when merging pull requests"). Anthropic notes agents tend to "undertrigger" — descriptions should be slightly "pushy" about when to activate. For a six-skill package, each description must be distinct enough that the right skill activates without ambiguity.

_Confidence: HIGH — consistent across Anthropic, OpenAI, Microsoft, and VS Code documentation_
_Sources: [agentskills.io — What are skills?](https://agentskills.io/what-are-skills), [Claude API Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), [OpenAI Codex skills](https://developers.openai.com/codex/skills/), [VS Code agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)_

### SKILL.md + Scripts Integration Pattern

The core integration pattern for git-workflow is the split between AI-driven instructions (SKILL.md) and deterministic shell scripts (`scripts/`). This directly maps to the product brief's design: "Shell scripts handle deterministic operations. SKILL.md instructions guide the AI through judgment calls."

**How it works:**
- SKILL.md contains workflow steps written in natural language — the agent reads and follows them
- When a step requires a deterministic operation (run tests, check branch state, verify hooks), the instructions direct the agent to execute a script from `scripts/`
- The agent runs scripts via its Bash tool; only the script's **output** enters the context window (not the script source)
- The agent then applies judgment to the script output (e.g., interpret test results, decide on commit message, assess conflict complexity)

**Context efficiency:** Scripts executing outside the context window means git-workflow can include substantial shell logic (branch checks, remote state verification, CI status polling) without consuming AI reasoning budget. This is a major advantage over pure-SKILL.md approaches that embed all logic as instructions.

**`allowed-tools` for security:** The experimental `allowed-tools` frontmatter field can pre-authorize specific tools (e.g., `Bash(git:*) Bash(gh:*) Read Grep`). This is well-supported in Claude Code today but support varies across agents. For maximum portability, git-workflow should document tool requirements in `compatibility` rather than relying on `allowed-tools` for enforcement.

_Confidence: HIGH — verified from spec, Claude Code docs, and multiple implementation guides_
_Sources: [Claude skills deep dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/), [SKILL.md pattern guide](https://bibek-poudel.medium.com/the-skill-md-pattern-how-to-write-ai-agent-skills-that-actually-work-72a3169dd7ee), [Claude Code skills docs](https://code.claude.com/docs/en/skills)_

### Inter-Skill Dependencies and Composability

The Agent Skills specification supports explicit inter-skill dependencies via YAML frontmatter, though support varies by platform.

**Dependency declaration (in frontmatter):**
```yaml
dependencies:
  - skill: python-development
    version: ">=1.0.0"
  - skill: file-operations
    version: "*"
requires:
  python: ">=3.8"
  packages: [pdfplumber>=0.10.0]
```

Two dependency types:
1. **`dependencies`** — references to other skills (inter-skill dependencies with version constraints)
2. **`requires`** — references to external software/packages needed by the skill

**Implication for git-workflow:** The six skills (commit, pr-update, pr-merge, rebase, sync, cleanup) within the same package don't need formal inter-skill dependency declarations since they're co-installed. However, if any skill references shared `lib/` scripts, this is handled through relative file paths within the package — not through the dependency mechanism.

**Composability with external skills:** obra/superpowers demonstrates the pattern of skills referencing other skills by name (e.g., `superpowers:creating-commits`). This uses a `package:skill-name` convention. git-workflow skills could be referenced as `git-workflow:commit` by external packages (like keystone-workflows).

**Composability in automated workflows:** Skills are designed to be standalone invocations AND building blocks. The product brief's requirement that keystone-workflows can invoke commit as one step in a larger sequence is natively supported — an automated workflow simply tells the agent to invoke the relevant skill, and the skill runs to completion autonomously.

_Confidence: MEDIUM — dependency fields appear in guides and deep dives but aren't prominently featured in the core spec. Platform support varies._
_Sources: [Agent Skills deep dive](https://addozhang.medium.com/agent-skills-deep-dive-building-a-reusable-skills-ecosystem-for-ai-agents-ccb1507b2c0f), [Agent Skills research paper](https://arxiv.org/html/2602.12430), [obra/superpowers](https://github.com/obra/superpowers)_

### Git Hooks Layer Alongside Skills

The product brief specifies an npm-installable hooks layer that provides deterministic enforcement independent of AI agents. This sits alongside — not inside — the skills system.

**Key distinction:**
- **Agent Skills** = SKILL.md instructions that guide an AI agent through a workflow (requires an active agent)
- **Git hooks** = Shell scripts triggered by git events (pre-commit, post-merge) that run deterministically without an agent
- **Claude Code hooks** = A separate system entirely — shell commands triggered by Claude Code lifecycle events (PreToolUse, PostToolUse, SessionStart)

**Integration architecture:**
- Skills and git hooks share the same underlying scripts from `lib/` (product brief requirement: "hooks and skills call the same context-agnostic scripts via explicit arguments")
- When an AI agent is present, the skill orchestrates the workflow and calls scripts
- When no AI agent is present, git hooks call the same scripts directly as a safety net
- Scripts must be context-agnostic — they take explicit arguments, never assume execution context (invoked by skill vs. hook)

**Claude Code hooks consideration:** Claude Code's hook system (`hooks.json`) can intercept git operations via `PostToolUse` matchers like `Bash(git commit:*)`. However, these are Claude Code-specific and don't replace git hooks for agent-agnostic enforcement. git-workflow should NOT use Claude Code hooks — its git hooks layer serves the same purpose portably.

**npm installation for hooks:** The hooks layer installs via `npm install` (or `pnpm install`) and sets up git hooks in `.git/hooks/`. This is a separate installation path from `npx skills add` — the skills and hooks are distributed through different channels but share the same package.

_Confidence: HIGH — Claude Code hooks are well-documented; git hooks integration pattern is standard_
_Sources: [Claude Code hooks guide](https://code.claude.com/docs/en/hooks-guide), [Claude Code hooks examples](https://stevekinney.com/courses/ai-development/claude-code-hook-examples), [Git hooks feature request](https://github.com/anthropics/claude-code/issues/4834)_

### Cross-Agent Portability Constraints

For git-workflow to work across Claude Code, Gemini CLI, Codex, and other agents, skills must stay within the portable subset of the specification.

**Portable (works everywhere):**
- Standard frontmatter fields: `name`, `description`, `license`, `compatibility`, `metadata`
- Markdown body with natural language instructions
- Relative file references to `scripts/`, `references/`, `templates/`
- Shell scripts executed via agent's Bash tool
- `gh` CLI for GitHub operations (widely available)

**Platform-specific (may not work everywhere):**
- `allowed-tools` — experimental, well-supported in Claude Code, varies elsewhere
- Slash command invocation (e.g., `/commit`) — agent-specific triggering mechanisms
- Agent-specific tool names in instructions (e.g., "use the Read tool") — different agents may name tools differently

**Portability strategy for git-workflow:** Write SKILL.md instructions in terms of actions ("read the file", "run this command") rather than tool names ("use the Read tool"). Reference scripts by relative path. Use `compatibility` to declare requirements (`Requires git, gh CLI`). This ensures skills degrade gracefully on agents that don't support every feature.

_Confidence: HIGH — cross-platform behavior is well-documented by all major vendors_
_Sources: [Agent Skills specification](https://agentskills.io/specification), [VS Code agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills), [OpenAI Codex skills](https://developers.openai.com/codex/skills/)_

### Security Patterns for Executable Skills

Skills that bundle executable code (like git-workflow's shell scripts) have specific security considerations.

**Key concerns:**
- Scripts execute on the host machine with the user's permissions — no sandboxing by default
- The `allowed-tools` field can restrict which tools a skill can invoke, but enforcement is experimental
- Community skills should be audited before installation — "read every file in the folder, especially anything in `scripts/`"

**Mitigations for git-workflow:**
- All scripts in `lib/` and `scripts/` are open source and auditable
- Scripts operate exclusively on git state — no network calls beyond `git push/pull/fetch` and `gh` CLI
- The `compatibility` field should declare: `Requires git, gh CLI, and network access for remote operations`
- Scripts should fail safely — errors halt the workflow rather than proceeding with partial state

_Confidence: HIGH — security guidance consistent across all vendor documentation_
_Sources: [Agent Skills explained](https://dev.to/loc_carrre_0d798813c662/agent-skills-explained-what-they-are-what-they-arent-and-how-to-use-them-bf9), [LM-Kit agent skills guide](https://lm-kit.com/blog/agent-skills-explained/)_

## Architectural Patterns and Design

### Skill Naming Patterns

Anthropic's best practices recommend specific naming patterns for skills:

**Preferred: Gerund form (verb + -ing)** — clearly describes the activity the skill provides:
- `processing-pdfs`, `analyzing-spreadsheets`, `testing-code`

**Acceptable: Noun phrases** — describe the domain:
- `pdf-processing`, `spreadsheet-analysis`

**Acceptable: Action-oriented** — imperative form:
- `process-pdfs`, `analyze-spreadsheets`

**Constraints (enforced by spec):**
- Lowercase letters, numbers, and hyphens only
- Max 64 characters
- No leading/trailing/consecutive hyphens
- Must match parent directory name
- Cannot contain reserved words: `anthropic`, `claude`

**Avoid:** Vague names (`helper`, `utils`, `tools`), overly generic names (`documents`, `data`), inconsistent patterns within a collection.

**Implications for git-workflow skill naming:**

The product brief uses: `commit`, `pr-update`, `pr-merge`, `rebase`, `sync`, `cleanup`. These are action-oriented (imperative) names. Alternatives in gerund form would be: `creating-commits`, `updating-prs`, `merging-prs`, `rebasing`, `syncing`, `cleaning-up`.

The action-oriented names are shorter and more natural for command invocation. The existing `obra/superpowers` package uses both patterns (`creating-commits` is gerund, `brainstorming` is gerund, `test-driven-development` is a noun phrase). Consistency within the package matters more than which pattern is chosen.

**Package naming on skills.sh:** The package identity is `owner/repo` (e.g., `zookanalytics/git-workflow`). Individual skills appear as `zookanalytics/git-workflow/commit`, etc. The repo name `git-workflow` is clear and descriptive.

_Confidence: HIGH — sourced directly from Anthropic's official best practices_
_Source: [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)_

### Description Writing for Reliable Triggering

The `description` field is the single most important architectural decision per skill — it determines whether the skill activates when needed.

**Key principles from Anthropic:**
1. Include WHAT the skill does AND WHEN to use it
2. Always write in third person (description is injected into system prompt)
3. Be specific and include key terms — agents select from potentially 100+ installed skills
4. Claude tends to "undertrigger" — make descriptions slightly "pushy" about when to activate
5. Max 1024 characters

**Example from Anthropic's docs:**
```yaml
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.
```

**Implications for git-workflow:** Each of the six skills needs a description that is distinct enough to avoid ambiguity. For example, `commit` and `pr-update` both involve commits — their descriptions must clearly delineate when each activates. Since git-workflow skills are goal-oriented (not task-oriented), descriptions should emphasize the *goal state*, e.g., "Transforms working changes into a well-formed commit" rather than "Helps write commit messages."

_Confidence: HIGH — sourced directly from Anthropic's official best practices_
_Source: [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)_

### Progressive Disclosure Architecture for Complex Workflows

Each git-workflow skill is a multi-step workflow with both deterministic checks and AI judgment calls. The progressive disclosure architecture determines how content is layered.

**Anthropic's recommended structure:**

```
skill-name/
├── SKILL.md              # Main instructions (< 500 lines, < 5000 tokens)
├── references/           # Loaded on demand via JIT pattern
│   └── detailed-guide.md # Referenced from SKILL.md when needed
└── scripts/              # Executed, not loaded into context
    ├── check-state.sh    # Deterministic checks
    └── validate.sh       # Validation scripts
```

**Pattern: Workflow as checklist** — Anthropic recommends checklists for complex multi-step tasks:

```markdown
## Commit workflow

Copy this checklist and track your progress:

- [ ] Step 1: Check working tree state (run scripts/check-state.sh)
- [ ] Step 2: Stage changes appropriately
- [ ] Step 3: Run pre-commit checks (run scripts/pre-checks.sh)
- [ ] Step 4: Craft commit message analyzing the diff
- [ ] Step 5: Create commit
- [ ] Step 6: Verify commit succeeded
```

This directly maps to git-workflow's design: each step is either a script execution (deterministic) or an AI judgment call (adaptive), presented as a workflow the agent follows sequentially.

**Degrees of freedom pattern:** Anthropic distinguishes between:
- **Low freedom** (scripts, exact commands) — for fragile/deterministic operations like running tests or checking branch state
- **Medium freedom** (pseudocode, scripts with parameters) — for configurable operations
- **High freedom** (text-based instructions) — for judgment calls like crafting commit messages or assessing review status

git-workflow skills should use low freedom for deterministic steps (shell scripts) and high freedom for AI-essential moments (message crafting, status assessment) — exactly matching the product brief's design.

_Confidence: HIGH — directly from Anthropic's best practices with clear applicability_
_Source: [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)_

### Shared Library Architecture (Non-Standard Pattern)

The product brief specifies a shared `lib/` directory for scripts used by 3+ skills and hooks. **This is NOT part of the Agent Skills specification.** The standard defines per-skill `scripts/`, `references/`, `templates/`, and `assets/` directories — not shared directories across skills.

**The tension:** The spec assumes each skill is self-contained with its own subdirectories. A shared `lib/` across skills is a custom organizational choice. This has implications for:

1. **Installation via `npx skills add`:** The skills CLI installs skill directories. A top-level `lib/` directory is not a skill and won't be installed as one. Skills must be able to reference shared scripts after installation.

2. **Portability across install methods:** When a user installs a single skill (`npx skills add zookanalytics/git-workflow --skill commit`), does the shared `lib/` come along? This depends on the CLI's behavior for partial installs.

3. **Progressive disclosure:** Files outside a skill's directory may not follow the standard discovery/loading mechanism.

**Options for handling shared scripts:**

| Approach | Pros | Cons |
|----------|------|------|
| **Duplicate scripts per skill** | Fully self-contained, spec-compliant | DRY violation, maintenance burden |
| **Top-level `lib/` with relative paths** | DRY, matches product brief | Non-standard, may break partial installs |
| **Symlinks from per-skill `scripts/` to shared `lib/`** | Appears self-contained, DRY | Symlinks can break on some platforms |
| **Per-skill `scripts/` that source shared `lib/`** | Each skill has its own entry point, shared logic in `lib/` | Two levels of indirection |

**Recommendation based on research:** The most practical approach for a monorepo package is the **thin wrapper pattern**: each skill has its own `scripts/` directory containing thin wrapper scripts that call into the shared `lib/`. When installed as a complete package, relative paths to `lib/` work. This matches how the product brief already describes the architecture: "each hook is a small wrapper calling shared scripts from `lib/`."

**Key constraint:** This means git-workflow must be installed as a complete package, not as individual skills. This is acceptable — the product brief doesn't envision cherry-picking individual skills.

_Confidence: MEDIUM — the shared lib pattern is well-established in software engineering but is NOT addressed in the Agent Skills spec. Behavior of `npx skills add` with non-skill directories needs verification._
_Sources: [Agent Skills specification](https://agentskills.io/specification), [Vercel agent skills FAQ](https://vercel.com/blog/agent-skills-explained-an-faq)_

### Dual Distribution Architecture (Skills + npm Hooks)

git-workflow has two distinct distribution needs:

1. **Agent Skills** (SKILL.md + scripts) — for AI agent use via `npx skills add`
2. **Git hooks** — for deterministic enforcement without an AI agent via `npm install`

**CRITICAL: These are separate distribution channels.** `npx skills add` only accepts git-based sources (GitHub shorthand, URLs, local paths) — it does NOT support npm packages. The two channels cannot be unified into a single install command.

**Skills distribution (via dedicated GitHub repo):**

The recommended approach is a dedicated GitHub repo (or automated subtree publish) that serves as the skills distribution target:

```
github.com/zookanalytics/git-workflow/    # Dedicated repo (or subtree mirror)
├── skills/
│   ├── commit/
│   │   ├── SKILL.md
│   │   └── scripts/
│   ├── pr-update/
│   │   ├── SKILL.md
│   │   └── scripts/
│   ├── pr-merge/
│   │   └── ...
│   ├── rebase/
│   │   └── ...
│   ├── sync/
│   │   └── ...
│   └── cleanup/
│       └── ...
├── lib/                   # Shared scripts (used by skills and hooks)
└── README.md
```

Install: `npx skills add zookanalytics/git-workflow`
skills.sh identity: `zookanalytics/git-workflow/commit` (clean)

**Hooks distribution (via npm from monorepo):**

The hooks layer installs via npm from the monorepo's published package:

```
npm install @zookanalytics/git-workflow
```

The npm package includes `hooks/` and `lib/` directories, with a postinstall script that sets up git hooks.

**Monorepo as source of truth:** The monorepo (`packages/git-workflow/`) owns CI, testing, changeset infrastructure, and the canonical source code. The dedicated GitHub repo (or subtree) is a distribution artifact, not a separate development target.

**Alternative: skills-npm (third-party):** Anthony Fu's [skills-npm](https://github.com/antfu/skills-npm) proposes bundling skills inside npm packages and using `npx skills-npm` to discover and symlink them. This would allow a single `npm install` to provide both hooks and skills. However, skills-npm is a third-party proposal (not part of the Vercel CLI), and skills installed this way would not appear on the skills.sh leaderboard.

_Confidence: HIGH — verified that `npx skills add` does not accept npm packages as sources. Dual distribution requires separate channels._
_Sources: [Vercel skills CLI](https://github.com/vercel-labs/skills), [skills-npm proposal](https://github.com/antfu/skills-npm/blob/main/PROPOSAL.md)_

### Monorepo Package Structure Pattern

Examining established multi-skill packages reveals consistent structural patterns.

**vercel-labs/agent-skills:**
- Skills in `skills/` directory, each with own subdirectory
- No shared `lib/` — each skill is fully self-contained
- Distribution sub-directories for platform-specific variants (e.g., `skills/claude.ai/`)

**obra/superpowers:**
- Skills repository separated from plugin (v2.0.0+)
- All skills in `skills/` directory with flat structure
- Skills are pure SKILL.md + optional references — minimal scripts
- Auto-cloned to platform-specific location, auto-updated on session start

**anthropics/skills:**
- Reference implementation by Anthropic
- Each skill fully self-contained in its own directory under `skills/`
- Includes a `skill-creator` meta-skill for bootstrapping new skills
- Spec reference at `spec/agent-skills-spec.md`

**Nx agent skills (nrwl/nx-ai-agents-config):**
- Domain-specific skills for monorepo tooling
- Distributed via both `npx skills add` and npm

**Common pattern across all:** Skills directory at repo root or `skills/`, flat skill subdirectories, each skill self-contained. No established precedent for a shared `lib/` directory — this is git-workflow's unique architectural need driven by the hooks layer sharing scripts with skills.

_Confidence: HIGH — based on direct inspection of multiple established packages_
_Sources: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills), [obra/superpowers](https://github.com/obra/superpowers), [anthropics/skills](https://github.com/anthropics/skills), [Nx agent skills](https://nx.dev/blog/nx-ai-agent-skills)_

### Script Architecture: Execute vs. Read

Anthropic's best practices make a critical distinction for skills that include scripts:

**Execute (preferred for utilities):** "Run `scripts/check-state.sh` to verify branch status" — The agent executes the script via Bash. Only the script's **output** enters the context window, not the source code. This is far more context-efficient.

**Read as reference:** "See `scripts/check-state.sh` for the verification algorithm" — The agent reads the script source into context. Use only when the agent needs to understand the logic, not just the result.

**For git-workflow:** Almost all script usage should be "execute" mode. The agent doesn't need to understand *how* branch state is checked — it needs to know *the result* and then make a judgment call based on it. This keeps context budget focused on the AI-essential moments (message crafting, assessment, conflict resolution).

**Feedback loop pattern:** Anthropic recommends "run validator → fix errors → repeat" for quality-critical operations. This maps directly to git-workflow's "guide, not just gate" design: when pre-checks fail, the skill helps resolve the issue and re-checks, rather than simply blocking.

_Confidence: HIGH — directly from Anthropic's best practices_
_Source: [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)_

## Implementation Approaches and Technology Adoption

### Skill Validation Tooling

Two tools exist for validating skills before publishing:

**`skills-ref` (official reference library):** Maintained at [agentskills/agentskills](https://github.com/agentskills/agentskills/tree/main/skills-ref). Provides CLI and Python API for:
- `skills-ref validate path/to/skill` — validates SKILL.md frontmatter against the spec (naming rules, field constraints)
- `skills-ref read-properties path/to/skill` — extracts skill metadata
- `skills-ref to-prompt` — generates `<available_skills>` XML for agent prompts

**Skill Eval (by Minko Gechev):** An evaluation framework for testing skills with real agent behavior. Uses two types of graders:
- **Deterministic graders** — run a shell script and check outcomes (did the file get created? is the metadata correct?)
- **LLM rubric graders** — evaluate qualitative aspects (did the agent follow the correct workflow? did it use the right tool?)
- Each grader returns a score between 0.0 and 1.0 with configurable weights

**LobeHub skill-validator:** Parses SKILL.md, identifies skill type, and applies nine weighted criteria (structure, content, interaction, documentation, domain standards, technical robustness, maintainability, zero-shot readiness, reusability), scoring each 0–3. Useful for pre-release audits and CI quality gates.

**Recommendation for git-workflow:** Use `skills-ref validate` in CI as a minimum quality gate. Consider Skill Eval for regression testing — when a SKILL.md change is made, verify the agent still follows the workflow correctly on representative tasks.

_Confidence: HIGH — tools verified from GitHub repos and documentation_
_Sources: [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref), [Skill Eval](https://blog.mgechev.com/2026/02/26/skill-eval/), [LobeHub skill-validator](https://lobehub.com/skills/panaversity-agentfactory-skill-validator)_

### Skill Development and Testing Workflow

Anthropic recommends a specific iterative workflow for developing skills, which applies directly to building git-workflow's six skills:

**Phase 1 — Identify gaps (evaluation-first):**
1. Run an AI agent on representative git tasks WITHOUT skills installed
2. Document specific failures and missing context (e.g., agent skips pre-commit checks, writes poor commit messages, forgets to verify CI)
3. These failures become the evaluation baseline

**Phase 2 — Write minimal instructions:**
1. Create the SKILL.md with just enough content to address identified gaps
2. Start with the workflow checklist and script references
3. Don't over-document — Claude already knows git

**Phase 3 — The Claude A/B pattern:**
1. **Claude A** (expert) — helps refine the SKILL.md based on observations
2. **Claude B** (user) — uses the skill in real git workflows
3. Observe Claude B's behavior: does it follow all steps? does it skip checks? does it craft good messages?
4. Bring observations back to Claude A for refinements

**Phase 4 — Iterate based on real usage:**
- Watch for unexpected exploration paths or missed connections to important files
- If the agent repeatedly reads a referenced file, consider promoting that content into SKILL.md
- If the agent ignores content, either remove it or make the reference more prominent
- Use stronger language ("MUST filter" instead of "always filter") where compliance is critical

**For git-workflow:** Each skill should be developed one at a time, starting with `commit` (highest priority per product brief). Test with real repositories and real diffs. The "invoke and trust" success criterion means the skill must produce output that doesn't require correction — this requires extensive iteration.

_Confidence: HIGH — directly from Anthropic's official best practices and engineering blog_
_Sources: [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), [Anthropic engineering blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)_

### Shell Script Testing with ShellSpec

git-workflow's shared `lib/` scripts need testing. **ShellSpec** is the leading BDD testing framework for shell scripts:

- Full-featured BDD framework for bash, ksh, zsh, dash, and all POSIX shells
- Implemented in pure POSIX shell — works even in restricted environments (tiny Docker images, embedded systems)
- Features: code coverage, mocking, parameterized tests, parallel execution
- An agent skill already exists for ShellSpec-based testing

**Example test structure for git-workflow scripts:**
```bash
Describe 'check-branch-state.sh'
  It 'detects clean working directory'
    When run script lib/check-branch-state.sh
    The status should be success
    The output should include "clean"
  End

  It 'detects uncommitted changes'
    # Setup: create uncommitted changes
    When run script lib/check-branch-state.sh
    The status should be failure
    The output should include "uncommitted"
  End
End
```

**Recommendation:** Use ShellSpec for unit testing shared `lib/` scripts. These tests run in CI alongside the monorepo's existing `pnpm check` pipeline. The scripts must handle edge cases gracefully with helpful error messages — Anthropic's best practice of "solve, don't punt" means scripts should provide clear diagnostics rather than failing silently.

_Confidence: HIGH — ShellSpec is well-established and appropriate for this use case_
_Sources: [ShellSpec](https://shellspec.info/), [ShellSpec GitHub](https://github.com/shellspec/shellspec), [ShellSpec agent skill](https://claude-plugins.dev/skills/@OleksandrKucherenko/e-bash/shellspec-skill)_

### Publishing Workflow in the Monorepo

The agent-tools monorepo already has changeset infrastructure in place:

**Existing setup:**
- Scope: `@zookanalytics` (convention from existing `packages/*/package.json` files)
- Access: `public` (from `.changeset/config.json`)
- Base branch: `main` (from `.changeset/config.json`)
- Changelog: `@changesets/changelog-github` tied to `ZookAnalytics/bmad-orchestrator`
- GitHub Actions: automated "Version Packages" PRs

**Two publishing workflows are needed:**

**1. npm package (hooks layer):** Published from the monorepo via changesets:
- Add `packages/git-workflow/package.json` with `name: "@zookanalytics/git-workflow"`
- Include `"files": ["lib/", "hooks/"]` to ensure hooks components are published
- Use changesets for versioning — `changeset add` → `changeset version` → `changeset publish`
- CI validates scripts via ShellSpec

**2. Skills distribution (dedicated GitHub repo or subtree):** Since `npx skills add` only accepts git-based sources:
- **Option A — Dedicated repo:** Create `github.com/zookanalytics/git-workflow` containing `skills/`, `lib/`, and README. Maintain manually or via automated sync from monorepo.
- **Option B — Subtree publish:** Use `git subtree push` or a CI action to automatically publish `packages/git-workflow/` to a dedicated repo on each release.
- **Option C — Accept monorepo identity:** Install directly from `ZookAnalytics/bmad-orchestrator` — functional but produces `ZookAnalytics/bmad-orchestrator/commit` on skills.sh.
- CI validates SKILL.md files via `skills-ref validate`

**Recommended:** Option B (subtree publish) — gives clean skills.sh identity (`zookanalytics/git-workflow/commit`) while keeping the monorepo as the single source of truth for development.

**Product brief correction needed:** The product brief specifies `npx skills add @zookanalytics/git-workflow`, but the `@` scoped npm syntax is not supported by the skills CLI. The correct install command would be `npx skills add zookanalytics/git-workflow` (GitHub shorthand).

_Confidence: HIGH — verified that `npx skills add` does not accept npm packages. Subtree publish is a well-established pattern._
_Sources: [Vercel skills CLI](https://github.com/vercel-labs/skills), [Changesets](https://github.com/changesets/changesets), monorepo `.changeset/config.json`_

### Cross-Platform Shell Script Portability

git-workflow's scripts will run in diverse environments (devcontainers, macOS, Linux, CI runners). Portability considerations:

**POSIX compliance for maximum portability:**
- Use `#!/bin/sh` for scripts that don't need bash features
- Use `#!/usr/bin/env bash` for scripts requiring bash-specific features (arrays, string manipulation)
- Avoid bashisms in POSIX scripts: `[[ ]]` → `[ ]`, `$(( ))` is POSIX, `local` is widely supported but not technically POSIX
- Test on both bash and dash (common `/bin/sh` on Debian/Ubuntu)

**git-workflow-specific considerations:**
- All scripts depend on `git` — universally available in development environments
- Some skills depend on `gh` CLI — should be declared in `compatibility` field
- Scripts should use `command -v git` to verify dependencies before proceeding
- Error messages should be descriptive enough for the AI agent to understand and act on

**Recommendation:** Write scripts in bash (not POSIX sh) — git-workflow's target environments (devcontainers, CI, developer machines) all have bash. The portability gain from POSIX sh doesn't justify the development friction for this use case. Declare `compatibility: Requires bash, git, gh CLI` in each SKILL.md.

_Confidence: HIGH — portability considerations are well-understood_
_Sources: [Portable shell scripts guide](https://oneuptime.com/blog/post/2026-01-24-portable-shell-scripts/view), [Shell script performance](https://github.com/jaalto/project--shell-script-performance-and-portability)_

### Risk Assessment and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Shared `lib/` breaks partial install** | Skills fail when installed individually | MEDIUM | Document full-package-only installation; test `npx skills add` behavior with non-skill directories |
| **SKILL.md descriptions don't trigger reliably** | Agent doesn't activate the right skill | HIGH | Follow Anthropic's "pushy" description guidance; test with multiple agents; iterate based on real usage |
| **Context window pressure from 6 skills** | Metadata from all skills consumes tokens | LOW | ~100 tokens per skill × 6 = ~600 tokens — negligible at startup; instructions load only when activated |
| **Skills.sh identity is awkward from monorepo** | Package appears as `org/monorepo/skill` instead of `org/git-workflow/skill` | MEDIUM | Use npm-based distribution path; consider dedicated repo if skills.sh presence matters |
| **Git hooks conflict with existing tooling** | Hooks break `pnpm check` or other CI | MEDIUM | Hooks call shared `lib/` scripts that are tested independently; hooks are thin wrappers |
| **Cross-agent compatibility gaps** | Skills work on Claude Code but fail on Codex/Gemini | MEDIUM | Stick to standard spec fields; write instructions as actions not tool names; test on multiple agents |
| **`allowed-tools` not portable** | Pre-authorization fails on non-Claude agents | LOW | Use `compatibility` for documentation; don't rely on `allowed-tools` for enforcement |
| **Skill Eval not yet mature** | No automated regression testing for skill quality | MEDIUM | Start with manual Claude A/B testing; add Skill Eval when the tool matures |

## Technical Research Recommendations

### Implementation Roadmap

1. **Scaffold the package** — Create `packages/git-workflow/` with `package.json`, `skills/` directory, `lib/`, `hooks/`
2. **Build `commit` skill first** — highest priority, most common operation, establishes patterns for all other skills
3. **Establish testing infrastructure** — ShellSpec for `lib/` scripts, `skills-ref validate` in CI
4. **Iterate with real usage** — Claude A/B pattern on real repositories with real diffs
5. **Build remaining skills** — `pr-update`, `pr-merge`, `rebase`, `sync`, `cleanup` in priority order
6. **Add hooks layer** — thin wrappers calling `lib/` scripts, npm postinstall setup
7. **Set up distribution** — subtree publish to `zookanalytics/git-workflow` repo, changeset release for npm hooks package
8. **Publish and validate** — test `npx skills add zookanalytics/git-workflow` and `npm install @zookanalytics/git-workflow`

### Package Naming Recommendation

| Component | Recommended Name | Rationale |
|-----------|-----------------|-----------|
| npm package (hooks) | `@zookanalytics/git-workflow` | Matches monorepo scope convention |
| GitHub repo (skills) | `zookanalytics/git-workflow` | Clean skills.sh identity via subtree publish |
| Skills install command | `npx skills add zookanalytics/git-workflow` | GitHub shorthand (NOT npm scoped name) |
| Hooks install command | `npm install @zookanalytics/git-workflow` | Standard npm install |
| skills.sh identity | `zookanalytics/git-workflow/commit` | Clean namespace from dedicated repo |
| Skill names | `commit`, `pr-update`, `pr-merge`, `rebase`, `sync`, `cleanup` | Action-oriented, concise, consistent within package |
| Skill directory names | Same as skill names | Spec requires name = directory name |

### Architecture Recommendation

Use the **dual distribution, thin wrapper** architecture:

```
packages/git-workflow/
├── package.json                    # @zookanalytics/git-workflow
├── skills/
│   ├── commit/
│   │   ├── SKILL.md                # < 500 lines, workflow checklist
│   │   ├── scripts/
│   │   │   └── pre-commit-checks.sh  # Thin wrapper → ../../lib/
│   │   └── references/
│   │       └── commit-spec.md      # Project-specific conventions
│   ├── pr-update/
│   │   ├── SKILL.md
│   │   └── scripts/
│   ├── pr-merge/
│   │   ├── SKILL.md
│   │   └── scripts/
│   ├── rebase/
│   │   ├── SKILL.md
│   │   └── scripts/
│   ├── sync/
│   │   ├── SKILL.md
│   │   └── scripts/
│   └── cleanup/
│       ├── SKILL.md
│       └── scripts/
├── lib/                            # Shared scripts (used by skills + hooks)
│   ├── git-state.sh                # Working tree, branch, remote state checks
│   ├── ci-status.sh                # CI/GitHub status checks via gh
│   ├── branch-ops.sh               # Branch operations (create, delete, sync)
│   └── common.sh                   # Shared utilities (error handling, output formatting)
├── hooks/                          # npm-installable git hooks
│   ├── pre-commit                  # Thin wrapper → ../lib/
│   ├── commit-msg                  # Thin wrapper → ../lib/
│   └── install.sh                  # postinstall script for npm
├── tests/                          # ShellSpec tests for lib/
│   └── spec/
└── README.md
```

### Key Design Decisions Summary

| Decision | Choice | Research Basis |
|----------|--------|----------------|
| SKILL.md size | < 500 lines each, use `references/` for overflow | Anthropic best practices |
| Script execution model | Execute mode (not read-as-reference) | Context efficiency — only output enters context |
| Description style | Goal-oriented, third person, "pushy" | Anthropic triggering guidance |
| Naming pattern | Action-oriented imperative (`commit`, `pr-update`) | Consistent within package, concise for invocation |
| Shared scripts | `lib/` with thin per-skill wrappers in `scripts/` | DRY across skills + hooks, accepts full-package-only install |
| Skills distribution | `npx skills add` from dedicated GitHub repo (subtree publish from monorepo) | `npx skills add` only accepts git sources, not npm |
| Hooks distribution | `npm install` via changesets from monorepo | Leverages existing monorepo infrastructure |
| Shell dialect | Bash (not POSIX sh) | Target environments all have bash; portability gain not worth friction |
| Testing | ShellSpec for scripts, `skills-ref validate` for SKILL.md, Claude A/B for workflows | Comprehensive coverage across deterministic and AI-driven components |
| Hooks architecture | Thin wrappers calling `lib/`, installed via npm postinstall | Same scripts as skills, deterministic enforcement without AI |

---

## Technical Research Conclusion

### Summary of Key Findings

The Agent Skills standard is well-suited for packaging git-workflow. The specification is simple (SKILL.md + optional directories), the distribution infrastructure is mature (`npx skills add`, npm, changesets), and cross-agent compatibility is broad (40+ agents). The product brief's architecture — SKILL.md for AI judgment, shell scripts for deterministic checks — aligns precisely with the standard's progressive disclosure model and Anthropic's best-practice guidance on degrees of freedom.

The competitive landscape validates the product vision: no existing package covers the full Commit-to-Cleanup git lifecycle with enforced workflow completeness. The closest analogs are either single-operation skills (commit only) or broader development methodologies that include some git functionality (obra/superpowers). git-workflow occupies a distinct and unserved niche.

The one non-standard architectural element — a shared `lib/` directory — is a pragmatic choice driven by the hooks layer requirement. This is well-understood, testable, and the constraint (full-package installation only) is acceptable given the product's design intent.

### Open Questions for Architecture Phase

1. **`npx skills add` behavior with `lib/`** — Does the CLI copy or symlink non-skill directories when installing from a repo? This needs hands-on verification before finalizing the shared script pattern. If `lib/` is not copied, skills need to be fully self-contained (duplicate scripts) or the install instructions must include a manual step.
2. **Subtree publish automation** — What CI configuration is needed to automatically push `packages/git-workflow/` to the dedicated `zookanalytics/git-workflow` repo on each release? How does this interact with changesets?
3. **Hooks postinstall mechanics** — How should the npm postinstall script locate `.git/hooks/` reliably across monorepo and standalone repo layouts?
4. **Cross-agent description testing** — How do Codex, Gemini CLI, and Cursor differ in skill triggering behavior given the same descriptions?
5. **Product brief correction** — The product brief specifies `npx skills add @zookanalytics/git-workflow` which won't work. Update to `npx skills add zookanalytics/git-workflow` (GitHub shorthand).

### Next Steps

This research provides the technical foundation for the architecture document. The key decisions (package structure, naming, distribution, testing) are all supported by current ecosystem data and official guidance. The architecture phase should formalize these into concrete specifications, resolve the open questions through hands-on prototyping, and produce the detailed design for each of the six skills.

---

**Technical Research Completion Date:** 2026-03-03
**Research Period:** 2026-03-02 to 2026-03-03
**Source Verification:** All facts cited with current sources (March 2026 data)
**Confidence Level:** HIGH — based on official specifications, vendor documentation, and multi-source verification

_This research document serves as the authoritative technical reference for skills.sh packaging decisions in the git-workflow architecture and implementation phases._
