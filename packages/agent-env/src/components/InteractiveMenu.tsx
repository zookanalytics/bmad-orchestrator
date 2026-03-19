/**
 * InteractiveMenu component for managing a single instance
 *
 * Shows a header with instance info and an action select list.
 * Supports inline "Set Purpose" flow with TextInput.
 */

import { Select, TextInput } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import React, { useState } from 'react';

import type { InstanceDisplayStatus, InstanceInfo } from '../lib/list-instances.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MenuAction = 'attach' | 'code' | 'rebuild' | 'set-purpose' | 'exit';

export interface ActionMenuProps {
  instanceInfo: InstanceInfo;
  onAction: (action: MenuAction) => void;
  onSetPurpose: (value: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusSymbol(status: InstanceDisplayStatus): string {
  switch (status) {
    case 'running':
      return '▶';
    case 'stopped':
      return '■';
    case 'orphaned':
    case 'not-found':
      return '✗';
    case 'unknown':
      return '?';
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PurposeInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text>
          <Text bold>Purpose:</Text> <Text color="gray">(Escape to cancel)</Text>
        </Text>
      </Box>
      <TextInput placeholder="Enter purpose..." onSubmit={onSubmit} />
    </Box>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { label: '🚀 Attach to session', value: 'attach' },
  { label: '💻 Open in VS Code', value: 'code' },
  { label: '🛠  Rebuild container', value: 'rebuild' },
  { label: '📝 Set Purpose', value: 'set-purpose' },
  { label: '🚪 Exit', value: 'exit' },
];

export function InteractiveMenu({
  instanceInfo,
  onAction,
  onSetPurpose,
}: ActionMenuProps): React.ReactElement {
  const [mode, setMode] = useState<'actions' | 'set-purpose'>('actions');

  const { name, status, repoSlug, purpose } = instanceInfo;
  const symbol = statusSymbol(status);

  const handleActionChange = (value: string) => {
    if (value === 'set-purpose') {
      setMode('set-purpose');
      return;
    }
    onAction(value as MenuAction);
  };

  const handlePurposeSubmit = (value: string) => {
    onSetPurpose(value);
  };

  const handlePurposeCancel = () => {
    setMode('actions');
  };

  // Build header parts
  const headerParts = [name, symbol, repoSlug];
  if (purpose !== null) {
    headerParts.push(purpose);
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>{headerParts.join(' · ')}</Text>
      </Box>
      {mode === 'actions' ? (
        <Select options={ACTION_OPTIONS} onChange={handleActionChange} />
      ) : (
        <PurposeInput onSubmit={handlePurposeSubmit} onCancel={handlePurposeCancel} />
      )}
    </Box>
  );
}
