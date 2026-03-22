/**
 * Shutdown instance orchestration for agent-env
 *
 * Orchestrates a graceful shutdown:
 *   find workspace → check Docker → check container status → save tmux state → stop container.
 * Preserves the workspace and container (only stops, does not remove).
 * Uses dependency injection for all I/O operations to enable testing.
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createExecutor } from '@zookanalytics/shared';
import { appendFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';

import type { ContainerLifecycle } from './container.js';
import type { StateFsDeps } from './state.js';
import type { FsDeps } from './workspace.js';

import { createContainerLifecycle } from './container.js';
import { readState } from './state.js';
import { saveTmuxState } from './tmux-utils.js';
import { getWorkspacePathByName, resolveInstance } from './workspace.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

export type ShutdownResult =
  | { ok: true; containerName: string; tmuxSaved: boolean }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export interface ShutdownInstanceDeps {
  executor: Execute;
  container: ContainerLifecycle;
  workspaceFsDeps: FsDeps;
  stateFsDeps: StateFsDeps;
  logger?: { warn: (message: string) => void; info: (message: string) => void };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createShutdownDefaultDeps(): ShutdownInstanceDeps {
  const executor = createExecutor();
  return {
    executor,
    container: createContainerLifecycle(executor),
    workspaceFsDeps: { mkdir, readdir, stat, homedir },
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    logger: { warn: (msg) => console.warn(msg), info: (msg) => console.info(msg) },
  };
}

// ─── Shutdown Orchestration ──────────────────────────────────────────────────

/**
 * Shut down an instance by saving tmux state and stopping its container.
 *
 * Orchestration flow:
 *  1. Find workspace by instance name
 *  2. Read state to get container name
 *  3. Check Docker availability
 *  4. Check container status — if not running, return error
 *  5. Save tmux session state (best-effort)
 *  6. Stop container
 */
export async function shutdownInstance(
  instanceName: string,
  deps: ShutdownInstanceDeps,
  repoSlug?: string
): Promise<ShutdownResult> {
  // Step 1: Find workspace
  const lookup = await resolveInstance(instanceName, repoSlug, {
    fsDeps: deps.workspaceFsDeps,
    readFile: deps.stateFsDeps.readFile,
  });

  if (!lookup.found) {
    return { ok: false, error: lookup.error };
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

  if (!statusResult.ok || statusResult.status !== 'running') {
    return {
      ok: false,
      error: {
        code: 'CONTAINER_NOT_RUNNING',
        message: `Container '${containerName}' is not running`,
        suggestion: 'The instance is already stopped.',
      },
    };
  }

  // Step 4: Save tmux session state (best-effort)
  const tmuxSaved = await saveTmuxState(containerName, deps);

  // Step 5: Stop container
  const stopResult = await deps.container.containerStop(containerName);
  if (!stopResult.ok) {
    return { ok: false, error: stopResult.error };
  }

  return { ok: true, containerName, tmuxSaved };
}
