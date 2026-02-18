# @zookanalytics/agent-env

## 0.4.0

### Minor Changes

- [#22](https://github.com/zookanalytics/bmad-orchestrator/pull/22) [`9e20bf1`](https://github.com/zookanalytics/bmad-orchestrator/commit/9e20bf111d02549d6df50dfc7d48c688fe0b7e6d) Thanks [@johnzook](https://github.com/johnzook)! - Add purpose support to agent environments
  - Add purpose infrastructure to baseline devcontainer (tmux status, state.json)
  - Add --purpose flag to create command and AGENT_ENV_PURPOSE env var
  - Add container-aware CLI with live purpose updates via `agent-env purpose` command

### Patch Changes

- [#25](https://github.com/zookanalytics/bmad-orchestrator/pull/25) [`8834277`](https://github.com/zookanalytics/bmad-orchestrator/commit/883427726155b4906b7e2c7b348d2ff184a12e88) Thanks [@johnzook](https://github.com/johnzook)! - fix(agent-env): auto-discover and share Claude credentials across instances

  Replace empty-file credential bootstrap with discovery-based promotion. On each
  instance startup, the isolation script now validates credential state: uses shared
  credentials if available, discovers and promotes from instance directories if not,
  and gracefully handles first-instance scenarios. Self-heals broken symlinks and
  local files on every start.

- [#26](https://github.com/zookanalytics/bmad-orchestrator/pull/26) [`7680f27`](https://github.com/zookanalytics/bmad-orchestrator/commit/7680f27c203a15be97a18d7c5bb5e642f0959d82) Thanks [@johnzook](https://github.com/johnzook)! - Fix SSH connection discovery for OrbStack direct networking
  - Detect exposed-but-not-published ports (OrbStack doesn't use host port mapping)
  - Read `dev.orbstack.domains` container label for hostname override
  - Add `labels` field to container status results
  - Fix node user account lock preventing SSH pubkey auth
  - Set login shell to zsh so SSH sessions match tmux environment

## 0.3.1

### Patch Changes

- [#20](https://github.com/zookanalytics/bmad-orchestrator/pull/20) [`f900879`](https://github.com/zookanalytics/bmad-orchestrator/commit/f90087979e2a373f948bc15c7f162c8b7af703bd) Thanks [@johnzook](https://github.com/johnzook)! - fix(devcontainer): prevent container hang during SSH setup

  Replaces direct sudo commands with a dedicated install-ssh-host-keys.sh script in post-create.sh. The previous approach used sudo cp/chown/chmod which hung indefinitely because these commands weren't in sudoers, causing the container to wait for a password that would never come.

  Also adds agent-env README documentation for workspace structure, SSH access (host keys vs user keys), and commit signing setup (SSH signing recommended over GPG).

  Additionally improves the local image testing workflow by using docker tag/pull to switch between local and remote images, avoiding modifications to tracked config files.

## 0.3.0

### Minor Changes

- [#18](https://github.com/zookanalytics/bmad-orchestrator/pull/18) [`66e3574`](https://github.com/zookanalytics/bmad-orchestrator/commit/66e3574aaf54269907f29717a4dc684ecae41349) Thanks [@johnzook](https://github.com/johnzook)! - feat(agent-env): add SSH server support to baseline devcontainer

  Install and configure openssh-server in baseline config with hardened key-only authentication. Host public keys are staged (private keys never enter the container) and per-container host keys are generated and persisted in the workspace. Containers are accessible via `ssh node@ae-<instance>.orb.local` on OrbStack. Existing instances require rebuild.

## 0.2.0

### Minor Changes

- [#14](https://github.com/zookanalytics/bmad-orchestrator/pull/14) [`d481c3b`](https://github.com/zookanalytics/bmad-orchestrator/commit/d481c3b1ddc479828851ff6bce3062cf41d8a023) Thanks [@johnzook](https://github.com/johnzook)! - Add `--no-pull` and `--use-cache` flags to the rebuild command for controlling Docker image pulling and build cache behavior. By default, rebuild now pulls fresh base images and disables Docker layer cache to ensure fully reproducible builds. Includes Dockerfile resolution, FROM image parsing, and refactored rebuild orchestration.

## 0.1.3

### Patch Changes

- [`ccdb041`](https://github.com/zookanalytics/bmad-orchestrator/commit/ccdb041015a4f1054ec5b3692e83f3f805fa0714) Thanks [@johnzook](https://github.com/johnzook)! - Add rebuild command with configSource tracking and baseline config refresh

- [#11](https://github.com/zookanalytics/bmad-orchestrator/pull/11) [`ac44b31`](https://github.com/zookanalytics/bmad-orchestrator/commit/ac44b31e858219cba52294843f7d807a8ca7e18c) Thanks [@johnzook](https://github.com/johnzook)! - Detect stale containers before devcontainer up to prevent silent workspace rollback. Adds pre-flight check using Docker label query, improves error reporting with container name conflict detection, and replaces console.warn with injectable logger.

## 0.1.2

### Patch Changes

- [#8](https://github.com/zookanalytics/bmad-orchestrator/pull/8) [`4513c08`](https://github.com/zookanalytics/bmad-orchestrator/commit/4513c08e9fc1ee10f2fa594a2a3974f24f0e1901) Thanks [@johnzook](https://github.com/johnzook)! - version upgrade to test automated workflow

## 0.1.1

### Patch Changes

- First changesets-managed release
