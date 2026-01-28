/**
 * Tests for DevPod discovery module
 *
 * These tests use mock command executors to test all discovery scenarios
 * without requiring actual DevPod CLI installation.
 */
import type { execa as execaType } from 'execa';

import { describe, expect, it, vi } from 'vitest';

import devPodList from './__fixtures__/devPodList.json' with { type: 'json' };
import devPodListEmpty from './__fixtures__/devPodListEmpty.json' with { type: 'json' };
import { createDiscovery, discoverDevPods } from './discovery.js';

// Type for our mock executor
type MockExecutor = ReturnType<typeof vi.fn>;

describe('discovery', () => {
  describe('createDiscovery', () => {
    describe('successful discovery (AC1)', () => {
      it('returns parsed DevPods on successful execution', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(devPodList),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.devpods).toHaveLength(3);
        expect(mockExecutor).toHaveBeenCalledWith(
          'devpod',
          ['list', '--output', 'json'],
          expect.objectContaining({ reject: false, timeout: 10000 })
        );
      });

      it('correctly maps DevPod fields from CLI output', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(devPodList),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.devpods[0]).toMatchObject({
          id: 'bmad-orchestrator',
          uid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          source: {
            gitRepository: 'https://github.com/zookanalytics/bmad-orchestrator',
            gitBranch: 'main',
          },
          provider: { name: 'docker' },
          ide: { name: 'vscode' },
          machine: { id: 'docker', autoDelete: false },
          context: 'default',
          imported: false,
        });
      });

      it('maps multiple DevPods with different configurations', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(devPodList),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        // Second DevPod has local folder source
        expect(result.devpods[1].source?.localFolder).toBe(
          '/Users/developer/projects/other-project'
        );
        expect(result.devpods[1].ide).toBeUndefined();

        // Third DevPod has kubernetes provider
        expect(result.devpods[2].provider?.name).toBe('kubernetes');
        expect(result.devpods[2].ide?.name).toBe('cursor');
        expect(result.devpods[2].machine?.autoDelete).toBe(true);
      });
    });

    describe('empty list handling (AC2)', () => {
      it('returns empty array when no DevPods exist', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(devPodListEmpty),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.devpods).toHaveLength(0);
        expect(result.devpods).toEqual([]);
      });

      it('returns empty array for empty JSON array string', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '[]',
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.devpods).toHaveLength(0);
      });
    });

    describe('CLI failure handling (AC3)', () => {
      it('returns error result when CLI not found', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: 'command not found: devpod',
          failed: true,
          shortMessage: 'Command failed',
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.devpods).toHaveLength(0);
        expect(result.error).toContain('DISCOVERY_FAILED');
        expect(result.error).toContain('command not found');
      });

      it('returns error result with stderr message on CLI error', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: 'provider not configured',
          failed: true,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.devpods).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: provider not configured');
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

        expect(result.devpods).toHaveLength(0);
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

        expect(result.devpods).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: Unknown error');
      });

      it('does not throw exception on CLI failure', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '',
          stderr: 'fatal error',
          failed: true,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        // Should not throw
        await expect(discover()).resolves.toBeDefined();
      });
    });

    describe('dependency injection for testing (AC4)', () => {
      it('accepts custom executor via factory', async () => {
        const customExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '[]',
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
            stdout: JSON.stringify(devPodList),
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
        expect(result1.devpods).toHaveLength(3);

        const result2 = await discover();
        expect(result2.error).toContain('DISCOVERY_FAILED');
      });
    });

    describe('timeout handling (AC5)', () => {
      it('configures 10-second timeout', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '[]',
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        await discover();

        expect(mockExecutor).toHaveBeenCalledWith(
          'devpod',
          ['list', '--output', 'json'],
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

        expect(result.devpods).toHaveLength(0);
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

        // Should not throw
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

        expect(result.devpods).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: Invalid JSON response');
      });

      it('returns error result for truncated JSON', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '[{"id": "test"',
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.devpods).toHaveLength(0);
        expect(result.error).toBe('DISCOVERY_FAILED: Invalid JSON response');
      });

      it('handles wrapper object format with workspaces array', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify({ workspaces: devPodList }),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.devpods).toHaveLength(3);
      });

      it('returns empty array for non-array non-object response', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: '"just a string"',
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.devpods).toHaveLength(0);
      });

      it('returns empty array for object without workspaces property', async () => {
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify({ foo: 'bar' }),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.devpods).toHaveLength(0);
      });
    });

    describe('edge cases', () => {
      it('handles DevPod with minimal fields', async () => {
        const minimalDevPod = [{ id: 'minimal' }];
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(minimalDevPod),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.devpods).toHaveLength(1);
        expect(result.devpods[0].id).toBe('minimal');
        expect(result.devpods[0].source).toBeUndefined();
        expect(result.devpods[0].provider).toBeUndefined();
      });

      it('handles DevPod with null values', async () => {
        const devPodWithNulls = [{ id: 'test', source: null, provider: null, ide: null }];
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(devPodWithNulls),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.devpods).toHaveLength(1);
        expect(result.devpods[0].source).toBeUndefined();
      });

      it('handles empty string id', async () => {
        const devPodEmptyId = [{ id: '' }];
        const mockExecutor: MockExecutor = vi.fn().mockResolvedValue({
          stdout: JSON.stringify(devPodEmptyId),
          stderr: '',
          failed: false,
        });
        const discover = createDiscovery(mockExecutor as unknown as typeof execaType);

        const result = await discover();

        expect(result.error).toBeNull();
        expect(result.devpods[0].id).toBe('');
      });
    });
  });

  describe('discoverDevPods (default export)', () => {
    it('is a function', () => {
      expect(typeof discoverDevPods).toBe('function');
    });

    it('returns a Promise', () => {
      // Note: This will actually try to execute devpod CLI
      // In real environments without devpod, it should return an error result
      const result = discoverDevPods();
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
