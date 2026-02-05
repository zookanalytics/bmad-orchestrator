# Story: Implement agent-env Artifact Packing in CI

**Story ID:** rel-1-3
**Epic:** Release Epic 1 - Verified Artifact Pipeline & Configuration
**Sprint:** Release Infrastructure Sprint 1
**Status:** done

---

## Story

As a developer,
I want the existing CI workflow to generate and store a package tarball,
So that it can be used for integration testing without access to the full source tree.

---

## Acceptance Criteria

1. **Given** the existing `.github/workflows/ci.yml` file
   **When** the `check` job completes the `build` step
   **Then** it must run `pnpm pack` for the `agent-env` package
   **And** ensure internal workspace dependencies (like `shared`) are either bundled into the output or are not present in the runtime `dependencies` list
   **And** it must upload the resulting `.tgz` file as a GitHub Actions artifact named `agent-env-tarball`

---

## Tasks/Subtasks

- [x] Task 1: Add pnpm pack step to CI workflow
  - [x] Add step after "Build all packages" to run `pnpm pack` for agent-env
  - [x] Ensure pack runs in the packages/agent-env directory
  - [x] Capture the tarball filename for the upload step (glob pattern `*.tgz` used)
- [x] Task 2: Upload tarball as GitHub Actions artifact
  - [x] Add step to upload the .tgz file as artifact
  - [x] Name the artifact `agent-env-tarball`
  - [x] Set appropriate retention-days (7 days like coverage reports)
- [x] Task 3: Verify workspace dependencies are handled
  - [x] Confirm @zookanalytics/shared is bundled (tsup noExternal from Story 1.1)
  - [x] Confirm shared is NOT in runtime dependencies list
  - [x] Add validation step or note in workflow comments

---

## Dev Notes

### Architecture Requirements
- Per Architecture Decision Document: CI artifact packing is step 3 of implementation priority
- This enables Story 1.4's clean-room integration test harness
- Story 1.1 configured tsup bundling with `noExternal: ['@zookanalytics/shared']`
- Story 1.2 verified the tarball is self-contained and publishable

### Technical Approach
- Add pack step after the existing `pnpm -r build` step in ci.yml
- Use `pnpm --filter @zookanalytics/agent-env pack` or `cd packages/agent-env && pnpm pack`
- Upload the resulting tarball as GitHub Actions artifact for downstream jobs
- Artifact name: `agent-env-tarball` (matches Story 1.4 expectations)

### Prerequisites
- Story rel-1-1 completed (tsup bundling configured) ✅
- Story rel-1-2 completed (manual dry-run verified) ✅

### Key Constraints
- CI workflow must remain a single `check` job (for now)
- Tarball must be usable by Story 1.4's integration-test job
- No changes to package.json or build configuration needed (already done in 1.1)

---

## Dev Agent Record

### Session Log
- **2026-02-05**: Story created from epic definition, implementation started

### Implementation Plan
1. Add pack step to ci.yml after build
2. Add artifact upload step for the tarball
3. Add comment documenting workspace dependency handling
4. Verify tests pass

### Debug Log
- Local `pnpm pack` test produced: `zookanalytics-agent-env-0.1.0.tgz` (11,692 bytes)
- Tarball contents verified: 11 files (bin, dist, config, LICENSE, README.md, package.json)
- No `@zookanalytics/shared` in runtime dependencies (it's in devDependencies, bundled via tsup)

### Completion Notes
All acceptance criteria met:

1. **CI Pack Step Added:**
   - Added "Pack agent-env tarball" step after "Build all packages" in ci.yml
   - Step runs `pnpm pack` with `working-directory: packages/agent-env`
   - Includes inline comments documenting the workspace dependency bundling (Story rel-1-1)

2. **Artifact Upload Configured:**
   - Added "Upload agent-env tarball" step using `actions/upload-artifact@v4`
   - Artifact name: `agent-env-tarball` (matches Story 1.4 expectations)
   - Path pattern: `packages/agent-env/*.tgz`
   - Retention: 7 days (consistent with coverage-reports artifact)

3. **Workspace Dependencies Verified:**
   - `@zookanalytics/shared` is bundled into `dist/cli.js` via tsup `noExternal` config (Story 1.1)
   - `shared` is in devDependencies only, NOT in runtime dependencies
   - Workflow comments document this design decision for future maintainers

4. **Regression Testing:**
   - Type-check: passes
   - Lint: passes
   - Tests: 327 passed (25 shared + 51 orchestrator + 251 agent-env)

5. **Ready for Story 1.4:**
   - Artifact `agent-env-tarball` will be available for the clean-room integration test job

### Code Review Findings
- **2026-02-05 (Initial Review)**: Automated code review applied the following fixes:
  - **Corrected Cache Configuration**: Simplified and corrected the `restore-keys` for the pnpm cache to improve cache hit rates and align with best practices.
  - **Added Maintainability Notes**: Added comments to the CI workflow to highlight hardcoded paths for the `agent-env` package and suggest future improvements for scalability.
- **2026-02-05 (Adversarial Review)**: Second code review identified and fixed:
  - **Removed Unused Step ID**: The `id: pack_agent_env` and its meta-comment were removed since the ID was never referenced. Per Architecture conventions, step IDs should only be added when needed for `if` conditions or output references.
  - **Cleaned Up Comments**: Replaced verbose REVIEW-NOTE comment with concise documentation explaining the step's purpose and the tsup bundling strategy.

---

## File List

Files created:
- _bmad-output/implementation-artifacts/rel-1-3-implement-agent-env-artifact-packing-in-ci.md (this story file)

Files modified:
- .github/workflows/ci.yml (artifact packing and upload added)
- _bmad-output/implementation-artifacts/sprint-status.yaml (story status updated)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Story created from epic definition | Dev Agent |
| 2026-02-05 | All tasks completed, CI workflow updated with pack and upload steps, status changed to review | Dev Agent |
| 2026-02-05 | Code review completed, automated fixes applied for CI efficiency and caching, status changed to done | Review Agent |
| 2026-02-05 | Adversarial code review: removed unused step ID, cleaned up comments | Review Agent |
