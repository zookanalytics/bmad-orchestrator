#!/usr/bin/env node

import { formatError, createError } from '@zookanalytics/shared';
import { program } from 'commander';
import { render } from 'ink';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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
import { InteractiveMenu } from './components/InteractiveMenu.js';
import {
  createAttachDefaultDeps,
  attachInstance as attachInstanceLib,
} from './lib/attach-instance.js';
import { createCodeDefaultDeps, codeInstance as codeInstanceLib } from './lib/code-instance.js';
import {
  launchActionLoop,
  launchInstancePicker,
  type InteractiveMenuDeps,
} from './lib/interactive-menu.js';
import { listInstances, getInstanceInfo as getInstanceInfoLib } from './lib/list-instances.js';
import { createProgressLine } from './lib/progress-line.js';
import { createPurposeDefaultDeps, setPurpose as setPurposeLib } from './lib/purpose-instance.js';
import {
  createRebuildDefaultDeps,
  rebuildInstance as rebuildInstanceLib,
} from './lib/rebuild-instance.js';

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

/**
 * Build the DI wrappers for the action loop.
 * Shared between the `on` command and the default no-arg flow.
 */
function buildMenuDeps(): InteractiveMenuDeps {
  return {
    attachInstance: (wsName, slug) => {
      const deps = createAttachDefaultDeps();
      return attachInstanceLib(
        wsName,
        deps,
        () => console.log('Starting container...'),
        () => {
          console.log();
          console.log('Attaching to tmux session...');
        },
        slug
      );
    },
    codeInstance: (wsName, slug) => {
      const deps = createCodeDefaultDeps();
      return codeInstanceLib(
        wsName,
        deps,
        () => console.log('Starting container...'),
        () => console.log('Opening VS Code...'),
        slug
      );
    },
    rebuildInstance: (wsName, slug) => {
      const rebuildDeps = createRebuildDefaultDeps();
      const progress = createProgressLine();
      console.log(`Rebuilding instance '${wsName}'...`);
      return rebuildInstanceLib(
        wsName,
        rebuildDeps,
        { force: true, onProgress: progress.update },
        slug
      )
        .then((result) => {
          progress.clear();
          return result;
        })
        .catch((err) => {
          progress.clear();
          throw err;
        });
    },
    setPurpose: (wsName, value, slug) => {
      const deps = createPurposeDefaultDeps();
      return setPurposeLib(wsName, value, deps, slug);
    },
    getInstanceInfo: (wsName) => getInstanceInfoLib(wsName),
    renderMenu: (instanceInfo) => {
      return new Promise((resolve) => {
        const { unmount } = render(
          React.createElement(InteractiveMenu, {
            instanceInfo,
            onAction: (action) => {
              unmount();
              resolve({ action });
            },
            onSetPurpose: (value) => {
              unmount();
              resolve({ action: 'set-purpose' as const, purposeValue: value });
            },
          })
        );
      });
    },
  };
}

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

  const workspaceName = await launchInstancePicker({
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

  if (!workspaceName) {
    return;
  }

  // Step 2: Launch action loop for selected instance
  const menuDeps = buildMenuDeps();
  await launchActionLoop(workspaceName, menuDeps);
});

// Parse arguments
program.parse();
