import { describe, it, expect, vi } from 'vitest';

import type { InstanceAction } from '../components/InteractiveMenu.js';
import type { AttachResult, AttachInstanceDeps } from './attach-instance.js';
import type { InteractiveMenuDeps } from './interactive-menu.js';
import type { ListResult, Instance } from './list-instances.js';
import type { RebuildResult, RebuildInstanceDeps, RebuildOptions } from './rebuild-instance.js';
import type { RemoveResult, RemoveInstanceDeps } from './remove-instance.js';

import { launchInteractiveMenu } from './interactive-menu.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    name: 'test-instance',
    repoSlug: 'repo',
    repoUrl: 'https://github.com/user/repo.git',
    status: 'running',
    lastAttached: '2026-02-03T10:00:00.000Z',
    purpose: null,
    gitState: {
      ok: true,
      state: {
        hasStaged: false,
        stagedCount: 0,
        hasUnstaged: false,
        unstagedCount: 0,
        hasUntracked: false,
        untrackedCount: 0,
        stashCount: 0,
        firstStashMessage: '',
        unpushedBranches: [],
        unpushedCommitCounts: {},
        neverPushedBranches: [],
        isDetachedHead: false,
        isClean: true,
      },
    },
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

function createMockDeps(overrides: Partial<InteractiveMenuDeps> = {}): InteractiveMenuDeps {
  return {
    listInstances: vi.fn<() => Promise<ListResult>>().mockResolvedValue(makeListSuccess()),
    attachInstance: vi
      .fn<(name: string, deps: AttachInstanceDeps) => Promise<AttachResult>>()
      .mockResolvedValue({ ok: true }),
    rebuildInstance: vi
      .fn<
        (
          name: string,
          deps: RebuildInstanceDeps,
          options?: RebuildOptions
        ) => Promise<RebuildResult>
      >()
      .mockResolvedValue({ ok: true, containerName: 'ae-test', wasRunning: false }),
    removeInstance: vi
      .fn<(name: string, deps: RemoveInstanceDeps) => Promise<RemoveResult>>()
      .mockResolvedValue({ ok: true }),
    createAttachDeps: vi.fn().mockReturnValue({} as AttachInstanceDeps),
    createRebuildDeps: vi.fn().mockReturnValue({} as RebuildInstanceDeps),
    createRemoveDeps: vi.fn().mockReturnValue({} as RemoveInstanceDeps),
    renderMenu: vi.fn().mockReturnValue({ waitUntilExit: () => new Promise(() => {}) }),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('launchInteractiveMenu', () => {
  describe('list failure', () => {
    it('returns error when listInstances fails', async () => {
      const deps = createMockDeps({
        listInstances: vi.fn().mockResolvedValue(makeListError()),
      });

      const result = await launchInteractiveMenu(deps);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('LIST_ERROR');
      }
    });
  });

  describe('empty instances (AC: #6)', () => {
    it('returns empty action when no instances', async () => {
      const deps = createMockDeps({
        listInstances: vi.fn().mockResolvedValue(makeListSuccess([])),
      });

      const result = await launchInteractiveMenu(deps);

      expect(result).toEqual({ ok: true, action: 'empty' });
      expect(deps.renderMenu).toHaveBeenCalledWith([], expect.any(Function));
    });
  });

  describe('action selection', () => {
    it('calls attachInstance when attach action is selected', async () => {
      const instances = [makeInstance({ name: 'alpha' })];

      const renderMenu = vi
        .fn()
        .mockImplementation(
          (_instances: Instance[], onAction: (action: InstanceAction, name: string) => void) => {
            setTimeout(() => onAction('attach', 'alpha'), 0);
            return { waitUntilExit: () => new Promise(() => {}) };
          }
        );

      const attachInstance = vi.fn().mockResolvedValue({ ok: true });

      const deps = createMockDeps({
        listInstances: vi.fn().mockResolvedValue(makeListSuccess(instances)),
        renderMenu,
        attachInstance,
      });

      const result = await launchInteractiveMenu(deps);

      expect(result).toEqual({ ok: true, action: 'attached', instanceName: 'alpha' });
      expect(attachInstance).toHaveBeenCalledWith('alpha', expect.anything());
    });

    it('calls rebuildInstance when rebuild action is selected', async () => {
      const instances = [makeInstance({ name: 'alpha' })];

      const renderMenu = vi
        .fn()
        .mockImplementation(
          (_instances: Instance[], onAction: (action: InstanceAction, name: string) => void) => {
            setTimeout(() => onAction('rebuild', 'alpha'), 0);
            return { waitUntilExit: () => new Promise(() => {}) };
          }
        );

      const rebuildInstance = vi.fn().mockResolvedValue({
        ok: true,
        containerName: 'ae-alpha',
        wasRunning: false,
      });

      const deps = createMockDeps({
        listInstances: vi.fn().mockResolvedValue(makeListSuccess(instances)),
        renderMenu,
        rebuildInstance,
      });

      const result = await launchInteractiveMenu(deps);

      expect(result).toEqual({ ok: true, action: 'rebuilt', instanceName: 'alpha' });
      expect(rebuildInstance).toHaveBeenCalledWith('alpha', expect.anything(), { force: true });
    });

    it('calls removeInstance when remove action is selected', async () => {
      const instances = [makeInstance({ name: 'alpha' })];

      const renderMenu = vi
        .fn()
        .mockImplementation(
          (_instances: Instance[], onAction: (action: InstanceAction, name: string) => void) => {
            setTimeout(() => onAction('remove', 'alpha'), 0);
            return { waitUntilExit: () => new Promise(() => {}) };
          }
        );

      const removeInstance = vi.fn().mockResolvedValue({ ok: true });

      const deps = createMockDeps({
        listInstances: vi.fn().mockResolvedValue(makeListSuccess(instances)),
        renderMenu,
        removeInstance,
      });

      const result = await launchInteractiveMenu(deps);

      expect(result).toEqual({ ok: true, action: 'removed', instanceName: 'alpha' });
      expect(removeInstance).toHaveBeenCalledWith('alpha', expect.anything(), false);
    });
  });

  describe('user exit without selection', () => {
    it('returns empty action when user exits menu', async () => {
      const instances = [makeInstance({ name: 'alpha' })];

      const renderMenu = vi.fn().mockImplementation(() => ({
        waitUntilExit: () => Promise.resolve(),
      }));

      const deps = createMockDeps({
        listInstances: vi.fn().mockResolvedValue(makeListSuccess(instances)),
        renderMenu,
      });

      const result = await launchInteractiveMenu(deps);

      expect(result).toEqual({ ok: true, action: 'empty' });
      expect(deps.attachInstance).not.toHaveBeenCalled();
    });
  });
});
