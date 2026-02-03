/**
 * State management for agent-env instances
 *
 * Handles reading and writing .agent-env/state.json with:
 * - Atomic writes (tmp + rename pattern)
 * - Graceful fallback for missing/corrupted files
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { InstanceState, WorkspacePath } from './types.js';

import { CONTAINER_PREFIX, STATE_FILE_TMP, createFallbackState } from './types.js';

// ─── Types for dependency injection ──────────────────────────────────────────

export interface StateFsDeps {
  readFile: typeof readFile;
  writeFile: typeof writeFile;
  rename: typeof rename;
  mkdir: typeof mkdir;
}

const defaultStateFsDeps: StateFsDeps = { readFile, writeFile, rename, mkdir };

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
  const tmpPath = join(dirname(wsPath.stateFile), STATE_FILE_TMP);

  // Ensure .agent-env directory exists
  await deps.mkdir(dirname(wsPath.stateFile), { recursive: true });

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
 * @param containerName - Optional container name (defaults to ae-<name>)
 * @returns New InstanceState with current timestamp
 */
export function createInitialState(
  name: string,
  repo: string,
  containerName?: string
): InstanceState {
  const now = new Date().toISOString();
  return {
    name,
    repo,
    createdAt: now,
    lastAttached: now,
    purpose: null,
    containerName: containerName ?? `${CONTAINER_PREFIX}${name}`,
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
