import { describe, expect, it, vi } from 'vitest';

import { listCommand } from './list.js';

// Mock the discovery module
vi.mock('../lib/discovery.js', () => ({
  createDiscovery: vi.fn(),
}));

import { createDiscovery } from '../lib/discovery.js';

describe('listCommand', () => {
  describe('plain text output', () => {
    it('returns formatted table for multiple DevPods', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [
          {
            id: 'pod-1',
            source: { localFolder: '/path/1' },
            provider: { name: 'docker' },
          },
          {
            id: 'pod-2',
            source: { localFolder: '/path/2' },
            provider: { name: 'kubernetes' },
          },
        ],
        error: null,
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({});

      expect(output).toContain('NAME');
      expect(output).toContain('WORKSPACE');
      expect(output).toContain('PROVIDER');
      expect(output).toContain('pod-1');
      expect(output).toContain('pod-2');
      expect(output).toContain('/path/1');
      expect(output).toContain('/path/2');
      expect(output).toContain('docker');
      expect(output).toContain('kubernetes');
    });

    it('returns "No DevPods discovered" for empty list', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [],
        error: null,
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({});

      expect(output).toBe('No DevPods discovered');
    });

    it('formats error with suggestion when discovery fails', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [],
        error: 'devpod: command not found',
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({});

      // Uses @zookanalytics/shared formatError format
      expect(output).toContain('DISCOVERY_FAILED');
      expect(output).toContain('devpod: command not found');
      expect(output).toContain('devpod version');
    });

    it('handles DevPod with git repository source', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [
          {
            id: 'git-pod',
            source: { gitRepository: 'https://github.com/example/repo' },
            provider: { name: 'docker' },
          },
        ],
        error: null,
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({});

      expect(output).toContain('https://github.com/example/repo');
    });

    it('handles DevPod with no source information', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [
          {
            id: 'no-source-pod',
            provider: { name: 'docker' },
          },
        ],
        error: null,
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({});

      expect(output).toContain('no-source-pod');
      expect(output).toContain('-'); // No path available
    });
  });

  describe('JSON output', () => {
    it('returns valid JSON when --json flag is set', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [
          {
            id: 'pod-1',
            source: { localFolder: '/path/1' },
            provider: { name: 'docker' },
          },
        ],
        error: null,
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({ json: true });
      const parsed = JSON.parse(output);

      expect(parsed.version).toBe('1');
      expect(parsed.devpods).toHaveLength(1);
      expect(parsed.errors).toHaveLength(0);
    });

    it('JSON output has correct schema structure', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [
          {
            id: 'pod-1',
            source: { localFolder: '/path/1' },
            provider: { name: 'docker' },
          },
        ],
        error: null,
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({ json: true });
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('devpods');
      expect(parsed).toHaveProperty('errors');
      expect(typeof parsed.version).toBe('string');
      expect(Array.isArray(parsed.devpods)).toBe(true);
      expect(Array.isArray(parsed.errors)).toBe(true);
    });

    it('includes discovery error in JSON errors array', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [],
        error: 'devpod: command not found',
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({ json: true });
      const parsed = JSON.parse(output);

      expect(parsed.errors).toContain('devpod: command not found');
      expect(parsed.devpods).toHaveLength(0);
    });

    it('returns empty arrays for no DevPods in JSON mode', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [],
        error: null,
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({ json: true });
      const parsed = JSON.parse(output);

      expect(parsed.version).toBe('1');
      expect(parsed.devpods).toHaveLength(0);
      expect(parsed.errors).toHaveLength(0);
    });

    it('preserves full DevPod object in JSON output', async () => {
      const devpod = {
        id: 'full-pod',
        uid: 'uid-123',
        context: 'default',
        source: {
          localFolder: '/workspace/project',
          gitRepository: undefined,
        },
        provider: { name: 'docker', options: { cpus: '4' } },
        ide: { name: 'vscode' },
        machine: { id: 'local', autoDelete: false },
        creationTimestamp: { Time: '2024-01-15T10:00:00Z' },
        lastUsedTimestamp: { Time: '2024-01-18T14:30:00Z' },
      };

      const mockDiscover = vi.fn().mockResolvedValue({
        devpods: [devpod],
        error: null,
      });
      vi.mocked(createDiscovery).mockReturnValue(mockDiscover);

      const output = await listCommand({ json: true });
      const parsed = JSON.parse(output);

      expect(parsed.devpods[0]).toEqual(devpod);
    });
  });
});
