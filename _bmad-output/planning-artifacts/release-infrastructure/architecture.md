---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-02'
inputDocuments:
  - '_bmad-output/planning-artifacts/release-infrastructure/product-brief.md'
  - '_bmad-output/planning-artifacts/release-infrastructure/prd.md'
  - '_bmad-output/planning-artifacts/release-infrastructure/implementation-readiness-report-2026-02-01.md'
  - '_bmad-output/planning-artifacts/agent-env/architecture.md'
  - '_bmad-output/project-context.md'
project_name: 'release-infrastructure'
user_name: 'Node'
date: '2026-02-02'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
35 FRs across 9 categories:
- **Core Value (FR0):** Merge-to-publish automation — the single sentence that defines success
- **Version Management (FR1-5):** Conventional commit → version bump mapping, scope-to-package routing, manual changeset escape hatch, workspace protocol rewriting
- **Package Publishing (FR6-12):** Automated npm publish on merge, skip when no bumps pending, GitHub releases, idempotent re-run with pre-publish and pre-bump detection
- **Build Pipeline (FR13-15):** TypeScript CLI build before publish, data-only packages without build, queue concurrency (never cancel running publish)
- **Quality Validation (FR16-20):** Pack tarball → clean install → run CLI. MVP: basic functionality. Build-up: tarball file assertions, no-rebuild validation
- **Package Configuration (FR21-24):** Per-package opt-in, private exclusion, bin/files field validation
- **Visibility & Recovery (FR25-28):** Status badge, failure notifications, npm deprecate as rollback, inline recovery docs
- **Auth & Security (FR29-30):** Granular NPM_TOKEN, explicit workflow permissions
- **Conditional/Hardening (FR31-34):** Scope validation, changeset bot, config drift detection, token health monitoring

Architecturally, most FRs map to configuration (changesets config, package.json fields, workflow YAML) rather than application code. The integration test gate (FR16-20) is the primary area requiring actual scripting.

**Non-Functional Requirements:**
15 NFRs across 3 categories:
- **Security (NFR1-5):** Token management, permission scoping, private package protection, log hygiene
- **Integration (NFR6-10):** Registry failure tolerance, pnpm compatibility, commitlint/husky coexistence, no CI duplication, GitHub release API via changesets
- **Reliability (NFR11-15):** Safe re-run, partial failure recovery, silence on non-package merges, graceful degradation if conventional-commit plugin fails, badge accuracy

**Scale & Complexity:**

- Primary domain: CI/CD pipeline + npm publishing infrastructure
- Complexity level: Low
- Estimated architectural components: 4-5 (changesets config, publish workflow, integration test job, package configs, optional hardening scripts)

### Technical Constraints & Dependencies

| Constraint | Description |
|------------|-------------|
| Existing pnpm monorepo | `packages/*` workspace structure already established (orchestrator, agent-env, shared) |
| Existing CI | `.github/workflows/ci.yml` — publish workflow must complement, not duplicate |
| Existing husky/lint-staged | Pre-commit hook runs `lint-staged` only. No commitlint installed. No `commit-msg` hook. Won't interfere with CI bot commits. |
| Changesets as version engine | Decided in brief/PRD — handles workspace protocol rewriting, publish ordering |
| npm public registry | `@zookanalytics` org scope, public packages |
| agent-env as pilot | Prove pipeline with one TypeScript CLI package before scaling |
| `shared` stays private | `"private": true` — never published regardless of changesets config |

### Configuration Surface

**Artifacts we create** (we control the content, can change freely):

| Artifact | Purpose | Blast Radius |
|----------|---------|-------------|
| `.changeset/config.json` | Scope mapping, versioning strategy | Affects how all version bumps are generated |
| `.github/workflows/publish.yml` | Post-merge automation | The entire publish pipeline |
| Per-package `package.json` publish fields | `files`, `bin`, `exports`, `private` | Per-package publish correctness |
| `README.md` badge | Visibility | Cosmetic only |

