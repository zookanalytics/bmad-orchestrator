---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: []
workflowType: 'research'
lastStep: 5
research_type: 'technical'
research_topic: '@devcontainers/cli API for agent-env integration'
research_goals: 'Document devcontainer up, exec, error codes, OrbStack considerations, SSH forwarding, and devcontainer.json features for programmatic agent-env integration'
user_name: 'Node'
date: '2026-01-30'
web_research_enabled: true
source_verification: true
---

# @devcontainers/cli API Research for agent-env Integration

**Date:** 2026-01-30
**Author:** Node
**Research Type:** Technical

---

## Executive Summary

The `@devcontainers/cli` package (npm: `@devcontainers/cli`) is the reference implementation of the Development Containers Specification. It is a **CLI-only tool** — there is no exported Node.js/TypeScript programmatic API. All integration must happen via child process spawning with JSON output parsing. The CLI supports structured JSON output via `--log-format json`, making it suitable for programmatic consumption from the agent-env package.

Key findings for agent-env integration:

1. **CLI-as-subprocess**: Spawn `devcontainer up` / `devcontainer exec` as child processes; parse JSON stdout
2. **JSON output contract**: `devcontainer up` returns `{ outcome, containerId, remoteUser, remoteWorkspaceFolder }`
3. **Exit codes**: Non-zero (primarily 1) for errors; a known bug can return 0 on build failures
4. **SSH agent forwarding**: NOT supported by CLI — only by VS Code extension. Workaround: mount `~/.ssh` or `SSH_AUTH_SOCK` socket via `mounts`
5. **OrbStack**: Fully compatible as Docker drop-in replacement on macOS; no CLI-specific issues

---

## Table of Contents

