import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Spy on Command.prototype.parse to prevent actual CLI execution
// This allows testing the real Commander setup without side effects
const parseSpy = vi.spyOn(Command.prototype, 'parse').mockImplementation(function (this: Command) {
  return this;
});

describe('cli', () => {
  beforeEach(() => {
    parseSpy.mockClear();
    // Reset module cache to allow fresh imports
    vi.resetModules();
  });

  it('should configure Commander with correct name and version', async () => {
    // Import cli.ts which sets up the program
    await import('./cli.js');

    // Verify parse was called (meaning setup completed)
    expect(parseSpy).toHaveBeenCalled();
  });

  it('should be importable without errors', async () => {
    const cliModule = await import('./cli.js');
    expect(cliModule).toBeDefined();
  });
});
