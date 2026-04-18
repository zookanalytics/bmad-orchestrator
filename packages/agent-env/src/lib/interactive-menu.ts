/**
 * Interactive menu orchestration for agent-env
 *
 * Provides two flows:
 * 1. launchActionLoop — persistent action loop for a single instance
 * 2. launchInstancePicker — instance selection picker for the default CLI flow
 *
 * Uses dependency injection for all I/O operations to enable testing.
 */

import { formatError, createError } from '@zookanalytics/shared';

import type { MenuAction } from '../components/InteractiveMenu.js';
import type { Instance, InstanceInfo, ListResult } from './list-instances.js';

import { restartMenu } from './version-drift.js';

// Re-export MenuAction so consumers can import from here
export type { MenuAction } from '../components/InteractiveMenu.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InteractiveMenuDeps {
  attachInstance: (
    name: string,
    repoSlug?: string
  ) => Promise<{ ok: boolean; error?: { code: string; message: string; suggestion?: string } }>;
  codeInstance: (
    name: string,
    repoSlug?: string
  ) => Promise<{ ok: boolean; error?: { code: string; message: string; suggestion?: string } }>;
  rebuildInstance: (
    name: string,
    repoSlug?: string
  ) => Promise<{
    ok: boolean;
    containerName?: string;
    error?: { code: string; message: string; suggestion?: string };
  }>;
  shutdownInstance: (
    name: string,
    repoSlug?: string
  ) => Promise<{ ok: boolean; error?: { code: string; message: string; suggestion?: string } }>;
  setPurpose: (
    name: string,
    value: string,
    repoSlug?: string
  ) => Promise<{ ok: boolean; error?: { code: string; message: string; suggestion?: string } }>;
  /**
   * Force a fresh drift probe (bypassing the registry cache) and print a
   * user-facing result. Used by the manual "Check for updates" action.
   */
  checkForUpdates: () => Promise<{
    ok: boolean;
    error?: { code: string; message: string; suggestion?: string };
  }>;
  getInstanceInfo: (workspaceName: string) => Promise<InstanceInfo>;
  renderMenu: (
    instanceInfo: InstanceInfo
  ) => Promise<{ action: MenuAction; purposeValue?: string }>;
}

export interface InstancePickerDeps {
  listInstances: () => Promise<ListResult>;
  renderPicker: (instances: Instance[]) => Promise<string | null>;
}

// ─── Action Loop ─────────────────────────────────────────────────────────────

/**
 * Launch a persistent action loop for a single instance.
 *
 * 1. Get instance info
 * 2. Render action menu
 * 3. Execute selected action
 * 4. On 'exit', break loop
 * 5. On error, print formatted error and continue
 * 6. Loop back to step 1 (re-reads instance state)
 */
export async function launchActionLoop(
  workspaceName: string,
  deps: InteractiveMenuDeps,
  repoSlug?: string
): Promise<void> {
  while (true) {
    try {
      // Step 1: Get fresh instance info
      const instanceInfo = await deps.getInstanceInfo(workspaceName);

      // Step 2: Render menu and get user selection
      const { action, purposeValue } = await deps.renderMenu(instanceInfo);

      // Step 3: Exit if requested
      if (action === 'exit') {
        break;
      }

      // Step 3a: Restart — exec a fresh `agent-env on` process and exit.
      // In production restartMenu() calls process.exit and never returns;
      // the `continue` below is only reached if a test injects a no-op.
      if (action === 'restart') {
        restartMenu({ workspaceName, repoSlug });
        continue;
      }

      // Step 3b: Shutdown — exit loop only on success, stay on failure
      if (action === 'shutdown') {
        const shutdownResult = await deps.shutdownInstance(workspaceName, repoSlug);
        if (!shutdownResult.ok) {
          if (shutdownResult.error) {
            const { code, message, suggestion } = shutdownResult.error;
            console.error(formatError(createError(code, message, suggestion)));
          }
          continue;
        }
        break;
      }

      // Step 4: Execute action
      let result: { ok: boolean; error?: { code: string; message: string; suggestion?: string } };

      switch (action) {
        case 'attach':
          result = await deps.attachInstance(workspaceName, repoSlug);
          break;
        case 'code':
          result = await deps.codeInstance(workspaceName, repoSlug);
          break;
        case 'rebuild':
          result = await deps.rebuildInstance(workspaceName, repoSlug);
          break;
        case 'set-purpose':
          result = await deps.setPurpose(workspaceName, purposeValue ?? '', repoSlug);
          break;
        case 'check-updates':
          result = await deps.checkForUpdates();
          break;
      }

      // Handle action-level errors
      if (!result.ok && result.error) {
        const { code, message, suggestion } = result.error;
        console.error(formatError(createError(code, message, suggestion)));
      }
    } catch (err) {
      // Unexpected errors (including getInstanceInfo / renderMenu failures) — format and continue
      const message = err instanceof Error ? err.message : String(err);
      console.error(formatError(createError('ACTION_ERROR', message)));
    }
  }
}

// ─── Instance Picker ─────────────────────────────────────────────────────────

/** Discriminated union result from launchInstancePicker */
export type PickerResult =
  | { kind: 'selected'; name: string }
  | { kind: 'cancelled' }
  | { kind: 'error' };

/**
 * Launch an instance picker for the default no-arg CLI flow.
 *
 * Lists instances and renders a picker. Returns a discriminated union:
 * - `{ kind: 'selected', name }` when a workspace is chosen
 * - `{ kind: 'cancelled' }` when the user exits or there are no instances
 * - `{ kind: 'error' }` when listing instances fails
 */
export async function launchInstancePicker(deps: InstancePickerDeps): Promise<PickerResult> {
  const listResult = await deps.listInstances();

  if (!listResult.ok) {
    const { code, message } = listResult.error;
    console.error(
      formatError(createError(code, message, 'Check if ~/.agent-env/workspaces/ is accessible.'))
    );
    return { kind: 'error' };
  }

  const selected = await deps.renderPicker(listResult.instances);

  if (selected === null) {
    return { kind: 'cancelled' };
  }

  return { kind: 'selected', name: selected };
}
