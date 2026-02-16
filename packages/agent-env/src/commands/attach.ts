import { formatError, createError, createExecutor } from '@zookanalytics/shared';
import { Command } from 'commander';

import { attachInstance, createAttachDefaultDeps } from '../lib/attach-instance.js';
import { resolveRepo } from '../lib/workspace.js';

export const attachCommand = new Command('attach')
  .description("Attach to an instance's tmux session")
  .argument('<name>', 'Instance name to attach to')
  .option('--repo <slug>', 'Repo slug or URL to scope instance lookup')
  .action(async (name: string, options: { repo?: string }) => {
    const deps = createAttachDefaultDeps();

    // Phase 1: Resolve repo context
    const executor = createExecutor();
    const repoResult = await resolveRepo({ repo: options.repo, cwd: process.cwd() }, executor);

    let repoSlug: string | undefined;
    if (repoResult.resolved) {
      repoSlug = repoResult.repoSlug;
    } else if ('error' in repoResult && repoResult.error) {
      console.error(
        formatError(
          createError(repoResult.error.code, repoResult.error.message, repoResult.error.suggestion)
        )
      );
      process.exit(1);
      return;
    }

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
