# @zookanalytics/agent-env

## 0.13.0

### Minor Changes

- [#101](https://github.com/zookanalytics/bmad-orchestrator/pull/101) [`16d565f`](https://github.com/zookanalytics/bmad-orchestrator/commit/16d565f09af64ba89d5e4b3aacb21ce22d4208c3) Thanks [@johnzook](https://github.com/johnzook)! - Add repo-level env file management: store env files once per repo and automatically copy them into workspace roots during create/rebuild

### Patch Changes

- [#98](https://github.com/zookanalytics/bmad-orchestrator/pull/98) [`bf5980e`](https://github.com/zookanalytics/bmad-orchestrator/commit/bf5980e7befcf931a89d88625509e246db3f2631) Thanks [@johnzook](https://github.com/johnzook)! - Verify Chromium binary exists before running firewall localhost test to prevent devcontainer startup failure

- [#100](https://github.com/zookanalytics/bmad-orchestrator/pull/100) [`cafdf6a`](https://github.com/zookanalytics/bmad-orchestrator/commit/cafdf6a6ffed3ee7349c91272ad2ed7ce20015fd) Thanks [@johnzook](https://github.com/johnzook)! - Add IPv6 REJECT rule to firewall for fast Happy Eyeballs fallback to IPv4

## 0.12.3

### Patch Changes

- [#95](https://github.com/zookanalytics/bmad-orchestrator/pull/95) [`7bbc714`](https://github.com/zookanalytics/bmad-orchestrator/commit/7bbc7144a2f2bb9edebd35d4f95ac25d3c4ce342) Thanks [@johnzook](https://github.com/johnzook)! - Add ip6tables parity to firewall script (flush, ACCEPT reset, DROP defaults, error trap) and Chromium localhost verification test for Chrome 145+ IPv6 resolution

## 0.12.2

### Patch Changes

- [#92](https://github.com/zookanalytics/bmad-orchestrator/pull/92) [`4b1582c`](https://github.com/zookanalytics/bmad-orchestrator/commit/4b1582c92faf7ec57074079507a9a6509b21e163) Thanks [@johnzook](https://github.com/johnzook)! - Forward stdin to post-create commands when running in an interactive terminal, allowing users to respond to prompts instead of hanging

## 0.12.1

### Patch Changes

- [#90](https://github.com/zookanalytics/bmad-orchestrator/pull/90) [`228b7de`](https://github.com/zookanalytics/bmad-orchestrator/commit/228b7dea981cbfafacf6fae17f363a2a43bc1091) Thanks [@johnzook](https://github.com/johnzook)! - Fix localhost access blocked by domain-based firewall filtering

  Chrome 145+ resolves localhost to [::1] (IPv6 only), but the firewall only configured
  iptables (IPv4) rules. Added ip6tables loopback rules and defense-in-depth IPv4 ipset
  entries to ensure localhost is never blocked.

- [#88](https://github.com/zookanalytics/bmad-orchestrator/pull/88) [`321ad48`](https://github.com/zookanalytics/bmad-orchestrator/commit/321ad48f737cfb89a5965f58d6b1462fbbf850a7) Thanks [@johnzook](https://github.com/johnzook)! - Persist Convex config across container rebuilds by symlinking ~/.convex to shared-data volume

## 0.12.0

### Minor Changes

- [#84](https://github.com/zookanalytics/bmad-orchestrator/pull/84) [`09d9188`](https://github.com/zookanalytics/bmad-orchestrator/commit/09d91883868f87b0b41c7bf785c680aa94afdcfd) Thanks [@johnzook](https://github.com/johnzook)! - Add shutdown command and TUI menu option for graceful instance shutdown

### Patch Changes

- [#85](https://github.com/zookanalytics/bmad-orchestrator/pull/85) [`2f88480`](https://github.com/zookanalytics/bmad-orchestrator/commit/2f88480329f3543eca0e85912ef357d5d0ad7190) Thanks [@johnzook](https://github.com/johnzook)! - Derive shell completion commands from the program at runtime instead of a hardcoded list, fixing missing autocomplete for `on` and `code` commands

## 0.11.0

### Minor Changes

- [#82](https://github.com/zookanalytics/bmad-orchestrator/pull/82) [`2cfb078`](https://github.com/zookanalytics/bmad-orchestrator/commit/2cfb0788e3c35eb875d797d66ca25a05fc34f6a7) Thanks [@johnzook](https://github.com/johnzook)! - Add `agent-env path <name>` command and `aecd` shell function for quickly navigating to instance host directories with tab completion

### Patch Changes

- [#83](https://github.com/zookanalytics/bmad-orchestrator/pull/83) [`391e340`](https://github.com/zookanalytics/bmad-orchestrator/commit/391e340a63a04f1ea9604729f092d7fcca683064) Thanks [@johnzook](https://github.com/johnzook)! - Use dnsmasq ipset for reactive domain-to-IP resolution in firewall, fixing dynamic IP staleness for Google/Gemini APIs

## 0.10.0

### Minor Changes

- [#69](https://github.com/zookanalytics/bmad-orchestrator/pull/69) [`496ca81`](https://github.com/zookanalytics/bmad-orchestrator/commit/496ca81392fbb7cd04e6cd5f470cb6bc7a6ca377) Thanks [@johnzook](https://github.com/johnzook)! - Add `on` command for persistent interactive instance menu

  `agent-env on <name>` opens a persistent action menu for a named instance with options to Attach, Open in VS Code, Rebuild, Set Purpose, or Exit. The menu loops after each action, refreshing instance state between iterations. Also replaces the default no-arg interactive menu with an instance picker followed by the same action loop.

- [#75](https://github.com/zookanalytics/bmad-orchestrator/pull/75) [`eadc2f6`](https://github.com/zookanalytics/bmad-orchestrator/commit/eadc2f6239415ec5459f66aef8e6e29786707482) Thanks [@johnzook](https://github.com/johnzook)! - Add non-blocking update check that notifies host users when a newer version is available on npm

  On CLI startup, an async registry check fires concurrently with command execution. After the command completes, a notice is printed to stderr if a newer version exists. Results are cached for 1 hour at `~/.agent-env/update-check.json`. The check is suppressed in non-TTY environments, inside containers, and during local development.

### Patch Changes

- [#66](https://github.com/zookanalytics/bmad-orchestrator/pull/66) [`e886f2f`](https://github.com/zookanalytics/bmad-orchestrator/commit/e886f2fb834975e6df3f1a117ac284be4c8f4dbe) Thanks [@johnzook](https://github.com/johnzook)! - Fix tmux session starting in /workspaces instead of repo directory after container rebuild

## 0.9.1

### Patch Changes

- [#63](https://github.com/zookanalytics/bmad-orchestrator/pull/63) [`893a128`](https://github.com/zookanalytics/bmad-orchestrator/commit/893a128fed966ff4f14e481799132218ed69c235) Thanks [@johnzook](https://github.com/johnzook)! - Fix devcontainer config feedback loop that caused init-host.sh to run twice in parallel during rebuild, crashing on SSH pub key staging. The persistent `.devcontainer/devcontainer.json` symlink was being read back as a repo config by readRepoConfig. Now uses an ephemeral `.devcontainer.json` symlink at workspace root (created before `devcontainer open`, removed after), adds symlink detection in readRepoConfig as defense-in-depth, and makes init-host.sh robust with non-fatal SSH key staging.

## 0.9.0

### Minor Changes

- [#60](https://github.com/zookanalytics/bmad-orchestrator/pull/60) [`e357aea`](https://github.com/zookanalytics/bmad-orchestrator/commit/e357aeaa3534e6b2fd8246af5cdec63734c24a69) Thanks [@johnzook](https://github.com/johnzook)! - Add tmux session persistence across container rebuilds. A claude-wrapper shell script tracks session IDs per tmux pane, and new `tmux-save`/`tmux-restore` CLI commands capture and reconstruct window state. Sessions auto-save periodically and before rebuilds, then restore automatically on container start.

### Patch Changes

- [#58](https://github.com/zookanalytics/bmad-orchestrator/pull/58) [`f4bb8de`](https://github.com/zookanalytics/bmad-orchestrator/commit/f4bb8de744ed1b72d9c826560b479de31a1b3fd2) Thanks [@johnzook](https://github.com/johnzook)! - Suppress misleading image override warning when repo uses the same image as agent-env managed image. Self-heal legacy container names on rebuild by re-deriving the canonical ae-\* name instead of perpetuating random Docker-assigned names from state.

## 0.8.0

### Minor Changes

- [#56](https://github.com/zookanalytics/bmad-orchestrator/pull/56) [`b151353`](https://github.com/zookanalytics/bmad-orchestrator/commit/b15135343956247e721f870cd66053105207f15c) Thanks [@johnzook](https://github.com/johnzook)! - Add PulseAudio audio passthrough for Claude voice mode in containers. New `setup-audio` CLI command configures macOS PulseAudio with TCP module and cookie-based auth, enabling ALSA audio routing from containers to the host.

## 0.7.1

### Patch Changes

- [#51](https://github.com/zookanalytics/bmad-orchestrator/pull/51) [`998d342`](https://github.com/zookanalytics/bmad-orchestrator/commit/998d342c1839f940597aff42505fc99320bf7477) Thanks [@johnzook](https://github.com/johnzook)! - Fix shell autocomplete to complete full workspace names instead of short instance names, resolving WORKSPACE_NOT_FOUND errors when using tab completion with remove and other instance commands

## 0.7.0

### Minor Changes

- [#49](https://github.com/zookanalytics/bmad-orchestrator/pull/49) [`48da277`](https://github.com/zookanalytics/bmad-orchestrator/commit/48da27721088fd355f66fb2836e0d3bf0b261a98) Thanks [@johnzook](https://github.com/johnzook)! - Update shell completion scripts for all registered commands with option and instance name completion, fix zsh completion crash, and show helpful suggestions for unknown commands

## 0.6.0

### Minor Changes

- [#45](https://github.com/zookanalytics/bmad-orchestrator/pull/45) [`4939dbb`](https://github.com/zookanalytics/bmad-orchestrator/commit/4939dbb5a21d03fe98f6254bb09fd6838963746e) Thanks [@johnzook](https://github.com/johnzook)! - Add devcontainer config merge pipeline that replaces the binary baseline/repo choice with a deep merge strategy, always combining managed properties with repo config

### Patch Changes

- [#42](https://github.com/zookanalytics/bmad-orchestrator/pull/42) [`8f6b9f9`](https://github.com/zookanalytics/bmad-orchestrator/commit/8f6b9f9037dc425c87a0b94edd2294e407347e39) Thanks [@johnzook](https://github.com/johnzook)! - Replace tmux-purpose jq script with TypeScript CLI subcommand and fix status bar template deployment for repo-config instances

## 0.5.0

### Minor Changes

- [#32](https://github.com/zookanalytics/bmad-orchestrator/pull/32) [`a0249da`](https://github.com/zookanalytics/bmad-orchestrator/commit/a0249daa142e4a62adca6822b42f46bd17889e96) Thanks [@johnzook](https://github.com/johnzook)! - Add pbcopy clipboard script using OSC 52
  - Add pbcopy shim that copies stdin to system clipboard via OSC 52 escape sequences
  - Enable tmux set-clipboard on for reliable OSC 52 relay through nested tmux/SSH/Docker pty chains

- [#39](https://github.com/zookanalytics/bmad-orchestrator/pull/39) [`98bd9cd`](https://github.com/zookanalytics/bmad-orchestrator/commit/98bd9cd093d147554b8f83b6ff73ec5655e35b7d) Thanks [@johnzook](https://github.com/johnzook)! - Add VS Code status bar purpose display and repo listing
  - Add status bar template rendering with `{{PURPOSE}}` substitution and configurable template resolution
  - Add filewatcher to refresh Better Status Bar extension when statusBar.json changes externally
  - Add read-only `agent-env repos` command for listing repositories derived from workspace state
  - Support repo slugs in the `create` command for quick instance creation from listed repos

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
