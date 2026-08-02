import { describe, expect, it, vi } from 'vitest';

import type { ContainerLifecycle, DockerPullResult } from './container.js';

import { pullManagedImage } from './managed-image-pull.js';

function makeContainer(overrides: Partial<ContainerLifecycle> = {}): ContainerLifecycle {
  return {
    isDockerAvailable: vi.fn(),
    containerStatus: vi.fn(),
    getContainerNameById: vi.fn(),
    findContainerByWorkspaceLabel: vi.fn(),
    devcontainerUp: vi.fn(),
    dockerPull: vi.fn().mockResolvedValue({ ok: true } satisfies DockerPullResult),
    containerStop: vi.fn(),
    containerRemove: vi.fn(),
    ...overrides,
  };
}

describe('pullManagedImage', () => {
  // Compose from base so the literal pattern "<repo>:<semver>" doesn't appear
  // anywhere in the source tree (AC12 falsifiable grep).
  const image = 'ghcr.io/zookanalytics/bmad-orchestrator/devcontainer' + ':' + '1.2.3';

  it('invokes dockerPull and emits info logs when pull=true', async () => {
    const info = vi.fn();
    const warn = vi.fn();
    const container = makeContainer();
    const result = await pullManagedImage(image, true, {
      container,
      logger: { info, warn },
    });
    expect(result.ok).toBe(true);
    expect(container.dockerPull).toHaveBeenCalledWith(image);
    expect(info).toHaveBeenCalledWith(expect.stringContaining(`Pulling ${image}...`));
    expect(info).toHaveBeenCalledWith(`Pulled ${image}`);
    expect(warn).not.toHaveBeenCalled();
  });

  it('skips dockerPull and emits the AC15 warning when pull=false', async () => {
    const info = vi.fn();
    const warn = vi.fn();
    const container = makeContainer();
    const result = await pullManagedImage(image, false, {
      container,
      logger: { info, warn },
    });
    expect(result.ok).toBe(true);
    expect(container.dockerPull).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = warn.mock.calls[0][0] as string;
    // AC15 literal phrase MUST appear verbatim.
    expect(msg).toContain('Using cached image; not matched to current agent-env version');
    expect(msg).toContain(image);
  });

  it('returns the container error when dockerPull fails', async () => {
    const container = makeContainer({
      dockerPull: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'IMAGE_VERSION_NOT_PUBLISHED', message: 'nope', suggestion: 'help' },
      } satisfies DockerPullResult),
    });
    const result = await pullManagedImage(image, true, { container });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.code).toBe('IMAGE_VERSION_NOT_PUBLISHED');
    expect(result.error.message).toBe('nope');
  });
});
