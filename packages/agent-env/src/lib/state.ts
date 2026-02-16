/**
 * State management for agent-env instances
 *
 * Handles reading and writing .agent-env/state.json with:
 * - Atomic writes (tmp + rename pattern)
 * - Graceful fallback for missing/corrupted files
 */

import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { InstanceState, WorkspacePath } from './types.js';

import { AGENT_ENV_DIR, CONTAINER_PREFIX, STATE_FILE_TMP, createFallbackState } from './types.js';

// ─── Types for dependency injection ──────────────────────────────────────────

/**
 * Filesystem dependencies for state operations.
 *
 * - readFile: Read state.json content
 * - writeFile: Write to temp file during atomic writes
 * - rename: Atomic rename from temp to final file
 * - mkdir: Create .agent-env directory if missing
 * - appendFile: Append to .git/info/exclude (ensureGitExclude)
 */
export interface StateFsDeps {
  readFile: typeof readFile;
  writeFile: typeof writeFile;
  rename: typeof rename;
  mkdir: typeof mkdir;
  appendFile: typeof appendFile;
}

const defaultStateFsDeps: StateFsDeps = { readFile, writeFile, rename, mkdir, appendFile };

// ─── State operations ────────────────────────────────────────────────────────

/**
 * Read instance state from .agent-env/state.json
 *
 * Returns a graceful fallback with "unknown" values if the file
 * is missing, corrupted, or unreadable.
 *
 * @param wsPath - Workspace path information
 * @returns InstanceState (real or fallback)
 */
export async function readState(
  wsPath: WorkspacePath,
  deps: Pick<StateFsDeps, 'readFile'> = defaultStateFsDeps
): Promise<InstanceState> {
  try {
    const content = await deps.readFile(wsPath.stateFile, 'utf-8');
    const parsed: unknown = JSON.parse(content);

    if (!isValidState(parsed)) {
      return createFallbackState(wsPath.name);
    }

    return parsed;
  } catch (err) {
    // Return fallback for missing file or bad JSON. Re-throw other errors.
    if (err instanceof SyntaxError || (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return createFallbackState(wsPath.name);
    }
    throw err;
  }
}

/**
 * Write instance state atomically to .agent-env/state.json
 *
 * Uses the tmp+rename pattern to prevent corruption:
 * 1. Write to state.json.tmp
 * 2. Rename to state.json (atomic on POSIX)
 *
 * @param wsPath - Workspace path information
 * @param state - Instance state to write
 */
export async function writeStateAtomic(
  wsPath: WorkspacePath,
  state: InstanceState,
  deps: StateFsDeps = defaultStateFsDeps
): Promise<void> {
  const tmpPath = join(wsPath.agentEnvDir, STATE_FILE_TMP);

  // Ensure .agent-env directory exists
  await deps.mkdir(wsPath.agentEnvDir, { recursive: true });

  // Write to temp file, then atomic rename
  const content = JSON.stringify(state, null, 2) + '\n';
  await deps.writeFile(tmpPath, content, 'utf-8');
  await deps.rename(tmpPath, wsPath.stateFile);
}

/**
 * Create initial state for a new workspace
 *
 * @param name - Workspace name (e.g., "bmad-orch-auth")
 * @param repo - Git remote URL
 * @param options - Optional container name and config source
 * @returns New InstanceState with current timestamp
 */
export function createInitialState(
  name: string,
  repo: string,
  options?: { containerName?: string; configSource?: 'baseline' | 'repo'; purpose?: string | null }
): InstanceState {
  const { containerName, configSource, purpose } = options ?? {};
  const now = new Date().toISOString();
  return {
    name,
    repo,
    createdAt: now,
    lastAttached: now,
    purpose: purpose ?? null,
    containerName: containerName ?? `${CONTAINER_PREFIX}${name}`,
    configSource: configSource ?? 'baseline',
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Type guard to validate parsed JSON is a valid InstanceState
 */
function isValidState(value: unknown): value is InstanceState {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.name === 'string' &&
    typeof obj.repo === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.lastAttached === 'string' &&
    (obj.purpose === null || typeof obj.purpose === 'string') &&
    typeof obj.containerName === 'string'
  );
}

// ─── Git Exclude ─────────────────────────────────────────────────────────────

/** Pattern to add to .git/info/exclude */
const GIT_EXCLUDE_PATTERN = `${AGENT_ENV_DIR}/`;

/**
 * Ensure .agent-env/ is in .git/info/exclude so state files don't show as untracked.
 *
 * This uses the local git exclude mechanism rather than .gitignore, so:
 * - The exclusion is local to each clone (not committed to repo)
 * - Cloned repos won't show .agent-env/state.json as dirty
 *
 * Idempotent: does nothing if the pattern is already present.
 *
 * Note: Uses read-then-append which has a theoretical race condition if called
 * concurrently. In practice this is fine because: (1) createInstance is called
 * once per workspace, and (2) duplicate entries in git exclude are harmless.
 *
 * Silently skips if .git/info/exclude doesn't exist (e.g., not a git repo,
 * shallow clone, or worktree). This is intentional best-effort behavior.
 *
 * @param workspaceRoot - Root directory of the workspace (contains .git)
 * @param deps - Injectable dependencies for testing
 */
export async function ensureGitExclude(
  workspaceRoot: string,
  deps: Pick<StateFsDeps, 'readFile' | 'appendFile'> = defaultStateFsDeps
): Promise<void> {
  const excludePath = join(workspaceRoot, '.git', 'info', 'exclude');

  try {
    const content = await deps.readFile(excludePath, 'utf-8');

    // Check if pattern already exists (exact line match)
    const lines = content.split('\n');
    if (lines.some((line) => line.trim() === GIT_EXCLUDE_PATTERN)) {
      return; // Already excluded
    }

    // Append pattern with newline prefix if file doesn't end with newline
    const prefix = content.endsWith('\n') ? '' : '\n';
    await deps.appendFile(excludePath, `${prefix}${GIT_EXCLUDE_PATTERN}\n`, 'utf-8');
  } catch (err) {
    // If .git/info/exclude doesn't exist, this isn't a git repo - silently skip
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    throw err;
  }
}
