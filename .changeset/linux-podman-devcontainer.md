---
"@zookanalytics/agent-env": patch
---

Fix `agent-env create` on Linux / Podman hosts (previously macOS + Docker Desktop only):

- **pnpm 11 compatibility:** the post-create CLI install used `pnpm link --global`, a form pnpm 11 removed, so it failed with `ERR_PNPM_LINK_BAD_PARAMS` and aborted container creation. Switched the dev-mount install (`post-create.sh`) and the `setup:agent-env` script to `pnpm add -g <dir>`.
- **Cross-platform SSH agent forwarding:** the SSH agent socket mount was hardcoded to `/run/host-services/ssh-auth.sock` (a path only Docker Desktop/OrbStack inject on macOS), causing `docker run` to fail on Linux. Moved it out of the static image LABEL into a platform-aware resolver (`resolveSshAgentMount`) that forwards the host's real SSH agent on Linux (as `${localEnv:SSH_AUTH_SOCK}`, substituted at each `devcontainer up` so restarts survive agent socket path changes across logout/reboot) and the fixed path on macOS, and skips the mount entirely when no agent is available.
- **Actionable error when the devcontainer CLI is missing:** a missing `devcontainer` binary spawned with ENOENT and surfaced as an empty "No error details available" message. Added a pre-flight check that returns a clear `DEVCONTAINER_CLI_MISSING` error pointing to `npm install -g @devcontainers/cli` or VS Code's bundled CLI. The CLI remains a soft dependency.
