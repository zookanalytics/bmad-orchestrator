/**
 * Version drift detection for long-lived agent-env processes.
 *
 * The `on` command launches a persistent Ink menu that may run for hours.
 * If the user upgrades their global agent-env install (e.g., `pnpm add -g`)
 * while the menu is open, pnpm typically removes the old store directory —
 * making the running process's cached `getPackageRoot()` path point at a
 * directory that no longer exists.
 *
 * The first visible symptom is an opaque "CONFIG_REFRESH_FAILED" error
 * when rebuild reads `config/baseline/devcontainer.json`. This module
 * detects that condition proactively so the menu can prompt a restart.
 */

import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import packageJson from '../../package.json' with { type: 'json' };
import { getBaselineConfigPath } from './devcontainer.js';
import { checkForUpdate } from './update-check.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VersionDriftState {
  /**
   * The baseline config file referenced by this process no longer exists
   * on disk. Rebuild will fail until the menu is restarted.
   */
  packageMoved: boolean;
  /**
   * Formatted "update available" message from npm registry check, or null
   * if the installed version is current (or the check failed silently).
   */
  updateMessage: string | null;
  /**
   * The version that the PATH-resolved `agent-env` binary reports, or null
   * if detection failed (e.g. `agent-env` not on PATH). When this differs
   * from `currentVersion`, the user has already upgraded but this process
   * is still running the old code — a restart picks up the new version
   * without needing `pnpm add -g`.
   */
  installedVersion: string | null;
  /** Version string baked into this running process. */
  currentVersion: string;
}

export interface DetectDriftDeps {
  /** Override for testing the baseline-path probe. */
  isPackagePathStale?: () => Promise<boolean>;
  /**
   * Override for testing the registry-based update check. Receives the
   * force flag so tests can verify cache bypass behavior.
   */
  fetchUpdateMessage?: (force: boolean) => Promise<string | null>;
  /** Override for testing the installed-version probe. */
  getInstalledVersion?: () => string | null;
}

/** DI surface for {@link isPackagePathStale}. */
export interface IsPackagePathStaleDeps {
  access?: typeof access;
  getBaselinePath?: () => string;
}

// ─── Version helpers ────────────────────────────────────────────────────────

/**
 * Strip build metadata (`+local`, `+dev`) and pre-release tags (`-beta.1`)
 * so we can compare core semver triplets.
 */
function normaliseVersion(version: string): string {
  return version.split('+')[0].split('-')[0];
}

/**
 * Returns true when `installed` is strictly greater than `running`.
 */
export function isNewerVersion(running: string, installed: string): boolean {
  const r = normaliseVersion(running).split('.').map(Number);
  const i = normaliseVersion(installed).split('.').map(Number);
  const len = Math.max(r.length, i.length);
  for (let j = 0; j < len; j++) {
    const rv = r[j] ?? 0;
    const iv = i[j] ?? 0;
    if (iv > rv) return true;
    if (iv < rv) return false;
  }
  return false;
}

// ─── Installed-version probe ────────────────────────────────────────────────

export interface GetInstalledVersionDeps {
  spawn?: typeof spawnSync;
}

/**
 * Resolve the version of the `agent-env` binary that PATH currently points
 * at by spawning `agent-env --version`. Returns null on any failure.
 *
 * This is a synchronous, local operation (no network), typically completing
 * in under 200 ms.
 */
