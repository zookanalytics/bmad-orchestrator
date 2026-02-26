# Story 8.2: Create from registered repo

Status: done

## Story

As a **user**,
I want **to create instances from known repos by slug instead of full URL**,
So that **I can spin up new environments faster**.

## Acceptance Criteria

1. **Given** I previously created an instance from `https://github.com/user/bmad-orchestrator`
   **When** I run `agent-env create feature --repo bmad-orchestrator`
   **Then** the repo slug is recognized and the full URL is resolved from the registry
   **And** the instance is created normally

2. **Given** I run `agent-env create feature --repo unknown-repo`
   **When** the slug matches no tracked repository
   **Then** I get error: "Repository 'unknown-repo' not found. Use a full URL or run `agent-env repos` to see tracked repos."

3. **Given** I run `agent-env create feature --repo https://github.com/user/new-repo`
   **When** the value looks like a URL (contains `://` or starts with `git@`)
   **Then** it's treated as a URL directly (not a slug lookup)

## Tasks / Subtasks

- [x] Task 1: Create `resolve-repo-arg.ts` lib module with slug-vs-URL detection and slug resolution (AC: #1, #2, #3)
  - [x] 1.1 Create `isRepoUrl()` function: returns true if value contains `://` or starts with `git@`
  - [x] 1.2 Create `resolveRepoArg()` function that: detects URL vs slug, resolves slugs via `listRepos()`, returns full URL
  - [x] 1.3 Define `ResolveRepoArgResult` type following existing result pattern
  - [x] 1.4 Use dependency injection for `listRepos` to enable testing

- [x] Task 2: Write unit tests for `resolve-repo-arg.ts` (AC: #1, #2, #3)
  - [x] 2.1 Test: full HTTPS URL is passed through directly without slug lookup
  - [x] 2.2 Test: SSH URL (git@) is passed through directly without slug lookup
  - [x] 2.3 Test: "." is passed through directly (handled downstream by resolveRepoUrl)
  - [x] 2.4 Test: known slug resolves to full URL from registry
  - [x] 2.5 Test: unknown slug returns error with helpful message
  - [x] 2.6 Test: listRepos failure propagates as error

- [x] Task 3: Update `commands/create.ts` to use `resolveRepoArg()` before `resolveRepoUrl()` (AC: #1, #2, #3)
  - [x] 3.1 Import `resolveRepoArg` and call it before `resolveRepoUrl`
  - [x] 3.2 If slug resolved, use resolved URL; if URL detected, pass through to existing flow
  - [x] 3.3 Display resolved slug info: "Resolved repo 'bmad-orchestrator' → <url>"

- [x] Task 4: Write command-level tests for slug resolution in create (AC: #1, #2, #3)
  - [x] 4.1 Test: create with slug resolves and passes URL to createInstance
  - [x] 4.2 Test: create with unknown slug shows error message
  - [x] 4.3 Test: create with full URL bypasses slug resolution

- [x] Task 5: Run full test suite and verify no regressions
  - [x] 5.1 Run `pnpm -r test:run` — 810 tests pass (shared: 25, orchestrator: 45, agent-env: 740)
  - [x] 5.2 Run `pnpm -r type-check` — all packages clean

## Dev Notes

### Architecture Context
- This story extends the create command to support slug-based repo references
- Uses the `listRepos()` function from Story 8.1 to resolve slugs to URLs
- The slug resolution happens BEFORE the existing `resolveRepoUrl()` which handles the "." case
- URL detection: contains `://` or starts with `git@` (per epic spec)
- Non-URL, non-"." values are treated as slugs for registry lookup

### Key ADR Decisions
- **Slug resolution as a separate lib module:** Keeps concerns separated — `resolve-repo-arg.ts` handles slug-vs-URL detection, `resolveRepoUrl` handles "." resolution
- **Order of resolution:** resolveRepoArg (slug→URL) → resolveRepoUrl (dot→URL) → createInstance (URL→workspace)
- **No ambiguity:** "." is special-cased and passed through to resolveRepoUrl; anything with `://` or `git@` is a URL; everything else is a slug
- **FR53 covered by this story**

### Technical Specifications
- New file: `packages/agent-env/src/lib/resolve-repo-arg.ts` — slug detection and resolution logic
- New file: `packages/agent-env/src/lib/resolve-repo-arg.test.ts` — unit tests
- Modified: `packages/agent-env/src/commands/create.ts` — integrate slug resolution before URL resolution

### Previous Learnings
- From env-8-1: `listRepos()` uses DI pattern with `Partial<ListReposDeps>` — reuse same pattern
- From env-8-1: Workspaces with `unknown` repoSlug are excluded from listing
- From Known AI Agent Risks: Verify all tests actually run and pass — run full suite

## Dev Agent Record

### Implementation Plan
1. Create `resolve-repo-arg.ts` with `isRepoUrl()` and `resolveRepoArg()` functions
2. Write comprehensive unit tests for `resolve-repo-arg.ts`
3. Update `commands/create.ts` to integrate slug resolution
4. Write command-level tests for the create command changes
5. Run full test suite

### Debug Log
- No issues encountered. Implementation followed existing patterns from `list-repos.ts` and `repos.ts`.
- The `resolveRepoArg()` function reuses `listRepos()` for slug resolution with the same DI pattern.
- Command test required careful handling of mocked `process.exit` since execution continues past the mock in tests.

### Completion Notes
All 5 tasks complete. 810 tests pass across all packages (shared: 25, orchestrator: 45, agent-env: 740). Type-check clean. No commits per user instructions.

New tests added: 15 total
- `resolve-repo-arg.test.ts`: 12 tests (isRepoUrl detection, URL pass-through, "." pass-through, slug resolution, unknown slug error, listRepos error propagation)
- `create.test.ts`: 3 tests (slug resolved to URL, unknown slug error, full URL bypass)

## File List

### New
- `packages/agent-env/src/lib/resolve-repo-arg.ts` — Core slug-vs-URL detection (`isRepoUrl()`) and slug resolution (`resolveRepoArg()`) with DI pattern
- `packages/agent-env/src/lib/resolve-repo-arg.test.ts` — 12 unit tests for URL detection, slug resolution, and error handling
- `packages/agent-env/src/commands/create.test.ts` — 3 command-level tests for slug resolution integration in create command

### Modified
- `packages/agent-env/src/commands/create.ts` — Import `resolveRepoArg`, add slug resolution step before `resolveRepoUrl`, update `--repo` option description

### Sprint Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated env-8-2 to `in-progress`

## Senior Developer Review (AI)

**Reviewer:** Node | **Date:** 2026-02-26

**Outcome:** Approved — all issues fixed

### AC Validation
| AC | Status | Evidence |
|----|--------|----------|
| AC#1: Slug resolved to URL | IMPLEMENTED | `resolve-repo-arg.ts:62-89`, `create.ts:91-102` |
| AC#2: Unknown slug error | IMPLEMENTED | `resolve-repo-arg.ts:78-87` — correct wording |
| AC#3: URL pass-through | IMPLEMENTED | `resolve-repo-arg.ts:57-60` — `isRepoUrl()` |

### Task Audit
All 5 tasks (16 subtasks) verified complete. 810 tests pass. Type-check clean.

### Findings (2 Medium, 3 Low)

**MEDIUM — Fixed:**
1. **M1:** Usage suggestion `--repo <url>` inconsistent with updated option `--repo <url|slug>` (`create.ts:62`) — Updated to `<url|slug>`
2. **M2:** `ResolveRepoArgDeps.listRepos` signature included unused `deps` parameter `(deps?: Partial<ListReposDeps>)` — Simplified to `() => Promise<ListReposResult>`, removed unused `ListReposDeps` import

**LOW — Not fixed (informational):**
3. **L1:** No test for case-sensitivity of slug matching (behavior is correct, just undocumented)
4. **L2:** Pre-existing flaky test in `InteractiveMenu.test.tsx` (not caused by this story, race condition)
5. **L3:** `ResolveRepoArgDeps` type complexity noted — addressed by M2 fix

### Verification
- `pnpm -r type-check` — clean
- `pnpm -r test:run` — 810 tests pass (shared: 25, orchestrator: 45, agent-env: 740)
- Git vs story File List — no discrepancies

## Change Log
- 2026-02-26: Story created and all 5 tasks implemented in single session. 810 tests passing across all packages. Status set to review.
- 2026-02-26: Code review complete. 2 medium issues fixed (usage suggestion text, DI type signature). 3 low informational items noted. Status set to done.
