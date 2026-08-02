/**
 * Shared factory for InteractiveMenuDeps used by both `on` command and default CLI flow.
 */

import { render } from 'ink';
import React from 'react';

import type { InteractiveMenuDeps } from './interactive-menu.js';

import { MenuContainer } from '../components/MenuContainer.js';
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
import {
  detectDriftState,
  detectImageDrift,
  getCurrentVersion,
  isNewerVersion,
  isPackagePathStale,
} from './version-drift.js';

/**
 * Build the DI wrappers for the action loop.
 * Shared between the `on` command and the default no-arg flow.
 *
 * @param workspaceName - The active workspace name. Threaded through to
 *   `detectDriftState` so the manual "Check for updates" surface includes
 *   image-drift signals, not only registry/install drift.
 */
export function buildMenuDeps(workspaceName: string): InteractiveMenuDeps {
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
    rebuildInstance: async (wsName, slug) => {
      // Pre-flight drift check: if our install is gone from disk, rebuild
      // would fail with an opaque CONFIG_REFRESH_FAILED error. Surface a
      // clear "restart the menu" message instead.
      if (await isPackagePathStale()) {
        return {
          ok: false,
          error: {
            code: 'VERSION_DRIFT',
            message: 'agent-env was upgraded since this menu started.',
            suggestion: 'Pick "Restart menu" from the menu to reload with the new version.',
          },
        };
      }

      const rebuildDeps = createRebuildDefaultDeps();
      const progress = createProgressLine();
      console.log(`Rebuilding instance '${wsName}'...`);
      try {
        return await rebuildInstanceLib(
          wsName,
          rebuildDeps,
          { force: true, onProgress: progress.update },
          slug
        );
      } finally {
        progress.clear();
      }
    },
    shutdownInstance: (wsName, slug) => {
      const deps = createShutdownDefaultDeps();
      console.log(`Shutting down instance '${wsName}'...`);
      return shutdownInstanceLib(wsName, deps, slug).then((result) => {
        if (result.ok) {
          console.log(`\x1b[32m✓\x1b[0m Instance '${wsName}' shut down`);
        }
        return result;
      });
    },
    setPurpose: (wsName, value, slug) => {
      const deps = createPurposeDefaultDeps();
      return setPurposeLib(wsName, value, deps, slug);
    },
    checkForUpdates: async () => {
      console.log('Checking for updates...');
      const state = await detectDriftState(
        workspaceName,
        {
          // Outside the Ink render loop console output is safe — surface
          // corrupt-config warnings from the image-drift probe here.
          detectImageDrift: (path) =>
            detectImageDrift(path, { logger: { warn: (m) => console.warn(m) } }),
        },
        { forceRefresh: true }
      );
      const current = getCurrentVersion();
      if (state.packageMoved) {
        console.log(
          '\x1b[31m⚠  agent-env was upgraded since this menu started — pick "Restart menu" to reload.\x1b[0m'
        );
      } else if (state.installedVersion && isNewerVersion(current, state.installedVersion)) {
        console.log(
          `\x1b[33magent-env v${state.installedVersion} is installed — pick "Restart menu" to use it.\x1b[0m`
        );
      } else {
        // updateMessage and imageDrift are independent signals — report both
        // (a user can have a newer npm version AND a stale local image).
        if (state.updateMessage) {
          console.log(state.updateMessage);
        }
        if (state.imageDrift) {
          console.log(
            `\x1b[36mContainer image will refresh on next rebuild: ${state.imageDrift.configuredImage} → ${state.imageDrift.expectedImage}\x1b[0m`
          );
        }
        if (!state.updateMessage && !state.imageDrift) {
          console.log(`\x1b[32m✓\x1b[0m agent-env ${current} is up to date`);
        }
      }
      return { ok: true };
    },
    getInstanceInfo: (wsName) => getInstanceInfoLib(wsName),
    renderMenu: (instanceInfo) => {
      return new Promise((resolve) => {
        const { unmount, waitUntilExit } = render(
          React.createElement(MenuContainer, {
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