**Artifacts we depend on** (external or shared — changes here affect us but we don't own them solely):

| Artifact | Owner | Our Dependency |
|----------|-------|---------------|
| `NPM_TOKEN` (GitHub secret) | npm registry / GitHub settings | All publishes fail if invalid |
| `.github/workflows/ci.yml` | Existing CI | Integration test job lives here (or depends on it) |
| `.husky/pre-commit` | Existing dev workflow | Runs `lint-staged` only — no conflict with CI |
| `pnpm-workspace.yaml` | Monorepo config | Changesets reads this to discover packages |
| Per-package `package.json` (non-publish fields) | Package development | `dependencies`, `scripts` — affect build output which affects publish |

### First Principles (Architectural Invariants)

1. **Merge to main → package on npm.** Everything else is mechanism. The fundamental requirement is a causal chain: code change → version number increases → artifact appears on registry.
2. **Version changes when package behavior changes.** Not on every commit. Docs-only merges produce no bump. A `shared/` change that affects agent-env's behavior *should* bump agent-env even though the commit wasn't scoped to agent-env — this is where the manual changeset escape hatch earns its keep.
3. **Published artifact verified to work before consumers get it.** The integration test answers one question: "if a consumer runs `npm install -g`, will they get a working tool?" Not "do all unit tests pass" (that's CI's job).
4. **Failure must be visible and recoverable.** Infrastructure that fails silently is worse than no infrastructure. Every failure mode must either be loud (badge, notification) or proactively detected (health check). Recovery must be "re-run the workflow," not "manually fix state."
5. **Solo-maintainer scale — complexity is the enemy.** Every moving part can break when you're not looking. The right question isn't "what's best practice for a team of 10?" but "what's the minimum mechanism that satisfies invariants 1-4 for a single person?"

### Cross-Cutting Concerns

1. **Changesets justified for edge case handling.** Specifically: workspace protocol rewriting (`workspace:*` → real versions) and multi-package publish ordering. If it were a single package with no workspace dependencies, a shell script would suffice. Changesets is chosen for what it solves, not because "monorepos use changesets."
2. **Workspace protocol rewriting verification.** Changesets rewrites `workspace:*` to real version numbers during publish. The integration test must inspect the tarball's `package.json` to verify no `workspace:` protocol references remain.
3. **Per-package build variation.** agent-env needs TypeScript build; future data packages (keystone-workflows) need no build. Publish workflow must support both without redesign.
4. **Partial failure recovery.** Version bump committed but npm publish fails. Workflow must detect this state and recover on re-run (FR10-12).
5. **Integration test isolation is the critical design decision.** Fresh GitHub Actions job with no `actions/checkout`. Build job uploads tarball as artifact. Integration test job downloads only the tarball into an empty runner workspace. No checkout, no `node_modules`, no `pnpm-lock.yaml`. The only thing on disk is the `.tgz` file. This is the cleanest isolation achievable in GitHub Actions without Docker.
6. **Husky/lint-staged — verified non-issue.** No commitlint, no commit-msg hook. Only `lint-staged` on pre-commit, which doesn't run in CI.
7. **Conventional-commit plugin ordering.** Manual `pnpm changeset` is the true MVP mechanism. The conventional-commit plugin is an optimization to add after proving the pipeline works without it. This reduces moving parts during initial setup and isolates debugging (pipeline problem vs plugin problem).
8. **Complexity budget — FR31-33 deferred.** Scope validation (FR31), changeset bot (FR32), and config drift detection (FR33) are deferred. At solo-maintainer scale with 2-3 packages, the feedback loops are short enough that these solve problems that barely exist. Architecture explicitly recommends deferral.
9. **Token health monitoring — FR34 kept as cheap scheduled check.** Weekly scheduled GitHub Actions workflow running `npm whoami --registry https://registry.npmjs.org`. If it fails, GitHub sends a notification. Catches the "expired token + no publishable merges = silent failure" scenario identified in failure mode analysis.

### Failure Mode Landscape

Analysis of component failure modes reveals three risk tiers:

| Tier | Category | Examples | Mitigation Strategy |
|------|----------|----------|-------------------|
| **Silent failures** | Most dangerous — pipeline appears healthy but isn't working | Token expired with no publishable merges; plugin silently ignores commit; integration test runs in wrong environment | Proactive health checks (FR34 scheduled `npm whoami`), test isolation verification, badge tracks *last publish* not *last run* |
| **Stuck state failures** | Version bumped but not published — requires intervention | npm publish fails mid-workflow; push permission missing | Idempotent re-run design (FR10-12), documented recovery procedures (FR28) |
| **Loud failures** | Pipeline fails visibly — easiest to handle | YAML syntax error; token 403; build failure | Status badge (FR25), GitHub Actions notifications (FR26) |

**Architectural implication:** The architecture should prioritize eliminating silent failures over handling loud ones. Loud failures are self-correcting. Silent failures compound.

## Starter Template Evaluation

### Primary Technology Domain

CI/CD pipeline + npm publishing infrastructure. No application framework or CLI scaffold applies. The "starter" is a set of tools installed and configured in the existing pnpm monorepo.

### Tooling Evaluated

| Package | Version | Purpose | Decision |
|---------|---------|---------|----------|
| @changesets/cli | 2.29.8 | Version management, publish orchestration | **Selected** — de facto standard for pnpm monorepos |
| changesets/action | v1 | GitHub Action for automated version PR + publish | **Selected** — proven workflow, actively maintained |
| @changesets/changelog-github | 0.5.2 | PR-linked changelog entries for GitHub releases | **Selected** — integrates with GitHub releases |
| Conventional commit plugins (changeset-conventional-commits 0.2.5, @bob-obringer/conventional-changesets 0.5.0) | 0.x | Auto-generate changesets from conventional commits | **Deferred** — all third-party 0.x, not mature enough for MVP. Manual `pnpm changeset` is the MVP mechanism. |

### Selected Approach: Changesets + GitHub Action

**Rationale:** @changesets/cli is recommended by pnpm official documentation for monorepo publishing. Handles workspace protocol rewriting, multi-package coordination, and publish ordering — the specific edge cases that justify a tool over a shell script. The conventional-commit plugin ecosystem is immature (all 0.x, third-party) — reinforces manual `pnpm changeset` as the MVP mechanism.

**Initialization:**

```bash
pnpm add -Dw @changesets/cli @changesets/changelog-github
pnpm changeset init
```

**Architectural Decisions Provided by Tooling:**

- Version bump coordination across packages (changesets core)
- Workspace protocol rewriting during publish (changesets core)
- "Version Packages" PR pattern for staging releases (changesets/action)
- GitHub release creation with PR-linked changelogs (changelog-github)
- Per-package publish exclusion via `"private": true` (changesets convention)

**What Tooling Does NOT Provide (Must Be Built):**

- Integration test job (pack → clean install → run CLI)
- publish.yml workflow configuration
- Per-package package.json publish fields (files, bin, exports)
- Status badge and token health monitoring
- Recovery documentation

## Core Architectural Decisions

### Prerequisites (Repository Settings)

The publish pipeline's reliability depends on two GitHub repository settings that are not workflow code but are load-bearing infrastructure:

1. **Branch protection on main — require CI to pass before merge.** This applies to the "Version Packages" PR too. If CI is red, nothing merges, preventing publication of untested code.
2. **No force pushes to main.** A force-push can erase version bump commits and consumed changeset files, creating a corrupted state that requires manual recovery.

### Decision Priority Analysis

**Already Decided (from context analysis + starter evaluation):**
- Changesets + changesets/action@v1 as core tooling
- Manual `pnpm changeset` for MVP (conventional-commit plugin deferred)
- FR31-33 deferred (scope validation, changeset bot, config drift)
- FR34 kept as weekly `npm whoami` scheduled workflow
- Integration test isolation: fresh GHA job, no checkout, artifact-only
- @changesets/changelog-github for release notes

**Critical Decisions (Made This Step):**

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Publish workflow pattern | "Version Packages" PR | Natural batching, visibility, protects main from partial-state corruption during mid-workflow failures |
| 2 | Integration test location | New job in existing `ci.yml` | Simpler, always runs, no path filter gaps |
| 3 | Integration test MVP assertions | 4 assertions: install, --version, --help, list --json | Catches "published but broken" without over-engineering |
| 4 | Package.json publish fields | No changes needed — agent-env already configured | bin, files, exports, type all correct |
| 5 | Workflow permissions | contents:write, pull-requests:write, id-token:write | Minimal explicit permissions, future-proofs provenance |
| 6 | Workflow concurrency | Queue, never cancel in-progress | Prevents half-published state on rapid merges |
| 7 | Changesets linked/fixed groups | None for MVP | Only one publishable package; revisit when second publishes |

**Deferred Decisions (Post-MVP):**
- Conventional-commit plugin selection (after pipeline proven)
- Linked/fixed package groups (after second package publishes)
- Tarball file list assertions (build-up after MVP baseline)
- workspace: protocol verification in tarball (build-up)
- Docker image publishing pipeline (different registry, different workflow)

### Publish Workflow Architecture

**Pattern:** "Version Packages" PR via changesets/action@v1

**Resilience advantage:** The PR pattern protects main from partial-state corruption. Version bumps happen on a PR branch — if the runner dies mid-workflow, main is untouched. Re-run creates a fresh PR. This is a concrete advantage over the direct-publish pattern.

**Flow:**
1. Developer merges feature PR to main (with changeset file included)
2. Publish workflow triggers on push to main
3. changesets/action detects pending changesets
4. Action creates/updates "Version Packages" PR with bumped versions + changelogs
5. Developer reviews and merges Version Packages PR
6. Publish workflow triggers again on that merge
7. Action runs configured publish command (`pnpm changeset publish`). Changesets checks each package — if the version in package.json is newer than what's on npm, it publishes. If already on npm, it skips. This is how idempotency works.
8. Action creates GitHub release with changelog from @changesets/changelog-github

**When nothing to publish:** Action exits cleanly. No PR created, no noise.

**Concurrency:** Queue group `publish`, never cancel in-progress.

**Permissions:** contents:write, pull-requests:write, id-token:write (explicit, minimal).

**Recovery procedures:**
- **Primary:** Re-run the publish workflow. `changeset publish` checks each package against npm — if the version is already published, it skips; if not, it publishes.
- **Fallback:** If re-run doesn't resolve (e.g., changesets/action exits with "nothing to do" because changesets are consumed and versions already bumped), manual recovery from local checkout: `pnpm build && pnpm changeset publish`. Document this inline in the workflow file.
- **Changelog plugin failure:** If `@changesets/changelog-github` crashes during `changeset version`, temporarily switch to `@changesets/changelog-git` in `.changeset/config.json` to unblock publishing. Note this fallback in a config comment.

### Integration Test Architecture

**Location:** New `integration-test` job in `.github/workflows/ci.yml`

**Job dependency:** `needs: [build]` — reuses the existing build job's output. One build, consumed by multiple jobs.

**Artifact flow:**
1. Build job: `pnpm --filter @zookanalytics/agent-env build` → `cd packages/agent-env && npm pack` → upload `.tgz` as GitHub Actions artifact
2. Integration test job: download artifact → no `actions/checkout` → runner workspace contains only the `.tgz` file

**Isolation mechanism:** No `actions/checkout`. No node_modules, no pnpm-lock.yaml, no monorepo context. The only file on disk is the downloaded tarball. This prevents undeclared dependencies from resolving via the workspace.

**MVP Assertions:**
1. `npm install -g ./zookanalytics-agent-env-*.tgz` — install succeeds
2. `agent-env --version` — exits 0, prints version
3. `agent-env --help` — exits 0, validates commander setup
4. `agent-env list --json` — exits 0, returns valid JSON with `ok` field (true or false). The command may return `{ "ok": false }` on a clean runner without Docker — that's expected. The assertion validates the full commander → command → lib → JSON output pipeline works, not that the host has infrastructure.

**Build-up Assertions (post-MVP):**
5. Tarball file list matches expected set (no test fixtures, source maps, dev config)
6. Tarball package.json has no `workspace:` references
7. bin entry points to existing file with shebang

### Token & Monitoring Architecture

**NPM_TOKEN:** Granular (fine-grained), scoped to `@zookanalytics/*`, automation permissions, 1-year expiry. Stored as GitHub Actions secret. Document token type, scope, and expiry date for rotation.

**Token health check:** Weekly scheduled workflow running `npm whoami --registry https://registry.npmjs.org`. Failure → GitHub notification. Catches silent token expiry between publishes.

**Status badge:** Publish workflow badge on README. Reflects last publish outcome.

## Implementation Patterns & Consistency Rules

### Workflow YAML Conventions

**Job and step naming:**
- Job IDs: kebab-case (`integration-test`, `publish-packages`)
- Step names: sentence case, action-oriented (`Build agent-env package`, `Install tarball in clean environment`)
- Step IDs (for `if` references): kebab-case (`pack-tarball`, `check-publish`)

**Structure:**
- One logical action per step. Don't combine `npm pack` and `npm install` in a single `run:` block.
- Use `name:` on every step — workflow logs should be scannable without reading shell commands.
- Pin action versions to major (`actions/checkout@v4`, `changesets/action@v1`), not SHA or minor — balance security with maintainability at solo-maintainer scale.

**Comments:**
- YAML comments for "why," not "what." The step name says what; the comment says why it's non-obvious.
- Recovery procedures as comments directly above the relevant step, not in a separate file. You'll read them when the step fails.

**Example:**
```yaml
# Recovery: if this fails, the NPM_TOKEN may be expired.
# Rotate at https://www.npmjs.com/settings/tokens and update
# the GitHub secret. Then re-run this workflow.
- name: Publish packages to npm
  run: pnpm changeset publish
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Shell Script Patterns (in Workflow Steps)

**Error handling:**
- Don't use `set -e` in multi-command steps — a failing intermediate command exits the step without context. Instead, check each command explicitly or use `&&` chaining.
- For assertions, use explicit `if` checks with descriptive error messages:

```bash
# Good — clear error message
if ! agent-env --version; then
  echo "::error::agent-env CLI failed to execute after install"
  exit 1
fi

# Bad — silent failure, no context
agent-env --version
```

**Variable quoting:**
- Always quote variables: `"$TARBALL"`, not `$TARBALL`
- Use `${{ }}` for GitHub Actions expressions, shell `$VAR` for shell variables

**Output validation:**
- When checking JSON output, use a lightweight check (grep or node -e), not a full jq dependency:

```bash
OUTPUT=$(agent-env list --json 2>&1)
if ! echo "$OUTPUT" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (!('ok' in d)) process.exit(1);
"; then
  echo "::error::agent-env list --json did not return valid JSON with 'ok' field"
  exit 1
fi
```

### Changeset File Conventions

**When to create manual changesets:**
- Always via `pnpm changeset` (interactive), not by hand-writing `.changeset/*.md`
- Required for every PR that changes publishable package behavior
- NOT required for: docs-only, CI config, BMAD module changes, internal tooling
- Cross-package impact (shared/ change affecting agent-env): create a changeset for agent-env explicitly — changesets won't infer this

**Changeset content:**
- First line: what changed (user-facing, concise)
- No implementation details — this becomes the changelog entry
- Example: `Add workspace validation before instance creation`
- Not: `Refactored workspace.ts to add validateWorkspace() function`

### Inline Documentation Conventions

**Where documentation lives:**
- Recovery procedures: YAML comments directly above the relevant workflow step
- Configuration rationale: JSON comments not supported in `.changeset/config.json` — use a `# Configuration notes` section at the top of `publish.yml` instead
- Token management: document token type, scope, and expiry date as a YAML comment in `publish.yml` near the `NPM_TOKEN` reference
- Changeset usage: comment in `.changeset/config.json` README (auto-generated by `changeset init`) — extend it with project-specific notes

**What NOT to document separately:**
- No `docs/releasing.md` in MVP. Everything lives inline where you'll look when something breaks. Consolidate to a separate doc only if inline comments become unwieldy (post-MVP).

### Enforcement Guidelines

**All AI Agents implementing release infrastructure MUST:**
1. Use the YAML naming conventions above (kebab-case IDs, sentence-case names)
2. Write explicit assertion checks with `::error::` annotations — no silent failures
3. Pin GitHub Actions to major versions, not SHA
4. Put recovery documentation inline as YAML comments, not in separate files
5. Quote all shell variables in workflow steps
6. Create changeset files via `pnpm changeset`, not manually

**Pattern Verification:**
- PR review checks YAML style compliance
- Integration test job validates assertion patterns work (if assertions themselves fail, the test fails visibly)
- `pnpm changeset status` in CI verifies changeset files are well-formed

### Anti-Patterns to Avoid

| Anti-Pattern | Why | Do Instead |
|-------------|-----|-----------|
| `set -e` in multi-line workflow steps | Silent failure, no context | Explicit checks with `::error::` |
| Pinning actions to SHA | Maintenance burden at solo scale | Pin to major version |
| Recovery docs in a separate file | Won't be found when step fails at 2am | Inline YAML comments above the step |
| Hand-writing `.changeset/*.md` | Easy to get format wrong | `pnpm changeset` interactive |
| Combining pack + install + assert in one step | Can't tell which part failed from logs | One action per step |

## Project Structure & Boundaries

### Scope

This project doesn't create a new application directory structure. It adds configuration files and workflow jobs to the existing monorepo. The "structure" is the set of files created, modified, or depended upon.

### Files Created by This Project

```
bmad-orchestrator/                          # Existing repo root
├── .changeset/
│   ├── config.json                         # NEW — changesets configuration
│   └── README.md                           # NEW — auto-generated by `changeset init`,
│                                           #        extended with project-specific notes
├── .github/
│   └── workflows/
│       ├── ci.yml                          # MODIFIED — add integration-test job,
│       │                                   #            add pack-tarball step to check job
│       ├── publish.yml                     # NEW — changesets publish workflow
│       └── token-health.yml                # NEW — weekly npm whoami check
├── packages/
│   ├── agent-env/
│   │   └── package.json                    # VERIFIED — already publish-ready (no changes)
│   └── shared/
│       └── package.json                    # VERIFIED — "private": true (no changes)
├── package.json                            # VERIFIED — workspace root, private (no changes)
└── README.md                               # MODIFIED — add publish status badge
```

### Files Modified: ci.yml Changes

The existing `ci.yml` has a single `check` job. This project adds:

1. **Pack tarball step** at end of `check` job (after build):
   - `cd packages/agent-env && npm pack`
   - Upload `.tgz` as GitHub Actions artifact

2. **New `integration-test` job:**
   - `needs: [check]`
   - Downloads tarball artifact only (no checkout)
   - Runs 4 MVP assertions

**Current ci.yml structure → Target structure:**

```
Current:                          Target:
jobs:                             jobs:
  check:                            check:
    - Checkout                        - Checkout
    - Setup Node                      - Setup Node
    - Setup pnpm                      - Setup pnpm
    - Install                         - Install
    - Build                           - Build
    - Type check                      - Type check
    - Lint                            - Lint
    - Test                            - Test
                                      - Pack agent-env tarball      ← NEW
                                      - Upload tarball artifact     ← NEW

                                    integration-test:               ← NEW JOB
                                      needs: [check]
                                      - Download tarball artifact
                                      - Install tarball globally
                                      - Assert --version works
                                      - Assert --help works
                                      - Assert list --json works
```

### Files Created: publish.yml

```yaml
# Structure (not implementation):
name: Publish
on:
  push:
    branches: [main]

concurrency:
  group: publish
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node 22
      - Setup pnpm
      - Install dependencies
      - Build all packages
      - Run changesets/action@v1 (creates Version PR or publishes)
```

### Files Created: token-health.yml

```yaml
# Structure (not implementation):
name: Token Health Check
on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly Monday 9am UTC

jobs:
  check-token:
    runs-on: ubuntu-latest
    steps:
      - Verify npm token is valid (npm whoami)
```

### Files Created: .changeset/config.json

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "ZookAnalytics/bmad-orchestrator" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### FR to Structure Mapping

| FR Category | Files |
|-------------|-------|
| FR0: Core Value | `publish.yml` (the entire pipeline) |
| FR1-5: Version Management | `.changeset/config.json`, manual changeset files |
| FR6-12: Package Publishing | `publish.yml` (changesets/action configuration) |
| FR13-15: Build Pipeline | `ci.yml` check job (existing build), `publish.yml` build step |
| FR16-20: Quality Validation | `ci.yml` integration-test job |
| FR21-24: Package Configuration | `packages/agent-env/package.json` (already done), `packages/shared/package.json` (already done) |
| FR25-28: Visibility & Recovery | `README.md` badge, YAML comments in `publish.yml` |
| FR29-30: Auth & Security | `publish.yml` permissions block, `NPM_TOKEN` secret |
| FR34: Token Health | `token-health.yml` |

### Architectural Boundaries

**Workflow boundary:** `ci.yml` owns PR validation (including integration test). `publish.yml` owns post-merge publishing. They don't duplicate each other's work — publish trusts CI already validated.

**Artifact boundary:** The build job produces a tarball artifact. The integration test job consumes it. The publish workflow rebuilds independently (it needs the full monorepo context for `changeset publish`).

**Configuration boundary:** `.changeset/config.json` controls versioning behavior. Per-package `package.json` controls what gets published. `publish.yml` orchestrates the flow. Changes to any one shouldn't require changes to the others (loose coupling).

**Secret boundary:** `NPM_TOKEN` is only referenced in `publish.yml` and `token-health.yml`. CI doesn't need it. Integration test doesn't need it (tests against packed tarball, not npm registry).

## Architecture Validation Results

### Coherence Validation

All architectural decisions were validated for internal consistency:

- **Publish workflow pattern ↔ Recovery procedures:** The "Version Packages" PR pattern means version bumps happen on a branch, not on main. Recovery (re-run workflow) creates a fresh PR if the previous attempt failed — no manual git state fixup. Consistent.
- **Integration test isolation ↔ Artifact flow:** Build job packs tarball and uploads. Integration test job downloads tarball into empty runner (no checkout). The artifact is the only bridge. Consistent.
- **Changesets idempotency ↔ Re-run strategy:** `changeset publish` checks npm for existing versions before publishing. `changeset version` checks if versions are already bumped. Re-running the workflow is safe in all states. Consistent.
- **Manual changeset MVP ↔ Plugin deferral:** Architecture explicitly orders manual-first, plugin-later. No decision depends on the plugin existing. Consistent.
- **Token health check ↔ Silent failure mitigation:** Weekly `npm whoami` catches the specific failure mode (expired token + no publishable merges = invisible until next merge). Consistent with the failure mode landscape.

No circular dependencies or contradictions found.

### Requirements Coverage

**Functional Requirements: 30/35 covered (86%)**

| FR Range | Category | Count | Coverage | Notes |
|----------|----------|-------|----------|-------|
| FR0 | Core Value | 1 | ✅ | publish.yml — the entire pipeline |
| FR1-5 | Version Management | 5 | ✅ | .changeset/config.json + manual changeset workflow |
| FR6-12 | Package Publishing | 7 | ✅ | publish.yml + changesets/action idempotency |
| FR13-15 | Build Pipeline | 3 | ✅ | ci.yml check job (existing build) + publish.yml build step |
| FR16-17, FR19 | Quality Validation (MVP) | 3 | ✅ | ci.yml integration-test job, 4 assertions |
| FR18, FR20 | Quality Validation (Build-up) | 2 | ⏳ | Deferred — tarball file assertions, no-rebuild validation |
| FR21-24 | Package Configuration | 4 | ✅ | package.json fields verified, no changes needed |
| FR25-28 | Visibility & Recovery | 4 | ✅ | README badge, inline YAML docs, npm deprecate documented |
| FR29-30 | Auth & Security | 2 | ✅ | Explicit permissions, granular NPM_TOKEN |
| FR31-33 | Conditional (Deferred) | 3 | ⏳ | Scope validation, changeset bot, config drift — deferred by design |
| FR34 | Token Health | 1 | ✅ | token-health.yml weekly scheduled check |

**5 FRs explicitly deferred:** FR18 (tarball file assertions), FR20 (no-rebuild validation), FR31 (scope validation), FR32 (changeset bot), FR33 (config drift detection). All are build-up or conditional per PRD — none are MVP-blocking.

**Non-Functional Requirements: 15/15 covered (100%)**

| NFR Range | Category | Coverage Mechanism |
|-----------|----------|-------------------|
| NFR1-5 | Security | Explicit permissions block, granular token, `"private": true` enforcement, no custom log steps that could leak |
| NFR6 | Registry tolerance | Re-run is the recovery strategy (changesets idempotency) |
| NFR7 | pnpm compatibility | Changesets has first-class pnpm support |
| NFR8 | Husky coexistence | Verified — no commitlint, no conflict |
| NFR9 | No CI duplication | Integration test in ci.yml, publish in separate workflow |
| NFR10 | GitHub releases via API | @changesets/changelog-github handles this |
| NFR11-12 | Safe re-run | Changesets checks npm before publishing, checks versions before bumping |
| NFR13 | Silence on non-package merges | Changesets exits cleanly when no pending changesets |
| NFR14 | Graceful degradation | Manual changeset fallback documented; changelog plugin fallback documented |
| NFR15 | Badge accuracy | Badge tracks publish workflow status |

### Implementation Readiness

**Prerequisites checklist:**
- [x] Package.json publish fields verified (agent-env: bin, files, exports, type)
- [x] `shared` confirmed private
- [x] Existing CI structure understood (single `check` job)
- [x] No conflicting tooling (no commitlint, no existing changesets)
- [x] GitHub Actions workflow patterns established

**Architecture Completeness Checklist:**
- [x] All critical decisions documented with rationale
- [x] Failure modes analyzed and mitigated
- [x] Cross-cutting concerns identified and addressed
- [x] File inventory complete (what's created, modified, verified)
- [x] FR-to-file mapping covers all in-scope requirements
- [x] Architectural boundaries defined (workflow, artifact, config, secret)
- [x] Implementation patterns and anti-patterns documented
- [x] Recovery procedures specified for all failure tiers

### Readiness Assessment

**Confidence Level: HIGH**

The architecture is ready for epic/story creation and implementation. All MVP decisions are made. The deferred items (FR18, FR20, FR31-33) are explicitly out of MVP scope per PRD and can be added incrementally without architectural changes.

### Implementation Priority (Handoff)

Recommended implementation order based on dependency analysis:

1. **npm org setup** — Create `@zookanalytics` org, generate granular token, add as GitHub secret. Everything else depends on this.
2. **Manual dry-run publish** — `npm pack` + inspect tarball + `pnpm publish --dry-run` from local. De-risks auth, org, and package config before any CI automation.
3. **Install changesets** — `pnpm add -Dw @changesets/cli @changesets/changelog-github && pnpm changeset init`. Configure `.changeset/config.json`.
4. **First real publish** — Manual `pnpm changeset` → `pnpm changeset version` → `pnpm changeset publish` from local. Proves the full changesets flow works.
5. **ci.yml: pack tarball step** — Add `npm pack` + artifact upload to existing `check` job.
6. **ci.yml: integration-test job** — New job with 4 MVP assertions. Validate on a PR before merging.
7. **publish.yml** — Create the workflow with changesets/action@v1. First automated publish.
8. **token-health.yml** — Weekly `npm whoami` scheduled check.
9. **README badge** — `[![Publish](https://github.com/ZookAnalytics/bmad-orchestrator/actions/workflows/publish.yml/badge.svg)](https://github.com/ZookAnalytics/bmad-orchestrator/actions/workflows/publish.yml)`
10. **Branch protection** — Enable required CI checks and block force pushes on main.
