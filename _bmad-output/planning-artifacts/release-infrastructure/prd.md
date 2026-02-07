---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete, step-e-01-discovery, step-e-02-review, step-e-03-edit]
workflowComplete: true
completedAt: '2026-02-01'
lastEdited: '2026-02-06'
editHistory:
  - date: '2026-02-06'
    changes: 'Updated all NPM_TOKEN references to Trusted Publishing (OIDC) per implementation readiness report. Updated FR29, FR34, NFR1, NFR4, Journey 2, Configuration Surface, and hardening bullets to reflect no stored secrets.'
  - date: '2026-02-03'
    changes: 'Updated FR1 to manual changeset workflow, elevated FR32 (changeset bot) to core, and aligned Executive Summary and User Journeys with the developer-driven changeset model.'
  - date: '2026-02-04'
    changes: 'Consistency fixes: FR30/NFR2 updated to include pull-requests:write (required by Architecture Version Packages PR pattern). FR32 moved back to Conditional to align with Architecture deferral of FR31-33.'
inputDocuments:
  - '_bmad-output/planning-artifacts/release-infrastructure/product-brief.md'
  - '_bmad-output/project-context.md'
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 1
classification:
  projectType: developer_tool
  domain: general
  complexity: low
  projectContext: greenfield
---

# Product Requirements Document - Monorepo Release Infrastructure

**Author:** Node
**Date:** 2026-02-01

## Executive Summary

The `@zookanalytics` pnpm monorepo produces multiple packages (CLIs, BMAD modules, workflow tooling) but has zero infrastructure to version or distribute them. Consumers resort to fragile git clones and postinstall file-copying scripts. A broken install triggered this effort, but the reasoning is broader: the current approach doesn't scale and is invisible when it fails.

This PRD defines a changesets-based versioning and publishing workflow. Developers create changeset files during development (guided by conventional commits already enforced in the repo) to specify the intent and impact of changes. Merging to main triggers automated version bumps and npm publication for affected packages based on these changesets. The pilot package is `@zookanalytics/agent-env`, with infrastructure designed so onboarding additional packages is configuration, not an infrastructure project.

**Core promise:** Clear intent, automated execution. `npm install -g @zookanalytics/agent-env@latest` returns the new version reliably.

**Design philosophy:** Simple, reliable, standards-based. Developer-driven intent with automated delivery. Just works.

## Success Criteria

### User Success

- **Maintainer:** Merge a PR and move on. No post-merge steps, no mental overhead. Publishing is invisible when it works.
- **Consumer:** `npm install -g @zookanalytics/agent-env` works reliably. No debugging post-install. Semver pinning available for reproducible devcontainer builds.
- **"Worth it" moment:** A package change lands on main and is available on npm without thinking about it. No more broken installs from git-clone hacks.

### Business Success

N/A — internal infrastructure. Success is measured by the absence of problems: no fragile devcontainer builds, no friction onboarding new publishable packages.

### Measurable Outcomes

| Gate | Measured By |
|------|-------------|
| **It works** | `npm install -g @zookanalytics/agent-env` installs a working CLI from public npm |
| **It's automatic** | Changeset included in PR → merge to main → new version on npm → zero post-merge manual steps |
| **It scales** | Second package onboarded with config-only changes |
| **It catches problems** | Integration test (pack → install → run real commands) catches broken packages in CI before publish |
| **It's visible** | Publish status badge on README reflects current pipeline health |

## Product Scope

### MVP - Minimum Viable Product

**MVP Approach:** Problem-solving MVP — prove the pipeline works end-to-end with one package, then scale. Infrastructure MVP = "it works reliably for the pilot case." No partial credit.

**Resource Requirements:** Solo maintainer. Primary skills: GitHub Actions, npm publishing, changesets configuration.

**Core User Journeys Supported:**
- Journey 1 (Normal Development) — full support
- Journey 2 (Something Breaks) — full support via status badge + re-runnable workflow
- Journey 3 (Partial Publish Failure) — full support via re-runnable workflow + inline recovery docs

**Must-Have Capabilities:**
- Changesets + conventional-commit integration with scope-to-package mapping
- GitHub Actions `publish.yml` (post-merge: detect pending bumps → bump → build → publish → GitHub release)
- Per-package publish configuration (agent-env pilot, shared excluded with `"private": true` + changesets exclusion)
- Integration test gate in `ci.yml` (pack → clean install → run CLI — start with basics, build up to full tarball assertions)
- npm org setup + first publish of `@zookanalytics/agent-env`
- Publish status badge on README
- Inline recovery/procedure documentation in workflow files

