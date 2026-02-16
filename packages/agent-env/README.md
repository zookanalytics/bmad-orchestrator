# @zookanalytics/agent-env

CLI for creating isolated, AI-ready development environments.

## Installation

```bash
npm install -g @zookanalytics/agent-env
```

## Requirements

- Node.js >= 20
- Docker (OrbStack recommended on macOS)

## Workspace Structure

Each agent environment creates a `.agent-env/` directory inside the workspace to store instance-specific data:

```
<workspace>/
├── .agent-env/          # Instance data (git-ignored)
│   ├── state.json       # Instance metadata (repo URL, container name, config source)
│   ├── ssh/             # SSH host keys (container identity)
│   │   ├── ssh_host_ed25519_key
│   │   ├── ssh_host_ed25519_key.pub
│   │   ├── ssh_host_rsa_key
│   │   └── ssh_host_rsa_key.pub
│   ├── devcontainer.json  # Baseline config (only if using baseline)
│   └── init-host.sh       # Baseline init script (only if using baseline)
├── .devcontainer/       # Project's devcontainer config (if present)
└── <your code>
```

**What's in `.agent-env/`:**

- **`state.json`** - Instance metadata including repository URL, container name, and configuration source
- **`ssh/`** - SSH host keys that persist across container restarts, preventing "host identification changed" warnings
- **`devcontainer.json`** - Copied from baseline config when creating instances without their own `.devcontainer/`
- **`init-host.sh`** - Host-side initialization script (baseline configs only)

**Git exclusion:**

The `.agent-env/` directory is automatically added to `.git/info/exclude` so instance state doesn't appear as untracked files in your git status.

## SSH Access

Each agent environment runs an SSH server, allowing you to connect directly:

```bash
# On OrbStack (recommended)
ssh node@ae-<instance-name>.orb.local

# Via port forwarding (automatic fallback)
ssh -p <port> node@localhost

# Find connection details
agent-env list  # Shows SSH connection strings
```

### How It Works

**Host Keys (Container Identity)**

Each container generates unique SSH host keys on first creation, stored in `.agent-env/ssh/` inside the workspace:
- `ssh_host_ed25519_key` / `ssh_host_ed25519_key.pub`
- `ssh_host_rsa_key` / `ssh_host_rsa_key.pub`

These persist across container stops/starts/rebuilds, ensuring you don't get "host identification changed" warnings. They identify the SSH **server** (the container's sshd).

**User Keys (Your Identity)**

Your public SSH keys from `~/.ssh/*.pub` are automatically staged into the container's `authorized_keys`. The private keys remain on your host - containers only see your public keys.

**Why separate host and user keys?**
- **Host keys**: Container proves "I'm the legitimate ae-my-project server"
- **User keys**: You prove "I'm authorized to access this container"

This is standard SSH architecture - the same pattern used by any SSH server.

## Commit Signing Setup

Agent environments support commit signing via **SSH signing** (recommended) or GPG signing.

### SSH Signing (Recommended)

SSH signing is recommended because:
- SSH agent forwarding is built into Docker Desktop
- No additional background processes needed
- Works reliably on macOS with Docker Desktop
- Supported by GitHub, GitLab, and Gitea

**Setup:**

1. **Configure git to use the public key content directly:**

```bash
# Configure git to use SSH signing with the actual key content
git config --global gpg.format ssh
git config --global user.signingkey "$(cat ~/.ssh/id_ed25519.pub)"
git config --global commit.gpgsign true
```

This embeds the public key content in your `.gitconfig`:
```ini
[gpg]
    format = ssh
[user]
    signingkey = ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... user@host
[commit]
    gpgsign = true
```

**Why use the key content instead of a file path?**

Your `.gitconfig` is mounted from the host into containers, but SSH keys are NOT copied in. Instead, the SSH agent socket is forwarded. The public key content acts as an identifier telling git which key pair to use - the actual signing happens via the forwarded SSH agent using your private key.

File paths like `~/.ssh/id_ed25519.pub` won't work because:
- Host path: `/Users/you/.ssh/id_ed25519.pub`
- Container path: `/home/node/.ssh/id_ed25519.pub` (doesn't exist - keys aren't copied)

Using the key content directly avoids this path mismatch entirely.

2. **Verify SSH agent has your key:**

```bash
ssh-add -l  # Should list your SSH key
```

Commit signing will now work in all containers automatically.

### GPG Signing

GPG signing has limitations on macOS with Docker Desktop:
- Unix domain sockets cannot be bind-mounted from macOS to Linux containers
- Requires SSH tunneling or relay processes per container
- Complex lifecycle management

**If you must use GPG:**
- GPG signing works when opening containers in VS Code (built-in forwarding)
- For CLI-based workflows, consider SSH signing instead

## Usage

```bash
# Create a new development environment
agent-env create <workspace-name> [options]

# List all environments
agent-env list

# List environments with JSON output
agent-env list --json

# Attach to an environment
agent-env attach <name>

# Remove an environment
agent-env remove <name>
```

## Commands

### `create`

Create a new isolated development environment.

```bash
agent-env create my-project --repo https://github.com/user/repo
agent-env create my-project --repo .  # Use current directory's git remote
```

### `list`

List all development environments with their status and git state.

```bash
agent-env list          # Human-readable table
agent-env list --json   # Machine-readable JSON
```

### `attach`

Attach to an existing development environment.

```bash
agent-env attach <name>
```

### `remove`

Remove a development environment with safety checks.

```bash
agent-env remove <name>
agent-env remove <name> --force  # Bypass safety checks
```

### `purpose`

Set or view the purpose/description of an environment.

```bash
agent-env purpose <name>                      # Get current purpose
agent-env purpose <name> "Working on feature X"  # Set purpose
```

## License

MIT
