import { lstat, mkdir, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { DevcontainerMergeDeps, ManagedConfig } from './devcontainer-merge.js';

import {
  LABEL_LIFECYCLE_CMDS,
  buildManagedConfig,
  buildManagedOnly,
  composeAllLifecycle,
  composeLifecycle,
  composeName,
  deepMergeCustomizations,
  loadManagedDefaults,
  mergeDevcontainerConfigs,
  mergeMounts,
  mergeRunArgs,
  readRepoConfig,
  validateRepoConfig,
  writeGeneratedConfig,
} from './devcontainer-merge.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-merge-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function createManagedConfig(overrides?: Partial<ManagedConfig>): ManagedConfig {
  return {
    image: 'ghcr.io/test/image:latest',
    instanceName: 'test-instance',
    containerName: 'ae-repo-test-instance',
    initializeCmd: 'bash .agent-env/init-host.sh',
    lifecycleCmds: { ...LABEL_LIFECYCLE_CMDS },
    runArgs: ['--name=ae-repo-test-instance'],
    containerEnv: {
      AGENT_ENV_CONTAINER: 'true',
      AGENT_ENV_INSTANCE: 'test-instance',
      AGENT_ENV_REPO: 'test-repo',
      AGENT_ENV_PURPOSE: 'testing',
    },
    mounts: [],
    customizations: {
      vscode: {
        settings: {
          'betterStatusBar.configurationFile': '/etc/agent-env/statusBar.json',
          'filewatcher.commands': [
            {
              match: 'statusBar.json$',
              event: 'onFolderChange',
              vscodeTask: 'betterStatusBar.refreshButtons',
            },
          ],
        },
        extensions: [],
      },
    },
    ...overrides,
  };
}

// ─── composeName ─────────────────────────────────────────────────────────────

describe('composeName', () => {
  it('returns instanceName alone when no repo name', () => {
    expect(composeName('feature-x')).toBe('feature-x');
  });

  it('returns instanceName when repo name is undefined', () => {
    expect(composeName('feature-x', undefined)).toBe('feature-x');
  });

  it('composes repo name with instance name', () => {
    expect(composeName('feature-x', 'My Project')).toBe('My Project - feature-x');
  });

  it('returns instanceName when repo name is empty string', () => {
    expect(composeName('feature-x', '')).toBe('feature-x');
  });

  it('returns instanceName when repo name is whitespace only', () => {
    expect(composeName('feature-x', '   ')).toBe('feature-x');
  });

  it('returns instanceName when repo name is non-string', () => {
    expect(composeName('feature-x', 42)).toBe('feature-x');
  });
});

// ─── composeLifecycle ────────────────────────────────────────────────────────

describe('composeLifecycle', () => {
  it('returns managed cmd as plain string when no repo cmd', () => {
    expect(composeLifecycle('managed-cmd')).toBe('managed-cmd');
  });

  it('returns managed cmd when repo cmd is undefined', () => {
    expect(composeLifecycle('managed-cmd', undefined)).toBe('managed-cmd');
  });

  it('returns managed cmd when repo cmd is null', () => {
    expect(composeLifecycle('managed-cmd', null)).toBe('managed-cmd');
  });

  it('composes with string repo cmd', () => {
    expect(composeLifecycle('managed-cmd', 'repo-cmd')).toEqual({
      'agent-env': 'managed-cmd',
      repo: 'repo-cmd',
    });
  });

  it('composes with array repo cmd', () => {
    expect(composeLifecycle('managed-cmd', ['cmd1', 'cmd2'])).toEqual({
      'agent-env': 'managed-cmd',
      repo: ['cmd1', 'cmd2'],
    });
  });

  it('merges with object repo cmd', () => {
    expect(composeLifecycle('managed-cmd', { repo: 'repo-cmd', custom: 'custom-cmd' })).toEqual({
      'agent-env': 'managed-cmd',
      repo: 'repo-cmd',
      custom: 'custom-cmd',
    });
  });

  it('returns managed cmd when repo cmd is a number', () => {
    expect(composeLifecycle('managed-cmd', 42)).toBe('managed-cmd');
  });

  it('returns managed cmd when repo cmd is a boolean', () => {
    expect(composeLifecycle('managed-cmd', true)).toBe('managed-cmd');
  });
});

