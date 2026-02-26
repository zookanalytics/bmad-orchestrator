---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
assessmentContext: "Pre-Epic 7 checkpoint"
documentsUsed:
  prd: "agent-env/prd.md"
  architecture: "agent-env/architecture.md"
  epics: "agent-env/epics.md"
  ux: "N/A - infrastructure project, no UX component"
---

# Implementation Readiness Assessment Report

**Date:** 2026-02-16
**Project:** agent-tools (agent-env sub-project)
**Context:** Pre-Epic 7 checkpoint (Epics 1-6 complete)

## Document Inventory

| Document Type | File | Size | Last Modified |
|---|---|---|---|
| PRD | `agent-env/prd.md` | 27,094 bytes | Feb 16 |
| Architecture | `agent-env/architecture.md` | 68,428 bytes | Feb 16 |
| Epics & Stories | `agent-env/epics.md` | 87,392 bytes | Feb 16 |
| UX Design | N/A | — | — |

**Duplicates:** None
**Missing Documents:** UX (expected — infrastructure project)
**Previous Readiness Reports:** 3 prior reports found (Jan 27, Feb 05, Feb 14)

## PRD Analysis

### Functional Requirements

#### Instance Lifecycle
- FR1: User can create a new instance with a specified name
- FR2: User can create an instance from a git repository URL
- FR3: User can create an instance from the current directory's git remote by specifying `--repo .`
- FR4: User can create an instance and immediately attach in one command
- FR5: User can remove an instance that passes safety checks
- FR6: User can force-remove an instance, bypassing safety checks with explicit warning
- FR43: User can create multiple instances from the same repository, each with a distinct user-chosen name

#### Instance Discovery & Status
- FR7: User can list all instances with their current status
- FR8: User can see git state indicators for each instance (clean, uncommitted, unpushed)
- FR9: User can see the last-attached timestamp for each instance
- FR10: User can see the purpose/label for each instance
- FR11: System can detect instances with never-pushed branches
- FR45: User can see the source repository for each instance in list output

#### Instance Access
- FR12: User can attach to an instance's tmux session
- FR13: User can attach to any instance from the interactive menu
- FR14: System maintains persistent tmux session per instance across attach/detach cycles

#### State & Metadata
- FR15: User can get the current purpose of an instance
- FR16: User can set/update the purpose of an instance
- FR17: System tracks instance creation timestamp
- FR18: System tracks last-attached timestamp per instance
- FR46: User can set instance purpose at creation time via `--purpose` flag
- FR47: System exposes instance name as `$AGENT_ENV_INSTANCE` environment variable inside the container
- FR48: System exposes instance purpose as `$AGENT_ENV_PURPOSE` environment variable inside the container
- FR49: System displays instance name and purpose in the tmux status bar inside the container
- FR50: System updates tmux status bar purpose live when purpose changes externally (within 30 seconds)

#### Safety & Data Protection
- FR19: System can detect staged changes in an instance
- FR20: System can detect unstaged changes in an instance
- FR21: System can detect untracked files in an instance
- FR22: System can detect stashed changes in an instance
- FR23: System can detect unpushed commits on ALL branches (not just current)
- FR24: System can detect branches that have never been pushed to any remote
- FR25: System displays clear messaging about what blocks a remove operation
- FR26: System warns that force-remove results in permanent data loss

#### Configuration & Environment
- FR27: System applies agent-env baseline devcontainer configuration to new instances when the cloned repository has no `.devcontainer/` directory; user can opt in to use the baseline for repos that have their own config
- FR28: Baseline includes Claude Code CLI authenticated and ready
- FR29: Baseline includes git signing configured
- FR30: Baseline includes SSH agent forwarded from host
- FR31: Baseline includes tmux running with persistent session
- FR32: Baseline includes shell properly configured
- FR33: System clones the specified repository into the instance

#### CLI Interface
- FR34: User can launch interactive menu by running agent-env with no arguments
- FR35: User can run all core commands (create, list, attach, remove, purpose) non-interactively with explicit arguments
- FR36: User can get JSON output from list command for scripting/orchestration
- FR37: User can install shell completion for bash/zsh
- FR38: System provides structured terminal output with ANSI color codes for status indicators and section headers

