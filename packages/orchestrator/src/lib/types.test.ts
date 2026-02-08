import { describe, expect, it } from 'vitest';

import type {
  AgentEnvJsonOutput,
  DiscoveryResult,
  Instance,
  InstanceDisplayStatus,
} from './types.js';

import instanceList from './__fixtures__/instanceList.json' with { type: 'json' };
import instanceListEmpty from './__fixtures__/instanceListEmpty.json' with { type: 'json' };
import instanceListError from './__fixtures__/instanceListError.json' with { type: 'json' };

describe('types', () => {
  describe('AgentEnvJsonOutput', () => {
    it('success fixture matches AgentEnvJsonOutput shape', () => {
      const output: AgentEnvJsonOutput = instanceList;
      expect(output.ok).toBe(true);
      expect(output.data).toHaveLength(3);
      expect(output.error).toBeNull();
    });

    it('empty fixture matches AgentEnvJsonOutput shape', () => {
      const output: AgentEnvJsonOutput = instanceListEmpty;
      expect(output.ok).toBe(true);
      expect(output.data).toHaveLength(0);
      expect(output.error).toBeNull();
    });

    it('error fixture matches AgentEnvJsonOutput shape', () => {
      const output: AgentEnvJsonOutput = instanceListError;
      expect(output.ok).toBe(false);
      expect(output.data).toBeNull();
      expect(output.error).toBeDefined();
      expect(output.error?.code).toBe('CONTAINER_RUNTIME_ERROR');
      expect(output.error?.message).toBeDefined();
      expect(output.error?.suggestion).toBeDefined();
    });
  });

  describe('Instance', () => {
    it('fixture instances have expected properties', () => {
      const instances = instanceList.data as Instance[];
      const first = instances[0];

      expect(first.name).toBe('bmad-orchestrator');
      expect(first.status).toBe('running');
      expect(first.lastAttached).toBe('2026-01-18T09:15:00.000Z');
      expect(first.purpose).toBe('BMAD orchestrator development');
      expect(first.gitState).toBeDefined();
      expect(first.gitState?.ok).toBe(true);
      expect(first.gitState?.state?.hasUnstaged).toBe(true);
      expect(first.gitState?.state?.isClean).toBe(false);
    });

    it('handles instance with null purpose', () => {
      const instances = instanceList.data as Instance[];
      const second = instances[1];

      expect(second.name).toBe('other-project');
      expect(second.status).toBe('stopped');
      expect(second.purpose).toBeNull();
    });

    it('handles instance with null gitState', () => {
      const instances = instanceList.data as Instance[];
      const third = instances[2];

      expect(third.name).toBe('experiment-repo');
      expect(third.status).toBe('not-found');
      expect(third.lastAttached).toBeNull();
      expect(third.gitState).toBeNull();
    });
  });

  describe('InstanceDisplayStatus', () => {
    it('accepts valid status values', () => {
      const statuses: InstanceDisplayStatus[] = [
        'running',
        'stopped',
        'not-found',
        'orphaned',
        'unknown',
      ];
      expect(statuses).toContain('running');
      expect(statuses).toContain('stopped');
      expect(statuses).toContain('not-found');
      expect(statuses).toContain('orphaned');
      expect(statuses).toContain('unknown');
    });
  });

  describe('DiscoveryResult', () => {
    it('can represent successful discovery', () => {
      const result: DiscoveryResult = {
        instances: instanceList.data as Instance[],
        error: null,
      };

      expect(result.instances).toHaveLength(3);
      expect(result.error).toBeNull();
    });

    it('can represent empty discovery', () => {
      const result: DiscoveryResult = {
        instances: [],
        error: null,
      };

      expect(result.instances).toHaveLength(0);
      expect(result.error).toBeNull();
    });

    it('can represent failed discovery', () => {
      const result: DiscoveryResult = {
        instances: [],
        error: 'DISCOVERY_FAILED: agent-env command not found',
      };

      expect(result.instances).toHaveLength(0);
      expect(result.error).toContain('DISCOVERY_FAILED');
    });
  });
});
