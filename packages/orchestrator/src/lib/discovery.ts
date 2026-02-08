/**
 * Instance discovery module for querying agent-env CLI
 *
 * This module discovers instances by executing `agent-env list --json`
 * and parsing the structured JSON envelope response.
 *
 * @module discovery
 */
import { execa } from 'execa';

import type { AgentEnvJsonOutput, DiscoveryResult } from './types.js';

/** Default timeout for agent-env CLI commands in milliseconds (10 seconds) */
const DEFAULT_TIMEOUT = 10000;

/** Type for command executor dependency injection */
type CommandExecutor = typeof execa;

/**
 * Factory function to create an instance discovery function
 *
 * @param executor - Optional command executor (defaults to execa)
 * @returns Async function that discovers instances
 *
 * @example
 * ```typescript
 * // Production use with default executor
 * const discover = createDiscovery();
 * const result = await discover();
 *
 * // Testing with mock executor
 * const mockExecutor = vi.fn().mockResolvedValue({ stdout: '...', failed: false });
 * const discover = createDiscovery(mockExecutor);
 * ```
 */
export function createDiscovery(executor: CommandExecutor = execa) {
  return async function discoverInstances(): Promise<DiscoveryResult> {
    const result = await executor('agent-env', ['list', '--json'], {
      timeout: DEFAULT_TIMEOUT,
      reject: false,
    });

    if (result.failed) {
      let errorMessage: string;
      if (result.timedOut) {
        errorMessage = `Command timed out after ${DEFAULT_TIMEOUT}ms`;
      } else {
        errorMessage = result.stderr || result.shortMessage || 'Unknown error';
      }
      return { instances: [], error: `DISCOVERY_FAILED: ${errorMessage}` };
    }

    try {
      const parsed: AgentEnvJsonOutput = JSON.parse(result.stdout);
      if (!parsed.ok || !parsed.data) {
        const msg = parsed.error?.message ?? 'Unknown error';
        return { instances: [], error: `DISCOVERY_FAILED: ${msg}` };
      }
      return { instances: parsed.data, error: null };
    } catch {
      return { instances: [], error: 'DISCOVERY_FAILED: Invalid JSON response' };
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
export const discoverInstances = createDiscovery();
