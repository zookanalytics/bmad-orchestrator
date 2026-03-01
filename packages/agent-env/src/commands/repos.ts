import type { JsonOutput } from '@zookanalytics/shared';

import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import type { RepoInfo } from '../lib/list-repos.js';

import { listRepos } from '../lib/list-repos.js';

export const reposCommand = new Command('repos')
  .description('List tracked repositories')
  .option('--json', 'Output in JSON format')
  .action(async (options: { json?: boolean }) => {
    const result = await listRepos();

    if (!result.ok) {
      const error = createError(
        result.error.code,
        result.error.message,
        'Check if ~/.agent-env/workspaces/ is accessible.'
      );
      if (options.json) {
        const output: JsonOutput<never> = {
          ok: false,
          data: null,
          error: { code: error.code, message: error.message, suggestion: error.suggestion },
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.error(formatError(error));
      }
      process.exitCode = 1;
      return;
    }

    if (options.json) {
      const output: JsonOutput<RepoInfo[]> = {
        ok: true,
        data: result.repos.map((r) => ({
          slug: r.slug,
          url: r.url,
          instanceCount: r.instanceCount,
        })),
        error: null,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Plain text output
    if (result.repos.length === 0) {
      console.log(
        'No repositories tracked. Create an instance with: agent-env create <name> --repo <url|slug>'
      );
      return;
    }

    // Table header
    const slugWidth = Math.max(4, ...result.repos.map((r) => r.slug.length));
    const countWidth = 10;
    const header = `${'REPO'.padEnd(slugWidth)}  ${'INSTANCES'.padEnd(countWidth)}  URL`;
    console.log(header);

    // Table rows
    for (const repo of result.repos) {
      const line = `${repo.slug.padEnd(slugWidth)}  ${String(repo.instanceCount).padEnd(countWidth)}  ${repo.url}`;
      console.log(line);
    }
  });
