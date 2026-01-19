import { describe, expect, it } from 'vitest';

import type { DevPod, DevPodStatus, DiscoveryResult } from './types.js';

import devPodList from './__fixtures__/devPodList.json' with { type: 'json' };
import devPodListEmpty from './__fixtures__/devPodListEmpty.json' with { type: 'json' };

describe('types', () => {
  describe('DevPod', () => {
    it('fixture matches DevPod[] type', () => {
      const pods: DevPod[] = devPodList;
      expect(pods).toHaveLength(3);
      expect(pods[0].id).toBeDefined();
      expect(pods[0].source).toBeDefined();
      expect(pods[0].provider).toBeDefined();
    });

    it('empty fixture matches DevPod[] type', () => {
      const pods: DevPod[] = devPodListEmpty;
      expect(pods).toHaveLength(0);
    });

    it('contains expected DevPod properties', () => {
      const pods: DevPod[] = devPodList;
      const firstPod = pods[0];

      expect(firstPod.id).toBe('bmad-orchestrator');
      expect(firstPod.uid).toBeDefined();
      expect(firstPod.source?.gitRepository).toBe(
        'https://github.com/zookanalytics/bmad-orchestrator'
      );
      expect(firstPod.provider?.name).toBe('docker');
      expect(firstPod.ide?.name).toBe('vscode');
      expect(firstPod.creationTimestamp?.Time).toBeDefined();
      expect(firstPod.lastUsedTimestamp?.Time).toBeDefined();
    });

    it('handles DevPod with local folder source', () => {
      const pods: DevPod[] = devPodList;
      const localPod = pods[1];

      expect(localPod.id).toBe('other-project');
      expect(localPod.source?.localFolder).toBe('/Users/developer/projects/other-project');
      expect(localPod.source?.gitRepository).toBeUndefined();
    });

    it('handles DevPod with different provider', () => {
      const pods: DevPod[] = devPodList;
      const k8sPod = pods[2];

      expect(k8sPod.id).toBe('experiment-repo');
      expect(k8sPod.provider?.name).toBe('kubernetes');
      expect(k8sPod.ide?.name).toBe('cursor');
      expect(k8sPod.machine?.autoDelete).toBe(true);
    });
  });

  describe('DevPodStatus', () => {
    it('accepts valid status values', () => {
      const statuses: DevPodStatus[] = ['Running', 'Stopped', 'Busy', 'NotFound'];
      expect(statuses).toContain('Running');
      expect(statuses).toContain('Stopped');
      expect(statuses).toContain('Busy');
      expect(statuses).toContain('NotFound');
    });

    it('type narrows correctly', () => {
      const status: DevPodStatus = 'Running';

      // Type narrowing test
      if (status === 'Running') {
        expect(status).toBe('Running');
      }
    });
  });

  describe('DiscoveryResult', () => {
    it('can represent successful discovery', () => {
      const result: DiscoveryResult = {
        devpods: devPodList,
        error: null,
      };

      expect(result.devpods).toHaveLength(3);
      expect(result.error).toBeNull();
    });

    it('can represent empty discovery', () => {
      const result: DiscoveryResult = {
        devpods: devPodListEmpty,
        error: null,
      };

      expect(result.devpods).toHaveLength(0);
      expect(result.error).toBeNull();
    });

    it('can represent failed discovery', () => {
      const result: DiscoveryResult = {
        devpods: [],
        error: 'devpod command not found',
      };

      expect(result.devpods).toHaveLength(0);
      expect(result.error).toBe('devpod command not found');
    });
  });
});
