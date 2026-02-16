# Epic env-6 Retrospective

**Epic:** env-6 - In-Container Purpose & Tmux Visibility
**Date:** 2026-02-16
**Facilitator:** Bob (Scrum Master)
**Status:** Complete

## Epic Summary

| Metric | Value |
|--------|-------|
| Stories Completed | 3/3 (100%) |
| Tests (start → end) | 646 → 678 agent-env (32 new, 5% growth) |
| Total Test Suite | 678 (25 shared + 45 orchestrator + 608 agent-env) |
| Code Review Rounds | 5 total (1 + 1 + 3) |
| Issues Found in Review | ~14 total (1 HIGH, 8 MEDIUM, 5 LOW fixed; 3 accepted) |
| Debug Issues During Dev | 0 |
| Human Intervention During Dev | 0 |
| Pipeline Execution | Fully automated — entire epic ran via scripted pipeline |

### Stories Delivered

1. **env-6-1**: Baseline devcontainer updates for purpose infrastructure — 1 review round (3 MEDIUM, 2 LOW accepted)
2. **env-6-2**: --purpose flag on create and AGENT_ENV_PURPOSE env var — 1 review round (2 MEDIUM)
3. **env-6-3**: agent-env CLI inside containers with live purpose updates — 3 review rounds (1 HIGH, 5 MEDIUM, 5 LOW fixed; 3 accepted)

### FRs Delivered

FR46, FR47, FR48, FR49, FR50 (5 FRs)

### NFRs Addressed

NFR22 (purpose in tmux < 1s on attach), NFR23 (live purpose updates < 30s), NFR24 (tmux integration non-interfering)

## Team Participants

- Alice (Product Owner)
- Bob (Scrum Master) - Facilitator
- Charlie (Senior Dev)
- Dana (QA Engineer)
- Elena (Junior Dev)
- Node (Project Lead)

## What Went Well

### Successes

1. **Fully automated pipeline execution**
   - Entire epic ran hands-off through scripted pipeline — zero human intervention
   - Three stories, five review rounds, 32 new tests, all executed automatically
   - Planning artifacts + DI pattern + code review loop are a self-sustaining system

2. **Single-jq-invocation pattern**
   - Story 6.1 initial approach (two-line jq + head/tail) broke on null purpose due to `$()` stripping trailing newlines
   - Consolidated all formatting into one jq expression: name extraction, truncation, null handling
   - Pattern proved robust and carried through the entire epic

3. **DI pattern continues to deliver**
   - 6th consecutive epic with the factory function + deps interface + co-located tests approach
   - `patchContainerEnv()` followed exact same pattern as `patchContainerName()` — immediately reusable
   - Story 6.3 added `createPurposeCommand(deps)` factory for testability (added during review)

4. **Code review catching real issues**
   - Story 6.3: `any` type violation (HIGH) — project standard enforcement
   - Story 6.2: `grep -q` vs `grep -qF` — bracket characters as regex metacharacters
   - Story 6.3: Missing purpose length validation (200 char limit added)
   - Story 6.3: `pnpm link --global` fallback silently using npm instead of failing

5. **100% follow-through on env-5 retro commitments**
   - 2/2 action items applied
   - 6/6 team agreements honored
   - Second consecutive epic at 100% follow-through

6. **Autonomous execution streak extends**
   - 6th consecutive epic with zero debug issues
   - 6th consecutive epic with zero human intervention during dev

## Challenges & Growth Areas

### Issues Identified

1. **Story 6.3 review intensity (3 rounds)**
   - Most complex story: 8 ACs, cross-environment detection (host vs container), argument semantics change based on environment
   - Not a process failure — the automated review pipeline working under stress
   - Round 1: DRY violations, missing type checks, reimplemented atomic write
   - Round 2: `any` type violation (project standard), missing DI, no input length validation
   - Round 3: Accepted items only
   - Conclusion: review intensity correlates with AC count and cross-environment complexity

2. **Dev agent missed project standard (`any` types)**
   - `handleGetResult` and `handleSetResult` used `any` type — caught by review, not by dev
   - System worked (review caught it), but ideally dev agent applies standards proactively

3. **Pre-existing grep -qF debt in setup-instance-isolation.sh**
   - Steps 9 and 11 have `grep -q` with `[` in marker strings — treated as regex metachar
   - Only Step 11b (new in Epic 6) was fixed per story scope
   - Ticking bomb in a script that runs on every container startup

