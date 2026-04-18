import { describe, it, expect, vi } from 'vitest';

import {
  detectDriftState,
  getInstalledVersion,
  isNewerVersion,
  isPackagePathStale,
  restartMenu,
  type VersionDriftState,
} from './version-drift.js';

// ─── isNewerVersion ─────────────────────────────────────────────────────────

describe('isNewerVersion', () => {
  it('returns true when installed is strictly greater', () => {
    expect(isNewerVersion('0.12.3', '0.13.0')).toBe(true);
    expect(isNewerVersion('0.12.3', '0.12.4')).toBe(true);
    expect(isNewerVersion('0.12.3', '1.0.0')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isNewerVersion('0.12.3', '0.12.3')).toBe(false);
  });

  it('returns false when installed is older', () => {
    expect(isNewerVersion('0.13.0', '0.12.3')).toBe(false);
  });

  it('strips +local/+dev suffixes before comparing', () => {
    expect(isNewerVersion('0.12.3+local', '0.13.0')).toBe(true);
    expect(isNewerVersion('0.12.3', '0.13.0+dev')).toBe(true);
    expect(isNewerVersion('0.12.3+local', '0.12.3+dev')).toBe(false);
  });
});

// ─── getInstalledVersion ────────────────────────────────────────────────────

describe('getInstalledVersion', () => {
  it('returns a version string when spawn succeeds', () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stdout: '0.13.0\n',
    });
    expect(getInstalledVersion({ spawn })).toBe('0.13.0');
    expect(spawn).toHaveBeenCalledWith(
      'agent-env',
      ['--version'],
      expect.objectContaining({
        encoding: 'utf-8',
        timeout: 5_000,
      })
    );
  });

  it('handles version strings with +suffix', () => {
    const spawn = vi.fn().mockReturnValue({ status: 0, stdout: '0.13.0+local\n' });
    expect(getInstalledVersion({ spawn })).toBe('0.13.0+local');
  });

  it('returns null when spawn fails', () => {
    const spawn = vi.fn().mockReturnValue({ status: 1, stdout: '' });
    expect(getInstalledVersion({ spawn })).toBeNull();
  });

  it('returns null when stdout is not a valid version', () => {
    const spawn = vi.fn().mockReturnValue({ status: 0, stdout: 'Usage: agent-env\n' });
    expect(getInstalledVersion({ spawn })).toBeNull();
  });

  it('returns null when spawn throws (binary not on PATH)', () => {
    const spawn = vi.fn().mockImplementation(() => {
      throw new Error('ENOENT: agent-env not found');
    });
    expect(getInstalledVersion({ spawn })).toBeNull();
  });
});

// ─── isPackagePathStale ─────────────────────────────────────────────────────

describe('isPackagePathStale', () => {
  it('returns false when the baseline config file is present', async () => {
    // Default deps hit the real package, which always ships the baseline.
    await expect(isPackagePathStale()).resolves.toBe(false);
  });

  it('returns true when access() rejects (simulating a removed install dir)', async () => {
    // Simulate the production failure mode: pnpm replaced the install
    // directory after the menu process started, so the baseline config
    // path that this process cached no longer resolves on disk.
    const access = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
      );

    await expect(
      isPackagePathStale({ access, getBaselinePath: () => '/gone/config/baseline' })
    ).resolves.toBe(true);

    expect(access).toHaveBeenCalledWith(
      '/gone/config/baseline/devcontainer.json',
      expect.any(Number)
    );
  });

  it('returns true when getBaselinePath itself throws (e.g. package.json walk fails)', async () => {
    const access = vi.fn();
    await expect(
      isPackagePathStale({
        access,
        getBaselinePath: () => {
          throw new Error('Could not find package.json in /old/path or any parent directory');
        },
      })
    ).resolves.toBe(true);
    expect(access).not.toHaveBeenCalled();
  });
});

// ─── detectDriftState ───────────────────────────────────────────────────────

