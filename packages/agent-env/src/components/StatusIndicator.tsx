/**
 * StatusIndicator component for displaying git state as colored indicators
 *
 * Maps GitStateResult to visual indicators:
 * - ✓ (green): clean state
 * - ● (yellow): uncommitted changes (staged, unstaged, or untracked)
 * - ↑ (blue): unpushed commits
 * - ⚠ N (red): never-pushed branches with count
 * - ? (gray): unavailable / error
 */

import { Text } from 'ink';
import React from 'react';

import type { GitStateResult } from '../lib/types.js';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface StatusIndicatorProps {
  gitState: GitStateResult | null;
}

// ─── Indicator logic ────────────────────────────────────────────────────────

export interface Indicator {
  symbol: string;
  color: string;
}

/**
 * Convert a GitStateResult into an ordered list of indicators.
 *
 * Order: ● (uncommitted) → ↑ (unpushed) → ⚠ N (never-pushed)
 * Clean state: ✓
 * Unavailable: ?
 */
export function formatGitIndicators(gitState: GitStateResult | null): Indicator[] {
  if (!gitState || !gitState.ok) {
    return [{ symbol: '?', color: 'gray' }];
  }

  const state = gitState.state;

  if (state.isClean) {
    return [{ symbol: '✓', color: 'green' }];
  }

  const indicators: Indicator[] = [];

  // Uncommitted changes (staged, unstaged, or untracked)
  if (state.hasStaged || state.hasUnstaged || state.hasUntracked) {
    indicators.push({ symbol: '●', color: 'yellow' });
  }

  // Unpushed commits on any branch
  if (state.unpushedBranches.length > 0) {
    indicators.push({ symbol: '↑', color: 'blue' });
  }

  // Never-pushed branches with count
  if (state.neverPushedBranches.length > 0) {
    indicators.push({
      symbol: `⚠ ${state.neverPushedBranches.length}`,
      color: 'red',
    });
  }

  // Fallback: detached HEAD or stash-only (not clean but no standard indicators)
  if (indicators.length === 0) {
    indicators.push({ symbol: '●', color: 'yellow' });
  }

  return indicators;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function StatusIndicator({ gitState }: StatusIndicatorProps): React.ReactElement {
  const indicators = formatGitIndicators(gitState);

  return (
    <Text>
      {indicators.map((ind, i) => (
        <Text key={ind.symbol} color={ind.color}>
          {i > 0 ? ' ' : ''}
          {ind.symbol}
        </Text>
      ))}
    </Text>
  );
}
