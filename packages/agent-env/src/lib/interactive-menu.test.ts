import { describe, it, expect, vi } from 'vitest';

import type { AttachResult, AttachInstanceDeps } from './attach-instance.js';
import type { InteractiveMenuDeps } from './interactive-menu.js';
import type { ListResult, Instance } from './list-instances.js';

import { launchInteractiveMenu } from './interactive-menu.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    name: 'test-instance',
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
    createAttachDeps: vi.fn().mockReturnValue({} as AttachInstanceDeps),
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

  describe('instance selection (AC: #1, #3)', () => {
    it('calls attachInstance with selected instance name', async () => {
      const instances = [makeInstance({ name: 'alpha' }), makeInstance({ name: 'beta' })];

      // Mock renderMenu to immediately call onSelect with 'alpha'
      const renderMenu = vi
        .fn()
        .mockImplementation((_instances: Instance[], onSelect: (name: string) => void) => {
          // Simulate user selecting 'alpha'
          setTimeout(() => onSelect('alpha'), 0);
          return { waitUntilExit: () => new Promise(() => {}) };
        });

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

    it('returns attach error when attach fails', async () => {
      const instances = [makeInstance({ name: 'alpha' })];

      const renderMenu = vi
        .fn()
        .mockImplementation((_instances: Instance[], onSelect: (name: string) => void) => {
          setTimeout(() => onSelect('alpha'), 0);
          return { waitUntilExit: () => new Promise(() => {}) };
        });

      const attachInstance = vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'CONTAINER_ERROR', message: 'Failed to start' },
      });

      const deps = createMockDeps({
        listInstances: vi.fn().mockResolvedValue(makeListSuccess(instances)),
        renderMenu,
        attachInstance,
      });

      const result = await launchInteractiveMenu(deps);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONTAINER_ERROR');
      }
    });
  });

  describe('user exit without selection', () => {
    it('returns empty action when user exits menu', async () => {
      const instances = [makeInstance({ name: 'alpha' })];

      // Mock renderMenu where waitUntilExit resolves (user pressed Ctrl+C)
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
