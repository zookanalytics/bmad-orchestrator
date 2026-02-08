/**
 * Tests for instance discovery module
 *
 * These tests use mock command executors to test all discovery scenarios
 * without requiring actual agent-env CLI installation.
 */
import type { execa as execaType } from 'execa';

import { describe, expect, it, vi } from 'vitest';

import instanceList from './__fixtures__/instanceList.json' with { type: 'json' };
import instanceListEmpty from './__fixtures__/instanceListEmpty.json' with { type: 'json' };
import instanceListError from './__fixtures__/instanceListError.json' with { type: 'json' };
import { createDiscovery, discoverInstances } from './discovery.js';

type MockExecutor = ReturnType<typeof vi.fn>;

describe('discovery', () => {
  describe('createDiscovery', () => {
    describe('successful discovery', () => {
      it('returns parsed instances on successful execution', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(instanceList),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.instances).toHaveLength(3);
        expect(mockExecutor).toHaveBeenCalledWith(
          'agent-env',
          ['list', '--json'],
          expect.objectContaining({ reject: false, timeout: 10000 })
        );
      });

      it('correctly returns instance fields from CLI output', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(instanceList),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances[0]).toMatchObject({
          name: 'bmad-orchestrator',
          status: 'running',
          lastAttached: '2026-01-18T09:15:00.000Z',
          purpose: 'BMAD orchestrator development',
        });
        expect(result.instances[0].gitState).toBeDefined();
        expect(result.instances[0].gitState?.ok).toBe(true);
      });

      it('returns instances with mixed statuses and nullable fields', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(instanceList),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        // Second instance has null purpose
        expect(result.instances[1].name).toBe('other-project');
        expect(result.instances[1].status).toBe('stopped');
        expect(result.instances[1].purpose).toBeNull();

        // Third instance has null gitState and lastAttached
        expect(result.instances[2].name).toBe('experiment-repo');
        expect(result.instances[2].status).toBe('not-found');
        expect(result.instances[2].gitState).toBeNull();
        expect(result.instances[2].lastAttached).toBeNull();
      });
    });

    describe('empty list handling', () => {
      it('returns empty array when no instances exist', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(instanceListEmpty),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.instances).toHaveLength(0);
        expect(result.instances).toEqual([]);
      });
    });

    describe('agent-env error envelope handling', () => {
      it('returns error from agent-env error envelope', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(instanceListError),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: Failed to query container runtime');
      });

      it('handles error envelope with no message', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify({ ok: false, data: null, error: null }),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: Unknown error');
      });
    });

    describe('CLI failure handling', () => {
      it('returns error result when CLI not found', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: 'command not found: agent-env',
          failed: true,
          shortMessage: 'Command failed',
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances).toHaveLength(0);
        expect(result.error).toContain('DISCOVERY_FAILED');
        expect(result.error).toContain('command not found');
      });

      it('returns error result with stderr message on CLI error', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: 'runtime not available',
          failed: true,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: runtime not available');
      });

      it('returns error result with shortMessage when no stderr', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: '',
          failed: true,
          shortMessage: 'Command exited with code 1',
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: Command exited with code 1');
      });

      it('returns error result with Unknown error when no stderr or shortMessage', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: '',
          failed: true,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: Unknown error');
      });

      it('does not throw exception on CLI failure', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: 'fatal error',
          failed: true,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        await expect(discover()).resolves.toBeDefined();
      });
    });

    describe('dependency injection for testing', () => {
      it('accepts custom executor via factory', async () => {
        const customExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(instanceListEmpty),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(customExecutor as unknown as typeof execaType);

        await discover();

        expect(customExecutor).toHaveBeenCalled();
      });

      it('allows testing different CLI responses', async () => {
        const mockExecutor: MockExecutor = vi
          .fn()
          .mockResolvedValueOnce({
            stdout: JSON.stringify(instanceList),
            stderr: '',
            failed: false,
          })
          .mockResolvedValueOnce({
            stdout: '',
            stderr: 'error',
            failed: true,
          });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result1 = await discover();
        expect(result1.instances).toHaveLength(3);

        const result2 = await discover();
        expect(result2.error).toContain('DISCOVERY_FAILED');
      });
    });

    describe('timeout handling', () => {
      it('configures 10-second timeout', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(instanceListEmpty),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        await discover();

        expect(mockExecutor).toHaveBeenCalledWith(
          'agent-env',
          ['list', '--json'],
          expect.objectContaining({ timeout: 10000 })
        );
      });

      it('returns error result on timeout', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: '',
          failed: true,
          timedOut: true,
          shortMessage: 'Command timed out after 10000 milliseconds',
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances).toHaveLength(0);
        expect(result.error).toContain('DISCOVERY_FAILED');
        expect(result.error).toContain('timed out');
      });

      it('does not throw exception on timeout', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: '',
          failed: true,
          timedOut: true,
          shortMessage: 'Timed out',
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        await expect(discover()).resolves.toBeDefined();
      });
    });

    describe('malformed JSON handling', () => {
      it('returns error result when JSON is malformed', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: 'not valid json {{{',
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: Invalid JSON response');
      });

      it('returns error result for truncated JSON', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '{"ok": true, "data": [{"name": "test"',
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.instances).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: Invalid JSON response');
      });
    });
  });

  describe('discoverInstances (default export)', () => {
    it('is a function', () => {
      expect(typeof discoverInstances).toBe('function');
    });

    it('returns a DiscoveryResult when awaited', async () => {
      const result = await discoverInstances();
      expect(result).toHaveProperty('instances');
      expect(result).toHaveProperty('error');
    });
  });
});
