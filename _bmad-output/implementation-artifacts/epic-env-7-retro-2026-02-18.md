# Epic env-7 Retrospective

**Epic:** env-7 - Naming Model, Multi-Instance & Baseline Prompt
**Date:** 2026-02-18
**Facilitator:** Bob (Scrum Master)
**Status:** Complete

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories Completed | 5/5 (100%) |
| Tests (start → end) | 678 → 683 agent-env (753 total across all packages) |
| New Tests Added | ~70 across stories 7-2 through 7-5 |
| Code Review Rounds | 4 stories reviewed (Story 7-1 has no review record) |
| Issues Found in Review | 1 HIGH, 12 MEDIUM, 6 LOW across 4 reviewed stories |
| Debug Issues During Dev | 3 (all in Story 7-3, all minor — test fixtures and naming) |
| Human Intervention During Dev | 0 |
| Commits | 8 (5 stories + 2 follow-ups + 1 pre-epic readiness) |

### Stories Delivered

1. **env-7-1**: Refactor workspace naming and state schema for repo-scoped instances — no story artifact file (done per sprint status, commit `a86a099`)
2. **env-7-2**: Repo slug derivation, compression, and instance name validation — 1 review round (2 MEDIUM fixed, 4 LOW)
3. **env-7-3**: Two-phase repo resolution for commands — 1 review round (4 MEDIUM fixed, 4 recommendations noted)
4. **env-7-4**: Source repo in list output — 1 review round (2 MEDIUM fixed, 1 MEDIUM noted, 1 LOW)
5. **env-7-5**: Baseline config prompt with flag overrides — 1 review round (1 HIGH fixed, 3 MEDIUM fixed, 1 LOW)

### FRs Delivered

FR43, FR45, FR27 (revision)

### What It Delivers

- Multiple instances from same repo with user-chosen names
- Flat workspace layout with repo-scoped naming: `~/.agent-env/workspaces/<repo-slug>-<instance>/`
- Repo slug derivation and compression for long names (>39 chars)
- Two-phase repo resolution (repo context from `--repo`/cwd, then instance lookup)
- Source repo visible in `list` output with `--repo` filter
- Updated state schema (`name` → `instance`, adds `repoSlug`, `repoUrl`)
- Baseline config prompt for repos with `.devcontainer/` (+ `--baseline`/`--no-baseline` flags)

## Team Participants

- Alice (Product Owner)
- Bob (Scrum Master) - Facilitator
- Charlie (Senior Dev)
- Dana (QA Engineer)
- Elena (Junior Dev)
- Node (Project Lead)

## What Went Well

### Successes

1. **Naming model refactor landed cleanly**
   - Real usability improvement — users create multiple instances per repo with short, memorable names
   - Foundation for everything that follows in Epics 8+

2. **Flat layout architecture decision caught pre-implementation**
   - Epic 6 retro followup Action 1 uncovered that nested layout (`workspaces/<repo-slug>/<instance>/`) would break `localWorkspaceFolderBasename` uniqueness, affecting named Docker volumes, `AGENT_INSTANCE`, and container naming
   - Switched to flat layout before writing any code — retro followup process saved the epic

