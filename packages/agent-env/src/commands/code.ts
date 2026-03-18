import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import { codeInstance, createCodeDefaultDeps } from '../lib/code-instance.js';
import { resolveRepoOrExit } from '../lib/command-helpers.js';

export const codeCommand = new Command('code')
  .description('Open an instance in VS Code via Dev Containers')
  .argument('<name>', 'Instance name to open')
  .option('--repo <slug>', 'Repo slug or URL to scope instance lookup')
  .action(async (name: string, options: { repo?: string }) => {
    const deps = createCodeDefaultDeps();

    // Phase 1: Resolve repo context
    const repoSlug = await resolveRepoOrExit({ repo: options.repo, cwd: process.cwd() });

    const result = await codeInstance(
      name,
      deps,
      () => {
        console.log('Starting container...');
      },
      () => {
        console.log('Opening VS Code...');
      },
      repoSlug
    );

    if (!result.ok) {
      const { code, message, suggestion } = result.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
    }
  });