// ─── composeAllLifecycle ─────────────────────────────────────────────────────

describe('composeAllLifecycle', () => {
  it('composes postCreateCommand with LABEL value when repo defines it', () => {
    const result = composeAllLifecycle(LABEL_LIFECYCLE_CMDS, {
      postCreateCommand: 'npm install',
    });
    expect(result.postCreateCommand).toEqual({
      'agent-env': LABEL_LIFECYCLE_CMDS.postCreateCommand,
      repo: 'npm install',
    });
  });

  it('composes postStartCommand with LABEL value when repo defines it', () => {
    const result = composeAllLifecycle(LABEL_LIFECYCLE_CMDS, {
      postStartCommand: 'echo hello',
    });
    expect(result.postStartCommand).toEqual({
      'agent-env': LABEL_LIFECYCLE_CMDS.postStartCommand,
      repo: 'echo hello',
    });
  });

  it('wraps repo-only postAttachCommand (no LABEL value)', () => {
    const result = composeAllLifecycle({}, { postAttachCommand: 'echo attached' });
    expect(result.postAttachCommand).toEqual({ repo: 'echo attached' });
  });

  it('omits lifecycle commands where neither managed nor repo defines them', () => {
    const result = composeAllLifecycle(LABEL_LIFECYCLE_CMDS, {});
    expect(result).not.toHaveProperty('postCreateCommand');
    expect(result).not.toHaveProperty('postStartCommand');
    expect(result).not.toHaveProperty('postAttachCommand');
    expect(result).not.toHaveProperty('onCreateCommand');
    expect(result).not.toHaveProperty('updateContentCommand');
  });

  it('does NOT process initializeCommand', () => {
    const result = composeAllLifecycle(
      { initializeCommand: 'should-not-appear' },
      { initializeCommand: 'also-should-not-appear' }
    );
    expect(result).not.toHaveProperty('initializeCommand');
  });

  it('does NOT process waitFor', () => {
    const result = composeAllLifecycle({}, { waitFor: 'onCreateCommand' });
    expect(result).not.toHaveProperty('waitFor');
  });

  it('does not emit LABEL-only commands when repo does not define them', () => {
    const result = composeAllLifecycle(LABEL_LIFECYCLE_CMDS, {});
    // LABEL handles these natively — config should not override them
    expect(result).not.toHaveProperty('postCreateCommand');
    expect(result).not.toHaveProperty('postStartCommand');
  });
});

// ─── mergeRunArgs ────────────────────────────────────────────────────────────

describe('mergeRunArgs', () => {
  const managed = ['--name=ae-repo-instance'];

  it('returns managed args when no repo args', () => {
    expect(mergeRunArgs(managed)).toEqual(['--name=ae-repo-instance']);
  });

  it('returns managed args when repo args is undefined', () => {
    expect(mergeRunArgs(managed, undefined)).toEqual(['--name=ae-repo-instance']);
  });

  it('strips --name=value form from repo args', () => {
    expect(mergeRunArgs(managed, ['--name=old-name', '--shm-size=1gb'])).toEqual([
      '--name=ae-repo-instance',
      '--shm-size=1gb',
    ]);
  });

  it('strips --name value (space-separated) form from repo args', () => {
    expect(mergeRunArgs(managed, ['--name', 'old-name', '--shm-size=1gb'])).toEqual([
      '--name=ae-repo-instance',
      '--shm-size=1gb',
    ]);
  });

  it('handles --name as last element (boundary guard)', () => {
    expect(mergeRunArgs(managed, ['--shm-size=1gb', '--name'])).toEqual([
      '--name=ae-repo-instance',
      '--shm-size=1gb',
    ]);
  });

  it('preserves --hostname (must NOT match --name)', () => {
    expect(mergeRunArgs(managed, ['--hostname=test'])).toEqual([
      '--name=ae-repo-instance',
      '--hostname=test',
    ]);
  });

  it('concatenates other flags from repo args', () => {
    expect(mergeRunArgs(managed, ['--label=dev.orbstack.domains=test', '--shm-size=1gb'])).toEqual([
      '--name=ae-repo-instance',
      '--label=dev.orbstack.domains=test',
      '--shm-size=1gb',
    ]);
  });

  it('returns managed args when repo args is not an array', () => {
    expect(mergeRunArgs(managed, 'not-an-array')).toEqual(['--name=ae-repo-instance']);
  });
});

