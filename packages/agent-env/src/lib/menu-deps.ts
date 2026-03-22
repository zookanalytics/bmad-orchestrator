/**
 * Shared factory for InteractiveMenuDeps used by both `on` command and default CLI flow.
 */

import { render } from 'ink';
import React from 'react';

import type { InteractiveMenuDeps } from './interactive-menu.js';

import { InteractiveMenu } from '../components/InteractiveMenu.js';
import { createAttachDefaultDeps, attachInstance as attachInstanceLib } from './attach-instance.js';
import { createCodeDefaultDeps, codeInstance as codeInstanceLib } from './code-instance.js';
import { getInstanceInfo as getInstanceInfoLib } from './list-instances.js';
import { createProgressLine } from './progress-line.js';
import { createPurposeDefaultDeps, setPurpose as setPurposeLib } from './purpose-instance.js';
import {
  createRebuildDefaultDeps,
  rebuildInstance as rebuildInstanceLib,
} from './rebuild-instance.js';
import {
  createShutdownDefaultDeps,
  shutdownInstance as shutdownInstanceLib,
} from './shutdown-instance.js';

/**
 * Build the DI wrappers for the action loop.
 * Shared between the `on` command and the default no-arg flow.
 */
export function buildMenuDeps(): InteractiveMenuDeps {
  return {
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
    shutdownInstance: (wsName, slug) => {
      const deps = createShutdownDefaultDeps();
      console.log(`Shutting down instance '${wsName}'...`);
      return shutdownInstanceLib(wsName, deps, slug);
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
}