describe('detectDriftState', () => {
  it('combines all three signals', async () => {
    const result = await detectDriftState({
      isPackagePathStale: vi.fn().mockResolvedValue(true),
      fetchUpdateMessage: vi.fn().mockResolvedValue('Update available: 0.12.3 -> 0.13.0'),
      getInstalledVersion: vi.fn().mockReturnValue('0.13.0'),
    });

    expect(result.packageMoved).toBe(true);
    expect(result.updateMessage).toBe('Update available: 0.12.3 -> 0.13.0');
    expect(result.installedVersion).toBe('0.13.0');
    expect(result.currentVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns clean state when all signals report no drift', async () => {
    const result = await detectDriftState({
      isPackagePathStale: vi.fn().mockResolvedValue(false),
      fetchUpdateMessage: vi.fn().mockResolvedValue(null),
      getInstalledVersion: vi.fn().mockReturnValue('0.12.3'),
    });

    expect(result.packageMoved).toBe(false);
    expect(result.updateMessage).toBeNull();
    expect(result.installedVersion).toBe('0.12.3');
  });

  it('returns installedVersion=null when binary is not on PATH', async () => {
    const result = await detectDriftState({
      isPackagePathStale: vi.fn().mockResolvedValue(false),
      fetchUpdateMessage: vi.fn().mockResolvedValue(null),
      getInstalledVersion: vi.fn().mockReturnValue(null),
    });

    expect(result.installedVersion).toBeNull();
  });

  it('passes force=false to fetchUpdateMessage by default', async () => {
    const fetchUpdateMessage = vi.fn().mockResolvedValue(null);
    await detectDriftState({
      isPackagePathStale: vi.fn().mockResolvedValue(false),
      fetchUpdateMessage,
    });
    expect(fetchUpdateMessage).toHaveBeenCalledWith(false);
  });

  it('passes force=true when options.forceRefresh is true', async () => {
    const fetchUpdateMessage = vi.fn().mockResolvedValue(null);
    await detectDriftState(
      {
        isPackagePathStale: vi.fn().mockResolvedValue(false),
        fetchUpdateMessage,
      },
      { forceRefresh: true }
    );
    expect(fetchUpdateMessage).toHaveBeenCalledWith(true);
  });

  it('runs the two probes in parallel', async () => {
    const order: string[] = [];
    const slowProbe = vi.fn().mockImplementation(async () => {
      order.push('probe-start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('probe-end');
      return false;
    });
    const slowFetch = vi.fn().mockImplementation(async () => {
      order.push('fetch-start');
      await new Promise((r) => setTimeout(r, 20));
      order.push('fetch-end');
      return null;
    });

    await detectDriftState({
      isPackagePathStale: slowProbe,
      fetchUpdateMessage: slowFetch,
    });

    // Both starts must appear before either end — parallel execution.
    expect(order.indexOf('probe-start')).toBeLessThan(order.indexOf('fetch-end'));
    expect(order.indexOf('fetch-start')).toBeLessThan(order.indexOf('probe-end'));
  });
});

// ─── restartMenu ────────────────────────────────────────────────────────────

describe('restartMenu', () => {
  function makeExitThatThrows(): (code: number) => never {
    return (code: number) => {
      throw new Error(`__exit(${code})`);
    };
  }

  it('invokes agent-env on <name> with inherited stdio and exits with child status', () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const exit = vi.fn<(code: number) => never>(makeExitThatThrows());

    expect(() => restartMenu({ workspaceName: 'my-ws' }, { spawn, exit })).toThrow('__exit(0)');

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith('agent-env', ['on', 'my-ws'], { stdio: 'inherit' });
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('appends --repo <slug> when a repoSlug is provided', () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const exit = vi.fn<(code: number) => never>(makeExitThatThrows());

    expect(() =>
      restartMenu({ workspaceName: 'my-ws', repoSlug: 'user/repo' }, { spawn, exit })
    ).toThrow('__exit(0)');

    expect(spawn).toHaveBeenCalledWith('agent-env', ['on', 'my-ws', '--repo', 'user/repo'], {
      stdio: 'inherit',
    });
  });

  it('propagates non-zero child exit codes and falls back to 0 for null status', () => {
    const spawn = vi.fn().mockReturnValueOnce({ status: 42 }).mockReturnValueOnce({ status: null });
    const exit = vi.fn<(code: number) => never>(makeExitThatThrows());

    expect(() => restartMenu({ workspaceName: 'a' }, { spawn, exit })).toThrow('__exit(42)');
    expect(() => restartMenu({ workspaceName: 'b' }, { spawn, exit })).toThrow('__exit(0)');
  });
});

// ─── Type check: the shape we actually consume ─────────────────────────────

describe('VersionDriftState typing', () => {
  it('matches the expected discriminant shape', () => {
    const state: VersionDriftState = {
      packageMoved: true,
      updateMessage: null,
      installedVersion: '0.13.0',
      currentVersion: '0.12.3',
    };
    expect(state.packageMoved).toBe(true);
    expect(state.installedVersion).toBe('0.13.0');
  });
});
