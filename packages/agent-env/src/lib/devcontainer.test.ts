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

// ─── Constants ──────────────────────────────────────────────────────────────

/** Docker Desktop / OrbStack SSH agent socket path (macOS) */
const SSH_AUTH_SOCKET = '/run/host-services/ssh-auth.sock';

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
  it('creates .devcontainer/ directory in workspace', async () => {
    await copyBaselineConfig(tempDir);
    const stats = await stat(join(tempDir, '.devcontainer'));
    expect(stats.isDirectory()).toBe(true);
  });

  it('copies devcontainer.json to workspace', async () => {
    await copyBaselineConfig(tempDir);
    const stats = await stat(join(tempDir, '.devcontainer', 'devcontainer.json'));
    expect(stats.isFile()).toBe(true);
  });

  it('copies Dockerfile to workspace', async () => {
    await copyBaselineConfig(tempDir);
    const stats = await stat(join(tempDir, '.devcontainer', 'Dockerfile'));
    expect(stats.isFile()).toBe(true);
  });

  it('copies post-create.sh to workspace', async () => {
    await copyBaselineConfig(tempDir);
    const stats = await stat(join(tempDir, '.devcontainer', 'post-create.sh'));
    expect(stats.isFile()).toBe(true);
  });

  it('creates .devcontainer/ even if parent dirs are missing', async () => {
    const deepPath = join(tempDir, 'nested', 'workspace');
    await mkdir(deepPath, { recursive: true });
    await copyBaselineConfig(deepPath);

    const stats = await stat(join(deepPath, '.devcontainer', 'devcontainer.json'));
    expect(stats.isFile()).toBe(true);
  });

  it('workspace is detected by hasDevcontainerConfig after copy', async () => {
    expect(await hasDevcontainerConfig(tempDir)).toBe(false);
    await copyBaselineConfig(tempDir);
    expect(await hasDevcontainerConfig(tempDir)).toBe(true);
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

  it('includes Dockerfile', async () => {
    const files = await listBaselineFiles();
    expect(files).toContain('Dockerfile');
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

  it('has build configuration with Dockerfile', () => {
    expect(config.build).toBeDefined();
    expect((config.build as Record<string, unknown>).dockerfile).toBe('Dockerfile');
  });

  it('configures non-root node user', () => {
    expect(config.remoteUser).toBe('node');
  });

  it('mounts Claude Code auth directory as read-only', () => {
    const mounts = config.mounts as string[];
    const claudeMount = mounts.find((m) => m.includes('.claude'));
    expect(claudeMount).toBeDefined();
    expect(claudeMount).toContain('readonly');
    expect(claudeMount).toContain('/home/node/.claude');
  });

  it('mounts host .gitconfig as read-only', () => {
    const mounts = config.mounts as string[];
    const gitconfigMount = mounts.find((m) => m.includes('.gitconfig'));
    expect(gitconfigMount).toBeDefined();
    expect(gitconfigMount).toContain('readonly');
    expect(gitconfigMount).toContain('/home/node/.gitconfig');
  });

  it('mounts Docker SSH agent socket for SSH forwarding', () => {
    const mounts = config.mounts as string[];
    const sshMount = mounts.find((m) => m.includes('ssh-auth.sock'));
    expect(sshMount).toBeDefined();
    expect(sshMount).toContain(SSH_AUTH_SOCKET);
    expect(sshMount).toContain('type=bind');
  });

  it('sets SSH_AUTH_SOCK in containerEnv', () => {
    const containerEnv = config.containerEnv as Record<string, string>;
    expect(containerEnv).toBeDefined();
    expect(containerEnv.SSH_AUTH_SOCK).toBe(SSH_AUTH_SOCKET);
  });

  it('has initializeCommand referencing init-host.sh', () => {
    expect(config.initializeCommand).toBeDefined();
    expect(config.initializeCommand as string).toContain('init-host.sh');
  });

  it('configures tmux auto-start via postStartCommand', () => {
    expect(config.postStartCommand).toBeDefined();
    expect(config.postStartCommand as string).toContain('tmux');
  });

  it('configures zsh as default shell', () => {
    const customizations = config.customizations as Record<
      string,
      Record<string, Record<string, string>>
    >;
    expect(customizations?.vscode?.settings?.['terminal.integrated.defaultProfile.linux']).toBe(
      'zsh'
    );
  });
});

// ─── patchContainerName ──────────────────────────────────────────────────────

describe('patchContainerName', () => {
  it('adds runArgs with --name to devcontainer.json', async () => {
    await copyBaselineConfig(tempDir);
    await patchContainerName(tempDir, 'ae-my-project-auth');

    const content = await readFile(join(tempDir, '.devcontainer', 'devcontainer.json'), 'utf-8');
    const config = JSON.parse(content);
    expect(config.runArgs).toContain('--name=ae-my-project-auth');
  });

  it('preserves existing devcontainer.json properties', async () => {
    await copyBaselineConfig(tempDir);
    await patchContainerName(tempDir, 'ae-test');

    const content = await readFile(join(tempDir, '.devcontainer', 'devcontainer.json'), 'utf-8');
    const config = JSON.parse(content);
    expect(config.remoteUser).toBe('node');
    expect(config.build).toBeDefined();
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

// ─── Dockerfile content validation ───────────────────────────────────────────

describe('Dockerfile content', () => {
  let content: string;

  beforeEach(async () => {
    const baselinePath = getBaselineConfigPath();
    content = await readFile(join(baselinePath, 'Dockerfile'), 'utf-8');
  });

  it('uses node:22-bookworm-slim as base image', () => {
    expect(content).toContain('FROM node:22-bookworm-slim');
  });

  it('installs tmux', () => {
    expect(content).toContain('tmux');
  });

  it('installs zsh', () => {
    expect(content).toContain('zsh');
  });

  it('installs git', () => {
    expect(content).toMatch(/\bgit\b/);
  });

  it('installs gnupg', () => {
    expect(content).toContain('gnupg');
  });

  it('installs openssh-client', () => {
    expect(content).toContain('openssh-client');
  });

  it('installs Claude Code CLI', () => {
    expect(content).toContain('@anthropic-ai/claude-code');
  });

  it('configures non-root node user', () => {
    expect(content).toContain('USER node');
  });

  it('sets zsh as default shell', () => {
    expect(content).toContain('chsh -s /usr/bin/zsh node');
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
