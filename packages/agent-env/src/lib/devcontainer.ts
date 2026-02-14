/**
 * Devcontainer configuration management for agent-env
 *
 * Handles locating, copying, and detecting baseline devcontainer configs
 * that ship with the agent-env package.
 */

import { access, cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * Creates `.devcontainer/` directory in the workspace and copies all
 * baseline config files into it.
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

  const targetDir = join(workspacePath, DEVCONTAINER_DIR);

  // Create .devcontainer/ directory
  await deps.mkdir(targetDir, { recursive: true });

  // Copy all baseline files
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
