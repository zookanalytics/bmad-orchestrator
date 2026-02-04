/**
 * Attach instance orchestration for agent-env
 *
 * Orchestrates the full attach flow: find workspace → check Docker → check/start container → attach tmux → update state.
 * Uses dependency injection for all I/O operations to enable testing.
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createExecutor } from '@zookanalytics/shared';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';

import type { ContainerLifecycle } from './container.js';
import type { StateFsDeps } from './state.js';
import type { FsDeps } from './workspace.js';

import { createContainerLifecycle } from './container.js';
import { attachToInstance } from './create-instance.js';
import { readState, writeStateAtomic } from './state.js';
import { getWorkspacePathByName, scanWorkspaces } from './workspace.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export type AttachResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export interface AttachInstanceDeps {
  executor: Execute;
  container: ContainerLifecycle;
  workspaceFsDeps: FsDeps;
  stateFsDeps: StateFsDeps;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create default dependencies for attachInstance.
 * Useful for production; tests inject their own.
 */
export function createAttachDefaultDeps(): AttachInstanceDeps {
  const executor = createExecutor();
  return {
    executor,
    container: createContainerLifecycle(executor),
    workspaceFsDeps: { mkdir, readdir, stat, homedir },
    stateFsDeps: { readFile, writeFile, rename, mkdir },
  };
}

// ─── Workspace Lookup ────────────────────────────────────────────────────────

export type WorkspaceLookupResult =
  | { found: true; workspaceName: string }
  | { found: false; reason: 'not-found' }
  | { found: false; reason: 'ambiguous'; matches: string[] };

/**
 * Find a workspace by instance name.
 *
 * Searches all workspaces for one whose name ends with `-<instanceName>`.
 * If exactly one match is found, returns the workspace name.
 * If the instance name matches a full workspace name exactly, returns that.
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param deps - Filesystem dependencies
 * @returns Lookup result with workspace name, or reason for failure
 */
export async function findWorkspaceByName(
  instanceName: string,
  deps: FsDeps
): Promise<WorkspaceLookupResult> {
  const workspaces = await scanWorkspaces(deps);

  // Exact match first
  if (workspaces.includes(instanceName)) {
    return { found: true, workspaceName: instanceName };
  }

  // Suffix match: workspace names are `<repo>-<instance>`
  const suffixMatches = workspaces.filter((ws) => ws.endsWith(`-${instanceName}`));

  if (suffixMatches.length === 1) {
    return { found: true, workspaceName: suffixMatches[0] };
  }

  if (suffixMatches.length > 1) {
    return { found: false, reason: 'ambiguous', matches: suffixMatches };
  }

  return { found: false, reason: 'not-found' };
}

// ─── Attach Orchestration ────────────────────────────────────────────────────

/**
 * Attach to an existing instance's tmux session.
 *
 * Orchestration flow:
 * 1. Find workspace by instance name
 * 2. Read state to get container name
 * 3. Check Docker availability
 * 4. Check container status
 * 5. If stopped → start container via devcontainerUp
 * 6. Attach to tmux session via docker exec
 * 7. Update lastAttached timestamp in state.json
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param deps - Injectable dependencies
 * @param onContainerStarting - Optional callback for progress output
 * @returns AttachResult with success/failure info
 */
export async function attachInstance(
  instanceName: string,
  deps: AttachInstanceDeps,
  onContainerStarting?: () => void
): Promise<AttachResult> {
  // Step 1: Find workspace
  const lookup = await findWorkspaceByName(instanceName, deps.workspaceFsDeps);

  if (!lookup.found) {
    if (lookup.reason === 'ambiguous') {
      return {
        ok: false,
        error: {
          code: 'AMBIGUOUS_MATCH',
          message: `Multiple instances match '${instanceName}': ${lookup.matches.join(', ')}`,
          suggestion: 'Use the full workspace name to specify which instance.',
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'WORKSPACE_NOT_FOUND',
        message: `Instance '${instanceName}' not found`,
        suggestion: 'Use `agent-env list` to see available instances.',
      },
    };
  }

  const wsPath = getWorkspacePathByName(lookup.workspaceName, deps.workspaceFsDeps);
  const state = await readState(wsPath, deps.stateFsDeps);
  const containerName = state.containerName;

  // Step 2: Check Docker availability
  const dockerAvailable = await deps.container.isDockerAvailable();
  if (!dockerAvailable) {
    return {
      ok: false,
      error: {
        code: 'ORBSTACK_REQUIRED',
        message: 'Docker is not available. OrbStack or Docker Desktop must be running.',
        suggestion: 'Start OrbStack or Docker Desktop, then try again.',
      },
    };
  }

  // Step 3: Check container status
  const statusResult = await deps.container.containerStatus(containerName);

  if (!statusResult.ok) {
    return {
      ok: false,
      error: statusResult.error ?? {
        code: 'CONTAINER_ERROR',
        message: `Failed to check container status for '${containerName}'.`,
      },
    };
  }

  // Step 4: Start container if stopped or not found
  if (statusResult.status === 'stopped' || statusResult.status === 'not-found') {
    onContainerStarting?.();

    const startResult = await deps.container.devcontainerUp(wsPath.root, containerName);

    if (!startResult.ok) {
      return {
        ok: false,
        error: startResult.error ?? {
          code: 'CONTAINER_ERROR',
          message: `Failed to start container '${containerName}'.`,
          suggestion: 'Check Docker logs for details.',
        },
      };
    }
  }

  // Step 5: Attach to tmux session
  const attachResult = await attachToInstance(containerName, deps.executor);

  if (!attachResult.ok) {
    return attachResult;
  }

  // Step 6: Update lastAttached timestamp
  const updatedState = {
    ...state,
    lastAttached: new Date().toISOString(),
  };
  await writeStateAtomic(wsPath, updatedState, deps.stateFsDeps);

  return { ok: true };
}
