import { describe, expect, it } from 'vitest';

import {
  type CompletionCommandMeta,
  generateCompletionScript,
  getInstallInstructions,
  isValidShell,
} from './completion.js';

/** Standard command metadata matching what cli.ts registers */
const TEST_COMMANDS: CompletionCommandMeta[] = [
  { name: 'create', description: 'Create a new isolated development environment', aliases: [] },
  { name: 'list', description: 'List all instances with status', aliases: ['ps'] },
  { name: 'attach', description: "Attach to an instance's tmux session", aliases: [] },
  { name: 'path', description: 'Print the host directory path for an instance', aliases: [] },
  { name: 'code', description: 'Open an instance in VS Code via Dev Containers', aliases: [] },
  { name: 'rebuild', description: 'Rebuild an instance by recreating its container', aliases: [] },
  { name: 'remove', description: 'Remove an instance with safety checks', aliases: [] },
  { name: 'purpose', description: 'Get or set the purpose of an instance', aliases: [] },
  { name: 'on', description: 'Open the interactive menu for an instance', aliases: [] },
  { name: 'repos', description: 'List tracked repositories', aliases: [] },
  { name: 'tmux-status', description: 'Show tmux status bar info', aliases: [] },
  { name: 'completion', description: 'Generate shell completion script', aliases: [] },
];

