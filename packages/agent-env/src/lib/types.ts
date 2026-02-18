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

/** Maximum length for user-chosen instance names */
export const MAX_INSTANCE_NAME_LENGTH = 20;

/** Maximum length for derived repo slugs (compressed if longer) */
export const MAX_REPO_SLUG_LENGTH = 39;

/** Maximum length for Docker container names */
export const MAX_CONTAINER_NAME_LENGTH = 63;

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
  /** User-chosen instance name (e.g., "auth") — max 20 chars */
  instance: string;
  /** Repo slug derived from git remote URL (e.g., "bmad-orchestrator") — max 39 chars */
  repoSlug: string;
  /** Full git remote URL */
  repoUrl: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last-attached timestamp */
  lastAttached: string;
  /** ISO 8601 last-rebuilt timestamp */
  lastRebuilt?: string;
  /** User-provided description, null if not set */
  purpose: string | null;
  /** Container name (e.g., "ae-bmad-orchestrator-auth") */
  containerName: string;
  /** How the devcontainer config was provisioned. Absent = 'baseline' for backwards compat. */
  configSource?: 'baseline' | 'repo';
}

// ─── Container Types ────────────────────────────────────────────────────────

/** Possible states of a container */
export type ContainerStatus = 'running' | 'stopped' | 'not-found';

export type ContainerSuccess = {
  ok: true;
  status: ContainerStatus;
  containerId: string | null;
  ports: Record<string, string>; // e.g. { "22/tcp": "12345" } — empty string means exposed but not published
  labels: Record<string, string>; // e.g. { "dev.orbstack.domains": "myapp.local" }
};

export type ContainerError = {
  ok: false;
  status: 'not-found';
  containerId: null;
  error: { code: string; message: string; suggestion?: string };
};

/** Result from a container lifecycle operation */
export type ContainerResult = ContainerSuccess | ContainerError;

// ─── Git State Types ────────────────────────────────────────────────────────

/** Comprehensive git state for a workspace */
export interface GitState {
  /** Working tree has staged changes (git add'd but not committed) */
  hasStaged: boolean;
  /** Number of staged files */
  stagedCount: number;
  /** Working tree has unstaged modifications */
  hasUnstaged: boolean;
  /** Number of unstaged files */
  unstagedCount: number;
  /** Working tree has untracked files */
  hasUntracked: boolean;
  /** Number of untracked files */
  untrackedCount: number;
  /** Number of stash entries */
  stashCount: number;
  /** First stash entry annotation, e.g. "WIP on main: abc1234 message" (empty string if no stashes) */
  firstStashMessage: string;
  /** Branch names with unpushed commits (ahead of upstream) */
  unpushedBranches: string[];
  /** Map of branch name to number of unpushed commits */
  unpushedCommitCounts: Record<string, number>;
  /** Branch names that have never been pushed to any remote */
  neverPushedBranches: string[];
  /** HEAD is detached (not on any branch) */
  isDetachedHead: boolean;
  /** Repository is completely clean: no local changes and all branches pushed */
  isClean: boolean;
}

export type GitStateSuccess = {
  ok: true;
  state: GitState;
};

export type GitStateError = {
  ok: false;
  state: null;
  error: { code: string; message: string };
};

/** Result from git state detection */
export type GitStateResult = GitStateSuccess | GitStateError;

// ─── Fallback ────────────────────────────────────────────────────────────────

/**
 * Fallback state returned when state.json is missing, corrupted, or
 * cannot be migrated from an old format.
 *
 * Pre-Epic 7 state files are handled by migrateOldState() in state.ts.
 * This fallback covers truly unreadable or incomplete state files.
 */
export function createFallbackState(workspaceName: string): InstanceState {
  return {
    instance: workspaceName,
    repoSlug: 'unknown',
    repoUrl: 'unknown',
    createdAt: 'unknown',
    lastAttached: 'unknown',
    purpose: null,
    containerName: `${CONTAINER_PREFIX}${workspaceName}`,
  };
}
