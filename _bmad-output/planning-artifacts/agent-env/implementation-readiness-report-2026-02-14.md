---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
scope: "Epics 6, 7, and 8"
files:
  prd: "prd.md"
  architecture: "architecture.md"
  epics: "epics.md"
  ux: null
---

# Implementation Readiness Assessment Report

**Date:** 2026-02-14
**Project:** agent-env
**Scope:** Epics 6, 7, and 8

## 1. Document Inventory

| Document Type | File | Format |
|---|---|---|
| PRD | prd.md | Whole |
| Architecture | architecture.md | Whole |
| Epics & Stories | epics.md | Whole |
| UX Design | N/A | Not found |

**Notes:**
- No duplicates detected
- No UX document found (expected for CLI/infrastructure project)
- Assessment scoped to Epics 6, 7, and 8 only

## 2. PRD Analysis

### Functional Requirements (46 total)

**Instance Lifecycle:**
- FR1: User can create a new instance with a specified name
- FR2: User can create an instance from a git repository URL
- FR3: User can create an instance from current directory's git remote (`--repo .`)
- FR4: User can create an instance and immediately attach in one command
- FR5: User can remove an instance that passes safety checks
- FR6: User can force-remove an instance, bypassing safety checks with explicit warning
- FR43: User can create multiple instances from same repo with distinct user-chosen names

**Instance Discovery & Status:**
- FR7: User can list all instances with their current status
- FR8: User can see git state indicators (clean, uncommitted, unpushed)
- FR9: User can see last-attached timestamp per instance
- FR10: User can see purpose/label per instance
- FR11: System can detect instances with never-pushed branches
- FR45: User can see source repository per instance in list output

**Instance Access:**
- FR12: User can attach to an instance's tmux session
- FR13: User can attach to any instance from interactive menu
- FR14: System maintains persistent tmux session per instance

**State & Metadata:**
- FR15: User can get current purpose of an instance
- FR16: User can set/update purpose of an instance
- FR17: System tracks instance creation timestamp
- FR18: System tracks last-attached timestamp per instance
- FR46: User can set instance purpose at creation time via `--purpose` flag
- FR47: System exposes instance name as `$AGENT_ENV_INSTANCE` env var
- FR48: System exposes instance purpose as `$AGENT_ENV_PURPOSE` env var
- FR49: System displays instance name and purpose in tmux status bar
- FR50: System updates tmux status bar purpose live within 30 seconds

**Safety & Data Protection:**
- FR19: System can detect staged changes
- FR20: System can detect unstaged changes
- FR21: System can detect untracked files
- FR22: System can detect stashed changes
- FR23: System can detect unpushed commits on ALL branches
- FR24: System can detect branches never pushed to any remote
- FR25: System displays clear messaging about remove blockers
- FR26: System warns that force-remove results in permanent data loss

**Configuration & Environment:**
- FR27: System applies baseline devcontainer config (with opt-in override)
- FR28: Baseline includes Claude Code CLI authenticated and ready
- FR29: Baseline includes git signing configured
- FR30: Baseline includes SSH agent forwarded from host
- FR31: Baseline includes tmux running with persistent session
- FR32: Baseline includes shell properly configured
- FR33: System clones the specified repository into the instance

**CLI Interface:**
- FR34: User can launch interactive menu with no arguments
- FR35: User can run all core commands non-interactively
- FR36: User can get JSON output from list command
- FR37: User can install shell completion for bash/zsh
- FR38: System provides structured terminal output with ANSI color codes

**Installation & Platform:**
- FR39: User can install globally via npm/pnpm
- FR40: System runs on macOS (Intel and Apple Silicon)
- FR41: System runs on Linux
- FR42: System requires Docker for container operations

**Repo Management (Growth):**
- FR51: System tracks repositories in a local registry
- FR52: User can list tracked repositories
- FR53: User can create instance from registered repository

**Purpose Visibility (Growth):**
- FR54: System displays purpose in VS Code window title

### Non-Functional Requirements (24 total)