#### Installation & Platform
- FR39: User can install agent-env globally via npm/pnpm
- FR40: System runs on macOS (Intel and Apple Silicon)
- FR41: System runs on Linux
- FR42: System requires Docker for container operations

#### Repo Management (Growth)
- FR51: System tracks repositories used for instance creation in a local registry
- FR52: User can list tracked repositories
- FR53: User can create a new instance from a registered repository without re-entering the URL

#### Purpose Visibility (Growth)
- FR54: System displays instance purpose in VS Code window title when attached via VS Code

**Total FRs: 46** (42 MVP + 4 Growth)

### Non-Functional Requirements

#### Performance
- NFR1: Attach to existing instance completes within 2 seconds
- NFR2: List command returns within 500ms for up to 20 instances
- NFR3: Create with cached base image completes within 30 seconds
- NFR4: First command after attach executes within 5 seconds (time-to-productive)
- NFR5: Safety check analysis completes within 3 seconds
- NFR22: Purpose displayed in tmux status bar within 1 second of attach
- NFR23: Live purpose updates reflected in tmux status bar within 30 seconds of change

#### Reliability
- NFR6: Safety checks detect 100% of unsafe scenarios defined in the test suite
- NFR7: Safety checks false positive rate below 5% across test scenarios
- NFR8: tmux sessions persist across attach/detach cycles without data loss
- NFR9: Instance state survives host machine restart
- NFR10: Partial failures (one instance unreachable) do not block operations on other instances

#### Integration & Compatibility
- NFR11: Works with Docker Engine 20.10+
- NFR12: Agent-env baseline devcontainer configuration conforms to the devcontainer.json specification
- NFR13: JSON output parseable by standard tools (jq, orchestrator)
- NFR14: Git operations work with any remote (GitHub, GitLab, Bitbucket, etc.)
- NFR15: SSH agent forwarding works with standard SSH configurations
- NFR16: Works in tmux, screen, and bare terminal environments
- NFR24: tmux status bar integration does not interfere with user's tmux configuration outside agent-env instances

#### Maintainability
- NFR17: Codebase organized into modules with clear boundaries: CLI layer, container lifecycle, safety checks, configuration, git operations
- NFR18: Clear separation between CLI, container lifecycle, and git operations
- NFR19: Core modules (lifecycle, safety, configuration) have 80% or higher branch coverage
- NFR20: No external runtime dependencies beyond Node.js and Docker
- NFR21: Configuration includes JSON Schema with descriptions for all fields

**Total NFRs: 24** (all MVP-tier)

### Additional Requirements

#### Constraints & Assumptions
- Runtime Requirements: Node.js (LTS), Docker, macOS or Linux
- Agent-agnostic: no assumptions about which AI agent runs inside
- Terminal-first design: CLI and tmux are primary design targets
- Personal utility tool: no revenue, growth, or market targets
- Numbering gaps in FRs (FR43-FR54 added later) reflect iterative refinement

#### PRD Completeness Assessment

