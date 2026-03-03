/**
 * Devcontainer configuration management for agent-env
 *
 * Handles locating, copying, and detecting baseline devcontainer configs
 * that ship with the agent-env package.
 */

import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import { accessSync } from 'node:fs';
import { access, cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AGENT_ENV_DIR } from './types.js';

// ─── Types for dependency injection ──────────────────────────────────────────

export interface DevcontainerFsDeps {
  access: typeof access;
  cp: typeof cp;
  mkdir: typeof mkdir;
  readdir: typeof readdir;
  readFile: typeof readFile;
  stat: typeof stat;
  writeFile: typeof writeFile;
}

const defaultFsDeps: DevcontainerFsDeps = { access, cp, mkdir, readdir, readFile, stat, writeFile };

// ─── Constants ───────────────────────────────────────────────────────────────

const DEVCONTAINER_DIR = '.devcontainer';
const DEVCONTAINER_JSON = 'devcontainer.json';
const DOT_DEVCONTAINER_JSON = '.devcontainer.json';

// ─── Path utilities ──────────────────────────────────────────────────────────

/** Resolved package root, cached for the lifetime of the process. */
let cachedPackageRoot: string | undefined;

/**
 * Resets the cached package root. Used for testing path resolution at different depths.
 * @internal
 */
export function resetPackageRoot(): void {
  cachedPackageRoot = undefined;
}

/**
 * Resolves the absolute path to the package root by walking up from the current module.
 *
 * The module's runtime path differs between dev mode (`src/lib/devcontainer.ts`
 * — 3 levels deep) and the tsup bundle (`dist/cli.js` — 2 levels deep).
 * Walking up to find `package.json` works regardless of depth.
 *
 * @param checkAccess - File access function (defaults to node:fs.accessSync)
 * @returns Absolute path to the directory containing package.json
 * @throws Error if package.json cannot be found or accessed
 */
export function getPackageRoot(checkAccess = accessSync): string {
  if (cachedPackageRoot) return cachedPackageRoot;

  let dir = dirname(fileURLToPath(import.meta.url));
  const startDir = dir;

  for (;;) {
    try {
      checkAccess(join(dir, 'package.json'));
      cachedPackageRoot = dir;
      return dir;
    } catch (err: unknown) {
      // If we hit a permission error, we should stop - walking up to a parent
      // we CAN access would yield a false positive (e.g. monorepo root).
      const code = (err as NodeJS.ErrnoException | { code?: unknown })?.code;
      if (code === 'EACCES' || code === 'EPERM') {
        throw new Error(`Permission denied accessing ${join(dir, 'package.json')}`);
      }

      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`Could not find package.json in ${startDir} or any parent directory`);
      }
      dir = parent;
    }
  }
}

/**
 * Get the absolute path to the bundled baseline config directory.
 *
 * The baseline configs live at `<package-root>/config/baseline/` relative
 * to the package installation. We resolve from the current module's location.
 *
 * @returns Absolute path to config/baseline/ directory
 */
export function getBaselineConfigPath(): string {
  return join(getPackageRoot(), 'config', 'baseline');
}

/**
 * Get the absolute path to the bundled templates directory.
 *
 * Templates are used to initialize agent-env-managed workspace files
 * (e.g., `.agent-env/statusBar.template.json`) during instance creation.
 * They are separate from baseline config (which also goes into `.agent-env/`).
 *
 * @returns Absolute path to config/templates/ directory
 */
export function getTemplatesPath(): string {
  return join(getPackageRoot(), 'config', 'templates');
}

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Check if a workspace already has a devcontainer configuration.
 *
 * Checks for both `.devcontainer/` directory and root-level `.devcontainer.json`.
 *
 * @param workspacePath - Absolute path to the workspace root
 * @returns true if any devcontainer config exists
 */
