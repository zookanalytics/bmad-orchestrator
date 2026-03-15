# PulseAudio Passthrough for Claude Voice Mode

**Date:** 2026-03-15
**Status:** Draft

## Problem

Claude voice mode uses ALSA for audio I/O. Agent-env containers run inside a Linux VM (OrbStack/Docker Desktop) on macOS, with no audio stack. We need to route ALSA calls from inside the container to the PulseAudio server running on the macOS host so that voice mode works.

## Constraints

- macOS host runs standard Homebrew PulseAudio 17.0 (default config, Unix socket only)
- Container runs inside a Linux VM -- cannot bind-mount macOS Unix sockets directly
- Agent-env has a firewall that restricts outbound traffic; `host.docker.internal` may resolve to an IP outside the HOST_NETWORK /24 allowance (e.g., OrbStack uses `0.250.250.254`)
- No new bind mounts -- use existing mounts and the shared-data volume
- Audio support is opt-in: user must run a one-time setup command on the host

## Design

### Architecture Overview

```
Container (ALSA app)
  -> /etc/asound.conf routes ALSA to PulseAudio
    -> PulseAudio client reads PULSE_SERVER env var
      -> TCP connection to host.docker.internal:4713
        -> macOS PulseAudio server (module-native-protocol-tcp, listen=127.0.0.1)
          -> Host speakers/microphone
```

Authentication: PulseAudio cookie (staged from host, promoted to shared-data volume).

### User Workflow

1. One-time on macOS host: `agent-env setup-audio`
2. Start or rebuild any container -- audio works automatically
3. Claude voice mode uses ALSA, which is transparently routed to the host

### Component Changes

#### 1. Dockerfile (`image/Dockerfile`)

**apt-get additions** to the existing install block:

- `pulseaudio-utils` -- PulseAudio client libraries and CLI tools (`pacat`, `paplay`, `parec`)
- `libasound2-plugins` -- ALSA plugin that routes audio through PulseAudio
- `alsa-utils` -- ALSA utilities (`aplay`, `arecord`) for testing and diagnostics

**New config file** copied into the image:

- `image/config/asound.conf` -> `/etc/asound.conf`

Contents:

```
pcm.default pulse
ctl.default pulse
```

This tells ALSA to use PulseAudio as its default backend. Any application using ALSA (including Claude voice mode) will transparently route through PulseAudio.

#### 2. Dockerfile LABEL Metadata (`image/Dockerfile`)

Add two environment variables to the existing `containerEnv` in the LABEL:

```json
"PULSE_SERVER": "tcp:host.docker.internal:4713",
"PULSE_COOKIE": "/shared-data/pulse/cookie"
```

- `PULSE_SERVER` tells the PulseAudio client library where to connect
- `PULSE_COOKIE` points to the authentication cookie in the shared-data volume

**No new mounts.** The cookie reaches the container via the existing per-workspace `.agent-env` bind mount (`${localWorkspaceFolder}/.agent-env` -> `/etc/agent-env`), then gets promoted to shared-data by `post-create.sh`.

**Firewall:** `host.docker.internal` may resolve to an IP outside the HOST_NETWORK /24 (e.g., OrbStack uses `0.250.250.254`). Add `host.docker.internal` to the base image's `/etc/allowed-domains.txt` so the firewall resolves it and adds it to the ipset. This ensures all agent-env containers can reach the host regardless of container runtime.

**PULSE_COOKIE when audio is not configured:** When the cookie file does not exist, the PulseAudio client library silently fails to authenticate. No error messages are written to stderr. The env var pointing to a non-existent path is harmless.

#### 3. Host-Side Setup Command (`packages/agent-env/src/commands/setup-audio.ts`)

New CLI command: `agent-env setup-audio`

Runs on the macOS host (not in the container). Steps:

