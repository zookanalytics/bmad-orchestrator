import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { InstanceInfo } from '../lib/list-instances.js';
import type { VersionDriftState } from '../lib/version-drift.js';

import { MenuContainer } from './MenuContainer.js';

function makeInstanceInfo(overrides: Partial<InstanceInfo> = {}): InstanceInfo {
  return {
    name: 'repo-test',
    repoSlug: 'my-repo',
    purpose: null,
    status: 'running',
    ...overrides,
  };
}

function neutralState(): VersionDriftState {
  return {
    packageMoved: false,
    updateMessage: null,
    installedVersion: null,
    currentVersion: '0.0.0',
    imageDrift: null,
  };
}

async function waitFor(condition: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

describe('MenuContainer', () => {
  it('passes instanceInfo.name (workspace name) to detectDriftStateFn (F5)', async () => {
    const info = makeInstanceInfo({ name: 'repo-test' });
    const detectDriftStateFn = vi.fn().mockResolvedValue(neutralState());
    render(
      <MenuContainer
        instanceInfo={info}
        onAction={vi.fn()}
        onSetPurpose={vi.fn()}
        detectDriftStateFn={detectDriftStateFn}
        pollIntervalMs={100_000}
      />
    );
    await waitFor(() => detectDriftStateFn.mock.calls.length > 0);
    expect(detectDriftStateFn).toHaveBeenCalledWith('repo-test');
  });

  it('updates the rendered drift banner when the probe returns drift', async () => {
    const info = makeInstanceInfo({ name: 'repo-test' });
    const driftState: VersionDriftState = {
      ...neutralState(),
      imageDrift: {
        configuredImage: 'ghcr.io/zookanalytics/bmad-orchestrator/devcontainer' + ':' + '1.0.0',
        expectedImage: 'ghcr.io/zookanalytics/bmad-orchestrator/devcontainer' + ':' + '1.2.0',
      },
    };
    const detectDriftStateFn = vi.fn().mockResolvedValue(driftState);
    const { lastFrame } = render(
      <MenuContainer
        instanceInfo={info}
        onAction={vi.fn()}
        onSetPurpose={vi.fn()}
        detectDriftStateFn={detectDriftStateFn}
        pollIntervalMs={100_000}
      />
    );
    await waitFor(() => (lastFrame() ?? '').includes('Container image will refresh'));
    const output = lastFrame() ?? '';
    expect(output).toContain('Rebuild container (image v1.2.0 available)');
  });
});
