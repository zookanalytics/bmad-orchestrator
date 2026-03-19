#!/usr/bin/env node

import { formatError, createError } from '@zookanalytics/shared';
import { program } from 'commander';
import { render } from 'ink';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';

import packageJson from '../package.json' with { type: 'json' };
import { attachCommand } from './commands/attach.js';
import { codeCommand } from './commands/code.js';
import { completionCommand } from './commands/completion.js';
import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { onCommand } from './commands/on.js';
import { purposeCommand } from './commands/purpose.js';
import { rebuildCommand } from './commands/rebuild.js';
import { removeCommand } from './commands/remove.js';
import { reposCommand } from './commands/repos.js';
import { setupAudioCommand } from './commands/setup-audio.js';
import { tmuxRestoreCommand } from './commands/tmux-restore.js';
import { tmuxSaveCommand } from './commands/tmux-save.js';
import { tmuxStatusCommand } from './commands/tmux-status.js';
import { isInsideContainer } from './lib/container-env.js';
import { launchActionLoop, launchInstancePicker } from './lib/interactive-menu.js';
import { listInstances } from './lib/list-instances.js';
import { buildMenuDeps } from './lib/menu-deps.js';
import { checkForUpdate } from './lib/update-check.js';

// Detect local/dev build: linked from monorepo or baked into image at /opt/agent-env-dev
const __dirname = dirname(fileURLToPath(import.meta.url));
const isLinked = existsSync(resolve(__dirname, '..', '..', '..', 'pnpm-workspace.yaml'));
const isBakedDev = resolve(__dirname, '..').startsWith('/opt/agent-env-dev');
const version = packageJson.version + (isLinked ? '+local' : isBakedDev ? '+dev' : '');

program
  .name('agent-env')
  .description('CLI for creating isolated, AI-ready development environments')
  .version(version)
  .allowExcessArguments(true);

// Register commands
program.addCommand(createCommand);
program.addCommand(listCommand);
program.addCommand(attachCommand);
program.addCommand(codeCommand);
program.addCommand(rebuildCommand);
program.addCommand(removeCommand);
program.addCommand(purposeCommand);
program.addCommand(onCommand);
program.addCommand(reposCommand);
program.addCommand(tmuxStatusCommand);
program.addCommand(tmuxSaveCommand);
program.addCommand(tmuxRestoreCommand);
program.addCommand(completionCommand);
program.addCommand(setupAudioCommand);

// Default action: interactive menu (TTY) or help (non-TTY)
program.action(async () => {
  // Handle unknown commands passed as arguments
  if (program.args.length > 0) {
    const unknown = program.args[0];
    const available = program.commands.map((c) => c.name());
    const matches = available.filter((c) => c.startsWith(unknown));
    const suggestion =
      matches.length > 0
        ? `Did you mean ${matches.map((m) => `"${m}"`).join(' or ')}?`
        : `Available commands: ${available.join(', ')}`;

    console.error(
      formatError(createError('UNKNOWN_COMMAND', `Unknown command "${unknown}".`, suggestion))
    );
    process.exitCode = 1;
    return;
  }

  if (!process.stdin.isTTY) {
    program.help();
    return;
  }

  // Step 1: Pick an instance
  const { Select } = await import('@inkjs/ui');

  const pickerResult = await launchInstancePicker({
    listInstances,
    renderPicker: (instances) => {
      if (instances.length === 0) {
        console.log('No instances found.');
        console.log('Create one with: agent-env create <name> --repo <url>');
        return Promise.resolve(null);
      }

      return new Promise((resolve) => {
        const options = instances.map((inst) => ({
          label: inst.name,
          value: inst.name,
        }));

        const { unmount } = render(
          React.createElement(() => {
            return React.createElement(Select, {
              options,
              onChange: (value: string) => {
                unmount();
                resolve(value);
              },
            });
          })
        );
      });
    },
  });

  if (pickerResult.kind === 'error') {
    process.exitCode = 1;
    return;
  }

  if (pickerResult.kind === 'cancelled') {
    return;
  }

  // Step 2: Launch action loop for selected instance
  const menuDeps = buildMenuDeps();
  await launchActionLoop(pickerResult.name, menuDeps);
});

// Parse arguments
const shouldCheck = !!process.stderr.isTTY && !isInsideContainer() && !isLinked && !isBakedDev;

const updateCheckPromise = shouldCheck
  ? checkForUpdate({
      currentVersion: packageJson.version,
      packageName: packageJson.name,
      cachePath: join(homedir(), '.agent-env', 'update-check.json'),
      cacheTtlMs: 3_600_000,
    })
  : Promise.resolve(null);

await program.parseAsync();

const updateMessage = await updateCheckPromise;
if (updateMessage) {
  process.stderr.write(updateMessage + '\n');
}
