# Epic env-3 Evaluation Synopsis

**Epic:** env-3 — Instance Discovery & Git State
**Date:** 2026-02-04
**Evaluator:** Automated evaluation
**Stories:** 4/4 completed (env-3-1 through env-3-4)

---

## 1. Deliverables Check

### Planned vs Delivered Files

| Planned Deliverable | File | Status |
|---|---|---|
| `src/lib/git.ts` — git state detection module | `packages/agent-env/src/lib/git.ts` | ✅ Delivered |
| `src/lib/git.test.ts` — comprehensive test coverage | `packages/agent-env/src/lib/git.test.ts` | ✅ Delivered |
| `src/commands/list.ts` — list/ps command | `packages/agent-env/src/commands/list.ts` | ✅ Delivered |
| `src/commands/list.test.ts` — command tests | `packages/agent-env/src/commands/list.test.ts` | ✅ Delivered |
| `src/components/InstanceList.tsx` — Ink table component | `packages/agent-env/src/components/InstanceList.tsx` | ✅ Delivered |
| `src/components/InstanceList.test.tsx` — component tests | `packages/agent-env/src/components/InstanceList.test.tsx` | ✅ Delivered |
| `src/components/StatusIndicator.tsx` — git state indicators | `packages/agent-env/src/components/StatusIndicator.tsx` | ✅ Delivered |
| `src/components/StatusIndicator.test.tsx` — indicator tests | `packages/agent-env/src/components/StatusIndicator.test.tsx` | ✅ Delivered |
| `src/lib/list-instances.ts` — core listing logic | `packages/agent-env/src/lib/list-instances.ts` | ✅ Delivered |
| `src/lib/list-instances.test.ts` — listing unit tests | `packages/agent-env/src/lib/list-instances.test.ts` | ✅ Delivered |
| `src/lib/types.ts` — git state types added | `packages/agent-env/src/lib/types.ts` (modified) | ✅ Delivered |
| Story implementation docs (4 files) | `_bmad-output/implementation-artifacts/env-3-{1..4}-*.md` | ✅ Delivered |
| Sprint status updated | `sprint-status.yaml` — all 4 stories + epic marked `done` | ✅ Delivered |
| Retrospective completed | `epic-env-3-retro-2026-02-04.md` | ✅ Delivered |

### FR Coverage

| FR | Description | Status |
|---|---|---|
| FR7 | List all instances | ✅ Delivered |
| FR8 | Show instance status (running/stopped/orphaned) | ✅ Delivered |
| FR9 | Git state indicators (clean/uncommitted/unpushed) | ✅ Delivered |
| FR10 | Never-pushed branch detection | ✅ Delivered |
| FR11 | Last-attached timestamp display | ✅ Delivered |
| FR36 | JSON output for scripting/orchestrator integration | ✅ Delivered |

### Missing Items

✅ **None** — All planned deliverables accounted for.

---

## 2. Deviation Analysis

### Implementation vs Tech Spec

| Area | Spec | Implementation | Deviation | Severity |
|---|---|---|---|---|
| API name | `getGitState(workspacePath)` | `createGitStateDetector` factory pattern | ⚠️ Minor | LOW — DI pattern aligns with project conventions, factory returns equivalent `getGitState` function |
| Git commands | `git status --porcelain`, `git stash list`, `git branch -vv` | Uses `git for-each-ref` instead of `git branch -vv` for branch tracking | ⚠️ Minor | LOW — `for-each-ref` is more scriptable and was explicitly called out as alternative in spec |
| `ps` alias | Must behave identically to `list` | ✅ Implemented as Commander alias | None | — |
| `--json` output type | `JsonOutput<T>` from shared | ✅ Uses `JsonOutput<InstanceInfo[]>` | None | — |
| Docker unavailable handling | Show "unknown (Docker unavailable)" | ✅ Graceful degradation implemented | None | — |
| Parallel git state detection | Required for performance | ✅ `Promise.allSettled` with parallel execution | None | — |
| timeago.js for timestamps | Spec requires timeago.js | Uses `timeago.js` for relative timestamps | None | — |

### Scope Changes

| Change | Direction | Rationale |
|---|---|---|
| Story 3.4 was near-zero implementation | Scope reduction | JSON output was already built incrementally in Stories 3.2-3.3; Story 3.4 became verification + dedicated tests only |
| No additional scope added | — | Epic stayed within planned boundaries |

### Summary

