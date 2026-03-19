import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';

import { InteractiveMenu } from '../components/InteractiveMenu.js';
import {
  createAttachDefaultDeps,
  attachInstance as attachInstanceLib,
} from '../lib/attach-instance.js';
import { createCodeDefaultDeps, codeInstance as codeInstanceLib } from '../lib/code-instance.js';
import { resolveRepoOrExit } from '../lib/command-helpers.js';
import { launchActionLoop, type InteractiveMenuDeps } from '../lib/interactive-menu.js';
import { getInstanceInfo as getInstanceInfoLib } from '../lib/list-instances.js';
import { createProgressLine } from '../lib/progress-line.js';
import { createPurposeDefaultDeps, setPurpose as setPurposeLib } from '../lib/purpose-instance.js';
import {
  createRebuildDefaultDeps,
  rebuildInstance as rebuildInstanceLib,
} from '../lib/rebuild-instance.js';
import { resolveInstance } from '../lib/workspace.js';

export const onCommand = new Command('on')
  .description('Open the interactive menu for an instance')
  .argument('<name>', 'Instance name')
  .option('--repo <slug>', 'Repo slug or URL to scope instance lookup')
  .action(async (name: string, options: { repo?: string }) => {
    // TTY gate: the interactive menu requires a terminal
    if (!process.stdin.isTTY) {
      console.error(
        formatError(
          createError(
            'TTY_REQUIRED',
            'The interactive menu requires a terminal (TTY).',
            'Run this command in an interactive terminal session.'
          )
        )
      );
      process.exit(1);
      return;
    }

    // Phase 1: Resolve repo context
    const repoSlug = await resolveRepoOrExit({ repo: options.repo, cwd: process.cwd() });

    // Phase 2: Resolve instance
    const lookup = await resolveInstance(name, repoSlug);

    if (!lookup.found) {
      const { code, message, suggestion } = lookup.error;
      console.error(formatError(createError(code, message, suggestion)));
      process.exit(1);
      return;
    }

    const { workspaceName } = lookup;

    // Build DI wrappers for the action loop
    const menuDeps: InteractiveMenuDeps = {
      attachInstance: (wsName, slug) => {
        const deps = createAttachDefaultDeps();
        return attachInstanceLib(
          wsName,
          deps,
          () => console.log('Starting container...'),
          () => {
            console.log();
            console.log('Attaching to tmux session...');
          },
          slug
        );
      },
      codeInstance: (wsName, slug) => {
        const deps = createCodeDefaultDeps();
        return codeInstanceLib(
          wsName,
          deps,
          () => console.log('Starting container...'),
          () => console.log('Opening VS Code...'),
          slug
        );
      },
      rebuildInstance: (wsName, slug) => {
        const rebuildDeps = createRebuildDefaultDeps();
        const progress = createProgressLine();
        console.log(`Rebuilding instance '${wsName}'...`);
        return rebuildInstanceLib(
          wsName,
          rebuildDeps,
          { force: true, onProgress: progress.update },
          slug
        )
          .then((result) => {
            progress.clear();
            return result;
          })
          .catch((err) => {
            progress.clear();
            throw err;
          });
      },
      setPurpose: (wsName, value, slug) => {
        const deps = createPurposeDefaultDeps();
        return setPurposeLib(wsName, value, deps, slug);
      },
      getInstanceInfo: (wsName) => getInstanceInfoLib(wsName),
      renderMenu: (instanceInfo) => {
        return new Promise((resolve) => {
          const { unmount, waitUntilExit } = render(
            React.createElement(InteractiveMenu, {
              instanceInfo,
              onAction: (action) => {
                unmount();
                resolve({ action });
              },
              onSetPurpose: (value) => {
                unmount();
                resolve({ action: 'set-purpose' as const, purposeValue: value });
              },
            })
          );
          void waitUntilExit();
        });
      },
    };

    // Launch the persistent action loop
    await launchActionLoop(workspaceName, menuDeps, repoSlug);
  });
