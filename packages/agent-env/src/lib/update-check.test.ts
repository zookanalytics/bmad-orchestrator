import { describe, it, expect } from 'vitest';

import type { UpdateCheckOpts } from './update-check.js';

import { checkForUpdate } from './update-check.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PACKAGE_NAME = '@zookanalytics/agent-env';
const CACHE_PATH = '/fake/home/.agent-env/update-check.json';
const CACHE_TTL_MS = 3_600_000;
const NOW = 1_710_806_400_000; // fixed clock value

function makeFreshCache(latestVersion: string, offsetMs = 0): string {
  return JSON.stringify({ lastCheck: NOW - offsetMs, latestVersion });
}

function makeReadFile(content: string | Error) {
  return async (_path: string, _enc: BufferEncoding): Promise<string> => {
    if (content instanceof Error) throw content;
    return content;
  };
}

function makeWriteFile(written?: { path?: string; data?: string }) {
  return async (path: string, data: string, _enc: BufferEncoding): Promise<void> => {
    if (written) {
      written.path = path;
      written.data = data;
    }
  };
}

function makeMkdir() {
  return async (_path: string, _opts?: { recursive?: boolean }): Promise<string | undefined> =>
    undefined;
}

function makeFetch(responseVersion: string | null, throws?: Error) {
  return async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    if (throws) throw throws;
    if (responseVersion === null) {
      // Return invalid JSON response
      return {
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ version: responseVersion }),
    } as unknown as Response;
  };
}

function baseOpts(overrides: Partial<UpdateCheckOpts> = {}): UpdateCheckOpts {
  return {
    currentVersion: '0.9.1',
    packageName: PACKAGE_NAME,
    cachePath: CACHE_PATH,
    cacheTtlMs: CACHE_TTL_MS,
    now: () => NOW,
    readFile: makeReadFile(new Error('ENOENT: no such file')),
    writeFile: makeWriteFile(),
    mkdir: makeMkdir(),
    fetchFn: makeFetch('0.9.1'),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkForUpdate — cache fresh, newer version available', () => {
  it('returns update message when cache is fresh and latestVersion > currentVersion', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(makeFreshCache('0.10.0')),
      fetchFn: makeFetch('0.9.1'), // fetch should NOT be called since cache is fresh
    });
    const result = await checkForUpdate(opts);
    expect(result).not.toBeNull();
    expect(result).toContain('0.9.1');
    expect(result).toContain('0.10.0');
    expect(result).toContain(PACKAGE_NAME);
  });

  it('message contains update available label and run instruction', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.0',
      readFile: makeReadFile(makeFreshCache('0.9.1')),
    });
    const result = await checkForUpdate(opts);
    expect(result).not.toBeNull();
    expect(result?.toLowerCase()).toContain('update available');
    expect(result).toContain('pnpm add -g');
  });
});

describe('checkForUpdate — cache fresh, same or older version', () => {
  it('returns null when latestVersion equals currentVersion', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(makeFreshCache('0.9.1')),
    });
    const result = await checkForUpdate(opts);
    expect(result).toBeNull();
  });

  it('returns null when latestVersion is older than currentVersion', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(makeFreshCache('0.9.0')),
    });
    const result = await checkForUpdate(opts);
    expect(result).toBeNull();
  });
});

