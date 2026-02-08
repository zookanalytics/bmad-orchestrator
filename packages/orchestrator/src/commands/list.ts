/**
 * List command handler for displaying discovered instances
 *
 * @module commands/list
 */
import { createError, formatError } from '@zookanalytics/shared';

import type { Instance, DiscoveryResult } from '../lib/types.js';

import { createDiscovery } from '../lib/discovery.js';

/** Discovery function type */
type DiscoveryFn = () => Promise<DiscoveryResult>;

/** Options for the list command */
export interface ListOptions {
  json?: boolean;
}

/** JSON output format for the list command */
export interface ListJsonOutput {
  version: '1';
  instances: Instance[];
  errors: string[];
}

/**
 * Format a single instance as a table row
 *
 * @param instance - Instance to format
 * @param columnWidths - Calculated widths for table columns
 * @returns Formatted table row string
 */
function formatInstanceRow(
  instance: Instance,
  columnWidths: { name: number; status: number }
): string {
  const name = instance.name.padEnd(columnWidths.name);
  const status = instance.status.padEnd(columnWidths.status);
  const purpose = instance.purpose ?? '-';
  return `${name} ${status} ${purpose}`;
}

/**
 * Format discovery result as JSON output
 *
 * @param result - Discovery result to format
 * @returns JSON string with version, instances, and errors
 */
function formatJsonOutput(result: DiscoveryResult): string {
  const output: ListJsonOutput = {
    version: '1',
    instances: result.instances,
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
    return formatError(
      createError(
        'DISCOVERY_FAILED',
        result.error.replace('DISCOVERY_FAILED: ', ''),
        'Check if agent-env CLI is available with `agent-env --version`'
      )
    );
  }

  if (result.instances.length === 0) {
    return 'No instances discovered';
  }

  const nameHeader = 'NAME';
  const statusHeader = 'STATUS';
  const purposeHeader = 'PURPOSE';

  const nameWidth = Math.max(nameHeader.length, ...result.instances.map((i) => i.name.length));
  const statusWidth = Math.max(
    statusHeader.length,
    ...result.instances.map((i) => i.status.length)
  );

  const columnWidths = {
    name: nameWidth + 2,
    status: statusWidth + 2,
  };

  const header = `${nameHeader.padEnd(columnWidths.name)} ${statusHeader.padEnd(columnWidths.status)} ${purposeHeader}`;
  const separator = '-'.repeat(header.length);
  const rows = result.instances.map((instance) => formatInstanceRow(instance, columnWidths));

  return [header, separator, ...rows].join('\n');
}

/**
 * Execute the list command
 *
 * @param options - Command options (json flag)
 * @param discover - Optional discovery function for dependency injection (defaults to createDiscovery())
 * @returns Formatted output string (table or JSON)
 */
export async function listCommand(
  options: ListOptions = {},
  discover: DiscoveryFn = createDiscovery()
): Promise<string> {
  const result = await discover();

  if (options.json) {
    return formatJsonOutput(result);
  }

  return formatTextOutput(result);
}