describe('completion', () => {
  describe('generateCompletionScript', () => {
    describe('bash', () => {
      it('generates a valid bash completion script', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toContain('#!/usr/bin/env bash');
        expect(script).toContain('_agent_env_completions');
        expect(script).toContain('complete -F _agent_env_completions agent-env');
      });

      it('includes all provided commands and aliases', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        for (const cmd of TEST_COMMANDS) {
          expect(script).toContain(cmd.name);
          for (const alias of cmd.aliases) {
            expect(script).toContain(alias);
          }
        }
      });

      it('completes instance names and --repo for attach, on, code, and purpose', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toContain('~/.agent-env/workspaces');
        // on and code take instance name + --repo, same as attach/path/purpose
        expect(script).toMatch(/on\|code\|attach\|path\|purpose\)[^;]*--repo/);
        expect(script).toMatch(/on\|code\|attach\|path\|purpose\)[^;]*_agent_env_instances/);
      });

      it('completes options and instance names for rebuild', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toMatch(/rebuild\)[^;]*--force/);
        expect(script).toMatch(/rebuild\)[^;]*--yes/);
        expect(script).toMatch(/rebuild\)[^;]*--no-pull/);
        expect(script).toMatch(/rebuild\)[^;]*--use-cache/);
        expect(script).toMatch(/rebuild\)[^;]*--repo/);
        expect(script).toMatch(/rebuild\)[^;]*_agent_env_instances/);
      });

      it('completes options and instance names for remove', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toMatch(/remove\)[^;]*--force/);
        expect(script).toMatch(/remove\)[^;]*--repo/);
        expect(script).toMatch(/remove\)[^;]*_agent_env_instances/);
      });

      it('does not offer --yes for remove (requires --force context)', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        // Extract the remove case block and verify --yes is absent
        const removeBlock = script.match(/remove\)([^;]*)/)?.[1] ?? '';
        expect(removeBlock).not.toContain('--yes');
      });

      it('completes --json for repos', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toMatch(/repos\)[^;]*--json/);
      });

      it('has explicit tmux-status case with no completions', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toMatch(/tmux-status\)/);
      });

      it('completes repo slugs after --repo', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toMatch(/--repo\)[^;]*_agent_env_repos/);
      });

      it('includes option completion for create command', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toMatch(/create\)[^;]*--repo/);
        expect(script).toMatch(/create\)[^;]*--purpose/);
        expect(script).toMatch(/create\)[^;]*--attach/);
      });

      it('includes option completion for list command', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toMatch(/list\|ps\)[^;]*--json/);
        expect(script).toMatch(/list\|ps\)[^;]*--repo/);
      });

      it('includes shell type completion for completion command', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toContain('bash zsh');
      });

      it('uses portable commands instead of GNU find -printf', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).not.toContain('-printf');
      });

      it('parses flat workspace layout for repos', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        // Repos: extract prefix before last hyphen
        expect(script).toMatch(/_agent_env_repos\(\).*\$\{base%-\*\}/s);
      });

      it('uses full workspace name for instance completion', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        // Instances: echo full workspace directory name for exact match resolution
        expect(script).toMatch(/_agent_env_instances\(\).*echo "\$\{base\}"/s);
        // Should NOT extract suffix after last hyphen (old broken pattern)
        const instanceFn = script.match(/_agent_env_instances\(\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
        expect(instanceFn).not.toContain('${base##*-}');
      });

      it('includes aecd shell function with completions', () => {
        const script = generateCompletionScript('bash', TEST_COMMANDS);
        expect(script).toContain('aecd()');
        expect(script).toContain('agent-env path');
        expect(script).toContain('_aecd_completions()');
        expect(script).toContain('complete -F _aecd_completions aecd');
        // aecd completions should use instance names and --repo
        expect(script).toMatch(/_aecd_completions\(\)[\s\S]*_agent_env_instances/);
        expect(script).toMatch(/_aecd_completions\(\)[\s\S]*_agent_env_repos/);
      });
    });

    describe('zsh', () => {
      it('generates a valid zsh completion script', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toContain('#compdef agent-env');
        expect(script).toContain('_agent_env');
        // Should register the main completion function
        expect(script).toContain('compdef _agent_env agent-env');
        // Final line should register the aecd completion function
        expect(script.trim().endsWith('compdef _aecd aecd')).toBe(true);
      });

      it('includes all provided commands with descriptions', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        for (const cmd of TEST_COMMANDS) {
          // Zsh completion uses "name:description" format (truncated to first sentence)
          expect(script).toContain(`${cmd.name}:`);
        }
      });

      it('escapes single quotes in command descriptions', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        // The attach description contains "instance's" — the single quote
        // must be escaped in the zsh commands=(...) block
        const commandsBlock = script.match(/commands=\(\n([\s\S]*?)\n\s*\)/)?.[1] ?? '';
        expect(commandsBlock).not.toContain("instance's");
      });

      it('completes instance names and --repo for on, code, attach, and purpose', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toContain('_agent_env_instances');
        expect(script).toContain('~/.agent-env/workspaces');
        expect(script).toMatch(/on\|code\|attach\|path\|purpose\)[^;]*--repo/);
      });

      it('completes options and instance names for rebuild', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toMatch(/rebuild\)[^;]*--force/);
        expect(script).toMatch(/rebuild\)[^;]*--yes/);
        expect(script).toMatch(/rebuild\)[^;]*--no-pull/);
        expect(script).toMatch(/rebuild\)[^;]*--use-cache/);
        expect(script).toMatch(/rebuild\)[^;]*_agent_env_instances/);
      });

      it('completes options and instance names for remove without --yes', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toMatch(/remove\)[^;]*--force/);
        expect(script).toMatch(/remove\)[^;]*--repo/);
        expect(script).toMatch(/remove\)[^;]*_agent_env_instances/);
        // --yes not offered (requires --force context)
        const removeBlock = script.match(/remove\)([^;]*)/)?.[1] ?? '';
        expect(removeBlock).not.toContain('--yes');
      });

      it('completes --json for repos', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toMatch(/repos\)[^;]*--json/);
      });

      it('has explicit tmux-status case', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toMatch(/tmux-status\)/);
      });

      it('wires _agent_env_repos to --repo options', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toContain('_agent_env_repos');
        expect(script).toMatch(/--repo\[.*\]:slug:_agent_env_repos/);
      });

      it('includes option completion for create command', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toContain('--repo');
        expect(script).toContain('--purpose');
        expect(script).toContain('--attach');
      });

      it('includes option completion for list command', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toMatch(/list\|ps\)[^;]*--json/);
        expect(script).toMatch(/list\|ps\)[^;]*--repo/);
      });

      it('uses portable commands instead of GNU find -printf', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).not.toContain('-printf');
      });

      it('parses flat workspace layout for repos', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        // Repos: extract prefix before last hyphen
        expect(script).toMatch(/_agent_env_repos\(\).*\$\{base%-\*\}/s);
      });

      it('uses full workspace name for instance completion', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        // Instances: add full workspace directory name for exact match resolution
        const instanceFn = script.match(/_agent_env_instances\(\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
        expect(instanceFn).toContain('instances+=("${base}")');
        // Should NOT extract suffix after last hyphen (old broken pattern)
        expect(instanceFn).not.toContain('${base##*-}');
      });

      it('includes aecd shell function with completions', () => {
        const script = generateCompletionScript('zsh', TEST_COMMANDS);
        expect(script).toContain('aecd()');
        expect(script).toContain('agent-env path');
        expect(script).toContain('_aecd()');
        expect(script).toContain('compdef _aecd aecd');
        // aecd zsh completer should wire instance names and repo
        expect(script).toMatch(/_aecd\(\)[^}]*_agent_env_instances/s);
        expect(script).toMatch(/_aecd\(\)[^}]*_agent_env_repos/s);
      });
    });
  });

  describe('isValidShell', () => {
    it('returns true for bash', () => {
      expect(isValidShell('bash')).toBe(true);
    });

    it('returns true for zsh', () => {
      expect(isValidShell('zsh')).toBe(true);
    });

    it('returns false for unsupported shells', () => {
      expect(isValidShell('fish')).toBe(false);
      expect(isValidShell('powershell')).toBe(false);
      expect(isValidShell('')).toBe(false);
    });
  });

  describe('extractCompletionCommands', () => {
    it('derives command metadata from a Commander program', async () => {
      const { Command } = await import('commander');
      const prog = new Command();
      prog.addCommand(new Command('foo').description('Do foo'));
      prog.addCommand(new Command('bar').description('Do bar').alias('b'));
      prog.addCommand(new Command('internal').description('Internal only'));

      const { extractCompletionCommands } = await import('./completion.js');
      const commands = extractCompletionCommands(prog, new Set(['internal']));

      expect(commands).toEqual([
        { name: 'foo', description: 'Do foo', aliases: [] },
        { name: 'bar', description: 'Do bar', aliases: ['b'] },
      ]);
    });

    it('includes all cli.ts commands except excluded ones', async () => {
      // This test imports the real CLI program to ensure new commands
      // are automatically picked up by completion
      const { Command } = await import('commander');
      const { extractCompletionCommands, COMPLETION_EXCLUDED_COMMANDS } =
        await import('./completion.js');

      // Build a program with the same commands as cli.ts
      const { attachCommand } = await import('../commands/attach.js');
      const { codeCommand } = await import('../commands/code.js');
      const { completionCommand } = await import('../commands/completion.js');
      const { createCommand } = await import('../commands/create.js');
      const { listCommand } = await import('../commands/list.js');
      const { onCommand } = await import('../commands/on.js');
      const { pathCommand } = await import('../commands/path.js');
      const { purposeCommand } = await import('../commands/purpose.js');
      const { rebuildCommand } = await import('../commands/rebuild.js');
      const { removeCommand } = await import('../commands/remove.js');
      const { reposCommand } = await import('../commands/repos.js');
      const { setupAudioCommand } = await import('../commands/setup-audio.js');
      const { tmuxRestoreCommand } = await import('../commands/tmux-restore.js');
      const { tmuxSaveCommand } = await import('../commands/tmux-save.js');
      const { tmuxStatusCommand } = await import('../commands/tmux-status.js');

      const prog = new Command();
      // Same order as cli.ts
      for (const cmd of [
        createCommand,
        listCommand,
        attachCommand,
        pathCommand,
        codeCommand,
        rebuildCommand,
        removeCommand,
        purposeCommand,
        onCommand,
        reposCommand,
        tmuxStatusCommand,
        tmuxSaveCommand,
        tmuxRestoreCommand,
        completionCommand,
        setupAudioCommand,
      ]) {
        // Commander mutates commands, so we need fresh copies for test isolation
        const fresh = new Command(cmd.name()).description(cmd.description());
        for (const alias of cmd.aliases()) {
          fresh.alias(alias);
        }
        prog.addCommand(fresh);
      }

      const commands = extractCompletionCommands(prog, COMPLETION_EXCLUDED_COMMANDS);
      const names = commands.map((c) => c.name);

      // User-facing commands must be present
      expect(names).toContain('on');
      expect(names).toContain('code');
      expect(names).toContain('create');
      expect(names).toContain('attach');

      // Internal commands must be excluded
      for (const excluded of COMPLETION_EXCLUDED_COMMANDS) {
        expect(names).not.toContain(excluded);
      }
    });
  });

  describe('getInstallInstructions', () => {
    it('includes bash installation instructions', () => {
      const instructions = getInstallInstructions();
      expect(instructions).toContain('Bash:');
      expect(instructions).toContain('eval "$(agent-env completion bash)"');
    });

    it('includes zsh installation instructions', () => {
      const instructions = getInstallInstructions();
      expect(instructions).toContain('Zsh:');
      expect(instructions).toContain('eval "$(agent-env completion zsh)"');
    });
  });
});
