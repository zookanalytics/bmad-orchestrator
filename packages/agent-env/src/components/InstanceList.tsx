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

import { formatGitIndicators } from './StatusIndicator.js';

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

  // Pre-calculate expensive-to-render data
  const augmentedInstances = instances.map((instance) => {
    const indicators = formatGitIndicators(instance.gitState);
    const indicatorText = indicators.map((ind) => ind.symbol).join(' ');
    return { ...instance, indicators, indicatorText };
  });

  // Calculate column widths
  const nameWidth = Math.max(4, ...augmentedInstances.map((i) => i.name.length)) + 2;
  const statusWidth =
    Math.max(6, ...augmentedInstances.map((i) => statusLabel(i.status, dockerAvailable).length)) +
    2;
  const gitWidth = Math.max(3, ...augmentedInstances.map((i) => i.indicatorText.length)) + 2;
  const lastAttachedWidth =
    Math.max(13, ...augmentedInstances.map((i) => formatLastAttached(i.lastAttached).length)) + 2;

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text bold>{pad('NAME', nameWidth)}</Text>
        <Text bold>{pad('STATUS', statusWidth)}</Text>
        <Text bold>{pad('GIT', gitWidth)}</Text>
        <Text bold>{pad('LAST ATTACHED', lastAttachedWidth)}</Text>
        <Text bold>PURPOSE</Text>
      </Box>

      {/* Rows */}
      {augmentedInstances.map((instance) => (
        <Box key={instance.name}>
          <Text>{pad(instance.name, nameWidth)}</Text>
          <Text color={statusColor(instance.status)}>
            {pad(statusLabel(instance.status, dockerAvailable), statusWidth)}
          </Text>
          <Box width={gitWidth}>
            {instance.indicators.map((ind, idx) => (
              <Text key={idx} color={ind.color}>
                {idx > 0 ? ' ' : ''}
                {ind.symbol}
              </Text>
            ))}
          </Box>
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
