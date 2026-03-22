/**
 * Shell completion script generation for agent-env
 *
 * Generates bash and zsh completion scripts that provide:
 * - Command name completion for all registered commands
 * - Dynamic workspace name completion for commands that accept instance names
 * - Repo slug completion for --repo options
 *
 * Command list is derived from the program at runtime via extractCompletionCommands(),
 * so new commands automatically get completion without manual updates.
 */

import type { Command } from 'commander';

/** Supported shell types for completion */
export type ShellType = 'bash' | 'zsh';

/** Command metadata for completion generation */
export interface CompletionCommandMeta {
  name: string;
  description: string;
  aliases: string[];
}

/**
 * Commands excluded from shell completion (internal/container-only).
 * All other commands registered on the program are included automatically.
 */
export const COMPLETION_EXCLUDED_COMMANDS = new Set(['tmux-save', 'tmux-restore', 'setup-audio']);

/**
 * Extract completion command metadata from a Commander program.
 * Includes all commands except those in the exclusion set.
 */
export function extractCompletionCommands(
  program: Command,
  excluded: Set<string> = COMPLETION_EXCLUDED_COMMANDS
): CompletionCommandMeta[] {
  return program.commands
    .filter((cmd) => !excluded.has(cmd.name()))
    .map((cmd) => ({
      name: cmd.name(),
      description: cmd.description().split('\n')[0],
      aliases: cmd.aliases(),
    }));
}

/**
 * Generate a shell completion script for the specified shell
 * @param shell - The target shell type ('bash' or 'zsh')
 * @param commands - Command metadata to include in completion
 * @returns The completion script as a string
 */
export function generateCompletionScript(
  shell: ShellType,
  commands: CompletionCommandMeta[]
): string {
  switch (shell) {
    case 'bash':
      return generateBashCompletion(commands);
    case 'zsh':
      return generateZshCompletion(commands);
  }
}

/**
 * Check if a string is a valid shell type
 */
export function isValidShell(shell: string): shell is ShellType {
  return shell === 'bash' || shell === 'zsh';
}

/**
 * Get installation instructions for shell completion
 */
export function getInstallInstructions(): string {
  return `Shell Completion Installation:

  Bash:
    # Add to ~/.bashrc:
    eval "$(agent-env completion bash)"

    # Or save to a file:
    agent-env completion bash > /etc/bash_completion.d/agent-env

  Zsh:
    # Add to ~/.zshrc:
    eval "$(agent-env completion zsh)"

    # Or save to a file (ensure fpath includes the directory):
    agent-env completion zsh > ~/.zsh/completions/_agent-env`;
}

function generateBashCompletion(commands: CompletionCommandMeta[]): string {
  const allNames = commands.flatMap((c) => [c.name, ...c.aliases]);
  const commandList = allNames.join(' ');

  return `#!/usr/bin/env bash
# agent-env bash completion script
# Install: eval "$(agent-env completion bash)"

_agent_env_repos() {
  local ws_dir=~/.agent-env/workspaces
  local entry base repo
  if [[ -d "\${ws_dir}" ]]; then
    for entry in "\${ws_dir}"/*/; do
      [[ -d "\${entry}" ]] || continue
      base="\${entry%/}"
      base="\${base##*/}"
      repo="\${base%-*}"
      [[ "\${repo}" != "\${base}" ]] && echo "\${repo}"
    done | sort -u
  fi
}

_agent_env_instances() {
  local ws_dir=~/.agent-env/workspaces
  local entry base
  if [[ -d "\${ws_dir}" ]]; then
    for entry in "\${ws_dir}"/*/; do
      [[ -d "\${entry}" ]] || continue
      base="\${entry%/}"
      base="\${base##*/}"
      echo "\${base}"
    done | sort -u
  fi
}

_agent_env_completions() {
  local cur prev commands
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="${commandList}"

  # Complete commands at position 1
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=($(compgen -W "\${commands}" -- "\${cur}"))
    return 0
  fi

  # Complete based on command
  case "\${prev}" in
    on|code|attach|path|purpose)
      local instances
      instances="$(_agent_env_instances)"
      COMPREPLY=($(compgen -W "--repo \${instances}" -- "\${cur}"))
      return 0
      ;;
    create)
      COMPREPLY=($(compgen -W "--repo --purpose --attach" -- "\${cur}"))
      return 0
      ;;
    list|ps)
      COMPREPLY=($(compgen -W "--json --repo" -- "\${cur}"))
      return 0
      ;;
    rebuild)
      local instances
      instances="$(_agent_env_instances)"
      COMPREPLY=($(compgen -W "--force --yes --no-pull --use-cache --repo \${instances}" -- "\${cur}"))
      return 0
      ;;
    remove)
      local instances
      instances="$(_agent_env_instances)"
      COMPREPLY=($(compgen -W "--force --repo \${instances}" -- "\${cur}"))
      return 0
      ;;
    repos)
      COMPREPLY=($(compgen -W "--json" -- "\${cur}"))
      return 0
      ;;
    tmux-status)
      # no arguments or options
      return 0
      ;;
    completion)
      COMPREPLY=($(compgen -W "bash zsh" -- "\${cur}"))
      return 0
      ;;
    --repo)
      COMPREPLY=($(compgen -W "$(_agent_env_repos)" -- "\${cur}"))
      return 0
      ;;
  esac

  return 0
}

complete -F _agent_env_completions agent-env

# aecd: cd into an instance's host directory
aecd() {
  local dir
  dir="$(agent-env path "$@")" || return 1
  cd "\${dir}" || return 1
}

_aecd_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local i has_repo=0
  for ((i=1; i < COMP_CWORD; i++)); do
    [[ "\${COMP_WORDS[i]}" == "--repo" ]] && has_repo=1 && break
  done
  if [[ "\${prev}" == "--repo" ]]; then
    COMPREPLY=($(compgen -W "$(_agent_env_repos)" -- "\${cur}"))
  elif [[ "\${cur}" == -* && \${has_repo} -eq 0 ]]; then
    COMPREPLY=($(compgen -W "--repo" -- "\${cur}"))
  else
    COMPREPLY=($(compgen -W "$(_agent_env_instances)" -- "\${cur}"))
  fi
}

complete -F _aecd_completions aecd`;
}

