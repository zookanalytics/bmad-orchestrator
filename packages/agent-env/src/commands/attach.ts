import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

export const attachCommand = new Command('attach')
  .description("Attach to an instance's tmux session")
  .argument('<name>', 'Instance name to attach to')
  .action((name: string) => {
    // Placeholder - actual implementation in Epic 4
    console.error(
      formatError(
        createError(
          'NotImplemented',
          `Attach command not yet implemented for instance: ${name}.`,
          'Actual implementation will be in Epic 4. For now, this is a placeholder.'
        )
      )
    );
    process.exit(1);
  });
