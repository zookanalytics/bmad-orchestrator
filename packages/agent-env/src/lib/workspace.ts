/**
 * Workspace folder management for agent-env
 *
 * Handles creation, discovery, and path resolution for workspaces
 * stored at ~/.agent-env/workspaces/<repo>-<instance>/
 */

import type { ExecuteResult } from '@zookanalytics/shared';

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { WorkspacePath } from './types.js';

import {
  AGENT_ENV_DIR,
  CONTAINER_PREFIX,
  MAX_REPO_SLUG_LENGTH,
  STATE_FILE,
  WORKSPACES_DIR,
} from './types.js';

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

// ─── Repo slug derivation ───────────────────────────────────────────────────

/**
 * Derive a repo slug from a git URL.
 *
 * Extracts the last path segment, strips `.git` suffix, and lowercases.
 * If the result exceeds MAX_REPO_SLUG_LENGTH (39 chars), compresses it
 * using {@link compressSlug}.
 *
 * Supports:
 * - HTTPS: https://github.com/user/repo-name.git → "repo-name"
 * - HTTPS without .git: https://github.com/user/repo-name → "repo-name"
 * - SSH: git@github.com:user/repo-name.git → "repo-name"
 * - SSH without .git: git@github.com:user/repo-name → "repo-name"
 * - Trailing slashes are stripped
 *
 * @param url - Git repository URL (HTTPS or SSH)
 * @returns Repo slug (max 39 chars, lowercase)
 * @throws If URL cannot be parsed to extract a repo name
 */
export function deriveRepoSlug(url: string): string {
  // Remove trailing slashes and the .git suffix to normalize the URL
  const cleaned = url.replace(/\/+$/, '').replace(/\.git$/, '');

  // The repository name is the last segment after the final '/' or ':'
  const lastSlash = cleaned.lastIndexOf('/');
  const lastColon = cleaned.lastIndexOf(':');
  const lastSeparator = Math.max(lastSlash, lastColon);

  if (lastSeparator === -1) {
    if (!cleaned) {
      throw new Error(`Cannot derive repo slug from URL: ${url}`);
    }
    return compressSlug(cleaned.toLowerCase());
  }

  const repoName = cleaned.slice(lastSeparator + 1);

  if (!repoName) {
    throw new Error(`Cannot derive repo slug from URL: ${url}`);
  }

  return compressSlug(repoName.toLowerCase());
}

/**
 * Compress a slug to fit within maxLength using deterministic SHA-256 hashing.
 *
 * If the slug is already within maxLength, returns it unchanged.
 * Otherwise, produces: `<prefix>_<6-char SHA-256 hex>_<suffix>`
 * where prefix and suffix are chosen to fill the remaining space evenly.
 *
 * @param slug - The slug to compress
 * @param maxLength - Maximum allowed length (default: MAX_REPO_SLUG_LENGTH = 39)
 * @returns Compressed slug (deterministic: same input → same output)
 */
