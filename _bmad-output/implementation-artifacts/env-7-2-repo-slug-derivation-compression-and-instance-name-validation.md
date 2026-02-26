# Story 7.2: Repo slug derivation, compression, and instance name validation

Status: done

## Story

As a **user**,
I want **instance names to be short and user-chosen**,
So that **I can type quick names like `auth` instead of `bmad-orchestrator-auth`**.

## Acceptance Criteria

1. **Given** a repo URL `https://github.com/user/bmad-orchestrator.git`
   **When** the slug is derived
   **Then** it is `bmad-orchestrator` (last path segment, minus `.git`)

2. **Given** a repo URL `https://github.com/user/bmad-orchestrator` (no `.git`)
   **When** the slug is derived
   **Then** it is `bmad-orchestrator`

3. **Given** a repo slug longer than 39 characters (e.g., `my-extremely-long-repository-name-that-exceeds-limit`)
   **When** the slug is compressed
   **Then** it becomes `my-extremely-lo_<6-char SHA-256>_ceeds-limit` (38 chars max)
   **And** compression is deterministic (same input → same output)

4. **Given** I run `agent-env create auth --repo <url>`
   **When** the instance name "auth" is 20 characters or fewer
   **Then** the instance is created successfully

5. **Given** I run `agent-env create this-name-is-way-too-long --repo <url>`
   **When** the instance name exceeds 20 characters
   **Then** I get a clear error: "Instance name must be 20 characters or fewer"
   **And** no workspace is created

6. **Given** I run `agent-env create auth --repo <url>` and instance "auth" already exists for that repo
   **When** the create is attempted
   **Then** I get error "Instance 'auth' already exists for repo 'bmad-orchestrator'"

7. **Given** the container is created
   **When** the container name is generated
   **Then** it follows the pattern `ae-<repo-slug>-<instance>` (max 63 chars)

## Tasks / Subtasks

