import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import {
  createInstance,
  createDefaultDeps,
  resolveRepoUrl,
  attachToInstance,
} from '../lib/create-instance.js';

export const createCommand = new Command('create')
  .description('Create a new isolated development environment')
  .argument('<name>', 'Name for the new instance')
  .option('--repo <url>', 'Git repository URL to clone (use "." for current directory)')
  .option('--attach', 'Attach immediately after creation')
  .action(async (name: string, options: { repo?: string; attach?: boolean }) => {
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

    const result = await createInstance(name, repoUrl, deps);

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
      console.log('Attaching to instance...');
      const attachResult = await attachToInstance(containerName, deps.executor);

      if (!attachResult.ok) {
        const { code, message, suggestion } = attachResult.error;
        console.error(formatError(createError(code, message, suggestion)));
        process.exit(1);
      }
    }
  });
