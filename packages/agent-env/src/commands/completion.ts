import { createError, formatError } from '@zookanalytics/shared';
import { Command } from 'commander';

import {
  generateCompletionScript,
  getInstallInstructions,
  isValidShell,
} from '../lib/completion.js';

export const completionCommand = new Command('completion')
  .description(`Generate shell completion script for bash or zsh\n\n${getInstallInstructions()}`)
  .argument('<shell>', 'Shell type (bash or zsh)')
  .action((shell: string) => {
    if (!isValidShell(shell)) {
      const error = createError(
        'UNSUPPORTED_SHELL',
        `Unsupported shell "${shell}".`,
        'Supported shells: bash, zsh'
      );
      console.error(formatError(error));
      process.exit(1);
    }

    const script = generateCompletionScript(shell);
    console.log(script);
  });
