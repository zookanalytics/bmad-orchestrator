# System-Level Test Design - agent-env

**Date:** 2026-01-27
**Author:** Node
**Status:** Complete

---

## Executive Summary

**Scope:** System-level testability review for agent-env CLI (Phase 3 - Solutioning)

**Project Type:** CLI Tool with container orchestration
**Technology Stack:** TypeScript, Commander 14.0.2, Ink 6.6.0, @devcontainers/cli, execa 9.x, Vitest

**Risk Summary:**
- Total risks identified: 12
- High-priority risks (≥6): 5
- Critical categories: Data Safety (git detection), External Dependencies (OrbStack/Docker), State Management

---

## Testability Assessment

### Controllability

**Rating: HIGH** ✅

The architecture explicitly supports testability through multiple control points:

| Aspect | Assessment | Evidence |
|--------|------------|----------|
| **Dependency Injection** | Excellent | Architecture mandates DI for subprocess execution via execa wrapper in `shared/subprocess.ts` |
| **Module Boundaries** | Excellent | Clean separation: `lib/` (pure logic) → `hooks/` (state) → `components/` (UI) → `commands/` (CLI) |
| **External Process Mocking** | Good | execa `reject: false` pattern allows deterministic error simulation |
| **State Isolation** | Good | Workspace folders at `~/.agent-env/workspaces/` enable test-specific directories |
| **Configuration Control** | Good | Baseline devcontainer config is versioned with package |

**Control Seams Identified:**
1. `subprocess.ts` wrapper for git/docker/devcontainer CLI calls
2. `state.ts` for atomic file operations (tmp+rename)
3. `container.ts` for devcontainer lifecycle
4. `git.ts` for git state detection

**Testability Recommendation:** Create injectable executor interfaces from Day 1:
```typescript
interface CommandExecutor {
  exec(cmd: string, args: string[], opts?: ExecOptions): Promise<ExecResult>;
}
```

### Observability

**Rating: MEDIUM-HIGH** ⚠️

| Aspect | Assessment | Notes |
|--------|------------|-------|
| **State Files** | Observable | `.agent-env/state.json` provides explicit state snapshot |
| **JSON Output** | Observable | `--json` flag on list command returns structured output |
| **Error Codes** | Observable | Explicit error codes: `SAFETY_CHECK_FAILED`, `WORKSPACE_NOT_FOUND`, etc. |
| **Exit Codes** | Observable | Non-zero for errors, enables scripted assertions |
| **Git State** | Observable | `GitState` object captures all safety dimensions |
| **Container Status** | Partially Observable | Requires Docker/OrbStack running |

**Observation Points:**
- Workspace folder existence → instance exists
- `state.json` content → metadata correct
- `getGitState()` return → safety check accuracy
- Container name `ae-*` → runtime status
- CLI stdout/stderr → user messaging

**Gap:** No structured logging during operations. Consider adding debug mode (`--verbose`) for troubleshooting.

### Reliability

**Rating: MEDIUM** ⚠️

| Aspect | Assessment | Risk |
|--------|------------|------|
| **Atomic Writes** | Reliable | tmp+rename prevents partial state |
| **Graceful Degradation** | Designed | Invalid state.json → "unknown" fallback |
| **External Dependencies** | Risk | OrbStack/Docker availability affects all container ops |
| **Network Operations** | Risk | Clone, container pull dependent on network |
| **Timing** | Risk | Container startup, git operations have variable duration |

**Reliability Concerns:**
1. Tests requiring Docker must handle OrbStack not running
2. Network-dependent tests (clone, image pull) need offline handling
3. File system race conditions on workspace creation

---

## Architecturally Significant Requirements (ASRs)

### ASR Priority Matrix

| ID | Requirement | Probability | Impact | Score | Action |
|----|-------------|-------------|--------|-------|--------|
| ASR-1 | Zero false negatives on git safety (NFR6) | 3 (Likely - edge cases) | 3 (Critical - data loss) | **9** | **BLOCK** |
| ASR-2 | Attach < 2 seconds (NFR1) | 2 (Possible) | 2 (Degraded UX) | 4 | MONITOR |
| ASR-3 | List < 500ms for 20 instances (NFR2) | 2 (Possible - parallel ops) | 2 (Degraded UX) | 4 | MONITOR |
| ASR-4 | Create < 30s cached (NFR3) | 2 (Possible - network) | 2 (Degraded UX) | 4 | MONITOR |
| ASR-5 | Safety check < 3 seconds (NFR5) | 2 (Possible) | 2 (Degraded UX) | 4 | MONITOR |
| ASR-6 | tmux session persistence (NFR8) | 2 (Possible) | 3 (Critical - work loss) | **6** | MITIGATE |
| ASR-7 | Instance state survives restart (NFR9) | 2 (Possible) | 3 (Critical - data loss) | **6** | MITIGATE |
| ASR-8 | Partial failure isolation (NFR10) | 2 (Possible) | 2 (Degraded) | 4 | MONITOR |
| ASR-9 | Docker 20.10+ compatibility (NFR11) | 1 (Unlikely) | 3 (Critical) | 3 | DOCUMENT |
| ASR-10 | SSH agent forwarding (NFR15) | 3 (Likely - config varies) | 2 (Degraded) | **6** | MITIGATE |
| ASR-11 | Detached HEAD detection | 3 (Likely - edge case) | 3 (Critical) | **9** | **BLOCK** |
| ASR-12 | Never-pushed branch detection | 3 (Likely - common scenario) | 3 (Critical) | **9** | **BLOCK** |

