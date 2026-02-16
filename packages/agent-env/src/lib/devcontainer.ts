/**
 * Devcontainer configuration management for agent-env
 *
 * Handles locating, copying, and detecting baseline devcontainer configs
 * that ship with the agent-env package.
 */

import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
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

/**
 * Get the absolute path to the bundled baseline config directory.
 *
 * The baseline configs live at `<package-root>/config/baseline/` relative
 * to the package installation. We resolve from the current module's location.
 *
 * @returns Absolute path to config/baseline/ directory
 */
export function getBaselineConfigPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  // From src/lib/devcontainer.ts -> ../../config/baseline
  const packageRoot = dirname(dirname(dirname(currentFile)));
  return join(packageRoot, 'config', 'baseline');
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
 * Copy baseline devcontainer config to a workspace.
 *
 * Copies baseline config files into `.agent-env/` so they don't conflict
 * with repos that have their own `.devcontainer/`. The `.agent-env/`
 * directory is already git-excluded, so the config won't show as untracked.
 *
 * When using baseline config, callers must pass `--config .agent-env/devcontainer.json`
 * to the devcontainer CLI (via the `configPath` option on `devcontainerUp`).
 *
 * @param workspacePath - Absolute path to the workspace root
 * @throws If baseline config directory is not found
 */
export async function copyBaselineConfig(
  workspacePath: string,
  deps: Pick<DevcontainerFsDeps, 'cp' | 'mkdir' | 'stat'> = defaultFsDeps
): Promise<void> {
  const baselinePath = getBaselineConfigPath();

  // Verify baseline config exists
  try {
    await deps.stat(baselinePath);
  } catch {
    throw new Error(`Baseline config not found at ${baselinePath}. Package may be corrupted.`);
  }

  const targetDir = join(workspacePath, AGENT_ENV_DIR);

  // Create .agent-env/ directory (may already exist for state.json)
  await deps.mkdir(targetDir, { recursive: true });

  // Copy all baseline files (merges into existing .agent-env/, preserving state.json)
  await deps.cp(baselinePath, targetDir, { recursive: true });
}

// ─── Container name patching ─────────────────────────────────────────────────

/**
 * Patch the copied devcontainer.json to set a specific container name.
 *
 * Reads the devcontainer.json, injects `runArgs: ["--name=<containerName>"]`,
 * and writes it back. This ensures Docker uses our `ae-` prefixed name
 * instead of the devcontainer CLI's auto-generated name.
 *
 * @param workspacePath - Absolute path to the workspace root
 * @param containerName - Desired container name (e.g., "ae-bmad-orch-auth")
 */
export async function patchContainerName(
  workspacePath: string,
  containerName: string,
  deps: Pick<DevcontainerFsDeps, 'readFile' | 'writeFile'> = defaultFsDeps,
  configDir: string = DEVCONTAINER_DIR
): Promise<void> {
  const configPath = join(workspacePath, configDir, DEVCONTAINER_JSON);
  const content = await deps.readFile(configPath, 'utf-8');
  const config = JSON.parse(content);

  // Merge with any existing runArgs, replacing any prior --name flag
  const existing: string[] = Array.isArray(config.runArgs) ? config.runArgs : [];
  const filtered = existing.filter((arg: string) => !arg.startsWith('--name='));
  config.runArgs = [...filtered, `--name=${containerName}`];

  await deps.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
}

// ─── Container env patching ──────────────────────────────────────────────────

/**
 * Patch the copied devcontainer.json to set per-instance environment variables.
 *
 * Merges the provided env vars into the existing `containerEnv` object,
 * overwriting any existing keys with the same name.
 *
 * @param workspacePath - Absolute path to the workspace root
 * @param envVars - Environment variables to set (e.g., { AGENT_ENV_INSTANCE: "bmad-orch-auth" })
 * @param deps - Injectable filesystem deps
 * @param configDir - Config directory within workspace (default: .devcontainer)
 */
export async function patchContainerEnv(
  workspacePath: string,
  envVars: Record<string, string>,
  deps: Pick<DevcontainerFsDeps, 'readFile' | 'writeFile'> = defaultFsDeps,
  configDir: string = DEVCONTAINER_DIR
): Promise<void> {
  const configPath = join(workspacePath, configDir, DEVCONTAINER_JSON);
  const content = await deps.readFile(configPath, 'utf-8');
  const config = JSON.parse(content);

  // Merge with any existing containerEnv
  const existing: Record<string, string> =
    typeof config.containerEnv === 'object' && config.containerEnv !== null
      ? config.containerEnv
      : {};
  config.containerEnv = { ...existing, ...envVars };

  await deps.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
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
