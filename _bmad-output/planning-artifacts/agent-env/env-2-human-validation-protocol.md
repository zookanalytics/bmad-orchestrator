---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - '_bmad-output/planning-artifacts/agent-env/prd.md'
  - '_bmad-output/planning-artifacts/agent-env/architecture.md'
  - '_bmad-output/planning-artifacts/agent-env/epics.md'
  - '_bmad-output/planning-artifacts/agent-env/test-design-system.md'
  - '_bmad-output/implementation-artifacts/epic-env-1-retro-2026-01-28.md'
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Epic env-2 human validation protocol'
research_goals: 'Define features requiring manual host-machine testing, create checklists, timing guidance, documentation format, and go/no-go criteria'
user_name: 'Node'
date: '2026-01-30'
web_research_enabled: true
source_verification: true
---

# Research Report: Technical

**Date:** 2026-01-30
**Author:** Node
**Research Type:** Technical

---

## Research Overview

This document defines the human validation protocol for Epic env-2 (Instance Creation & Baseline Environment). Epic env-2 has a unique constraint: it creates and manages Docker containers, but development occurs inside a devcontainer where Docker and devcontainer CLI are unavailable. This makes automated E2E testing impossible for the core value proposition — the manual tests defined here validate what automated tests structurally cannot.

**Scope:** 12 manual test cases covering 11 FRs (FR1-4, FR27-33) and 3 NFRs (NFR3, NFR4, NFR8). Tests are organized by priority (P0 blocking, P1 blocking, P2 advisory) with a 5-gate go/no-go decision framework.

**Key deliverables:**
- Technology stack analysis identifying 7 untestable integration seams
- Integration patterns mapping for all external dependencies
- Architectural patterns including adapted testing pyramid and IQ/OQ/PQ validation model
- 12 executable manual test checklists (HV-001 through HV-012)
- Test results documentation templates (per-test, per-story, per-epic)
- FR traceability matrix
- Go/no-go criteria with 9 blocking and 5 advisory criteria

---

## Technical Research Scope Confirmation

**Research Topic:** Epic env-2 human validation protocol
**Research Goals:** Define features requiring manual host-machine testing, create checklists, timing guidance, documentation format, and go/no-go criteria

**Technical Research Scope:**

- Features requiring manual validation — which FRs/NFRs cannot be verified via automated tests inside a devcontainer
- Manual test checklists — step-by-step procedures with expected results per feature
- Development cycle timing — when in story execution manual tests should occur
- Results documentation format — how to record manual test outcomes
- Go/no-go criteria — what must pass for Epic env-2 completion

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-01-30

## Technology Stack Analysis

### Core Technologies Requiring Human Validation

Epic env-2 operates at the intersection of several technologies where automated testing hits fundamental boundaries. The development environment (inside a devcontainer) cannot access the host-level tools it needs to validate.

| Technology | Role in Epic env-2 | Automated Testing Feasibility |
|------------|--------------------|-----------------------------|
| `@devcontainers/cli` | Container lifecycle (`devcontainer up`) | **Cannot automate** — requires Docker daemon |
| OrbStack | Container runtime (macOS) | **Cannot automate** — host-only, macOS-only |
| Docker Engine | Container operations | **Cannot automate** — not available inside dev container |
| SSH Agent Forwarding | Host SSH keys in container | **Cannot automate** — requires real host socket |
| Git Signing (GPG/SSH) | Signed commits in container | **Cannot automate** — requires real keys + agent |
| tmux | Persistent sessions | **Cannot automate** — requires real container attach |
| Claude Code CLI | AI-ready environment | **Cannot automate** — requires real auth mount |

### Devcontainer CLI (`@devcontainers/cli`)

