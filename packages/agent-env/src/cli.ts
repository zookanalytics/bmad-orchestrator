#!/usr/bin/env node

import { program } from 'commander';

import packageJson from '../package.json' with { type: 'json' };
import { attachCommand } from './commands/attach.js';
import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { purposeCommand } from './commands/purpose.js';
import { removeCommand } from './commands/remove.js';

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

// Default action: show help (placeholder for future interactive menu)
program.action(() => {
  program.help();
});

// Parse arguments
program.parse();
