import { describe, it, expect, vi } from 'vitest';

import type { MenuAction, InteractiveMenuDeps, InstancePickerDeps } from './interactive-menu.js';
import type { InstanceInfo, Instance, ListResult } from './list-instances.js';

// Replace restartMenu with a no-op that records its call so tests can verify
// the action loop invokes it and then cleanly exits via the next 'exit' action.
const restartMenuMock = vi.fn();
vi.mock('./version-drift.js', async () => {
  const actual = await vi.importActual<typeof import('./version-drift.js')>('./version-drift.js');
  return {
    ...actual,
    restartMenu: (...args: unknown[]) => {
      restartMenuMock(...args);
      // Returns normally in tests (production calls process.exit).
    },
  };
});

import { launchActionLoop, launchInstancePicker } from './interactive-menu.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeInstanceInfo(overrides: Partial<InstanceInfo> = {}): InstanceInfo {
  return {
    name: 'test-instance',
    repoSlug: 'repo',
    purpose: null,
    status: 'running',
    ...overrides,
  };
}

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    name: 'test-instance',
    repoSlug: 'repo',
    repoUrl: 'https://github.com/user/repo.git',
    status: 'running',
    lastAttached: '2026-02-03T10:00:00.000Z',
    purpose: null,
    gitState: null,
    sshConnection: null,
    ...overrides,
  };
}

function makeListSuccess(instances: Instance[] = []): ListResult {
  return { ok: true, instances, dockerAvailable: true };
}

function makeListError(): ListResult {
  return {
    ok: false,
    instances: null,
    dockerAvailable: null,
    error: { code: 'LIST_ERROR', message: 'Failed to list' },
  };
}

type ActionSequence = Array<{ action: MenuAction; purposeValue?: string }>;

function createMockDeps(
  actionSequence: ActionSequence,
  overrides: Partial<InteractiveMenuDeps> = {}
): InteractiveMenuDeps {
  let callIndex = 0;
  return {
    attachInstance: vi.fn().mockResolvedValue({ ok: true }),
    codeInstance: vi.fn().mockResolvedValue({ ok: true }),
    rebuildInstance: vi.fn().mockResolvedValue({ ok: true, containerName: 'ae-test' }),
    shutdownInstance: vi.fn().mockResolvedValue({ ok: true }),
    setPurpose: vi.fn().mockResolvedValue({ ok: true }),
    checkForUpdates: vi.fn().mockResolvedValue({ ok: true }),
    getInstanceInfo: vi.fn().mockResolvedValue(makeInstanceInfo()),
    renderMenu: vi.fn().mockImplementation(() => {
      const result = actionSequence[callIndex] ?? { action: 'exit' as MenuAction };
      callIndex++;
      return Promise.resolve(result);
    }),
    ...overrides,
  };
}

// ─── Tests: launchActionLoop ─────────────────────────────────────────────────