**Performance:**
- NFR1: Attach within 2 seconds
- NFR2: List within 500ms for up to 20 instances
- NFR3: Create with cached image within 30 seconds
- NFR4: First command after attach within 5 seconds
- NFR5: Safety check within 3 seconds
- NFR22: Purpose in tmux within 1 second of attach
- NFR23: Live purpose updates in tmux within 30 seconds

**Reliability:**
- NFR6: Safety checks detect 100% of test suite scenarios
- NFR7: Safety check false positive rate below 5%
- NFR8: tmux sessions persist across attach/detach
- NFR9: Instance state survives host restart
- NFR10: Partial failures don't block other instances

**Integration & Compatibility:**
- NFR11: Docker Engine 20.10+
- NFR12: Baseline conforms to devcontainer.json spec
- NFR13: JSON output parseable by standard tools
- NFR14: Git operations work with any remote
- NFR15: SSH agent forwarding with standard SSH configs
- NFR16: Works in tmux, screen, and bare terminal
- NFR24: tmux integration doesn't interfere with user's tmux config

**Maintainability:**
- NFR17: Modules with clear boundaries
- NFR18: Clear separation between CLI, container lifecycle, and git operations
- NFR19: Core modules have 80%+ branch coverage
- NFR20: No external runtime deps beyond Node.js and Docker
- NFR21: Configuration includes JSON Schema

### PRD Completeness Assessment

The PRD is comprehensive with clear requirement numbering, well-defined scope boundaries (MVP vs Growth vs Vision), and concrete measurable outcomes. All functional requirements have explicit identifiers. Non-functional requirements include specific quantitative thresholds.

## 3. Epic Coverage Validation (Epics 6, 7, 8)

### Coverage Matrix

| FR | PRD Requirement | Epic Coverage | Status |
|----|----------------|---------------|--------|
| FR43 | Multi-instance per repo with user-chosen names | Epic 7, Story 7.1/7.2 | ✓ Covered |
| FR45 | Source repo visible in list output | Epic 7, Story 7.4 | ✓ Covered |
| FR46 | Purpose set at creation via `--purpose` flag | Epic 6, Story 6.2 | ✓ Covered |
| FR47 | `$AGENT_ENV_INSTANCE` env var inside container | Epic 6, Story 6.1 | ✓ Covered |
| FR48 | `$AGENT_ENV_PURPOSE` env var inside container | Epic 6, Story 6.2 | ✓ Covered |
| FR49 | Instance name + purpose in tmux status bar | Epic 6, Story 6.1 | ✓ Covered |
| FR50 | Live tmux purpose updates (within 30s) | Epic 6, Story 6.3 | ✓ Covered |
| FR51 | Track repos in local registry | Epic 8, Story 8.1 | ✓ Covered |
| FR52 | List tracked repos | Epic 8, Story 8.1 | ✓ Covered |
| FR53 | Create from registered repo | Epic 8, Story 8.2 | ✓ Covered |
| FR54 | VS Code window title shows purpose | Epic 8, Story 8.3 | ✓ Covered |
| FR27 (rev) | Baseline config with opt-in prompt | Epic 7, Story 7.5 | ✓ Covered |

### NFR Coverage (New)

| NFR | Requirement | Epic Coverage | Status |
|-----|------------|---------------|--------|
| NFR22 | Purpose in tmux within 1s of attach | Epic 6, Story 6.1 | ✓ Covered |
| NFR23 | Live purpose updates within 30s | Epic 6, Story 6.3 | ✓ Covered |
| NFR24 | tmux integration non-interfering | Epic 6, Story 6.1 | ✓ Covered |

### Missing Requirements

None. All 12 new FRs and 3 new NFRs are mapped to epics with specific story coverage.

### Coverage Statistics

- Total new FRs (Epics 6-8 scope): 12
- FRs covered in epics: 12
- Coverage percentage: 100%
- FR44 absent from PRD numbering (confirmed gap, not a missing requirement)

## 4. UX Alignment Assessment

