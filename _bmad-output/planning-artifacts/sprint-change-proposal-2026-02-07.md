# Sprint Change Proposal: Orchestrator DevPod-to-agent-env Migration

**Date:** 2026-02-07
**Trigger:** Strategic pivot — agent-env replaces DevPod as instance management layer
**Status:** Pending approval

---

## 1. Issue Summary

The orchestrator's planning artifacts (architecture, PRD, epics, UX spec) and Epic 1 code are built around DevPod as the container/instance management layer. DevPod has been fully replaced by agent-env (`@zookanalytics/agent-env`), which is now complete (all 5 epics done). All orchestrator planning artifacts reference DevPod CLI commands, DevPod types, and DevPod conventions that no longer apply.

### Architectural Decision

**Orchestrator will consume agent-env via its CLI**, not as a TypeScript library import.

- Discovery: `agent-env list --json` (subprocess via execa, same DI pattern as current DevPod approach)
- Interaction: `agent-env attach <name>` (replaces `devpod ssh <name>`)
- No prerequisite work needed in agent-env — CLI already works
- Library imports can be revisited for Phase 2+ if operations beyond list/attach are needed

### Key Terminology Mapping

| Old (DevPod) | New (agent-env) |
|---|---|
| DevPod | Instance |
| `devpod list --output json` | `agent-env list --json` |
| `devpod ssh <name>` | `agent-env attach <name>` |
| DevPod CLI dependency | agent-env CLI dependency |
| DevPod workspace path | `~/.agent-env/workspaces/<name>/` |
| DevPodStatus ('Running'/'Stopped'/'Busy'/'NotFound') | InstanceDisplayStatus ('running'/'stopped'/'not-found'/'orphaned'/'unknown') |
| "stale" detection | "inactive" detection |
| `DevPod` interface | `Instance` (matching agent-env JSON output) |
| `DiscoveryResult` | `JsonOutput<Instance[]>` shape from agent-env CLI |
| `devPodList.json` fixtures | `instanceList.json` fixtures |
| `DevPodPane.tsx` | `InstancePane.tsx` |
| `useDevPods` hook | `useOrchestrator` hook (architecture already specified this) |
| `discoverDevPods()` | `discoverInstances()` |

### agent-env CLI JSON Contract

```
$ agent-env list --json

Success:
{
  "ok": true,
  "data": [
    {
      "name": "workspace-name",
      "status": "running" | "stopped" | "orphaned" | "unknown" | "not-found",
      "lastAttached": "2026-02-03T10:00:00.000Z" | null,
      "purpose": "User description" | null,
      "gitState": {
        "ok": true,
        "state": { hasStaged, stagedCount, hasUnstaged, unstagedCount, hasUntracked, untrackedCount, stashCount, unpushedBranches, neverPushedBranches, isDetachedHead, isClean, ... }
      } | { "ok": false, "state": null, "error": {...} } | null
    }
  ],
  "error": null
}

Error:
{
  "ok": false,
  "data": null,
  "error": { "code": "ERROR_CODE", "message": "...", "suggestion": "..." }
}
```

**Note:** agent-env provides richer data than DevPod ever did — git state, purpose, and typed status come free. The orchestrator gets these without extra work.

---

## 2. Epic Impact Assessment

| Epic | Status | Impact Level | Changes Needed |
|------|--------|-------------|----------------|
| Epic 1: Foundation & Discovery | Done | **High** | Code rework: discovery.ts, types.ts, fixtures, list command |
| Epic 2: BMAD State Parsing | Backlog | Low-Medium | Planning docs: workspace paths, terminology |
| Epic 3: Dashboard Experience | Backlog | Low | Planning docs: component names, hook state, mockups |
| Epic 4: Command Generation | Backlog | Medium | Planning docs: `agent-env attach` replaces `devpod ssh` |
| Epic 5: CLI Polish | Backlog | Low | Planning docs: terminology only |

**No new epics needed. No epics removed. No resequencing.**

The epic structure remains valid. The change is a foundation swap in the discovery layer, not a product pivot.

---

## 3. Artifact Adjustment Needs

### architecture.md (High impact — ~40 sections affected)

**Structural changes:**
- Discovery pipeline: rewrite for `agent-env list --json` subprocess
- Subprocess handling code example: update binary, arguments, JSON parsing
- Data Sources table: update discovery row
- Technical Constraints: replace DevPod CLI dependency with agent-env CLI
- BMAD Artifact Path Contract: workspace path convention
- Types: `DevPod` → `Instance`, status values lowercase, new gitState/purpose fields
- FR/NFR Coverage Matrices: update discovery references
- Technology Versions: note agent-env CLI

