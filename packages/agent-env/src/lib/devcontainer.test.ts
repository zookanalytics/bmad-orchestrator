import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getBaselineConfigPath,
  hasDevcontainerConfig,
  copyBaselineConfig,
  listBaselineFiles,
  patchContainerName,
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

  it('copies git-config to workspace', async () => {
    await copyBaselineConfig(tempDir);
    const stats = await stat(join(tempDir, '.devcontainer', 'git-config'));
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

  it('does not include SSH agent socket mount (devcontainer handles SSH forwarding)', () => {
    const mounts = config.mounts as string[];
    const sshMount = mounts.find((m) => m.includes('SSH_AUTH_SOCK'));
    expect(sshMount).toBeUndefined();
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
