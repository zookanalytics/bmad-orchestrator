import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock process.exit to prevent test runner from exiting
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

// Import after mocks are set up
const { completionCommand } = await import('./completion.js');

describe('completion command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('outputs bash completion script for "bash" argument', async () => {
    await completionCommand.parseAsync(['bash'], { from: 'user' });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('#!/usr/bin/env bash');
    expect(output).toContain('_agent_env_completions');
    expect(output).toContain('complete -F _agent_env_completions agent-env');
  });

  it('outputs zsh completion script for "zsh" argument', async () => {
    await completionCommand.parseAsync(['zsh'], { from: 'user' });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('#compdef agent-env');
    expect(output).toContain('_agent_env');
  });

  it('shows error for unsupported shell type', async () => {
    await completionCommand.parseAsync(['fish'], { from: 'user' });

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const errorOutput = consoleErrorSpy.mock.calls[0][0] as string;
    expect(errorOutput).toContain('Unsupported shell');
    expect(errorOutput).toContain('fish');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('includes installation instructions in description', () => {
    const description = completionCommand.description();
    expect(description).toContain('Bash:');
    expect(description).toContain('Zsh:');
    expect(description).toContain('eval "$(agent-env completion bash)"');
    expect(description).toContain('eval "$(agent-env completion zsh)"');
  });
});
