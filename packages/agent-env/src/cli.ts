#!/usr/bin/env node

import { formatError, createError } from '@zookanalytics/shared';
import { program } from 'commander';
import { render } from 'ink';
import React from 'react';

import packageJson from '../package.json' with { type: 'json' };
import { attachCommand } from './commands/attach.js';
import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { purposeCommand } from './commands/purpose.js';
import { removeCommand } from './commands/remove.js';
import { InteractiveMenu } from './components/InteractiveMenu.js';
import { attachInstance, createAttachDefaultDeps } from './lib/attach-instance.js';
import { launchInteractiveMenu } from './lib/interactive-menu.js';
import { listInstances } from './lib/list-instances.js';

// Package version from package.json
const version = packageJson.version;

program
  .name('agent-env')
  .description('CLI for creating isolated, AI-ready development environments')
  .version(version);

// Register commands
program.addCommand(createCommand);
program.addCommand(listCommand);
program.addCommand(attachCommand);
program.addCommand(removeCommand);
program.addCommand(purposeCommand);

// Default action: interactive menu (TTY) or help (non-TTY)
program.action(async () => {
  if (!process.stdin.isTTY) {
    program.help();
    return;
  }

  const result = await launchInteractiveMenu({
    listInstances,
    attachInstance,
    createAttachDeps: createAttachDefaultDeps,
    renderMenu: (instances, onSelect) => {
      const { waitUntilExit } = render(
        React.createElement(InteractiveMenu, { instances, onSelect })
      );
      return { waitUntilExit };
    },
  });

  if (!result.ok) {
    const { code, message, suggestion } = result.error;
    console.error(formatError(createError(code, message, suggestion)));
    process.exitCode = 1;
  }
});

// Parse arguments
program.parse();