describe('checkForUpdate — cache stale, fetch succeeds with newer version', () => {
  it('fetches from registry and returns update message', async () => {
    const written: { path?: string; data?: string } = {};
    const opts = baseOpts({
      currentVersion: '0.9.1',
      // stale: lastCheck was more than TTL ago
      readFile: makeReadFile(makeFreshCache('0.9.0', CACHE_TTL_MS + 1000)),
      writeFile: makeWriteFile(written),
      fetchFn: makeFetch('0.10.0'),
    });
    const result = await checkForUpdate(opts);
    expect(result).not.toBeNull();
    expect(result).toContain('0.9.1');
    expect(result).toContain('0.10.0');
  });

  it('passes correctly encoded URL to fetchFn', async () => {
    let calledUrl: string | URL | Request | undefined;
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(null),
      fetchFn: async (url, init) => {
        calledUrl = url;
        return makeFetch('0.10.0')(url, init);
      },
    });
    await checkForUpdate(opts);
    expect(calledUrl).toBe(`https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/latest`);
  });

  it('writes updated cache after successful fetch', async () => {
    const written: { path?: string; data?: string } = {};
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(makeFreshCache('0.9.0', CACHE_TTL_MS + 1000)),
      writeFile: makeWriteFile(written),
      fetchFn: makeFetch('0.10.0'),
    });
    await checkForUpdate(opts);
    expect(written.path).toBe(CACHE_PATH);
    expect(written.data).toBeDefined();
    const parsed = JSON.parse(written.data ?? '{}') as { latestVersion: string; lastCheck: number };
    expect(parsed.latestVersion).toBe('0.10.0');
    expect(parsed.lastCheck).toBe(NOW);
  });
});

describe('checkForUpdate — cache stale, fetch succeeds with same version', () => {
  it('returns null and still writes cache', async () => {
    const written: { path?: string; data?: string } = {};
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(makeFreshCache('0.9.0', CACHE_TTL_MS + 1000)),
      writeFile: makeWriteFile(written),
      fetchFn: makeFetch('0.9.1'),
    });
    const result = await checkForUpdate(opts);
    expect(result).toBeNull();
    expect(written.data).toBeDefined();
    const parsed = JSON.parse(written.data ?? '{}') as { latestVersion: string };
    expect(parsed.latestVersion).toBe('0.9.1');
  });
});

describe('checkForUpdate — cache stale, fetch fails', () => {
  it('returns null on network error, no crash', async () => {
    const opts = baseOpts({
      readFile: makeReadFile(makeFreshCache('0.9.0', CACHE_TTL_MS + 1000)),
      fetchFn: makeFetch('0.9.0', new Error('ECONNREFUSED')),
    });
    const result = await checkForUpdate(opts);
    expect(result).toBeNull();
  });

  it('returns null on timeout error, no crash', async () => {
    const opts = baseOpts({
      readFile: makeReadFile(makeFreshCache('0.9.0', CACHE_TTL_MS + 1000)),
      fetchFn: makeFetch('0.9.0', new DOMException('The operation was aborted', 'AbortError')),
    });
    const result = await checkForUpdate(opts);
    expect(result).toBeNull();
  });
});

describe('checkForUpdate — cache stale, fetch returns invalid JSON', () => {
  it('returns null when response JSON is malformed, no crash', async () => {
    const opts = baseOpts({
      readFile: makeReadFile(makeFreshCache('0.9.0', CACHE_TTL_MS + 1000)),
      fetchFn: makeFetch(null), // makeFetch(null) throws in json()
    });
    const result = await checkForUpdate(opts);
    expect(result).toBeNull();
  });

  it('returns null when response JSON is missing version field', async () => {
    const fetchFn = async (): Promise<Response> =>
      ({
        ok: true,
        json: async () => ({ notVersion: 'something' }),
      }) as unknown as Response;
    const opts = baseOpts({
      readFile: makeReadFile(makeFreshCache('0.9.0', CACHE_TTL_MS + 1000)),
      fetchFn,
    });
    const result = await checkForUpdate(opts);
    expect(result).toBeNull();
  });
});

