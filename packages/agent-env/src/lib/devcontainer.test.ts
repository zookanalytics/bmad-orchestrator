import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getBaselineConfigPath,
  hasDevcontainerConfig,
  copyBaselineConfig,
  listBaselineFiles,
  patchContainerName,
  resolveDockerfilePath,
  parseDockerfileImages,
} from './devcontainer.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-devcontainer-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ─── getBaselineConfigPath ───────────────────────────────────────────────────

describe('getBaselineConfigPath', () => {
  it('returns a path ending with config/baseline', () => {
    const result = getBaselineConfigPath();
    expect(result).toMatch(/config\/baseline$/);
  });

  it('returns an absolute path', () => {
    const result = getBaselineConfigPath();
    expect(result).toMatch(/^\//);
  });

  it('points to an existing directory', async () => {
    const result = getBaselineConfigPath();
    const stats = await stat(result);
    expect(stats.isDirectory()).toBe(true);
  });
});

// ─── hasDevcontainerConfig ───────────────────────────────────────────────────

describe('hasDevcontainerConfig', () => {
  it('returns false when workspace has no devcontainer config', async () => {
    const result = await hasDevcontainerConfig(tempDir);
    expect(result).toBe(false);
  });

  it('returns true when .devcontainer/ directory exists', async () => {
    await mkdir(join(tempDir, '.devcontainer'));
    const result = await hasDevcontainerConfig(tempDir);
    expect(result).toBe(true);
  });

  it('returns true when root-level devcontainer.json exists', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(tempDir, 'devcontainer.json'), '{}');
    const result = await hasDevcontainerConfig(tempDir);
    expect(result).toBe(true);
  });

  it('returns true when root-level .devcontainer.json exists', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(tempDir, '.devcontainer.json'), '{}');
    const result = await hasDevcontainerConfig(tempDir);
    expect(result).toBe(true);
  });

  it('returns false when .devcontainer path exists but is a file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(tempDir, '.devcontainer'), 'not a directory');
    const result = await hasDevcontainerConfig(tempDir);
    // .devcontainer is a file not a dir, and devcontainer.json doesn't exist
    expect(result).toBe(false);
  });

  it('returns false for non-existent workspace path', async () => {
    const result = await hasDevcontainerConfig(join(tempDir, 'nonexistent'));
    expect(result).toBe(false);
  });
});

// ─── copyBaselineConfig ──────────────────────────────────────────────────────

describe('copyBaselineConfig', () => {
  it('creates .agent-env/ directory in workspace', async () => {
    await copyBaselineConfig(tempDir);
    const stats = await stat(join(tempDir, '.agent-env'));
    expect(stats.isDirectory()).toBe(true);
  });

  it('copies devcontainer.json to workspace', async () => {
    await copyBaselineConfig(tempDir);
    const stats = await stat(join(tempDir, '.agent-env', 'devcontainer.json'));
    expect(stats.isFile()).toBe(true);
  });

  it('copies init-host.sh to workspace', async () => {
    await copyBaselineConfig(tempDir);
    const stats = await stat(join(tempDir, '.agent-env', 'init-host.sh'));
    expect(stats.isFile()).toBe(true);
  });

  it('creates .agent-env/ even if parent dirs are missing', async () => {
    const deepPath = join(tempDir, 'nested', 'workspace');
    await mkdir(deepPath, { recursive: true });
    await copyBaselineConfig(deepPath);

    const stats = await stat(join(deepPath, '.agent-env', 'devcontainer.json'));
    expect(stats.isFile()).toBe(true);
  });

  it('workspace is not detected by hasDevcontainerConfig after copy (config is in .agent-env/)', async () => {
    expect(await hasDevcontainerConfig(tempDir)).toBe(false);
    await copyBaselineConfig(tempDir);
    expect(await hasDevcontainerConfig(tempDir)).toBe(false);
  });
});

// ─── listBaselineFiles ───────────────────────────────────────────────────────

describe('listBaselineFiles', () => {
  it('returns an array of filenames', async () => {
    const files = await listBaselineFiles();
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
  });

  it('includes devcontainer.json', async () => {
    const files = await listBaselineFiles();
    expect(files).toContain('devcontainer.json');
  });

  it('includes init-host.sh', async () => {
    const files = await listBaselineFiles();
    expect(files).toContain('init-host.sh');
  });

  it('throws an error if baseline dir is missing', async () => {
    const mockReaddir = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    await expect(
      listBaselineFiles({ readdir: mockReaddir as unknown as typeof readdir })
    ).rejects.toThrow('ENOENT');
  });
});

// ─── devcontainer.json content validation ────────────────────────────────────

