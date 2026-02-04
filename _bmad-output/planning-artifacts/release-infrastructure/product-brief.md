---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowComplete: true
completedAt: "2026-02-01"
inputDocuments:
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/orchestrator/product-brief.md'
  - '_bmad-output/planning-artifacts/agent-env/product-brief.md'
date: 2026-02-01
author: Node
---

# Product Brief: Monorepo Release Infrastructure

## Executive Summary

Monorepo Release Infrastructure establishes the foundational npm publishing capability for the `@zookanalytics` pnpm monorepo. Today, the monorepo produces multiple packages — CLIs, BMAD modules, workflow tooling — but has zero infrastructure to version or distribute them. Consumers (primarily devcontainer builds) resort to hacks like shallow git clones and postinstall file-copying scripts to get packages installed.

This effort introduces changesets-based automated versioning and publishing, driven by conventional commits already enforced in the repo. Merging to main triggers version bumps and npm publication for affected packages — no manual steps beyond writing good commit messages. The pilot package is `@zookanalytics/agent-env`, with the infrastructure designed so onboarding additional packages (orchestrator, keystone-workflows, future packages) is minimal configuration.

**Why now:** The monorepo is growing. agent-env needs to be installable in devcontainers. keystone-workflows is incoming. The current approach of git clones and postinstall scripts doesn't scale and is fragile in CI. Proper publishing infrastructure pays for itself immediately and compounds with each new package.

**Success metric:** `npm install -g @zookanalytics/agent-env` works, and adding a new publishable package to the monorepo is a trivial configuration step, not an infrastructure project.

---

## Core Vision

### Problem Statement

The `@zookanalytics` monorepo produces packages that need to be consumed outside the repo — primarily installed into devcontainer images during build. Without npm publishing, installation requires fragile workarounds: shallow git clones, postinstall scripts that copy files to well-known paths, and build steps that assume network access to GitHub. These hacks break in CI, are invisible when they fail silently, and create a barrier to adding new distributable packages.

### Problem Impact

- **Fragile devcontainer builds**: Git-clone-based installation depends on network access, repo visibility, and branch stability. A force-push or private repo change breaks downstream builds with no clear error.
- **Scaling friction**: Each new package that needs distribution requires reinventing the installation hack. keystone-workflows is already waiting.
- **No versioning discipline**: Without published versions, there's no way to pin, roll back, or communicate breaking changes to consumers. Devcontainers get "whatever's on main" with no guarantees.
- **Manual overhead**: Publishing by hand (if attempted) is error-prone and doesn't scale. Forgetting to publish after a merge means consumers run stale code.
- **Invisible publish failures**: Without integration testing, a published package can appear healthy on npm but fail on install — ESM resolution issues, leaked workspace protocol references, or missing bin entries. This is invisible until a consumer hits it.

### Why Existing Solutions Fall Short

| Approach | Gap |
|----------|-----|
| **Git clone in Dockerfile** | Fragile, no versioning, breaks on network/auth changes, slow |
| **Copy files manually** | Doesn't scale, no version tracking, easy to forget |
| **Manual `pnpm publish`** | Error-prone, requires remembering to do it, no CI enforcement |
| **No publishing at all** | Current state — forces every consumer to hack around it |

### Proposed Solution

Integrate **changesets** with **conventional-commit automation** into the existing pnpm monorepo and GitHub Actions CI pipeline:

1. **Conventional commits drive versioning** — `feat:` = minor, `fix:` = patch, `feat!:` / `BREAKING CHANGE` = major. No manual changeset files needed; the commit discipline already in place does the work. Commit scopes (e.g., `feat(agent-env):`) map to publishable packages following the standard changesets workflow.
2. **Merge to main = release (when warranted)** — A GitHub Actions workflow detects pending version bumps, updates package versions, publishes affected packages to npm, and creates GitHub releases. Publishing only fires when pending version bumps exist — non-package changes (CI config, docs, internal-only) don't trigger releases.
3. **Per-package control** — Each package opts in to publishing. `@zookanalytics/shared` stays private. New packages onboard by configuring a single field. The pipeline is shared CI infrastructure with per-package publish configuration — not a uniform pipeline.
4. **Pilot with agent-env** — Prove the pipeline end-to-end with `@zookanalytics/agent-env`, then onboard orchestrator, keystone-workflows, and future packages.
5. **CI scope validation** — Conventional commit scopes must match the known set of packages. CI rejects unrecognized scopes rather than silently misrouting version bumps. The allowed scope set stays aligned with the actual packages in the monorepo.
6. **Integration testing as a publish gate** — Install the packed tarball in a clean environment, run the CLI, verify it works. This catches the entire class of "publishes but broken" failures before they reach npm.

Changesets is justified by its edge case handling — workspace protocol rewriting, multi-package coordination, publish ordering — not by being the default choice. These are problems that would take significant effort to solve from scratch.

### Key Differentiators

| Aspect | Design Choice |
|--------|---------------|
| **Zero extra friction** | Leverages conventional commits already enforced — no new human steps |
| **Incremental onboarding** | Packages opt in individually; no big-bang migration |
| **Scales with the monorepo** | Adding a publishable package is configuration, not infrastructure work |
| **Per-package flexibility** | Handles TypeScript CLIs (build → dist → publish), data packages (no build, custom postinstall), and future Docker image publishing without requiring a redesign |
| **Publish integrity** | Integration tests verify the installed package works, not just that it published |
| **Scope enforcement** | CI validates commit scopes against known packages — prevents silent misrouting of version bumps |
| **Manual escape hatch** | Explicit changeset files available when auto-generation isn't precise enough (multi-package PRs with different bump levels) |

---

## Target Users

### Maintainer (You)