describe('launchActionLoop', () => {
  it('calls getInstanceInfo then renderMenu on each iteration', async () => {
    const deps = createMockDeps([{ action: 'attach' }, { action: 'exit' }]);

    await launchActionLoop('my-ws', deps);

    expect(deps.getInstanceInfo).toHaveBeenCalledTimes(2);
    expect(deps.renderMenu).toHaveBeenCalledTimes(2);
  });

  it('passes instanceInfo from getInstanceInfo to renderMenu', async () => {
    const info = makeInstanceInfo({ name: 'alpha', status: 'stopped' });
    const deps = createMockDeps([{ action: 'exit' }], {
      getInstanceInfo: vi.fn().mockResolvedValue(info),
    });

    await launchActionLoop('alpha', deps);

    expect(deps.renderMenu).toHaveBeenCalledWith(info);
  });

  it('calls attachInstance when attach action is selected', async () => {
    const deps = createMockDeps([{ action: 'attach' }, { action: 'exit' }]);

    await launchActionLoop('alpha', deps, 'my-repo');

    expect(deps.attachInstance).toHaveBeenCalledWith('alpha', 'my-repo');
  });

  it('calls codeInstance when code action is selected', async () => {
    const deps = createMockDeps([{ action: 'code' }, { action: 'exit' }]);

    await launchActionLoop('alpha', deps, 'my-repo');

    expect(deps.codeInstance).toHaveBeenCalledWith('alpha', 'my-repo');
  });

  it('calls rebuildInstance when rebuild action is selected', async () => {
    const deps = createMockDeps([{ action: 'rebuild' }, { action: 'exit' }]);

    await launchActionLoop('alpha', deps, 'my-repo');

    expect(deps.rebuildInstance).toHaveBeenCalledWith('alpha', 'my-repo');
  });

  it('calls setPurpose with purposeValue when set-purpose action is selected', async () => {
    const deps = createMockDeps([
      { action: 'set-purpose', purposeValue: 'testing auth flows' },
      { action: 'exit' },
    ]);

    await launchActionLoop('alpha', deps, 'my-repo');

    expect(deps.setPurpose).toHaveBeenCalledWith('alpha', 'testing auth flows', 'my-repo');
  });

  it('calls checkForUpdates when check-updates action is selected', async () => {
    const deps = createMockDeps([{ action: 'check-updates' }, { action: 'exit' }]);

    await launchActionLoop('alpha', deps, 'my-repo');

    expect(deps.checkForUpdates).toHaveBeenCalledTimes(1);
    // None of the other action deps should have fired.
    expect(deps.attachInstance).not.toHaveBeenCalled();
    expect(deps.rebuildInstance).not.toHaveBeenCalled();
  });

  it('invokes restartMenu and does not run other action deps when restart is selected', async () => {
    restartMenuMock.mockClear();
    const deps = createMockDeps([{ action: 'restart' }, { action: 'exit' }]);

    await launchActionLoop('alpha', deps, 'my-repo');

    expect(restartMenuMock).toHaveBeenCalledTimes(1);
    expect(restartMenuMock).toHaveBeenCalledWith({
      workspaceName: 'alpha',
      repoSlug: 'my-repo',
    });
    // None of the non-restart action handlers should have fired.
    expect(deps.attachInstance).not.toHaveBeenCalled();
    expect(deps.codeInstance).not.toHaveBeenCalled();
    expect(deps.rebuildInstance).not.toHaveBeenCalled();
    expect(deps.setPurpose).not.toHaveBeenCalled();
    expect(deps.shutdownInstance).not.toHaveBeenCalled();
  });

  it('breaks loop on exit action', async () => {
    const deps = createMockDeps([{ action: 'exit' }]);

    await launchActionLoop('alpha', deps);

    expect(deps.getInstanceInfo).toHaveBeenCalledTimes(1);
    expect(deps.renderMenu).toHaveBeenCalledTimes(1);
    // No action dep should be called
    expect(deps.attachInstance).not.toHaveBeenCalled();
    expect(deps.rebuildInstance).not.toHaveBeenCalled();
    expect(deps.codeInstance).not.toHaveBeenCalled();
    expect(deps.setPurpose).not.toHaveBeenCalled();
  });

  it('re-reads instance state between iterations', async () => {
    const info1 = makeInstanceInfo({ name: 'alpha', status: 'stopped' });
    const info2 = makeInstanceInfo({ name: 'alpha', status: 'running' });
    let callCount = 0;
    const getInstanceInfo = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? info1 : info2);
    });

    const deps = createMockDeps([{ action: 'attach' }, { action: 'exit' }], {
      getInstanceInfo,
    });

    await launchActionLoop('alpha', deps);

    expect(getInstanceInfo).toHaveBeenCalledTimes(2);
    expect(deps.renderMenu).toHaveBeenNthCalledWith(1, info1);
    expect(deps.renderMenu).toHaveBeenNthCalledWith(2, info2);
  });

  it('continues loop after action error, prints formatted error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const deps = createMockDeps([{ action: 'attach' }, { action: 'exit' }], {
      attachInstance: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'ATTACH_FAILED', message: 'Container not running', suggestion: 'Start it' },
      }),
    });

    await launchActionLoop('alpha', deps);

    // Loop continued: renderMenu called twice (once for attach, once for exit)
    expect(deps.renderMenu).toHaveBeenCalledTimes(2);

    // Error was printed
    expect(consoleSpy).toHaveBeenCalled();
    const errorOutput = String(consoleSpy.mock.calls[0]?.[0] ?? '');
    expect(errorOutput).toContain('ATTACH_FAILED');
    expect(errorOutput).toContain('Container not running');

    consoleSpy.mockRestore();
  });

  it('handles action throwing an exception — prints error and continues', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const deps = createMockDeps([{ action: 'rebuild' }, { action: 'exit' }], {
      rebuildInstance: vi.fn().mockRejectedValue(new Error('Docker daemon not responding')),
    });

    await launchActionLoop('alpha', deps);

    expect(deps.renderMenu).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalled();
    const errorOutput = String(consoleSpy.mock.calls[0]?.[0] ?? '');
    expect(errorOutput).toContain('Docker daemon not responding');

    consoleSpy.mockRestore();
  });

  it('handles getInstanceInfo throwing — prints error and continues loop', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let callCount = 0;
    const getInstanceInfo = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Workspace path not found'));
      }
      return Promise.resolve(makeInstanceInfo());
    });

    const deps = createMockDeps([{ action: 'exit' }], { getInstanceInfo });

    await launchActionLoop('alpha', deps);

    // Loop continued: getInstanceInfo called twice (first throws, second succeeds for exit)
    expect(getInstanceInfo).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalled();
    const errorOutput = String(consoleSpy.mock.calls[0]?.[0] ?? '');
    expect(errorOutput).toContain('Workspace path not found');

    consoleSpy.mockRestore();
  });

  it('passes workspaceName to getInstanceInfo', async () => {
    const deps = createMockDeps([{ action: 'exit' }]);

    await launchActionLoop('my-workspace', deps);

    expect(deps.getInstanceInfo).toHaveBeenCalledWith('my-workspace');
  });

  it('works without repoSlug (optional parameter)', async () => {
    const deps = createMockDeps([{ action: 'attach' }, { action: 'exit' }]);

    await launchActionLoop('alpha', deps);

    expect(deps.attachInstance).toHaveBeenCalledWith('alpha', undefined);
  });
});