### Critical Path Analysis

```
User Safety (P0) ─────────────────────────────────────────────────┐
                                                                   │
  ┌──────────────────────────────────────────────────────────────┤
  │ git.ts → getGitState()                                        │
  │   ├── Staged/Unstaged/Untracked detection                    │
  │   ├── Stash detection                                         │
  │   ├── Unpushed commits (ALL branches)                        │
  │   ├── Never-pushed branches                                   │
  │   └── Detached HEAD state                                     │
  │                                                                │
  │ Test Coverage Requirement: 100% branch coverage               │
  │ Test Matrix: 15+ git state combinations                       │
  └────────────────────────────────────────────────────────────────┘
```

---

## Test Levels Strategy

### CLI Tool Testing Pyramid

For agent-env (CLI with container orchestration), the testing pyramid is inverted compared to web apps:

```
         ╱╲
        ╱E2E╲        5% - Manual smoke tests with real containers
       ╱──────╲
      ╱ Integ. ╲     25% - Container lifecycle, git operations
     ╱──────────╲
    ╱   Unit     ╲   70% - Pure logic: git parsing, state management
   ╱──────────────╲
```

### Test Level Allocation

| Module | Level | Coverage Target | Rationale |
|--------|-------|-----------------|-----------|
| `lib/git.ts` | Unit | 100% | Critical safety logic, all branches testable with fixtures |
| `lib/workspace.ts` | Unit | 95% | File operations mockable via DI |
| `lib/state.ts` | Unit | 95% | Atomic writes, JSON parsing |
| `lib/container.ts` | Integration | 80% | Requires devcontainer CLI mocking |
| `shared/errors.ts` | Unit | 100% | Error formatting deterministic |
| `shared/subprocess.ts` | Unit | 90% | execa wrapper patterns |
| `hooks/useAgentEnv.ts` | Integration | 80% | React hook testing with ink-testing-library |
| `components/*.tsx` | Integration | 70% | Ink component rendering |
| `commands/*.ts` | Integration | 80% | CLI argument parsing, output formatting |
| **Full CLI** | E2E | Key paths | Manual: create → list → attach → remove |

### Test Type Recommendations

| Test Type | When to Use | agent-env Application |
|-----------|-------------|----------------------|
| **Unit** | Pure functions, no side effects | git state parsing, error formatting, state serialization |
| **Integration** | Component boundaries | workspace + state interaction, CLI command execution |
| **Contract** | External API stability | JSON output schema, devcontainer CLI interface |
| **E2E** | Critical user journeys | Morning standup flow, external repo contribution |

---

## NFR Testing Approach

### Security

**Risk Level:** LOW (CLI tool, no network services)

| Concern | Testing Approach | Priority |
|---------|-----------------|----------|
| Secret exposure | Audit: no secrets in state.json, no logging of SSH keys | P2 |
| Command injection | Input validation: instance names, repo URLs | P1 |
| Path traversal | Sanitize workspace paths, reject `..` | P1 |

**Tests Required:**
- Instance name validation rejects shell metacharacters
- Repo URL validation rejects malformed URLs
- Workspace path generation prevents directory escape

```typescript
// Example: Input validation test
test('rejects instance name with shell metacharacters', () => {
  expect(() => validateInstanceName('auth; rm -rf /')).toThrow('INVALID_NAME');
  expect(() => validateInstanceName('../../etc')).toThrow('INVALID_NAME');
});
```

### Performance

**Risk Level:** MEDIUM (User experience depends on responsiveness)

| NFR | Threshold | Test Approach |
|-----|-----------|---------------|
| NFR1: Attach | < 2s | Benchmark with running container |
| NFR2: List | < 500ms (20 instances) | Generate 20 test workspaces, measure |
| NFR5: Safety check | < 3s | Benchmark getGitState() on large repo |

