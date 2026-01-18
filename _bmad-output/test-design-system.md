# System-Level Test Design

**Project:** BMAD Orchestrator
**Date:** 2026-01-08
**Author:** Node
**Status:** Draft
**Phase:** 3 - Solutioning (Testability Review)

---

## Executive Summary

This document provides a system-level testability review of the BMAD Orchestrator architecture before the implementation readiness gate check. The architecture demonstrates strong testability fundamentals with clear module boundaries, dependency injection patterns, and a test-first approach.

**Overall Assessment: PASS with Minor Recommendations**

The architecture is well-designed for testability. All identified concerns are addressable during Sprint 0 setup.

---

## Testability Assessment

### Controllability: PASS

**Assessment:** The architecture provides excellent mechanisms for controlling system state during testing.

| Aspect | Evidence | Rating |
|--------|----------|--------|
| **State Control** | useReducer pattern enables deterministic state transitions via dispatch | ✓ |
| **Dependency Injection** | `createDiscovery(executor)` pattern allows mock injection | ✓ |
| **External Dependencies** | execa with `reject: false` pattern returns errors in values | ✓ |
| **Error Triggering** | File read failures, DevPod CLI errors mockable via DI | ✓ |
| **Data Isolation** | Fixture-based testing from `lib/__fixtures__/` directory | ✓ |

**Key Patterns:**
- Factory functions (`createDiscovery`, `createStateParser`) accept injected dependencies
- Reducer actions use explicit `SCREAMING_SNAKE_CASE` types for predictable state transitions
- Promise.allSettled pattern isolates failures per DevPod

### Observability: PASS

**Assessment:** The architecture provides clear mechanisms for inspecting system state and validating results.

| Aspect | Evidence | Rating |
|--------|----------|--------|
| **State Inspection** | Single `useOrchestrator` hook exposes all state | ✓ |
| **Deterministic Results** | Status states clearly defined (RUNNING, IDLE, INACTIVE, DONE) | ✓ |
| **Error Visibility** | `formatError()` template provides structured error messages | ✓ |
| **JSON Output** | CLI `--json` flag enables structured output validation | ✓ |
| **Component State** | Ink components declaratively render state | ✓ |

**Status Indicators:**
| Symbol | State | Testable Condition |
|--------|-------|-------------------|
| `✓` | DONE | Story status is `done` |
| `●` | RUNNING | Story `in-progress` + recent mtime |
| `○` | IDLE | No `in-progress` story assigned |
| `⚠` | INACTIVE | `in-progress` but stale mtime (>1 hour) |
| `✗` | ERROR | Connection/parse failure |

### Reliability: PASS

**Assessment:** The architecture supports isolated, reproducible tests.

| Aspect | Evidence | Rating |
|--------|----------|--------|
| **Test Isolation** | `lib/` modules are pure functions (no React imports) | ✓ |
| **Parallel Safety** | No shared mutable state in lib modules | ✓ |
| **Cleanup Discipline** | Fixtures define expected state, no database cleanup needed | ✓ |
| **Reproducibility** | Deterministic YAML parsing, controlled fixture data | ✓ |
| **Loose Coupling** | Clear layer boundaries (lib → hooks → components) | ✓ |

**Dependency Flow (No Cycles):**
```
cli.ts
├── commands/*.ts ──→ lib/discovery.ts
│                 ──→ lib/state.ts
│                 ──→ lib/commands.ts
└── Dashboard.tsx ──→ useOrchestrator.ts
                      ├── lib/discovery.ts
                      ├── lib/state.ts
                      └── lib/activity.ts
```

---

## Architecturally Significant Requirements (ASRs)

### Performance ASRs

| ASR ID | Requirement | Probability | Impact | Score | Testing Approach |
|--------|-------------|-------------|--------|-------|------------------|
| ASR-P1 | Dashboard renders <2s | 2 | 2 | 4 | Performance test: measure time from launch to first render |
| ASR-P2 | Status refresh <1s | 2 | 2 | 4 | Integration test: mock file reads, measure refresh cycle |
| ASR-P3 | CLI commands <500ms | 1 | 2 | 2 | Unit test: measure command execution time |
| ASR-P4 | DevPod discovery <3s for 10 DevPods | 2 | 2 | 4 | Integration test: mock 10 DevPods, verify parallel execution |

**Mitigation:** Performance tests run on CI with baseline thresholds. Parallel DevPod reads via Promise.allSettled.

### Reliability ASRs

