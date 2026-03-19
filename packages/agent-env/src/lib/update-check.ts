import chalk from 'chalk';
import * as fs from 'node:fs/promises';
import { dirname } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateCheckOpts {
  /** Current version from package.json (pre-stripped of +local/+dev is acceptable but not required) */
  currentVersion: string;
  /** Package name, e.g. "@zookanalytics/agent-env" */
  packageName: string;
  /** Absolute path to the cache file, e.g. ~/.agent-env/update-check.json */
  cachePath: string;
  /** Cache TTL in milliseconds (default: 3_600_000 = 1 hour) */
  cacheTtlMs: number;
  /** Injectable fetch for testing */
  fetchFn?: typeof fetch;
  /** Injectable fs.readFile for testing */
  readFile?: (path: string, encoding: BufferEncoding) => Promise<string>;
  /** Injectable fs.writeFile for testing */
  writeFile?: (path: string, data: string, encoding: BufferEncoding) => Promise<void>;
  /** Injectable fs.mkdir for testing */
  mkdir?: (path: string, opts?: { recursive?: boolean }) => Promise<string | undefined>;
  /** Injectable clock for testing */
  now?: () => number;
}

interface CacheData {
  lastCheck: number;
  latestVersion: string;
}

// ─── Semver helpers ───────────────────────────────────────────────────────────

/**
 * Normalise a version string for comparison:
 * - Strip build metadata (+suffix)
 * - Strip pre-release tag (-suffix)
 */
function normaliseVersion(version: string): string {
  // Strip build metadata first (+local, +dev, etc.)
  const withoutBuild = version.split('+')[0];
  // Strip pre-release tag (-beta.1, -rc.1, etc.)
  const withoutPre = withoutBuild.split('-')[0];
  return withoutPre;
}

/**
 * Returns true if `registry` is strictly greater than `current`.
 * Both versions are normalised before comparison.
 */
function isNewerVersion(current: string, registry: string): boolean {
  const normCurrent = normaliseVersion(current);
  const normRegistry = normaliseVersion(registry);

  const currentParts = normCurrent.split('.').map(Number);
  const registryParts = normRegistry.split('.').map(Number);

  const len = Math.max(currentParts.length, registryParts.length);
  for (let i = 0; i < len; i++) {
    const c = currentParts[i] ?? 0;
    const r = registryParts[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function readCache(
  cachePath: string,
  readFileFn: NonNullable<UpdateCheckOpts['readFile']>
): Promise<CacheData | null> {
  try {
    const raw = await readFileFn(cachePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'lastCheck' in parsed &&
      'latestVersion' in parsed &&
      typeof (parsed as CacheData).lastCheck === 'number' &&
      typeof (parsed as CacheData).latestVersion === 'string'
    ) {
      return parsed as CacheData;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCache(
  cachePath: string,
  data: CacheData,
  mkdirFn: NonNullable<UpdateCheckOpts['mkdir']>,
  writeFileFn: NonNullable<UpdateCheckOpts['writeFile']>
): Promise<void> {
  try {
    await mkdirFn(dirname(cachePath), { recursive: true });
    await writeFileFn(cachePath, JSON.stringify(data), 'utf-8');
  } catch {
    // Filesystem failures are silent
  }
}

// ─── Registry fetch ───────────────────────────────────────────────────────────

async function fetchLatestVersion(
  packageName: string,
  fetchFn: NonNullable<UpdateCheckOpts['fetchFn']>
): Promise<string | null> {
  try {
    const url = `https://registry.npmjs.org/${packageName}/latest`;
    const response = await fetchFn(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    const json = (await response.json()) as unknown;
    if (
      json !== null &&
      typeof json === 'object' &&
      'version' in json &&
      typeof (json as { version: unknown }).version === 'string'
    ) {
      return (json as { version: string }).version;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Output formatting ────────────────────────────────────────────────────────

function formatUpdateMessage(
  currentVersion: string,
  latestVersion: string,
  packageName: string
): string {
  const normCurrent = normaliseVersion(currentVersion);
  const line1 = chalk.yellow(`Update available: ${normCurrent} -> ${latestVersion}`);
  const line2 = chalk.cyan(`Run: pnpm add -g ${packageName}`);
  return `${line1}\n${line2}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks whether a newer version of agent-env is available on npm.
 *
 * Uses a local cache file to avoid hitting the registry on every invocation.
 * Returns a styled message string if an update is available, null otherwise.
 * All filesystem and network failures are silent.
 */
export async function checkForUpdate(opts: UpdateCheckOpts): Promise<string | null> {
  const {
    currentVersion,
    packageName,
    cachePath,
    cacheTtlMs,
    fetchFn = fetch,
    readFile = (p, enc) => fs.readFile(p, enc),
    writeFile = (p, d, enc) => fs.writeFile(p, d, enc),
    mkdir = (p, o) => fs.mkdir(p, o),
    now = () => Date.now(),
  } = opts;

  const currentTime = now();

  // Try to read the cache
  const cache = await readCache(cachePath, readFile);

  let latestVersion: string | null = null;

  const isCacheFresh = cache !== null && currentTime - cache.lastCheck < cacheTtlMs;

  if (isCacheFresh) {
    // Use cached value
    latestVersion = cache.latestVersion;
  } else {
    // Cache is stale or missing — fetch from registry
    latestVersion = await fetchLatestVersion(packageName, fetchFn);

    if (latestVersion !== null) {
      // Write updated cache (failures are silent)
      await writeCache(cachePath, { lastCheck: currentTime, latestVersion }, mkdir, writeFile);
    }
  }

  if (latestVersion !== null && isNewerVersion(currentVersion, latestVersion)) {
    return formatUpdateMessage(currentVersion, latestVersion, packageName);
  }

  return null;
}