describe('devcontainer.json content', () => {
  let config: Record<string, unknown>;

  beforeEach(async () => {
    const baselinePath = getBaselineConfigPath();
    const content = await readFile(join(baselinePath, 'devcontainer.json'), 'utf-8');
    config = JSON.parse(content);
  });

  it('is valid JSON', () => {
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('uses pre-built GHCR image instead of local Dockerfile build', () => {
    expect(config.image).toBe('ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:latest');
    expect(config.build).toBeUndefined();
  });

  it('does not define mounts (provided by image LABEL metadata)', () => {
    expect(config.mounts).toBeUndefined();
  });

  it('has initializeCommand referencing .agent-env/init-host.sh', () => {
    expect(config.initializeCommand).toBeDefined();
    expect(config.initializeCommand as string).toContain('.agent-env/init-host.sh');
  });

  it('does not define customizations (provided by image LABEL metadata)', () => {
    expect(config.customizations).toBeUndefined();
  });
});

// ─── patchContainerName ──────────────────────────────────────────────────────

describe('patchContainerName', () => {
  it('adds runArgs with --name to devcontainer.json', async () => {
    await copyBaselineConfig(tempDir);
    await patchContainerName(tempDir, 'ae-my-project-auth', undefined, '.agent-env');

    const content = await readFile(join(tempDir, '.agent-env', 'devcontainer.json'), 'utf-8');
    const config = JSON.parse(content);
    expect(config.runArgs).toContain('--name=ae-my-project-auth');
  });

  it('preserves existing devcontainer.json properties', async () => {
    await copyBaselineConfig(tempDir);
    await patchContainerName(tempDir, 'ae-test', undefined, '.agent-env');

    const content = await readFile(join(tempDir, '.agent-env', 'devcontainer.json'), 'utf-8');
    const config = JSON.parse(content);
    expect(config.image).toBe('ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:latest');
    expect(config.initializeCommand).toContain('init-host.sh');
  });

  it('replaces existing --name flag in runArgs', async () => {
    const { writeFile } = await import('node:fs/promises');
    await mkdir(join(tempDir, '.devcontainer'), { recursive: true });
    await writeFile(
      join(tempDir, '.devcontainer', 'devcontainer.json'),
      JSON.stringify({ runArgs: ['--name=old-name', '--hostname=test'] })
    );

    await patchContainerName(tempDir, 'ae-new-name');

    const content = await readFile(join(tempDir, '.devcontainer', 'devcontainer.json'), 'utf-8');
    const config = JSON.parse(content);
    expect(config.runArgs).toEqual(['--hostname=test', '--name=ae-new-name']);
  });
});

// ─── resolveDockerfilePath ───────────────────────────────────────────────

describe('resolveDockerfilePath', () => {
  const fsDeps = { readFile, stat };

  it('returns path when build.dockerfile is set in devcontainer.json', async () => {
    const devcontainerDir = join(tempDir, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(
      join(devcontainerDir, 'devcontainer.json'),
      JSON.stringify({ build: { dockerfile: 'Dockerfile.dev' } })
    );

    const result = await resolveDockerfilePath(tempDir, fsDeps);
    expect(result).toBe(join(devcontainerDir, 'Dockerfile.dev'));
  });

  it('returns path when top-level dockerfile field is set (shorthand form)', async () => {
    const devcontainerDir = join(tempDir, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(
      join(devcontainerDir, 'devcontainer.json'),
      JSON.stringify({ dockerfile: 'Dockerfile.custom' })
    );

    const result = await resolveDockerfilePath(tempDir, fsDeps);
    expect(result).toBe(join(devcontainerDir, 'Dockerfile.custom'));
  });

  it('prefers build.dockerfile over top-level dockerfile field', async () => {
    const devcontainerDir = join(tempDir, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(
      join(devcontainerDir, 'devcontainer.json'),
      JSON.stringify({ build: { dockerfile: 'Dockerfile.build' }, dockerfile: 'Dockerfile.top' })
    );

    const result = await resolveDockerfilePath(tempDir, fsDeps);
    expect(result).toBe(join(devcontainerDir, 'Dockerfile.build'));
  });

  it('returns default Dockerfile path when build.dockerfile absent but Dockerfile exists', async () => {
    const devcontainerDir = join(tempDir, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(join(devcontainerDir, 'devcontainer.json'), JSON.stringify({ image: 'node' }));
    await writeFile(join(devcontainerDir, 'Dockerfile'), 'FROM node:22');

    const result = await resolveDockerfilePath(tempDir, fsDeps);
    expect(result).toBe(join(devcontainerDir, 'Dockerfile'));
  });

  it('returns null when no Dockerfile exists (image-based config)', async () => {
    const devcontainerDir = join(tempDir, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(
      join(devcontainerDir, 'devcontainer.json'),
      JSON.stringify({ image: 'mcr.microsoft.com/devcontainers/base:bookworm' })
    );

    const result = await resolveDockerfilePath(tempDir, fsDeps);
    expect(result).toBeNull();
  });

  it('returns null when devcontainer.json is missing', async () => {
    const result = await resolveDockerfilePath(tempDir, fsDeps);
    expect(result).toBeNull();
  });

  it('returns the configured path even when build.dockerfile references a non-existent file', async () => {
    const devcontainerDir = join(tempDir, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(
      join(devcontainerDir, 'devcontainer.json'),
      JSON.stringify({ build: { dockerfile: 'NonExistent.dockerfile' } })
    );
    // Do NOT create the Dockerfile — should still return the path

    const result = await resolveDockerfilePath(tempDir, fsDeps);
    expect(result).toBe(join(devcontainerDir, 'NonExistent.dockerfile'));
  });

  it('parses JSONC devcontainer.json correctly (comments, trailing commas)', async () => {
    const devcontainerDir = join(tempDir, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    const jsoncContent = `{
  // This is a comment
  "build": {
    "dockerfile": "Dockerfile",
    /* block comment */
    "context": "."
  },
  "image": "ghcr.io/user/repo", // inline comment with //
}`;
    await writeFile(join(devcontainerDir, 'devcontainer.json'), jsoncContent);

    const result = await resolveDockerfilePath(tempDir, fsDeps);
    expect(result).toBe(join(devcontainerDir, 'Dockerfile'));
  });

  it('finds root-level devcontainer.json when .devcontainer/ dir does not exist', async () => {
    await writeFile(
      join(tempDir, 'devcontainer.json'),
      JSON.stringify({ build: { dockerfile: 'Dockerfile' } })
    );
    await writeFile(join(tempDir, 'Dockerfile'), 'FROM node:22');

    const result = await resolveDockerfilePath(tempDir, fsDeps);
    expect(result).toBe(join(tempDir, 'Dockerfile'));
  });

  it('throws error when devcontainer.json contains invalid JSON', async () => {
    const devcontainerDir = join(tempDir, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await writeFile(join(devcontainerDir, 'devcontainer.json'), '{ invalid json');

    await expect(resolveDockerfilePath(tempDir, fsDeps)).rejects.toThrow(
      'Failed to parse devcontainer config'
    );
  });
});

// ─── parseDockerfileImages ──────────────────────────────────────────────

describe('parseDockerfileImages', () => {
  it('extracts single FROM image', () => {
    const result = parseDockerfileImages('FROM node:22-bookworm-slim');
    expect(result).toEqual(['node:22-bookworm-slim']);
  });

  it('extracts multiple FROM images and deduplicates', () => {
    const content = `FROM node:22-bookworm-slim AS builder
FROM node:22-bookworm-slim AS runner
FROM nginx:alpine`;
    const result = parseDockerfileImages(content);
    expect(result).toEqual(['node:22-bookworm-slim', 'nginx:alpine']);
  });

  it('handles FROM --platform=... image', () => {
    const result = parseDockerfileImages('FROM --platform=linux/amd64 node:22');
    expect(result).toEqual(['node:22']);
  });

  it('handles FROM image AS stage', () => {
    const result = parseDockerfileImages('FROM node:22 AS builder');
    expect(result).toEqual(['node:22']);
  });

  it('skips FROM scratch', () => {
    const content = `FROM node:22 AS builder
FROM scratch`;
    const result = parseDockerfileImages(content);
    expect(result).toEqual(['node:22']);
  });

  it('skips parameterized FROM ${VAR} and calls logger.warn', () => {
    const logger = { warn: vi.fn() };
    const content = `FROM node:22
FROM \${BASE_IMAGE}`;
    const result = parseDockerfileImages(content, logger);
    expect(result).toEqual(['node:22']);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping parameterized FROM')
    );
  });

  it('ignores comment lines', () => {
    const content = `# FROM fake:image
FROM node:22`;
    const result = parseDockerfileImages(content);
    expect(result).toEqual(['node:22']);
  });

  it('skips multi-stage references to earlier build stages', () => {
    const content = `FROM node:22-bookworm-slim AS builder
RUN npm ci
FROM builder AS runner
COPY --from=builder /app /app`;
    const result = parseDockerfileImages(content);
    expect(result).toEqual(['node:22-bookworm-slim']);
  });

  it('skips stage references case-insensitively', () => {
    const content = `FROM node:22 as Builder
FROM builder`;
    const result = parseDockerfileImages(content);
    expect(result).toEqual(['node:22']);
  });

  it('returns empty array for empty/no-FROM content', () => {
    expect(parseDockerfileImages('')).toEqual([]);
    expect(parseDockerfileImages('RUN echo hello')).toEqual([]);
  });
});