4. **LABEL vs baseline vs repo-config layer ownership unclear**
   - `.agent-env/` bind-mount and `AGENT_ENV_CONTAINER=true` appear in both Dockerfile LABEL metadata and baseline `devcontainer.json`
   - Documented as intentional (LABEL for non-baseline, baseline for agent-env's own config)
   - Docker tolerates additive merge, but the architecture doesn't express clear layer responsibilities
   - Epic 7 Story 7.5 (baseline config prompt) directly touches this boundary
   - Not a prerequisite to fix, but should be addressed in a future devcontainer consolidation pass

### Root Cause Analysis

Story 6.3's review intensity reflects inherent complexity rather than a process gap. Cross-environment code (host vs container detection, argument semantics changing by environment, atomic writes across bind-mounts) requires more review scrutiny. The automated pipeline handled this correctly — three rounds is the system working, not failing.

The `any` type miss suggests dev agent could benefit from stronger static analysis awareness. However, this is a single occurrence across 3 stories and was caught by review.

## Previous Retro Follow-Through

### Action Items from Epic env-5 Retro

| # | Action Item | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Multi-model review for complex stories (cross-module deps or 4+ ACs) | ✅ Applied | Story 6.3 (8 ACs, cross-environment) got 3 adversarial review rounds |
| 2 | Carry forward "embed actions in stories" agreement | ✅ Applied | Zero orphan follow-ups in Epic 6 |

**Score: 2/2 completed (100%)**

### Team Agreements from env-5 Retro

| Agreement | Status in env-6 |
|-----------|-----------------|
| Code review remains the verification mechanism | ✅ APPLIED — 5 reviews, 1 HIGH + 8 MEDIUM caught |
| "Second occurrence = investigate deeply" | ✅ APPLIED — grep -qF pattern noted and scoped |
| Query actual state, don't assume derived values | ✅ APPLIED — no assumption bugs |
| Embed actions in stories, not as orphan follow-ups | ✅ APPLIED — no orphan actions |
| Multi-model review for complex/cross-module stories | ✅ APPLIED — Story 6.3 adversarial reviews |
| MEMORY.md gotchas working — keep maintaining | ✅ APPLIED — known patterns handled |

**Score: 6/6 applied (100%)**

### Technical Debt from env-5

7 items carried forward unchanged (all LOW severity). None addressed in Epic 6. None caused problems in Epic 6.

## Key Insights

1. **Automated pipeline maturity validated** — entire epic ran hands-off. Planning artifacts, DI pattern, code review, and scripted execution form a proven autonomous system.

2. **Review intensity scales with complexity** — Story 6.3 (8 ACs, cross-environment) needed 3 rounds vs 1 round for simpler stories. This is expected and healthy.

3. **Cross-epic consumer tracking is a real gap** — Epic 7's stories were written before Epic 6 was implemented. Story 7.1's consumer list doesn't include Epic 6's new state.json consumers (`tmux-purpose.sh`, container-mode purpose handlers). Must update stories before starting Epic 7.

4. **100% retro follow-through for second consecutive epic** — team agreements and action items are holding. Workflow improvements in progress to make this systematic.

5. **Devcontainer layer responsibilities need future clarification** — LABEL vs baseline vs repo-config boundaries are fuzzy. Not blocking, but an architectural smell.

## Technical Debt

| # | Item | Source | Priority | Post-Retro Action |
|---|------|--------|----------|-------------------|
| 1 | `grep -q` → `grep -qF` in `setup-instance-isolation.sh` Steps 9, 11 | Epic 6 Story 6.2 review | LOW | Embed in Epic 7 Story 7.1 |
| 2 | LABEL vs baseline vs repo-config layer ownership unclear | Epic 6 retro discussion | LOW | Future devcontainer consolidation |
| 3 | GitState type: booleans only → enrich with counts, stash messages | Epic 5 Story 5.2 | LOW | Carried from env-5 |
| 4 | createWorkspace no cleanup on partial failure if .agent-env mkdir fails | Epic 2 Story 2.1 | LOW | Carried from env-5 |
| 5 | state.ts uses dirname() instead of pre-computed wsPath.agentEnvDir | Epic 2 Story 2.1 | LOW | Carried from env-5 |
| 6 | Missing tmux attach edge case test | Epic 2 Story 2.5 | LOW | Carried from env-5 |
| 7 | No visual separator before "Attaching..." message | Epic 2 Story 2.5 | LOW | Carried from env-5 |
| 8 | glob devDep added for single debug test | Epic 5 Story 5.1 | LOW | Carried from env-5 |
| 9 | Generic devcontainer.json customization system | Sprint status backlog | LOW | Carried from env-5 |

## Action Items

### Epic 7 Story Updates (CRITICAL — Before Starting Epic 7)

**Action: Update Epic env-7 Story 7.1 consumer/task list via BMAD workflow to include Epic 6 additions.**

Story 7.1 ("Refactor workspace scanning and state schema for nested layout") must update ALL state.json consumers. Epic 6 added the following consumers not currently listed in Story 7.1:

| File | What It Reads | Required Change |
|------|---------------|-----------------|
| `image/scripts/tmux-purpose.sh` | `.name` from state.json via jq | Update `.name` → `.instance` field reference |
| `image/scripts/setup-instance-isolation.sh` | `.purpose` from state.json via jq (Step 11b) | Review jq expressions against new schema; fix `grep -qF` in Steps 9 and 11 |
| `packages/agent-env/src/lib/container-env.ts` | State path resolution | Review path resolution against nested workspace layout |
| `packages/agent-env/src/lib/purpose-instance.ts` | `getContainerPurpose()` and `setContainerPurpose()` read/write state.json directly | Update container-mode handlers for new state schema (`name` → `instance`, new `repoSlug`/`repoUrl`) |
| `packages/agent-env/src/lib/tmux-purpose.test.ts` | Test fixtures with state.json format | Update fixtures to new schema |

Additionally review: `AGENT_ENV_INSTANCE` value change from compound name (e.g., `bmad-orch-auth`) to short instance name (`auth`) — verify no downstream effects beyond tmux display improvement.

### Process Improvements

| # | Action | Owner | Success Criteria |
|---|--------|-------|------------------|
| 1 | Update Epic 7 Story 7.1 consumer/task list via BMAD workflow | SM (Bob) | Story 7.1 includes all Epic 6 state.json consumers listed above |
| 2 | Embed grep -qF fix (Steps 9, 11) in Epic 7 Story 7.1 | SM (Bob) | All three steps use `grep -qF` for fixed string matching |
| 3 | Merge Epic 6 to main post-retro | Node | Clean merge, CI passes |

### Team Agreements

- Code review remains the verification mechanism (carried — 6th consecutive epic)
- "Second occurrence = investigate deeply" (carried from env-4)
- Query actual state, don't assume derived values (carried from env-4)
- Embed actions in stories, not as orphan follow-ups (carried from env-4)
- Multi-model review for complex/cross-module stories (carried from env-5)
- MEMORY.md gotchas working — keep maintaining (carried from env-5)
- **NEW: When an epic adds state.json consumers or modifies shared files, verify subsequent epic stories account for the additions before starting**

## Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Testing & Quality | ✅ OK | 678 automated tests + manual validation of tmux, env vars, purpose display |
| Deployment | ⏳ Pending | Merge to main after retro + action items |
| Stakeholder Acceptance | ✅ OK | Node validated manually |
| Technical Health | ✅ OK | No codebase concerns |
| Unresolved Blockers | ✅ None | Clean |
| In-container CLI (e2e) | ℹ️ Noted | Untested end-to-end; will validate on next published release |

## Epic env-7 Preparation

**Critical (must complete before epic starts):**
- [ ] Update Epic 7 Story 7.1 task/consumer list via BMAD workflow to include Epic 6 additions (see detailed table in Action Items above)
- [ ] Embed grep -qF fix in Story 7.1 scope
- [ ] Merge Epic 6 to main

No other preparation needed — Epic 7 is architecturally independent, codebase is clean, no infrastructure setup required.

## Next Steps

1. **Save this retrospective** — done
2. **Merge Epic 6 to main** — Node to execute post-retro
3. **Update Epic 7 stories** — Run BMAD workflow to update Story 7.1 consumer list with Epic 6 additions
4. **Begin Epic 7** — Start creating stories with SM agent's create-story workflow

## Retrospective Meta

**Format:** Party Mode with natural team dialogue
**Duration:** Full workflow execution
**Document saved:** `_bmad-output/implementation-artifacts/epic-env-6-retro-2026-02-16.md`