// ─── Tests: launchInstancePicker ─────────────────────────────────────────────

describe('launchInstancePicker', () => {
  it('returns selected result with workspace name', async () => {
    const instances = [makeInstance({ name: 'alpha' }), makeInstance({ name: 'beta' })];
    const deps: InstancePickerDeps = {
      listInstances: vi.fn().mockResolvedValue(makeListSuccess(instances)),
      renderPicker: vi.fn().mockResolvedValue('alpha'),
    };

    const result = await launchInstancePicker(deps);

    expect(result).toEqual({ kind: 'selected', name: 'alpha' });
    expect(deps.renderPicker).toHaveBeenCalledWith(instances);
  });

  it('returns cancelled when user exits picker', async () => {
    const instances = [makeInstance({ name: 'alpha' })];
    const deps: InstancePickerDeps = {
      listInstances: vi.fn().mockResolvedValue(makeListSuccess(instances)),
      renderPicker: vi.fn().mockResolvedValue(null),
    };

    const result = await launchInstancePicker(deps);

    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('returns cancelled when no instances exist', async () => {
    const deps: InstancePickerDeps = {
      listInstances: vi.fn().mockResolvedValue(makeListSuccess([])),
      renderPicker: vi.fn().mockResolvedValue(null),
    };

    const result = await launchInstancePicker(deps);

    expect(result).toEqual({ kind: 'cancelled' });
    expect(deps.renderPicker).toHaveBeenCalledWith([]);
  });

  it('returns error when listInstances fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps: InstancePickerDeps = {
      listInstances: vi.fn().mockResolvedValue(makeListError()),
      renderPicker: vi.fn(),
    };

    const result = await launchInstancePicker(deps);

    expect(result).toEqual({ kind: 'error' });
    expect(deps.renderPicker).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
