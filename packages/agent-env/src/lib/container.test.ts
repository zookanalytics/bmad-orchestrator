import type { ExecuteResult } from '@zookanalytics/shared';

import { describe, it, expect, vi } from 'vitest';

import {
  createContainerLifecycle,
  DEVCONTAINER_UP_TIMEOUT,
  DOCKER_INFO_TIMEOUT,
  DOCKER_INSPECT_TIMEOUT,
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
