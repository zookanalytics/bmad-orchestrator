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
      return migrateOldState(parsed, wsPath.name) ?? createFallbackState(wsPath.name);
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
 * @param instance - User-chosen instance name (e.g., "auth")
 * @param repoSlug - Repo slug derived from URL (e.g., "bmad-orchestrator")
 * @param repoUrl - Full git remote URL
 * @param options - Optional container name and config source
 * @returns New InstanceState with current timestamp
 */
export function createInitialState(
  instance: string,
  repoSlug: string,
  repoUrl: string,
  options?: { containerName?: string; configSource?: 'baseline' | 'repo'; purpose?: string | null }
): InstanceState {
  const { containerName, configSource, purpose } = options ?? {};
  const now = new Date().toISOString();
  const workspaceName = `${repoSlug}-${instance}`;
  return {
    instance,
    repoSlug,
    repoUrl,
    createdAt: now,
    lastAttached: now,
    purpose: purpose ?? null,
    containerName: containerName ?? `${CONTAINER_PREFIX}${workspaceName}`,
    configSource: configSource ?? 'baseline',
  };
}

// ─── Old-format migration ────────────────────────────────────────────────────

/**
 * Extract the repo name (last path segment) from a git URL.
 *
 * Minimal extraction for migration purposes — no compression, no throw.
 * Handles HTTPS and SSH URLs, strips .git suffix and trailing slashes.
 *
 * @returns Lowercased repo name, or 'unknown' if URL is empty/unparseable
 */
function extractRepoName(url: string): string {
  const cleaned = url.replace(/\/+$/, '').replace(/\.git$/, '');
  const lastSep = Math.max(cleaned.lastIndexOf('/'), cleaned.lastIndexOf(':'));
  const name = lastSep >= 0 ? cleaned.slice(lastSep + 1) : cleaned;
  return name.toLowerCase() || 'unknown';
}

/**
 * Attempt to migrate a pre-Epic 7 state object to the current schema.
 *
 * Pre-Epic 7 state files used `name` (workspace name, e.g. "bmad-orch-auth")
 * and `repo` (full URL) instead of `instance`, `repoSlug`, and `repoUrl`.
 * This function maps those old fields to the new schema, extracting the
 * instance portion from the workspace name and preserving `containerName`,
 * `configSource`, and other unchanged fields.
 *
 * Background: Epic 7 (commit a86a099) intentionally rejected old-format
 * state files via isValidState. This migration was added to restore
 * visibility of pre-Epic 7 workspaces that were showing as orphaned/unknown.
 * The migrated state is persisted on the next write operation (attach,
 * rebuild, purpose set) via the normal read→spread→write flow.
 *
 * @returns A valid InstanceState if migration succeeds, or null if the
 *          parsed object doesn't look like an old-format state.
 */
function migrateOldState(parsed: unknown, workspaceName: string): InstanceState | null {
  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  // Must have old-format fields
  if (typeof obj.name !== 'string' || typeof obj.repo !== 'string') return null;

  const repoSlug = extractRepoName(obj.repo);

  // Old `name` was the workspace name (<repoName>-<instance>).
  // Strip the repo prefix to recover just the instance portion.
  // Case-insensitive match: the local extractRepoName() lowercases the slug,
  // but old workspace names were built with the original extractRepoName()
  // (create-instance.ts, removed in Epic 7) which preserved case.
  const lowerName = obj.name.toLowerCase();
  const prefix = `${repoSlug}-`;
  const instance =
    lowerName.startsWith(prefix) && obj.name.length > prefix.length
      ? obj.name.slice(prefix.length)
      : obj.name;

  const configSource =
    obj.configSource === 'baseline' || obj.configSource === 'repo' ? obj.configSource : undefined;

  const state: InstanceState = {
    instance,
    repoSlug,
    repoUrl: obj.repo,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : 'unknown',
    lastAttached: typeof obj.lastAttached === 'string' ? obj.lastAttached : 'unknown',
    purpose: typeof obj.purpose === 'string' ? obj.purpose : null,
    containerName:
      typeof obj.containerName === 'string'
        ? obj.containerName
        : `${CONTAINER_PREFIX}${workspaceName}`,
  };

  if (configSource) {
    state.configSource = configSource;
  }

  return state;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Type guard to validate parsed JSON is a valid InstanceState.
 *
 * Requires the Epic 7+ schema fields: instance, repoSlug, repoUrl.
 * Old-format state files (with `name`/`repo` instead) fail this check
 * and are migrated by migrateOldState() in readState().
 */
export function isValidState(value: unknown): value is InstanceState {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.instance === 'string' &&
    typeof obj.repoSlug === 'string' &&
    typeof obj.repoUrl === 'string' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.lastAttached === 'string' &&
    (obj.purpose === undefined || obj.purpose === null || typeof obj.purpose === 'string') &&
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