⚠️ **Minor deviations only.** The factory/DI pattern deviation is consistent with the project's established architecture from env-2. No scope creep. No missing functionality.

---

## 3. Quality Gates

### Test Suite

| Check | Result | Details |
|---|---|---|
| Tests exist | ✅ | 251 tests in agent-env package; 325 total across monorepo |
| Tests pass | ❌ **5 snapshot failures** | `InstanceList.test.tsx` — 5 snapshot tests fail due to time-sensitive `timeago.js` output ("in 3 hours" vs "20 hours ago"). Snapshots are stale relative to current time. |
| Type checking | ❌ **2 TypeScript errors** | `list.test.ts:177` — `instance` possibly undefined; `list.test.ts:231` — type conversion overlap issue. Both in test file only. |
| Shared package tests | ✅ | 25/25 pass |
| Cross-package regressions | ✅ | No breaking changes to other packages |

### Code Quality

| Check | Result | Details |
|---|---|---|
| TODO/FIXME comments | ✅ Clean | Zero TODO/FIXME/HACK/XXX in `packages/agent-env/src/` |
| Code review completed | ✅ | 5 review rounds across 4 stories; 8 HIGH issues found and fixed |
| DI pattern consistency | ✅ | All new modules use dependency injection pattern |

### Documentation

| Check | Result | Details |
|---|---|---|
| Story files updated | ✅ | All 4 story files marked `done` with review notes |
| Sprint status updated | ✅ | All stories + epic + retrospective marked `done` |
| Retrospective completed | ✅ | Full retrospective with action items documented |
| Dev notes in stories | ✅ | Implementation notes and review findings documented |

### Quality Gate Verdict

⚠️ **NEEDS ATTENTION** — 5 snapshot test failures (time-sensitive, not functional) and 2 TypeScript errors in test files. Production code is clean. These are maintenance issues, not functional defects.

---

## 4. Integration Verification

### Internal Integration

| Check | Result | Details |
|---|---|---|
| `git.ts` integrates with `list-instances.ts` | ✅ | `GitStateDetector` injected via `ListInstancesDeps` interface |
| `list` command registered in CLI | ✅ | Registered with `ps` alias in `cli.ts` |
| Uses `workspace.ts` from env-2 | ✅ | `getWorkspaces()` called for instance discovery |
| Uses `state.ts` from env-2 | ✅ | `readState()` for instance metadata |
| Uses `container.ts` from env-2 | ✅ | `getContainerStatus()` for running/stopped/orphaned |
| StatusIndicator renders in InstanceList | ✅ | Component composition working |
| `--json` flag suppresses Ink rendering | ✅ | Tested in `list.test.ts` |

### Cross-Package Integration

| Check | Result | Details |
|---|---|---|
| Shared package unaffected | ✅ | 25/25 tests pass; no changes to shared |
| Cross-dependency unlocked | ✅ | `env-epic-3` → `orch-epic-2` dependency satisfied (sprint-status.yaml documents this) |
| No breaking changes to CLI surface | ✅ | Only additive changes (new `list`/`ps` command) |

### Breaking Changes

✅ **None detected.** All changes are additive. No existing commands or APIs modified.

---

## Final Assessment

| Category | Status | Summary |
|---|---|---|
| Deliverables | ✅ PASS | All planned files delivered, all FRs covered, no missing items |
| Deviations | ✅ PASS | Minor deviations only, consistent with project conventions |
| Quality Gates | ⚠️ NEEDS ATTENTION | 5 stale snapshot tests + 2 TS errors in test files |
| Integration | ✅ PASS | Clean integration, no breaking changes, cross-dependency unlocked |

---

## Overall Status: ⚠️ NEEDS ATTENTION

**Rationale:** Epic env-3 is functionally complete with all deliverables shipped, all FRs covered, and clean integration. The outstanding issues are:

1. **5 snapshot test failures** in `InstanceList.test.tsx` — caused by time-sensitive `timeago.js` rendering in snapshots. The snapshots were generated at a specific point in time and now show different relative timestamps. **Fix:** Update snapshots with `vitest run --update` or refactor tests to mock `Date.now()`.

2. **2 TypeScript errors** in `list.test.ts` — minor type narrowing issues in test assertions. Production code type-checks clean. **Fix:** Add non-null assertions or adjust type casts in test file.

Neither issue affects production functionality. Both are test maintenance items that should be addressed before starting env-4.