1. **Platform check** -- verifies `process.platform === 'darwin'`. On Linux, exits with a message that audio passthrough is macOS-only.
2. **PulseAudio check** -- verifies PulseAudio is installed via Homebrew (`brew --prefix pulseaudio`). Exits with install instructions if not found.
3. **Load TCP module** -- runs `pactl load-module module-native-protocol-tcp auth-cookie-enabled=1 listen=127.0.0.1 port=4713`. Checks `pactl list short modules | grep module-native-protocol-tcp` first to skip if already loaded. The `listen=127.0.0.1` restricts the TCP listener to localhost only, preventing connections from other machines on the network.
4. **Persist to default.pa** -- appends `load-module module-native-protocol-tcp auth-cookie-enabled=1 listen=127.0.0.1 port=4713` to `$(brew --prefix)/etc/pulse/default.pa` if the line is not already present. Uses `brew --prefix` to support both Apple Silicon (`/opt/homebrew`) and Intel (`/usr/local`) Macs. This ensures the TCP module survives PulseAudio restarts.
5. **Stage cookie** -- copies `~/.config/pulse/cookie` to `~/.agent-env/pulse/cookie` (creates directory if needed).
6. **Success message** -- confirms setup is complete, instructs user that audio will be available on next container start or rebuild.

The command is idempotent -- safe to run multiple times. Re-running refreshes the staged cookie (important if PulseAudio regenerates its cookie after a reinstall or upgrade).

Register in `cli.ts` alongside existing commands.

#### 4. Host-Side Transport (`packages/agent-env/config/baseline/init-host.sh`)

Add a new block after the SSH pub keys section:

1. Check if `$HOME/.agent-env/pulse/cookie` exists (indicates `agent-env setup-audio` was run previously).
2. If found, copy to the workspace's `.agent-env/pulse/cookie` (destination: `${PWD}/.agent-env/pulse/cookie`) so it rides the existing bind mount into the container at `/etc/agent-env/pulse/cookie`. Always overwrites to pick up any cookie refresh from a re-run of `setup-audio`.
3. If not found, silently skip. Audio is opt-in -- no warning messages.

This follows the same pattern as SSH pub key staging.

#### 5. Container-Side Promotion (`image/scripts/post-create.sh`)

Add a new step following the credential discovery/promotion pattern:

1. Check `/etc/agent-env/pulse/cookie` (the bind-mount bridge from init-host.sh).
2. If found, create `/shared-data/pulse/` directory and copy the cookie there, always overwriting. This ensures cookie rotations on the host propagate to shared-data on the next container create/rebuild.
3. Set permissions readable by the node user.
4. If `/etc/agent-env/pulse/cookie` does not exist, skip silently.

Note: There is a brief timing window between container creation and post-create.sh completion where `/shared-data/pulse/cookie` may not yet exist. This is a non-issue in practice -- Claude voice mode would not start before the container is fully initialized.

### Files Changed

| File | Change |
|------|--------|
| `image/Dockerfile` | Add `pulseaudio-utils`, `libasound2-plugins`, `alsa-utils` to apt-get; COPY asound.conf; add `PULSE_SERVER` and `PULSE_COOKIE` to LABEL containerEnv |
| `image/config/asound.conf` | New file (2 lines) |
| `image/config/allowed-domains.txt` | Add `host.docker.internal` for firewall passthrough |
| `packages/agent-env/config/baseline/init-host.sh` | Add PulseAudio cookie staging block |
| `image/scripts/post-create.sh` | Add PulseAudio cookie promotion step |
| `packages/agent-env/src/commands/setup-audio.ts` | New CLI command |
| `packages/agent-env/src/cli.ts` | Register setup-audio command |

### Graceful Degradation

If the user has not run `agent-env setup-audio`:

- The ALSA packages and asound.conf are installed but inert
- `PULSE_SERVER` and `PULSE_COOKIE` env vars are set but the PulseAudio client will silently fail to connect (no server listening, no cookie file)
- No errors, no warnings at container startup -- audio simply is not available
- All non-audio workloads are completely unaffected

### Testing

- **Manual:** Run `agent-env setup-audio` on macOS, start a container, run `pacat /dev/urandom` or `aplay -l` to verify audio reaches the host
- **Unit tests:** `setup-audio.ts` command logic (platform detection, idempotency, `brew --prefix` resolution)
- **Integration:** Verify init-host.sh copies cookie when present (always overwrites), skips when absent; verify post-create.sh promotes cookie to shared-data (always overwrites)
- **Cookie rotation:** Run `setup-audio` again after PulseAudio reinstall; verify new cookie propagates through the chain on next container rebuild
- **Firewall:** Verify `host.docker.internal` is resolvable and reachable on port 4713 from inside the container
- **Graceful failure:** Verify container starts cleanly when PulseAudio is not running on the host (no errors, no warnings)
