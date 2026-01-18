import { Command } from 'commander';

const program = new Command();

program
  .name('bmad-orchestrator')
  .description('Unified command center for multi-DevPod development')
  .version('0.1.0');

program.parse();
