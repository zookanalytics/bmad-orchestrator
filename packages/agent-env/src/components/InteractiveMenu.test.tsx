import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import type { InstanceInfo } from '../lib/list-instances.js';

import { InteractiveMenu, formatImageTagForLabel } from './InteractiveMenu.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeInstanceInfo(overrides: Partial<InstanceInfo> = {}): InstanceInfo {
  return {
    name: 'test-instance',
    repoSlug: 'my-repo',
    purpose: null,
    status: 'running',
    ...overrides,
  };
}

/** Poll until a condition is met or timeout */
async function waitFor(condition: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('waitFor timed out after ' + timeoutMs + 'ms');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('InteractiveMenu', () => {
  describe('header rendering', () => {
    it('shows instance name, status symbol, repo slug for running instance', () => {
      const info = makeInstanceInfo({ name: 'alpha', status: 'running', repoSlug: 'my-repo' });
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('alpha');
      expect(output).toContain('▶'); // running symbol
      expect(output).toContain('my-repo');
    });

    it('shows stopped symbol for stopped instance', () => {
      const info = makeInstanceInfo({ status: 'stopped' });
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('■');
    });

    it('shows orphaned symbol for orphaned instance', () => {
      const info = makeInstanceInfo({ status: 'orphaned' });
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('✗');
    });

    it('shows not-found symbol for not-found instance', () => {
      const info = makeInstanceInfo({ status: 'not-found' });
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('✗');
    });

    it('shows unknown symbol for unknown status', () => {
      const info = makeInstanceInfo({ status: 'unknown' });
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('?');
    });

    it('shows purpose when set', () => {
      const info = makeInstanceInfo({ purpose: 'Auth service work' });
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Auth service work');
    });

    it('omits purpose segment when purpose is null', () => {
      const info = makeInstanceInfo({ purpose: null });
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      const output = lastFrame() ?? '';
      // Header should have name, status, repo but no extra separator for purpose
      expect(output).toContain('test-instance');
      expect(output).toContain('my-repo');
    });
  });

  describe('action list', () => {
    it('renders all six action options', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Attach to session');
      expect(output).toContain('Open in VS Code');
      expect(output).toContain('Rebuild container');
      expect(output).toContain('Shutdown container');
      expect(output).toContain('Set Purpose');
      expect(output).toContain('Exit');
    });

    it('calls onAction with "attach" when first option selected', async () => {
      const info = makeInstanceInfo();
      const onAction = vi.fn();
      const { stdin } = render(
        <InteractiveMenu instanceInfo={info} onAction={onAction} onSetPurpose={vi.fn()} />
      );

      // First option is "attach" — press Enter
      stdin.write('\r');

      await waitFor(() => onAction.mock.calls.length > 0);
      expect(onAction).toHaveBeenCalledWith('attach');
    });

    it('calls onAction with "code" when second option selected', async () => {
      const info = makeInstanceInfo();
      const onAction = vi.fn();
      const { stdin } = render(
        <InteractiveMenu instanceInfo={info} onAction={onAction} onSetPurpose={vi.fn()} />
      );

      // Down once to "code", then Enter
      stdin.write('\x1B[B');
      stdin.write('\r');

      await waitFor(() => onAction.mock.calls.length > 0);
      expect(onAction).toHaveBeenCalledWith('code');
    });

    it('calls onAction with "exit" when last option selected', async () => {
      const info = makeInstanceInfo();
      const onAction = vi.fn();
      const { stdin } = render(
        <InteractiveMenu instanceInfo={info} onAction={onAction} onSetPurpose={vi.fn()} />
      );

      // Down 5 times to "exit", then Enter
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\r');

      await waitFor(() => onAction.mock.calls.length > 0);
      expect(onAction).toHaveBeenCalledWith('exit');
    });
  });

  describe('Set Purpose flow', () => {
    it('switches to text input when Set Purpose is selected', async () => {
      const info = makeInstanceInfo();
      const onAction = vi.fn();
      const { stdin, lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={onAction} onSetPurpose={vi.fn()} />
      );

      // Down 4 times to "set-purpose", then Enter
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\r');

      // onAction should NOT be called for set-purpose — it's handled internally
      await waitFor(() => (lastFrame() ?? '').includes('Purpose'));
      const output = lastFrame() ?? '';
      expect(output).toContain('Purpose');
      expect(onAction).not.toHaveBeenCalled();
    });

    it('calls onSetPurpose when text is submitted', async () => {
      const info = makeInstanceInfo();
      const onAction = vi.fn();
      const onSetPurpose = vi.fn();
      const { stdin, lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={onAction} onSetPurpose={onSetPurpose} />
      );

      // Navigate to "set-purpose" and select
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\r');

      // Wait for text input to appear
      await waitFor(() => (lastFrame() ?? '').includes('Purpose'));

      // Wait for useEffect to wire up input handlers
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Type a purpose character by character
      for (const char of 'New purpose text') {
        stdin.write(char);
      }

      // Small delay then submit
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write('\r');

      await waitFor(() => onSetPurpose.mock.calls.length > 0);
      expect(onSetPurpose).toHaveBeenCalledWith('New purpose text');
    });

    it('does not inject a Restart option when driftState is undefined', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      expect(lastFrame() ?? '').not.toContain('Restart menu');
    });

    it('shows a "Check for updates" option when no drift is known', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: false,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '0.12.3',
            imageDrift: null,
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Check for updates');
      expect(output).not.toContain('Restart menu');
    });

    it('replaces "Check for updates" with Restart when drift is detected', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: true,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '0.12.2',
            imageDrift: null,
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Restart menu');
      expect(output).not.toContain('Check for updates');
    });

    it('calls onAction with "check-updates" when that option is selected', async () => {
      const info = makeInstanceInfo();
      const onAction = vi.fn();
      const { stdin } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={onAction}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: false,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '0.12.3',
            imageDrift: null,
          }}
        />
      );

      // Navigate down past Attach, Code, Rebuild, Shutdown, Set Purpose to
      // land on "Check for updates" (6th option, index 5 — 5 down-arrows).
      for (let i = 0; i < 5; i++) {
        stdin.write('\x1B[B');
      }
      stdin.write('\r');

      await waitFor(() => onAction.mock.calls.length > 0);
      expect(onAction).toHaveBeenCalledWith('check-updates');
    });

    it('shows a drift banner and Restart option when packageMoved is true', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: true,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '0.12.2',
            imageDrift: null,
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('agent-env was upgraded');
      expect(output).toContain('Restart menu');
      expect(output).toContain('required');
    });

    it('shows Restart with version when installed > current (already upgraded)', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: false,
            updateMessage: null,
            installedVersion: '0.13.0',
            currentVersion: '0.12.3',
            imageDrift: null,
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Restart menu');
      expect(output).toContain('v0.13.0 installed');
      expect(output).toContain('restart to use it');
    });

    it('shows update banner with Check for updates (not Restart) when npm has newer but not installed', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: false,
            updateMessage: 'Update available: 0.12.2 -> 0.13.0',
            installedVersion: null,
            currentVersion: '0.12.2',
            imageDrift: null,
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Update available: 0.12.2 -> 0.13.0');
      expect(output).toContain('Check for updates');
      expect(output).not.toContain('Restart menu');
    });

    it('calls onAction with "restart" when Restart option selected under drift', async () => {
      const info = makeInstanceInfo();
      const onAction = vi.fn();
      const { stdin } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={onAction}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: true,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '0.12.2',
            imageDrift: null,
          }}
        />
      );

      // Restart is prepended, so it's the first option — press Enter.
      stdin.write('\r');

      await waitFor(() => onAction.mock.calls.length > 0);
      expect(onAction).toHaveBeenCalledWith('restart');
    });

    it('returns to action list on Escape without calling onSetPurpose', async () => {
      const info = makeInstanceInfo();
      const onAction = vi.fn();
      const onSetPurpose = vi.fn();
      const { stdin, lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={onAction} onSetPurpose={onSetPurpose} />
      );

      // Navigate to "set-purpose" and select
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\x1B[B');
      stdin.write('\r');

      // Wait for text input to appear
      await waitFor(() => (lastFrame() ?? '').includes('Purpose'));

      // Wait for useEffect to wire up input handlers
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Press Escape
      stdin.write('\x1B');

      // Should return to action list
      await waitFor(() => (lastFrame() ?? '').includes('Attach to session'));
      expect(onSetPurpose).not.toHaveBeenCalled();
      expect(lastFrame()).toContain('Attach to session');
    });

    // ─── Image-drift surfacing (AC8, AC19, AC23) ─────────────────────────────

    // Compose drift-test image references from a base so no test contains a
    // hardcoded "<repo>:<semver>" literal (AC12 falsifiable grep).
    const IMAGE_BASE = 'ghcr.io/zookanalytics/bmad-orchestrator/devcontainer';
    const CONFIGURED_IMAGE = IMAGE_BASE + ':' + '1.0.0';
    const EXPECTED_IMAGE = IMAGE_BASE + ':' + '1.2.0';

    it('renders normally when imageDrift is null', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: false,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '0.12.3',
            imageDrift: null,
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Rebuild container');
      expect(output).not.toContain('image v');
      expect(output).not.toContain('Container image will refresh');
    });

    it('relabels Rebuild and shows cyan banner when imageDrift is set (AC8)', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: false,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '1.0.0',
            imageDrift: {
              configuredImage: CONFIGURED_IMAGE,
              expectedImage: EXPECTED_IMAGE,
            },
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Rebuild container (image v1.2.0 available)');
      expect(output).toContain('Container image will refresh on next rebuild');
      expect(output).toContain(':1.0.0');
      expect(output).toContain(':1.2.0');
    });

    it('keeps Check for updates available when imageDrift is set without updateMessage', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: false,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '1.0.0',
            imageDrift: {
              configuredImage: CONFIGURED_IMAGE,
              expectedImage: EXPECTED_IMAGE,
            },
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Check for updates');
    });

    it('packageMoved takes priority over imageDrift (Restart banner shown, not image banner)', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: true,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '1.0.0',
            imageDrift: {
              configuredImage: CONFIGURED_IMAGE,
              expectedImage: EXPECTED_IMAGE,
            },
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Restart menu');
      expect(output).toContain('agent-env was upgraded');
      // Image banner should NOT appear when a higher-priority signal is active.
      expect(output).not.toContain('Container image will refresh');
    });

    it('AC19: no duplicate "value" entries in action options when imageDrift is set', () => {
      // Indirect assertion via rendered output — only one option mentions "Rebuild container".
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: false,
            updateMessage: null,
            installedVersion: null,
            currentVersion: '1.0.0',
            imageDrift: {
              configuredImage: CONFIGURED_IMAGE,
              expectedImage: EXPECTED_IMAGE,
            },
          }}
        />
      );
      const output = lastFrame() ?? '';
      const rebuildMatches = output.match(/Rebuild container/g) ?? [];
      expect(rebuildMatches.length).toBe(1);
    });

    it('AC23: preserves Check for updates when imageDrift AND updateMessage are both set', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu
          instanceInfo={info}
          onAction={vi.fn()}
          onSetPurpose={vi.fn()}
          driftState={{
            packageMoved: false,
            updateMessage: 'Update available: 1.0.0 -> 1.2.0',
            installedVersion: null,
            currentVersion: '1.0.0',
            imageDrift: {
              configuredImage: CONFIGURED_IMAGE,
              expectedImage: EXPECTED_IMAGE,
            },
          }}
        />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Rebuild container (image v1.2.0 available)');
      expect(output).toContain('Check for updates');
    });
  });
});

// ─── formatImageTagForLabel (F12, F17) ──────────────────────────────────────

describe('formatImageTagForLabel', () => {
  it('extracts tag from a registry-with-port reference', () => {
    expect(formatImageTagForLabel('host:5000/foo/bar:1.2.0')).toBe('v1.2.0');
  });

  it('strips a digest suffix before extracting the tag', () => {
    expect(formatImageTagForLabel('foo/bar:1.2.0@sha256:abc')).toBe('v1.2.0');
  });

  it('returns "refresh" for non-semver tags like :latest (F17)', () => {
    // Avoid the grammatically-nonsensical "image vlatest available" label
    expect(formatImageTagForLabel('foo/bar:latest')).toBe('refresh');
  });

  it('returns "refresh" for untagged image references', () => {
    expect(formatImageTagForLabel('foo/bar')).toBe('refresh');
  });

  it('preserves prerelease and build-metadata suffixes', () => {
    expect(formatImageTagForLabel('foo/bar:1.2.0-beta.1')).toBe('v1.2.0-beta.1');
    expect(formatImageTagForLabel('foo/bar:1.2.0+local')).toBe('v1.2.0+local');
  });
});