**Terminology changes:**
- Naming Patterns, Format Patterns, Error Handling, State Management, Component Patterns sections
- Anti-patterns table
- Project structure fixture filenames
- Phase 3+ considerations

### prd.md (Medium impact — terminology + commands)

- Executive Summary: "multi-DevPod" → "multi-instance"
- User Journey mockups: instance names, `agent-env attach` commands
- Config example: paths and keys
- FR1-4: "DevPods" → "instances"
- FR16-18: "stale" → "inactive"
- NFR11: "DevPod CLI" → "agent-env CLI"
- Scripting examples

### epics.md (Medium impact — Story 1.3 rewrite + terminology)

- Story 1.2: fixture filenames and types
- Story 1.3: full rewrite — discovery wraps `agent-env list --json` not `devpod list`
- Story 1.4: display terminology
- Story 4.1: command generation (`agent-env attach` replaces `devpod ssh`)
- Requirements Inventory: AR6, NFR11 updates
- FR Coverage Map: update discovery references

### ux-design-specification.md (Medium impact — mockups + alignment)

- Component names: `DevPodPane` → `InstancePane`
- Hook names: `useDevPods` → `useOrchestrator` (fix pre-existing divergence)
- Directory structure: align with architecture's `lib/hooks/components/commands`
- Mockup terminal output: instance names, commands
- "stale" → "inactive" throughout

### sprint-status.yaml (Low impact)

- Update comments referencing DevPod
- Update cross-dependency notes

---

## 4. Recommended Path Forward

**Approach:** Direct Adjustment

**Why this approach:**
1. Epic structure is sound — no new epics, no removals, no resequencing
2. CLI approach requires zero prerequisite work in agent-env
3. Preserves Epic 1's validated DI/subprocess patterns
4. agent-env provides richer data (git state, purpose) enriching future epics for free
5. Doesn't foreclose library imports for Phase 2+

**Alternatives rejected:**
- **Rollback Epic 1:** Not viable — would discard working infrastructure to rebuild it
- **PRD MVP Review:** Not needed — MVP is easier with agent-env, not harder

---

## 5. Action Plan

### Phase A: Planning Artifact Updates

Execute in this order (each doc references the prior):

1. **architecture.md** — most authoritative; deepest changes
2. **prd.md** — defines requirements that epics implement
3. **epics.md** — implements requirements, references architecture
4. **ux-design-specification.md** — visual spec, references all others

**Mode:** Incremental (each edit proposal reviewed individually)

### Phase B: Code Rework (Epic 1)

1. Rework Story 1.2: Replace `devPodList*.json` fixtures with `instanceList*.json` matching agent-env JSON shape
2. Rework Story 1.3: Rewrite `discovery.ts` to call `agent-env list --json`, update `types.ts`
3. Rework Story 1.4: Update `list.ts` command for new terminology and data shape
4. Update all tests

### Phase C: Housekeeping

1. Update `sprint-status.yaml` comments and cross-dependencies
2. Verification: `grep -ri "devpod" _bmad-output/planning-artifacts/orchestrator/` — should be zero (or historical context only)
3. Verify "stale" → "inactive" in FR/NFR context
4. Verify UX spec directory structure matches architecture

---

## 6. Agent Handoff Plan

| Step | Role | Action |
|------|------|--------|
| 1 | SM (current) | Approve this proposal |
| 2 | Architect | Execute Phase A — update all 4 planning artifacts (incremental mode) |
| 3 | SM | Update sprint-status.yaml |
| 4 | SM | Create rework stories for Epic 1 code changes |
| 5 | Developer | Execute Phase B — rework Epic 1 code |
| 6 | Developer | Run Phase C verification |

---

## 7. Verification Checklist (Post-Implementation)

- [ ] `grep -ri "devpod" _bmad-output/planning-artifacts/orchestrator/` returns zero matches (or historical only)
- [ ] `grep -ri "devpod list" _bmad-output/planning-artifacts/orchestrator/` returns zero
- [ ] "stale" → "inactive" in all FR/NFR contexts
- [ ] UX spec directory structure matches architecture's `lib/hooks/components/commands`
- [ ] Epic 1 stories reference `agent-env list --json` (not `devpod list`)
- [ ] Epic 4 stories reference `agent-env attach` (not `devpod ssh`)
- [ ] Architecture discovery pipeline describes `agent-env list --json` subprocess
- [ ] All fixture filenames reference `instanceList*` not `devPodList*`
- [ ] NFR11 references agent-env CLI (not DevPod CLI)
- [ ] Cross-dependencies in sprint-status.yaml updated
