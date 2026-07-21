# Repo compatibility with the managed image

`agent-env create` does **not** run a repo's own devcontainer image. It always
substitutes the agent-env **managed image**
(`ghcr.io/zookanalytics/bmad-orchestrator/devcontainer`) and merges the repo's
`.devcontainer/devcontainer.json` on top of it. A handful of fields are therefore
**forced** by the merge, because a repo's value for them is tuned for the repo's
own image and is invalid once the image is swapped:

| Field | Forced value | Why |
| --- | --- | --- |
| `image` | managed image | agent-env's tooling (Claude Code, tmux, sshd, firewall, …) lives in this image. |
| `overrideCommand` | `true` | The managed image's command (`node`) exits immediately; the devcontainer CLI keep-alive loop (only injected when `overrideCommand` is `true`) is what keeps the container running. A repo `false` leaves the container dead and setup fails — on rootless Podman with the opaque *"An error occurred setting up the container."* |
| `containerUser` / `remoteUser` | `node` | The managed image is built around the `node` user (uid/gid 1000): `/pnpm`, `/home/node`, and the shared volumes are node-owned, and its `post-create.sh` installs global tooling as `node`. Running as any other user breaks post-create with `EACCES`. |

Each forced field emits a warning (see `validateRepoConfig`) so the override is
never silent.

On **rootless Podman** hosts, agent-env also adds two runArgs (see
`PODMAN_RUNARGS`): a sticky-`1777` tmpfs at `/tmp` (so `apt-get`'s signature
verification can write there) and a `keep-id` uid remap onto `node` (so
host-owned bind mounts — the cloned repo and `.agent-env` — are writable). These
are gated on the detected runtime, not the platform, because Docker rejects
`keep-id`.

## What a repo must therefore provide itself

Because the managed image — not the repo's image — is what runs, the repo cannot
rely on anything that only its original base image provided. In particular:

- **Toolchain**: install it via a devcontainer *feature* or an `onCreateCommand`
  / `postCreateCommand` step, not by choosing a language base image. The managed
  image is a general Node/agent image; it does not contain Go, Python
  toolchains, etc.
- **User + paths**: assume the `node` user and `/home/node`. Do not hardcode
  `/home/vscode`, `containerUser: vscode`, or `chown vscode:vscode` — under the
  managed image there may be no `vscode` user at all.

## Example: `gascity`

`zookanalytics/gascity`'s `.devcontainer/devcontainer.json` targets
`mcr.microsoft.com/devcontainers/go` and is written for that image's `vscode`
user. Under agent-env it needs three repo-side changes (tracked separately — the
agent-env resilience fixes above stop at agent-env's own boundary):

1. **Provide Go.** The managed image has no Go toolchain, so
   `postCreateCommand.gascity` (`make setup && make install && gc version`) has
   nothing to build with. Add the Go devcontainer feature
   (`ghcr.io/devcontainers/features/go`) or install Go in an `onCreateCommand`.
2. **Drop the `vscode` assumptions.** `onCreateCommand.fix-perms`
   (`sudo mkdir -p /home/vscode/gc-cities && sudo chown vscode:vscode …`), the
   `gc-cities` mount target `/home/vscode/gc-cities`, and the
   `go.gopath: /home/vscode/go` / `remoteEnv.PATH` entries all reference the
   `vscode` user. Point them at `/home/node` (or `${containerEnv:HOME}`).
3. **Remove `overrideCommand`, `containerUser`, `remoteUser`, and `image`.**
   agent-env forces all of these; leaving them only produces warnings.
