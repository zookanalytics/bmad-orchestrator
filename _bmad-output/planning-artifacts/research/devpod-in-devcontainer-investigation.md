# Research: Accessing DevPod CLI from DevContainer

**Date:** 2026-01-05
**Task:** Prep Task 3 - Explore DevPod CLI in DevContainer
**Status:** COMPLETE - Mocking is the confirmed path

---

## Executive Summary

Running `devpod` commands inside a DevContainer to manage/view sibling containers (running on the host) is **not feasible without significant security compromises**. DevPod's client-only architecture with stdin/stdout communication intentionally isolates container environments from host tooling.

**Recommendation:** Use **Mocking** for all development and testing within containers. Reserve "live" DevPod interaction for host-side E2E tests only.

---

## Investigation Findings

### 1. Container Environment Analysis

| Check | Result | Notes |
|-------|--------|-------|
| `devpod` CLI in container | Not available | Not installed, would need manual install |
| Docker socket mounted | No | `/var/run/docker.sock` absent |
| DevPod socket/API exposed | No | No sockets in `/var/run/` |
| DevPod config directory | Not present | `~/.devpod` doesn't exist |
| Host gateway accessible | Yes | `192.168.215.1` reachable |

### 2. DevPod Architecture (Why This Can't Work)

DevPod is **client-only by design** with no server component:

1. **No Remote API**: DevPod doesn't expose a REST or gRPC API for external access. The internal gRPC server is used only for agent-to-client communication through tunnels.

2. **Stdin/Stdout Communication**: DevPod uses stdin/stdout streaming for container communication (a security feature), avoiding exposed ports or sockets entirely.

3. **SSH Proxy Tunnel**: The `ProxyCommand` in SSH config creates on-demand tunnels—no persistent socket to mount.

4. **State Storage**: Workspace state lives in `~/.devpod` on the **host** filesystem, not exposed via any API.

### 3. Feasibility Matrix

| Approach | Possible? | Viable? | Notes |
|----------|-----------|---------|-------|
| Mount DevPod socket | No | N/A | No socket exists |
| Access remote API | No | N/A | No public API exposed |
| Install `devpod` CLI in container | Yes | No | Creates isolated instance, can't see host workspaces |
| Mount `~/.devpod` + Docker socket | Yes | No | Security risk, path varies by OS, potential corruption |
| SSH back to host | Yes | Marginal | Complex setup, requires host SSH server + keys |

### 4. Remote API Investigation

