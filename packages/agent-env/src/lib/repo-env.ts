/**
 * Repo-level .env file management for agent-env
 *
 * Stores .env and .env.local in ~/.agent-env/repos/<repoSlug>/ and
 * copies them into the workspace root during create/rebuild so that
 * frameworks (Next.js, Vite, etc.) find them automatically.
 */

import { copyFile as fsCopyFile, readFile as fsReadFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { AGENT_ENV_DIR, REPOS_DIR } from './types.js';

// ─── Dependencies ───────────────────────────────────────────────────────────

export interface RepoEnvDeps {
  readFile: (path: string, encoding: BufferEncoding) => Promise<string>;
  copyFile: (src: string, dest: string) => Promise<void>;
  homedir: () => string;
}

const defaultDeps: RepoEnvDeps = {
  readFile: fsReadFile,
  copyFile: fsCopyFile,
  homedir,
};

// ─── Validation ─────────────────────────────────────────────────────────────

/** Same safe pattern used for workspace name segments (see workspace.ts) */
const VALID_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function validateRepoSlug(slug: string): void {
  if (!slug || !VALID_SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Invalid repo slug: "${slug}". Only alphanumeric, dash, dot, and underscore are allowed (must start with alphanumeric).`
    );
  }
}

// ─── Path utilities ─────────────────────────────────────────────────────────

/**
 * Get the directory for a repo's shared env files.
 * @returns Absolute path to ~/.agent-env/repos/<repoSlug>/
 * @throws If repoSlug contains invalid characters (prevents path traversal)
 */
export function getRepoEnvDir(
  repoSlug: string,
  deps: Pick<RepoEnvDeps, 'homedir'> = defaultDeps
): string {
  validateRepoSlug(repoSlug);
  return join(deps.homedir(), AGENT_ENV_DIR, REPOS_DIR, repoSlug);
}

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse .env file content into key-value pairs.
 *
 * Supports:
 * - KEY=VALUE (unquoted, trimmed)
 * - KEY="value with spaces" (double-quoted, preserves inner whitespace)
 * - KEY='literal value' (single-quoted, preserves inner whitespace)
 * - Lines starting with # are comments
 * - Blank lines are skipped
 * - No variable interpolation
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Find the first '=' separator
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    if (!key) continue;

    let value = line.slice(eqIndex + 1).trim();

    // Strip matching quotes
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

// ─── Loader ─────────────────────────────────────────────────────────────────

/**
 * Load and merge .env + .env.local for a repo.
 *
 * Returns merged Record<string, string> (.env.local overrides .env).
 * Missing files are silently skipped — returns empty object if neither exists.
 */
export async function loadRepoEnv(
  repoSlug: string,
  deps: Pick<RepoEnvDeps, 'readFile' | 'homedir'> = defaultDeps
): Promise<Record<string, string>> {
  const dir = getRepoEnvDir(repoSlug, deps);
  const result: Record<string, string> = {};

  for (const filename of ['.env', '.env.local']) {
    const filePath = join(dir, filename);
    try {
      const content = await deps.readFile(filePath, 'utf-8');
      Object.assign(result, parseEnvFile(content));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return result;
}

// ─── File Copy ──────────────────────────────────────────────────────────────

const ENV_FILES = ['.env', '.env.local'] as const;

/**
 * Copy repo-level .env files into the workspace root.
 *
 * Copies .env and .env.local from ~/.agent-env/repos/<repoSlug>/ into destDir.
 * Missing source files are silently skipped.
 *
 * @returns Array of filenames that were copied (e.g., ['.env', '.env.local'])
 */
export async function copyRepoEnvFiles(
  repoSlug: string,
  destDir: string,
  deps: RepoEnvDeps = defaultDeps
): Promise<string[]> {
  const srcDir = getRepoEnvDir(repoSlug, deps);
  const copied: string[] = [];

  for (const filename of ENV_FILES) {
    const src = join(srcDir, filename);
    const dest = join(destDir, filename);
    try {
      await deps.copyFile(src, dest);
      copied.push(filename);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return copied;
}
