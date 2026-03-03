---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowComplete: true
completedAt: "2026-03-02"
inputDocuments:
  - '_bmad-output/planning-artifacts/monorepo-brief.md'
  - '_bmad-output/project-context.md'
date: 2026-03-01
author: Node
---

# Product Brief: git-workflow

## Executive Summary

git-workflow is a new package in the agent-tools monorepo that provides goal-oriented git skills for AI coding agents. Rather than wrapping individual git commands, each skill enforces **workflow completeness** — ensuring every step in a git operation happens, every time, while the AI adapts *how* each step gets done based on context.

The package distributes skills via skills.sh (compatible with Claude Code, Gemini CLI, Codex, and 18+ other agents) and optionally installs git hooks via npm for deterministic enforcement. It has no runtime dependencies on other monorepo packages — the monorepo provides CI, publishing, and changeset infrastructure, not architectural coupling.

git-workflow serves the **Automate** concern in the agent-tools ecosystem: replacing the repeatable discipline that both humans and AI agents naturally skip in git operations.

---

## Core Vision

### Problem Statement

Git workflows require repeatable discipline: run checks before committing, verify remote state before creating PRs, confirm review feedback is addressed before merging. This discipline isn't hard — it's just easy to skip. AI agents skip it because they aren't given complete instructions every time. Humans skip it because they're managing multiple workstreams and cutting corners is the path of least resistance. The problem isn't capability — it's **consistency at scale**.

### Problem Impact

