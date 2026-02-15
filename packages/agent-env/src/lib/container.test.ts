import type { ExecuteResult } from '@zookanalytics/shared';

import { describe, it, expect, vi } from 'vitest';

import {
  createContainerLifecycle,
  DEVCONTAINER_UP_TIMEOUT,
  DEVCONTAINER_UP_NO_CACHE_TIMEOUT,
  DOCKER_INFO_TIMEOUT,
  DOCKER_INSPECT_TIMEOUT,
  DOCKER_PULL_TIMEOUT,
  DOCKER_RM_TIMEOUT,
  DOCKER_STOP_TIMEOUT,
} from './container.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Create a mock executor that returns specified results */
function mockExecutor(results: Record<string, ExecuteResult>) {
  return vi
    .fn()
    .mockImplementation(async (command: string, args: string[] = []): Promise<ExecuteResult> => {
      const key = `${command} ${args.join(' ')}`.trim();

      // Match by prefix for flexible matching
      for (const [pattern, result] of Object.entries(results)) {
        if (key.startsWith(pattern) || key.includes(pattern)) {
          return result;
        }
      }

      // Default: command not found
      return { ok: false, stdout: '', stderr: `command not found: ${command}`, exitCode: 127 };
    });
}

const successResult: ExecuteResult = { ok: true, stdout: '', stderr: '', exitCode: 0 };
const failureResult: ExecuteResult = {
  ok: false,
  stdout: '',
  stderr: 'error occurred',
  exitCode: 1,
};

// ─── Docker availability detection ───────────────────────────────────────────

describe('isDockerAvailable', () => {
  it('returns true when docker info succeeds', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    const available = await lifecycle.isDockerAvailable();
    expect(available).toBe(true);
  });

  it('returns false when docker info fails', async () => {
    const executor = mockExecutor({
      'docker info': failureResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    const available = await lifecycle.isDockerAvailable();
    expect(available).toBe(false);
  });

  it('calls docker info with correct arguments', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.isDockerAvailable();
    expect(executor).toHaveBeenCalledWith(
      'docker',
      ['info'],
      expect.objectContaining({ timeout: DOCKER_INFO_TIMEOUT })
    );
  });
});

// ─── containerStatus ─────────────────────────────────────────────────────────

describe('containerStatus', () => {
  it('returns running for a running container', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: JSON.stringify([{ State: { Status: 'running' } }]),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStatus('ae-bmad-orch-auth');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.status).toBe('running');
  });

  it('returns stopped for an exited container', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: JSON.stringify([{ State: { Status: 'exited' } }]),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStatus('ae-bmad-orch-auth');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.status).toBe('stopped');
  });

  it('returns stopped for a created (not started) container', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: JSON.stringify([{ State: { Status: 'created' } }]),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStatus('ae-test');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.status).toBe('stopped');
  });

  it('returns not-found when container does not exist', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: false,
        stdout: '',
        stderr: 'Error: No such container: ae-nonexistent',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStatus('ae-nonexistent');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.status).toBe('not-found');
    expect(result.containerId).toBeNull();
  });

  it('returns CONTAINER_ERROR when docker inspect fails unexpectedly', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: false,
        stdout: '',
        stderr: 'Cannot connect to the Docker daemon',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStatus('ae-test');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error).not.toBeNull();
    expect(result.error.code).toBe('CONTAINER_ERROR');
  });

  it('extracts containerId from docker inspect output', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: JSON.stringify([{ Id: 'abc123def456', State: { Status: 'running' } }]),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStatus('ae-test');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.containerId).toBe('abc123def456');
  });

  it('calls docker inspect with correct container name and format', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: JSON.stringify([{ State: { Status: 'running' } }]),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.containerStatus('ae-my-container');
    expect(executor).toHaveBeenCalledWith(
      'docker',
      ['inspect', 'ae-my-container'],
      expect.objectContaining({ timeout: DOCKER_INSPECT_TIMEOUT })
    );
  });
});

// ─── getContainerNameById ─────────────────────────────────────────────────────

