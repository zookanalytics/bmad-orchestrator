# Epic env-8 Retrospective

**Epic:** env-8 - Growth — Repo Registry & VS Code Purpose
**Date:** 2026-03-01
**Facilitator:** Bob (Scrum Master)
**Status:** Complete

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories Completed | 3/3 (100%) |
| Tests (start → end) | 795 → 816+ agent-env |
| New Tests Added | 39 across stories 8-1 through 8-3 |
| Code Review Rounds | 3 stories reviewed, all approved |
| Issues Found in Review | 0 HIGH, 5 MEDIUM (all fixed), 5 LOW (3 fixed, 2 informational) |
| Debug Issues During Dev | 0 (8th consecutive epic) |
| Human Intervention During Dev | 0 (8th consecutive epic) |
| Post-Story Commits | 7 (tech spec implementation + 5 follow-up fixes + changeset) |
| Tech Specs Created | 1 (status-bar-template-resolution — implemented) |

### Stories Delivered

1. **env-8-1**: Repo registry command — 18 new tests, review approved (0H/3M/2L, all pattern-consistent)
2. **env-8-2**: Create from registered repo — 15 new tests, review approved with fixes (0H/2M fixed/3L)
3. **env-8-3**: VS Code purpose visibility via better-status-bar — 6 new tests + 4 updated, review approved with fixes (0H/3M fixed/3L fixed)

### Additional Work

