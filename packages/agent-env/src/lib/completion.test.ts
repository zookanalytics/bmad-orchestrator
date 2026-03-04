import { describe, expect, it } from 'vitest';

import { generateCompletionScript, getInstallInstructions, isValidShell } from './completion.js';

describe('completion', () => {
  describe('generateCompletionScript', () => {
    describe('bash', () => {
      it('generates a valid bash completion script', () => {
        const script = generateCompletionScript('bash');
        expect(script).toContain('#!/usr/bin/env bash');
        expect(script).toContain('_agent_env_completions');
        expect(script).toContain('complete -F _agent_env_completions agent-env');
      });

      it('includes all registered commands', () => {
        const script = generateCompletionScript('bash');
        expect(script).toContain('create');
        expect(script).toContain('list');
        expect(script).toContain('ps');
        expect(script).toContain('attach');
        expect(script).toContain('rebuild');
        expect(script).toContain('remove');
        expect(script).toContain('repos');
        expect(script).toContain('purpose');
        expect(script).toContain('tmux-status');
        expect(script).toContain('completion');
      });

      it('completes instance names and --repo for attach and purpose', () => {
        const script = generateCompletionScript('bash');
        expect(script).toContain('~/.agent-env/workspaces');
        expect(script).toContain('attach|purpose');
        // [^;]* constrains match to within the case block (before ;;)
        expect(script).toMatch(/attach\|purpose\)[^;]*--repo/);
        expect(script).toMatch(/attach\|purpose\)[^;]*_agent_env_instances/);
      });

      it('completes options and instance names for rebuild', () => {
        const script = generateCompletionScript('bash');
        expect(script).toMatch(/rebuild\)[^;]*--force/);
        expect(script).toMatch(/rebuild\)[^;]*--yes/);
        expect(script).toMatch(/rebuild\)[^;]*--no-pull/);
        expect(script).toMatch(/rebuild\)[^;]*--use-cache/);
        expect(script).toMatch(/rebuild\)[^;]*--repo/);
        expect(script).toMatch(/rebuild\)[^;]*_agent_env_instances/);
      });

      it('completes options and instance names for remove', () => {
        const script = generateCompletionScript('bash');
        expect(script).toMatch(/remove\)[^;]*--force/);
        expect(script).toMatch(/remove\)[^;]*--repo/);
        expect(script).toMatch(/remove\)[^;]*_agent_env_instances/);
      });

      it('does not offer --yes for remove (requires --force context)', () => {
        const script = generateCompletionScript('bash');
        // Extract the remove case block and verify --yes is absent
        const removeBlock = script.match(/remove\)([^;]*)/)?.[1] ?? '';
        expect(removeBlock).not.toContain('--yes');
      });

      it('completes --json for repos', () => {
        const script = generateCompletionScript('bash');
        expect(script).toMatch(/repos\)[^;]*--json/);
      });

      it('has explicit tmux-status case with no completions', () => {
        const script = generateCompletionScript('bash');
        expect(script).toMatch(/tmux-status\)/);
      });

      it('completes repo slugs after --repo', () => {
        const script = generateCompletionScript('bash');
        expect(script).toMatch(/--repo\)[^;]*_agent_env_repos/);
      });

      it('includes option completion for create command', () => {
        const script = generateCompletionScript('bash');
        expect(script).toMatch(/create\)[^;]*--repo/);
        expect(script).toMatch(/create\)[^;]*--purpose/);
        expect(script).toMatch(/create\)[^;]*--attach/);
      });

      it('includes option completion for list command', () => {
        const script = generateCompletionScript('bash');
        expect(script).toMatch(/list\|ps\)[^;]*--json/);
        expect(script).toMatch(/list\|ps\)[^;]*--repo/);
      });

      it('includes shell type completion for completion command', () => {
        const script = generateCompletionScript('bash');
        expect(script).toContain('bash zsh');
      });

      it('uses portable commands instead of GNU find -printf', () => {
        const script = generateCompletionScript('bash');
        expect(script).not.toContain('-printf');
      });

      it('parses flat workspace layout for repos and instances', () => {
        const script = generateCompletionScript('bash');
        // Repos: extract prefix before last hyphen
        expect(script).toMatch(/_agent_env_repos\(\).*\$\{base%-\*\}/s);
        // Instances: extract suffix after last hyphen
        expect(script).toMatch(/_agent_env_instances\(\).*\$\{base##\*-\}/s);
      });
    });

    describe('zsh', () => {
      it('generates a valid zsh completion script', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('#compdef agent-env');
        expect(script).toContain('_agent_env');
        // Final line should register the completion function, not call it directly
        expect(script.trim().endsWith('compdef _agent_env agent-env')).toBe(true);
      });

      it('includes all registered commands with descriptions', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('create:Create a new instance');
        expect(script).toContain('list:List all instances');
        expect(script).toContain('attach:Attach to an instance tmux session');
        expect(script).toContain('rebuild:Rebuild an instance container');
        expect(script).toContain('remove:Remove an instance');
        expect(script).toContain('repos:List tracked repositories');
        expect(script).toContain('purpose:Get or set instance purpose');
        expect(script).toContain('tmux-status:Show tmux status bar info');
        expect(script).toContain('completion:Generate shell completion script');
      });

      it('completes instance names and --repo for attach and purpose', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('_agent_env_instances');
        expect(script).toContain('~/.agent-env/workspaces');
        expect(script).toMatch(/attach\|purpose\)[^;]*--repo/);
      });

      it('completes options and instance names for rebuild', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toMatch(/rebuild\)[^;]*--force/);
        expect(script).toMatch(/rebuild\)[^;]*--yes/);
        expect(script).toMatch(/rebuild\)[^;]*--no-pull/);
        expect(script).toMatch(/rebuild\)[^;]*--use-cache/);
        expect(script).toMatch(/rebuild\)[^;]*_agent_env_instances/);
      });

      it('completes options and instance names for remove without --yes', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toMatch(/remove\)[^;]*--force/);
        expect(script).toMatch(/remove\)[^;]*--repo/);
        expect(script).toMatch(/remove\)[^;]*_agent_env_instances/);
        // --yes not offered (requires --force context)
        const removeBlock = script.match(/remove\)([^;]*)/)?.[1] ?? '';
        expect(removeBlock).not.toContain('--yes');
      });

      it('completes --json for repos', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toMatch(/repos\)[^;]*--json/);
      });

      it('has explicit tmux-status case', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toMatch(/tmux-status\)/);
      });

      it('wires _agent_env_repos to --repo options', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('_agent_env_repos');
        expect(script).toMatch(/--repo\[.*\]:slug:_agent_env_repos/);
      });

      it('includes option completion for create command', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('--repo');
        expect(script).toContain('--purpose');
        expect(script).toContain('--attach');
      });

      it('includes option completion for list command', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toMatch(/list\|ps\)[^;]*--json/);
        expect(script).toMatch(/list\|ps\)[^;]*--repo/);
      });

      it('uses portable commands instead of GNU find -printf', () => {
        const script = generateCompletionScript('zsh');
        expect(script).not.toContain('-printf');
      });

      it('parses flat workspace layout for repos and instances', () => {
        const script = generateCompletionScript('zsh');
        // Repos: extract prefix before last hyphen
        expect(script).toMatch(/_agent_env_repos\(\).*\$\{base%-\*\}/s);
        // Instances: extract suffix after last hyphen
        expect(script).toMatch(/_agent_env_instances\(\).*\$\{base##\*-\}/s);
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
