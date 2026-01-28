import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

export const createCommand = new Command('create')
  .description('Create a new isolated development environment')
  .argument('<name>', 'Name for the new instance')
  .option('--repo <url>', 'Git repository URL to clone')
  .option('--attach', 'Attach immediately after creation')
  .action((name: string, _options: { repo?: string; attach?: boolean }) => {
    // Placeholder - actual implementation in Epic 2
    console.error(
      formatError(
        createError(
          'NotImplemented',
          `Create command not yet implemented for instance: ${name}.`,
          'Actual implementation will be in Epic 2. For now, this is a placeholder.'
        )
      )
    );
    process.exit(1);
  });
