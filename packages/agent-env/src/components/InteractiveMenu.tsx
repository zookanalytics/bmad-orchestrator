/**
 * InteractiveMenu component for selecting and attaching to instances
 *
 * Displays a navigable list of instances using @inkjs/ui Select component.
 * Shows name, status, git state indicator, and purpose for each instance.
 * On selection, triggers the attach callback with the chosen instance name.
 */

import { Select } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React from 'react';

import type { Instance, InstanceDisplayStatus } from '../lib/list-instances.js';

import { formatGitIndicators } from './StatusIndicator.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const COLUMN_PADDING = 2; // Padding between name, status, git, purpose
const SELECT_PREFIX_WIDTH = 4; // Width of the Select component's arrow prefix "  > "

// ─── Props ──────────────────────────────────────────────────────────────────

export interface InteractiveMenuProps {
  instances: Instance[];
  onSelect: (instanceName: string) => void;
  terminalWidth?: number;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function statusSymbol(status: InstanceDisplayStatus): string {
  switch (status) {
    case 'running':
      return '▶';
    case 'stopped':
      return '■';
    case 'orphaned':
      return '✗';
    case 'unknown':
      return '?';
    case 'not-found':
      return '✗';
  }
}

function gitIndicatorString(gitState: Instance['gitState']): string {
  const indicators = formatGitIndicators(gitState);
  return indicators.map((ind) => ind.symbol).join(' ');
}

function truncatePurpose(purpose: string | null, maxLen: number): string {
  if (!purpose) return '';
  if (maxLen <= 3) return '';
  if (purpose.length <= maxLen) return purpose;
  return purpose.slice(0, maxLen - 3) + '...';
}

/**
 * Build a display label for a single instance option in the select menu.
 *
 * Format: "name  status  git  purpose"
 */
export function buildOptionLabel(instance: Instance, terminalWidth: number): string {
  const name = instance.name;
  const status = statusSymbol(instance.status);
  const git = gitIndicatorString(instance.gitState);

  // Fixed parts: "name  status  git  "
  // We pad to consistent widths
  const fixedWidth =
    name.length + COLUMN_PADDING + status.length + COLUMN_PADDING + git.length + COLUMN_PADDING;
  // Reserve space for the Select component's arrow prefix "  > " (4 chars)
  const availableForPurpose = Math.max(0, terminalWidth - fixedWidth - SELECT_PREFIX_WIDTH);

  const purpose = truncatePurpose(instance.purpose, availableForPurpose);
  const parts = [name, status, git];
  if (purpose) {
    parts.push(purpose);
  }
  return parts.join('  ');
}

// ─── Component ──────────────────────────────────────────────────────────────

export function InteractiveMenu({
  instances,
  onSelect,
  terminalWidth,
}: InteractiveMenuProps): React.ReactElement {
  const width = terminalWidth ?? process.stdout.columns ?? 80;

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

  const options = instances.map((instance) => ({
    label: buildOptionLabel(instance, width),
    value: instance.name,
  }));

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Select an instance to attach:</Text>
      </Box>
      <Select options={options} onChange={onSelect} />
    </Box>
  );
}
