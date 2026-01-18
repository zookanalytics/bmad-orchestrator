/**
 * DevPod discovery module for querying active containers
 *
 * This module provides functions to discover DevPod workspaces by executing
 * the DevPod CLI and parsing its JSON output.
 *
 * @module discovery
 */
import { execa } from 'execa';

import type { DevPod, DiscoveryResult, RawObject } from './types.js';

/** Default timeout for DevPod CLI commands in milliseconds (10 seconds) */
const DEFAULT_TIMEOUT = 10000;

/** Type for command executor dependency injection */
type CommandExecutor = typeof execa;

/** Helper to safely convert a value to string or undefined */
function toOptionalString(value: unknown): string | undefined {
  return value ? String(value) : undefined;
}

/** Maps source object from CLI to DevPodSource */
function mapSource(source: RawObject | undefined) {
  if (!source) return undefined;
  return {
    gitRepository: toOptionalString(source.gitRepository),
    gitBranch: toOptionalString(source.gitBranch),
    gitCommit: toOptionalString(source.gitCommit),
    gitPRReference: toOptionalString(source.gitPRReference),
    gitSubPath: toOptionalString(source.gitSubPath),
    image: toOptionalString(source.image),
    localFolder: toOptionalString(source.localFolder),
  };
}

/** Maps provider object from CLI to DevPodProviderConfig */
function mapProvider(provider: RawObject | undefined) {
  if (!provider) return undefined;
  return {
    name: toOptionalString(provider.name),
    options: provider.options as RawObject | undefined,
  };
}

/** Maps IDE object from CLI to DevPodIDEConfig */
function mapIde(ide: RawObject | undefined) {
  if (!ide) return undefined;
  return {
    name: toOptionalString(ide.name),
    options: ide.options as RawObject | undefined,
  };
}

/** Maps machine object from CLI to DevPodMachineConfig */
function mapMachine(machine: RawObject | undefined) {
  if (!machine) return undefined;
  return {
    id: toOptionalString(machine.id),
    autoDelete: typeof machine.autoDelete === 'boolean' ? machine.autoDelete : undefined,
  };
}

/** Maps timestamp object from CLI to DevPodTimestamp */
function mapTimestamp(timestamp: RawObject | undefined) {
  if (!timestamp) return undefined;
  return {
    Time: toOptionalString(timestamp.Time),
  };
}

/**
 * Maps an array of workspace objects to DevPod interfaces
 *
 * @param workspaces - Array of workspace objects from CLI
 * @returns Array of DevPod objects
 */
function mapWorkspaces(workspaces: unknown[]): DevPod[] {
  return workspaces.map((ws) => {
    const workspace = ws as RawObject;

    return {
      id: String(workspace.id || ''),
      uid: toOptionalString(workspace.uid),
      context: toOptionalString(workspace.context),
      imported: typeof workspace.imported === 'boolean' ? workspace.imported : undefined,
      source: mapSource(workspace.source as RawObject | undefined),
      provider: mapProvider(workspace.provider as RawObject | undefined),
      ide: mapIde(workspace.ide as RawObject | undefined),
      machine: mapMachine(workspace.machine as RawObject | undefined),
      creationTimestamp: mapTimestamp(workspace.creationTimestamp as RawObject | undefined),
      lastUsedTimestamp: mapTimestamp(workspace.lastUsedTimestamp as RawObject | undefined),
    };
  });
}

/**
 * Maps DevPod CLI output to internal DevPod array
 *
 * @param cliOutput - Raw parsed JSON from DevPod CLI
 * @returns Array of DevPod objects
 *
 * @remarks
 * Handles both array format (direct list) and wrapper object format
 * (with workspaces property) for compatibility.
 */
function mapDevPodOutput(cliOutput: unknown): DevPod[] {
  if (!Array.isArray(cliOutput)) {
    // Handle potential wrapper object format
    if (typeof cliOutput === 'object' && cliOutput !== null) {
      const obj = cliOutput as Record<string, unknown>;
      if (Array.isArray(obj.workspaces)) {
        return mapWorkspaces(obj.workspaces);
      }
    }
    return [];
  }
  return mapWorkspaces(cliOutput);
}

/**
 * Factory function to create a DevPod discovery function
 *
 * @param executor - Optional command executor (defaults to execa)
 * @returns Async function that discovers DevPods
 *
 * @example
 * ```typescript
 * // Production use with default executor
 * const discover = createDiscovery();
 * const result = await discover();
 *
 * // Testing with mock executor
 * const mockExecutor = vi.fn().mockResolvedValue({ stdout: '[]', failed: false });
 * const discover = createDiscovery(mockExecutor);
 * ```
 */
export function createDiscovery(executor: CommandExecutor = execa) {
  /**
   * Discovers all DevPod workspaces on the host machine
   *
   * @returns Discovery result containing DevPods array and optional error
   * @example
   * ```typescript
   * {
   *   devpods: [
   *     { id: 'my-devpod', provider: { name: 'docker' }, /* ... *\/ },
   *   ],
   *   error: null
   * }
   * ```
   * @remarks
   * This function NEVER throws exceptions. All errors are returned
   * in the error property of the result object.
   */
  return async function discoverDevPods(): Promise<DiscoveryResult> {
    const result = await executor('devpod', ['list', '--output', 'json'], {
      timeout: DEFAULT_TIMEOUT,
      reject: false, // Errors in return value, NOT thrown
    });

    // Handle CLI execution failures
    if (result.failed) {
      let errorMessage: string;
      if (result.timedOut) {
        errorMessage = `Command timed out after ${DEFAULT_TIMEOUT}ms`;
      } else {
        errorMessage = result.stderr || result.shortMessage || 'Unknown error';
      }
      return {
        devpods: [],
        error: `DISCOVERY_FAILED: ${errorMessage}`,
      };
    }

    // Parse JSON output
    try {
      const parsed = JSON.parse(result.stdout);
      const devpods = mapDevPodOutput(parsed);
      return { devpods, error: null };
    } catch {
      return {
        devpods: [],
        error: 'DISCOVERY_FAILED: Invalid JSON response',
      };
    }
  };
}

/**
 * Default discovery function using execa
 *
 * @remarks
 * Use this for production code. For testing, use createDiscovery()
 * with a mock executor.
 */
export const discoverDevPods = createDiscovery();