// ─── mergeMounts ─────────────────────────────────────────────────────────────

describe('mergeMounts', () => {
  it('returns managed mounts when no repo mounts', () => {
    const managed = ['source=a,target=/foo,type=bind'];
    expect(mergeMounts(managed)).toEqual(managed);
  });

  it('concatenates repo mounts when no target collision', () => {
    const managed = ['source=a,target=/foo,type=bind'];
    const repo = ['source=b,target=/bar,type=bind'];
    expect(mergeMounts(managed, repo)).toEqual([
      'source=a,target=/foo,type=bind',
      'source=b,target=/bar,type=bind',
    ]);
  });

  it('managed mount wins on target path collision', () => {
    const managed = ['source=managed,target=/shared,type=bind'];
    const repo = ['source=repo,target=/shared,type=volume'];
    expect(mergeMounts(managed, repo)).toEqual(['source=managed,target=/shared,type=bind']);
  });

  it('handles object-form repo mounts', () => {
    const managed: string[] = [];
    const repo = [{ source: 'b', target: '/bar', type: 'bind' }];
    expect(mergeMounts(managed, repo)).toEqual(['source=b,target=/bar,type=bind']);
  });

  it('handles object-form mounts with destination synonym', () => {
    const managed = ['source=m,target=/dest,type=bind'];
    const repo = [{ source: 'r', destination: '/dest', type: 'bind' }];
    // managed wins — same target
    expect(mergeMounts(managed, repo)).toEqual(['source=m,target=/dest,type=bind']);
  });

  it('returns managed mounts when repo mounts is not an array', () => {
    const managed = ['source=a,target=/foo,type=bind'];
    expect(mergeMounts(managed, 'not-array')).toEqual(managed);
  });

  it('handles empty managed mounts', () => {
    const repo = ['source=b,target=/bar,type=bind'];
    expect(mergeMounts([], repo)).toEqual(['source=b,target=/bar,type=bind']);
  });
});

// ─── deepMergeCustomizations ─────────────────────────────────────────────────

