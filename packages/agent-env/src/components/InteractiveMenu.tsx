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

import { isNewerVersion, type VersionDriftState } from '../lib/version-drift.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MenuAction =
  | 'attach'
  | 'code'
  | 'rebuild'
  | 'shutdown'
  | 'set-purpose'
  | 'check-updates'
  | 'restart'
  | 'exit';

export interface ActionMenuProps {
  instanceInfo: InstanceInfo;
  onAction: (action: MenuAction) => void;
  onSetPurpose: (value: string) => void;
  /** Optional drift state. When present, menu shows a banner and a Restart action. */
  driftState?: VersionDriftState;
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

const BASE_ACTION_OPTIONS = [
  { label: '🚀 Attach to session', value: 'attach' },
  { label: '💻 Open in VS Code', value: 'code' },
  { label: '🛠  Rebuild container', value: 'rebuild' },
  { label: '⏹  Shutdown container', value: 'shutdown' },
  { label: '📝 Set Purpose', value: 'set-purpose' },
];

const EXIT_OPTION = { label: '🚪 Exit', value: 'exit' };

const RESTART_REQUIRED_OPTION = {
  label: '♻️  Restart menu (required — agent-env was upgraded)',
  value: 'restart',
};

const CHECK_FOR_UPDATES_OPTION = {
  label: '🔄 Check for updates',
  value: 'check-updates',
};

/** True when the PATH-resolved binary is newer than this running process. */
function hasNewerInstall(driftState?: VersionDriftState): boolean {
  if (!driftState?.installedVersion) return false;
  return isNewerVersion(driftState.currentVersion, driftState.installedVersion);
}

/**
 * Build the action list for the menu.
 *
 * Priority order for the extra slot:
 * 1. **packageMoved** — critical; Restart at top (rebuild would crash).
 * 2. **installedVersion > currentVersion** — user already upgraded; Restart
 *    at top (no pnpm needed, just restart).
 * 3. **updateMessage but not yet installed** — informational; "Check for
 *    updates" above Exit with a banner showing `pnpm add -g` instructions.
 * 4. **Nothing detected** — "Check for updates" above Exit, no banner.
 */
function buildActionOptions(driftState?: VersionDriftState): typeof BASE_ACTION_OPTIONS {
  if (driftState?.packageMoved) {
    return [RESTART_REQUIRED_OPTION, ...BASE_ACTION_OPTIONS, EXIT_OPTION];
  }
  if (driftState && hasNewerInstall(driftState)) {
    const label = `♻️  Restart menu (v${driftState.installedVersion} installed)`;
    return [{ label, value: 'restart' }, ...BASE_ACTION_OPTIONS, EXIT_OPTION];
  }
  if (driftState?.updateMessage) {
    // Newer version on npm but not installed yet — show informational
    // "Check for updates" (not Restart, since restarting wouldn't help).
    return [...BASE_ACTION_OPTIONS, CHECK_FOR_UPDATES_OPTION, EXIT_OPTION];
  }
  if (driftState) {
    return [...BASE_ACTION_OPTIONS, CHECK_FOR_UPDATES_OPTION, EXIT_OPTION];
  }
  return [...BASE_ACTION_OPTIONS, EXIT_OPTION];
}

function DriftBanner({ driftState }: { driftState: VersionDriftState }): React.ReactElement | null {
  // Critical: baseline config is gone, rebuild will crash.
  if (driftState.packageMoved) {
    return (
      <Box marginBottom={1} flexDirection="column">
        <Text color="red" bold>
          ⚠ agent-env was upgraded since this menu started.
        </Text>
        <Text color="red">Rebuild and other commands will fail until you restart the menu.</Text>
      </Box>
    );
  }
  // User already installed a newer version — just needs a restart.
  if (hasNewerInstall(driftState)) {
    return (
      <Box marginBottom={1}>
        <Text color="yellow">
          agent-env v{driftState.installedVersion} is installed — restart to use it
        </Text>
      </Box>
    );
  }
  // Newer version on npm but not installed yet — show pnpm instructions.
  if (driftState.updateMessage) {
    return (
      <Box marginBottom={1} flexDirection="column">
        <Text color="yellow">{driftState.updateMessage}</Text>
      </Box>
    );
  }
  return null;
}

export function InteractiveMenu({
  instanceInfo,
  onAction,
  onSetPurpose,
  driftState,
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

  const actionOptions = buildActionOptions(driftState);

  return (
    <Box flexDirection="column">
      {driftState ? <DriftBanner driftState={driftState} /> : null}
      <Box marginBottom={1}>
        <Text bold>{headerParts.join(' · ')}</Text>
      </Box>
      {mode === 'actions' ? (
        <Select
          options={actionOptions}
          onChange={handleActionChange}
          visibleOptionCount={actionOptions.length}
        />
      ) : (
        <PurposeInput onSubmit={handlePurposeSubmit} onCancel={handlePurposeCancel} />
      )}
    </Box>
  );
}