**Performance Test Strategy:**
- Use Vitest's `bench` for micro-benchmarks
- CI gate: fail if p95 exceeds threshold
- Profile git operations for parallelization opportunities

```typescript
// Example: Performance benchmark
import { bench, describe } from 'vitest';

describe('Git State Performance', () => {
  bench('getGitState on large repo', async () => {
    await getGitState('/path/to/large/repo');
  }, { time: 5000, iterations: 10 });
});
```

### Reliability

**Risk Level:** HIGH (Data loss prevention is core value)

| NFR | Test Approach | Coverage |
|-----|---------------|----------|
| NFR6: Zero false negatives | Exhaustive git state matrix | 100% |
| NFR8: tmux persistence | Integration test with container | Manual |
| NFR9: State survives restart | Write state, restart Docker, read state | Integration |
| NFR10: Partial failure isolation | Mock one instance failing, verify others work | Integration |

**Git State Test Matrix (15 scenarios):**

| Scenario | Staged | Unstaged | Untracked | Stash | Unpushed | Never-pushed | Detached | Expected |
|----------|--------|----------|-----------|-------|----------|--------------|----------|----------|
| Clean | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | isClean=true |
| Staged only | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | hasStaged=true |
| Unstaged only | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | hasUnstaged=true |
| Untracked only | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | hasUntracked=true |
| Stash only | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | stashCount>0 |
| Unpushed current | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | unpushedBranches.length>0 |
| Unpushed other branch | ✗ | ✗ | ✗ | ✗ | ✓* | ✗ | ✗ | unpushedBranches includes other |
| Never-pushed branch | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | neverPushedBranches.length>0 |
| Detached HEAD | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | isDetachedHead=true |
| Multiple issues | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | All flags true |
| All dirty | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | All flags true |
| Empty repo | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | neverPushedBranches includes main |
| Shallow clone | ✗ | ✗ | ✗ | ✗ | ? | ? | ✗ | Graceful handling |
| Submodules dirty | ✗ | ✓* | ✗ | ✗ | ✗ | ✗ | ✗ | hasUnstaged=true |
| Merge conflict | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | hasConflict=true |

### Maintainability

**Risk Level:** LOW (Established patterns from BMAD Orchestrator)

| Aspect | Target | Validation |
|--------|--------|------------|
| Coverage | 80%+ | CI gate with coverage report |
| Duplication | <5% | jscpd in CI |
| Dependencies | Minimal | npm audit in CI |

---

## Test Environment Requirements

### Local Development

| Requirement | Purpose | Setup |
|-------------|---------|-------|
| Node.js 20+ | Runtime | nvm or direct install |
| Docker/OrbStack | Container operations | OrbStack for macOS |
| Git | Version control + test subject | System install |
| pnpm | Package management | npm install -g pnpm |

### CI Environment (GitHub Actions)

```yaml
# Required CI setup
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      docker:
        image: docker:dind
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm -r test:run
```

### Test Fixtures Required

| Fixture | Location | Purpose |
|---------|----------|---------|
| `gitStatusClean.txt` | `lib/__fixtures__/` | git status --porcelain output (clean) |
| `gitStatusDirty.txt` | `lib/__fixtures__/` | git status --porcelain output (dirty) |
| `gitBranchVV.txt` | `lib/__fixtures__/` | git branch -vv output variants |
| `gitStashList.txt` | `lib/__fixtures__/` | git stash list output |
| `stateValid.json` | `lib/__fixtures__/` | Valid state.json |
| `stateCorrupt.json` | `lib/__fixtures__/` | Corrupted state.json |
| `instanceList.json` | `lib/__fixtures__/` | List command output fixture |

### Docker Test Strategy

| Scenario | Approach |
|----------|----------|
| Unit tests | Mock subprocess, no Docker needed |
| Integration tests | Use Docker-in-Docker or pre-built test image |
| CI tests | GitHub Actions services: docker |
| Local without Docker | Skip container tests, run unit + state tests |

---

## Testability Concerns

### Critical Concerns

| Concern | Severity | Mitigation |
|---------|----------|------------|
| **OrbStack dependency** | High | Mock at subprocess level; CI uses standard Docker |
| **Container timing variability** | High | Use deterministic waits (ready check) not timeouts |
| **Git state edge cases** | Critical | Extensive fixture library, 100% branch coverage |
| **tmux session testing** | Medium | Integration test with expect-style assertions |
| **SSH agent forwarding** | Medium | Document test setup, manual verification |

### External Dependency Chain

```
agent-env CLI
     │
     ├── git CLI (installed on system)
     │     └── Test: mock via subprocess wrapper
     │
     ├── devcontainer CLI (@devcontainers/cli)
     │     └── Test: mock entire CLI, verify args
     │
     └── Docker/OrbStack
           └── Test: CI uses docker:dind service
```