describe('deepMergeCustomizations', () => {
  const managedCustomizations: ManagedConfig['customizations'] = {
    vscode: {
      settings: {
        'betterStatusBar.configurationFile': '/etc/agent-env/statusBar.json',
        'filewatcher.commands': [
          {
            match: 'statusBar.json$',
            event: 'onFolderChange',
            vscodeTask: 'betterStatusBar.refreshButtons',
          },
        ],
      },
      extensions: [],
    },
  };

  it('returns managed customizations when no repo customizations', () => {
    const result = deepMergeCustomizations(managedCustomizations);
    const vscode = result.vscode as Record<string, unknown>;
    const settings = vscode.settings as Record<string, unknown>;
    expect(settings['betterStatusBar.configurationFile']).toBe('/etc/agent-env/statusBar.json');
  });

  it('deduplicates extensions (case-insensitive)', () => {
    const repo = {
      vscode: {
        extensions: ['EXT-A', 'ext-b'],
      },
    };
    const managed: ManagedConfig['customizations'] = {
      vscode: { settings: {}, extensions: ['ext-a', 'ext-c'] },
    };
    const result = deepMergeCustomizations(managed, repo);
    const vscode = result.vscode as Record<string, unknown>;
    expect(vscode.extensions).toEqual(['ext-a', 'ext-c', 'ext-b']);
  });

  it('merges settings (managed wins for managed keys)', () => {
    const repo = {
      vscode: {
        settings: {
          'betterStatusBar.configurationFile': '/custom/path',
          'editor.fontSize': 14,
        },
      },
    };
    const result = deepMergeCustomizations(managedCustomizations, repo);
    const vscode = result.vscode as Record<string, unknown>;
    const settings = vscode.settings as Record<string, unknown>;
    // Managed wins
    expect(settings['betterStatusBar.configurationFile']).toBe('/etc/agent-env/statusBar.json');
    // Repo setting preserved
    expect(settings['editor.fontSize']).toBe(14);
  });

  it('appends managed filewatcher watcher and deduplicates by match field', () => {
    const repo = {
      vscode: {
        settings: {
          'filewatcher.commands': [
            { match: 'other.json$', event: 'onChange', vscodeTask: 'some.task' },
          ],
        },
      },
    };
    const result = deepMergeCustomizations(managedCustomizations, repo);
    const vscode = result.vscode as Record<string, unknown>;
    const settings = vscode.settings as Record<string, unknown>;
    const commands = settings['filewatcher.commands'] as unknown[];
    expect(commands).toHaveLength(2); // repo + managed
  });

  it('does not duplicate managed filewatcher watcher', () => {
    const repo = {
      vscode: {
        settings: {
          'filewatcher.commands': [
            {
              match: 'statusBar.json$',
              event: 'onFolderChange',
              vscodeTask: 'betterStatusBar.refreshButtons',
            },
          ],
        },
      },
    };
    const result = deepMergeCustomizations(managedCustomizations, repo);
    const vscode = result.vscode as Record<string, unknown>;
    const settings = vscode.settings as Record<string, unknown>;
    const commands = settings['filewatcher.commands'] as unknown[];
    expect(commands).toHaveLength(1);
  });

  it('preserves non-vscode customizations', () => {
    const repo = {
      vscode: { settings: {}, extensions: [] },
      codespaces: { openFiles: ['README.md'] },
    };
    const result = deepMergeCustomizations(managedCustomizations, repo);
    expect(result.codespaces).toEqual({ openFiles: ['README.md'] });
  });
});

// ─── validateRepoConfig ──────────────────────────────────────────────────────