**Hardening (include if trivial, defer if not):**
- Commit scope validation against known packages
- Changeset bot on PRs
- Changesets config drift detection (non-private packages must be in config)
- ~~Token health monitoring beyond status badge~~ *Not needed — Trusted Publishing (OIDC) has no stored token to expire*

### Post-MVP Features

**Phase 2 (Growth):**
- Onboard `@zookanalytics/orchestrator` and `@zookanalytics/keystone-workflows`
- Validate pipeline flexibility with data-only packages (no build, custom postinstall)
- Full tarball assertion suite (if not completed in MVP)
- `docs/releasing.md` onboarding guide
- Any hardening items deferred from MVP

**Phase 3 (Expansion):**
- Docker image publishing pipeline
- Pre-release channels (alpha/beta/next)
- npm provenance for supply chain integrity
- CHANGELOG.md generation if GitHub releases aren't sufficient

### Risk Mitigation Strategy

**Technical Risks:**
- Most technically uncertain: changesets conventional-commit plugin behavior with monorepo scopes. **Mitigation:** manual dry-run first, manual changeset fallback if plugin is problematic.
- ESM/workspace protocol issues in published packages. **Mitigation:** integration test catches these.

**Resource Risks:** Solo maintainer is both the risk and the simplification. No coordination overhead, but also no backup. **Mitigation:** everything is in CI — if the maintainer is unavailable, the pipeline either works or doesn't. No manual steps to miss.

### Known Accepted Risks

- Unmarked breaking changes — no automated detection, acceptable at solo-maintainer scale
- `npm pack` vs `npm publish` output could theoretically differ — low risk, standard practice
- Deferred hardening items are all "noticed within one merge cycle" problems, not silent failures
- CI tests PR branch against pre-merge main — if two PRs merge in quick succession, the second wasn't tested against the first's changes. Low risk at solo-maintainer scale.

## User Journeys

### Journey 1: Maintainer — Normal Development (Happy Path)

You've finished a feature for agent-env. You write commits with conventional format — `feat(agent-env): add workspace validation`. Before opening a PR, you run `pnpm changeset`, select `agent-env`, pick a minor bump, and provide a summary of the change. You commit the resulting changeset file. PR passes CI (including the integration test that packs and installs the CLI in a clean environment). You merge. Changesets detects the pending changeset, increments the minor version, publishes to npm, and creates a GitHub release. The next devcontainer rebuild picks up the new version via `npm install -g @zookanalytics/agent-env@latest`.

On a different day, you merge a PR that only touches docs or CI config. You don't create a changeset. The publish workflow finds no pending changesets, exits cleanly. No publish, no noise. The status badge reflects the last actual publish outcome — stays green.

**Reveals:** Core pipeline driven by developer intent (changesets), integration test gate, badge tracks publish outcomes, silence on non-package merges.

### Journey 2: Maintainer — Something Breaks

You notice the publish badge on the README is red. Click through to GitHub Actions — publish workflow failed (npm registry outage, or OIDC configuration drift if the package was unlinked from the repo). Re-run the workflow. Badge goes green. The failed version publishes. If OIDC is misconfigured, the error message points to the Trusted Publishing settings on npmjs.com.

**Reveals:** Failure visibility, status badge, clear error logs, re-runnable workflows, OIDC troubleshooting.

### Journey 3: Maintainer — Partial Publish Failure

Changesets bumped the version and committed it, but npm publish failed mid-way (registry outage). The repo has version 0.3.0 in package.json but npm still has 0.2.0. You follow the documented recovery procedure — re-run the workflow or manually `pnpm publish`. Version lands on npm.

**Reveals:** Recovery path, idempotent workflow design, state visibility.

### Journey 4: Maintainer — Onboarding a New Package

Keystone-workflows is ready to publish. Add it to the changesets config, set `"private": false`, verify `files` and `bin` fields. Push a commit — same pipeline picks it up. No workflow changes needed.

**Reveals:** Scalability, per-package config, pipeline flexibility.

### Journey 5: Maintainer — Cross-Package Change (Manual Changeset)

You fix a bug in `shared/errors.ts` — commit is `fix(shared): normalize error codes`. Shared is private, no publish. But agent-env consumes shared and its behavior changes. Changesets won't auto-generate a bump for agent-env (wrong scope). You create a manual changeset: `pnpm changeset` → select agent-env → patch bump → describe the change. On merge, agent-env gets the patch bump and publishes.

**Reveals:** Manual changeset escape hatch, scope-to-package mapping limitations, documentation needs.

