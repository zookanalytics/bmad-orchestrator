import { formatError, createError } from '@zookanalytics/shared';
import chalk from 'chalk';
import { Command } from 'commander';

import { promptForConfirmation, resolveRepoOrExit } from '../lib/command-helpers.js';
import { createShutdownDefaultDeps, shutdownInstance } from '../lib/shutdown-instance.js';

export const shutdownCommand = new Command('shutdown')
  .description('Gracefully shut down an instance (save tmux state, stop container)')
  .argument('<name>', 'Instance name to shut down')
  .option('--yes', 'Skip confirmation prompt')
  .option('--repo <slug>', 'Repo slug or URL to scope instance lookup')
  .action(async (name: string, options: { yes?: boolean; repo?: string }) => {
    const repoSlug = await resolveRepoOrExit({ repo: options.repo, cwd: process.cwd() });

    if (!options.yes && process.stdin.isTTY) {
      const confirmed = await promptForConfirmation(
        `\nShutdown '${name}'? This will stop the container. (y/N) `
      );
      if (!confirmed) {
        console.log('Shutdown cancelled');
        return;
      }
    }

    console.log(`Shutting down instance '${name}'...`);

    const deps = createShutdownDefaultDeps();

    try {
      const result = await shutdownInstance(name, deps, repoSlug);

      if (!result.ok) {
        const { code, message, suggestion } = result.error;
        console.error(formatError(createError(code, message, suggestion)));
        process.exit(1);
        return;
      }

      console.log(`${chalk.green('✓')} Instance '${name}' shut down`);
      if (result.tmuxSaved) {
        console.log('  Tmux session state saved');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(formatError(createError('SHUTDOWN_ERROR', message)));
      process.exit(1);
    }
  });
