import { createError, createExecutor, formatError } from '@zookanalytics/shared';
import { createInterface } from 'node:readline';

import type { ResolveRepoOpts } from './workspace.js';

import { resolveRepo } from './workspace.js';

/**
 * Resolve repo context or exit the process on error.
 *
 * Wraps the two-phase {@link resolveRepo} call with CLI error handling:
 * - On success: returns the resolved repo slug
 * - On error: prints a formatted message to stderr and exits with code 1
 * - No context: returns undefined (not an error)
 */
export async function resolveRepoOrExit(opts: ResolveRepoOpts): Promise<string | undefined> {
  const executor = createExecutor();
  const repoResult = await resolveRepo(opts, executor);

  if (repoResult.resolved) {
    return repoResult.repoSlug;
  }

  if ('error' in repoResult && repoResult.error) {
    console.error(
      formatError(
        createError(repoResult.error.code, repoResult.error.message, repoResult.error.suggestion)
      )
    );
    process.exit(1);
  }

  return undefined;
}

/**
 * Prompt the user for yes/no confirmation via readline.
 *
 * Returns true if the user answers "y" or "yes" (case-insensitive).
 * Returns false on "n", empty input, or SIGINT.
 */
export function promptForConfirmation(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });

    rl.on('SIGINT', () => {
      rl.close();
      resolve(false);
    });
  });
}
