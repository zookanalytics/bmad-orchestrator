/**
 * Shell completion script generation for agent-env
 *
 * Generates bash and zsh completion scripts that provide:
 * - Command name completion (create, list, attach, remove, purpose, completion)
 * - Dynamic instance name completion for commands that accept instance names
 */

/** Supported shell types for completion */
export type ShellType = 'bash' | 'zsh';

/** All registered agent-env commands */
const COMMANDS = ['create', 'list', 'ps', 'attach', 'remove', 'purpose', 'completion'];

/** Commands that accept an instance name as their first argument */
const INSTANCE_COMMANDS = ['attach', 'purpose'];

/**
 * Generate a shell completion script for the specified shell
 * @param shell - The target shell type ('bash' or 'zsh')
 * @returns The completion script as a string
 */
export function generateCompletionScript(shell: ShellType): string {
  switch (shell) {
    case 'bash':
      return generateBashCompletion();
    case 'zsh':
      return generateZshCompletion();
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

function generateBashCompletion(): string {
  const commandList = COMMANDS.join(' ');
  const instanceCommandList = INSTANCE_COMMANDS.join('|');

  return `#!/usr/bin/env bash
# agent-env bash completion script
# Install: eval "$(agent-env completion bash)"

_agent_env_instances() {
  local ws_dir=~/.agent-env/workspaces
  if [[ -d "\${ws_dir}" ]]; then
    ls "\${ws_dir}" 2>/dev/null
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
    ${instanceCommandList})
      COMPREPLY=($(compgen -W "$(_agent_env_instances)" -- "\${cur}"))
      return 0
      ;;
    create)
      COMPREPLY=($(compgen -W "--repo --attach" -- "\${cur}"))
      return 0
      ;;
    list|ps)
      COMPREPLY=($(compgen -W "--json" -- "\${cur}"))
      return 0
      ;;
    remove)
      local instances
      instances="$(_agent_env_instances)"
      COMPREPLY=($(compgen -W "--force \${instances}" -- "\${cur}"))
      return 0
      ;;
    completion)
      COMPREPLY=($(compgen -W "bash zsh" -- "\${cur}"))
      return 0
      ;;
  esac

  return 0
}

complete -F _agent_env_completions agent-env`;
}

function generateZshCompletion(): string {
  const commandDescriptions = [
    'create:Create a new instance',
    'list:List all instances',
    'ps:List all instances (alias)',
    'attach:Attach to an instance tmux session',
    'remove:Remove an instance',
    'purpose:Get or set instance purpose',
    'completion:Generate shell completion script',
  ];

  return `#compdef agent-env
# agent-env zsh completion script
# Install: eval "$(agent-env completion zsh)"

_agent_env_instances() {
  local ws_dir=~/.agent-env/workspaces
  local -a instances
  if [[ -d "\${ws_dir}" ]]; then
    instances=(\${(f)"$(ls "\${ws_dir}" 2>/dev/null)"})
  fi
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
        attach|purpose)
          _agent_env_instances
          ;;
        create)
          _arguments \\
            '--repo[Repository URL]:url:' \\
            '--attach[Attach after creation]'
          ;;
        list|ps)
          _arguments \\
            '--json[Output as JSON]'
          ;;
        remove)
          _arguments \\
            '--force[Force removal]' \\
            '1:instance:_agent_env_instances'
          ;;
        completion)
          _describe 'shell' '(bash zsh)'
          ;;
      esac
      ;;
  esac
}

_agent_env`;
}
