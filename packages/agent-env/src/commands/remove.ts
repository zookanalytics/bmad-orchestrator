import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

export const removeCommand = new Command('remove')
  .description('Remove an instance with safety checks')
  .argument('<name>', 'Instance name to remove')
  .option('--force', 'Force removal, bypassing safety checks')
  .action((name: string, _options: { force?: boolean }) => {
    // Placeholder - actual implementation in Epic 5
    console.error(
      formatError(
        createError(
          'NotImplemented',
          `Remove command not yet implemented for instance: ${name}.`,
          'Actual implementation will be in Epic 5. For now, this is a placeholder.'
        )
      )
    );
    process.exit(1);
  });
