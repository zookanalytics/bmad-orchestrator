import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import { attachInstance, createAttachDefaultDeps } from '../lib/attach-instance.js';

export const attachCommand = new Command('attach')
  .description("Attach to an instance's tmux session")
  .argument('<name>', 'Instance name to attach to')
  .action(async (name: string) => {
    const deps = createAttachDefaultDeps();

    const result = await attachInstance(
      name,
      deps,
      () => {
        console.log('Starting container...');
      },
      () => {
        console.log();
        console.log('Attaching to tmux session...');
      }
    );

    if (!result.ok) {
      const { code, message, suggestion } = result.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
    }
  });
