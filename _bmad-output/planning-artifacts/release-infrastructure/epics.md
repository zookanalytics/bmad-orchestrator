---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/release-infrastructure/prd.md
  - _bmad-output/planning-artifacts/release-infrastructure/architecture.md
lastEdited: '2026-02-04'
editHistory:
  - date: '2026-02-04'
    changes: 'Added missing ACs per implementation-readiness-report-2026-02-03: MI-1 (Story 2.2 private package exclusion in changesets config), MI-2 (Story 3.1 concurrency + permissions), MI-3 (Story 3.1 idempotent re-run verification for FR10-12)'
  - date: '2026-02-04'
    changes: 'Consistency validation: Fixed FR1 wording to match PRD manual changeset model, added --help assertion to Story 1.4, fixed FR30 coverage map (Epic 1→3), added Story 2.4 for first manual publish, noted FR32 as deferred per Architecture'
---

# Monorepo Release Infrastructure - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Monorepo Release Infrastructure, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR0: The maintainer can merge a PR and have affected packages published to npm without additional steps
FR1: The developer can specify version bump level (patch/minor/major) per package when creating a changeset, guided by conventional commit history
FR2: The system can map conventional commit scopes to specific publishable packages
FR3: The maintainer can create manual changeset files to override or supplement automatic version detection
FR4: The system can coordinate version bumps across multiple packages when needed
FR5: The system can rewrite workspace protocol references (workspace:*) to real version numbers during publish
FR6: The system can publish affected packages to the npm public registry automatically on merge to main
FR7: The system can skip publishing when no pending version bumps exist
FR8: The system can create GitHub releases with changesets-generated release notes for each published version
FR9: The system can publish packages scoped to the @zookanalytics npm organization
FR10: The maintainer can re-run a failed publish workflow without side effects (idempotent/safely resumable)
FR11: The system can detect if a version bump is already committed before re-bumping
FR12: The system can detect if a version is already published to npm before re-publishing
FR13: The system can build TypeScript CLI packages (compile → dist output) before publishing
FR14: The system can publish data-only packages without a build step
FR15: The system can queue concurrent publish workflows (never cancel a running publish)
FR16: The system can pack a package tarball and install it in a clean environment with no monorepo dependencies available
FR17: The system can verify a packed CLI is executable (shebang present, runs successfully)
FR18: The system can verify the packed tarball contains only expected files (no test fixtures, source maps, dev config)
FR19: The system can run real CLI commands against the installed package to validate functionality
FR20: The system can validate package quality using build output without rebuilding
FR21: The maintainer can configure a package as publishable through per-package configuration only
FR22: The maintainer can exclude packages from publishing ("private": true + changesets exclusion)
FR23: The system can validate that bin entries point to built output, not TypeScript source
FR24: The system can validate the files field includes the correct set of distributable files
FR25: The maintainer can see current publish pipeline health at a glance
FR26: The system can notify the maintainer of publish failures via GitHub Actions notifications
FR27: The maintainer can deprecate a published package version as a rollback mechanism
FR28: The maintainer can follow inline documentation in workflow files for recovery procedures
FR29: The system can authenticate to npm using a granular token scoped to @zookanalytics/*
FR30: The publish workflow can operate with explicit, minimal permissions (contents: write, id-token: write)
FR31: The system can validate conventional commit scopes against the set of known package names and reject unrecognized scopes
FR32: The system can comment on PRs with a summary of pending version changes (changeset bot)
FR33: The system can detect when a non-private package is missing from the changesets configuration
FR34: The system can monitor NPM_TOKEN health beyond the publish status badge

### NonFunctional Requirements

NFR1: NPM_TOKEN must be stored as a GitHub Actions secret, never exposed in logs or workflow outputs
NFR2: Publish workflow permissions must be explicitly scoped (contents: write, pull-requests: write, id-token: write) — no default broad permissions
NFR3: Packages marked "private": true must never be publishable, regardless of changesets configuration
NFR4: NPM token must be granular (fine-grained), scoped to @zookanalytics/* packages only, with automation-level permissions
NFR5: Workflow logs must not leak sensitive information (tokens, internal paths, credentials)
NFR6: The publish workflow must tolerate transient npm registry failures (retry logic or safe re-run)
NFR7: The system must work with the existing pnpm monorepo structure without requiring migration to a different package manager
NFR8: Changesets integration must preserve existing conventional commit enforcement (commitlint/husky) — no conflicts
NFR9: The publish workflow must not interfere with or duplicate existing CI checks in ci.yml
NFR10: GitHub releases must be created using GitHub's API via changesets — no custom release scripting
NFR11: A failed publish workflow must be safely re-runnable without producing duplicate versions or corrupted state
NFR12: The publish workflow must handle the "version bumped but not published" state without manual intervention beyond re-running
NFR13: Non-package merges (docs, CI config) must not trigger publish attempts or produce misleading workflow results
NFR14: The pipeline must degrade gracefully if the changesets conventional-commit plugin fails — manual changeset creation remains viable
NFR15: The status badge must accurately reflect publish health — a green badge must mean the last publish succeeded

### Additional Requirements

- **Starter Template**: No application template applies; the "starter" is the @changesets/cli and changesets/action@v1.
- **Infrastructure**: Fresh GitHub Actions job for integration testing with no checkout (artifact-only) for clean isolation.
- **Automation Pattern**: "Version Packages" PR pattern via changesets/action@v1 to protect main from partial-state corruption.
- **Monitoring**: Weekly scheduled GitHub Actions workflow running `npm whoami` to monitor NPM_TOKEN health.
- **Recovery**: Idempotent re-run design where `changeset publish` checks npm before publishing. Inline recovery docs in YAML comments.
- **Pilot Package**: `agent-env` is the pilot package; `shared` remains private.
- **Security**: Granular NPM_TOKEN scoped to @zookanalytics/* with automation permissions.

### FR Coverage Map

- **FR0**: Epic 3 - Merge-to-publish automation
- **FR1**: Epic 2 - Manual changeset version specification
- **FR2**: Epic 2 - Scope-to-package mapping
- **FR3**: Epic 2 - Manual changeset override
- **FR4**: Epic 2 - Multi-package coordination
- **FR5**: Epic 2 - Workspace protocol rewriting
- **FR6**: Epic 3 - Automated npm publish
- **FR7**: Epic 3 - Skip publish when no bumps
- **FR8**: Epic 3 - GitHub releases with changelogs
- **FR9**: Epic 3 - @zookanalytics org publishing
- **FR10**: Epic 4 - Idempotent re-run support
- **FR11**: Epic 2 - Pre-bump detection
- **FR12**: Epic 4 - Pre-publish detection
- **FR13**: Epic 1 - TypeScript build before publish
- **FR14**: Epic 1 - Data-only package publishing
- **FR15**: Epic 4 - Queue concurrency
- **FR16**: Epic 1 - Clean install validation (pack/install)
- **FR17**: Epic 1 - Executable CLI verification
- **FR18**: Epic 1 - Tarball file list verification
- **FR19**: Epic 1 - Real command validation
- **FR20**: Epic 1 - Build output validation
- **FR21**: Epic 1 - Per-package opt-in config
- **FR22**: Epic 1 - Private package exclusion
- **FR23**: Epic 1 - Bin entry validation
- **FR24**: Epic 1 - Files field validation
- **FR25**: Epic 3 - Pipeline health visibility (badge)
- **FR26**: Epic 4 - Failure notifications
- **FR27**: Epic 4 - npm deprecate rollback
- **FR28**: Epic 4 - Inline recovery docs
- **FR29**: Epic 3 - Granular token authentication
- **FR30**: Epic 3 - Explicit workflow permissions
- **FR31**: Deferred - Scope validation (per Architecture cross-cutting #8)
- **FR32**: Deferred - Changeset bot comments (per Architecture cross-cutting #8; PRD elevated to core but no architectural design exists yet)
- **FR33**: Deferred - Config drift detection (per Architecture cross-cutting #8)
- **FR34**: Epic 4 - Token health monitoring

## Epic 1: Verified Artifact Pipeline & Configuration

Ensure packages are technically ready for distribution with validated configuration, reproducible build artifacts, and a clean-room integration test harness. **Pilot target: `agent-env`. Includes manual dry-run verification.**

### Story 1.1: Configure agent-env for npm Publication

As a maintainer,
I want to verify and finalize the package configuration for agent-env,
So that it includes all necessary files and excludes internal or private packages.

**Acceptance Criteria:**

**Given** the `packages/agent-env/package.json` file
**When** I inspect the `files`, `bin`, and `exports` fields
**Then** they must point to the built `dist/` directory and include the CLI entry point
**And** the `files` array must include `README.md` and `LICENSE`
**And** the `packages/shared/package.json` must be marked `"private": true`
**And** `agent-env` dependencies must NOT include private workspace packages (like `shared`) unless they are bundled into the distribution
**And** `pnpm changeset status` (if initialized) must not report any configuration drift

### Story 1.2: Perform Manual Dry-Run Verification

As a maintainer,
I want to manually verify the npm authentication and package bundling,
So that I can identify configuration issues before automating the publish process.

**Acceptance Criteria:**

**Given** a granular NPM_TOKEN with automation permissions for `@zookanalytics/*`
**When** I run `pnpm build --filter @zookanalytics/agent-env` and `pnpm pack` in `packages/agent-env`
**Then** I can inspect the resulting tarball to ensure it contains only expected files
**And** `pnpm publish --dry-run` must succeed without authentication or scope errors

### Story 1.3: Implement agent-env Artifact Packing in CI

As a developer,
I want the existing CI workflow to generate and store a package tarball,
So that it can be used for integration testing without access to the full source tree.

**Acceptance Criteria:**

**Given** the existing `.github/workflows/ci.yml` file
**When** the `check` job completes the `build` step
**Then** it must run `pnpm pack` for the `agent-env` package
**And** ensure internal workspace dependencies (like `shared`) are either bundled into the output or are not present in the runtime `dependencies` list
**And** it must upload the resulting `.tgz` file as a GitHub Actions artifact named `agent-env-tarball`

### Story 1.4: Create Clean-Room Integration Test Harness

As a developer,
I want a new CI job that installs the packaged CLI in an empty environment,
So that I can verify it works for end-users without implicit dependencies on the build environment.

**Acceptance Criteria:**

**Given** the `agent-env-tarball` artifact from the build job
**When** a new `integration-test` job runs in `ci.yml` (depending on `check`)
**Then** it must **NOT** checkout the repository code
**And** it must download and install the tarball globally (`npm install -g ./agent-env-*.tgz`)
**And** it must verify `agent-env --version` returns the expected version
**And** it must verify `agent-env --help` exits successfully (validates commander setup)
**And** it must verify `agent-env list --json` returns valid JSON structure

## Epic 2: Automated Versioning & Release Staging

Automate the mapping of changes to version numbers and provide a visible, low-friction mechanism to stage releases via Changesets. **Pilot target: `agent-env`.**

### Story 2.1: Initialize Changesets in the Monorepo

As a maintainer,
I want to install and initialize the Changesets tool,
So that I can start tracking version bumps and changelogs systematically.

**Acceptance Criteria:**

**Given** the monorepo root directory
**When** I install `@changesets/cli` and `@changesets/changelog-github` as workspace-root devDependencies
**Then** I must add a `"changeset": "changeset"` script to the root `package.json`
**And** running `pnpm changeset init` must create a `.changeset/` directory with a default `config.json`
**And** the `.changeset/README.md` must be present with standard instructions

### Story 2.2: Configure Changeset Scope Mapping

As a maintainer,
I want to configure Changesets to correctly identify publishable packages and rewrite workspace references,
So that published artifacts have valid cross-package dependencies.

**Acceptance Criteria:**

**Given** the `.changeset/config.json` file
**When** I configure the `changelog` property to use `@changesets/changelog-github`
**Then** the `access` must be set to `public`
**And** the `baseBranch` must be set to `main`
**And** `updateInternalDependencies` must be set to `patch` to ensure `workspace:*` references are rewritten correctly during publication
**And** the `ignore` array must include `shared` (or changesets must be verified to respect `"private": true` without explicit ignore — the chosen mechanism must be documented in a config comment)

### Story 2.3: Create Manual Changeset Workflow

As a developer,
I want a simple command to document my changes for release,
So that I can ensure my features are versioned and included in the changelog correctly.

**Acceptance Criteria:**

**Given** a local development branch with changes in `packages/agent-env`
**When** I run `pnpm changeset`
**Then** I must be able to select `agent-env` and choose a bump type (patch/minor/major)
**And** it must generate a new `.changeset/*.md` file with my provided description
**And** this file must be committed and included in the PR to trigger the versioning pipeline

### Story 2.4: Perform First Manual Publish via Changesets

As a maintainer,
I want to perform a full local changeset → version → publish cycle for agent-env,
So that I can prove the changesets flow works end-to-end before automating it in CI.

**Acceptance Criteria:**

**Given** changesets is initialized and configured (Stories 2.1-2.2)
**When** I run `pnpm changeset` and select `agent-env` with a patch bump
**Then** running `pnpm changeset version` must bump the version in `packages/agent-env/package.json` and generate a CHANGELOG entry
**And** running `pnpm changeset publish` must successfully publish `@zookanalytics/agent-env` to the npm public registry
**And** `npm info @zookanalytics/agent-env` must show the newly published version
**And** `npm install -g @zookanalytics/agent-env@latest` must install and run successfully

## Epic 3: Automated Publishing & Distribution

Securely and automatically publish validated packages to npm, create public release records, and provide immediate visibility via status badges. **Pilot target: `agent-env`.**

### Story 3.1: Implement Automated Publish Workflow

As a maintainer,
I want the system to automatically manage versioning PRs and npm publication,
So that I can release new versions simply by merging PRs to main.

**Acceptance Criteria:**

**Given** a new file `.github/workflows/publish.yml`
**When** a push to `main` contains a new changeset file
**Then** the `changesets/action` must create or update a "Version Packages" PR
**And** when the "Version Packages" PR is merged to `main`, the action must run `pnpm changeset publish`
**And** it must use the `NPM_TOKEN` secret for authentication
**And** `publish.yml` must include a `concurrency` group with `cancel-in-progress: false` to queue successive publishes without cancellation
**And** `publish.yml` must declare explicit permissions: `contents: write`, `pull-requests: write`, `id-token: write`
**And** re-running the publish workflow after a version bump but failed publish must succeed (changesets detects unpublished version and publishes it)
**And** re-running the publish workflow after a fully successful publish must produce no side effects (changesets detects already-published version and skips it)

### Story 3.2: Configure GitHub Release Automation

As a maintainer,
I want each npm publication to have a corresponding GitHub release,
So that I have a historical record of releases and changelogs within the repository.

**Acceptance Criteria:**

**Given** a successful `pnpm changeset publish` run in CI
**When** the `changesets/action` completes the publication
**Then** it must create a new GitHub release for each published package version
**And** the release notes must be populated from the Changesets-generated changelog entries

### Story 3.3: Add Publish Status and Version Visibility

As a maintainer,
I want to see the pipeline status and the current npm version on the project's landing page,
So that I can verify both the process health and the deployment outcome at a glance.

**Acceptance Criteria:**

**Given** the project's root `README.md`
**When** I add a GitHub Actions status badge for the `publish.yml` workflow
**Then** the badge must correctly reflect the status (Success/Failure) of the last run on the `main` branch
**And** I must add an npm version badge for `@zookanalytics/agent-env`
**And** both badges must be positioned prominently near the top of the README

## Epic 4: Pipeline Resilience & Observability

Ensure the infrastructure is reliable, recoverable after failures, and monitored for long-term health. **Includes token rotation procedures.**

### Story 4.1: Implement Token Health Monitoring

As a maintainer,
I want to be proactively notified if my npm authentication token expires or becomes invalid,
So that I can fix it before it blocks a critical release.

**Acceptance Criteria:**

**Given** a new file `.github/workflows/token-health.yml`
**When** the workflow runs on a weekly schedule (e.g., Monday 9am UTC)
**Then** it must run `npm whoami --registry https://registry.npmjs.org` using the `NPM_TOKEN` secret
**And** it must fail the job if the token is invalid, triggering a GitHub notification to the maintainer

### Story 4.2: Document Recovery and Token Rotation Procedures

As a maintainer,
I want to have clear, inline instructions for handling failures and managing secrets,
So that I can recover the pipeline quickly without searching for external documentation.

**Acceptance Criteria:**

**Given** the `.github/workflows/publish.yml` and `.github/workflows/token-health.yml` files
**When** I examine the YAML content
**Then** I must see descriptive comments explaining how to re-run a failed publish (idempotency)
**And** I must see a documented procedure for rotating the `NPM_TOKEN` (including token type and scope)
**And** I must see instructions for manually deprecating a package version via `npm deprecate` as a fallback rollback mechanism