- **Tech spec**: status-bar-template-resolution — 14 tasks, 13 ACs, 41 adversarial review findings. Implemented in commit `eb2e8e4`.
- **Post-merge fixes** (5 commits on `feat/agent-env-status-bar-and-repo-features`):
  - `6d8a7a0`: Narrow `configSource` type to `'baseline' | 'repo'` union; stale doc comment
  - `457b8b5`: Copilot review — JSON escape vulnerability, case-insensitive slug, deterministic URL selection, widened VS Code settings type
  - `eeb001f`: Filewatcher for live status bar refresh (discovery: extension doesn't auto-reload)
  - `803f995`: Filewatcher merge instead of overwrite (preserve existing commands)
  - `5594ef2` + `bc12521`: Changeset (then corrected for accuracy)

### FRs Delivered

- FR51: Track repos in local registry ✅
- FR52: List tracked repos ✅
- FR53: Create from registered repo ✅
- FR54: VS Code purpose visibility ✅ (required tech spec + 3 rounds of extension behavior discovery)

### What It Delivers

- `agent-env repos` command lists tracked repositories (derived from workspace state, no separate registry)
- `agent-env create <name> --repo <slug>` creates instances from known repos without re-entering URLs
- VS Code status bar shows instance purpose via `better-status-bar` extension integration
- `applyBaselinePatches()` consolidated devcontainer.json patching (single read-modify-write cycle)
- Template fallback resolution: `.vscode/` repo override → `.agent-env/` default → error
- Filewatcher triggers `betterStatusBar.refreshButtons` on external `statusBar.json` changes

## Team Participants

- Alice (Product Owner)
- Bob (Scrum Master) - Facilitator
- Charlie (Senior Dev)
- Dana (QA Engineer)
- Elena (Junior Dev)
- Node (Project Lead)

## What Went Well

### Successes

1. **Repo registry design — derived, not maintained**
   - No separate registry file. Repos derived from workspace scan + state.json
   - Registry always reflects reality — removing all instances for a repo removes it from listing
   - Follows existing patterns: `listRepos()` mirrors `listInstances()` DI pattern

2. **Automation streak continues**
   - 8th consecutive epic with zero debug issues during dev
   - 8th consecutive epic with zero human intervention
   - Pipeline — planning artifacts, DI pattern, code review loop — remains self-sustaining

3. **Single-day implementation velocity**
   - All 3 stories implemented and reviewed on 2026-02-26
   - Sequential story design: registry command → create from slug → VS Code integration
   - Each story built cleanly on the previous

4. **DI pattern maturity**
   - All new modules follow established `Partial<Deps>` injection pattern
   - Story 8.1 was essentially "do what `listInstances` does but aggregate by repo"
   - Pattern enables consistent automation and testing

5. **Tech spec thoroughness**
   - When FR54 gap was discovered, response was a proper 14-task spec with adversarial review
   - 41 adversarial findings addressed before implementation
   - `applyBaselinePatches()` consolidation fixed pre-existing rebuild gap (`patchContainerEnv` was missing)

6. **100% retro action item follow-through — fourth consecutive epic**
   - 10/10 action items from env-7 retro completed (verified via followup tracker)
   - All critical path items done before Epic 8 stories started

7. **Copilot second-pass review added real value**
   - Caught JSON escaping vulnerability missed by story review + tech spec adversarial review
   - Caught slug case-sensitivity gap (behavior fixed, L1 from story review)
   - Caught non-deterministic URL selection in `listRepos()`

## Challenges & Growth Areas

### Issues Identified

1. **FR54 required three rounds of discovery about `better-status-bar` extension**
   - Round 1 (Story 8.3): Extension requires `configurationFile` setting — feature was non-functional as shipped
   - Round 2 (Tech spec): Fixed config, relocated template/output, added fallback resolution
   - Round 3 (Post-merge): Extension doesn't auto-reload when file changes externally — added filewatcher
   - Root cause: Extension documentation was available but not consulted before implementation. Working reference existed.

2. **JSON escaping vulnerability survived multiple review layers**
   - Purpose text with quotes or backslashes would produce invalid JSON in `statusBar.json`
   - Missed by Story 8.3 code review AND tech spec adversarial review (41 findings, none caught this)
   - Caught by Copilot second-pass review
   - Basic string-into-JSON correctness issue

3. **Retro followup tracker and retro document out of sync**
   - All 10 env-7 action items completed (followup YAML all `done`)
   - But env-7 retro `.md` file preparation checklist still showed items unchecked
   - Nearly produced a false 15% follow-through assessment in this retro
   - Root cause: followup process updates YAML tracker but not source retro document

4. **VS Code integration points are manual-verification-only territory**
   - No automated test can verify extension behavior, status bar rendering, filewatcher triggers
   - Multiple integration surfaces discovered iteratively rather than upfront
   - Need explicit manual verification step at epic completion for non-automatable features

### Root Cause Analysis

The FR54 discovery rounds stem from insufficient upfront research on third-party dependencies. The `better-status-bar` extension README documents both the `configurationFile` requirement and the lack of auto-reload. Reading the docs before implementing would have avoided rounds 1 and 3 entirely.

The JSON escaping gap reflects a blind spot in both human review and adversarial review — neither specifically audits string interpolation into structured formats (JSON, YAML, etc.) as a category. Copilot's pattern-matching approach caught it because it evaluates code patterns without the cognitive load of a 41-finding adversarial review.

The retro document sync issue is a workflow gap — the followup YAML is the execution tracker, but the retro workflow reads the markdown document. Without writeback, the two diverge.

## Previous Retro Follow-Through

### Action Items from Epic env-7 Retro

| # | Action Item | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Extract `resolveRepoOrExit()` shared helper | ✅ Completed | Followup YAML — quick-dev workflow |
| 2 | Add CLI integration tests for `--repo` flag | ✅ Completed | Followup YAML — quick-dev workflow |
| 3 | Fix sprint status for Story 7-3 | ✅ Completed | Followup YAML + sprint-status.yaml |
| 4 | Add malformed `--repo` input validation | ✅ Completed | Followup YAML — quick-dev workflow |
| 5 | Reconstruct Story 7-1 artifact | ✅ Completed | Followup YAML — quick-dev workflow |
| 6 | Evaluate TEA agent integration | ✅ Completed | Followup YAML — coverage_levels reverted, config.yaml retained |
| 7 | Create epic-level audit guidance doc | ✅ Completed | Followup YAML — manual |
| 8 | Add pre-retro extraction workflow step | ✅ Completed | Followup YAML — manual |
| 9 | Remove dead `extractRepoName()` export | ✅ Completed | Followup YAML — quick-dev workflow |
| 10 | Address `MAX_CONTAINER_NAME_LENGTH` | ✅ Completed | Followup YAML — quick-dev workflow |

**Score: 10/10 completed (100%) — fourth consecutive epic at 100%**

**Note:** The env-7 retro `.md` file's preparation checklist was not updated to reflect these completions. The followup YAML (`epic-env-7-retro-2026-02-18.followup.yaml`) is the source of truth. This discrepancy is addressed in Action Item #1 below.

### Team Agreements from env-7 Retro

| Agreement | Status in env-8 |
|-----------|-----------------|
| Code review remains the verification mechanism | ✅ APPLIED — 3 stories reviewed, 5 Medium caught |
| "Second occurrence = investigate deeply" | ✅ APPLIED — dead/unused code pattern noted |
| Query actual state, don't assume derived values | ✅ APPLIED — `listRepos()` reads from `state.json` |
| Embed actions in stories, not as orphan follow-ups | ✅ APPLIED — all env-7 action items completed via followup tracker |
| Multi-model review for complex/cross-module stories | ✅ APPLIED — Story 8.3 + tech spec got thorough review; Copilot second-pass added |
| MEMORY.md gotchas working | ✅ APPLIED — known patterns handled |
| Story artifact files mandatory | ✅ APPLIED — all 3 stories have artifact files |
| Sprint status updated to `done` as part of review completion | ⚠️ PARTIAL — env-epic-8 still `in-progress` despite all stories done |

**Score: 7.5/8 applied (~94%)**

## Key Insights

1. **Research third-party dependencies before implementing against them** — the `better-status-bar` extension docs described all three behaviors we discovered iteratively. Upfront research would have collapsed three rounds into one.

2. **Multi-layer review catches different bug classes** — story review catches architectural and pattern issues; Copilot catches string handling, escaping, and edge cases. They complement, not duplicate.

3. **Retro followup must write back to source document** — the YAML tracker is the execution layer, but the retro markdown is what future retros read. Without sync, false signals propagate.

4. **Manual integration verification needs a generic epic-completion step** — any feature touching external tools (VS Code extensions, tmux, SSH) needs explicit manual sign-off. Scope this generically, not per-tool.

## Technical Debt

Items tracked in sprint-status `FUTURE WORK / BACKLOG IDEAS` section with trigger-based resolution:

| # | Item | Source | Priority | Trigger |
|---|------|--------|----------|---------|
| 1 | Generic devcontainer.json customization system | env-epic-2 | LOW | When more per-instance customizations arise (partially addressed by `applyBaselinePatches()`) |
| 2 | InteractiveMenu.test.tsx flaky test | env-8-2 review (L2) | LOW | Next InteractiveMenu modification or test reliability sweep |
| 3 | Slug case-sensitivity test | env-8-2 review (L1) | LOW | Next resolve-repo-arg.ts modification (behavior fixed, test missing) |
| 4 | Spy-based statusBar integration tests | env-8-3 review (M3) | LOW | Next purpose-instance.ts modification |
| 5 | Math.max(...spread) guard in repos | env-8-1 review (M3) | LOW | If repo count scaling becomes a concern |
| 6 | Normalize process.exitCode cleanup | env-8-1 review (L2) | LOW | During test infrastructure cleanup |

## Action Items

### Critical Path (must complete before next work starts)

| # | Action | Owner | Success Criteria |
|---|--------|-------|------------------|
| 1 | Remove backwards compat scaffolding in state.json scanner | Dev (Amelia) | Pre-Epic-7 workspace format handling removed; all workspaces assumed repo-scoped; tests updated; all tests pass |

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|--------|-------|------------------|
| 2 | Update retro followup process to write back to source retro document | SM (Bob) | When followup YAML items are marked `done`, corresponding status in source retro `.md` is updated. Future retros see accurate data from single source. |
| 3 | Add post-epic manual integration verification step to workflow | SM (Bob) | Generic workflow step at epic completion: scans story ACs and tech specs for non-automatable integration points, produces verification checklist, requires sign-off. Covers any manual-only surface (VS Code, tmux, SSH, etc.) |
| 4 | Research external dependencies upfront before implementation | Team agreement | When a story depends on a third-party extension or tool, read its documentation and verify assumptions before writing code. Document verified behavior in story dev notes. |

### Team Agreements

**Carried from previous epics:**
- Code review remains the verification mechanism (carried — 8th consecutive epic)
- "Second occurrence = investigate deeply" (carried from env-4)
- Query actual state, don't assume derived values (carried from env-4)
- Embed actions in stories, not as orphan follow-ups (carried from env-4)
- Multi-model review for complex/cross-module stories (carried from env-5)
- MEMORY.md gotchas working — keep maintaining (carried from env-5)
- Story artifact files mandatory for all stories (carried from env-7)
- Sprint status updated to `done` as part of review completion step (carried from env-7)

**New:**
- **Research third-party dependencies before implementing against them** — read docs, verify assumptions, document in dev notes
- **Copilot (or equivalent) second-pass review adds value** — catches correctness issues that slip through story-level review

## Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Testing & Quality | ✅ OK | 816+ automated tests, type-check clean, manual VS Code verification done |
| Deployment | ⏳ Pending | Merge `feat/agent-env-status-bar-and-repo-features` to main post-retro |
| Stakeholder Acceptance | ✅ OK | Node validated FR51-54 via local usage with real repos and VS Code |
| Technical Health | ✅ OK | Codebase solid, no fragility concerns |
| Unresolved Blockers | ✅ None | All captured in action items |

## Next Steps

1. **Merge branch** `feat/agent-env-status-bar-and-repo-features` to main
2. **Remove backwards compat scaffolding** (Action Item #1 — critical path)
3. **Update env-epic-8 status** to `done` in sprint-status.yaml
4. **Execute process improvements** (Action Items #2-4)
5. **No env-epic-9 defined** — agent-env MVP + Growth features complete

## Retrospective Meta

**Format:** Party Mode with natural team dialogue
**Duration:** Full workflow execution
**Document saved:** `_bmad-output/implementation-artifacts/epic-env-8-retro-2026-03-01.md`
