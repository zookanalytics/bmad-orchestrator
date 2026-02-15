---
title: 'SSH Server Support for Agent-Env Baseline'
slug: 'ssh-server-baseline'
created: '2026-02-15'
status: 'done'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - openssh-server
  - devcontainer
  - OrbStack
files_to_modify:
  - packages/agent-env/config/baseline/Dockerfile
  - packages/agent-env/config/baseline/devcontainer.json
  - packages/agent-env/config/baseline/init-host.sh
  - packages/agent-env/config/baseline/post-create.sh
  - packages/agent-env/config/baseline/sshd_config
  - packages/agent-env/src/lib/types.ts
  - packages/agent-env/src/lib/container.ts
  - packages/agent-env/src/lib/list-instances.ts
  - packages/agent-env/src/components/InstanceList.tsx
  - packages/agent-env/src/lib/container.test.ts
  - packages/agent-env/src/lib/list-instances.test.ts
code_patterns:
  - devcontainer lifecycle hooks (initializeCommand, postCreateCommand, postStartCommand)
  - host mount staging pattern
  - workspace-persisted state (.agent-env/ directory)
  - docker inspect port discovery
---

# Tech-Spec: SSH Server Support for Agent-Env Baseline

**Created:** 2026-02-15
**Status:** Completed

## Overview

### Problem Statement

Agent-env instances are only accessible via `docker exec` through the `attach` command, which tunnels into a tmux session. There is no standard SSH access to running containers, which limits integration with external tooling such as VS Code Remote SSH, rsync, scp, and other SSH-based workflows.

### Solution

Install and configure `openssh-server` in the baseline devcontainer configuration with hardened key-only authentication. Host public keys are staged (not mounted directly) to avoid exposing private key material. Unique host keys are generated per container and persisted in the workspace directory to survive stop/start cycles. 

To handle diverse network environments:
1. **OrbStack DNS**: Primarily uses `<container-name>.orb.local` for direct IP-based access.
2. **Port Mapping Fallback**: Explicitly forwards port 22 in `devcontainer.json`.
3. **Automated Discovery**: The `agent-env list` command discovers host-mapped ports and displays connection strings.

### Scope

**In Scope:**

- Install openssh-server in baseline Dockerfile
- Hardened sshd_config (key-only auth, no root login, no PAM, absolute AuthorizedKeysFile path)
- Host public key staging via init-host.sh (private keys never enter container)
- Per-container host key generation with workspace persistence
- sshd auto-start on container boot via postStartCommand
- Explicit port 22 forwarding in `devcontainer.json`
- CLI discovery of SSH connection info in `agent-env list`
- Idempotent `authorized_keys` management in `post-create.sh`

**Out of Scope:**

- CLI `agent-env ssh <instance>` command (manual SSH for now)
- Automated SSH key rotation or management
- Non-OrbStack container runtimes (Docker Desktop, Podman) - though port forwarding makes them partially compatible

## Context for Development

### Codebase Patterns

- **Devcontainer lifecycle hooks**: `initializeCommand` runs on host before container creation, `postCreateCommand` runs once inside the container after creation, `postStartCommand` runs on every container start/restart
- **Host mount staging**: init-host.sh ensures mount source directories exist before container creation to prevent `devcontainer up` failures. Extended here to stage only public keys
- **Workspace-persisted state**: The `.agent-env/` directory inside the workspace is used for state.json and is git-excluded. Extended here for SSH host key persistence
- **Sudo access**: The `node` user has passwordless sudo via `/etc/sudoers.d/node`, used for sshd startup and host key installation
- **Port Discovery**: Uses `docker inspect` to find host-side port mappings for SSH (22/tcp).

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `packages/agent-env/config/baseline/Dockerfile` | Container image definition — installs openssh-server, copies sshd_config, removes default host keys |
| `packages/agent-env/config/baseline/sshd_config` | Hardened SSH server configuration — key-only auth, no root, no PAM, absolute paths |
| `packages/agent-env/config/baseline/devcontainer.json` | Container lifecycle config — mounts staged public keys, starts sshd, **forwards port 22** |
| `packages/agent-env/config/baseline/init-host.sh` | Host-side initialization — stages only `*.pub` files from `~/.ssh` into `~/.agent-env/ssh-pub-keys/` |
| `packages/agent-env/config/baseline/post-create.sh` | Container-side initialization — generates/restores host keys, **idempotently** updates authorized_keys |
| `packages/agent-env/src/lib/container.ts` | Updated to extract port mappings during `containerStatus` check |
| `packages/agent-env/src/lib/list-instances.ts` | Calculates SSH connection strings (DNS and port-based) |
| `packages/agent-env/src/components/InstanceList.tsx` | Renders the new SSH column in the CLI output |

