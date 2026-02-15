# @zookanalytics/agent-env

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
