/**
 * MenuContainer — wraps InteractiveMenu with drift-state polling.
 *
 * The container polls `detectDriftState()` periodically while the menu is
 * visible so the banner and Restart action appear automatically if the user
 * upgrades agent-env in another terminal.
 */

import React, { useEffect, useState } from 'react';

import type { InstanceInfo } from '../lib/list-instances.js';
import type { VersionDriftState } from '../lib/version-drift.js';

import { detectDriftState, getCurrentVersion } from '../lib/version-drift.js';
import { InteractiveMenu, type MenuAction } from './InteractiveMenu.js';

/**
 * Interval between drift probes while the menu sits idle with no user input.
 *
 * The container also runs an immediate probe whenever the menu mounts, and
 * the menu re-mounts after every action (including returning from an
 * attached tmux session), so this interval only matters for sessions that
 * sit on the menu screen untouched for a long time. 10 minutes is a safe
 * balance between "catches a new version eventually" and "doesn't waste
 * work on the npm registry's 1-hour cache".
 */
const DRIFT_POLL_INTERVAL_MS = 10 * 60 * 1000;

export interface MenuContainerProps {
  instanceInfo: InstanceInfo;
  onAction: (action: MenuAction) => void;
  onSetPurpose: (value: string) => void;
  /** Initial drift snapshot — if omitted, the container runs its own first probe. */
  initialDriftState?: VersionDriftState;
  /** Override for tests. */
  detectDriftStateFn?: () => Promise<VersionDriftState>;
  /** Override for tests — defaults to 30 seconds. */
  pollIntervalMs?: number;
}

/**
 * Neutral drift state used as the initial value when no explicit
 * `initialDriftState` is provided. Treating "unknown" as "clean" lets the
 * menu show its "Check for updates" affordance immediately on first render
 * instead of briefly flashing the shorter no-drift action list.
 */
function makeNeutralDriftState(): VersionDriftState {
  return {
    packageMoved: false,
    updateMessage: null,
    installedVersion: null,
    currentVersion: getCurrentVersion(),
  };
}

export function MenuContainer({
  instanceInfo,
  onAction,
  onSetPurpose,
  initialDriftState,
  detectDriftStateFn = detectDriftState,
  pollIntervalMs = DRIFT_POLL_INTERVAL_MS,
}: MenuContainerProps): React.ReactElement {
  const [driftState, setDriftState] = useState<VersionDriftState>(
    initialDriftState ?? makeNeutralDriftState()
  );

  useEffect(() => {
    let cancelled = false;

    const runProbe = async () => {
      try {
        const next = await detectDriftStateFn();
        if (!cancelled) {
          setDriftState(next);
        }
      } catch {
        // Drift detection must never crash the menu.
      }
    };

    // Run an immediate probe so the banner can appear on first render.
    void runProbe();

    const handle = setInterval(() => {
      void runProbe();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [detectDriftStateFn, pollIntervalMs]);

  return (
    <InteractiveMenu
      instanceInfo={instanceInfo}
      onAction={onAction}
      onSetPurpose={onSetPurpose}
      driftState={driftState}
    />
  );
}
