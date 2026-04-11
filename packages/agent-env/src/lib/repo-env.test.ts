import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { copyRepoEnvFiles, getRepoEnvDir, loadRepoEnv, parseEnvFile } from './repo-env.js';

// ─── parseEnvFile ───────────────────────────────────────────────────────────

describe('parseEnvFile', () => {
  it('parses simple KEY=VALUE pairs', () => {
    expect(parseEnvFile('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('skips comments and blank lines', () => {
    const content = `
# This is a comment
FOO=bar

# Another comment
BAZ=qux
`;
    expect(parseEnvFile(content)).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('handles double-quoted values', () => {
    expect(parseEnvFile('KEY="hello world"')).toEqual({ KEY: 'hello world' });
  });

  it('handles single-quoted values', () => {
    expect(parseEnvFile("KEY='hello world'")).toEqual({ KEY: 'hello world' });
  });

  it('trims whitespace around keys and unquoted values', () => {
    expect(parseEnvFile('  FOO  =  bar  ')).toEqual({ FOO: 'bar' });
  });

  it('preserves whitespace inside quoted values', () => {
    expect(parseEnvFile('KEY="  spaced  "')).toEqual({ KEY: '  spaced  ' });
  });

  it('handles values containing equals signs', () => {
    expect(parseEnvFile('KEY=abc=def=ghi')).toEqual({ KEY: 'abc=def=ghi' });
  });

  it('handles empty values', () => {
    expect(parseEnvFile('KEY=')).toEqual({ KEY: '' });
  });

  it('handles empty quoted values', () => {
    expect(parseEnvFile('KEY=""')).toEqual({ KEY: '' });
  });

  it('skips lines without equals sign', () => {
    expect(parseEnvFile('NOEQUALS\nFOO=bar')).toEqual({ FOO: 'bar' });
  });

  it('skips lines with empty key', () => {
    expect(parseEnvFile('=value\nFOO=bar')).toEqual({ FOO: 'bar' });
  });

  it('returns empty object for empty content', () => {
    expect(parseEnvFile('')).toEqual({});
  });

  it('last value wins for duplicate keys', () => {
    expect(parseEnvFile('KEY=first\nKEY=second')).toEqual({ KEY: 'second' });
  });
});

// ─── getRepoEnvDir ──────────────────────────────────────────────────────────

describe('getRepoEnvDir', () => {
  it('returns correct path under ~/.agent-env/repos/<slug>/', () => {
    const deps = { homedir: () => '/home/testuser' };
    expect(getRepoEnvDir('my-repo', deps)).toBe(
      join('/home/testuser', '.agent-env', 'repos', 'my-repo')
    );
  });

  it('rejects slugs with path traversal characters', () => {
    const deps = { homedir: () => '/home/testuser' };
    expect(() => getRepoEnvDir('../../etc', deps)).toThrow('Invalid repo slug');
    expect(() => getRepoEnvDir('foo/bar', deps)).toThrow('Invalid repo slug');
    expect(() => getRepoEnvDir('foo\\bar', deps)).toThrow('Invalid repo slug');
  });

  it('rejects empty slug', () => {
    const deps = { homedir: () => '/home/testuser' };
    expect(() => getRepoEnvDir('', deps)).toThrow('Invalid repo slug');
  });
});

// ─── loadRepoEnv ────────────────────────────────────────────────────────────

describe('loadRepoEnv', () => {
  const makeEnoent = () => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    return err;
  };

  const makeDeps = (files: Record<string, string>) => ({
    homedir: () => '/home/testuser',
    readFile: vi.fn(async (path: string) => {
      if (path in files) return files[path];
      throw makeEnoent();
    }),
  });

  const envPath = join('/home/testuser', '.agent-env', 'repos', 'my-repo', '.env');
  const localPath = join('/home/testuser', '.agent-env', 'repos', 'my-repo', '.env.local');

  it('loads .env file', async () => {
    const deps = makeDeps({ [envPath]: 'FOO=bar\nBAZ=qux' });
    const result = await loadRepoEnv('my-repo', deps);
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('loads .env.local overriding .env', async () => {
    const deps = makeDeps({
      [envPath]: 'FOO=from-env\nSHARED=base',
      [localPath]: 'FOO=from-local\nLOCAL_ONLY=yes',
    });
    const result = await loadRepoEnv('my-repo', deps);
    expect(result).toEqual({ FOO: 'from-local', SHARED: 'base', LOCAL_ONLY: 'yes' });
  });

  it('returns empty object when no env files exist', async () => {
    const deps = makeDeps({});
    const result = await loadRepoEnv('my-repo', deps);
    expect(result).toEqual({});
  });

  it('handles only .env.local existing', async () => {
    const deps = makeDeps({ [localPath]: 'KEY=value' });
    const result = await loadRepoEnv('my-repo', deps);
    expect(result).toEqual({ KEY: 'value' });
  });

  it('propagates non-ENOENT errors', async () => {
    const eacces = new Error('EACCES') as NodeJS.ErrnoException;
    eacces.code = 'EACCES';
    const deps = {
      homedir: () => '/home/testuser',
      readFile: vi.fn(async () => {
        throw eacces;
      }),
    };
    await expect(loadRepoEnv('my-repo', deps)).rejects.toThrow('EACCES');
  });
});

// ─── copyRepoEnvFiles ───────────────────────────────────────────────────────

describe('copyRepoEnvFiles', () => {
  const repoDir = join('/home/testuser', '.agent-env', 'repos', 'my-repo');
  const destDir = '/workspaces/my-repo-instance';

  const makeDeps = (existingFiles: Set<string>) => ({
    homedir: () => '/home/testuser',
    readFile: vi.fn(),
    copyFile: vi.fn(async (src: string) => {
      if (!existingFiles.has(src)) {
        const err = new Error('ENOENT') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        throw err;
      }
    }),
  });

  it('copies both .env and .env.local when both exist', async () => {
    const deps = makeDeps(new Set([join(repoDir, '.env'), join(repoDir, '.env.local')]));
    const copied = await copyRepoEnvFiles('my-repo', destDir, deps);

    expect(copied).toEqual(['.env', '.env.local']);
    expect(deps.copyFile).toHaveBeenCalledTimes(2);
    expect(deps.copyFile).toHaveBeenCalledWith(join(repoDir, '.env'), join(destDir, '.env'));
    expect(deps.copyFile).toHaveBeenCalledWith(
      join(repoDir, '.env.local'),
      join(destDir, '.env.local')
    );
  });

  it('copies only .env when .env.local does not exist', async () => {
    const deps = makeDeps(new Set([join(repoDir, '.env')]));
    const copied = await copyRepoEnvFiles('my-repo', destDir, deps);

    expect(copied).toEqual(['.env']);
    expect(deps.copyFile).toHaveBeenCalledTimes(2);
  });

  it('copies only .env.local when .env does not exist', async () => {
    const deps = makeDeps(new Set([join(repoDir, '.env.local')]));
    const copied = await copyRepoEnvFiles('my-repo', destDir, deps);

    expect(copied).toEqual(['.env.local']);
  });

  it('returns empty array when no env files exist', async () => {
    const deps = makeDeps(new Set());
    const copied = await copyRepoEnvFiles('my-repo', destDir, deps);

    expect(copied).toEqual([]);
    expect(deps.copyFile).toHaveBeenCalledTimes(2);
  });

  it('propagates non-ENOENT copy errors', async () => {
    const eacces = new Error('EACCES') as NodeJS.ErrnoException;
    eacces.code = 'EACCES';
    const deps = {
      homedir: () => '/home/testuser',
      readFile: vi.fn(),
      copyFile: vi.fn(async () => {
        throw eacces;
      }),
    };
    await expect(copyRepoEnvFiles('my-repo', destDir, deps)).rejects.toThrow('EACCES');
  });
});
