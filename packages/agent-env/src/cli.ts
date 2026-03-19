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
import { purposeCommand } from './commands/purpose.js';
import { rebuildCommand } from './commands/rebuild.js';
import { removeCommand } from './commands/remove.js';
import { reposCommand } from './commands/repos.js';
import { setupAudioCommand } from './commands/setup-audio.js';
import { tmuxRestoreCommand } from './commands/tmux-restore.js';
import { tmuxSaveCommand } from './commands/tmux-save.js';
import { tmuxStatusCommand } from './commands/tmux-status.js';
import { InteractiveMenu } from './components/InteractiveMenu.js';
import { attachInstance, createAttachDefaultDeps } from './lib/attach-instance.js';
import { launchInteractiveMenu } from './lib/interactive-menu.js';
import { listInstances } from './lib/list-instances.js';
import { rebuildInstance, createRebuildDefaultDeps } from './lib/rebuild-instance.js';
import { removeInstance, createRemoveDefaultDeps } from './lib/remove-instance.js';

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

  const result = await launchInteractiveMenu({
    listInstances,
    attachInstance,
    rebuildInstance,
    removeInstance,
    createAttachDeps: createAttachDefaultDeps,
    createRebuildDeps: createRebuildDefaultDeps,
    createRemoveDeps: createRemoveDefaultDeps,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy call; replaced in Task 5
    renderMenu: (instances: any, onAction: any) => {
      const { waitUntilExit } = render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy call; replaced in Task 5
        React.createElement(InteractiveMenu as any, { instances, onAction })
      );
      return { waitUntilExit };
    },
  });

  if (!result.ok) {
    const { code, message, suggestion } = result.error;
    console.error(formatError(createError(code, message, suggestion)));
    process.exitCode = 1;
  } else if (result.action === 'rebuilt') {
    console.log(`\x1b[32m✓\x1b[0m Instance '${result.instanceName}' rebuilt successfully`);
  } else if (result.action === 'removed') {
    console.log(`\x1b[32m✓\x1b[0m Instance '${result.instanceName}' removed`);
  }
});

// Parse arguments
program.parse();
