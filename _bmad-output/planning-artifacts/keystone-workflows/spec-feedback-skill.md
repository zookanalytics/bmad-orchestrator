# Spec: Ecosystem Feedback Skill

## Context

The ecosystem brief (ADR-3, External Repo Intake) establishes that external repos contribute improvements by filing GitHub issues in the orchestrator repository. This spec defines a skill that makes that intake structured, discoverable, and high-quality.

## What

A command + skill (e.g., `/keystone:feedback`) distributed to consuming repos that guides an agent through creating a well-formed GitHub issue in the orchestrator repository. The skill embeds institutional knowledge — the routing heuristic, what makes a good issue, the target repo — so that consuming repos don't need to understand the ecosystem architecture to contribute useful feedback.

## Why

Without a structured intake mechanism, process improvements surface in retrospectives and code reviews but have no standardized path back to the orchestrator repo. The result is either: improvements get lost, they get implemented as local BMAD core file modifications (which break on upgrade), or they arrive as vague issues that require round-tripping for clarification.

The skill ensures feedback arrives with enough context to act on — classified by layer, with clear trigger and desired behavior — so an agent in the orchestrator repo can pick it up and implement without ambiguity.

## Behavior

### Invocation

Command trigger: `/keystone:feedback` (or equivalent for non-Claude platforms).

### Flow

1. **Gather context** — The agent collects from the user or infers from session context:
   - What triggered this (retro finding, bug, observed friction, idea)
   - What should happen that doesn't today
   - What workflow, step, or tool is affected
   - Source repo name and relevant file paths for context

2. **Classify** — The agent applies the routing heuristic from the ecosystem brief to determine which layer owns the implementation:
   - Skill + keystone policy step
   - Keystone workflow definition
   - Git-workflow skill or hook
   - CI / GitHub Actions
   - Upstream BMAD issue
   - Project config or detection logic

   Classification becomes issue labels (e.g., `layer:skill`, `layer:keystone`, `layer:git-workflow`, `layer:ci`, `upstream:bmad`, `layer:project-config`).

3. **Check for duplicates** — Search existing issues in the target repo using `gh issue list --search`. Surface potential matches. If a match exists, offer to append context to the existing issue instead of creating a new one.

4. **Format** — Produce a structured issue body:

   ```markdown
   ## Trigger
   [What surfaced this — retro finding, bug, friction, idea]

   ## Source
   - **Repo:** [consuming repo name]
   - **Affected area:** [workflow/step/tool]
   - **Files:** [relevant paths, if applicable]

   ## Desired Behavior
   [What should happen that doesn't today]

   ## Routing Classification
   - **Layer:** [skill / keystone / git-workflow / ci / upstream-bmad / project-config]
   - **Rationale:** [Why this classification]
   ```

5. **Create** — Issue created directly via `gh issue create` against the orchestrator repo with appropriate labels. The skill hardcodes the target repo so consuming environments don't need to configure it.

### Failure Handling

If `gh` CLI is unavailable or lacks permissions to the target repo, the skill outputs the formatted issue body and provides the URL to create it manually. Graceful degradation, not a hard failure.

## Distribution

The skill ships as part of keystone-workflows (or git-workflows, whichever is the broader distribution vehicle). For Claude, it installs as a skill/command in `.claude/skills/` or `.claude/commands/`. For Gemini and Codex, it will use whatever platform-equivalent delivery mechanism is defined by the cross-platform skill distribution convention described in ADR-4 and any subsequent cross-platform skill distribution design work.

The skill content (the markdown instructions) is provider-neutral. The delivery wrapper is platform-specific.

## Dependencies

- Ecosystem brief must include the routing heuristic (done — Development Process Architecture section)
- Target orchestrator repo must be identified and hardcoded in the skill
- `gh` CLI must be available in the consuming environment for direct issue creation (graceful degradation if not)
- Cross-platform skill distribution convention should be established before distributing to Gemini/Codex (Claude-first is acceptable for MVP)

## Open Questions

- Should this be a keystone-workflows command (`/keystone:feedback`) or a git-workflows command (`/git:feedback`)? Depends on which package has broader distribution reach. Could also be a standalone micro-package.
- Should the skill support appending to existing issues when duplicates are found, or just link to them?
- Label taxonomy for the orchestrator repo — create labels upfront or let them emerge?
