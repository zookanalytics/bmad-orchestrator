/**
 * Instance listing logic for agent-env
 *
 * Scans workspaces, reads state, checks container status, and assembles
 * a unified view of all instances. Uses dependency injection for all
 * I/O operations to enable testing.
 */

import type { ContainerLifecycle } from './container.js';
import type { GitStateDetector } from './git.js';
import type { StateFsDeps } from './state.js';
import type { ContainerStatus, GitStateResult, InstanceState, WorkspacePath } from './types.js';
import type { FsDeps } from './workspace.js';

import { createContainerLifecycle } from './container.js';
import { createGitStateDetector } from './git.js';
import { readState } from './state.js';
import { getWorkspacePathByName, scanWorkspaces } from './workspace.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Display status for an instance (extends ContainerStatus with degraded states) */
export type InstanceDisplayStatus = ContainerStatus | 'orphaned' | 'unknown';

/** A single instance's data for display */
export interface Instance {
  /** Workspace name (e.g., "bmad-orch-auth") */
  name: string;
  /** Display status: running, stopped, orphaned, unknown, not-found */
  status: InstanceDisplayStatus;
  /** ISO 8601 last-attached timestamp, or null if unknown */
  lastAttached: string | null;
  /** User-set purpose, or null */
  purpose: string | null;
  /** Git state result, or null if unavailable (e.g., Docker down) */
  gitState: GitStateResult | null;
  /** SSH connection string (e.g., "node@ae-repo-auth.orb.local" or "node@localhost -p 1234") */
  sshConnection: string | null;
}

/** Successful result from listing instances */
export type ListSuccess = {
  ok: true;
  instances: Instance[];
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
  gitDetector: GitStateDetector;
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
    const gitDetector = deps?.gitDetector ?? createGitStateDetector();
    const wsFsDeps = deps?.workspaceFsDeps;
    const stateFsDeps = deps?.stateFsDeps;

    // Step 1: Scan for workspace names
    const workspaceNames = await scanWorkspaces(wsFsDeps);

    if (workspaceNames.length === 0) {
      return { ok: true, instances: [], dockerAvailable: true };
    }

    // Step 2: Check Docker availability once
    const dockerAvailable = await container.isDockerAvailable();

    // Step 3: For each workspace, read state, check container status, and detect git state in parallel
    const instancePromises = workspaceNames.map(async (wsName): Promise<Instance> => {
      const wsPath: WorkspacePath = getWorkspacePathByName(wsName, wsFsDeps);
      const state: InstanceState = await readState(wsPath, stateFsDeps);

      // Run container status check and git state detection in parallel
      const containerPromise = dockerAvailable
        ? container.containerStatus(state.containerName)
        : Promise.resolve(null);
      const gitPromise = gitDetector.getGitState(wsPath.root);

      const [containerResult, gitState] = await Promise.all([containerPromise, gitPromise]);

      // Determine display status
      let status: InstanceDisplayStatus;

      if (!dockerAvailable || containerResult === null) {
        status = 'unknown';
      } else if (!containerResult.ok) {
        // Error checking container — treat as unknown
        status = 'unknown';
      } else if (containerResult.status === 'not-found') {
        // Workspace exists but no container — orphaned
        status = 'orphaned';
      } else {
        status = containerResult.status;
      }

      // Calculate SSH connection string
      let sshConnection: string | null = null;
      if (status === 'running' && containerResult && containerResult.ok) {
        const sshPort = containerResult.ports['22/tcp'];
        if (sshPort) {
          // Primary: OrbStack DNS (handles collisions via dedicated IP per container)
          sshConnection = `node@${state.containerName}.orb.local`;
          // Fallback: host port mapping (works with Docker Desktop and non-OrbStack runtimes)
          if (sshPort !== '22') {
            sshConnection += ` (localhost:${sshPort})`;
          }
        }
      }

      return {
        name: wsName,
        status,
        lastAttached: state.lastAttached !== 'unknown' ? state.lastAttached : null,
        purpose: state.purpose,
        gitState,
        sshConnection,
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
