import { describe, expect, it, vi } from 'vitest';

import { listCommand } from './list.js';

describe('listCommand', () => {
  describe('plain text output', () => {
    it('returns formatted table for multiple instances', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        instances: [
          {
            name: 'instance-1',
            status: 'running',
            lastAttached: '2026-01-18T09:00:00.000Z',
            purpose: 'Development',
            gitState: null,
          },
          {
            name: 'a-very-long-instance-name-that-breaks-padding',
            status: 'stopped',
            lastAttached: null,
            purpose: 'Testing long names',
            gitState: null,
          },
        ],
        error: null,
      });

      const output = await listCommand({}, mockDiscover);

      expect(output).toMatchSnapshot();
    });

    it('returns "No instances discovered" for empty list', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        instances: [],
        error: null,
      });

      const output = await listCommand({}, mockDiscover);

      expect(output).toBe('No instances discovered');
    });

    it('formats error with suggestion when discovery fails', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        instances: [],
        error: 'DISCOVERY_FAILED: agent-env: command not found',
      });

      const output = await listCommand({}, mockDiscover);

      expect(output).toMatchSnapshot();
    });

    it('handles instance with null purpose', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        instances: [
          {
            name: 'no-purpose',
            status: 'running',
            lastAttached: null,
            purpose: null,
            gitState: null,
          },
        ],
        error: null,
      });

      const output = await listCommand({}, mockDiscover);

      expect(output).toMatchSnapshot();
    });
  });

  describe('JSON output', () => {
    it('returns valid JSON when --json flag is set', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        instances: [
          {
            name: 'instance-1',
            status: 'running',
            lastAttached: '2026-01-18T09:00:00.000Z',
            purpose: 'Development',
            gitState: null,
          },
        ],
        error: null,
      });

      const output = await listCommand({ json: true }, mockDiscover);
      const parsed = JSON.parse(output);

      expect(parsed.version).toBe('1');
      expect(parsed.instances).toHaveLength(1);
      expect(parsed.errors).toHaveLength(0);
    });

    it('JSON output has correct schema structure', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        instances: [
          {
            name: 'instance-1',
            status: 'running',
            lastAttached: null,
            purpose: null,
            gitState: null,
          },
        ],
        error: null,
      });

      const output = await listCommand({ json: true }, mockDiscover);
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty('version');
      expect(parsed).toHaveProperty('instances');
      expect(parsed).toHaveProperty('errors');
      expect(typeof parsed.version).toBe('string');
      expect(Array.isArray(parsed.instances)).toBe(true);
      expect(Array.isArray(parsed.errors)).toBe(true);
    });

    it('includes discovery error in JSON errors array', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        instances: [],
        error: 'DISCOVERY_FAILED: agent-env: command not found',
      });

      const output = await listCommand({ json: true }, mockDiscover);
      const parsed = JSON.parse(output);

      expect(parsed.errors).toContain('DISCOVERY_FAILED: agent-env: command not found');
      expect(parsed.instances).toHaveLength(0);
    });

    it('returns empty arrays for no instances in JSON mode', async () => {
      const mockDiscover = vi.fn().mockResolvedValue({
        instances: [],
        error: null,
      });

      const output = await listCommand({ json: true }, mockDiscover);
      const parsed = JSON.parse(output);

      expect(parsed.version).toBe('1');
      expect(parsed.instances).toHaveLength(0);
      expect(parsed.errors).toHaveLength(0);
    });

    it('preserves full Instance object in JSON output', async () => {
      const instance = {
        name: 'full-instance',
        status: 'running',
        lastAttached: '2026-01-18T14:30:00.000Z',
        purpose: 'Full test',
        gitState: {
          ok: true,
          state: {
            hasStaged: false,
            stagedCount: 0,
            hasUnstaged: true,
            unstagedCount: 2,
            hasUntracked: false,
            untrackedCount: 0,
            stashCount: 0,
            unpushedBranches: [],
            neverPushedBranches: [],
            isDetachedHead: false,
            isClean: false,
          },
        },
      };

      const mockDiscover = vi.fn().mockResolvedValue({
        instances: [instance],
        error: null,
      });

      const output = await listCommand({ json: true }, mockDiscover);
      const parsed = JSON.parse(output);

      expect(parsed.instances[0]).toEqual(instance);
    });
  });
});
