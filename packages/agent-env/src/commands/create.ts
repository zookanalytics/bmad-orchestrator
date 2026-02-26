import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';
import { createInterface } from 'node:readline';

import type { AskBaselineChoice } from '../lib/create-instance.js';

import {
  createInstance,
  createDefaultDeps,
  resolveRepoUrl,
  attachToInstance,
} from '../lib/create-instance.js';

/**
 * Prompt the user to choose between repo config and agent-env baseline.
 * Returns 'repo' or 'baseline'. Defaults to 'repo' on Enter or non-TTY.
 */
function createBaselinePrompt(): AskBaselineChoice {
  return async (): Promise<'baseline' | 'repo'> => {
    // Non-TTY fallback: default to repo config without prompting
    if (!process.stdin.isTTY) {
      return 'repo';
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise<'baseline' | 'repo'>((resolve) => {
      console.log();
      console.log('This repo has a .devcontainer/ config.');
      console.log('  [1] Use repo config (default)');
      console.log('  [2] Use agent-env baseline');
      rl.question('Choose [1/2]: ', (answer) => {
        rl.close();
        resolve(answer.trim() === '2' ? 'baseline' : 'repo');
      });
    });
  };
}

interface CreateOptions {
  repo?: string;
  purpose?: string;
  attach?: boolean;
  baseline?: boolean;
}

export const createCommand = new Command('create')
  .description('Create a new isolated development environment')
  .argument('<name>', 'Name for the new instance')
  .option('--repo <url>', 'Git repository URL to clone (use "." for current directory)')
  .option('--purpose <text>', 'Set the instance purpose/label at creation time')
  .option('--attach', 'Attach immediately after creation')
  .option('--baseline', 'Force agent-env baseline config (ignore repo .devcontainer/)')
  .option('--no-baseline', 'Force repo config (skip baseline prompt)')
  .action(async (name: string, options: CreateOptions) => {
    if (!options.repo) {
      console.error(
        formatError(
          createError(
            'MISSING_OPTION',
            'The --repo flag is required.',
            'Usage: agent-env create <name> --repo <url>'
          )
        )
      );
      process.exit(1);
    }

    // Validate mutual exclusion of --baseline and --no-baseline
    // Commander treats --no-baseline as setting baseline=false and --baseline as baseline=true.
    // When both are passed, the last one wins. We detect this by checking raw argv.
    const argv = process.argv;
    const hasBaselineFlag = argv.includes('--baseline');
    const hasNoBaselineFlag = argv.includes('--no-baseline');

    if (hasBaselineFlag && hasNoBaselineFlag) {
      console.error(
        formatError(
          createError(
            'INVALID_OPTIONS',
            'Cannot specify both --baseline and --no-baseline',
            'Use --baseline to force agent-env baseline, or --no-baseline to use repo config.'
          )
        )
      );
      process.exit(1);
    }

    // Resolve --repo . to actual git remote URL
    const deps = createDefaultDeps();
    const resolved = await resolveRepoUrl(options.repo, deps.executor);

    if (!resolved.ok) {
      const { code, message, suggestion } = resolved.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
    }

    const repoUrl = resolved.url;
    console.log(`Creating instance '${name}' from ${repoUrl}...`);

    // Determine baseline option: true (--baseline), false (--no-baseline), undefined (ask user)
    const baselineOption: boolean | undefined = hasBaselineFlag
      ? true
      : hasNoBaselineFlag
        ? false
        : undefined;

    const result = await createInstance(name, repoUrl, deps, {
      purpose: options.purpose,
      baseline: baselineOption,
      askUser: createBaselinePrompt(),
    });

    if (!result.ok) {
      const { code, message, suggestion } = result.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
    }

    const { workspacePath, containerName } = result;
    console.log(`\x1b[32m✓\x1b[0m Instance '${name}' created successfully`);
    console.log(`  Workspace: ${workspacePath.root}`);
    console.log(`  Container: ${containerName}`);

    if (options.attach) {
      console.log();
      console.log('Attaching to instance...');
      const attachResult = await attachToInstance(containerName, deps.executor);

      if (!attachResult.ok) {
        const { code, message, suggestion } = attachResult.error;
        console.error(formatError(createError(code, message, suggestion)));
        process.exit(1);
      }
    }
  });
