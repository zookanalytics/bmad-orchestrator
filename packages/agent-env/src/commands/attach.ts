import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import { attachInstance, createAttachDefaultDeps } from '../lib/attach-instance.js';
import { resolveRepoOrExit } from '../lib/command-helpers.js';

export const attachCommand = new Command('attach')
  .description("Attach to an instance's tmux session")
  .argument('<name>', 'Instance name to attach to')
  .option('--repo <slug>', 'Repo slug or URL to scope instance lookup')
  .action(async (name: string, options: { repo?: string }) => {
    const deps = createAttachDefaultDeps();

    // Phase 1: Resolve repo context
    const repoSlug = await resolveRepoOrExit({ repo: options.repo, cwd: process.cwd() });

    const result = await attachInstance(
      name,
      deps,
      () => {
        console.log('Starting container...');
      },
      () => {
        console.log();
        console.log('Attaching to tmux session...');
      },
      repoSlug
    );

    if (!result.ok) {
      const { code, message, suggestion } = result.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
    }
  });