### UX Document Status

Not found. No UX document exists in planning artifacts.

### Assessment

UX documentation is **not required** for this project:
- CLI tool with terminal-first design (no web/mobile UI)
- PRD explicitly targets CLI and tmux as primary design surfaces
- Interactive menu uses Ink (terminal UI), adequately specified in story ACs
- tmux and VS Code integrations are text-based with clear specifications
- User journeys in PRD serve as the UX reference

### Alignment Issues

None.

### Warnings

None. Absence of UX documentation is expected and appropriate for a CLI tool.

## 5. Epic Quality Review

### Review Methodology

Validated all three epics against create-epics-and-stories best practices: user value focus, epic independence, story sizing, acceptance criteria quality, dependency analysis, and architecture alignment.

### Epic 6: In-Container Purpose & Tmux Visibility — PASS

**User Value:** Strong. "Context is always visible" directly maps to PRD Journey 5.
**Independence:** Verified. Requires only completed Epics 1-5. No dependency on Epics 7 or 8.
**Stories:** 3 stories, all with proper Given/When/Then ACs covering happy paths and error cases.
**Architecture Alignment:** All three stories map cleanly to architecture decisions (bind-mount, jq parsing, CLI-in-container, environment detection).

### Epic 7: Naming Model, Multi-Instance & Baseline Prompt — PASS (with notes)

**User Value:** Clear. Users type `auth` instead of `bmad-orch-auth`. Multiple instances per repo. Config choice.
**Independence:** Verified. No dependency on Epics 6 or 8.
**Stories:** 5 stories with proper ACs. Edge cases well-covered.
**Architecture Alignment:** Stories match all revised architecture decisions (flat repo-scoped layout, slug compression, two-phase resolution, baseline prompt).

### Epic 8: Growth — Repo Registry & VS Code Purpose — PASS

**User Value:** Clear convenience and polish features. Explicitly deferrable.
**Independence:** Depends on Epics 6 and 7 (backward, not forward). System works without Epic 8.
**Stories:** 3 clean stories with proper ACs. External dependency (VS Code extension) documented.
**Architecture Alignment:** Matches architecture decisions (derived registry, VS Code template pattern).

### Findings by Severity

#### No Critical Violations Found

No technical-only epics, no forward dependencies, no epic-sized stories.

#### Minor Concerns (3)

**MC-1: Story 6.3 bundles multiple capabilities**
Story 6.3 combines CLI installation, dev mode, environment detection, and purpose updates from inside the container. All serve the same goal (CLI works inside container), so the bundling is coherent, but the story is on the upper end of sizing.
- **Recommendation:** Acceptable as-is. Could split CLI installation from purpose updates if implementation proves unwieldy, but unnecessary pre-emptively.

**MC-2: Story 7.1 is a technical refactoring story**
Story 7.1 ("Refactor workspace naming and state schema for repo-scoped instances") is framed as "As a developer" — it's infrastructure for the user-facing changes in Stories 7.2-7.5. The story includes functional verification ACs (all commands still work).
- **Recommendation:** Acceptable. Foundational refactoring stories are valid when they enable user-facing stories in the same epic.

**MC-3: Story 7.3 has high edge-case complexity**
Story 7.3 (two-phase resolution) has 8 distinct resolution scenarios in its ACs. It's complex but each scenario is a necessary user-facing behavior.
- **Recommendation:** Acceptable as-is. The complexity reflects the problem domain, not over-engineering. Edge case matrix is exactly what's needed for reliable implementation.

### Observations (Not Violations)

1. **Architecture consistency:** Some early architecture sections reference hooks pattern and old naming, but superseded sections are clearly marked. Epics correctly reference actual implementation patterns (lib/ orchestration modules, repo-scoped flat workspaces).

2. **Concurrent development risk:** Epics 6 and 7 both modify `create.ts` and devcontainer config. The epics doc recommends sequential development and acknowledges merge conflict potential. This is a process note, not a quality issue.

