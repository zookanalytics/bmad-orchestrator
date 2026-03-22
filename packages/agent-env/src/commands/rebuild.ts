import { formatError, createError } from '@zookanalytics/shared';
import chalk from 'chalk';
import { Command } from 'commander';

import type { RebuildOptions } from '../lib/rebuild-instance.js';

import { promptForConfirmation, resolveRepoOrExit } from '../lib/command-helpers.js';
import { createProgressLine } from '../lib/progress-line.js';
import { createRebuildDefaultDeps, rebuildInstance } from '../lib/rebuild-instance.js';

export const rebuildCommand = new Command('rebuild')
  .description('Rebuild an instance by recreating its container')
  .argument('<name>', 'Instance name to rebuild')
  .option('--force', 'Rebuild even if the container is currently running')
  .option('--yes', 'Skip confirmation prompt')
  .option('--no-pull', 'Skip pulling fresh base images')
  .option('--use-cache', 'Allow Docker build layer cache reuse')
  .option('--repo <slug>', 'Repo slug or URL to scope instance lookup')
  .action(
    async (
      name: string,
      options: { force?: boolean; yes?: boolean; pull?: boolean; useCache?: boolean; repo?: string }
    ) => {
      const deps = createRebuildDefaultDeps();

      // Phase 1: Resolve repo context
      const repoSlug = await resolveRepoOrExit({ repo: options.repo, cwd: process.cwd() });

      // --yes implies --force and skips prompt; --force also skips prompt
      let confirmed = false;
      if (!options.yes && !options.force && process.stdin.isTTY) {
        confirmed = await promptForConfirmation(
          `\n${chalk.yellow('Warning:')} Rebuilding '${name}' will destroy the current container and create a new one.\nAny active sessions will be lost. Continue? (y/N) `
        );
        if (!confirmed) {
          console.log('Rebuild cancelled');
          return;
        }
      }

      const force = options.force || options.yes || confirmed;

      const progress = createProgressLine();
      const rebuildOptions: RebuildOptions = {
        force,
        pull: options.pull,
        noCache: !options.useCache,
        onProgress: progress.update,
      };

      if (force) {
        console.log(`Force-rebuilding instance '${name}'...`);
      } else {
        console.log(`Rebuilding instance '${name}'...`);
      }

      try {
        const result = await rebuildInstance(name, deps, rebuildOptions, repoSlug);
        progress.clear();

        if (!result.ok) {
          if (result.error.code === 'CONTAINER_RUNNING') {
            console.error('');
            console.error(
              chalk.yellow('Container is currently running.') +
                ' Active sessions will be terminated during rebuild.'
            );
            console.error('');
            console.error(`Use ${chalk.bold('--force')} to rebuild anyway.`);
          } else {
            const { code, message, suggestion } = result.error;
            console.error(formatError(createError(code, message, suggestion)));
          }
          process.exit(1);
          return;
        }

        console.log(`\x1b[32m✓\x1b[0m Instance '${name}' rebuilt successfully`);
        console.log(`  Container: ${result.containerName}`);
      } finally {
        progress.clear();
      }
    }
  );
