import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

export const purposeCommand = new Command('purpose')
  .description('Get or set the purpose/label for an instance')
  .argument('<name>', 'Instance name')
  .argument('[value]', 'New purpose value (omit to get current)')
  .action((name: string, _value?: string) => {
    // Placeholder - actual implementation in Epic 4
    console.error(
      formatError(
        createError(
          'NotImplemented',
          `Purpose command not yet implemented for instance: ${name}.`,
          'Actual implementation will be in Epic 4. For now, this is a placeholder.'
        )
      )
    );
    process.exit(1);
  });