### Journey 6: Maintainer — Rollback / Hotfix

You publish 0.3.0. A devcontainer build reports a runtime regression the integration test didn't catch. Options: (a) publish 0.3.1 with the fix — preferred, fix-forward; (b) `npm deprecate @zookanalytics/agent-env@0.3.0` — consumers on `@latest` get 0.2.0 until 0.3.1 ships. Never `npm unpublish` — breaks lockfiles.

**Reveals:** Fix-forward strategy, `npm deprecate` as fallback, hotfix procedure.

### Journey Requirements Summary

| Journey | Key Capabilities Revealed |
|---------|--------------------------|
| **Normal development** | Core pipeline, integration test gate, badge tracks publish outcomes, silence on non-package merges |
| **Something breaks** | Status badge, clear logs, re-runnable workflows, OIDC troubleshooting |
| **Partial publish failure** | Recovery procedure, idempotent workflow, state visibility |
| **Onboarding new package** | Per-package config, pipeline flexibility, per-package integration tests |
| **Cross-package change** | Manual changeset escape hatch, documentation of when to use it |
| **Rollback / hotfix** | Fix-forward strategy, `npm deprecate` as fallback, documented hotfix procedure |

## Technical Architecture

### Build Pipeline

- pnpm monorepo with per-package build steps
- agent-env: TypeScript → build → dist → publish
- Future data packages: no build step, publish source directly
- Changesets handles workspace protocol rewriting and publish ordering

### CI Integration

GitHub Actions — two separate workflows with explicit permissions:

**`ci.yml` (existing):** PR checks including integration test.

**`publish.yml` (new):** Post-merge publish with `contents: write` (GitHub releases) and `id-token: write` (future-proofs npm provenance). Set permissions explicitly.

**Integration test design:** Separate job that `needs: [build]`, downloads the build artifact, packs the tarball, installs in a **clean environment with no monorepo `node_modules` available** (no checkout, just the tarball). Catches undeclared dependencies that resolve from the workspace but fail on npm.

**Integration test assertions:**
- Packed tarball contains expected files and no unexpected files (test fixtures, source maps, `.env`, dev config)
- CLI is executable (shebang present, `#!/usr/bin/env node`)
- CLI runs real commands successfully, not just `--version`
- Tarball file list is codified — catches drift as new files are added

**Publish workflow behavior:**
- Integration test runs on PRs only — publish trusts CI already validated
- Queue concurrency — never cancel a running publish
- Safely re-runnable after any mid-sequence failure — checks if version bump already committed, checks if version already on npm. Re-run is the recovery strategy; no built-in retry logic needed at MVP.
- GitHub releases use changesets-generated release notes
- Trusted Publishing (OIDC) eliminates stored secrets; workflow must still not leak internal paths or credentials in custom steps

**Compatibility:**
- Changesets must coexist with existing commitlint/husky hooks without conflict — both operate on commits but at different stages (pre-commit validation vs post-merge version bumping)

### Configuration Surface

- `.changeset/config.json` — changesets configuration, scope-to-package mapping
- Per-package `package.json` — `files`, `bin` (must point to built output), `exports`, `private` fields
- Trusted Publishing (OIDC) — npm authentication tied to the specific GitHub repository and workflow. No stored secrets. Configuration managed on npmjs.com package settings.
- `publish.yml` workflow file

### Conventional-Commit Plugin

While conventional commits are enforced and inform the developer's choice of bump level, the primary workflow is the manual creation of changesets via `pnpm changeset`. This ensures explicit intent and human-readable changelogs. A conventional-commit plugin may be used to provide suggestions or pre-fill information, but it is not the primary automation driver.

### Documentation

Minimal, practical, located where you'll look:
- **README badge** — publish status visibility
- **Comments in workflow files and changeset config** — inline docs for pipeline behavior, recovery steps, manual changeset usage

### Implementation Considerations

- Manual dry-run publish before automating (de-risk auth, org, package names, `files` field)
- Dry-run must include tarball inspection: `npm pack`, extract, visually verify contents. Codify expectations in the integration test.
- Start with agent-env as pilot — prove pipeline end-to-end before onboarding more packages
- GitHub Actions queue concurrency for successive merges
- Workflow must be re-runnable (idempotent or safely resumable) for failure recovery

## Functional Requirements

### Core Value

- FR0: The maintainer can merge a PR and have affected packages published to npm without additional steps

### Version Management