describe('validateRepoConfig', () => {
  it('accepts a clean config', () => {
    expect(() => validateRepoConfig({ name: 'test' }, 'ghcr.io/test/managed:latest')).not.toThrow();
  });

  it('rejects config with "build"', () => {
    expect(() =>
      validateRepoConfig({ build: { dockerfile: 'Dockerfile' } }, 'ghcr.io/test/managed:latest')
    ).toThrow(/agent-env requires the managed image.*build/);
  });

  it('rejects config with "dockerFile"', () => {
    expect(() =>
      validateRepoConfig({ dockerFile: 'Dockerfile' }, 'ghcr.io/test/managed:latest')
    ).toThrow(/agent-env requires the managed image.*dockerFile/);
  });

  it('rejects config with "dockerfile" (lowercase)', () => {
    expect(() =>
      validateRepoConfig({ dockerfile: 'Dockerfile' }, 'ghcr.io/test/managed:latest')
    ).toThrow(/agent-env requires the managed image.*dockerfile/);
  });

  it('rejects config with "dockerComposeFile"', () => {
    expect(() =>
      validateRepoConfig({ dockerComposeFile: 'docker-compose.yml' }, 'ghcr.io/test/managed:latest')
    ).toThrow(/agent-env requires the managed image.*dockerComposeFile/);
  });

  it('logs warning when repo specifies a different image', () => {
    const logger = { warn: vi.fn() };
    validateRepoConfig({ image: 'my-image:latest' }, 'ghcr.io/test/managed:latest', logger);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Repo config specifies image 'my-image:latest'")
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('overridden'));
  });

  it('does not warn when repo specifies the same image as managed', () => {
    const logger = { warn: vi.fn() };
    validateRepoConfig(
      { image: 'ghcr.io/test/managed:latest' },
      'ghcr.io/test/managed:latest',
      logger
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not warn when no image in repo config', () => {
    const logger = { warn: vi.fn() };
    validateRepoConfig({ name: 'test' }, 'ghcr.io/test/managed:latest', logger);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

// ─── readRepoConfig ──────────────────────────────────────────────────────────

describe('readRepoConfig', () => {
  it('reads config from .devcontainer/devcontainer.json', async () => {
    const dir = join(tempDir, '.devcontainer');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'devcontainer.json'), '{ "name": "test" }');

    const result = await readRepoConfig(tempDir);
    expect(result).toEqual({ name: 'test' });
  });

  it('reads config from root devcontainer.json', async () => {
    await writeFile(join(tempDir, 'devcontainer.json'), '{ "name": "root" }');

    const result = await readRepoConfig(tempDir);
    expect(result).toEqual({ name: 'root' });
  });

  it('reads config from root .devcontainer.json', async () => {
    await writeFile(join(tempDir, '.devcontainer.json'), '{ "name": "dot" }');

    const result = await readRepoConfig(tempDir);
    expect(result).toEqual({ name: 'dot' });
  });

  it('returns undefined when no config found', async () => {
    const result = await readRepoConfig(tempDir);
    expect(result).toBeUndefined();
  });

  it('returns undefined for bare .devcontainer/ dir without devcontainer.json', async () => {
    await mkdir(join(tempDir, '.devcontainer'));
    const result = await readRepoConfig(tempDir);
    expect(result).toBeUndefined();
  });

  it('handles JSONC comments in config', async () => {
    const dir = join(tempDir, '.devcontainer');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'devcontainer.json'),
      '// This is a comment\n{ "name": "test" /* inline */ }'
    );

    const result = await readRepoConfig(tempDir);
    expect(result).toEqual({ name: 'test' });
  });

  it('throws on invalid JSONC', async () => {
    const dir = join(tempDir, '.devcontainer');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'devcontainer.json'), '{ invalid json }}}');

    await expect(readRepoConfig(tempDir)).rejects.toThrow(/Invalid JSONC/);
  });

  it('skips auto-generated config (feedback loop guard)', async () => {
    const dir = join(tempDir, '.devcontainer');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'devcontainer.json'),
      '// AUTO-GENERATED by agent-env v0.5.0. Do not edit.\n{ "name": "generated" }'
    );

    const logger = { warn: vi.fn() };
    const result = await readRepoConfig(tempDir, undefined, logger);
    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping auto-generated'));
  });

  it('skips symlink pointing into .agent-env/ (stale ephemeral symlink guard)', async () => {
    // Simulate the symlink that code-instance creates: .devcontainer/devcontainer.json → ../.agent-env/devcontainer.json
    const agentEnvDir = join(tempDir, '.agent-env');
    await mkdir(agentEnvDir, { recursive: true });
    await writeFile(
      join(agentEnvDir, 'devcontainer.json'),
      '// AUTO-GENERATED by agent-env v0.5.0. Do not edit.\n{ "name": "generated" }'
    );
    const devcontainerDir = join(tempDir, '.devcontainer');
    await mkdir(devcontainerDir, { recursive: true });
    await symlink(
      join('..', '.agent-env', 'devcontainer.json'),
      join(devcontainerDir, 'devcontainer.json')
    );

    const logger = { warn: vi.fn() };
    const result = await readRepoConfig(
      tempDir,
      { readFile, access: (await import('node:fs/promises')).access, lstat, readlink },
      logger
    );
    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('symlink'));
  });

  it('prefers .devcontainer/devcontainer.json over root files', async () => {
    const dir = join(tempDir, '.devcontainer');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'devcontainer.json'), '{ "name": "preferred" }');
    await writeFile(join(tempDir, 'devcontainer.json'), '{ "name": "root" }');

    const result = await readRepoConfig(tempDir);
    expect(result).toEqual({ name: 'preferred' });
  });
});

// ─── mergeDevcontainerConfigs ────────────────────────────────────────────────