export async function hasDevcontainerConfig(
  workspacePath: string,
  deps: Pick<DevcontainerFsDeps, 'stat'> = defaultFsDeps
): Promise<boolean> {
  // Check for .devcontainer/ directory
  try {
    const dirStats = await deps.stat(join(workspacePath, DEVCONTAINER_DIR));
    if (dirStats.isDirectory()) {
      return true;
    }
  } catch {
    // Not found, continue checking
  }

  // Check for root-level devcontainer.json (without dot prefix)
  try {
    const fileStats = await deps.stat(join(workspacePath, DEVCONTAINER_JSON));
    if (fileStats.isFile()) {
      return true;
    }
  } catch {
    // Not found
  }

  // Check for root-level .devcontainer.json (with dot prefix, per spec)
  try {
    const dotFileStats = await deps.stat(join(workspacePath, DOT_DEVCONTAINER_JSON));
    if (dotFileStats.isFile()) {
      return true;
    }
  } catch {
    // Not found
  }

  return false;
}

// ─── Copy operations ─────────────────────────────────────────────────────────

/**
 * Copy the status bar template to the workspace's `.agent-env/` directory.
 *
 * Copies `statusBar.template.json` from the bundled templates directory
 * to `<workspace>/.agent-env/statusBar.template.json`. This template is used
 * by `regenerateStatusBar()` as the default fallback when no repo-provided
 * template exists at `.vscode/statusBar.template.json`.
 *
 * Called for both baseline and repo-config instances. The `.agent-env/` dir
 * is bind-mounted to `/etc/agent-env` in the container, where `agent-env
 * purpose` needs the template to generate `statusBar.json`. Repos can
 * override by placing a template at `.vscode/statusBar.template.json`.
 *
 * @param workspacePath - Absolute path to the workspace root
 */
export async function copyStatusBarTemplate(
  workspacePath: string,
  deps: Pick<DevcontainerFsDeps, 'cp' | 'mkdir' | 'stat'> = defaultFsDeps
): Promise<void> {
  const templatesPath = getTemplatesPath();
  const srcFile = join(templatesPath, 'statusBar.template.json');

  // Verify template file exists (only skip on ENOENT — surface permission errors)
  try {
    await deps.stat(srcFile);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }

  const targetDir = join(workspacePath, AGENT_ENV_DIR);

  // Create .agent-env/ directory if it doesn't exist
  await deps.mkdir(targetDir, { recursive: true });

  // Copy template file
  await deps.cp(srcFile, join(targetDir, 'statusBar.template.json'));
}

// ─── Managed assets ──────────────────────────────────────────────────────────

/**
 * Copy managed non-JSON assets (init-host.sh, templates) to .agent-env/.
 *
 * Does NOT copy baseline devcontainer.json — the generated config is
 * written separately by writeGeneratedConfig().
 *
 * Assets copied:
 * - init-host.sh from baseline config dir → .agent-env/init-host.sh
 * - statusBar.template.json from templates dir → .agent-env/statusBar.template.json
 *
 * Uses fs.cp with filter to skip devcontainer.json from baseline.
 *
 * @param workspacePath - Absolute path to the workspace root
 */
export async function copyManagedAssets(
  workspacePath: string,
  deps: Pick<DevcontainerFsDeps, 'cp' | 'mkdir' | 'stat'> = defaultFsDeps
): Promise<void> {
  const baselinePath = getBaselineConfigPath();
  const targetDir = join(workspacePath, AGENT_ENV_DIR);

  // Create .agent-env/ directory (may already exist for state.json)
  await deps.mkdir(targetDir, { recursive: true });

  // Copy baseline assets, skipping devcontainer.json (generated config replaces it)
  await deps.cp(baselinePath, targetDir, {
    recursive: true,
    filter: (source: string) => !source.endsWith('devcontainer.json'),
  });

  // Copy status bar template
  await copyStatusBarTemplate(workspacePath, deps);
}

// ─── Listing ─────────────────────────────────────────────────────────────────

/**
 * List files in the baseline config directory.
 *
 * @returns Array of filenames in the baseline config directory
 */
