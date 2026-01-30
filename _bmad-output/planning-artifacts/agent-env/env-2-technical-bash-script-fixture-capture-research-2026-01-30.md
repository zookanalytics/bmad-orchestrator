---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - claude-instance (bash script at project root)
  - packages/shared/src/subprocess.ts
  - packages/orchestrator/src/lib/discovery.ts
  - packages/orchestrator/src/lib/__fixtures__/
workflowType: 'research'
lastStep: 3
research_type: 'technical'
research_topic: 'bash-script-fixture-capture'
research_goals: 'Analyze claude-instance bash script, capture all external command invocations, produce JSON fixtures for agent-env testing'
user_name: 'Node'
date: '2026-01-30'
web_research_enabled: true
source_verification: true
---

# Research Report: Bash Script Fixture Capture for agent-env

**Date:** 2026-01-30
**Author:** Node
**Research Type:** Technical
**Epic:** env-2 — Retro Action Item #3

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Source Script Analysis](#source-script-analysis)
3. [External Command Inventory](#external-command-inventory)
4. [Fixture Design](#fixture-design)
5. [Fixture Catalog](#fixture-catalog)
6. [Integration with createExecutor() Pattern](#integration-with-createexecutor-pattern)
7. [Recommendations](#recommendations)
8. [Sources](#sources)

---

## Executive Summary

The `claude-instance` bash script is a 1,673-line host-side tool for managing multiple Claude development instances as sibling git clones, each running in its own devcontainer. Analysis identified **14 distinct external command invocations** across 6 tool categories: `git` (5 commands), `docker` (3 commands), `devcontainer` (1 command), `jq` (4 uses), filesystem commands, and utility checks.

This document catalogs every external command, its expected inputs/outputs/exit codes, and provides ready-to-use JSON fixture definitions in the `{ command, args, stdout, stderr, exitCode }` format compatible with the `createExecutor()` DI pattern from `@zookanalytics/shared`.

**Key finding:** The bash script does NOT use `devcontainer up` — it uses `devcontainer open` (the VS Code proprietary variant). The agent-env CLI (Epic env-2) will use `devcontainer up` instead, which has well-documented JSON output. Fixtures should cover both the commands the bash script actually invokes AND the `devcontainer up` command that agent-env will use.

---

## Source Script Analysis

### Script Identity

- **File:** `claude-instance` (bash, 1,673 lines)
- **Location:** Originally at `/workspace/scripts/claude-instance` inside the base Docker image `ghcr.io/zookanalytics/claude-devcontainer:latest`
- **Purpose:** Manage multiple Claude agent instances as sibling git clones with devcontainer lifecycle management
- **Commands:** `create`, `list`, `show`, `remove`, `open`, `purpose`, `browse`, `attach`, `run`, `dashboard`, `menu`

### Architecture

The script operates in two modes:
1. **Host mode** (outside devcontainer) — manages multiple instances via git clone + docker + devcontainer CLI
2. **Local mode** (inside devcontainer, detected via `CLAUDE_INSTANCE` env var) — limited to `purpose`, `show`, `regenerate`

### Key Constants

```bash
INSTANCES_DIR="$PARENT_DIR"           # Sibling directory pattern
METADATA_FILE=".claude-metadata.json"  # Per-instance metadata
CONTAINER_PREFIX="signalloom-"         # Docker container name prefix
DASHBOARD_SESSION="signalloom-dashboard" # tmux session name
```

---

## External Command Inventory

### Category 1: Git Commands

| # | Command | Context | Function |
|---|---------|---------|----------|
| 1 | `git config --get remote.origin.url` | `cmd_create` | Get remote URL from main repo |
| 2 | `git branch --show-current` | `cmd_create`, `show_instance_status` | Get current branch name |
| 3 | `git clone <url> <path>` | `cmd_create` | Clone repo to new instance path |
| 4 | `git ls-remote --heads origin <branch>` | `cmd_create` | Check if branch exists on remote |
| 5 | `git checkout <branch>` | `cmd_create` | Switch to matching branch |
| 6 | `git diff-index --quiet HEAD --` | `cmd_remove`, `show_instance_status` | Check for uncommitted changes |
| 7 | `git diff-index --quiet --cached HEAD --` | `cmd_remove`, `show_instance_status` | Check for staged changes |
| 8 | `git ls-files --others --exclude-standard` | `cmd_remove`, `show_instance_status` | List untracked files |
| 9 | `git rev-list --count @{upstream}..HEAD` | `cmd_remove`, `show_instance_status` | Count unpushed commits |
| 10 | `git stash list` | `cmd_remove` | Check for stashed changes |
| 11 | `git update-index --refresh -q` | `cmd_remove`, `show_instance_status` | Refresh git index |

### Category 2: Docker Commands

| # | Command | Context | Function |
|---|---------|---------|----------|
| 12 | `docker ps --filter "label=dev.orbstack.domains=..." --format '{{.Names}}'` | `show_instance_status`, `get_instance_json` | Check if container is running via OrbStack label |
| 13 | `docker ps --format '{{.Names}}'` | `cmd_attach`, `cmd_run` | List running container names |
| 14 | `docker exec <container> tmux has-session -t <name>` | `cmd_dashboard_list`, `cmd_menu` | Check tmux session status |
| 15 | `docker exec -it <container> tmux new-session -A -s <name>` | `cmd_attach` | Attach to/create tmux session |
| 16 | `docker exec <container> tmux new-window ...` | `cmd_run` | Create tmux window with command |
| 17 | `docker ps --filter "name=signalloom-" --format '{{.ID}}:{{.Names}}'` | `get_running_containers` | List running Signal Loom containers |

### Category 3: Devcontainer CLI

| # | Command | Context | Function |
|---|---------|---------|----------|
| 18 | `devcontainer open <path>` | `cmd_create --open`, `cmd_open` | Open instance in VS Code devcontainer |

**Note:** This is the proprietary VS Code variant. The open-source `@devcontainers/cli` does not include `open`. For agent-env, we will use `devcontainer up` instead.

### Category 4: jq Commands

| # | Command | Context | Function |
|---|---------|---------|----------|
| 19 | `jq -n --arg ... '{...}'` | `create_metadata` | Create JSON metadata |
| 20 | `jq --arg key --arg value 'setpath(...)' <file>` | `update_metadata` | Update metadata field |
| 21 | `jq -r '.purpose // ""' <file>` | Multiple | Read purpose from metadata |
| 22 | `jq --argjson inst "$instance_json" '. + [$inst]'` | `cmd_list --json` | Build JSON array |

### Category 5: Utility Checks

| # | Command | Context | Function |
|---|---------|---------|----------|
| 23 | `command -v devcontainer` | `check_devcontainer_cli` | Check CLI availability |
| 24 | `command -v jq` | `check_jq` | Check jq availability |
| 25 | `command -v tmux` | `cmd_dashboard` | Check tmux availability |
| 26 | `command -v docker` | `cmd_dashboard`, `cmd_menu` | Check docker availability |

---

## Fixture Design

### Format Convention

Following the existing pattern in `packages/orchestrator/src/lib/__fixtures__/`, fixtures use JSON files imported with `import ... with { type: 'json' }`.

For agent-env, the fixture format aligns with the `ExecuteResult` interface from `@zookanalytics/shared/subprocess.ts`:

```typescript
interface ExecuteResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

However, the fixture files should include the **command context** (command + args) so tests can verify the mock executor was called correctly:

```typescript
interface CommandFixture {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

The `ok` field is derived at runtime: `ok = !failed` (from execa), which maps to `exitCode === 0` in simple cases.

### Directory Structure

```
packages/agent-env/src/lib/__fixtures__/
  git/
    git-config-remote-url.json
    git-branch-current.json
    git-clone-success.json
    git-clone-failure.json
    git-ls-remote-heads.json
    git-diff-index-clean.json
    git-diff-index-dirty.json
    git-ls-files-untracked.json
    git-rev-list-unpushed.json
  docker/
    docker-ps-by-label.json
    docker-ps-by-label-empty.json
    docker-ps-names.json
    docker-ps-names-empty.json
    docker-ps-running-containers.json
    docker-ps-running-containers-empty.json
    docker-exec-tmux-has-session.json
    docker-exec-tmux-no-session.json
  devcontainer/
    devcontainer-up-success.json
    devcontainer-up-failure.json
    devcontainer-up-build-error.json
    devcontainer-cli-not-found.json
  metadata/
    claude-metadata-with-purpose.json
    claude-metadata-empty-purpose.json
    claude-metadata-missing.json
```

---

## Fixture Catalog

### Git Fixtures

#### `git-config-remote-url.json` — Get remote origin URL
```json
{
  "command": "git",
  "args": ["config", "--get", "remote.origin.url"],
  "stdout": "https://github.com/zookanalytics/bmad-orchestrator",
  "stderr": "",
  "exitCode": 0
}
```

#### `git-config-remote-url-missing.json` — No remote configured
```json
{
  "command": "git",
  "args": ["config", "--get", "remote.origin.url"],
  "stdout": "",
  "stderr": "",
  "exitCode": 1
}
```

#### `git-branch-current.json` — Get current branch
```json
{
  "command": "git",
  "args": ["branch", "--show-current"],
  "stdout": "main",
  "stderr": "",
  "exitCode": 0
}
```

#### `git-branch-current-feature.json` — Feature branch
```json
{
  "command": "git",
  "args": ["branch", "--show-current"],
  "stdout": "feature/env-2-workspace-mgmt",
  "stderr": "",
  "exitCode": 0
}
```

#### `git-clone-success.json` — Successful clone
```json
{
  "command": "git",
  "args": ["clone", "https://github.com/zookanalytics/bmad-orchestrator", "/Users/dev/instances/agent-1"],
  "stdout": "",
  "stderr": "Cloning into '/Users/dev/instances/agent-1'...",
  "exitCode": 0
}
```

#### `git-clone-failure.json` — Clone failure (auth/network)
```json
{
  "command": "git",
  "args": ["clone", "https://github.com/zookanalytics/bmad-orchestrator", "/Users/dev/instances/agent-1"],
  "stdout": "",
  "stderr": "fatal: repository 'https://github.com/zookanalytics/bmad-orchestrator' not found",
  "exitCode": 128
}
```

#### `git-ls-remote-heads-found.json` — Branch exists on remote
```json
{
  "command": "git",
  "args": ["ls-remote", "--heads", "origin", "feature/env-2-workspace-mgmt"],
  "stdout": "a1b2c3d4e5f6\trefs/heads/feature/env-2-workspace-mgmt",
  "stderr": "",
  "exitCode": 0
}
```

#### `git-ls-remote-heads-not-found.json` — Branch does not exist
```json
{
  "command": "git",
  "args": ["ls-remote", "--heads", "origin", "feature/nonexistent"],
  "stdout": "",
  "stderr": "",
  "exitCode": 0
}
```

#### `git-diff-index-clean.json` — No uncommitted changes
```json
{
  "command": "git",
  "args": ["diff-index", "--quiet", "HEAD", "--"],
  "stdout": "",
  "stderr": "",
  "exitCode": 0
}
```

#### `git-diff-index-dirty.json` — Has uncommitted changes
```json
{
  "command": "git",
  "args": ["diff-index", "--quiet", "HEAD", "--"],
  "stdout": "",
  "stderr": "",
  "exitCode": 1
}
```

#### `git-ls-files-untracked.json` — Untracked files present
```json
{
  "command": "git",
  "args": ["ls-files", "--others", "--exclude-standard"],
  "stdout": "new-file.ts\nsrc/untested.ts",
  "stderr": "",
  "exitCode": 0
}
```

#### `git-ls-files-untracked-none.json` — No untracked files
```json
{
  "command": "git",
  "args": ["ls-files", "--others", "--exclude-standard"],
  "stdout": "",
  "stderr": "",
  "exitCode": 0
}
```

#### `git-rev-list-unpushed.json` — Unpushed commits
```json
{
  "command": "git",
  "args": ["rev-list", "--count", "@{upstream}..HEAD"],
  "stdout": "3",
  "stderr": "",
  "exitCode": 0
}
```

#### `git-rev-list-no-unpushed.json` — All commits pushed
```json
{
  "command": "git",
  "args": ["rev-list", "--count", "@{upstream}..HEAD"],
  "stdout": "0",
  "stderr": "",
  "exitCode": 0
}
```

### Docker Fixtures

#### `docker-ps-by-label.json` — Container running (OrbStack label filter)
```json
{
  "command": "docker",
  "args": ["ps", "--filter", "label=dev.orbstack.domains=agent-1.signalloom.local", "--format", "{{.Names}}"],
  "stdout": "signalloom-agent-1",
  "stderr": "",
  "exitCode": 0
}
```

#### `docker-ps-by-label-empty.json` — No container matching label
```json
{
  "command": "docker",
  "args": ["ps", "--filter", "label=dev.orbstack.domains=agent-1.signalloom.local", "--format", "{{.Names}}"],
  "stdout": "",
  "stderr": "",
  "exitCode": 0
}
```

#### `docker-ps-names.json` — List running container names
```json
{
  "command": "docker",
  "args": ["ps", "--format", "{{.Names}}"],
  "stdout": "signalloom-agent-1\nsignalloom-agent-2\nsignalloom-main",
  "stderr": "",
  "exitCode": 0
}
```

#### `docker-ps-names-empty.json` — No running containers
```json
{
  "command": "docker",
  "args": ["ps", "--format", "{{.Names}}"],
  "stdout": "",
  "stderr": "",
  "exitCode": 0
}
```

#### `docker-ps-running-containers.json` — Running Signal Loom containers
```json
{
  "command": "docker",
  "args": ["ps", "--filter", "name=signalloom-", "--format", "{{.ID}}:{{.Names}}"],
  "stdout": "a1b2c3d4e5f6:signalloom-agent-1\nf6e5d4c3b2a1:signalloom-agent-2",
  "stderr": "",
  "exitCode": 0
}
```

#### `docker-ps-running-containers-empty.json` — No running containers
```json
{
  "command": "docker",
  "args": ["ps", "--filter", "name=signalloom-", "--format", "{{.ID}}:{{.Names}}"],
  "stdout": "",
  "stderr": "",
  "exitCode": 0
}
```

#### `docker-exec-tmux-has-session.json` — tmux session exists
```json
{
  "command": "docker",
  "args": ["exec", "signalloom-agent-1", "tmux", "has-session", "-t", "agent-1"],
  "stdout": "",
  "stderr": "",
  "exitCode": 0
}
```

#### `docker-exec-tmux-no-session.json` — No tmux session
```json
{
  "command": "docker",
  "args": ["exec", "signalloom-agent-1", "tmux", "has-session", "-t", "agent-1"],
  "stdout": "",
  "stderr": "can't find session: agent-1",
  "exitCode": 1
}
```

#### `docker-not-found.json` — Docker CLI not installed
```json
{
  "command": "docker",
  "args": ["ps"],
  "stdout": "",
  "stderr": "command not found: docker",
  "exitCode": 127
}
```

### Devcontainer Fixtures

#### `devcontainer-up-success.json` — Successful container creation

[High Confidence] Based on `devcontainer up` JSON output format documented in the devcontainers/cli repo and VS Code docs.

```json
{
  "command": "devcontainer",
  "args": ["up", "--workspace-folder", "/Users/dev/instances/agent-1"],
  "stdout": "[0 ms] @devcontainers/cli 0.80.1. Node.js v22.21.1. linux x64.\n{\"outcome\":\"success\",\"containerId\":\"a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890\",\"remoteUser\":\"node\",\"remoteWorkspaceFolder\":\"/workspaces/agent-1\"}",
  "stderr": "",
  "exitCode": 0
}
```

#### `devcontainer-up-failure.json` — Container creation failed

```json
{
  "command": "devcontainer",
  "args": ["up", "--workspace-folder", "/Users/dev/instances/agent-1"],
  "stdout": "{\"outcome\":\"error\",\"message\":\"Command failed: docker compose -f /tmp/.docker-compose.yml up -d\",\"description\":\"An error occurred setting up the container.\"}",
  "stderr": "",
  "exitCode": 1
}
```

#### `devcontainer-up-build-error.json` — Image build failed

```json
{
  "command": "devcontainer",
  "args": ["up", "--workspace-folder", "/Users/dev/instances/agent-1"],
  "stdout": "{\"outcome\":\"error\",\"message\":\"Command failed: docker build -t vsc-agent-1 /Users/dev/instances/agent-1/.devcontainer\",\"description\":\"The container build failed.\"}",
  "stderr": "",
  "exitCode": 1
}
```

#### `devcontainer-up-with-log-format.json` — JSON log format output

```json
{
  "command": "devcontainer",
  "args": ["up", "--workspace-folder", "/Users/dev/instances/agent-1", "--log-format", "json"],
  "stdout": "{\"type\":\"start\",\"level\":2,\"timestamp\":1706600000000,\"text\":\"Run: docker inspect --type container a1b2c3d4\"}\n{\"type\":\"stop\",\"level\":2,\"timestamp\":1706600001000,\"text\":\"Run: docker inspect --type container a1b2c3d4\"}\n{\"outcome\":\"success\",\"containerId\":\"a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890\",\"remoteUser\":\"node\",\"remoteWorkspaceFolder\":\"/workspaces/agent-1\"}",
  "stderr": "",
  "exitCode": 0
}
```

#### `devcontainer-cli-not-found.json` — CLI not installed
```json
{
  "command": "devcontainer",
  "args": ["up", "--workspace-folder", "/Users/dev/instances/agent-1"],
  "stdout": "",
  "stderr": "command not found: devcontainer",
  "exitCode": 127
}
```

### Metadata Fixtures

#### `claude-metadata-with-purpose.json` — Instance with purpose set
```json
{
  "created": "2026-01-15T10:30:00Z",
  "createdBy": "node",
  "purpose": "JWT Authentication"
}
```

#### `claude-metadata-empty-purpose.json` — Instance without purpose
```json
{
  "created": "2026-01-15T10:30:00Z",
  "createdBy": "node",
  "purpose": ""
}
```

#### `claude-metadata-missing.json` — Fallback when no metadata file
```json
{
  "created": "",
  "createdBy": "",
  "purpose": ""
}
```

---

## Integration with createExecutor() Pattern

### Existing Pattern (from `packages/shared/src/subprocess.ts`)

```typescript
export function createExecutor(executor: Executor = execa) {
  return async function execute(
    command: string,
    args: string[] = [],
    options: Options = {}
  ): Promise<ExecuteResult> {
    const result = await executor(command, args, {
      reject: false,
      ...options,
    });
    return {
      ok: !result.failed,
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      exitCode: result.exitCode ?? -1,
    };
  };
}
```

### Test Usage Pattern (from `packages/orchestrator/src/lib/discovery.test.ts`)

The existing orchestrator tests use this pattern:

```typescript
const mockExecutor = vi.fn().mockResolvedValue({
  stdout: JSON.stringify(devPodList),
  stderr: '',
  failed: false,
});
const discover = createDiscovery(mockExecutor as unknown as typeof execaType);
```

### Recommended Test Pattern for agent-env

For agent-env, build a fixture-based mock executor:

```typescript
import gitCloneSuccess from './__fixtures__/git/git-clone-success.json' with { type: 'json' };
import gitCloneFailure from './__fixtures__/git/git-clone-failure.json' with { type: 'json' };
import devcontainerUpSuccess from './__fixtures__/devcontainer/devcontainer-up-success.json' with { type: 'json' };

// Convert fixture to execa-compatible mock return
function fixtureToExecaResult(fixture: CommandFixture) {
  return {
    stdout: fixture.stdout,
    stderr: fixture.stderr,
    exitCode: fixture.exitCode,
    failed: fixture.exitCode !== 0,
  };
}

// Build mock executor that matches fixtures by command + args
function createFixtureExecutor(fixtures: CommandFixture[]) {
  return vi.fn().mockImplementation((cmd: string, args: string[]) => {
    const fixture = fixtures.find(
      f => f.command === cmd && JSON.stringify(f.args) === JSON.stringify(args)
    );
    if (!fixture) {
      return Promise.resolve({
        stdout: '',
        stderr: `mock: no fixture for ${cmd} ${args.join(' ')}`,
        exitCode: 127,
        failed: true,
      });
    }
    return Promise.resolve(fixtureToExecaResult(fixture));
  });
}
```

### Example Test

```typescript
describe('create instance', () => {
  it('clones repo and starts devcontainer', async () => {
    const executor = createFixtureExecutor([
      gitConfigRemoteUrl,
      gitBranchCurrent,
      gitCloneSuccess,
      devcontainerUpSuccess,
    ]);

    const createInstance = createInstanceFactory(executor);
    const result = await createInstance('agent-1');

    expect(result.ok).toBe(true);
    expect(result.containerId).toBeDefined();
    expect(executor).toHaveBeenCalledWith('git', ['clone', expect.any(String), expect.any(String)], expect.any(Object));
  });
});
```

---

## Recommendations

### 1. Fixture File Organization

Store fixtures as individual JSON files under `packages/agent-env/src/lib/__fixtures__/`, organized by command category (git, docker, devcontainer, metadata). This matches the established pattern in `packages/orchestrator/src/lib/__fixtures__/`.

### 2. Use `devcontainer up` Instead of `devcontainer open`

The bash script uses `devcontainer open` (VS Code proprietary). For agent-env:
- Use `devcontainer up --workspace-folder <path>` for programmatic container creation
- Parse the JSON output line for `outcome`, `containerId`, `remoteUser`, `remoteWorkspaceFolder`
- Use `--log-format=json` for structured log parsing if needed

### 3. Build a Shared Fixture Executor Helper

Create a `createFixtureExecutor()` utility in `packages/agent-env/src/lib/__test-utils__/` that maps fixtures to mock execa responses. This keeps test setup DRY across all agent-env command tests.

### 4. Cover Both Success and Failure Paths

Every external command fixture should have at minimum:
- **Success case** — expected happy-path output
- **Failure case** — command not found (exit 127), permission denied (exit 1), network error, etc.

### 5. OrbStack-Specific Considerations

The bash script uses OrbStack-specific Docker labels (`dev.orbstack.domains`) for container discovery. agent-env should:
- Treat OrbStack labels as the primary discovery mechanism on macOS
- Fall back to container name matching when labels are absent
- Include fixtures for both label-based and name-based discovery

---

## Sources

- [Dev Container CLI — VS Code Docs](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli)
- [devcontainers/cli — GitHub](https://github.com/devcontainers/cli)
- [Reference Implementation — containers.dev](https://containers.dev/implementors/reference/)
- [Docker CLI Formatting — Docker Docs](https://docs.docker.com/engine/cli/formatting/)
- [docker inspect — Docker Docs](https://docs.docker.com/reference/cli/docker/inspect/)
- [docker container ls — Docker Docs](https://docs.docker.com/reference/cli/docker/container/ls/)
- [Zed devcontainer issue #46852 (documents devcontainer up JSON output)](https://github.com/zed-industries/zed/issues/46852)
- [Add open command issue #5957 — microsoft/vscode-remote-release](https://github.com/microsoft/vscode-remote-release/issues/5957)
