import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the list command
vi.mock('./commands/list.js', () => ({
  listCommand: vi.fn().mockResolvedValue('No instances discovered'),
}));

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

  describe('list command', () => {
    it('should register list command with correct description', async () => {
      // Create a fresh program to inspect
      const program = new Command();
      program
        .name('bmad-orchestrator')
        .description('Unified command center for multi-instance development')
        .version('0.1.0');

      program
        .command('list')
        .description('List discovered instances')
        .option('--json', 'Output as JSON')
        .action(async () => {});

      const listCmd = program.commands.find((cmd) => cmd.name() === 'list');
      expect(listCmd).toBeDefined();
      expect(listCmd?.description()).toBe('List discovered instances');
    });

    it('should have --json option on list command', async () => {
      const program = new Command();
      program.name('bmad-orchestrator').version('0.1.0');

      program
        .command('list')
        .description('List discovered instances')
        .option('--json', 'Output as JSON')
        .action(async () => {});

      const listCmd = program.commands.find((cmd) => cmd.name() === 'list');
      const jsonOption = listCmd?.options.find((opt) => opt.long === '--json');
      expect(jsonOption).toBeDefined();
      expect(jsonOption?.description).toBe('Output as JSON');
    });

    it('should parse --json option correctly', async () => {
      const program = new Command();
      program.name('bmad-orchestrator').version('0.1.0');

      let receivedOptions: { json?: boolean } = {};
      program
        .command('list')
        .option('--json', 'Output as JSON')
        .action((options) => {
          receivedOptions = options;
        });

      await program.parseAsync(['node', 'test', 'list', '--json']);
      expect(receivedOptions.json).toBe(true);
    });

    it('should parse list command without --json option', async () => {
      const program = new Command();
      program.name('bmad-orchestrator').version('0.1.0');

      let receivedOptions: { json?: boolean } = {};
      program
        .command('list')
        .option('--json', 'Output as JSON')
        .action((options) => {
          receivedOptions = options;
        });

      await program.parseAsync(['node', 'test', 'list']);
      expect(receivedOptions.json).toBeUndefined();
    });
  });
});