describe('mergeDevcontainerConfigs', () => {
  it('returns managed-only config when no repo config', () => {
    const managed = createManagedConfig();
    const result = mergeDevcontainerConfigs(managed);

    expect(result.image).toBe(managed.image);
    expect(result.name).toBe(managed.instanceName);
    expect(result.initializeCommand).toBe(managed.initializeCmd);
    expect(result.runArgs).toEqual(managed.runArgs);
    // Should NOT have postCreateCommand or postStartCommand
    expect(result).not.toHaveProperty('postCreateCommand');
    expect(result).not.toHaveProperty('postStartCommand');
  });

  it('merges all property types with repo config', () => {
    const managed = createManagedConfig();
    const repoConfig = {
      name: 'My Project',
      image: 'repo-image:latest',
      initializeCommand: "bash -c 'touch ~/.gitconfig'",
      runArgs: ['--name=old-name', '--shm-size=1gb'],
      containerEnv: {
        PROJECT_NAME: 'my-project',
        AGENT_ENV_CONTAINER: 'false', // should be overridden
      },
      customizations: {
        vscode: {
          extensions: ['ext-a', 'ext-b'],
          settings: { 'editor.fontSize': 14 },
        },
      },
      mounts: ['source=data,target=/data,type=volume'],
      portsAttributes: { '3000': { onAutoForward: 'notify' } },
    };

    const result = mergeDevcontainerConfigs(managed, repoConfig);

    // Managed wins for image
    expect(result.image).toBe(managed.image);
    // Name composed
    expect(result.name).toBe('My Project - test-instance');
    // initializeCommand composed
    expect(result.initializeCommand).toEqual({
      'agent-env': managed.initializeCmd,
      repo: "bash -c 'touch ~/.gitconfig'",
    });
    // runArgs: --name stripped, --shm-size preserved
    expect(result.runArgs).toEqual(['--name=ae-repo-test-instance', '--shm-size=1gb']);
    // containerEnv: managed wins for AGENT_ENV_CONTAINER
    expect(result.containerEnv.AGENT_ENV_CONTAINER).toBe('true');
    expect(result.containerEnv.PROJECT_NAME).toBe('my-project');
    // Pass-through repo properties
    expect(result.portsAttributes).toEqual({ '3000': { onAutoForward: 'notify' } });
  });

  it('preserves devcontainer variable references', () => {
    const managed = createManagedConfig();
    const repoConfig = {
      containerEnv: {
        AGENT_INSTANCE: '${localWorkspaceFolderBasename}',
      },
    };

    const result = mergeDevcontainerConfigs(managed, repoConfig);
    expect(result.containerEnv.AGENT_INSTANCE).toBe('${localWorkspaceFolderBasename}');
  });

  it('managed containerEnv keys override repo keys', () => {
    const managed = createManagedConfig();
    const repoConfig = {
      containerEnv: {
        AGENT_ENV_CONTAINER: 'false',
        AGENT_ENV_INSTANCE: 'repo-value',
      },
    };

    const result = mergeDevcontainerConfigs(managed, repoConfig);
    expect(result.containerEnv.AGENT_ENV_CONTAINER).toBe('true');
    expect(result.containerEnv.AGENT_ENV_INSTANCE).toBe('test-instance');
  });

  it('composes lifecycle commands with LABEL values', () => {
    const managed = createManagedConfig();
    const repoConfig = {
      postCreateCommand: 'npm install',
      postStartCommand: 'echo started',
    };

    const result = mergeDevcontainerConfigs(managed, repoConfig);
    expect(result.postCreateCommand).toEqual({
      'agent-env': LABEL_LIFECYCLE_CMDS.postCreateCommand,
      repo: 'npm install',
    });
    expect(result.postStartCommand).toEqual({
      'agent-env': LABEL_LIFECYCLE_CMDS.postStartCommand,
      repo: 'echo started',
    });
  });

  it('passes through unknown repo properties via repoRest', () => {
    const managed = createManagedConfig();
    const repoConfig = {
      waitFor: 'onCreateCommand',
      someNewProperty: 'value',
    };

    const result = mergeDevcontainerConfigs(managed, repoConfig);
    expect(result.waitFor).toBe('onCreateCommand');
    expect(result.someNewProperty).toBe('value');
  });
});

// ─── buildManagedOnly ────────────────────────────────────────────────────────

