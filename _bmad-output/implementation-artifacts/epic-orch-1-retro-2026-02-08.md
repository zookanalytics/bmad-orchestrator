# Epic orch-1 Retrospective: Project Foundation & Instance Discovery (Post-Rework)

**Date:** 2026-02-08
**Facilitator:** Bob (Scrum Master)
**Project Lead:** Node
**Note:** This is a follow-up retrospective covering the full Epic orch-1 lifecycle including the DevPod-to-agent-env rework (Story 1-R). The original retro (2026-01-19) reviewed Stories 1-1 through 1-4 against DevPod.

---

## Epic Summary

| Metric | Value |
|--------|-------|
| Epic | orch-1 — Project Foundation & Instance Discovery |
| Stories Completed | 5/5 (100%) |
| Includes Rework | Yes — Story 1-R (DevPod → agent-env migration) |
| Code Review Passes | 6 across 5 stories |
| HIGH Issues Caught in Review | 10+ |
| Test Coverage | 92–100% per module |
| Production Incidents | 0 |
| Blockers Encountered | 0 |
| Net Code Change (Rework) | ~130 line reduction |

### Stories Delivered

| Story | Title | Status | Notes |
|-------|-------|--------|-------|
| orch-1-1 | Project Initialization with Quality Gates | Done | Foundation: CI, coverage gates, tooling |
| orch-1-2 | Test Fixtures and Discovery Types | Done | Research-first approach validated |
| orch-1-3 | DevPod Discovery Module | Done | DI factory pattern established |
| orch-1-4 | List Command Implementation | Done | STATUS→PROVIDER deviation (DevPod limitation) |
| orch-1-5 | Rework: Agent-Env Migration | Done | Cleanest story — zero HIGHs, net code reduction |

---

## What Went Well

1. **Process adapted to a major dependency pivot** — The sprint change proposal mechanism enabled a clean DevPod→agent-env migration without losing functionality. The rework left the codebase better than the original target.

2. **DI factory pattern proved its worth** — `createDiscovery(executor)` made the rework trivial to test and the migration surgical. No restructuring needed — just swapped what was behind the factory.

3. **Dual code review on Story 1-R** — Two different AI reviewers (Gemini Code Assist + Claude Opus 4.6 adversarial) caught different issues from different angles. Neither would have found both sets of problems alone.

4. **Clear maturation arc** — Stories 1-1 through 1-4 had multiple HIGH issues in review. Story 1-R had zero HIGHs, only MEDIUMs (all auto-fixed). Process tightened over the course of the epic.

5. **Research-first approach** — Story 1-2's research into actual DevPod CLI output prevented costly type rework and surfaced CLI limitations early.

6. **Rework improved the codebase** — agent-env's structured JSON envelope (`{ok, data, error}`) eliminated 7 mapping functions and ~130 lines of code. Richer data (status, purpose, gitState) available for free.

---

## What Didn't Go Well / Challenges

1. **Verification gaps before code review** — Story 1-3 had `DEFAULT_TIMEOUT` and `CommandExecutor` type undefined. Task marked complete but `pnpm check` hadn't been run. Recurring pattern from original retro.

2. **Architecture assumptions vs. reality** — 40% of stories (1-2, 1-4) hit spec-vs-reality mismatches. DevPod used PascalCase statuses; DevPod didn't return status at all, forcing STATUS→PROVIDER column change.

3. **Test quantity over test quality** — Coverage metrics gave false confidence. Story 1-1 mocked entire Command class instead of spying on parse. Story 1-4 used vague `toContain` assertions. Coverage was high but regression protection was weak.

4. **Previous retro action items mostly unfulfilled** — Only 1 of 4 action items from the original Epic 1 retro (2026-01-19) was completed. Pre-review checklist (the most impactful item) was only partially addressed.

---

## Previous Retro Follow-Through

| # | Original Action Item (2026-01-19) | Status | Impact |
|---|-----------------------------------|--------|--------|
| 1 | Create GitHub issue for Epic Evaluation Workflow | ❌ Not Done | Low — managing evaluations informally |
| 2 | Add 'Deviations from Spec' section to story template | ❌ Not Done | Medium — deviations in 1-4 weren't communicated well |
| 3 | Pre-review checklist (types exported, constants defined, `pnpm check` passes) | ⏳ Partial | Being addressed structurally via BMAD workflow updates |
| 4 | Update sprint-status.yaml to mark Epic 1 as 'done' | ✅ Done | Complete |

**Note:** A formal retro follow-up routing process is now in place and will be executed immediately after this retro. Unfulfilled items from the original retro will be re-evaluated through that process.

---

## Significant Discovery: BMAD State as Shared Infrastructure

