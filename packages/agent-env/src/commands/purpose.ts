import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import { createPurposeDefaultDeps, getPurpose, setPurpose } from '../lib/purpose-instance.js';

export const purposeCommand = new Command('purpose')
  .description('Get or set the purpose/label for an instance')
  .argument('<name>', 'Instance name')
  .argument('[value]', 'New purpose value (omit to get current, empty string to clear)')
  .action(async (name: string, value?: string) => {
    const deps = createPurposeDefaultDeps();

    if (value === undefined) {
      // Get mode
      const result = await getPurpose(name, deps);

      if (!result.ok) {
        const { code, message, suggestion } = result.error;
        console.error(formatError(createError(code, message, suggestion)));
        process.exit(1);
      }

      if (result.purpose === null) {
        console.log('(no purpose set)');
      } else {
        console.log(result.purpose);
      }
    } else {
      // Set mode
      const result = await setPurpose(name, value, deps);

      if (!result.ok) {
        const { code, message, suggestion } = result.error;
        console.error(formatError(createError(code, message, suggestion)));
        process.exit(1);
      }

      if (result.cleared) {
        console.log('Purpose cleared');
      } else {
        console.log('Purpose updated');
      }
    }
  });