Solo developer maintaining the monorepo. Interaction with the release infrastructure should be near-invisible:

- Write conventional commits with correct scopes (already standard practice)
- Merge PRs to main
- Publishing happens automatically — no post-merge steps

**Success:** Merge and move on. `npm install -g @zookanalytics/agent-env@latest` returns the new version without any manual intervention.

### Package Consumers

Primarily devcontainer Dockerfiles that run `npm install -g @zookanalytics/<package>` during image build. They need:

- Packages available on the public npm registry
- Stable semver for pinning
- Working CLI after install — no post-install debugging

### Key Interactions

| Interaction | What Matters |
|-------------|-------------|
| **Setup** | One-time: configure changesets, npm org, CI pipeline. Verify with pilot publish. |
| **Daily** | Invisible. Merge triggers publish. No thought required. |
| **New package** | Add to changesets config, verify scope mapping. Minimal friction. |
| **Debugging** | CI publish fails → clear logs → fix → re-run. |

---

## Success Metrics

Infrastructure success is gate-based, not growth-based. Each gate validates a capability that must work before the infrastructure is considered complete.

| Gate | Criteria | Validation |
|------|----------|------------|
| **It works** | `npm install -g @zookanalytics/agent-env` installs a working CLI from the public registry | Manual verification + integration test in CI |
| **It's automatic** | Merging a PR with a `feat(agent-env):` commit results in a new version on npm with zero manual steps | End-to-end pipeline test: merge → version bump → publish → verify |
| **It scales** | Onboarding a second package doesn't require modifying the CI pipeline — only per-package configuration | Onboard keystone-workflows or orchestrator as validation |
| **It catches problems** | A PR that would publish a broken package (bad exports, missing files, leaked workspace refs) is caught before merge | Integration test: pack tarball → install in clean env → run CLI → assert |

### Business Objectives

N/A — This is internal infrastructure. The business objective is: devcontainer builds stop being fragile, and adding publishable packages to the monorepo is cheap.

### Key Performance Indicators

No ongoing KPIs. Once the four gates pass, the infrastructure is done. If a publish fails in the future, it's a bug to fix, not a metric to track.

---

## MVP Scope

### Core Features

| Feature | Description |
|---------|-------------|
| **Changesets + conventional-commit integration** | Install changesets, configure conventional-commit plugin, define scope-to-package mapping in `.changeset/config.json` |
| **GitHub Actions publish workflow** | New workflow that builds on existing CI (not duplicating build/lint/test). Detects pending changesets on merge to main → bump versions → publish to npm → create GitHub releases with changelogs. |
| **Per-package publish configuration** | Configure agent-env as pilot publishable package. Verify `package.json` fields: `files`, `bin`, `exports`, `main`, `types`. Ensure `shared` is excluded from publishing. |
| **Integration test gate** | CI step on PRs: pack tarball → install in clean environment → run CLI → assert it works. Catches broken publishes before merge. Also validates ESM resolution, dependency correctness, and bin configuration on every PR. |
| **Commit scope validation** | CI check validating conventional commit scopes against the allowed set of package names. Rejects unrecognized scopes. Tooling choice (commitlint vs lighter-weight check) is an architecture decision. |
| **npm org + first publish** | Create `@zookanalytics` org on npm, configure `NPM_TOKEN` GitHub secret, execute first publish of `@zookanalytics/agent-env@0.1.0` |
| **Changeset bot on PRs** | GitHub bot that comments on PRs with version change summary — visibility into what each PR will release |

**The ship-it bar:** Merge a PR with `feat(agent-env): add foo` → version bumps to 0.2.0 → publishes to npm → GitHub release created → `npm install -g @zookanalytics/agent-env@latest` returns the new version. Zero manual steps.

**Implementation note:** Do a manual dry-run publish (`npm pack` + local install + `pnpm publish --dry-run`) before automating. De-risks auth, org, package names, and `files` field in the simplest environment first. Automate what you've already proven works.

### Out of Scope for MVP

| Item | Rationale |
|------|-----------|
| **Docker image publishing** | Different registry, different pipeline. Design doesn't preclude it, but not building it now. |
| **Publishing additional packages** | Infrastructure supports it, but MVP proves the pipeline with agent-env only. Onboarding orchestrator/keystone-workflows is a follow-up. |
| **Retroactive versioning** | Start fresh from 0.1.0. No need to reconstruct history. |
| **Pre-release channels** | (`alpha`, `beta`, `next` tags) — Not needed at current scale. Add when there's a reason. |
| **Automated changelog beyond GitHub releases** | Changesets generates release notes. A separate CHANGELOG.md file is not MVP. |
| **npm provenance / package signing** | Nice-to-have for supply chain security. Not blocking for an 0.x personal tool. |

### MVP Success Criteria

The four success gates from the metrics section define MVP completion:

1. `npm install -g @zookanalytics/agent-env` installs a working CLI
2. Merge-to-main auto-publishes with zero manual steps
3. A second package can be onboarded with config-only changes
4. Integration tests catch broken packages before publish

All four gates must pass. The infrastructure is done when they do.

### Future Vision

**Post-MVP (next packages):**
- Onboard `@zookanalytics/orchestrator` and `@zookanalytics/keystone-workflows`
- Validate per-package flexibility with a data-only package (keystone-workflows has no build step, has postinstall)

**Later:**
- Docker image publishing pipeline (separate workflow, same CI infrastructure pattern)
- Pre-release channels if needed for testing unstable versions
- npm provenance for supply chain integrity
- CHANGELOG.md generation if GitHub releases aren't sufficient

**Not planned:**
- Private registry — all packages are public
- Team publishing workflows — solo maintainer for the foreseeable future
