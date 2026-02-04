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
        expect(script).toContain('remove');
        expect(script).toContain('purpose');
        expect(script).toContain('completion');
      });

      it('completes instance names for attach and purpose', () => {
        const script = generateCompletionScript('bash');
        // Should scan ~/.agent-env/workspaces/ for instance names
        expect(script).toContain('~/.agent-env/workspaces');
        expect(script).toContain('attach|purpose');
      });

      it('completes instance names and --force for remove', () => {
        const script = generateCompletionScript('bash');
        expect(script).toContain('--force');
        // remove should also offer instance names
        expect(script).toMatch(/remove\)[\s\S]*_agent_env_instances/);
      });

      it('includes option completion for create command', () => {
        const script = generateCompletionScript('bash');
        expect(script).toContain('--repo');
        expect(script).toContain('--attach');
      });

      it('includes option completion for list command', () => {
        const script = generateCompletionScript('bash');
        expect(script).toContain('--json');
      });

      it('includes shell type completion for completion command', () => {
        const script = generateCompletionScript('bash');
        expect(script).toContain('bash zsh');
      });

      it('uses portable commands instead of GNU find -printf', () => {
        const script = generateCompletionScript('bash');
        expect(script).not.toContain('-printf');
        expect(script).toContain('ls');
      });
    });

    describe('zsh', () => {
      it('generates a valid zsh completion script', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('#compdef agent-env');
        expect(script).toContain('_agent_env');
        // Final line should call the completion function
        expect(script.trim().endsWith('_agent_env')).toBe(true);
      });

      it('includes all registered commands with descriptions', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('create:Create a new instance');
        expect(script).toContain('list:List all instances');
        expect(script).toContain('attach:Attach to an instance tmux session');
        expect(script).toContain('remove:Remove an instance');
        expect(script).toContain('purpose:Get or set instance purpose');
        expect(script).toContain('completion:Generate shell completion script');
      });

      it('completes instance names for attach and purpose', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('_agent_env_instances');
        expect(script).toContain('~/.agent-env/workspaces');
      });

      it('completes instance names and --force for remove', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('--force');
        expect(script).toContain('_agent_env_instances');
      });

      it('includes option completion for create command', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('--repo');
        expect(script).toContain('--attach');
      });

      it('includes option completion for list command', () => {
        const script = generateCompletionScript('zsh');
        expect(script).toContain('--json');
      });

      it('uses portable commands instead of GNU find -printf', () => {
        const script = generateCompletionScript('zsh');
        expect(script).not.toContain('-printf');
        expect(script).toContain('ls');
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
