/**
 * List command handler for displaying discovered DevPods
 *
 * @module commands/list
 */
import type { DevPod, DiscoveryResult } from '../lib/types.js';

import { createDiscovery } from '../lib/discovery.js';

/** Options for the list command */
export interface ListOptions {
  json?: boolean;
}

/** JSON output format for the list command */
export interface ListJsonOutput {
  version: '1';
  devpods: DevPod[];
  errors: string[];
}

/** Error format for user-friendly error display */
interface AppError {
  code: string;
  context?: string;
  suggestion?: string;
}

/**
 * Format an error for display to the user
 *
 * @param error - Error details to format
 * @returns Formatted error string with code, context, and suggestion
 */
function formatError(error: AppError): string {
  const parts = [`✗ ${error.code}`];
  if (error.context) parts[0] += `: ${error.context}`;
  if (error.suggestion) parts.push(`  Suggestion: ${error.suggestion}`);
  return parts.join('\n');
}

/**
 * Get workspace path from DevPod source
 *
 * @param pod - DevPod to extract workspace path from
 * @returns Workspace path string or '-' if not available
 */
function getWorkspacePath(pod: DevPod): string {
  if (pod.source?.localFolder) {
    return pod.source.localFolder;
  }
  if (pod.source?.gitRepository) {
    return pod.source.gitRepository;
  }
  return '-';
}

/**
 * Format a single DevPod as a table row
 *
 * @param pod - DevPod to format
 * @returns Formatted table row string
 */
function formatDevPodRow(pod: DevPod): string {
  const name = pod.id.padEnd(20);
  const workspace = getWorkspacePath(pod).padEnd(40);
  const provider = pod.provider?.name || 'unknown';
  // Note: devpod list doesn't return status - would need separate devpod status call
  // For MVP, we show provider name as the "status" column since it's what we have
  return `${name} ${workspace} ${provider}`;
}

/**
 * Format discovery result as JSON output
 *
 * @param result - Discovery result to format
 * @returns JSON string with version, devpods, and errors
 */
function formatJsonOutput(result: DiscoveryResult): string {
  const output: ListJsonOutput = {
    version: '1',
    devpods: result.devpods,
    errors: result.error ? [result.error] : [],
  };
  return JSON.stringify(output, null, 2);
}

/**
 * Format discovery result as plain text table
 *
 * @param result - Discovery result to format
 * @returns Formatted table string or error/empty message
 */
function formatTextOutput(result: DiscoveryResult): string {
  if (result.error) {
    return formatError({
      code: 'DISCOVERY_FAILED',
      context: result.error.replace('DISCOVERY_FAILED: ', ''),
      suggestion: 'Check if DevPod CLI is installed with `devpod version`',
    });
  }

  if (result.devpods.length === 0) {
    return 'No DevPods discovered';
  }

  // Format as table
  const header = 'NAME                 WORKSPACE                                PROVIDER';
  const separator = '-'.repeat(header.length);
  const rows = result.devpods.map(formatDevPodRow);

  return [header, separator, ...rows].join('\n');
}

/**
 * Execute the list command
 *
 * @param options - Command options (json flag)
 * @returns Formatted output string (table or JSON)
 *
 * @example
 * ```typescript
 * // Plain text output
 * const output = await listCommand({});
 * console.log(output);
 *
 * // JSON output
 * const jsonOutput = await listCommand({ json: true });
 * console.log(jsonOutput);
 * ```
 */
export async function listCommand(options: ListOptions = {}): Promise<string> {
  const discover = createDiscovery();
  const result = await discover();

  if (options.json) {
    return formatJsonOutput(result);
  }

  return formatTextOutput(result);
}
