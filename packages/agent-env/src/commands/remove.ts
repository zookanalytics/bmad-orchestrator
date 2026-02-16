import { formatError, createError, createExecutor } from '@zookanalytics/shared';
import chalk from 'chalk';
import { Command } from 'commander';
import { createInterface } from 'node:readline';

import type { ConfirmationMethod } from '../lib/audit-log.js';
import type { GitState } from '../lib/types.js';

import {
  createAuditEntry,
  createAuditLogDefaultDeps,
  writeAuditLogEntry,
} from '../lib/audit-log.js';
import { createRemoveDefaultDeps, removeInstance } from '../lib/remove-instance.js';
import { formatSafetyReport } from '../lib/safety-report.js';
import { resolveRepo } from '../lib/workspace.js';

/**
 * Prompt the user to type the instance name to confirm force removal.
 * Returns the user's input, or null if they pressed Ctrl+C / closed stdin.
 */
function promptForConfirmation(instanceName: string): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false;

    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.question(`\nType the instance name "${instanceName}" to confirm: `, (answer) => {
      if (!resolved) {
        resolved = true;
        rl.close();
        resolve(answer);
      }
    });

    rl.on('close', () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });
  });
}

async function writeAuditLog(
  name: string,
  gitState: GitState | null,
  confirmationMethod: ConfirmationMethod
): Promise<void> {
  try {
    const auditDeps = createAuditLogDefaultDeps();
    const entry = createAuditEntry(name, gitState, confirmationMethod);
    await writeAuditLogEntry(entry, auditDeps);
  } catch {
    console.error('Warning: Failed to write audit log entry.');
  }
}

function showForceWarning(name: string, blockers: string[], gitState: GitState): void {
  console.error('');
  console.error(chalk.red.bold('⚠️  WARNING: Force removing with unsaved work'));
  console.error('');
  console.error(
    formatSafetyReport(name, blockers, gitState).replace(
      /Or use --force.*/,
      chalk.red('This data will be PERMANENTLY DELETED.')
    )
  );
}

/**
 * Resolve how the user confirmed force removal.
 * Returns the confirmation method, or null if the user cancelled.
 */
async function resolveConfirmation(
  name: string,
  options: { yes?: boolean }
): Promise<ConfirmationMethod | null> {
  if (options.yes) {
    return 'yes-flag';
  }
  if (!process.stdin.isTTY) {
    console.error('');
    console.error(
      chalk.red(
        'Cannot prompt for confirmation in non-interactive mode. Use --yes to skip confirmation.'
      )
    );
    return null;
  }
  const answer = await promptForConfirmation(name);
  if (answer === null || answer !== name) {
    console.log('Removal cancelled');
    return null;
  }
  return 'typed-name';
}

export const removeCommand = new Command('remove')
  .description('Remove an instance with safety checks')
  .argument('<name>', 'Instance name to remove')
  .option('--repo <slug>', 'Repo slug or URL to scope instance lookup')
  .option('--force', 'Force removal, bypassing safety checks')
  .option(
    '--yes',
    'Skip confirmation prompt for --force (DANGEROUS: skips all safety prompts, for scripts only)'
  )
  .action(async (name: string, options: { repo?: string; force?: boolean; yes?: boolean }) => {
    if (options.yes && !options.force) {
      console.error(
        formatError(
          createError(
            'INVALID_OPTIONS',
            '--yes can only be used with --force',
            'Use `agent-env remove <name> --force --yes` to force-remove without confirmation.'
          )
        )
      );
      process.exit(1);
      return;
    }

    // Phase 1: Resolve repo context
    const executor = createExecutor();
    const repoResult = await resolveRepo({ repo: options.repo, cwd: process.cwd() }, executor);

    let repoSlug: string | undefined;
    if (repoResult.resolved) {
      repoSlug = repoResult.repoSlug;
    } else if ('error' in repoResult && repoResult.error) {
      console.error(
        formatError(
          createError(repoResult.error.code, repoResult.error.message, repoResult.error.suggestion)
        )
      );
      process.exit(1);
      return;
    }

    const deps = createRemoveDefaultDeps();
    const checkResult = await removeInstance(name, deps, false, repoSlug);

    if (checkResult.ok) {
      if (options.force) {
        console.log(`Instance '${name}' force-removed. Data permanently deleted.`);
        await writeAuditLog(name, checkResult.gitState ?? null, 'not-required');
      } else {
        console.log(`Instance '${name}' removed`);
      }
      return;
    }

    if (checkResult.error.code !== 'SAFETY_CHECK_FAILED') {
      const { code, message, suggestion } = checkResult.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
      return;
    }

    if (!options.force) {
      if (checkResult.gitState && checkResult.blockers) {
        console.error(formatSafetyReport(name, checkResult.blockers, checkResult.gitState));
      }
      process.exit(1);
      return;
    }

    const { gitState, blockers } = checkResult;
    if (gitState && blockers && blockers.length > 0) {
      showForceWarning(name, blockers, gitState);
    }

    const confirmationMethod = await resolveConfirmation(name, options);
    if (!confirmationMethod) {
      process.exit(1);
      return;
    }

    const forceResult = await removeInstance(name, deps, true, repoSlug);
    if (!forceResult.ok) {
      const { code, message, suggestion } = forceResult.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
      return;
    }

    console.log(`Instance '${name}' force-removed. Data permanently deleted.`);
    await writeAuditLog(name, gitState ?? null, confirmationMethod);
  });
