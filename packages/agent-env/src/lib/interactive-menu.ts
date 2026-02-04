/**
 * Interactive menu orchestration for agent-env
 *
 * Lists instances and renders an interactive menu for selection.
 * On selection, attaches to the chosen instance's tmux session.
 * Uses dependency injection for all I/O operations to enable testing.
 */

import type { AttachResult, AttachInstanceDeps } from './attach-instance.js';
import type { Instance, ListResult } from './list-instances.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MenuResult =
  | { ok: true; action: 'attached'; instanceName: string }
  | { ok: true; action: 'empty' }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export interface InteractiveMenuDeps {
  listInstances: () => Promise<ListResult>;
  attachInstance: (
    name: string,
    deps: AttachInstanceDeps,
    onStarting?: () => void
  ) => Promise<AttachResult>;
  createAttachDeps: () => AttachInstanceDeps;
  renderMenu: (
    instances: Instance[],
    onSelect: (name: string) => void
  ) => { waitUntilExit: () => Promise<void> };
}

// ─── Orchestration ──────────────────────────────────────────────────────────

/**
 * Launch the interactive menu.
 *
 * 1. List all instances
 * 2. If none, show empty state and return
 * 3. Render interactive menu with instance selection
 * 4. On selection, attach to the chosen instance
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
    // Render menu with empty state (component handles display)
    deps.renderMenu(listResult.instances, () => {});
    return { ok: true, action: 'empty' };
  }

  // Step 3: Render menu and wait for selection
  let selectedName: string | undefined;

  const selectionPromise = new Promise<string>((resolve) => {
    const { waitUntilExit } = deps.renderMenu(listResult.instances, (name: string) => {
      selectedName = name;
      resolve(name);
    });

    // If the user exits without selecting (e.g., Ctrl+C), waitUntilExit resolves
    void waitUntilExit().then(() => {
      if (!selectedName) {
        resolve('');
      }
    });
  });

  const name = await selectionPromise;

  // User exited without selecting
  if (!name) {
    return { ok: true, action: 'empty' };
  }

  // Step 4: Attach to selected instance
  const attachDeps = deps.createAttachDeps();
  const attachResult = await deps.attachInstance(name, attachDeps);

  if (!attachResult.ok) {
    return {
      ok: false,
      error: attachResult.error,
    };
  }

  return { ok: true, action: 'attached', instanceName: name };
}