The devcontainer CLI is the reference implementation for the [Dev Container Specification](https://containers.dev/overview). It provides `devcontainer up` for starting containers and `devcontainer exec` for running commands inside them.

**Testing limitation:** The CLI requires a running Docker daemon. When developing inside a devcontainer (as agent-env development does), there is no Docker daemon accessible for running nested containers without Docker-in-Docker (DinD). Even with DinD, testing real devcontainer creation from within a devcontainer introduces significant complexity and flakiness.

_Source: [devcontainers/cli GitHub](https://github.com/devcontainers/cli), [Dev Container CLI docs](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli)_

### OrbStack (macOS Container Runtime)

OrbStack provides a Docker-compatible runtime for macOS with predictable `*.orb.local` domains per container. The architecture mandates OrbStack for the MVP.

**Testing limitation:** OrbStack is macOS-only and runs on the host machine. It cannot be installed or tested inside a Linux devcontainer. Container naming (`ae-<workspace-name>`), domain resolution (`ae-*.orb.local`), and OrbStack availability detection all require real host access.

_Source: [OrbStack Docker docs](https://docs.orbstack.dev/docker/)_

### SSH Agent Forwarding

SSH agent forwarding into containers uses the socket mount pattern: `/run/host-services/ssh-auth.sock`. OrbStack added Docker Desktop compatibility for this path. Known issues exist with 1Password SSH agents and `.ssh/config` overrides (`IdentityAgent none` under wildcard `Host *` blocks forwarding).

**Testing limitation:** Validating SSH agent forwarding requires a real host SSH agent with real keys. The test `ssh -T git@github.com` must succeed with the user's actual GitHub credentials. This cannot be simulated.

_Source: [OrbStack SSH agent issue #741](https://github.com/orbstack/orbstack/issues/741), [OrbStack SSH agent issue #1327](https://github.com/orbstack/orbstack/issues/1327), [KiteMetric SSH devcontainer guide](https://kitemetric.com/blogs/seamless-git-access-within-devcontainers-using-ssh)_

### Git Commit Signing

Git signing in devcontainers requires either GPG key forwarding or SSH-based signing with agent forwarding. The `[gpg "ssh"]` section in `.gitconfig` often needs modification for devcontainers since the host binary path is unavailable inside containers. A known long-standing issue exists with GPG signing in VS Code dev containers.

**Testing limitation:** Validating that `git commit -S` produces a verified signature requires real keys (GPG or SSH) available via the agent. Cannot be simulated in automated tests.

_Source: [Ken Muse - SSH Signing with Dotfiles](https://www.kenmuse.com/blog/automatic-ssh-commit-signing-with-dotfiles/), [VS Code Sharing Git Credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials), [GPG Sign in DevContainer Issue #8826](https://github.com/microsoft/vscode-remote-release/issues/8826)_

### Claude Code CLI Authentication

Claude Code stores authentication in `~/.claude`. The recommended approach is bind-mounting this directory from host to container. Refresh tokens eventually expire, requiring re-authentication.

**Testing limitation:** Verifying Claude Code is "authenticated and ready" (FR28) requires real Anthropic credentials mounted from the host. A test script can check token presence but cannot verify the token is valid without making an API call.

_Source: [Claude Code Devcontainer Docs](https://code.claude.com/docs/en/devcontainer), [Claude Code auth issue #1736](https://github.com/anthropics/claude-code/issues/1736), [Claude Code in Devcontainers (solberg.is)](https://www.solberg.is/claude-devcontainer)_

### tmux Session Persistence

tmux provides persistent terminal sessions that survive attach/detach cycles. A devcontainer feature exists for installing tmux. The `tmux-test` framework provides isolated plugin testing but requires Vagrant or CI with real terminal access.

**Testing limitation:** Verifying tmux persistence across attach/detach (NFR8) requires a real running container with tmux. You must attach, run commands, detach, re-attach, and verify the session state persisted. This is inherently a manual workflow.

_Source: [tmux-test framework](https://github.com/tmux-plugins/tmux-test), [tmux-devcontainers plugin](https://github.com/phil/tmux-devcontainers)_

### Development Tools and CI/CD Integration

The project uses Vitest for testing, pnpm workspaces for monorepo management, and GitHub Actions for CI. The `devcontainers/ci` GitHub Action enables running dev containers in CI builds for environment parity.

**Testing approach:** Unit tests mock all external dependencies via the `createExecutor()` DI pattern. Integration tests requiring Docker use GitHub Actions services (`docker:dind`). Manual validation supplements where CI cannot reach.

_Source: [Testcontainers CI/CD patterns](https://changjoon-baek.medium.com/testcontainers-in-ci-cd-pipelines-strategies-for-running-containers-within-containers-2bdd7143b44e), [Docker Testcontainers best practices](https://www.docker.com/blog/testcontainers-best-practices/)_

### Technology Adoption and Testing Boundary Summary

The fundamental constraint is: **agent-env creates and manages containers, but is developed inside a container**. This creates an untestable gap for all host-level operations. The architecture's DI pattern (`createExecutor()`) handles this well for unit tests via mocking, but functional validation of the actual container creation experience requires human testing on a real host machine.

| Test Boundary | Automated (Unit/CI) | Manual (Host Machine) |
|--------------|---------------------|----------------------|
| Workspace folder creation | Yes (file system ops) | No |
| State file read/write | Yes (atomic writes) | No |
| CLI argument parsing | Yes (Commander tests) | No |
| Git state detection | Yes (fixture-based) | No |
| Devcontainer config generation | Yes (file content) | No |
| Container actually starts | No | **Yes** |
| SSH agent works in container | No | **Yes** |
| Git signing works in container | No | **Yes** |
| Claude Code auth works | No | **Yes** |
| tmux persists across detach | No | **Yes** |
| Performance NFRs (real timing) | Partial (CI benchmarks) | **Yes** |
| Rollback on failure | Partial (mock) | **Yes** |

## Integration Patterns Analysis

This section maps the integration seams between agent-env and its external dependencies. Each seam defines a boundary where automated tests stop and human validation begins.

### Integration Seam 1: agent-env CLI → devcontainer CLI

**Interface:** `devcontainer up --workspace-folder <path>` via execa subprocess

**Programmatic Contract:**
- Output: JSON on last line of stdout with `{ outcome: "success" | "error", containerId?, remoteUser?, remoteWorkspaceFolder?, message?, description? }`
- Exit codes: `0` (success), `1` (failure)
- Log format: `--log-format=json` provides structured log lines with `{ type, level, timestamp, text }`
- Known issue: Some error messages emit as plain text even with `--log-format=json`

**What automated tests validate:**
- Correct argument construction (workspace path, container name `ae-<name>`)
- JSON output parsing logic (success/error handling)
- Exit code interpretation
- Error code mapping to `CONTAINER_ERROR`

**What requires human validation:**
- Container actually starts and becomes reachable
- Devcontainer features install correctly
- Lifecycle scripts (`postCreateCommand`, etc.) execute
- Container naming convention produces correct OrbStack domain (`ae-*.orb.local`)

_Source: [devcontainers/cli GitHub](https://github.com/devcontainers/cli), [VS Code devcontainer CLI docs](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli), [DeepWiki CLI Commands](https://deepwiki.com/devcontainers/devcontainers.github.io/6.1-cli-commands-and-options)_

### Integration Seam 2: agent-env → Docker/OrbStack Runtime

**Interface:** `docker inspect`, `docker ps`, OrbStack availability detection via execa

**Programmatic Contract:**
- `docker inspect` returns JSON with `State.Status` (running/stopped/exited) and `State.Health` (starting/healthy/unhealthy)
- Health check states: `starting` → `healthy` | `unhealthy`
- `docker ps --filter name=ae-*` lists matching containers

**What automated tests validate:**
- Docker inspect JSON parsing
- Container status enum mapping (running/stopped/not found)
- OrbStack detection logic (mock responses)
- Error handling for Docker unavailable

**What requires human validation:**
- OrbStack is running and responsive
- Container naming (`ae-<workspace-name>`) matches OrbStack domain resolution
- `docker inspect` returns expected health status for a real running container
- Container persists across OrbStack restarts

_Source: [Docker Health Check guide](https://dev.to/idsulik/a-beginners-guide-to-docker-health-checks-and-container-monitoring-3kh6), [Docker Compose health checks](https://last9.io/blog/docker-compose-health-checks/)_

### Integration Seam 3: agent-env → Git Clone (Subprocess)

**Interface:** `git clone <url> <workspace-path>` via execa with `reject: false`

**What automated tests validate:**
- URL validation and sanitization (command injection prevention)
- Clone argument construction (HTTPS vs SSH URLs)
- Error handling for invalid URLs, no access
- Rollback logic when clone fails (workspace cleanup)

**What requires human validation:**
- Real HTTPS clone succeeds with valid URL
- Real SSH clone succeeds with forwarded agent
- Clone into correct workspace subfolder
- `.git` directory structure is valid after clone

### Integration Seam 4: Host SSH Agent → Container

**Interface:** Socket mount `/run/host-services/ssh-auth.sock` + `SSH_AUTH_SOCK` env var

**Known Issues (from web research):**
- 1Password SSH agent has known failures with OrbStack ([Issue #185](https://github.com/orbstack/orbstack/issues/185))
- `.ssh/config` with `Host * IdentityAgent none` breaks forwarding ([Issue #1327](https://github.com/orbstack/orbstack/issues/1327))
- OrbStack added Docker Desktop socket path compatibility

**What automated tests validate:**
- devcontainer.json mount configuration is correct (file content test)
- `SSH_AUTH_SOCK` env var is set in container config

**What requires human validation:**
- `ssh-add -l` lists keys inside container
- `ssh -T git@github.com` authenticates successfully
- SSH clone works from inside container
- Agent forwarding works with user's specific SSH setup (1Password, macOS keychain, etc.)

_Source: [OrbStack SSH forwarding issue #741](https://github.com/orbstack/orbstack/issues/741), [OrbStack discussion #1890](https://github.com/orgs/orbstack/discussions/1890), [KiteMetric SSH guide](https://kitemetric.com/blogs/seamless-git-access-within-devcontainers-using-ssh)_

### Integration Seam 5: Host Git Signing → Container

**Interface:** `.gitconfig` with `commit.gpgsign=true` + `gpg.format=ssh` + SSH agent

**Known Issues (from web research):**
- `[gpg "ssh"]` section in `.gitconfig` references host binary paths unavailable in container ([Issue #8826](https://github.com/microsoft/vscode-remote-release/issues/8826))
- GPG signing has long-standing issues in devcontainers ([Issue #72](https://github.com/microsoft/vscode-remote-release/issues/72))
- SSH-based signing works better but requires agent forwarding

**What automated tests validate:**
- `.gitconfig` template has correct signing configuration
- Signing config references container-local paths (not host paths)

**What requires human validation:**
- `git commit -S -m "test"` succeeds without errors
- `git log --show-signature` shows verified signature
- Signing works with user's specific key type (GPG vs SSH)

_Source: [Ken Muse - SSH Signing](https://www.kenmuse.com/blog/automatic-ssh-commit-signing-with-dotfiles/), [VS Code Sharing Git Credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)_

### Integration Seam 6: Host Claude Auth → Container

**Interface:** Bind mount `~/.claude:/home/node/.claude:ro`

**What automated tests validate:**
- devcontainer.json mount configuration is present and correct
- Mount uses `:ro` (read-only) flag

**What requires human validation:**
- Claude Code CLI starts without re-authentication prompt
- `claude --version` works inside container
- Claude can make API calls (basic prompt test)
- Auth token refresh works across container restarts

_Source: [Claude Code devcontainer docs](https://code.claude.com/docs/en/devcontainer), [Claude Code auth issue #1736](https://github.com/anthropics/claude-code/issues/1736), [Using Claude Code Safely with Dev Containers](https://nakamasato.medium.com/using-claude-code-safely-with-dev-containers-b46b8fedbca9)_

### Integration Seam 7: tmux Session → Container Lifecycle

**Interface:** tmux server inside container, `tmux new-session -A -s <name>`

**What automated tests validate:**
- tmux install configuration in Dockerfile/devcontainer features
- tmux auto-start script content

**What requires human validation:**
- tmux session starts on container boot
- Attaching creates/joins session
- Detaching preserves session state
- Re-attaching shows previous commands/output
- Session survives container stop/start cycle

_Source: [tmux-test framework](https://github.com/tmux-plugins/tmux-test), [tmux devcontainer feature](https://github.com/users/duduribeiro/packages/container/package/devcontainer-features/tmux)_

### DI Pattern: The Automated/Manual Boundary

The `createExecutor()` dependency injection pattern from `@zookanalytics/shared` defines the exact boundary between automated and manual testing:

```
┌─────────────────────────────────────────┐
│  Automated Tests (Unit/Integration)      │
│                                          │
│  createExecutor() → MockExecutor         │
│  Returns fixture data for:               │
│  - devcontainer up output                │
│  - docker inspect output                 │
│  - git clone output                      │
│  - git status output                     │
│                                          │
│  Validates: argument construction,       │
│  output parsing, error handling,         │
│  state management, rollback logic        │
├──────────────────────────────────────────┤
│  Manual Tests (Host Machine)             │
│                                          │
│  createExecutor() → RealExecutor (execa) │
│  Executes actual commands against:       │
│  - Real Docker/OrbStack daemon           │
│  - Real git repositories                 │
│  - Real SSH agent                        │
│  - Real devcontainer CLI                 │
│                                          │
│  Validates: end-to-end functionality,    │
│  environment configuration, performance  │
└──────────────────────────────────────────┘
```

This clean DI boundary means automated tests cover logic correctness (argument construction, output parsing, error handling) while manual tests validate that the real external systems behave as expected.

_Source: [Execa guide](https://generalistprogrammer.com/tutorials/execa-npm-package-guide), [DI in TypeScript](https://dev.to/vovaspace/dependency-injection-in-typescript-4mbf), [Unit testing with DI](https://www.fanderl.rocks/unit-testing-and-dependency-injection-in-typescript.html)_

## Architectural Patterns and Design

### Validation Architecture: Adapted Testing Pyramid

The standard testing pyramid (70% unit, 25% integration, 5% E2E) from the test-design-system.md applies to agent-env, but Epic env-2 introduces a unique constraint: the top of the pyramid (E2E/manual) covers features that are **impossible** to validate at lower levels, not merely expensive.

```
         ╱╲
        ╱HV ╲       Human Validation (host machine)
       ╱──────╲      Container creation, SSH, signing, tmux, Claude auth
      ╱CI Integ╲     CI integration tests (GitHub Actions with docker:dind)
     ╱──────────╲    Container lifecycle mocks, JSON output contracts
    ╱   Unit     ╲   Pure logic: workspace mgmt, state files, CLI parsing
   ╱──────────────╲  Fixture-based: git state detection, error handling
```

**Key architectural insight:** For Epic env-2, the manual testing layer is not optional — it validates the core value proposition ("AI-ready dev environments"). Unlike typical E2E tests that confirm what unit tests already cover at higher cost, these manual tests cover functionality that **cannot exist** in automated form due to the devcontainer-inside-devcontainer constraint.

_Source: [Testing Pyramid strategies](https://testomat.io/blog/testing-pyramid-role-in-modern-software-testing-strategies/), [BrowserStack test automation pyramid](https://www.browserstack.com/guide/testing-pyramid-for-test-automation), [CircleCI testing pyramid](https://circleci.com/blog/testing-pyramid/)_

### Validation Phases: IQ/OQ/PQ Model (Adapted)

Drawing from FDA validation methodology (adapted for CLI tools), the human validation protocol follows three qualification phases:

**Installation Qualification (IQ)** — Does the environment exist correctly?
- Container created with correct name (`ae-<workspace-name>`)
- Workspace folder exists at `~/.agent-env/workspaces/<repo>-<instance>/`
- Repository cloned into workspace
- devcontainer.json and Dockerfile present
- state.json written with creation metadata

**Operational Qualification (OQ)** — Do individual features work?
- SSH agent forwarding: `ssh-add -l` lists keys
- Git signing: `git commit -S` produces signed commit
- Claude Code: starts without re-auth
- tmux: session persists across detach/re-attach
- Shell: zsh/bash properly configured

**Performance Qualification (PQ)** — Does it meet performance targets?
- Create with cached image: < 30 seconds (NFR3)
- Time-to-productive after attach: < 5 seconds (NFR4)
- End-to-end workflow: create → clone → build → commit → push

_Source: [FDA Software Validation](https://www.datacor.com/resources/fda-software-validation), [ComplianceQuest FDA guide](https://www.compliancequest.com/blog/understanding-fda-software-validation/), [FDA Part 11 checklist](https://fdainspections.com/part-11-software-validation-checklist/)_

### Quality Gate Architecture: Go/No-Go Decision Framework

The go/no-go decision follows a weighted gate model. Each validation area has a criticality level that determines whether it blocks release.

**Gate Structure:**

| Gate | Scope | Decision |
|------|-------|----------|
| Gate 1: Automated | Unit + integration tests pass in CI | Auto: pass/fail |
| Gate 2: Smoke | Basic `agent-env create` works on host | Manual: pass/fail |
| Gate 3: Feature | All FR validations pass on host | Manual: pass/fail with exceptions |
| Gate 4: Performance | NFR timing targets met | Manual: pass/advisory |
| Gate 5: Edge Cases | Error handling, rollback, edge scenarios | Manual: pass/fail |

**Blocking vs. Advisory:**
- **Blocking** (must pass): Container creation, SSH agent, git operations, Claude Code auth
- **Advisory** (inform but don't block): Performance targets, tmux persistence, shell config nuances

This approach avoids the "all-or-nothing" trap where minor issues block major functionality validation.

_Source: [Quality Gates and Go/No-Go Decisions](https://developers-heaven.net/blog/quality-gates-and-go-no-go-decisions-in-software-releases/), [PMI Go/No-Go Readiness Checklist](https://www.projectmanagement.com/checklists/777059/go-no-go-production-readiness-checklist), [Institute of Project Management Go/No-Go](https://instituteprojectmanagement.com/blog/go-no-go-production-readiness-checklist/)_

### Smoke Test Architecture for CLI Tools

For agent-env, smoke testing follows the principle: "validate the most critical application path, keeping execution time and complexity to a minimum." The critical path is:

```
agent-env create auth --repo <url>
  → git clone
  → devcontainer.json composition
  → devcontainer up
  → state.json write
  → Container running with:
      ✓ SSH agent forwarded
      ✓ Git signing configured
      ✓ Claude Code authenticated
      ✓ tmux running
```

If this single path succeeds, the core value proposition is validated. Variants (`--repo .`, `--attach`, error scenarios) build on this foundation.

_Source: [Smoke Testing guide (Semaphore)](https://semaphore.io/community/tutorials/smoke-testing), [Microsoft Engineering Playbook - Smoke Testing](https://microsoft.github.io/code-with-engineering-playbook/automated-testing/smoke-testing/), [Smoke Testing (Wikipedia)](https://en.wikipedia.org/wiki/Smoke_testing_(software))_

### Timing Architecture: When Manual Tests Occur

Manual validation must occur at specific points in the development cycle, not as an afterthought:

```
Story Development Flow:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ TEA ATDD │ →  │ Dev      │ →  │ Verify   │ →  │ Code     │ →  │ Manual   │
│ (tests)  │    │ Story    │    │ Complete │    │ Review   │    │ Validate │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                      │
                                                                      ▼
Epic Completion Flow:                                          ┌──────────┐
┌──────────┐    ┌──────────┐    ┌──────────┐                  │ Go/No-Go │
│ All      │ →  │ Full     │ →  │ Perf     │ ───────────────→ │ Decision │
│ Stories  │    │ Smoke    │    │ Targets  │                  └──────────┘
│ Complete │    │ Test     │    │ Check    │
└──────────┘    └──────────┘    └──────────┘
```

**Per-Story validation** (lightweight): After code review passes, run the specific feature on a host machine.
**Per-Epic validation** (comprehensive): After all stories complete, run the full smoke test and performance checks.

_Source: [BrowserStack Software Release Checklist](https://www.browserstack.com/guide/questions-to-ask-before-software-release), [CodePushGo Deployment Checklist](https://codepushgo.com/blog/software-deployment-checklist/)_

## Implementation: Manual Test Checklists

This section provides the concrete, executable test checklists for human validation of Epic env-2. Each test case follows a consistent format: ID, prerequisites, steps, expected results, and pass/fail criteria.

_Format adapted from: [Monday.com test case templates](https://monday.com/blog/rnd/test-case-template/), [BrowserStack test case templates](https://www.browserstack.com/guide/test-case-templates), [Katalon test case templates](https://katalon.com/resources-center/blog/test-case-template-examples)_

### Prerequisites for All Manual Tests

Before running any manual test:

1. **Host machine:** macOS with OrbStack installed and running
2. **SSH agent:** Running with at least one key loaded (`ssh-add -l` shows keys)
3. **Git signing:** Configured on host (GPG or SSH)
4. **Claude Code:** Authenticated on host (`~/.claude/` contains valid credentials)
5. **Network:** Internet access for git clone and image pull
6. **agent-env:** Built and available (`pnpm -r build` from monorepo root)
7. **Test repo:** A known git repository URL for clone tests (e.g., a small test repo)

---

### HV-001: Basic Instance Creation

**Story:** 2.4 (Create command basic)
**Priority:** P0 — BLOCKING
**FRs validated:** FR1, FR33

**Prerequisites:** All general prerequisites met. No existing instance with test name.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `agent-env create test-auth --repo https://github.com/<user>/<repo>` | Command starts, shows progress output |
| 2 | Wait for completion | Command exits with code 0 |
| 3 | Check `ls ~/.agent-env/workspaces/` | Folder `<repo>-test-auth/` exists |
| 4 | Check `cat ~/.agent-env/workspaces/<repo>-test-auth/.agent-env/state.json` | Valid JSON with `createdAt` timestamp |
| 5 | Check `docker ps --filter name=ae-` | Container `ae-<repo>-test-auth` is running |
| 6 | Check workspace contents | Cloned repo files present in workspace folder |

**Pass criteria:** All steps produce expected results. Container running, state file valid, repo cloned.
**Fail criteria:** Any step fails or command exits non-zero.

---

### HV-002: SSH Agent Forwarding in Container

**Story:** 2.2 (Baseline devcontainer)
**Priority:** P0 — BLOCKING
**FRs validated:** FR30

**Prerequisites:** HV-001 passed (running instance exists).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attach to container: `docker exec -it ae-<workspace> bash` | Shell opens inside container |
| 2 | Run `ssh-add -l` | Lists at least one SSH key (matches host keys) |
| 3 | Run `ssh -T git@github.com` | Output: "Hi <username>! You've successfully authenticated" |
| 4 | Run `git clone git@github.com:<user>/<private-repo> /tmp/ssh-test` | Clone succeeds via SSH |

**Pass criteria:** SSH agent forwarded, keys visible, GitHub authenticates, SSH clone works.
**Fail criteria:** `ssh-add -l` shows no keys, SSH authentication fails, or clone fails.

**Known issues to check:**
- If using 1Password SSH agent, verify OrbStack compatibility
- If `~/.ssh/config` has `Host * IdentityAgent none`, forwarding will fail

---

### HV-003: Git Signing in Container

**Story:** 2.2 (Baseline devcontainer)
**Priority:** P0 — BLOCKING
**FRs validated:** FR29

**Prerequisites:** HV-001 passed. Inside the container shell.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inside container, navigate to cloned repo | `cd /workspaces/<repo>` |
| 2 | Create a test file | `echo "test" > signing-test.txt` |
| 3 | Stage and commit with signing | `git add signing-test.txt && git commit -S -m "test: signing validation"` |
| 4 | Verify signature | `git log --show-signature -1` |
| 5 | Check commit is signed | Output shows "Good signature" or "Signature made" |

**Pass criteria:** Signed commit created without error, signature verifiable.
**Fail criteria:** `git commit -S` fails with GPG/SSH error, or signature not verifiable.

**Notes:** If using SSH signing, ensure `gpg.format=ssh` is set. If using GPG, verify `gpg-agent` is forwarded.

---

### HV-004: Claude Code Authentication in Container

**Story:** 2.2 (Baseline devcontainer)
**Priority:** P0 — BLOCKING
**FRs validated:** FR28

**Prerequisites:** HV-001 passed. Inside the container shell.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inside container, run `claude --version` | Version number displayed (no error) |
| 2 | Run `claude --print-system-prompt 2>/dev/null \| head -5` or equivalent non-interactive check | Output returned (not auth error) |
| 3 | Verify `~/.claude/` exists inside container | Directory present with credential files |
| 4 | Verify mount is read-only | `touch ~/.claude/test-write 2>&1` should fail with "Read-only file system" |

**Pass criteria:** Claude Code runs without re-authentication prompt, credentials mounted read-only.
**Fail criteria:** Claude prompts for login, credentials missing, or mount is writable.

---

### HV-005: tmux Session Persistence

**Story:** 2.2 (Baseline devcontainer)
**Priority:** P1 — ADVISORY
**FRs validated:** FR31, NFR8

**Prerequisites:** HV-001 passed.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Attach to container via tmux: `docker exec -it ae-<workspace> tmux attach` or `agent-env attach <name>` | tmux session opens |
| 2 | Run a command in tmux | `echo "PERSISTENCE_TEST"` |
| 3 | Detach from tmux | `Ctrl-b d` |
| 4 | Re-attach to same tmux session | Same command as step 1 |
| 5 | Check session state | Previous `PERSISTENCE_TEST` output visible in scrollback |
| 6 | Verify session name | `tmux list-sessions` shows expected session |

**Pass criteria:** tmux session persists across detach/re-attach, scrollback preserved.
**Fail criteria:** New session created on re-attach, or previous output lost.

---

### HV-006: Shell Configuration

**Story:** 2.2 (Baseline devcontainer)
**Priority:** P2 — ADVISORY
**FRs validated:** FR32

**Prerequisites:** HV-001 passed. Inside the container.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Check shell type | `echo $SHELL` shows `/bin/zsh` or `/bin/bash` |
| 2 | Check prompt | Shell prompt is functional (not broken escape sequences) |
| 3 | Test tab completion | Type partial command + Tab | Completion works |
| 4 | Check basic tools | `git --version`, `node --version`, `pnpm --version` | All return versions |

**Pass criteria:** Shell is usable with expected tools available.
**Fail criteria:** Shell is broken, tools missing, or prompt non-functional.

---

### HV-007: Create from Current Directory (`--repo .`)

**Story:** 2.5 (Create variants)
**Priority:** P1 — BLOCKING
**FRs validated:** FR3

**Prerequisites:** General prerequisites. Terminal CWD is inside a git repo with a remote.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to a git repo directory | `cd /path/to/existing/repo` |
| 2 | Run `agent-env create dot-test --repo .` | Command infers remote URL from current directory |
| 3 | Verify workspace created | `ls ~/.agent-env/workspaces/` shows `<repo>-dot-test/` |
| 4 | Verify repo cloned | Workspace contains cloned files from the inferred remote |

**Pass criteria:** Remote inferred correctly, workspace created with cloned repo.
**Fail criteria:** Remote inference fails, wrong repo cloned, or error on `--repo .`.

---

### HV-008: Create with Immediate Attach (`--attach`)

**Story:** 2.5 (Create variants)
**Priority:** P1 — BLOCKING
**FRs validated:** FR4

**Prerequisites:** General prerequisites. No existing instance with test name.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `agent-env create attach-test --repo <url> --attach` | Create starts, then automatically attaches |
| 2 | Verify you're inside the container | `hostname` shows container name, or `cat /etc/hostname` |
| 3 | Verify tmux session | `tmux list-sessions` shows active session |
| 4 | Detach | `Ctrl-b d` returns to host |

**Pass criteria:** Single command creates instance and drops user into container tmux session.
**Fail criteria:** Create succeeds but doesn't attach, or attach fails after create.

---

### HV-009: Error Handling — Duplicate Instance

**Story:** 2.4 (Create command basic)
**Priority:** P1 — BLOCKING
**FRs validated:** FR1 (error path)

**Prerequisites:** HV-001 passed (instance `test-auth` exists).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Run `agent-env create test-auth --repo <same-url>` | Error: "Instance 'test-auth' already exists" |
| 2 | Verify exit code | Non-zero exit code |
| 3 | Verify no side effects | Original instance untouched, no partial workspace created |

**Pass criteria:** Clear error message, non-zero exit, no side effects.
**Fail criteria:** Overwrites existing instance, unclear error, or zero exit code on failure.

---

### HV-010: Error Handling — Rollback on Container Failure

**Story:** 2.4 (Create command basic)
**Priority:** P1 — BLOCKING
**FRs validated:** FR1 (rollback path)

**Prerequisites:** General prerequisites. Simulate failure by providing valid repo but invalid devcontainer config (or stop OrbStack before container step).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Cause container startup failure (e.g., stop OrbStack, or use broken Dockerfile) | Create command fails during `devcontainer up` |
| 2 | Check error message | Clear error with code `CONTAINER_ERROR` or `ORBSTACK_REQUIRED` |
| 3 | Check `ls ~/.agent-env/workspaces/` | Workspace folder cleaned up (rolled back) |
| 4 | Check `docker ps --filter name=ae-` | No orphaned container |

**Pass criteria:** Clean rollback — no partial workspace, no orphaned container, clear error.
**Fail criteria:** Partial workspace left behind, orphaned container, or unclear error.

---

### HV-011: Performance — Create Time (Cached Image)

**Story:** 2.2 (Baseline devcontainer)
**Priority:** P2 — ADVISORY
**NFRs validated:** NFR3

**Prerequisites:** Base image already pulled locally (`docker images` shows it). No existing instance with test name.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start timer | Note start time |
| 2 | Run `agent-env create perf-test --repo <url>` | Create executes |
| 3 | Stop timer when command completes | Note end time |
| 4 | Calculate duration | Should be < 30 seconds |

**Pass criteria:** Create with cached image completes in < 30 seconds.
**Advisory note:** If 30-45 seconds, note as concern. If > 45 seconds, flag as issue.

---

### HV-012: Performance — Time to Productive

**Story:** 2.2 (Baseline devcontainer)
**Priority:** P2 — ADVISORY
**NFRs validated:** NFR4

**Prerequisites:** Running instance exists (from HV-001 or HV-011).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start timer | Note start time |
| 2 | Attach to instance | `agent-env attach <name>` or `docker exec -it ae-<name> bash` |
| 3 | Run first command | `node --version` |
| 4 | Stop timer when output appears | Note end time |
| 5 | Calculate duration | Should be < 5 seconds |

**Pass criteria:** First command executes within 5 seconds of attach.
**Advisory note:** If 5-10 seconds, note as concern. If > 10 seconds, flag as issue.

---

## Implementation: Test Results Documentation Format

### Per-Test Result Record

Each manual test execution should be documented in the following format:

```markdown
### HV-XXX: [Test Name]

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:**
- macOS version: [e.g., 15.x Tahoe]
- OrbStack version: [e.g., 1.x.x]
- Node.js version: [e.g., 20.x.x]
- agent-env version: [e.g., 0.1.0]

**Result:** PASS | FAIL | BLOCKED | SKIP

**Steps Executed:**
- [x] Step 1: [actual observation]
- [x] Step 2: [actual observation]
- [ ] Step 3: [blocked/failed — reason]

**Notes:** [Any deviations, observations, or issues encountered]

**Defect:** [If FAIL, link to issue or describe defect]
```

### Per-Story Validation Summary

After all tests for a story are executed:

```markdown
## Story 2.X Validation Summary

**Date:** YYYY-MM-DD
**Tester:** [Name]

| Test ID | Test Name | Result | Notes |
|---------|-----------|--------|-------|
| HV-001 | Basic Instance Creation | PASS | |
| HV-002 | SSH Agent Forwarding | PASS | 1Password agent used |
| HV-003 | Git Signing | FAIL | GPG agent not forwarded |

**Story Status:** PASS / PARTIAL / FAIL
**Blocking Issues:** [List any blocking failures]
**Advisory Issues:** [List any non-blocking concerns]
```

### Epic Validation Report

At epic completion, produce a single summary:

```markdown
# Epic env-2 Human Validation Report

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** [Full environment details]

## Gate Results

| Gate | Scope | Result |
|------|-------|--------|
| Gate 1: Automated | CI tests | PASS (XX/XX tests) |
| Gate 2: Smoke | Basic create | PASS / FAIL |
| Gate 3: Feature | All FRs | PASS / PARTIAL / FAIL |
| Gate 4: Performance | NFR timing | PASS / ADVISORY |
| Gate 5: Edge Cases | Error handling | PASS / FAIL |

## Test Results Summary

| Test ID | Name | Priority | Result |
|---------|------|----------|--------|
| HV-001 | Basic Instance Creation | P0 | PASS/FAIL |
| HV-002 | SSH Agent Forwarding | P0 | PASS/FAIL |
| ... | ... | ... | ... |

## FR Traceability Matrix

| FR | Description | Test IDs | Status |
|----|-------------|----------|--------|
| FR1 | Create with name | HV-001, HV-009 | Validated |
| FR2 | Create from repo URL | HV-001 | Validated |
| FR3 | Create from current dir | HV-007 | Validated |
| FR4 | Create and attach | HV-008 | Validated |
| FR27 | Baseline devcontainer | HV-001 | Validated |
| FR28 | Claude Code ready | HV-004 | Validated |
| FR29 | Git signing | HV-003 | Validated |
| FR30 | SSH agent forwarded | HV-002 | Validated |
| FR31 | tmux running | HV-005 | Validated |
| FR32 | Shell configured | HV-006 | Validated |
| FR33 | Clone repository | HV-001 | Validated |

## Go/No-Go Decision

**Decision:** GO / NO-GO / CONDITIONAL GO
**Rationale:** [Summary of gate results and blocking issues]
**Conditions (if conditional):** [What must be resolved before release]
```

_Format adapted from: [TestGrid test case templates](https://testgrid.io/blog/test-case-template/), [Perforce RTM guide](https://www.perforce.com/blog/alm/how-create-traceability-matrix), [SoftwareTestingHelp RTM](https://www.softwaretestinghelp.com/requirements-traceability-matrix/)_

---

## Implementation: Go/No-Go Criteria

### Blocking Criteria (Must ALL Pass for GO)

| # | Criterion | Tests | Rationale |
|---|-----------|-------|-----------|
| B1 | All automated tests pass in CI | CI pipeline | Foundation — logic correctness |
| B2 | Basic instance creation works | HV-001 | Core value proposition |
| B3 | SSH agent forwarding works | HV-002 | Required for git operations |
| B4 | Git signing works | HV-003 | Required by project conventions |
| B5 | Claude Code authenticates | HV-004 | "AI-ready" promise |
| B6 | Create from repo URL works | HV-001 | Primary use case |
| B7 | Create from current dir works | HV-007 | Secondary use case |
| B8 | Duplicate instance rejected | HV-009 | Data safety |
| B9 | Rollback on failure works | HV-010 | No orphaned state |

**If ANY blocking criterion fails: NO-GO.** Fix the issue and re-validate.

### Advisory Criteria (Inform Decision, Don't Block)

| # | Criterion | Tests | Impact if Failed |
|---|-----------|-------|-----------------|
| A1 | tmux session persists | HV-005 | Degraded UX, workaround exists |
| A2 | Shell properly configured | HV-006 | Minor UX issue |
| A3 | Create < 30s cached | HV-011 | Performance concern, not broken |
| A4 | Time-to-productive < 5s | HV-012 | Performance concern, not broken |
| A5 | Create with `--attach` works | HV-008 | Can create then attach separately |

**If advisory criteria fail:** Document as known issues. Decision maker evaluates risk.

### Conditional GO Criteria

A **CONDITIONAL GO** may be issued when:
- All blocking criteria pass
- 1-2 advisory criteria fail with known workarounds
- Failed advisory items have issues filed and scheduled for next sprint
- No data loss or security risks exist in the failed items

### Decision Authority

| Decision | Authority | Requirements |
|----------|-----------|-------------|
| GO | Project Lead (Node) | All blocking pass, advisory documented |
| CONDITIONAL GO | Project Lead (Node) | All blocking pass, advisory failures have workarounds + issues filed |
| NO-GO | Any team member can flag | Any blocking criterion fails |

---

## Technical Research Recommendations

### Implementation Roadmap

1. **During Story 2.1 (Workspace Management):** No manual validation needed — all automated
2. **During Story 2.2 (Baseline Devcontainer):** First manual checkpoint — run HV-002 through HV-006 after code review
3. **During Story 2.3 (Container Lifecycle):** Run HV-001 (basic creation) after code review
4. **During Story 2.4 (Create Command):** Run HV-001, HV-009, HV-010 after code review
5. **During Story 2.5 (Create Variants):** Run HV-007, HV-008 after code review
6. **Epic completion:** Full validation — all HV tests, performance checks, go/no-go decision

### Test Environment Setup Checklist

Before starting Epic env-2 manual validation, prepare:

- [ ] macOS host machine with OrbStack installed
- [ ] SSH agent running with keys loaded
- [ ] Git signing configured (GPG or SSH)
- [ ] Claude Code authenticated (`~/.claude/` present)
- [ ] Test repository identified (small repo for fast clones)
- [ ] agent-env built and available on PATH
- [ ] Stopwatch/timer for performance tests
- [ ] Document template ready (copy from format above)

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SSH agent setup varies per developer | Document supported configurations (macOS keychain, 1Password, ssh-agent) |
| OrbStack version differences | Record exact OrbStack version in test results |
| Git signing method varies | Test both GPG and SSH signing paths |
| Claude Code auth expiry | Verify auth immediately before testing |
| Network dependency for clone | Use a small test repo to minimize clone time |

### Success Metrics

| Metric | Target |
|--------|--------|
| Blocking test pass rate | 100% (9/9) |
| Advisory test pass rate | >= 80% (4/5) |
| Total FR coverage | 11/11 FRs validated |
| Defects found during validation | Documented and triaged |
| Validation cycle time | Single session (not multi-day) |
