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
import { completionCommand } from './commands/completion.js';
import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { purposeCommand } from './commands/purpose.js';
import { rebuildCommand } from './commands/rebuild.js';
import { removeCommand } from './commands/remove.js';
import { InteractiveMenu } from './components/InteractiveMenu.js';
import { attachInstance, createAttachDefaultDeps } from './lib/attach-instance.js';
import { launchInteractiveMenu } from './lib/interactive-menu.js';
import { listInstances } from './lib/list-instances.js';
import { rebuildInstance, createRebuildDefaultDeps } from './lib/rebuild-instance.js';
import { removeInstance, createRemoveDefaultDeps } from './lib/remove-instance.js';

// Detect local link: when linked from monorepo, workspace root is 3 levels up from dist/
const __dirname = dirname(fileURLToPath(import.meta.url));
const isLinked = existsSync(resolve(__dirname, '..', '..', '..', 'pnpm-workspace.yaml'));
const version = packageJson.version + (isLinked ? '+local' : '');

program
  .name('agent-env')
  .description('CLI for creating isolated, AI-ready development environments')
  .version(version);

// Register commands
program.addCommand(createCommand);
program.addCommand(listCommand);
program.addCommand(attachCommand);
program.addCommand(rebuildCommand);
program.addCommand(removeCommand);
program.addCommand(purposeCommand);
program.addCommand(completionCommand);

// Default action: interactive menu (TTY) or help (non-TTY)
program.action(async () => {
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
    renderMenu: (instances, onAction) => {
      const { waitUntilExit } = render(
        React.createElement(InteractiveMenu, { instances, onAction })
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