Based on [DevPod's documentation](https://devpod.sh/docs/how-it-works/overview):

- DevPod uses a **client-agent architecture** where the agent is deployed to both the machine running the container and the container itself
- Communication occurs through vendor-specific "tunnels" (AWS Instance Connect, Kubernetes control plane, Docker daemon)
- The gRPC server mentioned in docs is internal—not for external consumption
- DevPod Desktop (Electron app) uses internal IPC, not localhost APIs

---

## Conclusion: Mocking is the Correct Path

DevPod's architecture intentionally isolates container environments. There's no viable path to call `devpod list` from within the container because:

1. DevPod stores workspace state in `~/.devpod` on the **host**, not exposed via API
2. The CLI requires direct access to Docker/provider APIs on the host
3. No socket/API/tunnel exists for container→host DevPod communication

**All tests run inside containers, so mocking is mandatory for the testing strategy.**

---

## Mock Implementation Guide

### Step 1: Capture Real DevPod Output

Run these commands on the **host machine** (not in DevContainer) to capture real output:

```bash
# List workspaces - JSON format
devpod list --output json > fixtures/devpod-list.json

# List workspaces - human format (for comparison)
devpod list > fixtures/devpod-list.txt

# Provider list
devpod provider list --output json > fixtures/devpod-provider-list.json

# Single workspace status
devpod status <workspace-name> --output json > fixtures/devpod-status.json
```

### Step 2: DevPod Output Schemas

#### `devpod list --output json`

```typescript
interface DevPodWorkspace {
  id: string;
  source: {
    gitRepository?: string;
    localFolder?: string;
    image?: string;
  };
  machine?: {
    id: string;
    provider: string;
  };
  provider: {
    name: string;
  };
  ide: {
    name: string;
  };
  status: 'Running' | 'Stopped' | 'Busy' | 'NotFound';
  lastUsed: string; // ISO 8601 timestamp
  creationTimestamp: string; // ISO 8601 timestamp
}

type DevPodListOutput = DevPodWorkspace[];
```

#### Example Real Output

```json
[
  {
    "id": "bmad-dashboard",
    "source": {
      "localFolder": "/Users/node/projects/bmad-dashboard"
    },
    "provider": {
      "name": "docker"
    },
    "ide": {
      "name": "vscode"
    },
    "status": "Running",
    "lastUsed": "2026-01-05T10:30:00Z",
    "creationTimestamp": "2026-01-03T08:00:00Z"
  },
  {
    "id": "api-server",
    "source": {
      "gitRepository": "https://github.com/example/api-server"
    },
    "provider": {
      "name": "docker"
    },
    "ide": {
      "name": "none"
    },
    "status": "Stopped",
    "lastUsed": "2026-01-04T15:45:00Z",
    "creationTimestamp": "2026-01-02T12:00:00Z"
  }
]
```

### Step 3: Mock Factory Implementation

Create a mock factory that generates test data:

```typescript
// src/lib/devpod/__mocks__/devpod-client.ts

import type { DevPodWorkspace } from '../types';

export function createMockWorkspace(
  overrides: Partial<DevPodWorkspace> = {}
): DevPodWorkspace {
  return {
    id: 'test-workspace',
    source: { localFolder: '/path/to/project' },
    provider: { name: 'docker' },
    ide: { name: 'vscode' },
    status: 'Running',
    lastUsed: new Date().toISOString(),
    creationTimestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockWorkspaceList(count: number): DevPodWorkspace[] {
  return Array.from({ length: count }, (_, i) =>
    createMockWorkspace({
      id: `workspace-${i + 1}`,
      status: i % 2 === 0 ? 'Running' : 'Stopped',
    })
  );
}

// Fixture-based mock data (from real captures)
export const FIXTURES = {
  emptyList: [] as DevPodWorkspace[],
  singleRunning: [createMockWorkspace({ status: 'Running' })],
  mixedStatus: [
    createMockWorkspace({ id: 'running-1', status: 'Running' }),
    createMockWorkspace({ id: 'stopped-1', status: 'Stopped' }),
    createMockWorkspace({ id: 'busy-1', status: 'Busy' }),
  ],
};
```

### Step 4: DevPodClient Abstraction

```typescript
// src/lib/devpod/devpod-client.ts

import type { DevPodWorkspace } from './types';

export interface DevPodClient {
  list(): Promise<DevPodWorkspace[]>;
  status(workspaceId: string): Promise<DevPodWorkspace | null>;
  up(source: string, options?: UpOptions): Promise<DevPodWorkspace>;
  stop(workspaceId: string): Promise<void>;
  delete(workspaceId: string): Promise<void>;
}

export interface UpOptions {
  name?: string;
  ide?: string;
  provider?: string;
}
```

### Step 5: Shell Implementation (for host usage)

```typescript
// src/lib/devpod/shell-devpod-client.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import type { DevPodClient, DevPodWorkspace, UpOptions } from './types';

const execAsync = promisify(exec);

export class ShellDevPodClient implements DevPodClient {
  async list(): Promise<DevPodWorkspace[]> {
    const { stdout } = await execAsync('devpod list --output json');
    return JSON.parse(stdout);
  }

  async status(workspaceId: string): Promise<DevPodWorkspace | null> {
    try {
      const { stdout } = await execAsync(
        `devpod status ${workspaceId} --output json`
      );
      return JSON.parse(stdout);
    } catch {
      return null;
    }
  }

  async up(source: string, options?: UpOptions): Promise<DevPodWorkspace> {
    const args = ['devpod', 'up', source, '--output', 'json'];
    if (options?.name) args.push('--name', options.name);
    if (options?.ide) args.push('--ide', options.ide);
    if (options?.provider) args.push('--provider', options.provider);

    const { stdout } = await execAsync(args.join(' '));
    return JSON.parse(stdout);
  }

  async stop(workspaceId: string): Promise<void> {
    await execAsync(`devpod stop ${workspaceId}`);
  }

  async delete(workspaceId: string): Promise<void> {
    await execAsync(`devpod delete ${workspaceId}`);
  }
}
```

### Step 6: Mock Implementation (for container testing)

```typescript
// src/lib/devpod/mock-devpod-client.ts

import type { DevPodClient, DevPodWorkspace, UpOptions } from './types';
import { createMockWorkspace, FIXTURES } from './__mocks__/devpod-client';

export class MockDevPodClient implements DevPodClient {
  private workspaces: Map<string, DevPodWorkspace> = new Map();

  constructor(initialWorkspaces: DevPodWorkspace[] = []) {
    initialWorkspaces.forEach((w) => this.workspaces.set(w.id, w));
  }

  async list(): Promise<DevPodWorkspace[]> {
    return Array.from(this.workspaces.values());
  }

  async status(workspaceId: string): Promise<DevPodWorkspace | null> {
    return this.workspaces.get(workspaceId) ?? null;
  }

  async up(source: string, options?: UpOptions): Promise<DevPodWorkspace> {
    const workspace = createMockWorkspace({
      id: options?.name ?? `workspace-${Date.now()}`,
      source: { localFolder: source },
      ide: { name: options?.ide ?? 'vscode' },
      status: 'Running',
    });
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  async stop(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (workspace) {
      workspace.status = 'Stopped';
    }
  }

  async delete(workspaceId: string): Promise<void> {
    this.workspaces.delete(workspaceId);
  }

  // Test helpers
  reset(workspaces: DevPodWorkspace[] = []): void {
    this.workspaces.clear();
    workspaces.forEach((w) => this.workspaces.set(w.id, w));
  }

  setWorkspaces(workspaces: DevPodWorkspace[]): void {
    this.reset(workspaces);
  }
}
```

### Step 7: Dependency Injection Setup

```typescript
// src/lib/devpod/index.ts

import type { DevPodClient } from './types';
import { ShellDevPodClient } from './shell-devpod-client';
import { MockDevPodClient } from './mock-devpod-client';

// Factory that returns appropriate client based on environment
export function createDevPodClient(): DevPodClient {
  // In tests or container environment, use mock
  if (process.env.NODE_ENV === 'test' || process.env.USE_MOCK_DEVPOD) {
    return new MockDevPodClient();
  }

  // On host, try to use real CLI
  return new ShellDevPodClient();
}

// For testing - allows injecting specific mock state
export { MockDevPodClient } from './mock-devpod-client';
export { FIXTURES, createMockWorkspace } from './__mocks__/devpod-client';
export type { DevPodClient, DevPodWorkspace } from './types';
```

### Step 8: Vitest Integration

```typescript
// src/lib/devpod/__tests__/devpod-client.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { MockDevPodClient, FIXTURES, createMockWorkspace } from '../index';

describe('DevPodClient', () => {
  let client: MockDevPodClient;

  beforeEach(() => {
    client = new MockDevPodClient();
  });

  describe('list', () => {
    it('returns empty array when no workspaces', async () => {
      const result = await client.list();
      expect(result).toEqual([]);
    });

    it('returns all workspaces', async () => {
      client.setWorkspaces(FIXTURES.mixedStatus);
      const result = await client.list();
      expect(result).toHaveLength(3);
    });
  });

  describe('up', () => {
    it('creates a new workspace', async () => {
      const workspace = await client.up('/path/to/project', { name: 'my-ws' });

      expect(workspace.id).toBe('my-ws');
      expect(workspace.status).toBe('Running');

      const list = await client.list();
      expect(list).toHaveLength(1);
    });
  });

  describe('stop', () => {
    it('changes workspace status to Stopped', async () => {
      client.setWorkspaces([createMockWorkspace({ id: 'test', status: 'Running' })]);

      await client.stop('test');

      const workspace = await client.status('test');
      expect(workspace?.status).toBe('Stopped');
    });
  });

  describe('delete', () => {
    it('removes workspace from list', async () => {
      client.setWorkspaces(FIXTURES.singleRunning);

      await client.delete(FIXTURES.singleRunning[0].id);

      const list = await client.list();
      expect(list).toHaveLength(0);
    });
  });
});
```

---

## Test Data Maintenance

### Keeping Fixtures Current

1. **Quarterly refresh**: Run capture commands on host to update JSON fixtures
2. **Version tracking**: Include DevPod version in fixture metadata
3. **Schema validation**: Use Zod or similar to validate real output matches expected schema

```typescript
// scripts/update-devpod-fixtures.sh (run on HOST only)
#!/bin/bash
set -e

FIXTURE_DIR="src/lib/devpod/__fixtures__"
mkdir -p "$FIXTURE_DIR"

echo "Capturing DevPod fixtures..."
echo "DevPod version: $(devpod version)" > "$FIXTURE_DIR/metadata.txt"
echo "Captured: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$FIXTURE_DIR/metadata.txt"

devpod list --output json > "$FIXTURE_DIR/list.json"
devpod provider list --output json > "$FIXTURE_DIR/providers.json"

echo "Fixtures updated in $FIXTURE_DIR"
```

---

## Decision Record

| Decision | Rationale |
|----------|-----------|
| Mock all DevPod interactions in tests | Container isolation makes real CLI access impossible |
| Use interface abstraction (`DevPodClient`) | Enables swap between mock/real implementations |
| Capture real JSON output for fixtures | Ensures mocks match actual CLI behavior |
| Use factory pattern for mock data | Reduces boilerplate in tests |
| Environment variable toggle (`USE_MOCK_DEVPOD`) | Allows same code to work in container vs host |

---

## Sources

- [How it works - DevPod docs](https://devpod.sh/docs/how-it-works/overview)
- [DevPod: SSH-Based Devcontainers - fabiorehm.com](https://fabiorehm.com/blog/2025/11/11/devpod-ssh-devcontainers/)
- [Developing on a local-remote DevContainer - Medium](https://darkghosthunter.medium.com/developing-on-a-local-remote-devcontainer-d282b7837bf9)
- [GitHub - loft-sh/devpod](https://github.com/loft-sh/devpod)
- [How DevPod Deploys Workspaces - DevPod docs](https://devpod.sh/docs/how-it-works/deploying-workspaces)