3. **No migration path:** Epic 7 intentionally drops flat-layout workspaces without migration. Documented and justified (negligible existing instances). Appropriate for current project stage.

4. **Breaking change in AGENT_ENV_INSTANCE:** Epic 6 sets this to the ad-hoc compound name; Epic 7 changes it to the explicit `<repo-slug>-<instance>` compound name (still globally unique, flat layout). The ADR explicitly declares this opaque — consumers should not parse it. Confirmed: zero runtime consumers in image scripts.

### Best Practices Compliance Summary

| Check | E6 | E7 | E8 |
|-------|-----|-----|-----|
| Delivers user value | PASS | PASS | PASS |
| Functions independently | PASS | PASS | PASS |
| Stories sized appropriately | PASS | PASS (MC-3) | PASS |
| No forward dependencies | PASS | PASS | PASS |
| Clear acceptance criteria | PASS | PASS | PASS |
| FR traceability maintained | PASS | PASS | PASS |
| Architecture alignment | PASS | PASS | PASS |

## 6. Summary and Recommendations

### Overall Readiness Status

**READY**

Epics 6, 7, and 8 are implementation-ready. All functional requirements are mapped, acceptance criteria are well-structured, architecture decisions are documented, and no critical issues were found.

### Findings Summary

| Step | Result |
|------|--------|
| Document Discovery | All required documents found. No duplicates. No UX doc (expected). |
| PRD Analysis | 46 FRs + 24 NFRs extracted. PRD is comprehensive with clear numbering. |
| Epic Coverage | 100% FR coverage (12/12 new FRs mapped to Epics 6-8). 100% new NFR coverage. |
| UX Alignment | No UX doc needed (CLI tool). No alignment issues. |
| Epic Quality | All 3 epics PASS. 0 critical violations. 0 major issues. 3 minor concerns. |

### Critical Issues Requiring Immediate Action

None.

### Minor Concerns (Informational — No Action Required)

1. **Story 6.3 sizing:** Bundles CLI installation, dev mode, environment detection, and purpose updates. Coherent but large. Monitor during implementation — split if unwieldy.

2. **Story 7.1 technical nature:** Refactoring story ("As a developer") rather than pure user story. Acceptable as foundation for user-facing Stories 7.2-7.5.

3. **Story 7.3 complexity:** 8 edge-case scenarios in two-phase resolution. Reflects the problem domain. Thorough test coverage essential.

### Recommended Next Steps

1. **Proceed to Sprint Planning** — Generate sprint-status.yaml for Epics 6, 7, and 8.
2. **Implement Epic 6 first** — Most user-visible, immediate daily value (purpose in tmux). Independent of other new epics.
3. **Implement Epic 7 second** — Naming refactor improves UX. Sequential after Epic 6 avoids merge conflicts in shared files (`create.ts`, `devcontainer.json`, `state.ts`, `workspace.ts`).
4. **Implement Epic 8 last** — Growth polish. Requires both Epics 6 and 7 complete.

### Implementation Risk Notes

- **Concurrent development warning:** Epics 6 and 7 both modify the create command and devcontainer config. The epics doc recommends sequential development to avoid merge conflicts.
- **Breaking change (Epic 7):** Old flat-layout workspaces will not be detected after Epic 7. No migration code. Existing instances must be recreated. Acceptable given negligible existing user base.
- **AGENT_ENV_INSTANCE value changes:** Ad-hoc compound name in Epic 6, explicit `<repo-slug>-<instance>` compound name after Epic 7 (still globally unique — flat layout preserved). ADR declares the value opaque — consumers should not parse it.

### Final Note

This assessment found 0 critical issues and 3 minor concerns across 5 validation categories. All three epics meet best practices for user value, independence, story quality, and architecture alignment. The planning artifacts (PRD, Architecture, Epics) are well-aligned and ready for implementation.

---

**Assessment Date:** 2026-02-14
**Assessor:** Implementation Readiness Workflow (PM/SM Expert)
**Scope:** agent-env Epics 6, 7, and 8