### Technical Decisions

1. **Public key staging over direct mount**: Host `~/.ssh` contains private keys, config, known_hosts, and other sensitive material. Instead of mounting it read-only (which still exposes private keys to processes inside the container), init-host.sh copies only `*.pub` files to `~/.agent-env/ssh-pub-keys/` and that staging directory is mounted instead.

2. **Per-container host keys with workspace persistence**: Default host keys from the openssh-server package are removed from the image (they would be shared across all containers). Unique keys are generated per container in `post-create.sh` and stored in `/workspace/.agent-env/ssh/`. On stop/start, keys persist because the workspace volume persists. On rebuild, the workspace persists so keys are reused, avoiding "host identification changed" warnings.

3. **Dual Connectivity Strategy**:
   - **DNS First**: Uses `<container-name>.orb.local`. This is the most robust method for OrbStack users as it avoids port collisions entirely.
   - **Port Forwarding Second**: Port 22 is explicitly forwarded. If multiple containers run, the devcontainer CLI (via Docker) will map port 22 to a random high port on the host.
   - **Visibility**: The `agent-env list` command discovers which port was actually assigned and displays it.

4. **Idempotent Authorized Keys**: Instead of overwriting `~/.ssh/authorized_keys`, `post-create.sh` now checks if a key already exists before appending, preventing duplicate entries on repeated runs or rebuilds.

## Implementation Plan

### Tasks

- [x] **Task 1: Install openssh-server in Dockerfile**
  - Add `openssh-server` to apt-get install
  - Create `/run/sshd` directory
  - Copy hardened `sshd_config` into image
- [x] **Task 2: Create hardened sshd_config**
  - Key settings: `PasswordAuthentication no`, `PermitRootLogin no`, `PubkeyAuthentication yes`, `UsePAM no`
  - Used absolute `%h/.ssh/authorized_keys` path
- [x] **Task 3: Stage host public keys in init-host.sh**
  - Copy only `*.pub` files from `~/.ssh/` into staging dir
- [x] **Task 4: Mount staged keys and start sshd in devcontainer.json**
  - Add mount: `~/.agent-env/ssh-pub-keys` → `/home/node/.ssh-host` (read-only)
  - Add `forwardPorts: [22]`
  - Update postStartCommand to start sshd
- [x] **Task 5: Configure SSH in post-create.sh**
  - Generate ed25519 + RSA host keys
  - Idempotently copy `*.pub` from mounted staging dir to `~/.ssh/authorized_keys`
- [x] **Task 6: Implement Discovery in CLI**
  - Update `containerStatus` to return port mappings
  - Update `listInstances` to calculate connection strings
  - Add SSH column to `InstanceList` component

### Acceptance Criteria

- **AC1**: Given a rebuilt agent-env instance on OrbStack, when the user runs `ssh node@ae-<instance>.orb.local`, then they are connected to the container without a password prompt
- **AC2**: Given the sshd_config, when inspected, then password authentication is disabled, root login is disabled, and only pubkey authentication is permitted
- **AC3**: Given multiple agent-env instances running simultaneously, when each is accessed via SSH, then there are no port conflicts (either via OrbStack DNS or unique host-mapped ports)
- **AC4**: Given a container that is stopped and restarted, when the user SSHs in, then the host key fingerprint is unchanged
- **AC5**: When running `agent-env list`, the SSH column displays the correct connection string including any non-standard port mappings.
- **AC6**: Authorized keys are not duplicated in `~/.ssh/authorized_keys` after a container rebuild.
