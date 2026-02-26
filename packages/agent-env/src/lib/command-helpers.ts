import { createError, createExecutor, formatError } from '@zookanalytics/shared';

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