| ASR ID | Requirement | Probability | Impact | Score | Testing Approach |
|--------|-------------|-------------|--------|-------|------------------|
| ASR-R1 | Zero false negatives on stale detection | 2 | 3 | 6 | Unit test: all edge cases for mtime threshold (1 hour) |
| ASR-R2 | Partial DevPod failures don't block others | 2 | 3 | 6 | Integration test: mock mixed success/failure DevPod reads |
| ASR-R3 | Graceful handling of unreachable DevPods | 2 | 2 | 4 | Unit test: `reject: false` pattern returns error state |

**Mitigation:** Critical paths (ASR-R1, ASR-R2) have comprehensive unit test coverage from day 1.

### Data Integrity ASRs

| ASR ID | Requirement | Probability | Impact | Score | Testing Approach |
|--------|-------------|-------------|--------|-------|------------------|
| ASR-D1 | Correctly parse sprint-status.yaml | 2 | 3 | 6 | Unit test: fixture-based validation, edge cases |
| ASR-D2 | Correctly parse story task progress | 2 | 2 | 4 | Unit test: regex validation `/- \[(x| )\]/g` |
| ASR-D3 | Handle malformed YAML gracefully | 2 | 2 | 4 | Unit test: malformed fixture → error state |

**Mitigation:** Comprehensive fixture suite including `sprintStatusMalformed.yaml`.

---

## Test Levels Strategy

Based on the CLI + TUI architecture, the recommended test level split is:

| Level | Percentage | Rationale |
|-------|------------|-----------|
| **Unit** | 60% | Pure lib modules (`discovery`, `state`, `activity`, `commands`, `errors`) |
| **Integration** | 25% | Hook composition (`useOrchestrator`), CLI command handlers |
| **E2E** | 15% | Critical TUI interactions, smoke tests |

### Unit Tests (Primary)

**Target Modules:**
- `lib/discovery.ts` - DevPod CLI subprocess handling
- `lib/state.ts` - YAML parsing, task progress extraction
- `lib/activity.ts` - mtime calculation, threshold detection
- `lib/commands.ts` - SSH/dispatch command generation
- `lib/errors.ts` - Error formatting

**Coverage Target:** 90%+ for lib modules

**Key Patterns:**
```typescript
// Dependency injection for subprocess mocking
const mockExecutor = vi.fn().mockResolvedValue({
  stdout: JSON.stringify([...]),
  failed: false
});
const discover = createDiscovery(mockExecutor);
```

### Integration Tests (Secondary)

**Target Modules:**
- `hooks/useOrchestrator.ts` - State composition, effect lifecycle
- `commands/status.ts`, `commands/list.ts` - CLI handlers with lib integration

**Coverage Target:** 80%+

**Key Patterns:**
- Test reducer state transitions end-to-end
- Verify hook effects trigger correctly
- Test CLI output format (text and JSON modes)

### E2E Tests (Selective)

**Target Scenarios:**
- Dashboard renders with fixture data
- Keyboard navigation (j/k) updates selection
- Copy command to clipboard
- Quit gracefully

**Coverage Target:** Critical paths only, keep suite <2 minutes

**Framework:** ink-testing-library for TUI component testing

---

## NFR Testing Approach

### Security: N/A

This is a local CLI tool with no authentication, no network services, and no user data storage. Security testing is not applicable for Phase 1.

### Performance: Unit + Integration

**Testing Approach:**
- Unit tests measure individual module execution time
- Integration tests verify parallel DevPod discovery
- CI enforces baseline thresholds (fail if >2x baseline)

**Tools:** Vitest with `performance.now()` assertions

**Example:**
```typescript
test('discovery completes within 3s for 10 DevPods', async () => {
  const start = performance.now();
  const result = await discover(); // 10 mocked DevPods
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(3000);
});
```

### Reliability: Unit + Integration

**Testing Approach:**
- Unit tests cover all error states (`reject: false` pattern)
- Integration tests verify graceful degradation (partial failures)
- Snapshot tests for error message formatting

**Key Scenarios:**
- DevPod CLI not installed → clear error message
- DevPod unreachable → skip, show partial results
- YAML parse error → show error for that DevPod only
- File not found → mark as "not BMAD-initialized"

### Maintainability: CI Automation

**Testing Approach:**
- Coverage target: 80% overall, 90% for lib modules
- Code duplication check: <5% via jscpd
- Type checking: `tsc --noEmit` on every commit

**CI Pipeline:**
```yaml
- run: pnpm type-check
- run: pnpm lint
- run: pnpm test:run -- --coverage
- run: pnpm dlx jscpd src/ --threshold 5
```

