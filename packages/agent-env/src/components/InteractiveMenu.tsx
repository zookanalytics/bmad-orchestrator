/**
 * InteractiveMenu component for selecting and managing instances
 *
 * Displays a navigable list of instances using @inkjs/ui Select component.
 * On selection, shows an action menu for the chosen instance (Attach, Rebuild, etc.).
 */

import { Select } from '@inkjs/ui';
import { Box, Text } from 'ink';
import React, { useState } from 'react';

import type { Instance, InstanceDisplayStatus } from '../lib/list-instances.js';

import { formatGitIndicators } from './StatusIndicator.js';

// ─── Constants ──────────────────────────────────────────────────────────────

const COLUMN_PADDING = 2; // Padding between name, status, git, purpose
const SELECT_PREFIX_WIDTH = 4; // Width of the Select component's arrow prefix "  > "

// ─── Types ───────────────────────────────────────────────────────────────────

export type InstanceAction = 'attach' | 'rebuild' | 'purpose' | 'remove';

export interface InteractiveMenuProps {
  instances: Instance[];
  onAction: (action: InstanceAction, instanceName: string) => void;
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
 */
export function buildOptionLabel(instance: Instance, terminalWidth: number): string {
  const name = instance.name;
  const status = statusSymbol(instance.status);
  const git = gitIndicatorString(instance.gitState);

  const fixedWidth =
    name.length + COLUMN_PADDING + status.length + COLUMN_PADDING + git.length + COLUMN_PADDING;
  const availableForPurpose = Math.max(0, terminalWidth - fixedWidth - SELECT_PREFIX_WIDTH);

  const purpose = truncatePurpose(instance.purpose, availableForPurpose);
  const parts = [name, status, git];
  if (purpose) {
    parts.push(purpose);
  }
  return parts.join('  ');
}

// ─── Components ─────────────────────────────────────────────────────────────

function ActionMenu({
  instanceName,
  onSelectAction,
}: {
  instanceName: string;
  onSelectAction: (action: InstanceAction) => void;
}) {
  const options = [
    { label: '🚀 Attach to session', value: 'attach' as const },
    { label: '🛠  Rebuild container', value: 'rebuild' as const },
    { label: '📝 Show purpose', value: 'purpose' as const },
    { label: '🗑  Remove instance', value: 'remove' as const },
  ];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text>
          Manage{' '}
          <Text bold color="cyan">
            {instanceName}
          </Text>
          :
        </Text>
      </Box>
      <Select options={options} onChange={onSelectAction as (value: string) => void} />
    </Box>
  );
}

export function InteractiveMenu({
  instances,
  onAction,
  terminalWidth,
}: InteractiveMenuProps): React.ReactElement {
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
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

  // Step 2: Select action
  if (selectedInstance) {
    return (
      <ActionMenu
        instanceName={selectedInstance}
        onSelectAction={(action) => onAction(action, selectedInstance)}
      />
    );
  }

  // Step 1: Select instance
  const options = instances.map((instance) => ({
    label: buildOptionLabel(instance, width),
    value: instance.name,
  }));

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Select an instance:</Text>
      </Box>
      <Select options={options} onChange={setSelectedInstance} />
    </Box>
  );
}
