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
  setPurpose: (
    name: string,
    value: string,
    repoSlug?: string
  ) => Promise<{ ok: boolean; error?: { code: string; message: string; suggestion?: string } }>;
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
    // Step 1: Get fresh instance info
    const instanceInfo = await deps.getInstanceInfo(workspaceName);

    // Step 2: Render menu and get user selection
    const { action, purposeValue } = await deps.renderMenu(instanceInfo);

    // Step 3: Exit if requested
    if (action === 'exit') {
      break;
    }

    // Step 4: Execute action
    try {
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
      }

      // Handle action-level errors
      if (!result.ok && result.error) {
        const { code, message, suggestion } = result.error;
        console.error(formatError(createError(code, message, suggestion)));
      }
    } catch (err) {
      // Unexpected errors — format and continue
      const message = err instanceof Error ? err.message : String(err);
      console.error(formatError(createError('ACTION_ERROR', message)));
    }
  }
}

// ─── Instance Picker ─────────────────────────────────────────────────────────

/**
 * Launch an instance picker for the default no-arg CLI flow.
 *
 * Lists instances and renders a picker. Returns the selected workspace name,
 * or null if the user exits or there's an error.
 */
// ─── Instance Picker ─────────────────────────────────────────────────────────

export async function launchInstancePicker(deps: InstancePickerDeps): Promise<string | null> {
  const listResult = await deps.listInstances();

  if (!listResult.ok) {
    const { code, message } = listResult.error;
    console.error(
      formatError(createError(code, message, 'Check if ~/.agent-env/workspaces/ is accessible.'))
    );
    return null;
  }

  return deps.renderPicker(listResult.instances);
}