---

## Test Environment Requirements

### Local Development

| Requirement | Specification |
|-------------|---------------|
| Node.js | 22.x (LTS) |
| Test Runner | Vitest 4.0.16 |
| TUI Testing | ink-testing-library |
| Coverage | Vitest built-in (v8) |

### CI Environment

| Requirement | Specification |
|-------------|---------------|
| Runner | ubuntu-latest |
| Node.js | 22.x |
| Timeout | 5 minutes max |
| Parallelization | Default (auto) |

### Test Fixtures Required (Sprint 0)

| Fixture | Purpose | Edge Case |
|---------|---------|-----------|
| `devPodList.json` | Normal DevPod list | 3 DevPods, mixed states |
| `devPodListEmpty.json` | No DevPods | Empty array |
| `devPodListError.json` | CLI error | stderr output |
| `sprintStatus.yaml` | Normal sprint | Multiple stories, various statuses |
| `sprintStatusMinimal.yaml` | Minimal valid | One story, defaults |
| `sprintStatusMalformed.yaml` | Invalid YAML | Tests error handling |
| `story-1-1.md` | In-progress story | Some tasks checked |
| `story-1-1-complete.md` | Completed story | All tasks checked |

---

## Testability Concerns

### No Critical Concerns

The architecture is well-designed for testability. All concerns below are addressable during Sprint 0.

### Minor Recommendations

| Concern | Impact | Recommendation | Owner |
|---------|--------|----------------|-------|
| **TUI visual testing** | Low | Consider snapshot tests for component output | QA |
| **Clock mocking for mtime** | Low | Use Vitest `vi.useFakeTimers()` for activity tests | Dev |
| **Real DevPod testing** | Medium | Create manual test protocol for local validation | QA |

### Not Applicable for Phase 1

- Authentication testing (no auth)
- Network security (local tool only)
- Database testing (no database)
- Load testing (single user CLI)

---

## Recommendations for Sprint 0

### Epic 1: Project Foundation (Must Include)

1. **Test infrastructure setup**
   - Vitest configuration with globals and coverage
   - ink-testing-library integration
   - Co-located test files pattern (`*.test.ts`)

2. **CI workflow**
   - Type check, lint, test on every commit
   - Coverage threshold enforcement (80%)
   - jscpd duplication check (<5%)

3. **Test fixtures**
   - Create all 8 required fixtures
   - Document fixture contract in README

4. **One passing test**
   - Smoke test that verifies test infrastructure works
   - Example: `expect(true).toBe(true)` or simple lib function test

### Test Framework Initialization

**Recommended `vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        global: { lines: 80, functions: 80, branches: 70, statements: 80 }
      }
    }
  },
});
```

### Test Priority for Core Modules

| Priority | Module | Rationale |
|----------|--------|-----------|
| **Critical** | `lib/discovery.ts` | Entry point for all data |
| **Critical** | `lib/state.ts` | YAML parsing edge cases |
| **High** | `lib/activity.ts` | Stale detection must be reliable |
| **High** | `hooks/useOrchestrator.ts` | State composition complexity |
| **Medium** | `components/*.tsx` | Snapshot + key interactions |
| **Low** | `cli.ts` | Integration test only |

---

## Gate Recommendation

### Overall Decision: PASS

The BMAD Orchestrator architecture demonstrates strong testability characteristics:

- **Controllability**: Dependency injection, factory patterns, fixture-based testing
- **Observability**: Clear state exposure, structured errors, JSON output
- **Reliability**: Pure functions, no shared state, isolated modules

### Pre-Implementation Checklist

- [x] Test framework specified (Vitest 4.0.16)
- [x] Test file pattern defined (co-located `*.test.ts`)
- [x] Coverage targets documented (80% global, 90% lib)
- [x] CI workflow outlined
- [x] Fixture requirements specified (8 files)
- [x] Test priority order established
- [ ] Sprint 0 to implement above before feature code

### Next Steps

1. Proceed with **`/bmad:bmm:workflows:create-epics-and-stories`** to create implementation stories
2. Include test setup as **Epic 1, Story 1** (blocking all other work)
3. Run **`/bmad:bmm:workflows:check-implementation-readiness`** after epics/stories created
4. Use **`/bmad:bmm:workflows:testarch-framework`** during Sprint 0 to scaffold test infrastructure

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/bmm/workflows/testarch/test-design`
**Version**: 4.0 (BMad v6)
**Mode**: System-Level (Phase 3 Testability Review)