### Flakiness Prevention

| Risk | Prevention |
|------|------------|
| File system timing | Atomic writes, verify file exists before read |
| Container startup race | Poll ready endpoint, not fixed sleep |
| Git operation parallelism | Independent git commands only |
| State file corruption | Validate JSON schema on read |

---

## Recommendations for Sprint 0

### Test Infrastructure (Must Have)

1. **Vitest Configuration**
   - Coverage thresholds: 80% overall, 100% for git.ts
   - Timeout: 30s for integration, 5s for unit
   - Reporter: verbose for CI, minimal for local

2. **Fixture System**
   - `lib/__fixtures__/` directory from Day 1
   - Factory functions for common test data
   - Git output fixtures for all 15 scenarios

3. **Mock Infrastructure**
   - `createMockExecutor()` helper
   - Pre-configured responses for common git commands
   - Container status mock factory

4. **CI Pipeline**
   - Run all workspace tests: `pnpm -r test:run`
   - Coverage gate: fail < 80%
   - Shared code trigger: run all tests when `packages/shared/` changes

### Test Priority for Epic 1

| Story | Test Focus | Coverage Target |
|-------|------------|-----------------|
| 1.1 pnpm workspaces | CI runs successfully | Smoke |
| 1.2 shared utilities | formatError, AppError types | 100% |
| 1.3 orchestrator migration | All existing tests pass | No regression |
| 1.4 agent-env scaffold | CLI --help, --version | 90% |
| 1.5 CI update | All packages tested | Integration |

### Test Priority for Epic 3 (git.ts - CRITICAL)

| Scenario | Priority | Test Method |
|----------|----------|-------------|
| Clean repo detection | P0 | Unit with fixture |
| Staged changes | P0 | Unit with fixture |
| Unstaged changes | P0 | Unit with fixture |
| Untracked files | P0 | Unit with fixture |
| Stash detection | P0 | Unit with fixture |
| Unpushed on current branch | P0 | Unit with fixture |
| **Unpushed on OTHER branch** | P0 | Unit with fixture |
| **Never-pushed branches** | P0 | Unit with fixture |
| **Detached HEAD** | P0 | Unit with fixture |
| Multi-branch scenarios | P0 | Unit with fixture |
| Empty repository | P1 | Unit with fixture |
| Shallow clone handling | P1 | Integration |
| Submodule detection | P2 | Integration |

### Recommended Test File Structure

```
packages/agent-env/src/
├── lib/
│   ├── __fixtures__/
│   │   ├── git/
│   │   │   ├── status-clean.txt
│   │   │   ├── status-staged.txt
│   │   │   ├── status-unstaged.txt
│   │   │   ├── status-untracked.txt
│   │   │   ├── branch-vv-tracking.txt
│   │   │   ├── branch-vv-no-upstream.txt
│   │   │   ├── stash-list-empty.txt
│   │   │   └── stash-list-items.txt
│   │   ├── state/
│   │   │   ├── valid.json
│   │   │   ├── corrupt.json
│   │   │   └── missing-fields.json
│   │   └── workspace/
│   │       └── scan-results.json
│   ├── git.ts
│   ├── git.test.ts          # 100% coverage required
│   ├── workspace.ts
│   ├── workspace.test.ts
│   ├── state.ts
│   ├── state.test.ts
│   └── container.ts
│       └── container.test.ts
```

---

## Summary

### Gate Readiness Assessment

| Category | Status | Notes |
|----------|--------|-------|
| **Controllability** | ✅ PASS | DI patterns, module boundaries well-defined |
| **Observability** | ⚠️ CONCERNS | Add --verbose flag for debug logging |
| **Test Infrastructure** | 🔲 TODO | Sprint 0 deliverable |
| **Critical Path Coverage** | 🔲 TODO | git.ts requires 100% |
| **NFR Validation** | ⚠️ CONCERNS | Performance benchmarks needed |

### Risk Summary

- **BLOCK (Score 9):** 3 risks - git safety detection (ASR-1, ASR-11, ASR-12)
- **MITIGATE (Score 6-8):** 2 risks - tmux persistence, state persistence, SSH forwarding
- **MONITOR (Score 4-5):** 5 risks - performance NFRs
- **DOCUMENT (Score 1-3):** 2 risks - Docker compatibility

### Next Steps

1. **Sprint 0:** Implement test infrastructure per recommendations
2. **Epic 1:** Migrate orchestrator with zero test regressions
3. **Epic 3:** Achieve 100% coverage on git.ts with full scenario matrix
4. **Epic 5:** Integration tests for safety prompt UI

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `_bmad/bmm/testarch/test-design`
**Version**: 4.0 (BMad v6)
