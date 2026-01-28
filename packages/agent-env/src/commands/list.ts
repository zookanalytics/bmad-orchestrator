import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

export const listCommand = new Command('list')
  .alias('ps')
  .description('List all instances with status')
  .option('--json', 'Output in JSON format')
  .action((_options: { json?: boolean }) => {
    // Placeholder - actual implementation in Epic 3
    console.error(
      formatError(
        createError(
          'NotImplemented',
          'List command not yet implemented.',
          'Actual implementation will be in Epic 3. For now, this is a placeholder.'
        )
      )
    );
    process.exit(1);
  });