The PRD is well-structured with clear scope boundaries (MVP vs Growth vs Vision). Requirements are numbered and specific. The edit history shows 3 rounds of refinement including post-validation and architecture review fixes. No vague or subjective FRs remain. NFRs have concrete measurable thresholds. The PRD clearly delineates what is MVP vs Growth vs Vision scope.

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement | Epic Coverage | Status |
|----|----------------|---------------|--------|
| FR1 | Create instance with name | Epic 2 (Story 2.4) | ✓ Covered |
| FR2 | Create from repo URL | Epic 2 (Story 2.4) | ✓ Covered |
| FR3 | Create from current directory (`--repo .`) | Epic 2 (Story 2.5) | ✓ Covered |
| FR4 | Create and attach in one command | Epic 2 (Story 2.5) | ✓ Covered |
| FR5 | Remove with safety checks | Epic 5 (Story 5.1) | ✓ Covered |
| FR6 | Force-remove with warning | Epic 5 (Story 5.3) | ✓ Covered |
| FR7 | List all instances with status | Epic 3 (Story 3.2) | ✓ Covered |
| FR8 | Git state indicators | Epic 3 (Story 3.3) | ✓ Covered |
| FR9 | Last-attached timestamp | Epic 3 (Story 3.2) | ✓ Covered |
| FR10 | Purpose/label visibility | Epic 3 (Story 3.2) | ✓ Covered |
| FR11 | Never-pushed branch detection | Epic 3 (Story 3.1) | ✓ Covered |
| FR12 | Attach to tmux session | Epic 4 (Story 4.1) | ✓ Covered |
| FR13 | Attach from interactive menu | Epic 4 (Story 4.3) | ✓ Covered |
| FR14 | Persistent tmux sessions | Epic 4 (Story 4.1) | ✓ Covered |
| FR15 | Get purpose | Epic 4 (Story 4.2) | ✓ Covered |
| FR16 | Set/update purpose | Epic 4 (Story 4.2) | ✓ Covered |
| FR17 | Creation timestamp tracking | Epic 4 (Story 4.1) | ✓ Covered |
| FR18 | Last-attached timestamp tracking | Epic 4 (Story 4.1) | ✓ Covered |
| FR19 | Detect staged changes | Epic 5 (Story 5.1) | ✓ Covered |
| FR20 | Detect unstaged changes | Epic 5 (Story 5.1) | ✓ Covered |
| FR21 | Detect untracked files | Epic 5 (Story 5.1) | ✓ Covered |
| FR22 | Detect stashed changes | Epic 5 (Story 5.1) | ✓ Covered |
| FR23 | Detect unpushed on ALL branches | Epic 5 (Story 5.1) | ✓ Covered |
| FR24 | Detect never-pushed branches | Epic 5 (Story 5.1) | ✓ Covered |
| FR25 | Clear blocker messaging | Epic 5 (Story 5.2) | ✓ Covered |
| FR26 | Force-remove warning | Epic 5 (Story 5.3) | ✓ Covered |
| FR27 | Baseline devcontainer; opt-in prompt | Epic 2 (Story 2.2) + Epic 7 (Story 7.5) | ✓ Covered |
| FR28 | Claude Code ready | Epic 2 (Story 2.2) | ✓ Covered |
| FR29 | Git signing configured | Epic 2 (Story 2.2) | ✓ Covered |
| FR30 | SSH agent forwarded | Epic 2 (Story 2.2) | ✓ Covered |
| FR31 | tmux running | Epic 2 (Story 2.2) | ✓ Covered |
| FR32 | Shell configured | Epic 2 (Story 2.2) | ✓ Covered |
| FR33 | Clone repository | Epic 2 (Story 2.4) | ✓ Covered |
| FR34 | Interactive menu | Epic 4 (Story 4.3) | ✓ Covered |
| FR35 | Scriptable commands | Epic 1 (Story 1.4) | ✓ Covered |
| FR36 | JSON output | Epic 3 (Story 3.4) | ✓ Covered |
| FR37 | Shell completion | Epic 4 (Story 4.4) | ✓ Covered |
| FR38 | Colored output | Epic 1 (Story 1.4) | ✓ Covered |
| FR39 | npm/pnpm install | Epic 1 (Story 1.4) | ✓ Covered |
| FR40 | macOS support | Epic 1 | ✓ Covered |
| FR41 | Linux support | Epic 1 | ✓ Covered |
| FR42 | Docker requirement | Epic 1 | ✓ Covered |
| FR43 | Multi-instance per repo | Epic 7 (Stories 7.1, 7.2) | ✓ Covered |
| FR45 | Source repo in list output | Epic 7 (Story 7.4) | ✓ Covered |
| FR46 | Purpose at creation via `--purpose` | Epic 6 (Story 6.2) | ✓ Covered |
| FR47 | `$AGENT_ENV_INSTANCE` env var | Epic 6 (Story 6.1) | ✓ Covered |
| FR48 | `$AGENT_ENV_PURPOSE` env var | Epic 6 (Story 6.2) | ✓ Covered |
| FR49 | tmux status bar shows name + purpose | Epic 6 (Story 6.1) | ✓ Covered |
| FR50 | Live tmux purpose updates | Epic 6 (Story 6.3) | ✓ Covered |
| FR51 | Track repos in local registry | Epic 8 (Story 8.1) | ✓ Covered (Growth) |
| FR52 | List tracked repos | Epic 8 (Story 8.1) | ✓ Covered (Growth) |
| FR53 | Create from registered repo | Epic 8 (Story 8.2) | ✓ Covered (Growth) |
| FR54 | VS Code window title shows purpose | Epic 8 (Story 8.3) | ✓ Covered (Growth) |

