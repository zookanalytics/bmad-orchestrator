import { createError, formatError } from '@zookanalytics/shared';
import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

import { getRepoEnvDir, loadRepoEnv } from '../lib/repo-env.js';

export const envCommand = new Command('env')
  .description('Manage repo-level env files copied into workspaces')
  .argument('<repo-slug>', 'Repo slug (from `agent-env repos`)')
  .option('--edit', 'Open .env in $EDITOR')
  .option('--edit-local', 'Open .env.local in $EDITOR')
  .option('--path', 'Print path to repo env directory')
  .action(
    async (repoSlug: string, options: { edit?: boolean; editLocal?: boolean; path?: boolean }) => {
      const dir = getRepoEnvDir(repoSlug);

      if (options.path) {
        console.log(dir);
        return;
      }

      if (options.edit || options.editLocal) {
        const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
        const filename = options.editLocal ? '.env.local' : '.env';
        const filePath = `${dir}/${filename}`;

        // Ensure directory exists
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        const result = spawnSync(editor, [filePath], { stdio: 'inherit' });
        if (result.status !== 0) {
          console.error(
            formatError(createError('EDITOR_ERROR', `Failed to open ${filename} in ${editor}.`))
          );
          process.exitCode = 1;
        }
        return;
      }

      // Default: show current env vars
      const env = await loadRepoEnv(repoSlug);
      const keys = Object.keys(env);

      if (keys.length === 0) {
        console.log(`No env files found for repo "${repoSlug}".`);
        console.log(`Create one at: ${dir}/.env`);
        return;
      }

      // Show merged env vars
      console.log(`Repo env vars for "${repoSlug}" (${dir}):\n`);
      for (const [key, value] of Object.entries(env)) {
        console.log(`  ${key}=${value}`);
      }
    }
  );
