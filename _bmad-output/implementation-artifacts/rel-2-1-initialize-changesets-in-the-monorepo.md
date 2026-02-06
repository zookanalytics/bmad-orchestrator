# Story: Initialize Changesets in the Monorepo

**Story ID:** rel-2-1
**Epic:** Release Epic 2 - Automated Versioning & Release Staging
**Sprint:** Release Infrastructure Sprint 2
**Status:** done

---

## Story

As a maintainer,
I want to install and initialize the Changesets tool,
So that I can start tracking version bumps and changelogs systematically.

---

## Acceptance Criteria

1. **Given** the monorepo root directory
   **When** I install `@changesets/cli` and `@changesets/changelog-github` as workspace-root devDependencies
   **Then** I must add a `"changeset": "changeset"` script to the root `package.json`
   **And** running `pnpm changeset init` must create a `.changeset/` directory with a default `config.json`
   **And** the `.changeset/README.md` must be present with standard instructions

---

## Tasks/Subtasks

- [x] Task 1: Install @changesets/cli and @changesets/changelog-github as workspace-root devDependencies
  - [x] Run `pnpm add -Dw @changesets/cli @changesets/changelog-github`
  - [x] Verify packages appear in root package.json devDependencies
- [x] Task 2: Add changeset script to root package.json
  - [x] Add `"changeset": "changeset"` to scripts section
- [x] Task 3: Run pnpm changeset init to create .changeset/ directory
  - [x] Run `pnpm changeset init`
  - [x] Verify `.changeset/config.json` is created with default configuration
- [x] Task 4: Verify .changeset/README.md is present with standard instructions
  - [x] Confirm `.changeset/README.md` exists
  - [x] Confirm it contains standard changesets instructions
- [x] Task 5: Run all quality checks to verify no regressions
  - [x] Run type-check, lint, and tests
  - [x] Verify all pass

---

## Dev Notes

### Architecture Requirements
- Per Architecture doc: `pnpm add -Dw @changesets/cli @changesets/changelog-github && pnpm changeset init`
- This is the first step in setting up the changesets versioning pipeline
- Story 2.2 will configure the generated config.json with proper scope mapping
- Architecture specifies `.changeset/config.json` structure (to be configured in Story 2.2)

### Technical Approach
- Install packages at workspace root level (not per-package)
- Use `pnpm add -Dw` flag to add to workspace root devDependencies
- `changeset init` creates the `.changeset/` directory with default config
- The `"changeset": "changeset"` script enables `pnpm changeset` from root

### Previous Learnings (from Epic rel-1 retro)
- Trusted Publishing (OIDC) replaces NPM_TOKEN approach
- tsup bundling pattern resolves private workspace dependency issue
- All quality checks must pass before marking tasks complete

---

## Dev Agent Record

### Session Log
- **2026-02-06**: Started implementation of Story rel-2-1
- **2026-02-06**: Completed all tasks, all quality checks pass

### Implementation Plan
1. Install changesets packages at workspace root
2. Add changeset script to root package.json
3. Run changeset init
4. Verify all artifacts created
5. Run quality checks

### Debug Log
- No issues encountered. Clean implementation.

### Completion Notes
All acceptance criteria met:

1. **Packages installed:**
   - `@changesets/changelog-github@^0.5.2` added to root devDependencies
   - `@changesets/cli@^2.29.8` added to root devDependencies
   - 87 new packages added to dependency tree

2. **Script added:**
   - `"changeset": "changeset"` added to root package.json scripts section

3. **Changesets initialized:**
   - `.changeset/config.json` created with default configuration:
     - `baseBranch: "main"`
     - `commit: false`
     - `access: "restricted"` (to be updated to `"public"` in Story 2.2)
     - `updateInternalDependencies: "patch"`
     - `changelog: "@changesets/cli/changelog"` (to be updated to `@changesets/changelog-github` in Story 2.2)
   - `.changeset/README.md` created with standard changesets instructions

4. **Quality checks:**
   - Type-check: All packages pass (shared, agent-env, orchestrator)
   - Lint: All packages pass
   - Tests: 417 passed (shared: 25, orchestrator: 51, agent-env: 341) — zero regressions

**Note:** The default config.json has `access: "restricted"` and `changelog: "@changesets/cli/changelog"`. Story 2.2 will update these to `access: "public"` and configure `@changesets/changelog-github` per the Architecture doc.

---

## File List

Files created:
- .changeset/config.json
- .changeset/README.md

Files modified:
- package.json (added changeset script and @changesets/cli, @changesets/changelog-github devDependencies)
- pnpm-lock.yaml (updated with new dependencies)
- _bmad-output/implementation-artifacts/sprint-status.yaml (rel-epic-2 → in-progress, rel-2-1 → review)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-06 | Story created and implementation started | Dev Agent |
| 2026-02-06 | Implementation completed, all ACs met, status changed to review | Dev Agent |
| 2026-02-06 | Code review: 3 MEDIUM + 2 LOW findings. M1: File List missing sprint-status.yaml. M2: Sprint-status still has dissolved Epic 4. M3: Sprint-status missing Stories 2.4 and 3.4. L1: Cosmetic onlyBuiltDependencies reformat reverted. L2: Schema version 3.1.2 vs arch doc 3.1.1 (informational). All auto-fixed. | Code Review |