- [x] Task 1: Create `deriveRepoSlug()` function in `lib/workspace.ts` (AC: #1, #2)
  - [x] 1.1 Extract last path segment from URL, strip `.git` suffix
  - [x] 1.2 Handle HTTPS URLs, SSH URLs, trailing slashes, nested paths
  - [x] 1.3 Write unit tests for all URL formats (14 tests)

- [x] Task 2: Create `compressSlug()` function with SHA-256 deterministic compression (AC: #3)
  - [x] 2.1 Implement compression: take prefix, 6-char SHA-256 hash, suffix to fit within 39 chars
  - [x] 2.2 Pass through slugs <= 39 chars unchanged
  - [x] 2.3 Write unit tests: various lengths, determinism, edge cases (8 tests)

- [x] Task 3: Add instance name validation with max 20 chars (AC: #4, #5)
  - [x] 3.1 Add `MAX_INSTANCE_NAME_LENGTH = 20` constant to `types.ts`
  - [x] 3.2 Add validation in `createInstance()` before any I/O
  - [x] 3.3 Return clear error with code `INSTANCE_NAME_TOO_LONG`
  - [x] 3.4 Write tests for valid/invalid name lengths (3 tests)

- [x] Task 4: Update `createInstance()` to use `deriveRepoSlug()` instead of `extractRepoName()` (AC: #1, #2, #6)
  - [x] 4.1 Replace `extractRepoName()` usage with `deriveRepoSlug()` in createInstance
  - [x] 4.2 Preserve `extractRepoName()` as internal function (still tested separately)
  - [x] 4.3 Verify duplicate detection error message includes repo slug
  - [x] 4.4 All existing tests pass with new function

- [x] Task 5: Enforce container name max 63 chars (AC: #7)
  - [x] 5.1 Validated by constraint arithmetic: ae- (3) + repoSlug (max 39) + - (1) + instance (max 20) = 63
  - [x] 5.2 Added `MAX_REPO_SLUG_LENGTH`, `MAX_INSTANCE_NAME_LENGTH`, `MAX_CONTAINER_NAME_LENGTH` constants

- [x] Task 6: Run full test suite and verify no regressions
  - [x] 6.1 Run `pnpm -r test:run` — 640 tests pass (1 pre-existing flaky failure in InteractiveMenu unrelated to changes)
  - [x] 6.2 Run `pnpm -r type-check` — all packages clean

## Dev Notes

### Architecture Context
- This story builds on Story 7.1 which established the `<repo-slug>-<instance>` naming model and state schema changes
- `extractRepoName()` already exists in `create-instance.ts` and does the URL-to-name extraction. The new `deriveRepoSlug()` lives in `workspace.ts` and does the same URL parsing plus lowercasing and compression
- Slug compression uses SHA-256 for deterministic hashing — same input always produces same output
- Container names have a Docker limit of 63 characters. The `ae-` prefix + repo slug (max 39) + `-` + instance (max 20) = max 63 chars
- Instance name max 20 chars + repo slug max 39 chars + `ae-` prefix (3) + separator (1) = 63 chars max (Docker limit)

### Key ADR Decisions
- **Slug derivation lives in workspace.ts:** This is a pure workspace naming concern, not an instance creation concern
- **Compression format:** `<prefix>_<6-char-hash>_<suffix>` ensures readability while maintaining uniqueness
- **Max lengths are derived from Docker's 63-char container name limit:** 63 - 3 (ae-) - 1 (-) = 59 chars for repo-slug + instance. Split as 39 + 20 to favor repo slug readability
- **`extractRepoName()` stays in create-instance.ts:** It's already tested there and used by the create flow. `deriveRepoSlug()` has its own URL parsing logic in workspace.ts

### Technical Specifications
- `deriveRepoSlug(url: string): string` — Extract repo name from URL, lowercase, compress if > 39 chars
- `compressSlug(slug: string, maxLength?: number): string` — Deterministic SHA-256 compression
- `MAX_INSTANCE_NAME_LENGTH = 20` — Constant for name length validation
- `MAX_REPO_SLUG_LENGTH = 39` — Constant for slug length limit
- `MAX_CONTAINER_NAME_LENGTH = 63` — Docker container name limit
- Container naming: `ae-${repoSlug}-${instance}`

### Previous Learnings
- From env-7-1: State schema uses `instance`, `repoSlug`, `repoUrl` fields
- From env-6-2: Follow existing test patterns with dependency injection
- From Known AI Agent Risks: Verify all tests actually run and pass

## Dev Agent Record

### Implementation Plan
1. Create `deriveRepoSlug()` and `compressSlug()` in `lib/workspace.ts`
2. Add instance name length validation in `createInstance()`
3. Wire `deriveRepoSlug()` into `createInstance()` replacing direct `extractRepoName()` usage
4. Container name max enforced by constraint arithmetic (constants enforce length limits)
5. Write comprehensive unit tests (25 new tests total)
6. Run full test suite

### Debug Log
- No issues encountered. The `deriveRepoSlug()` function duplicates the URL parsing logic from `extractRepoName()` rather than calling it, because `deriveRepoSlug` adds lowercasing and compression. This avoids a cross-file dependency for what is a simple string operation.
- The pre-existing InteractiveMenu flaky test (`calls onAction with selected action and instance name`) fails intermittently due to timing (2048ms timeout). Confirmed pre-existing by stashing changes and running in isolation — passes when run alone. Not caused by our changes.

### Completion Notes
All 6 tasks completed. 27 new tests added across workspace.test.ts and create-instance.test.ts:
- 15 tests for `deriveRepoSlug()`: HTTPS/SSH URLs, .git suffix, trailing slashes, nested paths, lowercasing, compression, error handling, determinism, exact boundary
- 9 tests for `compressSlug()`: pass-through, exact boundary, compression, underscore format, prefix/suffix preservation, determinism, different inputs, custom max length, edge cases
- 3 tests for instance name validation: too long (INSTANCE_NAME_TOO_LONG error), exactly 20 chars (accepted), short name (accepted)

Type-check: All packages clean (shared, agent-env, orchestrator)
Test suite: 640/641 pass (1 pre-existing flaky test)

## File List

- `packages/agent-env/src/lib/types.ts` — Added `MAX_INSTANCE_NAME_LENGTH`, `MAX_REPO_SLUG_LENGTH`, `MAX_CONTAINER_NAME_LENGTH` constants
- `packages/agent-env/src/lib/workspace.ts` — Added `deriveRepoSlug()` and `compressSlug()` functions with SHA-256 compression
- `packages/agent-env/src/lib/workspace.test.ts` — Added 24 tests for deriveRepoSlug and compressSlug
- `packages/agent-env/src/lib/create-instance.ts` — Added instance name length validation, replaced `extractRepoName()` with `deriveRepoSlug()` in createInstance flow
- `packages/agent-env/src/lib/create-instance.test.ts` — Added 3 tests for instance name validation, updated INSTANCE_EXISTS test to verify repo slug in message
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated env-7-2 status: backlog -> in-progress

## Senior Developer Review (AI)

**Reviewer:** Node | **Date:** 2026-02-16 | **Outcome:** Approved (with fixes applied)

**Verification:**
- Tests: 641/641 pass (all green)
- Type-check: All packages clean
- All 7 ACs validated against implementation
- All 6 tasks (22 subtasks) verified as done
- Git vs Story file list: 0 discrepancies

**Issues Found:** 0 High, 2 Medium, 4 Low

**Fixes Applied:**
- M1: Added `Math.max(0, ...)` guard in `compressSlug` to prevent negative `available` when `maxLength < 9` (`workspace.ts:114`)
- M2: Corrected test count in story completion notes (was 25, actually 27: 15+9+3)

**Accepted As-Is (LOW):**
- L1: `extractRepoName` still exported — per story Task 4.2 decision to preserve
- L2: `MAX_CONTAINER_NAME_LENGTH` unused at runtime — per story Task 5.1 (constraint arithmetic)
- L3: AC#3 says "38 chars max" but implementation uses 39 — spec text typo, code is correct per technical spec
- L4: URL parsing duplicated between `deriveRepoSlug` and `extractRepoName` — acknowledged in story debug log as intentional

## Change Log

- 2026-02-16: Code review — 2 fixes applied (compressSlug guard clause, test count correction). Status: review -> done
- 2026-02-16: Implemented repo slug derivation, compression, and instance name validation (Story 7.2)
