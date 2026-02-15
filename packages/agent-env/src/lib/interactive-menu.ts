/**
 * Interactive menu orchestration for agent-env
 *
 * Lists instances and renders an interactive menu for selection.
 * On selection, provides an action menu (Attach, Rebuild, etc.).
 * Uses dependency injection for all I/O operations to enable testing.
 */

import type { InstanceAction } from '../components/InteractiveMenu.js';
import type { AttachResult, AttachInstanceDeps } from './attach-instance.js';
import type { Instance, ListResult } from './list-instances.js';
import type { RebuildInstanceDeps, RebuildOptions, RebuildResult } from './rebuild-instance.js';
import type { RemoveInstanceDeps, RemoveResult } from './remove-instance.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MenuResult =
  | { ok: true; action: 'attached' | 'rebuilt' | 'removed' | 'purpose-shown'; instanceName: string }
  | { ok: true; action: 'empty' }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export interface InteractiveMenuDeps {
  listInstances: () => Promise<ListResult>;
  attachInstance: (
    name: string,
    deps: AttachInstanceDeps,
    onStarting?: () => void
  ) => Promise<AttachResult>;
  rebuildInstance: (
    name: string,
    deps: RebuildInstanceDeps,
    options?: RebuildOptions
  ) => Promise<RebuildResult>;
  removeInstance: (name: string, deps: RemoveInstanceDeps, force: boolean) => Promise<RemoveResult>;
  createAttachDeps: () => AttachInstanceDeps;
  createRebuildDeps: () => RebuildInstanceDeps;
  createRemoveDeps: () => RemoveInstanceDeps;
  renderMenu: (
    instances: Instance[],
    onAction: (action: InstanceAction, name: string) => void
  ) => { waitUntilExit: () => Promise<void> };
}

// ─── Orchestration ──────────────────────────────────────────────────────────

/**
 * Launch the interactive menu.
 *
 * 1. List all instances
 * 2. If none, show empty state and return
 * 3. Render interactive menu with instance selection
 * 4. On selection, show action menu
 * 5. Execute chosen action
 */
export async function launchInteractiveMenu(deps: InteractiveMenuDeps): Promise<MenuResult> {
  // Step 1: List instances
  const listResult = await deps.listInstances();

  if (!listResult.ok) {
    return {
      ok: false,
      error: {
        code: listResult.error.code,
        message: listResult.error.message,
        suggestion: 'Check if ~/.agent-env/workspaces/ is accessible.',
      },
    };
  }

  // Step 2: No instances
  if (listResult.instances.length === 0) {
    deps.renderMenu(listResult.instances, () => {});
    return { ok: true, action: 'empty' };
  }

  // Step 3: Render menu and wait for selection
  let selectedName: string | undefined;
  let selectedAction: InstanceAction | undefined;

  const selectionPromise = new Promise<{ action: InstanceAction; name: string }>((resolve) => {
    const { waitUntilExit } = deps.renderMenu(
      listResult.instances,
      (action: InstanceAction, name: string) => {
        selectedAction = action;
        selectedName = name;
        resolve({ action, name });
      }
    );

    void waitUntilExit().then(() => {
      if (!selectedName || !selectedAction) {
        // Resolve with empty to indicate exit
        resolve({ action: 'attach', name: '' });
      }
    });
  });

  const { action, name } = await selectionPromise;

  // User exited without selecting
  if (!name) {
    return { ok: true, action: 'empty' };
  }

  // Step 4: Execute selected action
  switch (action) {
    case 'attach': {
      const attachDeps = deps.createAttachDeps();
      const attachResult = await deps.attachInstance(name, attachDeps);
      if (!attachResult.ok) return { ok: false, error: attachResult.error };
      return { ok: true, action: 'attached', instanceName: name };
    }

    case 'rebuild': {
      // Interactive menu selection IS the user's confirmation — pass force: true
      // so running containers can be rebuilt without a dead-end.
      const rebuildDeps = deps.createRebuildDeps();
      const rebuildResult = await deps.rebuildInstance(name, rebuildDeps, { force: true });
      if (!rebuildResult.ok) return { ok: false, error: rebuildResult.error };
      return { ok: true, action: 'rebuilt', instanceName: name };
    }

    case 'purpose': {
      const instance = listResult.instances.find((i) => i.name === name);
      if (instance) {
        console.log(`\nPurpose for ${name}:`);
        console.log(instance.purpose || 'No purpose set.');
      }
      return { ok: true, action: 'purpose-shown', instanceName: name };
    }

    case 'remove': {
      const removeDeps = deps.createRemoveDeps();
      // We use force=false for the interactive menu to trigger safety checks
      const removeResult = await deps.removeInstance(name, removeDeps, false);
      if (!removeResult.ok) return { ok: false, error: removeResult.error };
      return { ok: true, action: 'removed', instanceName: name };
    }
  }
}
