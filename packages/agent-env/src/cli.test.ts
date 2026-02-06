import { execa } from 'execa';
import { describe, it, expect } from 'vitest';

// Helper function to strip ANSI escape codes
function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[\d+m/g, '');
}

describe('agent-env CLI', () => {
  const runCli = async (args: string[]) => {
    return execa('tsx', ['src/cli.ts', ...args], {
      cwd: import.meta.dirname?.replace('/src', '') ?? process.cwd(),
      reject: false,
    });
  };

  describe('--help', () => {
    it('displays usage information', async () => {
      const result = await runCli(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent-env');
      expect(result.stdout).toContain('Usage:');
    });

    it('lists available commands', async () => {
      const result = await runCli(['--help']);

      expect(result.stdout).toContain('create');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('attach');
      expect(result.stdout).toContain('remove');
      expect(result.stdout).toContain('purpose');
      expect(result.stdout).toContain('completion');
    });
  });

  describe('--version', () => {
    it('displays version number', async () => {
      const result = await runCli(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('no arguments', () => {
    it('shows help output in non-TTY mode (piped)', async () => {
      // When stdin is not a TTY (e.g., piped/scripted via execa), falls back to help
      const result = await runCli([]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
    });
  });

  describe('create command', () => {
    it('create without --repo shows missing option error', async () => {
      const result = await runCli(['create', 'test-instance']);
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(/❌ \[MISSING_OPTION\] The --repo flag is required\./);
    });

    it('create --help shows --repo and --attach options', async () => {
      const result = await runCli(['create', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--repo');
      expect(result.stdout).toContain('--attach');
    });

    it('create with --repo . resolves current directory git remote', async () => {
      // This test runs in the actual repo, so --repo . will resolve to
      // the real origin URL. It will then fail at clone (already exists),
      // but the key is it gets past MISSING_OPTION and attempts resolution.
      const result = await runCli(['create', 'test-instance', '--repo', '.']);
      const output = stripAnsiCodes(result.stdout + result.stderr);

      // Should NOT show MISSING_OPTION error
      expect(output).not.toContain('MISSING_OPTION');
      // Should show "Creating instance" (meaning URL was resolved)
      expect(output).toContain('Creating instance');
    }, 15000);
  });

  describe('list command', () => {
    it('list shows no instances when workspace directory does not exist', async () => {
      const result = await runCli(['list']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No instances found');
    });

    it('list --json returns valid JSON with empty data when no instances', async () => {
      const result = await runCli(['list', '--json']);

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.ok).toBe(true);
      expect(output.data).toEqual([]);
      expect(output.error).toBeNull();
    });

    it('ps alias works identically to list', async () => {
      const result = await runCli(['ps']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No instances found');
    });
  });

  describe('attach command', () => {
    it('attach shows instance not found when instance does not exist', async () => {
      const result = await runCli(['attach', 'test-instance']);
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(
        /❌ \[WORKSPACE_NOT_FOUND\] Instance 'test-instance' not found/
      );
    });
  });

  describe('purpose command', () => {
    it('purpose shows instance not found when instance does not exist', async () => {
      const result = await runCli(['purpose', 'test-instance']);
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(
        /❌ \[WORKSPACE_NOT_FOUND\] Instance 'test-instance' not found/
      );
    });
  });

  describe('completion command', () => {
    it('completion bash outputs bash completion script', async () => {
      const result = await runCli(['completion', 'bash']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('#!/usr/bin/env bash');
      expect(result.stdout).toContain('complete -F _agent_env_completions agent-env');
    });

    it('completion zsh outputs zsh completion script', async () => {
      const result = await runCli(['completion', 'zsh']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('#compdef agent-env');
      expect(result.stdout).toContain('_agent_env');
    });

    it('completion --help shows installation instructions', async () => {
      const result = await runCli(['completion', '--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('eval "$(agent-env completion bash)"');
      expect(result.stdout).toContain('eval "$(agent-env completion zsh)"');
    });
  });

  describe('placeholder commands', () => {
    it('remove shows not implemented message', async () => {
      const result = await runCli(['remove', 'test-instance']);
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(
        /❌ \[NotImplemented\] Remove command not yet implemented for instance: test-instance\./
      );
    });
  });
});