describe('buildManagedOnly', () => {
  it('emits initializeCommand as plain string', () => {
    const managed = createManagedConfig();
    const result = buildManagedOnly(managed);
    expect(typeof result.initializeCommand).toBe('string');
    expect(result.initializeCommand).toBe('bash .agent-env/init-host.sh');
  });

  it('omits LABEL lifecycle commands', () => {
    const managed = createManagedConfig();
    const result = buildManagedOnly(managed);
    expect(result).not.toHaveProperty('postCreateCommand');
    expect(result).not.toHaveProperty('postStartCommand');
  });

  it('includes VS Code customizations', () => {
    const managed = createManagedConfig();
    const result = buildManagedOnly(managed);
    const vscode = (result.customizations as Record<string, unknown>).vscode as Record<
      string,
      unknown
    >;
    const settings = vscode.settings as Record<string, unknown>;
    expect(settings['betterStatusBar.configurationFile']).toBe('/etc/agent-env/statusBar.json');
  });
});

// ─── loadManagedDefaults ─────────────────────────────────────────────────────

describe('loadManagedDefaults', () => {
  it('reads image and initializeCommand from baseline config', async () => {
    const result = await loadManagedDefaults();
    expect(result.image).toBe('ghcr.io/zookanalytics/bmad-orchestrator/devcontainer:latest');
    expect(result.initializeCmd).toBe('bash .agent-env/init-host.sh');
    expect(result.baseContainerEnv.AGENT_ENV_CONTAINER).toBe('true');
  });

  it('does NOT extract mounts from baseline config', async () => {
    const result = await loadManagedDefaults();
    // Result should only have the three specified fields
    expect(Object.keys(result)).toEqual(['image', 'initializeCmd', 'baseContainerEnv']);
  });

  it('throws on missing baseline file', async () => {
    const mockDeps = {
      readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    };
    await expect(loadManagedDefaults(mockDeps)).rejects.toThrow(/Failed to load managed defaults/);
  });

  it('throws on corrupt baseline file', async () => {
    const mockDeps = {
      readFile: vi.fn().mockResolvedValue('{ invalid json }}}'),
    };
    await expect(loadManagedDefaults(mockDeps)).rejects.toThrow(/Failed to load managed defaults/);
  });
});

// ─── writeGeneratedConfig ────────────────────────────────────────────────────

describe('writeGeneratedConfig', () => {
  it('writes file with auto-generated header', async () => {
    const outputPath = join(tempDir, 'devcontainer.json');
    const config = buildManagedOnly(createManagedConfig());
    const deps: Pick<DevcontainerMergeDeps, 'writeFile' | 'rename'> = {
      writeFile: async (path, content) => {
        await writeFile(path as string, content as string);
      },
      rename: async (oldPath, newPath) => {
        const { rename } = await import('node:fs/promises');
        await rename(oldPath, newPath);
      },
    };

    await writeGeneratedConfig(outputPath, config, deps);

    const content = await readFile(outputPath, 'utf-8');
    expect(content).toMatch(/^\/\/ AUTO-GENERATED by agent-env/);
  });

  it('writes parseable JSONC', async () => {
    const outputPath = join(tempDir, 'devcontainer.json');
    const config = buildManagedOnly(createManagedConfig());
    const deps: Pick<DevcontainerMergeDeps, 'writeFile' | 'rename'> = {
      writeFile: async (path, content) => {
        await writeFile(path as string, content as string);
      },
      rename: async (oldPath, newPath) => {
        const { rename } = await import('node:fs/promises');
        await rename(oldPath, newPath);
      },
    };

    await writeGeneratedConfig(outputPath, config, deps);

    const content = await readFile(outputPath, 'utf-8');
    const { parse } = await import('jsonc-parser');
    const parsed = parse(content, [], { allowTrailingComma: true });
    expect(parsed.image).toBe(config.image);
  });

  it('round-trips: write then read preserves all properties', async () => {
    const outputPath = join(tempDir, 'devcontainer.json');
    const managed = createManagedConfig();
    const repoConfig = {
      name: 'Round Trip Test',
      containerEnv: { TEST_VAR: 'value' },
      portsAttributes: { '8080': { onAutoForward: 'notify' } },
    };
    const config = mergeDevcontainerConfigs(managed, repoConfig);

    const deps: Pick<DevcontainerMergeDeps, 'writeFile' | 'rename'> = {
      writeFile: async (path, content) => {
        await writeFile(path as string, content as string);
      },
      rename: async (oldPath, newPath) => {
        const { rename } = await import('node:fs/promises');
        await rename(oldPath, newPath);
      },
    };

    await writeGeneratedConfig(outputPath, config, deps);

    const content = await readFile(outputPath, 'utf-8');
    const { parse } = await import('jsonc-parser');
    const roundTripped = parse(content, [], { allowTrailingComma: true });

    expect(roundTripped.image).toBe(config.image);
    expect(roundTripped.name).toBe(config.name);
    expect(roundTripped.containerEnv.TEST_VAR).toBe('value');
    expect(roundTripped.portsAttributes).toEqual({ '8080': { onAutoForward: 'notify' } });
  });

  it('uses atomic write (tmp + rename)', async () => {
    const outputPath = join(tempDir, 'devcontainer.json');
    const config = buildManagedOnly(createManagedConfig());

    const writtenPaths: string[] = [];
    const renamedPaths: [string, string][] = [];

    const deps: Pick<DevcontainerMergeDeps, 'writeFile' | 'rename'> = {
      writeFile: async (path, content) => {
        writtenPaths.push(path as string);
        await writeFile(path as string, content as string);
      },
      rename: async (oldPath, newPath) => {
        renamedPaths.push([oldPath as string, newPath as string]);
        const { rename } = await import('node:fs/promises');
        await rename(oldPath, newPath);
      },
    };

    await writeGeneratedConfig(outputPath, config, deps);

    // Should write to .tmp first, then rename
    expect(writtenPaths).toEqual([`${outputPath}.tmp`]);
    expect(renamedPaths).toEqual([[`${outputPath}.tmp`, outputPath]]);
  });
});