1. [Package Overview](#1-package-overview)
2. [`devcontainer up` Command](#2-devcontainer-up-command)
3. [`devcontainer exec` Command](#3-devcontainer-exec-command)
4. [`devcontainer read-configuration` Command](#4-devcontainer-read-configuration-command)
5. [Error Codes and Failure Modes](#5-error-codes-and-failure-modes)
6. [OrbStack macOS Considerations](#6-orbstack-macos-considerations)
7. [SSH Agent Forwarding](#7-ssh-agent-forwarding)
8. [devcontainer.json Reference](#8-devcontainerjson-reference)
9. [Programmatic Integration Strategy](#9-programmatic-integration-strategy)
10. [Recommendations for agent-env](#10-recommendations-for-agent-env)

---

## 1. Package Overview

### What It Is

The Dev Containers CLI is the reference implementation of the [Development Containers Specification](https://containers.dev/). It parses `devcontainer.json` configuration files, provisions containers using Docker or Podman, applies modular features from OCI registries, and executes lifecycle commands.

- **npm**: [@devcontainers/cli](https://www.npmjs.com/package/@devcontainers/cli)
- **GitHub**: [devcontainers/cli](https://github.com/devcontainers/cli)
- **Spec**: [containers.dev](https://containers.dev/implementors/spec/)

### Installation

```bash
npm install -g @devcontainers/cli
```

Requires: Node.js >= 14, Python, C/C++ compiler (for native dependency build).

_Source: [npm package page](https://www.npmjs.com/package/@devcontainers/cli), [GitHub README](https://github.com/devcontainers/cli)_

### Architecture (7 Layers)

The CLI is structured as a TypeScript application with these layers:

| Layer | Purpose |
|-------|---------|
| User Interface | Command parsing via yargs |
| Core Orchestration | Container provisioning and configuration resolution |
| Container Runtime | Docker/Podman operations and Docker Compose |
| OCI Registry | Feature and template distribution |
| Build & Package | Image metadata and Dockerfile processing |
| Utilities | Common functions and lifecycle management |
| File System | Configuration and feature storage |

_Source: [DeepWiki devcontainers/cli](https://deepwiki.com/devcontainers/cli)_ [High Confidence]

### Available Commands

| Command | Purpose |
|---------|---------|
| `devcontainer up` | Create and run dev container |
| `devcontainer exec <cmd> [args..]` | Execute command in running container |
| `devcontainer build [path]` | Build dev container image |
| `devcontainer run-user-commands` | Run lifecycle commands (postCreateCommand, etc.) |
| `devcontainer read-configuration` | Output current merged configuration |
| `devcontainer features` | Feature management commands |
| `devcontainer templates` | Template management commands |

Global options: `--help`, `--version`

_Source: [VS Code docs](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli), [Reference implementation](https://containers.dev/implementors/reference/)_

### No Programmatic API

The package does **not** export a Node.js/TypeScript API. The source is compiled TypeScript but bundled as a CLI binary, not a library. All programmatic integration must spawn the CLI as a child process.

Even major integrators (Coder, DevPod, JetBrains) use it as a CLI subprocess.

_Source: [GitHub repo](https://github.com/devcontainers/cli), [Coder docs](https://coder.com/docs/user-guides/devcontainers)_ [High Confidence]

---

## 2. `devcontainer up` Command

### Purpose

Full container provisioning lifecycle: resolve config, build/pull image, apply features, create container, run lifecycle hooks.

### Signature

```bash
devcontainer up --workspace-folder <path> [options]
```

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `--workspace-folder` | string | **Required.** Path to project workspace |
| `--config` | string | Path to specific devcontainer.json file |
| `--log-format` | `json` \| `text` | Output format. Use `json` for programmatic parsing |
| `--log-level` | `trace` \| `debug` \| `info` \| `warning` \| `error` | Log verbosity |
| `--id-label` | string | Label(s) to identify the container |
| `--mount` | string | Additional mounts (Docker `--mount` syntax) |
| `--remove-existing-container` | boolean | Remove existing container before creating |
| `--skip-post-create` | boolean | Skip postCreateCommand and later lifecycle hooks |
| `--update-remote-user-uid-default` | `on` \| `off` | UID remapping for Linux |
| `--workspace-mount-consistency` | string | Mount consistency (`cached`, `delegated`) |
| `--gpu-availability` | `detect` \| `true` \| `false` | GPU detection mode |
| `--default-user-env-probe` | string | User env probe method (e.g., `loginInteractiveShell`) |
| `--mount-workspace-git-root` | boolean | Mount workspace git root |
| `--include-configuration` | boolean | Include configuration in output |
| `--user-data-folder` | string | Path to user data folder |
| `--container-session-data-folder` | string | Session data folder path |

_Source: [VS Code docs](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli), [Reference implementation](https://containers.dev/implementors/reference/), [DeepWiki](https://deepwiki.com/devcontainers/cli)_

### JSON Output Format

When using `--log-format json`, each line is a JSON object. Log entries:

```json
{"type":"text","level":3,"timestamp":1724085707436,"text":"@devcontainers/cli 0.65.0. Node.js v20.14.0. darwin 24.1.0 arm64."}
```

The final output (on success) is a JSON result object:

```json
{
  "outcome": "success",
  "containerId": "abc123def456...",
  "remoteUser": "vscode",
  "remoteWorkspaceFolder": "/workspaces/my-project"
}
```

On error:

```json
{
  "outcome": "error",
  "message": "Command failed",
  "description": "An error occurred..."
}
```

_Source: [Reference implementation](https://containers.dev/implementors/reference/), [GitHub issues](https://github.com/devcontainers/cli/issues/873)_ [High Confidence]

### Exit Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | General failure / error |

**Warning**: A known bug ([Issue #144](https://github.com/devcontainers/cli/issues/144)) causes `devcontainer build` to return exit code 0 on certain Dockerfile build failures. Always parse JSON output for `"outcome": "error"` in addition to checking exit code.

_Source: [GitHub Issue #144](https://github.com/devcontainers/cli/issues/144)_ [High Confidence]

---

## 3. `devcontainer exec` Command

### Purpose

Execute a command inside a running dev container with `userEnvProbe`, `remoteUser`, `remoteEnv`, and other properties applied.

### Signature

```bash
devcontainer exec --workspace-folder <path> <cmd> [args..]
```

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `--workspace-folder` | string | **Required.** Identifies which container to target |
| `--remote-user` | string | User account for command execution |
| `--log-format` | `json` \| `text` | Output format |
| `--log-level` | string | Log verbosity |
| `--id-label` | string | Label to identify container |

### Behavior

- Sets working directory to the workspace mount path (not container root)
- Applies `remoteUser` from devcontainer.json
- Applies `remoteEnv` environment variables
- Runs `userEnvProbe` to inherit user environment
- Under the hood: wraps `docker exec -u <name-or-UID>`

### Output

- **stdout/stderr**: Passed through from the executed command
- **Exit code**: Returns the exit code of the executed command
- With `--log-format json`: Log entries plus command output

### Limitations

- No native `--workdir` flag to override working directory ([Issue #703](https://github.com/devcontainers/cli/issues/703) — open feature request)
- No built-in SSH agent forwarding (see Section 7)

_Source: [Reference implementation](https://containers.dev/implementors/reference/), [VS Code docs](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli), [GitHub Issue #703](https://github.com/devcontainers/cli/issues/703)_

---

## 4. `devcontainer read-configuration` Command

### Purpose

Parse and output the merged configuration for a workspace without creating a container. Useful for inspecting resolved configuration programmatically.

### Signature

```bash
devcontainer read-configuration --workspace-folder <path> [--config <path>]
```

### Output (JSON)

Returns the fully merged configuration as JSON with all resolved properties:

```json
{
  "image": "string",
  "features": { "feature-id": "version" },
  "remoteUser": "string",
  "mounts": [{"source": "path", "target": "/path", "type": "bind"}],
  "postCreateCommand": "string | string[]",
  "containerEnv": {"VAR": "value"},
  "remoteEnv": {"VAR": "value"}
}
```

### Use in agent-env

This command is valuable for **validating configuration before provisioning** — agent-env can call `read-configuration` to verify the devcontainer.json is valid and inspect the resolved workspace folder, user, and mounts before running `up`.

_Source: [DeepWiki](https://deepwiki.com/devcontainers/cli), [Reference implementation](https://containers.dev/implementors/reference/)_ [High Confidence]

---

## 5. Error Codes and Failure Modes

### Exit Code Behavior

The CLI uses standard Unix exit codes but with limited granularity:

| Condition | Exit Code | JSON Outcome |
|-----------|-----------|-------------|
| Success | 0 | `"success"` |
| General error | 1 | `"error"` |
| Build failure (bug) | 0 (sometimes!) | May show `"error"` |

**Critical**: Do NOT rely solely on exit codes. Always parse JSON output for `"outcome"` field.

### Common Failure Modes

| Failure | Cause | JSON Description |
|---------|-------|-----------------|
| ENOENT | Missing devcontainer.json or feature paths | `"Error: ENOENT: no such file or directory"` |
| Docker Compose config error | Malformed compose file | `"An error occurred retrieving the Docker Compose configuration"` |
| Docker build failure | Dockerfile syntax/package errors | Docker-level exit codes (e.g., 100 for apt-get) |
| Image pull failure | Registry unavailable or auth failure | Docker pull error message |
| Feature install failure | Feature script error | Feature-specific error in logs |
| Invalid remoteUser | Non-existent user specified | Unclear error ([Issue #990](https://github.com/devcontainers/cli/issues/990)) |

### Recommended Error Handling Strategy

```typescript
interface DevContainerResult {
  outcome: 'success' | 'error';
  containerId?: string;
  remoteUser?: string;
  remoteWorkspaceFolder?: string;
  message?: string;
  description?: string;
}

// 1. Check exit code (non-zero = definite error)
// 2. Parse JSON output for outcome field
// 3. If outcome === 'error', use message + description
// 4. If exit code 0 but outcome absent, treat as potential failure
```

_Source: [GitHub Issue #144](https://github.com/devcontainers/cli/issues/144), [GitHub Issue #990](https://github.com/devcontainers/cli/issues/990)_ [High Confidence]

---

## 6. OrbStack macOS Considerations

### Compatibility Status

**OrbStack is fully compatible** with the devcontainer CLI as a Docker drop-in replacement on macOS.

- Works since OrbStack v0.11.1+ with VS Code Dev Containers
- Full Docker API compliance including Compose and Kubernetes
- No CLI-specific issues reported

_Source: [OrbStack Issue #706](https://github.com/orbstack/orbstack/issues/706)_ [High Confidence]

### Performance Advantages

| Area | OrbStack Advantage |
|------|-------------------|
| File I/O | VirtioFS + custom caching for fast bind mounts |
| Apple Silicon | Rosetta-based x86 emulation (faster than QEMU) |
| Resource usage | ~1.7x more efficient background power consumption |
| Startup | Near-instant container startup |

_Source: [OrbStack docs](https://docs.orbstack.dev/docker/), [OrbStack architecture](https://docs.orbstack.dev/architecture)_ [High Confidence]

### Known Issue: Docker Desktop Conflict

When both Docker Desktop and OrbStack are installed (even with Docker Desktop stopped), the VS Code Dev Containers extension may fail to identify the correct Docker context.

**Solution**: Uninstall Docker Desktop completely, or ensure only one Docker context is active.

_Source: [OrbStack Issue #706](https://github.com/orbstack/orbstack/issues/706)_ [High Confidence]

### macOS Version Requirement

OrbStack requires macOS 12 Monterey or later. macOS Catalina (10.15) and earlier are not supported because required virtualization APIs did not exist.

_Source: [OrbStack FAQ](https://orbstack.dev/docs/faq)_ [Medium Confidence]

### Competitive Landscape (2025-2026)

Apple entered the container space with Apple Containers (v0.6.0 as of early 2026). For now, OrbStack remains the recommended runtime for agent-env due to maturity, Docker API compliance, and proven devcontainer compatibility.

_Source: [DEV Community comparison](https://dev.to/tuliopc23/orbstack-vs-apple-containers-vs-docker-on-macos-how-they-really-differ-under-the-hood-53fj), [Repoflow comparison](https://www.repoflow.io/blog/apple-containers-vs-docker-desktop-vs-orbstack)_ [Medium Confidence]

---

## 7. SSH Agent Forwarding

### Critical Finding: NOT Supported by CLI

SSH agent forwarding is a **VS Code extension feature**, not a CLI feature. The maintainer explicitly stated:

> "The ssh-agent forwarding is part of the Dev Containers extension and not part of the Dev Containers CLI."

_Source: [GitHub Issue #441](https://github.com/devcontainers/cli/issues/441)_ [High Confidence]

### Workarounds for CLI Usage

#### Option A: Mount SSH_AUTH_SOCK Socket (Recommended for macOS/Linux)

Configure in `devcontainer.json`:

```json
{
  "mounts": [
    "source=${localEnv:SSH_AUTH_SOCK},target=/ssh-agent,type=bind"
  ],
  "remoteEnv": {
    "SSH_AUTH_SOCK": "/ssh-agent"
  }
}
```

**Caveat**: Variable substitution for `${localEnv:SSH_AUTH_SOCK}` in mounts can be unreliable with Docker Compose configurations. Works reliably with image-based and Dockerfile-based configs.

#### Option B: Mount ~/.ssh Directory

```json
{
  "mounts": [
    "source=${localEnv:HOME}/.ssh,target=/home/vscode/.ssh,type=bind,readonly"
  ]
}
```

**Trade-off**: Exposes private key files directly to the container. Less secure than agent forwarding but simpler and more reliable.

#### Option C: Start SSH Agent Inside Container

```json
{
  "postCreateCommand": "eval $(ssh-agent -a /tmp/ssh-agent.sock) && ssh-add ~/.ssh/id_rsa",
  "remoteEnv": {
    "SSH_AUTH_SOCK": "/tmp/ssh-agent.sock"
  }
}
```

Requires keys to be mounted (Option B) or pre-existing in the container image.

### Recommendation for agent-env

Use **Option A** (socket mount) as the default configuration, with **Option B** as a fallback. Document the limitation clearly — agent-env users need SSH access for git operations inside the container.

_Source: [GitHub Issue #441](https://github.com/devcontainers/cli/issues/441), [VS Code sharing-git-credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)_ [High Confidence]

---

## 8. devcontainer.json Reference

### Configuration Types

| Type | Required Property | Handler |
|------|-------------------|---------|
| Image-based | `image` | `extendImage()` — uses pre-built image with optional features |
| Dockerfile | `build.dockerfile` | `buildAndExtendImage()` — builds from Dockerfile |
| Docker Compose | `dockerComposeFile` + `service` | `openDockerComposeDevContainer()` — multi-container |

_Source: [Dev Container metadata reference](https://containers.dev/implementors/json_reference/)_ [High Confidence]

### Properties Relevant to agent-env

#### Container Identity & User

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Display name for the container |
| `remoteUser` | string | User for tool connections (e.g., `"vscode"`) |
| `containerUser` | string | User for all container operations |
| `updateRemoteUserUID` | boolean | Remap UID to match host (default: `true` on Linux) |

#### Environment Variables

| Property | Type | Description |
|----------|------|-------------|
| `containerEnv` | object | Set at container creation, static for lifetime |
| `remoteEnv` | object | Set by supporting tool at connection time |

#### Mounts

```json
{
  "mounts": [
    {
      "source": "/host/path",
      "target": "/container/path",
      "type": "bind"
    }
  ],
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/${localWorkspaceFolderBasename},type=bind,consistency=cached",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}"
}
```

Supported options: `source`, `target`, `type` (`bind`, `volume`), `readonly`, `consistency` (`cached`, `delegated`).

#### Features

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "20"
    },
    "ghcr.io/devcontainers/features/git:1": {}
  }
}
```

Features are installed from OCI registries (ghcr.io, mcr.microsoft.com). Options are passed as environment variables to feature install scripts.

#### Lifecycle Hooks (Execution Order)

| Hook | When | Runs |
|------|------|------|
| `initializeCommand` | Before container exists | On **host machine** |
| `onCreateCommand` | After first container creation | Once |
| `updateContentCommand` | After content update | On create + content changes |
| `postCreateCommand` | After user assignment | Once |
| `postStartCommand` | Each container start | Every start |
| `postAttachCommand` | Each tool connection | Every attach |

Each hook supports: `string`, `string[]` (command + args), or `object` (parallel named commands).

#### Variable Substitution

| Variable | Description |
|----------|-------------|
| `${localEnv:VAR}` | Host environment variable |
| `${containerEnv:VAR}` | Container environment variable |
| `${localWorkspaceFolder}` | Host workspace path |
| `${containerWorkspaceFolder}` | Container workspace path |
| `${localWorkspaceFolderBasename}` | Host folder name |
| `${devcontainerId}` | Unique stable container ID |

Default values: `${localEnv:VAR:default_value}`

_Source: [Dev Container metadata reference](https://containers.dev/implementors/json_reference/), [Dev Container spec](https://containers.dev/implementors/spec/), [devcontainer.json schema](https://containers.dev/implementors/json_schema/)_ [High Confidence]

### Configuration Merging Rules

When combining config from base images, features, and devcontainer.json:

| Property Type | Merge Strategy |
|---------------|---------------|
| Boolean flags (`init`, `privileged`) | OR together |
| Arrays (`mounts`, lifecycle commands) | Concatenate, preserve order |
| Objects (`remoteEnv`, `containerEnv`) | Later sources override |
| Lifecycle commands | Collected into arrays, execution order preserved |

_Source: [DeepWiki devcontainers/cli](https://deepwiki.com/devcontainers/cli)_ [High Confidence]

---

## 9. Programmatic Integration Strategy

### Spawning the CLI

Since no library API exists, agent-env must spawn the CLI as a child process:

```typescript
import { execFile } from 'child_process';

function devcontainerUp(workspaceFolder: string): Promise<DevContainerResult> {
  return new Promise((resolve, reject) => {
    execFile('devcontainer', [
      'up',
      '--workspace-folder', workspaceFolder,
      '--log-format', 'json'
    ], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      // Parse last JSON line for result
      const lines = stdout.trim().split('\n');
      const resultLine = lines[lines.length - 1];
      const result = JSON.parse(resultLine);

      if (result.outcome === 'error' || error) {
        reject(new Error(result.description || result.message || 'Unknown error'));
      } else {
        resolve(result);
      }
    });
  });
}
```

### Parsing JSON Log Output

Each line when using `--log-format json` is an independent JSON object:

```typescript
interface DevContainerLogEntry {
  type: 'text' | 'start' | 'stop' | 'progress';
  level: number;  // 0=trace, 1=debug, 2=info, 3=warning, 4=error
  timestamp: number;
  text: string;
}
```

The final line is the result object (different schema from log entries).

### Integration with createExecutor() Pattern

For the `@zookanalytics/shared` `createExecutor()` DI pattern, the CLI commands map cleanly to executor calls:

```typescript
// Executor interface for devcontainer CLI
interface DevContainerExecutor {
  up(workspaceFolder: string, opts?: UpOptions): Promise<DevContainerResult>;
  exec(workspaceFolder: string, cmd: string[]): Promise<ExecResult>;
  readConfiguration(workspaceFolder: string): Promise<DevContainerConfig>;
}
```

### Example CLI Invocations for Fixtures

```bash
# devcontainer up (success)
devcontainer up --workspace-folder /path/to/project --log-format json
# stdout final line: {"outcome":"success","containerId":"abc123","remoteUser":"vscode","remoteWorkspaceFolder":"/workspaces/project"}
# exit code: 0

# devcontainer up (failure - missing config)
devcontainer up --workspace-folder /nonexistent --log-format json
# stdout final line: {"outcome":"error","message":"Command failed","description":"..."}
# exit code: 1

# devcontainer exec
devcontainer exec --workspace-folder /path/to/project echo "hello"
# stdout: hello
# exit code: 0

# devcontainer read-configuration
devcontainer read-configuration --workspace-folder /path/to/project
# stdout: { full merged config JSON }
# exit code: 0
```

---

## 10. Recommendations for agent-env

### Primary Commands to Wrap

1. **`devcontainer up`** — Container provisioning (always use `--log-format json`)
2. **`devcontainer exec`** — Running commands inside container
3. **`devcontainer read-configuration`** — Pre-flight config validation

### Error Handling

- Always parse JSON output `outcome` field — do NOT rely solely on exit codes
- Handle the exit-code-0-on-build-failure bug defensively
- Capture both stdout and stderr; JSON output goes to stdout, Docker errors may go to stderr

### SSH Strategy

- Default: Mount `SSH_AUTH_SOCK` socket via devcontainer.json `mounts` + `remoteEnv`
- Fallback: Mount `~/.ssh` directory read-only
- Document the VS Code extension limitation clearly

### OrbStack Compatibility

- No special handling needed — OrbStack is a Docker drop-in replacement
- Ensure only one Docker runtime context is active (no Docker Desktop conflict)
- Minimum: macOS 12 Monterey

### Container Identification

Use `--id-label` with `devcontainer up` to tag containers for later identification:

```bash
devcontainer up --workspace-folder /path --id-label agent-env=true --id-label session-id=abc123
```

This enables reliable container lookup via `docker ps --filter label=agent-env=true`.

---

## Sources

- [npm: @devcontainers/cli](https://www.npmjs.com/package/@devcontainers/cli)
- [GitHub: devcontainers/cli](https://github.com/devcontainers/cli)
- [VS Code Dev Container CLI docs](https://code.visualstudio.com/docs/devcontainers/devcontainer-cli)
- [Dev Container Specification](https://containers.dev/implementors/spec/)
- [Dev Container JSON Reference](https://containers.dev/implementors/json_reference/)
- [Dev Container Features Reference](https://containers.dev/implementors/features/)
- [Reference Implementation](https://containers.dev/implementors/reference/)
- [DeepWiki: devcontainers/cli](https://deepwiki.com/devcontainers/cli)
- [GitHub Issue #144 — build returns 0 on failure](https://github.com/devcontainers/cli/issues/144)
- [GitHub Issue #441 — SSH agent forwarding](https://github.com/devcontainers/cli/issues/441)
- [GitHub Issue #703 — workdir flag request](https://github.com/devcontainers/cli/issues/703)
- [GitHub Issue #990 — unclear remoteUser error](https://github.com/devcontainers/cli/issues/990)
- [OrbStack Issue #706 — devcontainer support](https://github.com/orbstack/orbstack/issues/706)
- [OrbStack docs](https://docs.orbstack.dev/docker/)
- [OrbStack architecture](https://docs.orbstack.dev/architecture)
- [VS Code: Sharing Git Credentials](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)
- [devcontainer.json schema](https://containers.dev/implementors/json_schema/)