export function compressSlug(slug: string, maxLength: number = MAX_REPO_SLUG_LENGTH): string {
  if (slug.length <= maxLength) {
    return slug;
  }

  const hash = createHash('sha256').update(slug).digest('hex').slice(0, 6);
  // Format: <prefix>_<hash>_<suffix>
  // Overhead: 1 (underscore) + 6 (hash) + 1 (underscore) = 8 chars
  const overhead = 8;
  const available = Math.max(0, maxLength - overhead);
  // Split remaining space roughly evenly between prefix and suffix
  const prefixLen = Math.ceil(available / 2);
  const suffixLen = available - prefixLen;

  const prefix = slug.slice(0, prefixLen);
  const suffix = slug.slice(slug.length - suffixLen);

  return `${prefix}_${hash}_${suffix}`;
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

// ─── Two-phase instance resolution ──────────────────────────────────────────

type Execute = (
  command: string,
  args?: string[],
  options?: Record<string, unknown>
) => Promise<ExecuteResult>;

// ── Phase 1: Repo context resolution ──

export interface ResolveRepoOpts {
  /** Explicit repo slug or URL from --repo flag */
  repo?: string;
  /** Current working directory for git remote inference */
  cwd?: string;
}

export type ResolveRepoResult =
  | { resolved: true; repoSlug: string }
  | { resolved: false }
  | { resolved: false; error: { code: string; message: string; suggestion?: string } };

/**
 * Detect whether a string looks like a git URL (contains / or : separators)
 * vs a plain repo slug.
 */
function looksLikeUrl(value: string): boolean {
  return value.includes('/') || value.includes(':');
}

/**
 * Phase 1: Resolve repo context from explicit flag or cwd git remote.
 *
 * Resolution priority:
 * 1. Explicit `--repo` flag (URL → derive slug; plain string → use as slug)
 * 2. Current working directory's git `origin` remote
 * 3. No repo context (returns { resolved: false })
 *
 * @param opts - Resolution options (repo flag, cwd)
 * @param executor - Subprocess executor for git commands
 * @returns Resolved repo slug, or { resolved: false } if no context available
 */
export async function resolveRepo(
  opts: ResolveRepoOpts,
  executor: Execute
): Promise<ResolveRepoResult> {
  // Priority 1: Explicit --repo flag
  const repoFlag = opts.repo?.trim();
  if (repoFlag !== undefined && repoFlag !== '') {
    if (looksLikeUrl(repoFlag)) {
      try {
        const slug = deriveRepoSlug(repoFlag);
        return { resolved: true, repoSlug: slug };
      } catch {
        return {
          resolved: false,
          error: {
            code: 'INVALID_REPO',
            message: `Cannot derive repo slug from: ${repoFlag}`,
            suggestion: 'Provide a valid git URL or repo slug.',
          },
        };
      }
    }
    // Plain slug — use as-is (lowercased)
    return { resolved: true, repoSlug: repoFlag.toLowerCase() };
  }

  // Priority 2: Infer from cwd git remote
  if (opts.cwd) {
    const result = await executor('git', ['remote', 'get-url', 'origin'], {
      cwd: opts.cwd,
    });

    if (result.ok && result.stdout.trim()) {
      try {
        const slug = deriveRepoSlug(result.stdout.trim());
        return { resolved: true, repoSlug: slug };
      } catch {
        // URL exists but can't be parsed — fall through to no context
      }
    }
    // No origin remote or not a git directory — not an error, just no context
  }

  // Priority 3: No repo context
  return { resolved: false };
}

// ── Phase 2: Instance resolution ──

export interface ResolveInstanceDeps {
  fsDeps: Pick<FsDeps, 'readdir' | 'stat' | 'homedir'>;
  readFile: typeof readFile;
}

const defaultResolveInstanceDeps: ResolveInstanceDeps = {
  fsDeps: defaultFsDeps,
  readFile,
};

export type ResolveInstanceResult =
  | { found: true; workspaceName: string }
  | { found: false; error: { code: string; message: string; suggestion?: string } };

/**
 * Phase 2: Resolve an instance name to a workspace, optionally scoped by repo.
 *
 * Resolution strategy:
 * 1. If repoSlug provided: look for exact workspace `<repoSlug>-<instanceName>`
 * 2. If no repoSlug or scoped lookup fails: scan all workspaces, read state.json,
 *    match by `instance` field
 * 3. If exactly one global match: return it (unambiguous)
 * 4. If multiple global matches: return AMBIGUOUS_INSTANCE error
 * 5. If no match: return WORKSPACE_NOT_FOUND error
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param repoSlug - Optional repo slug from Phase 1 (e.g., "bmad-orchestrator")
 * @param deps - Injectable dependencies
 * @returns Resolved workspace name, or error
 */
export async function resolveInstance(
  instanceName: string,
  repoSlug: string | undefined,
  deps: ResolveInstanceDeps = defaultResolveInstanceDeps
): Promise<ResolveInstanceResult> {
  const workspaces = await scanWorkspaces(deps.fsDeps);

  // Strategy 0: Exact workspace name match (user typed full name like "bmad-orch-auth")
  if (workspaces.includes(instanceName)) {
    return { found: true, workspaceName: instanceName };
  }

  // Strategy 1: Scoped lookup by repo slug
  if (repoSlug) {
    const expectedName = `${repoSlug}-${instanceName}`;
    if (workspaces.includes(expectedName)) {
      return { found: true, workspaceName: expectedName };
    }
    // Scoped lookup failed — fall through to global search
  }

  // Strategy 2: Global search by reading state.json and matching instance field
  const matches: string[] = [];

  for (const wsName of workspaces) {
    const wsPath = getWorkspacePathByName(wsName, deps.fsDeps);
    try {
      const content = await deps.readFile(wsPath.stateFile, 'utf-8');
      const state: unknown = JSON.parse(content);
      if (
        typeof state === 'object' &&
        state !== null &&
        (state as Record<string, unknown>).instance === instanceName
      ) {
        matches.push(wsName);
      }
    } catch {
      // Skip workspaces with missing/invalid state
    }
  }

  if (matches.length === 1) {
    return { found: true, workspaceName: matches[0] };
  }

  if (matches.length > 1) {
    // Extract repo slugs from workspace names for the error message
    const repoSlugs = matches.map((ws) => {
      const idx = ws.lastIndexOf(`-${instanceName}`);
      return idx > 0 ? ws.slice(0, idx) : ws;
    });
    return {
      found: false,
      error: {
        code: 'AMBIGUOUS_INSTANCE',
        message: `Multiple instances named '${instanceName}' exist across repos: ${repoSlugs.join(', ')}`,
        suggestion: 'Use --repo <slug> to specify which repo.',
      },
    };
  }

  return {
    found: false,
    error: {
      code: 'WORKSPACE_NOT_FOUND',
      message: `Instance '${instanceName}' not found`,
      suggestion: 'Use `agent-env list` to see available instances.',
    },
  };
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