During this retrospective, the team identified that **BMAD state parsing may be a system-level concern**, not an orchestrator-specific capability.

**Context:**
- Epic orch-2 currently places state parsing in `packages/orchestrator/src/lib/state.ts`
- The BMAD workflow runner also needs BMAD state awareness (what's next, what's completed, where are we)
- Placing this logic in the orchestrator creates either duplication or awkward cross-package dependencies

**The orchestrator's role boundary is undefined at the system level:**
- Observer (just display state)?
- Coordinator (recommend what's next)?
- Dispatcher (trigger work)?

**Resolution:** Create a monorepo-level system product brief before starting Epic orch-2. This brief will define how shared, agent-env, and orchestrator compose as a system, and naturally resolve where BMAD state awareness lives.

---

## Lessons Learned

| # | Lesson | Evidence |
|---|--------|----------|
| 1 | **Process adaptation > stubbornness** — Pivoting when evidence shows a better path is a strength, not a failure | DevPod→agent-env pivot improved codebase and data richness |
| 2 | **DI patterns pay compound dividends** — Good abstractions make future changes trivial | Factory pattern enabled surgical rework with zero restructuring |
| 3 | **Test quality > test quantity** — Coverage metrics don't measure regression protection | HIGH issues found in code with 90%+ coverage |
| 4 | **System-level design prevents package-level mistakes** — Component briefs aren't enough when packages interact | BMAD state ownership question spans orchestrator and workflow runner |
| 5 | **Retro action items need formal follow-through** — Documenting actions without tracking them is theater | 1/4 original retro items completed |

---

## Action Items

### Process Improvements

| # | Action | Owner | Deadline | Success Criteria |
|---|--------|-------|----------|-----------------|
| 1 | Validate file paths and naming conventions for Epic 2 stories | Bob (SM) | Before orch-2 story creation | Paths reference `orchestrator/` component directory, sprint-status.yaml location, and flat story file structure verified against codebase |
| 2 | Execute retro follow-up routing for this retro's action items | Node (Project Lead) | Immediately after this retro | All action items routed through formal follow-up process |
| 3 | Re-evaluate unfulfilled original retro items in follow-up routing | Bob (SM) | During follow-up routing | Items #1 and #2 from original retro either executed, modified, or explicitly dropped with rationale |

### Technical Debt

| # | Item | Owner | Priority |
|---|------|-------|----------|
| 1 | Hardcoded `DEFAULT_TIMEOUT` in discovery.ts | Charlie (Dev) | LOW |
| 2 | Generic JSON parse error message in discovery.ts | Charlie (Dev) | LOW |
| 3 | `InstanceDisplayStatus` catch-all `'unknown'` could mask new statuses | Charlie (Dev) | LOW |

### Team Agreements

- Dual code review (two different AI reviewers) for rework and high-impact stories
- Post-epic test quality review adopted going forward
- Research-first stories remain the standard when consuming external APIs or CLIs

---

## Critical Path — Before Epic orch-2

| # | Item | Owner | Process | Depends On |
|---|------|-------|---------|------------|
| 1 | **Create monorepo-level system product brief** | Node + PM/Analyst agent | `create-product-brief` scoped to full monorepo | — |
| 2 | **System-level architecture decisions** (if needed) | Node + Architect agent | `create-architecture` for system-level integration | #1 |
| 3 | **Revise Epic orch-2 stories** based on system brief outcomes | Bob (SM) | Review and update story scope, locations, package assignments | #1, #2 |

**System brief must define:**
- How shared, agent-env, and orchestrator compose as a system
- Where BMAD state awareness lives as a capability
- Orchestrator role boundary (observer vs. coordinator vs. dispatcher)
- Integration contracts between packages

---

## Readiness Assessment

| Area | Status |
|------|--------|
| Testing & Quality | ✅ 45 tests pass, type-check clean, 500 monorepo tests pass, local verification confirmed |
| Deployment | ✅ N/A — local CLI tool |
| Stakeholder Acceptance | ✅ Accepted by Node (sole stakeholder) |
| Technical Health | ✅ Stable — rework left codebase cleaner |
| Unresolved Blockers | ✅ None |
| Epic orch-2 Readiness | ⚠️ Blocked on system product brief |

---

## Next Steps

1. **Run retro follow-up routing** (immediately)
2. **Create monorepo-level system product brief** (critical path)
3. **System-level architecture decisions** (if needed after brief)
4. **Revise Epic orch-2 stories** based on system brief outcomes
5. **Begin Epic orch-2** only after critical path items complete

---

*Retrospective conducted 2026-02-08. Epic orch-1 confirmed complete. Epic orch-2 blocked pending system-level product brief.*