Every skipped check, incomplete PR, or forgotten cleanup compounds. The developer running multiple AI agents across parallel workstreams faces a choice: constant vigilance auditing every git operation (which doesn't scale), or accumulated sloppiness in git history, branch hygiene, and PR quality (which creates drag). Neither option supports the ecosystem's goal of decreasing human involvement with increasing confidence.

### Why Existing Solutions Fall Short

- **Git hooks** enforce rules but can't adapt — they block a bad commit message but can't craft a good one, can't assess whether a PR description adequately summarizes changes, can't reason about whether review feedback has been addressed
- **Raw AI agent operations** have no enforced checklist — agents handle whatever the prompt mentions and skip everything else, producing inconsistent results across sessions
- **Custom scripts** are brittle, project-specific, and can't travel between projects or agents
- **Detailed manual prompts** work but aren't repeatable — the developer has to remember and write the same instructions every time, which is exactly the discipline problem being solved
- **The existing organic git-workflows package** evolved without a clear vision, has broken hooks, missing commands, and lives outside the monorepo's quality infrastructure

### Proposed Solution

A skills.sh-based package where each skill represents a **goal-oriented workflow** with enforced completeness. Shell scripts handle deterministic operations (run tests, check branch state, verify hooks). SKILL.md instructions guide the AI through judgment calls (craft commit messages, write PR descriptions, assess review status). The skill is the checklist that can't be skipped — but the AI adapts how each item gets accomplished.

Skills don't just gate — they **guide toward readiness**. When pre-checks fail, the skill doesn't simply block; it helps the developer or agent resolve the issue and continue. This makes each skill an iterative problem-solver, not just a pass/fail checkpoint.

The core skill set covers the natural stable-state transitions in a git-based development workflow:

| Skill | From → To |
|-------|-----------|
| **Commit** | Working changes → well-formed commit |
| **PR Update** | Current branch → PR ready for human review (creates if needed) |
| **PR Merge** | Approved PR → merged, synced, cleaned up |
| **Rebase** | Diverged branch → rebased against main |
| **Sync** | Stale local state → current with remote |
| **Cleanup** | Branch cruft → pruned to active branches |

An optional npm-installable hooks layer provides deterministic enforcement even without an AI agent present, complementing rather than duplicating the skills.

### Key Differentiators

- **Enforced workflow completeness**: The skill is the checklist that can't be skipped. Every step happens, every time, regardless of which agent runs it or how distracted the developer is
- **Context-aware execution**: Deterministic steps (run tests, check state) don't consume AI reasoning budget. AI judgment activates only where it adds value (message crafting, status assessment, conflict resolution)
- **Guide, not just gate**: Skills iteratively help reach readiness rather than just blocking on failure — they're problem-solvers, not bouncers
- **Agent-agnostic via skills.sh**: The developer is the constant, not the agent. Skills travel across Claude Code, Gemini CLI, Codex, and any agent supporting the skills standard
- **Progressive disclosure**: SKILL.md loads only when relevant; supporting scripts load only when called. No context bloat
- **Independent hooks layer**: npm-installable git hooks provide deterministic enforcement even without an AI agent, serving as a safety net for the discipline gap

---

## Target Users

### Primary User

**Node — Solo developer running parallel AI workstreams.** Manages multiple AI agents across concurrent development tasks daily. Comfortable with containers, terminal workflows, and AI-assisted development. Uses agent-env for isolation, keystone-workflows for automation, and expects git operations to be handled with the same discipline whether invoked directly or by automated workflows.

**Daily context:** Doesn't call commit often anymore — agents and keystone workflows handle that as part of larger automated sequences. Directly invokes higher-level skills like PR Update ("orchestrate this to PR-ready") and PR Merge ("I'm signing off, take it from here") as natural handoff points where human judgment has been applied and everything after should be automated. The act of invoking a skill *is* the sign-off.

**Core need:** "Check more so I don't have to." Every check the skill handles autonomously — verifying CI on main post-merge, confirming review feedback is addressed, pruning stale branches — is attention recovered for actual development decisions. The value of git-workflow scales with the number of parallel workstreams running.

**Frustration:** Manual verification steps that should be automated. Checking CI status on main after a merge. Auditing whether an agent wrote a proper commit message. Confirming remote state before creating a PR. These are discipline tasks, not judgment tasks — and they should be handled without human attention.

**Customization expectation:** Skills should discover and respect existing project conventions (commit specs, PR templates, CI configuration) with minimal explicit setup. The goal is near-zero configuration — skills read what's already there.

### Secondary User: AI Agents and Automated Workflows

AI coding agents (Claude Code, Gemini CLI, Codex) and automated workflow systems (keystone-workflows) are the primary *executors* of git-workflow skills. They consume SKILL.md instructions and run supporting scripts as part of larger automated sequences.

**Key characteristic:** Agents are functionally interchangeable once skills.sh compatibility is met. The skills must be written so any compliant agent can execute them reliably. The AI agent needs to understand the *purpose* of each skill — not just the mechanical steps — so it can adapt when conditions aren't ideal and so the skills can evolve effectively over time.

**Automated-first design:** Skills are written to complete autonomously — they always finish the workflow and report what happened. When a human invokes a skill, the agent naturally shows its work. When a workflow invokes it, the skill executes to completion or exits with a clear error. No mode flag or conditional logic — the agent's own context determines verbosity.

**Composability requirement:** Skills are building blocks. A keystone workflow might invoke commit as one step in a larger sequence. PR Update might be called by an agent mid-workflow or by the human as a standalone sign-off. Skills must work both as standalone invocations and as components in larger automated chains.

### User Journey

1. **Installation:** `npx skills add zookanalytics/git-workflow` — skills appear in the agent's available commands. Optional `npm install @zookanalytics/git-workflow` adds git hooks for deterministic enforcement.
2. **Calibration:** Skills discover existing project conventions (commit spec, PR templates, CI config). Developer validates that the skill understands the project's standards — a brief alignment step, not a configuration project.
3. **First use:** Developer invokes `/commit` after a coding session. The skill runs checks, crafts a message respecting the project's commit spec, and produces a clean commit. Developer thinks: "that's what I used to do manually in 5 steps."
4. **Daily use:** Skills become invisible infrastructure. Agents call commit as part of automated workflows. Developer calls PR Update when signing off on work, PR Merge when CI is green. The manual checklist disappears.
5. **Value moment:** Developer merges a PR, and the skill automatically verifies CI passes on main, syncs local state, and cleans up the branch — steps that used to require switching to GitHub, waiting, checking, and running manual cleanup.
6. **Long-term:** Each new check added to a skill is attention permanently recovered. The skills evolve as the workflow evolves, encoding institutional knowledge about "how we do git here."

---

## Success Metrics

### How We Know It's Working

Success for git-workflow is measured by reliability and attention cost, not adoption curves or engagement metrics. This is a personal tool ecosystem — the bar is: saves more attention than it costs.

**Primary success signal:** Each skill reliably produces its intended outcome without human correction. A commit skill that generates a message you have to rewrite is a failure. A PR Merge skill that requires you to manually check CI afterward hasn't earned its place. The standard is: invoke and trust.

**Day-one trust expectation:** Skills must be fully automated from first use. There is no "warm-up period" where the developer audits skill output. If a skill requires human verification to be trusted, it's not ready to ship. Trust is the baseline, not a milestone.

### Failure Signals

These indicate the package is not delivering value:

- **Errors in execution** — Skills fail during normal operation, requiring manual recovery
- **Hook conflicts** — The hooks layer breaks the development workflow or conflicts with other tooling
- **Decision cycling** — The AI portion of a skill loops trying to figure out what to do instead of making a clear decision. This signals the SKILL.md instructions aren't fully specified
- **Post-skill correction** — The developer regularly edits or fixes skill output (commit messages rewritten, PR descriptions amended, merge cleanup incomplete)
- **Broken composability** — Skills fail when invoked by automated workflows (keystone) that work fine when invoked interactively

### How We Know It's Failing

**The rebuild wasn't worth it if:** the brief doesn't usefully guide evolution of the skills. If the package ends up being a straight migration of the existing organic git-workflows with no meaningful improvement in reliability or scope, the planning overhead wasn't justified. The brief's value is proven iteratively — each time it informs a design decision that the organic approach would have gotten wrong.

**The ecosystem test:** git-workflow costs more attention than it saves. If maintaining the skills, debugging hooks, and updating SKILL.md files consumes more time than the manual git ceremony it replaces — it's overhead, not infrastructure.

### Business Objectives

N/A. This is a personal tool ecosystem. No revenue, growth, or market targets. The quality bar is: good enough to publish without embarrassment. The success bar is: saves more attention than it costs.

### Key Performance Indicators

| Indicator | Target | Measurement |
|-----------|--------|-------------|
| Skill completion rate | 100% of invocations complete without error | Skill exits cleanly (no manual recovery needed) |
| Post-skill correction rate | 0% — output accepted as-is | Developer doesn't edit skill output |
| Composability | All skills work in both interactive and automated modes | Keystone workflows invoke skills without failure |
| Decision cycling | Zero — AI makes clear decisions on first pass | No observable loops or hesitation in skill execution |
| Hook stability | Zero conflicts with existing dev workflow | Hooks don't break `pnpm check` or other tooling |

---

## MVP Scope

### Core Features

**Six skills with enforced workflow completeness, in development priority order:**

| Priority | Skill | Description | Key AI-Essential Moment |
|----------|-------|-------------|------------------------|
| 1 | **Commit** | Working changes → well-formed commit. Run pre-checks, stage appropriately, craft commit message respecting project spec | Message crafting: AI reads the diff and writes a "why" message, not just a "what" |
| 2 | **PR Update** | Current branch → PR ready for human review. Creates PR if needed, ensures CI passes, description is complete, all checks satisfied | PR description: AI summarizes the full changeset and connects it to the work being done |
| 3 | **PR Merge** | Approved PR → merged, synced, cleaned up. Verifies approval, CI green (including post-merge CI on main), syncs local, removes branch | Post-merge verification: AI monitors CI on main and confirms clean state |
| 4 | **Rebase** | Diverged branch → rebased against main. Fetches latest, rebases safely, handles conflicts or reports clearly | Conflict assessment: AI evaluates whether conflicts are resolvable or need human attention |
| 5 | **Sync** | Stale local state → current with remote. Fetch, pull main, assess branch status, report what needs attention | Status assessment: AI provides a situational summary of what's changed and what needs action |
| 6 | **Cleanup** | Branch cruft → pruned to active branches. Remove local branches tracking deleted remotes, report what was cleaned | Safety check: AI verifies nothing with uncommitted work gets pruned |

All skills ship at the same quality bar. Priority order guides development sequence, not quality expectations.

**Hooks layer:**
- npm-installable git hooks providing deterministic enforcement independent of AI agents
- Hooks and skills share the same context-agnostic scripts — scripts take explicit arguments, never assume execution context
- Trivially thin: each hook is a small wrapper calling shared scripts from `lib/`
- Must not conflict with existing development tooling (`pnpm check`, CI pipeline)

**Distribution:**
- Installable via `npx skills add` from the repository
- Not published to the skills.sh public directory/index
- Package lives in monorepo as `packages/git-workflow/`

**Project conventions:**
- v1 skills reference known convention paths directly in each SKILL.md (e.g., `docs/commit_specification.md`, `.github/pull_request_template.md`)
- No discovery scripts or fallback mechanisms in v1 — skills document which paths they read
- Automated convention discovery is a v2 portability enhancement

**Illustrative package structure:**

```
packages/git-workflow/
  skills/
    commit/
      SKILL.md
      scripts/
    pr-update/
      SKILL.md
      scripts/
    pr-merge/
      SKILL.md
      scripts/
    rebase/
      SKILL.md
      scripts/
    sync/
      SKILL.md
      scripts/
    cleanup/
      SKILL.md
      scripts/
  lib/                   ← shared scripts (used by 3+ skills and hooks)
  hooks/
  package.json
```

Structure is illustrative — some skills may need per-skill scripts, others may rely entirely on shared `lib/` utilities.

### Architectural Decisions (Preliminary)

These capture intent for the product brief. They will be formalized in the architecture document.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Skill structure** | Self-contained skill dirs + shared `lib/` for common utilities | Balance between skill independence and DRY |
| **Hook architecture** | Hooks and skills call the same context-agnostic scripts via explicit arguments | Single source of truth; hooks work without AI |
| **Execution model** | Skills written to complete autonomously; agent's context determines verbosity | No mode flag needed; simplest correct approach |
| **Convention handling** | Skills reference known paths directly; discovery is v2 | Near-zero complexity for single-user tool |

### Out of Scope for MVP

- **Cross-repo operations** — Skills operate within a single repository
- **Custom skill authoring framework** — No tooling for users to create their own git skills
- **Orchestrator/agent-env integration** — No direct package dependencies (agent-env installing it is a separate, simple update)
- **Public skills.sh directory listing** — Install from repo, not from the public index
- **Skills beyond the six defined** — No additional git operations until the core set is solid
- **Non-git workflows** — Skills are strictly git-scoped
- **Convention discovery mechanism** — No discovery scripts, fallback paths, or config file in v1

### MVP Success Criteria

- All six skills execute reliably and complete autonomously
- Feature parity with existing git-workflow package achieved
- Hooks install cleanly, share scripts with skills, work without AI context, and don't conflict with existing tooling
- Skills are composable — keystone-workflows can invoke them as building blocks
- Zero post-skill correction needed in normal operation

### Future Vision

The primary open question for post-MVP is **packaging architecture**: does git-workflow remain a single package containing all skills, decompose into focused packages (one per skill or skill group), or spin out of the monorepo entirely? This decision depends on:

- Whether community-contributed skills become relevant (skills.sh ecosystem maturity)
- Whether individual skills benefit from independent versioning and release cycles
- Whether the monorepo's infrastructure overhead is justified for what's fundamentally shell scripts and markdown

Other future considerations:
- Additional skills as new git workflow patterns emerge from daily use
- Automated convention discovery for portability across projects
- Community skill compatibility — working well alongside other published git-related skills
- Configuration file for convention path overrides in non-standard project layouts

The principle: ship what works for the primary user. Decompose only when there's a concrete reason, not speculatively.
