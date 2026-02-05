# @zookanalytics/agent-env

CLI for creating isolated, AI-ready development environments.

## Installation

```bash
npm install -g @zookanalytics/agent-env
```

## Requirements

- Node.js >= 20
- Docker (OrbStack recommended on macOS)

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
