import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import { resolveRepoOrExit } from '../lib/command-helpers.js';
import { resolveInstance, getWorkspacePathByName } from '../lib/workspace.js';

export const pathCommand = new Command('path')
  .description('Print the host directory path for an instance')
  .argument('<name>', 'Instance name')
  .option('--repo <slug>', 'Repo slug or URL to scope instance lookup')
  .action(async (name: string, options: { repo?: string }) => {
    // Phase 1: Resolve repo context
    const repoSlug = await resolveRepoOrExit({ repo: options.repo, cwd: process.cwd() });

    // Phase 2: Resolve instance to workspace
    const result = await resolveInstance(name, repoSlug);

    if (!result.found) {
      const { code, message, suggestion } = result.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
      return;
    }

    const wsPath = getWorkspacePathByName(result.workspaceName);
    console.log(wsPath.root);
  });