- FR1: The developer can specify version bump level (patch/minor/major) per package when creating a changeset, guided by conventional commit history
- FR2: The system can map conventional commit scopes to specific publishable packages
- FR3: The maintainer can create manual changeset files to override or supplement automatic version detection
- FR4: The system can coordinate version bumps across multiple packages when needed
- FR5: The system can rewrite workspace protocol references (`workspace:*`) to real version numbers during publish

### Package Publishing

- FR6: The system can publish affected packages to the npm public registry automatically on merge to main
- FR7: The system can skip publishing when no pending version bumps exist
- FR8: The system can create GitHub releases with changesets-generated release notes for each published version
- FR9: The system can publish packages scoped to the `@zookanalytics` npm organization
- FR10: The maintainer can re-run a failed publish workflow without side effects (idempotent/safely resumable)
- FR11: The system can detect if a version bump is already committed before re-bumping
- FR12: The system can detect if a version is already published to npm before re-publishing

### Build Pipeline

- FR13: The system can build TypeScript CLI packages (compile → dist output) before publishing
- FR14: The system can publish data-only packages without a build step
- FR15: The system can queue concurrent publish workflows (never cancel a running publish)

### Package Quality Validation

**MVP-essential:**
- FR16: The system can pack a package tarball and install it in a clean environment with no monorepo dependencies available
- FR17: The system can verify a packed CLI is executable (shebang present, runs successfully)
- FR19: The system can run real CLI commands against the installed package to validate functionality

**Build-up (add incrementally after MVP baseline works):**
- FR18: The system can verify the packed tarball contains only expected files (no test fixtures, source maps, dev config)
- FR20: The system can validate package quality using build output without rebuilding

### Package Configuration

- FR21: The maintainer can configure a package as publishable through per-package configuration only
- FR22: The maintainer can exclude packages from publishing (`"private": true` + changesets exclusion)
- FR23: The system can validate that `bin` entries point to built output, not TypeScript source
- FR24: The system can validate the `files` field includes the correct set of distributable files

### Pipeline Visibility & Recovery

- FR25: The maintainer can see current publish pipeline health at a glance
- FR26: The system can notify the maintainer of publish failures via GitHub Actions notifications
- FR27: The maintainer can deprecate a published package version as a rollback mechanism
- FR28: The maintainer can follow inline documentation in workflow files for recovery procedures

### Authentication & Security

- FR29: The system can authenticate to npm using Trusted Publishing (OIDC) scoped to the specific repository and workflow — no stored secrets
- FR30: The publish workflow can operate with explicit, minimal permissions (`contents: write`, `pull-requests: write`, `id-token: write`)

### Conditional Capabilities (include if trivial to implement)

- FR31: The system can validate conventional commit scopes against the set of known package names and reject unrecognized scopes
- FR32: The system can comment on PRs with a summary of pending version changes (changeset bot) to ensure coverage
- FR33: The system can detect when a non-private package is missing from the changesets configuration
- ~~FR34: The system can monitor NPM_TOKEN health beyond the publish status badge~~ *Superseded — Trusted Publishing (OIDC) eliminates stored tokens; no token to monitor*

## Non-Functional Requirements

### Security

- NFR1: npm authentication must use Trusted Publishing (OIDC) — no stored secrets; workflow logs must not leak sensitive information
- NFR2: Publish workflow permissions must be explicitly scoped (`contents: write`, `pull-requests: write`, `id-token: write`) — no default broad permissions
- NFR3: Packages marked `"private": true` must never be publishable, regardless of changesets configuration
- NFR4: npm authentication must be scoped to the specific repository and workflow via Trusted Publishing (OIDC) configuration
- NFR5: Workflow logs must not leak sensitive information (tokens, internal paths, credentials)

### Integration

- NFR6: The publish workflow must tolerate transient npm registry failures (retry logic or safe re-run)
- NFR7: The system must work with the existing pnpm monorepo structure without requiring migration to a different package manager
- NFR8: Changesets integration must preserve existing conventional commit enforcement (commitlint/husky) — no conflicts
- NFR9: The publish workflow must not interfere with or duplicate existing CI checks in `ci.yml`
- NFR10: GitHub releases must be created using GitHub's API via changesets — no custom release scripting

### Reliability

- NFR11: A failed publish workflow must be safely re-runnable without producing duplicate versions or corrupted state
- NFR12: The publish workflow must handle the "version bumped but not published" state without manual intervention beyond re-running
- NFR13: Non-package merges (docs, CI config) must not trigger publish attempts or produce misleading workflow results
- NFR14: The pipeline must degrade gracefully if the changesets conventional-commit plugin fails — manual changeset creation remains viable
- NFR15: The status badge must accurately reflect publish health — a green badge must mean the last publish succeeded
