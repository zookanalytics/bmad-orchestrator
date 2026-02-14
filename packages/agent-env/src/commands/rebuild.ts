import { formatError, createError } from '@zookanalytics/shared';
import chalk from 'chalk';
import { Command } from 'commander';
import { createInterface } from 'node:readline';

import { createRebuildDefaultDeps, rebuildInstance } from '../lib/rebuild-instance.js';

/**
 * Prompt the user to confirm rebuilding a running instance.
 */
function promptForConfirmation(instanceName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.question(
      `\n${chalk.yellow('Warning:')} Rebuilding '${instanceName}' will destroy the current container and create a new one.\nAny active sessions will be lost. Continue? (y/N) `,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      }
    );

    rl.on('SIGINT', () => {
      rl.close();
      resolve(false);
    });
  });
}

export const rebuildCommand = new Command('rebuild')
  .description('Rebuild an instance by recreating its container')
  .argument('<name>', 'Instance name to rebuild')
  .option('--force', 'Rebuild even if the container is currently running')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (name: string, options: { force?: boolean; yes?: boolean }) => {
    const deps = createRebuildDefaultDeps();

    // --yes implies --force and skips prompt; --force also skips prompt
    let confirmed = false;
    if (!options.yes && !options.force && process.stdin.isTTY) {
      confirmed = await promptForConfirmation(name);
      if (!confirmed) {
        console.log('Rebuild cancelled');
        return;
      }
    }

    const force = options.force || options.yes || confirmed;

    if (force) {
      console.log(`Force-rebuilding instance '${name}'...`);
    } else {
      console.log(`Rebuilding instance '${name}'...`);
    }

    const result = await rebuildInstance(name, deps, force);

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
  });
