import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import { createRemoveDefaultDeps, removeInstance } from '../lib/remove-instance.js';

export const removeCommand = new Command('remove')
  .description('Remove an instance with safety checks')
  .argument('<name>', 'Instance name to remove')
  .option('--force', 'Force removal, bypassing safety checks')
  .action(async (name: string, options: { force?: boolean }) => {
    const deps = createRemoveDefaultDeps();

    const result = await removeInstance(name, deps, options.force);

    if (result.ok) {
      console.log(`Instance '${name}' removed`);
    } else {
      const { code, message, suggestion } = result.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
    }
  });
