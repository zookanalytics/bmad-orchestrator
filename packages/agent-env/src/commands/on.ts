import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import { resolveRepoOrExit } from '../lib/command-helpers.js';
import { launchActionLoop } from '../lib/interactive-menu.js';
import { buildMenuDeps } from '../lib/menu-deps.js';
import { resolveInstance } from '../lib/workspace.js';

export const onCommand = new Command('on')
  .description('Open the interactive menu for an instance')
  .argument('<name>', 'Instance name')
  .option('--repo <slug>', 'Repo slug or URL to scope instance lookup')
  .action(async (name: string, options: { repo?: string }) => {
    // TTY gate: the interactive menu requires a terminal
    if (!process.stdin.isTTY) {
      console.error(
        formatError(
          createError(
            'TTY_REQUIRED',
            'The interactive menu requires a terminal (TTY).',
            'Run this command in an interactive terminal session.'
          )
        )
      );
      process.exit(1);
      return;
    }

    // Phase 1: Resolve repo context
    const repoSlug = await resolveRepoOrExit({ repo: options.repo, cwd: process.cwd() });

    // Phase 2: Resolve instance
    const lookup = await resolveInstance(name, repoSlug);

    if (!lookup.found) {
      const { code, message, suggestion } = lookup.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
      return;
    }

    const { workspaceName } = lookup;

    // Launch the persistent action loop
    const menuDeps = buildMenuDeps();
    await launchActionLoop(workspaceName, menuDeps, repoSlug);
  });
