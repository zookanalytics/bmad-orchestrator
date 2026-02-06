/**
 * Workspace folder management for agent-env
 *
 * Handles creation, discovery, and path resolution for workspaces
 * stored at ~/.agent-env/workspaces/<repo>-<instance>/
 */

import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { WorkspacePath } from './types.js';

import { AGENT_ENV_DIR, CONTAINER_PREFIX, STATE_FILE, WORKSPACES_DIR } from './types.js';

// ─── Types for dependency injection ──────────────────────────────────────────

export interface FsDeps {
  mkdir: typeof mkdir;
  readdir: typeof readdir;
  stat: typeof stat;
  homedir: typeof homedir;
}

const defaultFsDeps: FsDeps = { mkdir, readdir, stat, homedir };

// ─── Validation ──────────────────────────────────────────────────────────────

const VALID_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function validateNameSegment(value: string, label: string): void {
  if (!value) {
    throw new Error(`${label} must not be empty`);
  }
  if (!VALID_NAME_PATTERN.test(value)) {
    throw new Error(
      `${label} contains invalid characters: "${value}". Only alphanumeric, dash, dot, and underscore are allowed (must start with alphanumeric).`
    );
  }
}

// ─── Path utilities ──────────────────────────────────────────────────────────

/**
 * Get the base directory for all agent-env workspaces
 * @returns Absolute path to ~/.agent-env/workspaces/
 */
export function getWorkspacesBaseDir(deps: Pick<FsDeps, 'homedir'> = defaultFsDeps): string {
  return join(deps.homedir(), AGENT_ENV_DIR, WORKSPACES_DIR);
}

/**
 * Derive workspace name from repo and instance
 * @param repo - Repository name (e.g., "bmad-orch")
 * @param instance - Instance name (e.g., "auth")
 * @returns Workspace name (e.g., "bmad-orch-auth")
 * @throws If repo or instance contain invalid characters
 */
export function deriveWorkspaceName(repo: string, instance: string): string {
  validateNameSegment(repo, 'repo');
  validateNameSegment(instance, 'instance');
  return `${repo}-${instance}`;
}

/**
 * Derive container name from workspace name
 * @param workspaceName - Workspace name (e.g., "bmad-orch-auth")
 * @returns Container name (e.g., "ae-bmad-orch-auth")
 */
export function deriveContainerName(workspaceName: string): string {
  return `${CONTAINER_PREFIX}${workspaceName}`;
}

/**
 * Resolve all paths for a workspace
 * @param repo - Repository name
 * @param instance - Instance name
 * @returns WorkspacePath with all resolved paths
 */
export function getWorkspacePath(
  repo: string,
  instance: string,
  deps: Pick<FsDeps, 'homedir'> = defaultFsDeps
): WorkspacePath {
  const name = deriveWorkspaceName(repo, instance);
  const root = join(getWorkspacesBaseDir(deps), name);
  const agentEnvDir = join(root, AGENT_ENV_DIR);
  const stateFile = join(agentEnvDir, STATE_FILE);

  return { root, name, agentEnvDir, stateFile };
}

/**
 * Resolve workspace path from an existing workspace name (folder name)
 * @param workspaceName - The workspace folder name
 * @returns WorkspacePath with all resolved paths
 */
export function getWorkspacePathByName(
  workspaceName: string,
  deps: Pick<FsDeps, 'homedir'> = defaultFsDeps
): WorkspacePath {
  const root = join(getWorkspacesBaseDir(deps), workspaceName);
  const agentEnvDir = join(root, AGENT_ENV_DIR);
  const stateFile = join(agentEnvDir, STATE_FILE);

  return { root, name: workspaceName, agentEnvDir, stateFile };
}

// ─── Workspace operations ────────────────────────────────────────────────────

/**
 * Create a new workspace folder with .agent-env directory
 * @param repo - Repository name (e.g., "bmad-orch")
 * @param instance - Instance name (e.g., "auth")
 * @returns WorkspacePath of the created workspace
 * @throws If workspace already exists
 */
export async function createWorkspace(
  repo: string,
  instance: string,
  deps: FsDeps = defaultFsDeps
): Promise<WorkspacePath> {
  const wsPath = getWorkspacePath(repo, instance, deps);
  const baseDir = getWorkspacesBaseDir(deps);

  try {
    // Ensure the base directory exists
    await deps.mkdir(baseDir, { recursive: true });
    // Atomically create the final directory. This will fail if it already exists.
    await deps.mkdir(wsPath.root, { recursive: false });
    // Create the .agent-env directory inside the new workspace
    await deps.mkdir(wsPath.agentEnvDir, { recursive: false });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      const e = new Error(
        `Workspace '${wsPath.name}' already exists at ${wsPath.root}`
      ) as NodeJS.ErrnoException;
      e.code = 'WORKSPACE_ALREADY_EXISTS';
      throw e;
    }
    // Re-throw other errors
    throw err;
  }

  return wsPath;
}

/**
 * Check if a workspace exists
 * @param repo - Repository name
 * @param instance - Instance name
 * @returns true if workspace folder exists
 */
export async function workspaceExists(
  repo: string,
  instance: string,
  deps: Pick<FsDeps, 'stat' | 'homedir'> = defaultFsDeps
): Promise<boolean> {
  const wsPath = getWorkspacePath(repo, instance, deps);
  try {
    const stats = await deps.stat(wsPath.root);
    return stats.isDirectory();
  } catch (err) {
    // Return false for "not found" errors, but re-throw others
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

/**
 * Scan for all workspace folders
 *
 * Returns workspace names only. Use {@link getWorkspacePathByName} to resolve
 * paths and {@link readState} from state.ts to load per-workspace metadata.
 *
 * @returns Array of workspace names found in ~/.agent-env/workspaces/
 */
export async function scanWorkspaces(
  deps: Pick<FsDeps, 'readdir' | 'stat' | 'homedir'> = defaultFsDeps
): Promise<string[]> {
  const baseDir = getWorkspacesBaseDir(deps);

  try {
    const entries = await deps.readdir(baseDir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (err) {
    // If the workspaces directory doesn't exist, return empty list
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

// ─── Workspace deletion ──────────────────────────────────────────────────────

export interface DeleteFsDeps {
  rm: typeof rm;
}

const defaultDeleteFsDeps: DeleteFsDeps = { rm };

/**
 * Delete a workspace folder recursively.
 *
 * Removes the entire workspace directory at the given path.
 * Uses force: true so non-existent paths are treated as success (idempotent).
 *
 * @param wsPath - Workspace path information
 * @param deps - Injectable filesystem dependencies
 * @throws If deletion fails (e.g., permission denied)
 */
export async function deleteWorkspace(
  wsPath: WorkspacePath,
  deps: DeleteFsDeps = defaultDeleteFsDeps
): Promise<void> {
  await deps.rm(wsPath.root, { recursive: true, force: true });
}
