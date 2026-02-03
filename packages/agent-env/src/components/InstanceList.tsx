/**
 * InstanceList component for displaying instances in a table format
 *
 * Uses Ink for terminal UI rendering with colored status indicators
 * and relative timestamps via timeago.js.
 */

import { Box, Text } from 'ink';
import React from 'react';
import { format as timeago } from 'timeago.js';

import type { InstanceInfo, InstanceDisplayStatus } from '../lib/list-instances.js';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface InstanceListProps {
  instances: InstanceInfo[];
  dockerAvailable: boolean;
}

// ─── Status colors ──────────────────────────────────────────────────────────

function statusColor(status: InstanceDisplayStatus): string {
  switch (status) {
    case 'running':
      return 'green';
    case 'stopped':
      return 'yellow';
    case 'orphaned':
      return 'red';
    case 'unknown':
      return 'gray';
    case 'not-found':
      return 'red';
  }
}

function statusLabel(status: InstanceDisplayStatus, dockerAvailable: boolean): string {
  if (!dockerAvailable && status === 'unknown') {
    return 'unknown (Docker unavailable)';
  }
  return status;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function formatLastAttached(lastAttached: string | null): string {
  if (!lastAttached) return '-';
  try {
    return timeago(lastAttached);
  } catch {
    return '-';
  }
}

function formatPurpose(purpose: string | null): string {
  if (!purpose) return '-';
  // Truncate long purposes
  if (purpose.length > 30) {
    return purpose.slice(0, 27) + '...';
  }
  return purpose;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function InstanceList({
  instances,
  dockerAvailable,
}: InstanceListProps): React.ReactElement {
  if (instances.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No instances found.</Text>
        <Text color="gray">
          Create one with: agent-env create {'<name>'} --repo {'<url>'}
        </Text>
      </Box>
    );
  }

  // Calculate column widths
  const nameWidth = Math.max(4, ...instances.map((i) => i.name.length)) + 2;
  const statusWidth =
    Math.max(6, ...instances.map((i) => statusLabel(i.status, dockerAvailable).length)) + 2;
  const lastAttachedWidth =
    Math.max(13, ...instances.map((i) => formatLastAttached(i.lastAttached).length)) + 2;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text bold>{pad('NAME', nameWidth)}</Text>
        <Text bold>{pad('STATUS', statusWidth)}</Text>
        <Text bold>{pad('LAST ATTACHED', lastAttachedWidth)}</Text>
        <Text bold>PURPOSE</Text>
      </Box>

      {/* Rows */}
      {instances.map((instance) => (
        <Box key={instance.name}>
          <Text>{pad(instance.name, nameWidth)}</Text>
          <Text color={statusColor(instance.status)}>
            {pad(statusLabel(instance.status, dockerAvailable), statusWidth)}
          </Text>
          <Text>{pad(formatLastAttached(instance.lastAttached), lastAttachedWidth)}</Text>
          <Text color="gray">{formatPurpose(instance.purpose)}</Text>
        </Box>
      ))}

      {/* Docker unavailable notice */}
      {!dockerAvailable && (
        <Box marginTop={1}>
          <Text color="yellow">
            ⚠ Docker is not available. Container status cannot be determined.
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pad(str: string, width: number): string {
  return str.padEnd(width);
}