3. **Automation streak continues**
   - 7th consecutive epic with zero human intervention during dev
   - 7th consecutive epic with zero debug issues (Story 7-3's 3 minor fixture issues resolved during dev)
   - Pipeline — planning artifacts, DI pattern, code review loop — is a self-sustaining system

4. **Sequential story design enabled clean velocity**
   - All 5 stories implemented and reviewed in a single day
   - Each story built cleanly on the previous: schema refactor → slug derivation → resolution → list output → baseline prompt
   - Zero blocking dependencies between stories

5. **100% retro action item follow-through — third consecutive epic**
   - 3/3 action items from env-6 retro completed
   - Action item 1 (update Story 7.1 consumers) was the most valuable single retro action item to date

6. **Constraint arithmetic for container name limits**
   - `ae-` (3) + repo slug (max 39) + `-` (1) + instance (max 20) = 63 chars (Docker limit)
   - Structural constraint instead of runtime validation — names physically cannot exceed limit

7. **Callback pattern for askUser (Story 7-5)**
   - `node:readline` instead of Ink for baseline config prompt
   - Kept create command simple, avoided React lifecycle for one-shot question
   - Boring-technology choice that prevents future headaches

## Challenges & Growth Areas

### Issues Identified

1. **Story 7-1 has no story artifact file**
   - Foundation story (state schema refactor, all consumer updates, grep -qF fix) has no dev notes, debug log, or review record
   - Most critical story in the epic is undocumented
   - Cannot retrospect on patterns that may have caused downstream issues (e.g., DI leak in Story 7-3)

2. **Sprint status tracking wrong in 50% of reviewed stories**
   - Story 7-3: left at `review` when effectively done (2 reviews completed, fixes applied, committed)
   - Story 7-4: showed `in-progress` during review phase
   - Pattern: status updates treated as afterthought rather than part of review completion

3. **Test completeness gaps**
   - Story 7-5: Task 1.4 marked complete but mutual exclusion test didn't exist (HIGH in review)
   - Story 7-3: No CLI-level integration tests for `--repo` flag
   - Story 7-3: DI leak — `removeInstance()` and `setPurpose()` passed raw `readFile` instead of injected deps; tests didn't catch it because they weren't testing through the DI boundary
   - Test *architecture* review is a gap distinct from code review

4. **Orphaned review recommendations**
   - Story 7-3 review noted 4 recommendations as "future work" — not embedded in any story or tracked in backlog
   - Items living only in story files have no follow-up system
   - Gap between "written down" and "in a system that ensures follow-up"

5. **Growing command boilerplate duplication**
   - Same 12-line `resolveRepo` → error check → `process.exit` block copy-pasted in `attach.ts`, `remove.ts`, `purpose.ts`, `rebuild.ts`
   - Per-story duplication acceptable; epic-level accumulation needs structural audit

### Root Cause Analysis

The test completeness gaps stem from relying solely on code review to catch missing test layers. Code review is diff-scoped — it catches bugs in changed code but doesn't assess whether the *right kinds of tests* exist. A test architecture review (TEA agent) would fill this gap by evaluating coverage strategy, integration test layers, and DI contract verification.

The orphaned recommendations pattern reflects a missing bridge between story-level documentation and actionable tracking. The retro's deep story scan surfaces them, but items that aren't "material enough" for retro action items fall through. A pre-retro extraction step feeding into the sprint-status backlog would close this gap.

Sprint status tracking failures correlate with status updates not being part of the code review completion checklist. When review is done, the reviewer moves on without updating status.

## Previous Retro Follow-Through

### Action Items from Epic env-6 Retro

| # | Action Item | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Update Epic 7 Story 7.1 consumer/task list to include Epic 6 additions | ✅ Completed | Followup YAML done. Also discovered flat layout architecture change — nested layout rejected. `architecture.md` and `epics.md` updated. |
| 2 | Embed grep -qF fix in Story 7.1 scope | ✅ Completed | Followup YAML done. All three steps in setup-instance-isolation.sh use `grep -qF`. |
| 3 | Merge Epic 6 to main post-retro | ✅ Completed | Followup YAML done. CI passed. |

**Score: 3/3 completed (100%) — third consecutive epic at 100%**

### Team Agreements from env-6 Retro

| Agreement | Status in env-7 |
|-----------|-----------------|
| Code review remains the verification mechanism | ✅ APPLIED — 4 stories reviewed, 1 HIGH + 12 MEDIUM caught |
| "Second occurrence = investigate deeply" | ✅ APPLIED — sprint status sync issue noted (2 occurrences = pattern) |
| Query actual state, don't assume derived values | ✅ APPLIED — resolveInstance reads state.json fields, not directory parsing |
| Embed actions in stories, not as orphan follow-ups | ⚠️ PARTIAL — grep -qF fix embedded, but 7-3 recommendations noted as "future" |
| Multi-model review for complex/cross-module stories | ✅ APPLIED — Story 7-3 (most complex, 8 ACs) got thorough review |
| MEMORY.md gotchas working — keep maintaining | ✅ APPLIED — known patterns handled |
| When an epic adds state.json consumers, verify subsequent stories account for additions | ✅ APPLIED — Story 7-1 updated with all Epic 6 consumers before implementation |

**Score: 6.5/7 applied (~93%)**

### Technical Debt from env-6

9 items carried forward. grep -qF fix (item #1) addressed in Story 7-1. Remaining 8 LOW items carried unchanged. None caused problems in Epic 7.

## Key Insights

1. **Retro followup process delivers architectural saves** — the flat layout decision caught before implementation prevented a fundamental naming model failure. Third consecutive epic at 100% action item follow-through. This process is now proven across multiple epics.

2. **Test architecture review is a distinct gap from code review** — code review catches bugs in diffs, but nobody's assessing whether the right test layers exist. TEA agent evaluation will address this.

3. **Story-level follow-up items need a bridge to actionable tracking** — review recommendations and dev note ideas living only in story files fall through without a pre-retro extraction step feeding into sprint-status backlog.

4. **Per-story duplication is acceptable; epic-level structural audit catches accumulation** — the `resolveRepo` boilerplate is fine during story dev, but needs consolidation at epic completion. An epic-level audit guidance document will systematize this.

## Technical Debt

| # | Item | Source | Priority | Post-Retro Action |
|---|------|--------|----------|-------------------|
| 1 | `resolveRepo` boilerplate duplicated in 4 commands | Epic 7 Story 7-3 review | MEDIUM | Action Item #1 — extract shared helper |
| 2 | No CLI integration tests for `--repo` flag | Epic 7 Story 7-3 review | MEDIUM | Action Item #2 — add tests |
| 3 | No validation for malformed `--repo` values | Epic 7 Story 7-3 review | LOW | Action Item #3 — add validation |
| 4 | `extractRepoName()` still exported as dead code | Epic 7 Story 7-2 review | LOW | Action Item #9 — remove |
| 5 | `MAX_CONTAINER_NAME_LENGTH` unused at runtime | Epic 7 Story 7-2 review | LOW | Action Item #10 — address |
| 6 | Redundant `createExecutor()` calls per command | Epic 7 Story 7-3 review | LOW | Backlog |
| 7 | Backwards compat scaffolding in state.json scanner | Epic 7 local testing | LOW | Remove after Epic 8 |
| 8 | GitState type: booleans only → enrich with counts | Epic 5 Story 5.2 | LOW | Carried from env-5 |
| 9 | createWorkspace no cleanup on partial failure | Epic 2 Story 2.1 | LOW | Carried from env-5 |
| 10 | state.ts uses dirname() instead of pre-computed wsPath | Epic 2 Story 2.1 | LOW | Carried from env-5 |
| 11 | Missing tmux attach edge case test | Epic 2 Story 2.5 | LOW | Carried from env-5 |
| 12 | No visual separator before "Attaching..." message | Epic 2 Story 2.5 | LOW | Carried from env-5 |
| 13 | glob devDep added for single debug test | Epic 5 Story 5.1 | LOW | Carried from env-5 |
| 14 | Generic devcontainer.json customization system | Sprint status backlog | LOW | Carried from env-5 |
| 15 | LABEL vs baseline vs repo-config layer ownership | Epic 6 retro | LOW | Carried from env-6 |

## Action Items

### Critical Path (must complete before Epic 8 starts)

| # | Action | Owner | Success Criteria |
|---|--------|-------|------------------|
| 1 | Extract `resolveRepoOrExit()` shared helper from command boilerplate | Dev (Amelia) | attach, remove, purpose, rebuild use shared helper; zero copy-pasted blocks; all tests pass |
| 2 | Add CLI integration tests for `--repo` flag across commands | Dev (Amelia) | CLI-level tests exercise `--repo <slug>` through full pipeline for attach, remove, purpose, rebuild; error paths covered |
| 5 | Fix sprint status for Story 7-3 | SM (Bob) | `env-7-3` updated from `review` to `done` in sprint-status.yaml |

### Will Complete Before Epic 8 (not blocking)

| # | Action | Owner | Success Criteria |
|---|--------|-------|------------------|
| 3 | Add input validation for malformed `--repo` values | Dev (Amelia) | Path traversal, whitespace, malformed inputs rejected with clear errors; unit tests cover edge cases |
| 4 | Reconstruct Story 7-1 artifact from commit history | SM (Bob) | Story file exists in implementation-artifacts with dev notes, file list, change log from commit `a86a099` and epic definition |
| 6 | Evaluate TEA agent integration into workflow | Node (Project Lead) | Decision documented on where TEA plugs in; agent config updated if needed |
| 7 | Create epic-level audit guidance document | SM (Bob) | Document in known location with structural patterns to check at epic completion; initial patterns from Epic 7 |
| 8 | Add pre-retro extraction workflow step | SM (Bob) | New step scans story files for unresolved recommendations/future work; triages into sprint-status backlog; runs before retro |
| 9 | Remove dead `extractRepoName()` export | Dev (Amelia) | Function removed from create-instance.ts; all tests pass |
| 10 | Address `MAX_CONTAINER_NAME_LENGTH` unused constant | Dev (Amelia) | Runtime assertion added or documented as intentional |

### Team Agreements

- Code review remains the verification mechanism (carried — 7th consecutive epic)
- "Second occurrence = investigate deeply" (carried from env-4)
- Query actual state, don't assume derived values (carried from env-4)
- Embed actions in stories, not as orphan follow-ups (carried from env-4)
- Multi-model review for complex/cross-module stories (carried from env-5)
- MEMORY.md gotchas working — keep maintaining (carried from env-5)
- When an epic adds state.json consumers, verify subsequent stories account for additions (carried from env-6)
- **NEW: Story artifact files are mandatory for all stories — no exceptions for foundation/refactor stories**
- **NEW: Sprint status must be updated to `done` as part of the code review completion step, not as a separate action**

## Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Testing & Quality | ✅ OK | 753 automated tests + local usage validation |
| Deployment | ⏳ Pending | Merge to main after prep work items complete |
| Stakeholder Acceptance | ✅ OK | Node validated via local usage |
| Technical Health | ✅ OK | Codebase solid, no fragility concerns |
| Unresolved Blockers | ✅ None | All captured in action items |
| Backwards Compat Scaffolding | ℹ️ Noted | Stays through Epic 8, remove after |

## Epic env-8 Preparation

**Critical (must complete before epic starts):**
- [ ] Extract `resolveRepoOrExit()` shared helper (Action Item #1)
- [ ] Add CLI integration tests for `--repo` (Action Item #2)
- [ ] Fix sprint status for Story 7-3 (Action Item #5)

**Will complete before Epic 8 (not blocking):**
- [ ] Malformed `--repo` input validation (Action Item #3)
- [ ] Reconstruct Story 7-1 artifact (Action Item #4)
- [ ] Evaluate TEA integration (Action Item #6)
- [ ] Create epic-level audit guidance document (Action Item #7)
- [ ] Add pre-retro extraction workflow step (Action Item #8)
- [ ] Remove dead `extractRepoName()` export (Action Item #9)
- [ ] Address `MAX_CONTAINER_NAME_LENGTH` unused constant (Action Item #10)

**Sprint-status backlog addition:**
- Remove backwards compat scaffolding in state.json scanner after Epic 8

**Epic 8 story alignment:** Verified — all 3 stories account for Epic 7's implementation. No consumer gaps or misaligned assumptions detected.

## Next Steps

1. **Execute all 10 action items** — critical path items first
2. **Merge Epic 7 to main** after prep work complete
3. **Begin Epic env-8** when preparation complete — start creating stories with SM agent's create-story workflow

## Retrospective Meta

**Format:** Party Mode with natural team dialogue
**Duration:** Full workflow execution
**Document saved:** `_bmad-output/implementation-artifacts/epic-env-7-retro-2026-02-18.md`