describe('getContainerNameById', () => {
  it('returns container name without leading slash', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: '/my-container-name\n',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.getContainerNameById('abc123');
    expect(name).toBe('my-container-name');
  });

  it('returns null when container not found', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: false,
        stdout: '',
        stderr: 'Error: No such container: abc123',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.getContainerNameById('abc123');
    expect(name).toBeNull();
  });

  it('returns null when docker unavailable', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: false,
        stdout: '',
        stderr: 'Cannot connect to the Docker daemon',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.getContainerNameById('abc123');
    expect(name).toBeNull();
  });

  it('handles custom container names from repo devcontainer.json', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: '/agenttools-bmad-orch\n',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.getContainerNameById('container-id-123');
    expect(name).toBe('agenttools-bmad-orch');
  });

  it('calls docker inspect with --format flag', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: '/test-name\n',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.getContainerNameById('my-container-id');
    expect(executor).toHaveBeenCalledWith(
      'docker',
      ['inspect', 'my-container-id', '--format', '{{.Name}}'],
      expect.objectContaining({ timeout: DOCKER_INSPECT_TIMEOUT })
    );
  });

  it('returns null for empty output', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.getContainerNameById('abc123');
    expect(name).toBeNull();
  });

  it('returns null for whitespace-only output', async () => {
    const executor = mockExecutor({
      'docker inspect': {
        ok: true,
        stdout: '  \n  \t  ',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.getContainerNameById('abc123');
    expect(name).toBeNull();
  });
});

// ─── findContainerByWorkspaceLabel ──────────────────────────────────────────

describe('findContainerByWorkspaceLabel', () => {
  it('returns container name when a matching container exists', async () => {
    const executor = mockExecutor({
      'docker ps': {
        ok: true,
        stdout: 'agenttools-bmad-orch-strategy\n',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.findContainerByWorkspaceLabel('/workspaces/bmad-orch-strategy');
    expect(name).toBe('agenttools-bmad-orch-strategy');
  });

  it('returns null when no matching container exists', async () => {
    const executor = mockExecutor({
      'docker ps': {
        ok: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.findContainerByWorkspaceLabel('/workspaces/bmad-orch-strategy');
    expect(name).toBeNull();
  });

  it('returns null when docker is not available', async () => {
    const executor = mockExecutor({
      'docker ps': {
        ok: false,
        stdout: '',
        stderr: 'Cannot connect to the Docker daemon',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.findContainerByWorkspaceLabel('/workspaces/test');
    expect(name).toBeNull();
  });

  it('returns only the first container name when multiple match', async () => {
    const executor = mockExecutor({
      'docker ps': {
        ok: true,
        stdout: 'container-one\ncontainer-two\n',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.findContainerByWorkspaceLabel('/workspaces/test');
    expect(name).toBe('container-one');
  });

  it('returns null for whitespace-only output', async () => {
    const executor = mockExecutor({
      'docker ps': {
        ok: true,
        stdout: '  \n  \t  ',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const name = await lifecycle.findContainerByWorkspaceLabel('/workspaces/test');
    expect(name).toBeNull();
  });

  it('calls docker ps with correct label filter', async () => {
    const executor = mockExecutor({
      'docker ps': {
        ok: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.findContainerByWorkspaceLabel('/my/workspace/path');
    expect(executor).toHaveBeenCalledWith(
      'docker',
      [
        'ps',
        '-a',
        '--filter',
        'label=devcontainer.local_folder="/my/workspace/path"',
        '--format',
        '{{.Names}}',
      ],
      expect.objectContaining({ timeout: DOCKER_INSPECT_TIMEOUT })
    );
  });

  it('handles workspace paths with special characters (commas, spaces)', async () => {
    const executor = mockExecutor({
      'docker ps': {
        ok: true,
        stdout: 'special-container\n',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const path = '/workspaces/path,with,commas and spaces';
    await lifecycle.findContainerByWorkspaceLabel(path);
    expect(executor).toHaveBeenCalledWith(
      'docker',
      [
        'ps',
        '-a',
        '--filter',
        `label=devcontainer.local_folder="${path}"`,
        '--format',
        '{{.Names}}',
      ],
      expect.objectContaining({ timeout: DOCKER_INSPECT_TIMEOUT })
    );
  });
});

// ─── devcontainerUp ──────────────────────────────────────────────────────────

describe('devcontainerUp', () => {
  it('returns success when devcontainer up succeeds', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: true,
        stdout: JSON.stringify({ outcome: 'success', containerId: 'container-123' }),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor.bind(this));

    const result = await lifecycle.devcontainerUp('/workspace/path', 'ae-test');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.status).toBe('running');
  });

  it('extracts containerId from devcontainer up JSON output', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: true,
        stdout: JSON.stringify({ outcome: 'success', containerId: 'abc-container-id' }),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.devcontainerUp('/workspace/path', 'ae-test');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.containerId).toBe('abc-container-id');
  });

  it('returns ORBSTACK_REQUIRED when Docker is not available', async () => {
    const executor = mockExecutor({
      'docker info': failureResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.devcontainerUp('/workspace/path', 'ae-test');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error).not.toBeNull();
    expect(result.error.code).toBe('ORBSTACK_REQUIRED');
    expect(result.error.suggestion).toBeDefined();
  });

  it('returns CONTAINER_ERROR when devcontainer up fails', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: false,
        stdout: '',
        stderr: 'Failed to build container image',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.devcontainerUp('/workspace/path', 'ae-test');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error).not.toBeNull();
    expect(result.error.code).toBe('CONTAINER_ERROR');
    expect(result.error.message).toContain('Failed to build container image');
  });

  it('extracts error details from stdout JSON when stderr is empty', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: false,
        stdout: JSON.stringify({
          outcome: 'error',
          message: 'Dockerfile build failed: COPY missing',
        }),
        stderr: '',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.devcontainerUp('/workspace/path', 'ae-test');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain('Dockerfile build failed: COPY missing');
  });

  it('extracts error from stdout JSON when log lines precede JSON', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: false,
        stdout:
          'Building image...\nPulling layers...\n' +
          JSON.stringify({ outcome: 'error', message: 'Build failed' }),
        stderr: '',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.devcontainerUp('/workspace/path', 'ae-test');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain('Build failed');
  });

  it('passes workspace-folder argument to devcontainer CLI', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: true,
        stdout: JSON.stringify({ outcome: 'success', containerId: 'x' }),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.devcontainerUp('/my/workspace', 'ae-my-ws');
    expect(executor).toHaveBeenCalledWith(
      'devcontainer',
      expect.arrayContaining(['up', '--workspace-folder', '/my/workspace']),
      expect.objectContaining({ timeout: DEVCONTAINER_UP_TIMEOUT })
    );
  });

  it('handles non-JSON stdout from devcontainer up gracefully', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: true,
        stdout: 'Not JSON output\nSome other logs',
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.devcontainerUp('/workspace/path', 'ae-test');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected success');
    expect(result.status).toBe('running');
    expect(result.containerId).toBeNull();
  });

  it('preserves original error message in CONTAINER_ERROR', async () => {
    const errorMsg = 'Error: docker buildx build failed with exit status 1';
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: false,
        stdout: '',
        stderr: errorMsg,
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.devcontainerUp('/workspace/path', 'ae-test');
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.message).toContain(errorMsg);
  });

  it('uses timeout for devcontainer up operation', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: true,
        stdout: JSON.stringify({ outcome: 'success', containerId: 'x' }),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.devcontainerUp('/workspace/path', 'ae-test');

    // Find the devcontainer call
    const devcontainerCall = executor.mock.calls.find(
      (call: unknown[]) => call[0] === 'devcontainer'
    );
    expect(devcontainerCall).toBeDefined();
    if (devcontainerCall) {
      expect(devcontainerCall[2]).toHaveProperty('timeout', DEVCONTAINER_UP_TIMEOUT);
    }
  });
});

// ─── containerStop ──────────────────────────────────────────────────────────

describe('containerStop', () => {
  it('returns success when docker stop succeeds', async () => {
    const executor = mockExecutor({
      'docker stop': successResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStop('ae-test');
    expect(result.ok).toBe(true);
  });

  it('calls docker stop with correct container name', async () => {
    const executor = mockExecutor({
      'docker stop': successResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.containerStop('ae-bmad-orch-auth');
    expect(executor).toHaveBeenCalledWith(
      'docker',
      ['stop', 'ae-bmad-orch-auth'],
      expect.objectContaining({ timeout: DOCKER_STOP_TIMEOUT })
    );
  });

  it('returns success when container is not found (already removed)', async () => {
    const executor = mockExecutor({
      'docker stop': {
        ok: false,
        stdout: '',
        stderr: 'Error: No such container: ae-test',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStop('ae-test');
    expect(result.ok).toBe(true);
  });

  it('returns success when container is not running', async () => {
    const executor = mockExecutor({
      'docker stop': {
        ok: false,
        stdout: '',
        stderr: 'Container ae-test is not running',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStop('ae-test');
    expect(result.ok).toBe(true);
  });

  it('returns CONTAINER_STOP_TIMEOUT when stop fails unexpectedly', async () => {
    const executor = mockExecutor({
      'docker stop': {
        ok: false,
        stdout: '',
        stderr: 'Cannot connect to the Docker daemon',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerStop('ae-test');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_STOP_TIMEOUT');
    expect(result.error.suggestion).toContain('docker rm -f');
  });
});

// ─── dockerPull ──────────────────────────────────────────────────────────

describe('dockerPull', () => {
  it('returns success when docker pull succeeds', async () => {
    const executor = mockExecutor({
      'docker pull': successResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.dockerPull('node:22-bookworm-slim');
    expect(result.ok).toBe(true);
  });

  it('calls docker pull with image name and correct timeout', async () => {
    const executor = mockExecutor({
      'docker pull': successResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.dockerPull('node:22-bookworm-slim');
    expect(executor).toHaveBeenCalledWith(
      'docker',
      ['pull', 'node:22-bookworm-slim'],
      expect.objectContaining({ timeout: DOCKER_PULL_TIMEOUT })
    );
  });

  it('returns IMAGE_PULL_FAILED error with suggestion on failure', async () => {
    const executor = mockExecutor({
      'docker pull': {
        ok: false,
        stdout: '',
        stderr: 'Error: pull access denied',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.dockerPull('private-registry.io/image:latest');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('IMAGE_PULL_FAILED');
    expect(result.error.message).toContain('private-registry.io/image:latest');
    expect(result.error.suggestion).toContain('--no-pull');
  });
});

// ─── devcontainerUp build options ───────────────────────────────────────

describe('devcontainerUp build options', () => {
  it('passes --build-no-cache when buildNoCache is true', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: true,
        stdout: JSON.stringify({ outcome: 'success', containerId: 'x' }),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.devcontainerUp('/workspace', 'ae-test', { buildNoCache: true });
    expect(executor).toHaveBeenCalledWith(
      'devcontainer',
      expect.arrayContaining(['up', '--workspace-folder', '/workspace', '--build-no-cache']),
      expect.objectContaining({ timeout: DEVCONTAINER_UP_NO_CACHE_TIMEOUT })
    );
  });

  it('does not pass --build-no-cache when option omitted', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: true,
        stdout: JSON.stringify({ outcome: 'success', containerId: 'x' }),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.devcontainerUp('/workspace', 'ae-test');
    const devcontainerCall = executor.mock.calls.find(
      (call: unknown[]) => call[0] === 'devcontainer'
    );
    expect(devcontainerCall).toBeDefined();
    expect((devcontainerCall as unknown[])[1]).not.toContain('--build-no-cache');
  });

  it('does not pass --build-no-cache when buildNoCache is false', async () => {
    const executor = mockExecutor({
      'docker info': successResult,
      'devcontainer up': {
        ok: true,
        stdout: JSON.stringify({ outcome: 'success', containerId: 'x' }),
        stderr: '',
        exitCode: 0,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.devcontainerUp('/workspace', 'ae-test', { buildNoCache: false });
    const devcontainerCall = executor.mock.calls.find(
      (call: unknown[]) => call[0] === 'devcontainer'
    );
    expect(devcontainerCall).toBeDefined();
    expect((devcontainerCall as unknown[])[1]).not.toContain('--build-no-cache');
  });
});

// ─── containerRemove ────────────────────────────────────────────────────────

describe('containerRemove', () => {
  it('returns success when docker rm succeeds', async () => {
    const executor = mockExecutor({
      'docker rm': successResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerRemove('ae-test');
    expect(result.ok).toBe(true);
  });

  it('calls docker rm with correct container name', async () => {
    const executor = mockExecutor({
      'docker rm': successResult,
    });
    const lifecycle = createContainerLifecycle(executor);

    await lifecycle.containerRemove('ae-bmad-orch-auth');
    expect(executor).toHaveBeenCalledWith(
      'docker',
      ['rm', 'ae-bmad-orch-auth'],
      expect.objectContaining({ timeout: DOCKER_RM_TIMEOUT })
    );
  });

  it('returns success when container not found (already cleaned up)', async () => {
    const executor = mockExecutor({
      'docker rm': {
        ok: false,
        stdout: '',
        stderr: 'Error: No such container: ae-test',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerRemove('ae-test');
    expect(result.ok).toBe(true);
  });

  it('returns CONTAINER_ERROR when rm fails unexpectedly', async () => {
    const executor = mockExecutor({
      'docker rm': {
        ok: false,
        stdout: '',
        stderr: 'Cannot connect to the Docker daemon',
        exitCode: 1,
      },
    });
    const lifecycle = createContainerLifecycle(executor);

    const result = await lifecycle.containerRemove('ae-test');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected failure');
    expect(result.error.code).toBe('CONTAINER_ERROR');
  });
});
