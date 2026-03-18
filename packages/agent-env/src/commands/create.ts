import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import {
  createInstance,
  createDefaultDeps,
  resolveRepoUrl,
  attachToInstance,
} from '../lib/create-instance.js';
import { createProgressLine } from '../lib/progress-line.js';
import { resolveRepoArg } from '../lib/resolve-repo-arg.js';

interface CreateOptions {
  repo?: string;
  purpose?: string;
  attach?: boolean;
}

export const createCommand = new Command('create')
  .description('Create a new isolated development environment')
  .argument('<name>', 'Name for the new instance')
  .option('--repo <url|slug>', 'Git repo URL, registered slug, or "." for current directory')
  .option('--purpose <text>', 'Set the instance purpose/label at creation time')
  .option('--attach', 'Attach immediately after creation')
  .option('--baseline', '[REMOVED] Config merge replaces this flag')
  .option('--no-baseline', '[REMOVED] Config merge replaces this flag')
  .action(async (name: string, options: CreateOptions & { baseline?: boolean }) => {
    if (options.baseline !== undefined) {
      console.error(
        formatError(
          createError(
            'REMOVED_OPTION',
            'The --baseline / --no-baseline flags have been removed.',
            'Agent-env now always merges managed config with repo config. No flag needed.'
          )
        )
      );
      process.exit(1);
    }
    if (!options.repo) {
      console.error(
        formatError(
          createError(
            'MISSING_OPTION',
            'The --repo flag is required.',
            'Usage: agent-env create <name> --repo <url|slug>'
          )
        )
      );
      process.exit(1);
    }

    // Step 1: Resolve slug → URL if the --repo value is a registered slug
    const deps = createDefaultDeps();
    const slugResult = await resolveRepoArg(options.repo);

    if (!slugResult.ok) {
      const { code, message, suggestion } = slugResult.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
    }

    const repoInput = slugResult.url;
    if (slugResult.resolvedFromSlug) {
      console.log(`Resolved repo '${options.repo}' → ${repoInput}`);
    }

    // Step 2: Resolve --repo . to actual git remote URL
    const resolved = await resolveRepoUrl(repoInput, deps.executor);

    if (!resolved.ok) {
      const { code, message, suggestion } = resolved.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
    }

    const repoUrl = resolved.url;
    console.log(`Creating instance '${name}' from ${repoUrl}...`);

    const progress = createProgressLine();
    const result = await createInstance(name, repoUrl, deps, {
      purpose: options.purpose,
      onProgress: progress.update,
    });
    progress.clear();

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
