/**
 * Instance listing logic for agent-env
 *
 * Scans workspaces, reads state, checks container status, and assembles
 * a unified view of all instances. Uses dependency injection for all
 * I/O operations to enable testing.
 */

import type { ContainerLifecycle } from './container.js';
import type { StateFsDeps } from './state.js';
import type { ContainerStatus, InstanceState, WorkspacePath } from './types.js';
import type { FsDeps } from './workspace.js';

import { createContainerLifecycle } from './container.js';
import { readState } from './state.js';
import { getWorkspacePathByName, scanWorkspaces } from './workspace.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Display status for an instance (extends ContainerStatus with degraded states) */
export type InstanceDisplayStatus = ContainerStatus | 'orphaned' | 'unknown';

/** A single instance's data for display */
export interface InstanceInfo {
  /** Workspace name (e.g., "bmad-orch-auth") */
  name: string;
  /** Display status: running, stopped, orphaned, unknown, not-found */
  status: InstanceDisplayStatus;
  /** ISO 8601 last-attached timestamp, or null if unknown */
  lastAttached: string | null;
  /** User-set purpose, or null */
  purpose: string | null;
}

/** Successful result from listing instances */
export type ListSuccess = {
  ok: true;
  instances: InstanceInfo[];
  dockerAvailable: boolean;
};

/** Error result from listing instances */
export type ListError = {
  ok: false;
  instances: null;
  dockerAvailable: null;
  error: { code: string; message: string };
};

/** Result from listing instances */
export type ListResult = ListSuccess | ListError;

/** Dependencies for the instance lister */
export interface ListInstancesDeps {
  container: ContainerLifecycle;
  workspaceFsDeps: FsDeps;
  stateFsDeps: Pick<StateFsDeps, 'readFile'>;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * List all instances with their current status.
 *
 * Scans workspaces, reads state files, and checks container status.
 * Handles Docker being unavailable gracefully.
 *
 * @param deps - Injectable dependencies for testing
 * @returns ListResult with instance info array
 */
export async function listInstances(deps?: Partial<ListInstancesDeps>): Promise<ListResult> {
  try {
    const container = deps?.container ?? createContainerLifecycle();
    const wsFsDeps = deps?.workspaceFsDeps;
    const stateFsDeps = deps?.stateFsDeps;

    // Step 1: Scan for workspace names
    const workspaceNames = await scanWorkspaces(wsFsDeps);

    if (workspaceNames.length === 0) {
      return { ok: true, instances: [], dockerAvailable: true };
    }

    // Step 2: Check Docker availability once
    const dockerAvailable = await container.isDockerAvailable();

    // Step 3: For each workspace, read state and check container status in parallel
    const instancePromises = workspaceNames.map(async (wsName): Promise<InstanceInfo> => {
      const wsPath: WorkspacePath = getWorkspacePathByName(wsName, wsFsDeps);
      const state: InstanceState = await readState(wsPath, stateFsDeps);

      // Determine display status
      let status: InstanceDisplayStatus;

      if (!dockerAvailable) {
        status = 'unknown';
      } else {
        const containerResult = await container.containerStatus(state.containerName);

        if (!containerResult.ok) {
          // Error checking container — treat as unknown
          status = 'unknown';
        } else if (containerResult.status === 'not-found') {
          // Workspace exists but no container — orphaned
          status = 'orphaned';
        } else {
          status = containerResult.status;
        }
      }

      return {
        name: wsName,
        status,
        lastAttached: state.lastAttached !== 'unknown' ? state.lastAttached : null,
        purpose: state.purpose,
      };
    });

    const instances = await Promise.all(instancePromises);

    return { ok: true, instances, dockerAvailable };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      instances: null,
      dockerAvailable: null,
      error: { code: 'LIST_ERROR', message: `Failed to list instances: ${message}` },
    };
  }
}
