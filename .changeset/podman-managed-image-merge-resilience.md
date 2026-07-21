---
"@zookanalytics/agent-env": patch
---

Fix `agent-env create` failing on rootless Podman hosts with an opaque *"An error occurred setting up the container."* The generic devcontainer error hid a chain of distinct failures that all stem from one root cause: agent-env always swaps a repo's devcontainer image for the managed image, but inherited image-specific settings from the repo config that were invalid once the image was swapped (e.g. `overrideCommand: false` and `containerUser/remoteUser: vscode` tuned for a base image like `mcr.microsoft.com/devcontainers/go`).

Extended agent-env's existing "force the managed image" principle to the other managed-image-owned settings, and added two Podman-only runArgs gated on runtime detection:

- **Forced in the merge (each warns via `validateRepoConfig`):**
  - `overrideCommand: true` — the managed image's command (`node`) exits immediately; the devcontainer CLI's keep-alive loop (only injected when `overrideCommand` is `true`) is what keeps the container alive. A repo `false` left the container dead, and Podman then refused to `exec` the user probe into a stopped container.
  - `containerUser` / `remoteUser: node` — matches the managed image's `node` user, which owns `/pnpm`, `/home/node`, and the shared volumes; running as any other user broke `post-create.sh` with `EACCES`.
- **Podman-only runArgs (via new `detectContainerRuntime()`; Docker rejects `keep-id`, so this is runtime-gated, not platform-gated):**
  - `--tmpfs=/tmp:mode=1777` — the feature-install build under Podman leaves `/tmp` at `0755`, so `apt-get`'s unprivileged `_apt` user can't `mkstemp` there and OpenPGP signature verification fails on every repository.
  - `--userns=keep-id:uid=1000,gid=1000` — remaps the host user onto `node`'s uid so host-owned bind mounts (the cloned repo and `.agent-env`) are writable for any host uid.

Together these clear every agent-env-owned setup step on rootless Podman. Docker hosts are unaffected — all Podman-specific behavior is behind runtime detection. See `packages/agent-env/docs/repo-compatibility.md` for what the managed-image model requires of a repo (repo-side toolchain and user assumptions remain out of scope).
