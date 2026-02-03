/**
 * Workspace and instance state types for agent-env
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Base directory for all agent-env data */
export const AGENT_ENV_DIR = '.agent-env';

/** Directory name for workspaces within AGENT_ENV_DIR */
export const WORKSPACES_DIR = 'workspaces';

/** State file name within each workspace's .agent-env directory */
export const STATE_FILE = 'state.json';

/** Temporary state file name for atomic writes */
export const STATE_FILE_TMP = 'state.json.tmp';

/** Container name prefix */
export const CONTAINER_PREFIX = 'ae-';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Resolved workspace path information */
export interface WorkspacePath {
  /** Full absolute path to workspace folder (e.g., ~/.agent-env/workspaces/bmad-orch-auth) */
  root: string;
  /** Workspace name derived from repo+instance (e.g., bmad-orch-auth) */
  name: string;
  /** Path to .agent-env directory within workspace */
  agentEnvDir: string;
  /** Path to state.json within workspace */
  stateFile: string;
}

/** Persisted instance state in .agent-env/state.json */
export interface InstanceState {
  /** Workspace name (e.g., "bmad-orch-auth") */
  name: string;
  /** Git remote URL */
  repo: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last-attached timestamp */
  lastAttached: string;
  /** User-provided description, null if not set */
  purpose: string | null;
  /** Container name (e.g., "ae-bmad-orch-auth") */
  containerName: string;
}

// ─── Container Types ────────────────────────────────────────────────────────

/** Possible states of a container */
export type ContainerStatus = 'running' | 'stopped' | 'not-found';

export type ContainerSuccess = {
  ok: true;
  status: ContainerStatus;
  containerId: string | null;
};

export type ContainerError = {
  ok: false;
  status: 'not-found';
  containerId: null;
  error: { code: string; message: string; suggestion?: string };
};

/** Result from a container lifecycle operation */
export type ContainerResult = ContainerSuccess | ContainerError;

// ─── Fallback ────────────────────────────────────────────────────────────────

/** Fallback state returned when state.json is missing or corrupted */
export function createFallbackState(workspaceName: string): InstanceState {
  return {
    name: workspaceName,
    repo: 'unknown',
    createdAt: 'unknown',
    lastAttached: 'unknown',
    purpose: null,
    containerName: `${CONTAINER_PREFIX}${workspaceName}`,
  };
}