export function getInstalledVersion(deps: GetInstalledVersionDeps = {}): string | null {
  const spawn = deps.spawn ?? spawnSync;
  try {
    const result = spawn('agent-env', ['--version'], {
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result.status !== 0 || typeof result.stdout !== 'string') {
      return null;
    }
    const version = result.stdout.trim();
    // Sanity-check: must look like a semver string (digits.digits.digits…)
    return /^\d+\.\d+\.\d+/.test(version) ? version : null;
  } catch {
    return null;
  }
}

// ─── Primary signal: is our install still on disk? ──────────────────────────

/**
 * Returns true if the baseline config file that this process depends on is
 * missing. When true, the currently running agent-env has effectively been
 * uninstalled underneath it — rebuild (and anything else reading the baseline)
 * will fail until a fresh process is started.
 *
 * Any error reaching the file (ENOENT, EACCES, etc.) is treated as drift —
 * we prefer a false positive (prompt the user to restart) over a false
 * negative (let rebuild crash with the opaque CONFIG_REFRESH_FAILED error).
 */
export async function isPackagePathStale(deps: IsPackagePathStaleDeps = {}): Promise<boolean> {
  const { access: accessFn = access, getBaselinePath = getBaselineConfigPath } = deps;
  try {
    await accessFn(join(getBaselinePath(), 'devcontainer.json'), constants.F_OK);
    return false;
  } catch {
    return true;
  }
}

// ─── Secondary signal: registry check ───────────────────────────────────────

const UPDATE_CHECK_CACHE_PATH = join(homedir(), '.agent-env', 'update-check.json');
const UPDATE_CHECK_CACHE_TTL_MS = 3_600_000; // 1 hour

/**
 * Thin wrapper over `checkForUpdate` using the same cache path + TTL as
 * the CLI entry point. Hitting this from the menu reuses the 1-hour cache
 * written by `agent-env` CLI startup, so in most sessions it's a file read.
 *
 * When `force` is true, the cache TTL is set to zero so the next check
 * always talks to the registry — used by the manual "Check for updates"
 * action.
 */
async function fetchUpdateMessageFromRegistry(force = false): Promise<string | null> {
  try {
    return await checkForUpdate({
      currentVersion: packageJson.version,
      packageName: packageJson.name,
      cachePath: UPDATE_CHECK_CACHE_PATH,
      cacheTtlMs: force ? 0 : UPDATE_CHECK_CACHE_TTL_MS,
    });
  } catch {
    return null;
  }
}

// ─── Composite detector ─────────────────────────────────────────────────────

export interface DetectDriftOptions {
  /** When true, bypass the 1-hour update-check cache and refetch from npm. */
  forceRefresh?: boolean;
}

/**
 * Build a full drift state by combining three signals:
 *
 * 1. **packageMoved** — the baseline config file this process cached is
 *    gone (pnpm removed the old store dir). Rebuild would crash.
 * 2. **installedVersion** — the version the PATH-resolved `agent-env`
 *    binary reports. When > currentVersion, a restart alone picks up
 *    the new version (no `pnpm add -g` needed).
 * 3. **updateMessage** — a newer version exists on npm. Only actionable
 *    when the user hasn't installed it yet (installedVersion == currentVersion).
 *
 * The second argument accepts `{ forceRefresh }` to request a fresh
 * registry hit; without it, the normal cache applies.
 */
export async function detectDriftState(
  deps: DetectDriftDeps = {},
  options: DetectDriftOptions = {}
): Promise<VersionDriftState> {
  const {
    isPackagePathStale: probe = isPackagePathStale,
    fetchUpdateMessage = (force: boolean) => fetchUpdateMessageFromRegistry(force),
    getInstalledVersion: resolveInstalled = getInstalledVersion,
  } = deps;

  // installedVersion is synchronous (spawnSync), run it alongside the async probes.
  const installedVersion = resolveInstalled();

  const [packageMoved, updateMessage] = await Promise.all([
    probe(),
    fetchUpdateMessage(options.forceRefresh ?? false),
  ]);

  return {
    packageMoved,
    updateMessage,
    installedVersion,
    currentVersion: packageJson.version,
  };
}

/** Returns the version string this process was loaded with. */
export function getCurrentVersion(): string {
  return packageJson.version;
}

// ─── Restart ────────────────────────────────────────────────────────────────

export interface RestartMenuOptions {
  workspaceName: string;
  repoSlug?: string;
}

export interface RestartMenuDeps {
  /** Synchronous spawn used to exec the replacement process. */
  spawn?: (
    command: string,
    args: readonly string[],
    options?: SpawnSyncOptions
  ) => { status: number | null };
  /** Process exit, injectable for tests. */
  exit?: (code: number) => never;
}

/**
 * Replace the current menu session with a fresh `agent-env on <name>` process.
 *
 * Resolves `agent-env` via PATH (picking up whatever version the user's
 * package manager currently points at), inherits stdio so the new menu
 * takes over the terminal, and exits with the child's status code.
 *
 * Node has no cross-platform `execvp` equivalent, so this is a wait-then-exit
 * pattern rather than a true process replacement — the user sees no visible
 * difference because stdio is inherited.
 */
export function restartMenu(
  { workspaceName, repoSlug }: RestartMenuOptions,
  deps: RestartMenuDeps = {}
): never {
  const spawn = deps.spawn ?? spawnSync;
  const exit: (code: number) => never = deps.exit ?? ((code: number) => process.exit(code));

  const args = ['on', workspaceName];
  if (repoSlug) {
    args.push('--repo', repoSlug);
  }

  const result = spawn('agent-env', args, { stdio: 'inherit' });
  // null status means spawn failed or child was killed by signal — treat as failure.
  exit(result.status ?? 1);
}