export async function listBaselineFiles(
  deps: Pick<DevcontainerFsDeps, 'readdir'> = defaultFsDeps
): Promise<string[]> {
  const baselinePath = getBaselineConfigPath();
  const entries = await deps.readdir(baselinePath);
  return entries.sort();
}

// ─── Dockerfile resolution ────────────────────────────────────────────────

/**
 * Resolve the path to the Dockerfile used by the devcontainer config.
 *
 * Searches for devcontainer.json in the three standard locations,
 * reads the config (supports JSONC), and resolves the Dockerfile path
 * from `build.dockerfile` or falls back to a default `Dockerfile` in
 * the config directory.
 *
 * @param workspacePath - Absolute path to workspace root
 * @param deps - Injectable filesystem deps
 * @returns Absolute path to the Dockerfile, or null if no Dockerfile exists
 */
export async function resolveDockerfilePath(
  workspacePath: string,
  deps: Pick<DevcontainerFsDeps, 'readFile' | 'stat'>
): Promise<string | null> {
  // Search for devcontainer.json in three locations
  const candidates = [
    join(workspacePath, DEVCONTAINER_DIR, DEVCONTAINER_JSON),
    join(workspacePath, DEVCONTAINER_JSON),
    join(workspacePath, DOT_DEVCONTAINER_JSON),
  ];

  let configPath: string | null = null;
  for (const candidate of candidates) {
    try {
      await deps.stat(candidate);
      configPath = candidate;
      break;
    } catch {
      // Not found, try next
    }
  }

  if (!configPath) {
    return null;
  }

  // Read and parse JSONC config
  const content = await deps.readFile(configPath, 'utf-8');
  const errors: ParseError[] = [];
  const config = parseJsonc(content, errors, { allowTrailingComma: true }) as {
    build?: { dockerfile?: string };
    dockerfile?: string;
  } | null;

  if (errors.length > 0) {
    throw new Error(`Failed to parse devcontainer config at ${configPath}: Invalid JSONC`);
  }

  const configDir = dirname(configPath);

  // Check build.dockerfile field (nested form)
  if (config?.build?.dockerfile) {
    return join(configDir, config.build.dockerfile);
  }

  // Check top-level dockerfile field (shorthand form)
  if (config?.dockerfile) {
    return join(configDir, config.dockerfile);
  }

  // Fall back to Dockerfile in config directory
  try {
    await deps.stat(join(configDir, 'Dockerfile'));
    return join(configDir, 'Dockerfile');
  } catch {
    return null;
  }
}

// ─── Dockerfile parsing ──────────────────────────────────────────────────

/**
 * Parse FROM image references from Dockerfile content.
 *
 * Extracts unique, pullable image references from FROM lines.
 * Skips `scratch` and parameterized `${VAR}` references.
 *
 * @param content - Dockerfile content as string
 * @param logger - Optional logger for warnings about skipped lines
 * @returns Array of unique image references
 */
export function parseDockerfileImages(
  content: string,
  logger?: { warn: (msg: string) => void }
): string[] {
  const fromRegex = /^\s*FROM\s+(?:--\S+\s+)*(\S+)(?:\s+[Aa][Ss]\s+(\S+))?/i;
  const stageNames = new Set<string>();
  const images = new Set<string>();

  // First pass: collect all stage names declared via AS
  for (const line of content.split('\n')) {
    if (line.trim().startsWith('#')) continue;
    const match = fromRegex.exec(line);
    if (match?.[2]) {
      stageNames.add(match[2].toLowerCase());
    }
  }

  // Second pass: collect pullable images, excluding stage references
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;

    const match = fromRegex.exec(line);
    if (!match) continue;

    const image = match[1];

    if (image.includes('$')) {
      logger?.warn(`Skipping parameterized FROM: ${image}`);
      continue;
    }

    if (image.toLowerCase() === 'scratch') {
      continue;
    }

    // Skip references to earlier build stages (e.g., FROM builder)
    if (stageNames.has(image.toLowerCase())) {
      continue;
    }

    images.add(image);
  }

  return [...images];
}
