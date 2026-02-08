import { Command } from 'commander';

import { listCommand } from './commands/list.js';

const program = new Command();

program
  .name('bmad-orchestrator')
  .description('Unified command center for multi-instance development')
  .version('0.1.0');

program
  .command('list')
  .description('List discovered instances')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const output = await listCommand(options);
    console.log(output);
  });

program.parse();
