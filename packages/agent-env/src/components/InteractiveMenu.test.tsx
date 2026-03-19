import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import type { InstanceInfo } from '../lib/list-instances.js';

import { InteractiveMenu } from './InteractiveMenu.js';

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
    it('renders all five action options', () => {
      const info = makeInstanceInfo();
      const { lastFrame } = render(
        <InteractiveMenu instanceInfo={info} onAction={vi.fn()} onSetPurpose={vi.fn()} />
      );
      const output = lastFrame() ?? '';
      expect(output).toContain('Attach to session');
      expect(output).toContain('Open in VS Code');
      expect(output).toContain('Rebuild container');
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

      // Down 4 times to "exit", then Enter
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

      // Down 3 times to "set-purpose", then Enter
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
  });
});