function generateZshCompletion(commands: CompletionCommandMeta[]): string {
  const commandDescriptions = commands.flatMap((cmd) => {
    const entries = [`${cmd.name}:${cmd.description}`];
    for (const alias of cmd.aliases) {
      entries.push(`${alias}:${cmd.description} (alias)`);
    }
    return entries;
  });

  return `#compdef agent-env
# agent-env zsh completion script
# Install: eval "$(agent-env completion zsh)"

_agent_env_repos() {
  local ws_dir=~/.agent-env/workspaces
  local -a repos
  local entry base repo
  if [[ -d "\${ws_dir}" ]]; then
    for entry in "\${ws_dir}"/*/; do
      [[ -d "\${entry}" ]] || continue
      base="\${entry%/}"
      base="\${base##*/}"
      repo="\${base%-*}"
      [[ "\${repo}" != "\${base}" ]] && repos+=("\${repo}")
    done
  fi
  repos=(\${(u)repos})
  _describe 'repo' repos
}

_agent_env_instances() {
  local ws_dir=~/.agent-env/workspaces
  local -a instances
  local entry base
  if [[ -d "\${ws_dir}" ]]; then
    for entry in "\${ws_dir}"/*/; do
      [[ -d "\${entry}" ]] || continue
      base="\${entry%/}"
      base="\${base##*/}"
      instances+=("\${base}")
    done
  fi
  instances=(\${(u)instances})
  _describe 'instance' instances
}

_agent_env() {
  local -a commands
  commands=(
${commandDescriptions.map((desc) => `    '${desc}'`).join('\n')}
  )

  _arguments -C \\
    '--help[Show help]' \\
    '--version[Show version]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        on|code|attach|path|purpose)
          _arguments \\
            '--repo[Repo slug to scope lookup]:slug:_agent_env_repos' \\
            '1:instance:_agent_env_instances'
          ;;
        create)
          _arguments \\
            '--repo[Repository URL]:url:' \\
            '--purpose[Set instance purpose]:text:' \\
            '--attach[Attach after creation]'
          ;;
        list|ps)
          _arguments \\
            '--json[Output as JSON]' \\
            '--repo[Filter by repo slug]:slug:_agent_env_repos'
          ;;
        rebuild)
          _arguments \\
            '--force[Rebuild running container]' \\
            '--yes[Skip confirmation prompt]' \\
            '--no-pull[Skip pulling fresh images]' \\
            '--use-cache[Allow Docker layer cache]' \\
            '--repo[Repo slug to scope lookup]:slug:_agent_env_repos' \\
            '1:instance:_agent_env_instances'
          ;;
        remove)
          _arguments \\
            '--force[Force removal]' \\
            '--repo[Repo slug to scope lookup]:slug:_agent_env_repos' \\
            '1:instance:_agent_env_instances'
          ;;
        repos)
          _arguments \\
            '--json[Output as JSON]'
          ;;
        tmux-status)
          ;;
        completion)
          _describe 'shell' '(bash zsh)'
          ;;
      esac
      ;;
  esac
}

compdef _agent_env agent-env

# aecd: cd into an instance's host directory
# Note: requires eval installation (not fpath autoload) for the function to be available
aecd() {
  local dir
  dir="$(agent-env path "$@")" || return 1
  cd "\${dir}" || return 1
}

_aecd() {
  _arguments \\
    '--repo[Repo slug to scope lookup]:slug:_agent_env_repos' \\
    '1:instance:_agent_env_instances'
}

compdef _aecd aecd`;
}