### Missing Requirements

**No missing FR coverage.** All 46 PRD functional requirements (including the 4 Growth FRs) are mapped to specific epics and stories.

**Note:** FR44 is absent from PRD numbering (jumps from FR43 to FR45). The epics document explicitly notes this gap. This is a numbering artifact, not a missing requirement.

### Coverage Statistics

- Total PRD FRs: 46 (excluding FR44 which doesn't exist)
- FRs covered in epics: 46
- Coverage percentage: **100%**
- MVP FRs covered: 42/42 (100%)
- Growth FRs covered: 4/4 (100%)

## UX Alignment Assessment

### UX Document Status

**Not Found** — expected and appropriate for this project type.

### Assessment

agent-env is a **terminal-first CLI tool**. The PRD explicitly states: "Terminal-first tool. VS Code integration is seamless, but CLI and tmux are the primary design targets." A formal UX specification is not warranted.

CLI UX patterns are adequately addressed within the epics themselves:
- **Interactive menu** (FR34): Story 4.3 specifies Ink + @inkjs/ui Select component, keyboard navigation, terminal width handling, and truncation behavior
- **Status indicators** (FR8, FR38): Story 3.3 defines ✓/●/↑/⚠ indicators with color coding
- **Safety prompt** (FR25): Story 5.2 specifies color-coded severity, counts, and actionable suggestions
- **tmux status bar** (FR49): Story 6.1 defines format, truncation at 40 chars, and no-purpose display behavior

### Alignment Issues

None. CLI UX decisions are embedded in story acceptance criteria where they belong for a terminal tool.

### Warnings

None. No UX document gap exists for this project type.

## Epic Quality Review

### Epic Structure Validation

#### User Value Focus

| Epic | User Value? | Notes |
|------|------------|-------|
| Epic 1 | ⚠️ Borderline | Title is technical ("Monorepo Setup") but acceptable as the foundational Epic 1 for a greenfield project. Value statement: "run `agent-env --help`" |
| Epic 2 | ✓ Good | "User can spin up isolated, AI-ready dev environments with a single command" |
| Epic 3 | ✓ Good | "User can see all instances and their git state at a glance" |
| Epic 4 | ✓ Good | "User can seamlessly attach to environments and manage instance metadata" |
| Epic 5 | ✓ Good | "User can safely clean up environments without ever losing work" |
| Epic 6 | ✓ Good | "Users always know what they're working on — purpose is visible" |
| Epic 7 | ⚠️ Borderline | Title includes "Naming Model" (internal concern), but user value statement is clear: "Users can create multiple instances from the same repo with clean, user-friendly names" |
| Epic 8 | ✓ Good | Clear convenience features with user value |

**Verdict:** No critical violations. Two borderline titles (Epics 1 and 7) have adequate user value statements. Epic 1 is the standard infrastructure-first pattern for greenfield projects.

#### Epic Independence

All 8 epics pass the independence check:
- No epic requires a future epic to function
- Dependency chain is strictly forward: 1 → 2 → 3 → 4/5 (parallel after 3), then 1-5 → 6/7 (parallel), then 6+7 → 8
- The standalone guarantee is explicitly documented: "Each epic delivers complete, usable functionality"

### Story Quality Assessment — Epic 4 (Next for Implementation)

#### Story 4.1: Implement attach command
- **Structure:** ✓ Proper user story format with Given/When/Then ACs
- **Completeness:** ✓ Covers 9 scenarios: running instance, detach/reattach, no tmux session, stopped instance, nonexistent instance, timestamp update, OrbStack not running, timeout
- **Error handling:** ✓ Error codes defined (ORBSTACK_REQUIRED), timeout specified (60s)
- **NFR alignment:** ✓ NFR1 (attach < 2s) explicitly referenced
- **Dependencies:** ✓ Uses workspace.ts and state.ts from Epic 2, no forward references
- **Concern:** Story 4.1 AC says "If no tmux session exists, create new session named 'main'" — but the baseline already starts tmux via post-create.sh. This scenario would only occur if tmux crashed or was manually killed. The AC is defensive and appropriate.

#### Story 4.2: Implement purpose command
- **Structure:** ✓ Proper user story format
- **Completeness:** ✓ Covers get, set, clear, and error scenarios (5 ACs)
- **Dependencies:** ✓ Uses state.ts from Epic 2, no forward references
- **Concern:** None

#### Story 4.3: Implement interactive menu
- **Structure:** ✓ Proper user story format
- **Completeness:** ✓ Covers navigation, selection, exit, empty state, narrow terminal, large instance count (7 ACs)
- **Dependencies:** ✓ Uses list functionality from Epic 3, attach from Story 4.1
- **Concern:** Story 4.3 depends on Story 4.1 (attach after selection) — this is a within-epic forward dependency. However, Story 4.1 precedes 4.3 in sequence, so this is a valid intra-epic dependency (Story N uses output of Story N-2).

#### Story 4.4: Add shell completion
- **Structure:** ✓ Proper user story format
- **Completeness:** ✓ Covers bash, zsh, command completion, instance name completion, help (5 ACs)
- **Dependencies:** ✓ Uses workspace scanning from Epic 2, no forward references
- **Concern:** None

**Epic 4 Verdict:** All 4 stories are well-structured with comprehensive ACs. No critical violations. No forward dependencies.

### Story Quality Assessment — Epics 6-8 (Newly Planned)

#### Epic 6 (3 stories)
- **Story 6.1:** ✓ Strong — includes spike validation, jq dependency handling, fallback for missing state, NFR references. 7 ACs covering happy path, no-purpose, truncation, env vars, non-baseline containers, missing state.
- **Story 6.2:** ✓ Good — 4 ACs for --purpose flag and env var. Clear note that env var is shell-startup, not live-updated.
- **Story 6.3:** ✓ Good — 7 ACs covering in-container purpose updates, CLI installation, dev mode, environment detection. Clear container-aware path resolution.
- **Epic 6 Concern:** None. Architecture ADR decisions are well-documented inline.

#### Epic 7 (5 stories)
- **Story 7.1:** ✓ Strong but large — refactors naming across ALL consumers. ACs cover workspace creation, scanWorkspaces, old-format handling, and all commands (list, attach, remove, purpose). Technical requirements include comprehensive list of files to update.
- **Story 7.2:** ✓ Good — slug derivation, compression, validation. 6 ACs with edge cases.
- **Story 7.3:** ✓ Good — two-phase resolution with 8 ACs covering all edge cases (no remote, multiple remotes, subdirectory, ambiguity).
- **Story 7.4:** ✓ Good — simple story adding repo column and --repo filter. 3 ACs.
- **Story 7.5:** ✓ Good — baseline prompt with 5 ACs covering all three states (force-baseline, force-repo, ask-user).
- **Epic 7 Concern (Minor):** Story 7.1 is large — it touches 10+ files for a schema refactor. This is borderline on story sizing but the changes are mechanical (field renames), not complex logic. Splitting would create artificial separation.

#### Epic 8 (3 stories)
- **Story 8.1:** ✓ Good — 4 ACs for repo registry derived from existing workspaces
- **Story 8.2:** ✓ Good — 3 ACs for create-from-slug with URL vs slug detection
- **Story 8.3:** ✓ Good — 6 ACs for VS Code statusBar.json template regeneration
- **Epic 8 Concern:** None. Dependency on Epics 6+7 is correctly documented.

### Best Practices Compliance Checklist

| Criterion | Epic 4 | Epic 6 | Epic 7 | Epic 8 |
|-----------|--------|--------|--------|--------|
| Delivers user value | ✓ | ✓ | ✓ | ✓ |
| Functions independently | ✓ | ✓ | ✓ | ✓ |
| Stories appropriately sized | ✓ | ✓ | ⚠️ 7.1 large | ✓ |
| No forward dependencies | ✓ | ✓ | ✓ | ✓ |
| Clear acceptance criteria | ✓ | ✓ | ✓ | ✓ |
| FR traceability maintained | ✓ | ✓ | ✓ | ✓ |
| Error scenarios covered | ✓ | ✓ | ✓ | ✓ |
| NFR references where applicable | ✓ | ✓ | ✓ | N/A |

### Quality Findings Summary

#### 🟡 Minor Concerns (2)

1. **Epic 7, Story 7.1 sizing:** Touches 10+ files for schema refactor. Borderline large but changes are mechanical (field renames). Splitting would create artificial dependency chains. Acceptable as-is with awareness.

2. **Epic 1 and Epic 7 titles:** Slightly technical in naming ("Monorepo Setup", "Naming Model"). Both have adequate user value statements in their descriptions. Not actionable — just noting for future epic planning.

#### No Critical or Major Violations Found

### Architecture ↔ Epic 7 Alignment

The architecture document (updated 2026-02-16) includes a detailed **"Epic 7 Pre-Implementation Validation"** section that validates the current codebase state against Epic 7 requirements. This is exceptionally thorough and identifies:

**4 Risks flagged in architecture:**
1. **Rebuild command not in epic scope** — `rebuild-instance.ts` and `commands/rebuild.ts` read state.json and must be updated alongside other consumers in Story 7.1, but the epic spec doesn't list them
2. **sshConnection field in list output** — JSON output mapping must preserve existing fields when adding new ones
3. **configSource and lastRebuilt state fields** — These exist in current InstanceState but aren't in Epic 7's revised schema. Must be preserved.
4. **Baseline prompt in non-interactive contexts** — Story 7.5's Ink prompt must handle non-TTY environments

**Validation verdict:** The architecture pre-implementation validation is comprehensive. All 4 risks are real and actionable. The file change matrix covers 20+ files with specific change descriptions per story.

## Summary and Recommendations

### Overall Readiness Status

**READY** — with 4 actionable items to address before or during implementation.

### Critical Issues Requiring Immediate Action

No critical blockers found. All FRs are covered, dependencies are clean, and the architecture has been pre-validated against the actual codebase.

### Actionable Items (Address Before/During Implementation)

1. **Update Epic 7 Story 7.1 consumer list:** Add `rebuild-instance.ts` and `commands/rebuild.ts` to the list of state.json consumers that must be updated for the schema refactor (`name` → `instance`, `repo` → `repoUrl`, add `repoSlug`). These are currently omitted from the epic spec but flagged in the architecture validation.

2. **Preserve existing state fields in target schema:** Ensure the Epic 7 revised `InstanceState` schema preserves `configSource?: 'baseline' | 'repo'` and `lastRebuilt?: string` fields that exist in the current implementation. The architecture's updated target schema (line 1738) includes them, but the epic stories don't mention them.

3. **Handle non-TTY baseline prompt (Story 7.5):** The baseline prompt (Ink Select) needs a graceful fallback for non-interactive contexts (piped stdin, CI, etc.). Default to "use repo config" when stdin is not a TTY.

4. **Preserve sshConnection in JSON output (Story 7.4):** When adding `repoSlug` and `repoUrl` to `list --json` output, ensure existing `sshConnection` field is preserved in the JSON mapping.

### Strengths

- **100% FR coverage** — all 46 functional requirements mapped to specific epics and stories
- **Architecture pre-validation** — the Feb 16 architecture revision already validated Epic 7 against the live codebase, including a 20+ file change matrix
- **Clean dependency chain** — no forward dependencies, standalone guarantee documented
- **Comprehensive ACs** — all stories use Given/When/Then format with error scenarios
- **Drift log** — 14 documented architecture drifts from implementation, showing healthy tracking of architectural decisions vs. implementation reality

### Final Note

This assessment identified **0 critical issues** and **4 actionable items** across the PRD, architecture, and epics documents. The project is ready for Epic 7 implementation. The 4 items are minor oversights in the epic spec that are already documented in the architecture validation — they represent documentation gaps in the epic, not missing analysis. The recommended approach is to incorporate these items into Story 7.1's technical requirements before implementation begins.