describe('checkForUpdate — cache file missing or corrupt', () => {
  it('treats missing cache as stale and triggers fetch', async () => {
    const fetchFn = makeFetch('0.10.0');
    let fetchCalled = false;
    const wrappedFetch: typeof fetchFn = async (...args) => {
      fetchCalled = true;
      return fetchFn(...args);
    };
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(new Error('ENOENT: no such file or directory')),
      fetchFn: wrappedFetch,
    });
    const result = await checkForUpdate(opts);
    expect(fetchCalled).toBe(true);
    expect(result).not.toBeNull();
    expect(result).toContain('0.10.0');
  });

  it('treats corrupt/unparseable cache as stale', async () => {
    let fetchCalled = false;
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile('not valid json {{{'),
      fetchFn: async (...args) => {
        fetchCalled = true;
        return makeFetch('0.10.0')(...args);
      },
    });
    const result = await checkForUpdate(opts);
    expect(fetchCalled).toBe(true);
    expect(result).not.toBeNull();
  });

  it('treats cache with missing fields as stale', async () => {
    let fetchCalled = false;
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(JSON.stringify({ someOtherKey: 123 })),
      fetchFn: async (...args) => {
        fetchCalled = true;
        return makeFetch('0.10.0')(...args);
      },
    });
    await checkForUpdate(opts);
    expect(fetchCalled).toBe(true);
  });
});

describe('checkForUpdate — cache directory creation', () => {
  it('calls mkdir with recursive when writing cache', async () => {
    let mkdirCalled = false;
    let mkdirPath = '';
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(new Error('ENOENT')),
      mkdir: async (path: string, _opts?: { recursive?: boolean }) => {
        mkdirCalled = true;
        mkdirPath = path;
        return undefined;
      },
      fetchFn: makeFetch('0.10.0'),
    });
    await checkForUpdate(opts);
    expect(mkdirCalled).toBe(true);
    // mkdir should be called with the directory containing the cache file
    expect(mkdirPath).toBe('/fake/home/.agent-env');
  });
});

describe('checkForUpdate — cache directory not writable', () => {
  it('fails silently on write error and still returns comparison result', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(new Error('ENOENT')),
      mkdir: async () => {
        throw new Error('EACCES: permission denied');
      },
      writeFile: async () => {
        throw new Error('EACCES: permission denied');
      },
      fetchFn: makeFetch('0.10.0'),
    });
    // Should not throw, and should return the update message despite write failure
    const result = await checkForUpdate(opts);
    expect(result).not.toBeNull();
    expect(result).toContain('0.10.0');
  });
});

describe('checkForUpdate — semver comparison edge cases', () => {
  it('correctly identifies minor version bump as update', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(makeFreshCache('0.10.0')),
    });
    const result = await checkForUpdate(opts);
    expect(result).not.toBeNull();
  });

  it('correctly identifies patch version bump as update', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(makeFreshCache('0.9.2')),
    });
    const result = await checkForUpdate(opts);
    expect(result).not.toBeNull();
  });

  it('correctly identifies major version bump as update', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.1',
      readFile: makeReadFile(makeFreshCache('1.0.0')),
    });
    const result = await checkForUpdate(opts);
    expect(result).not.toBeNull();
  });

  it('strips +local suffix from currentVersion before comparison', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.1+local',
      readFile: makeReadFile(makeFreshCache('0.10.0')),
    });
    const result = await checkForUpdate(opts);
    expect(result).not.toBeNull();
  });

  it('strips +dev suffix from currentVersion before comparison', async () => {
    const opts = baseOpts({
      currentVersion: '0.9.1+dev',
      readFile: makeReadFile(makeFreshCache('0.10.0')),
    });
    const result = await checkForUpdate(opts);
    expect(result).not.toBeNull();
  });

  it('strips pre-release tag from currentVersion before comparison', async () => {
    const opts = baseOpts({
      currentVersion: '1.0.0-beta.1',
      readFile: makeReadFile(makeFreshCache('1.0.0')),
    });
    // 1.0.0-beta.1 stripped to 1.0.0, registry is 1.0.0 — no update
    const result = await checkForUpdate(opts);
    expect(result).toBeNull();
  });

  it('strips pre-release tag from registry version before comparison', async () => {
    const opts = baseOpts({
      currentVersion: '1.0.0',
      readFile: makeReadFile(makeFreshCache('1.0.0-rc.1')),
    });
    // 1.0.0-rc.1 stripped to 1.0.0 — no update
    const result = await checkForUpdate(opts);
    expect(result).toBeNull();
  });
});