// ─── buildManagedConfig ──────────────────────────────────────────────────────

describe('buildManagedConfig', () => {
  it('builds complete ManagedConfig from defaults and params', () => {
    const defaults = {
      image: 'test:latest',
      initializeCmd: 'bash init.sh',
      baseContainerEnv: { AGENT_ENV_CONTAINER: 'true' },
    };
    const params = {
      instanceName: 'my-instance',
      containerName: 'ae-repo-my-instance',
      repoSlug: 'my-repo',
      purpose: 'testing',
    };

    const result = buildManagedConfig(defaults, params);

    expect(result.image).toBe('test:latest');
    expect(result.instanceName).toBe('my-instance');
    expect(result.containerName).toBe('ae-repo-my-instance');
    expect(result.initializeCmd).toBe('bash init.sh');
    expect(result.runArgs).toEqual(['--name=ae-repo-my-instance']);
    expect(result.containerEnv).toEqual({
      AGENT_ENV_CONTAINER: 'true',
      AGENT_ENV_INSTANCE: 'my-instance',
      AGENT_ENV_REPO: 'my-repo',
      AGENT_ENV_PURPOSE: 'testing',
    });
    expect(result.mounts).toEqual([]);
    expect(result.lifecycleCmds).toEqual(LABEL_LIFECYCLE_CMDS);
  });
});

// ─── LABEL_LIFECYCLE_CMDS sync test ──────────────────────────────────────────

describe('LABEL_LIFECYCLE_CMDS sync', () => {
  it('matches Dockerfile LABEL values', async () => {
    // Resolve relative to this file (src/lib/) → repo root is 4 levels up
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const dockerfilePath = join(thisDir, '..', '..', '..', '..', 'image', 'Dockerfile');
    const content = await readFile(dockerfilePath, 'utf-8');

    // Extract LABEL JSON from Dockerfile
    const labelMatch = content.match(/LABEL devcontainer\.metadata='(.+?)'/s);
    expect(labelMatch).toBeTruthy();

    // The LABEL content has line continuations
    const labelContent = (labelMatch ? labelMatch[1] : '').replace(/\s*\\\n\s*/g, ' ');
    const metadata = JSON.parse(labelContent) as Record<string, unknown>[];
    const labelConfig = metadata[0];

    expect(labelConfig.postCreateCommand).toBe(LABEL_LIFECYCLE_CMDS.postCreateCommand);
    expect(labelConfig.postStartCommand).toBe(LABEL_LIFECYCLE_CMDS.postStartCommand);
  });
});
