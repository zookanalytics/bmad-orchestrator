/**
 * Safety report formatting for remove command
 *
 * Produces severity-tagged, color-coded terminal output showing exactly what
 * blocks instance removal, with actionable suggestions for each issue.
 */
import chalk from 'chalk';

import type { GitState } from './types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = 'Warning' | 'Danger';

interface ReportItem {
  severity: Severity;
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BLOCKER_NEVER_PUSHED = 'never pushed';
const BLOCKER_DETACHED_HEAD = 'detached HEAD';

// ─── Severity Classification ─────────────────────────────────────────────────

/**
 * Classify a blocker string into a severity level.
 *
 * Danger (data loss risk): never-pushed branches, detached HEAD
 * Warning (recoverable): staged, unstaged, untracked, stashed, unpushed
 */
function classifyBlocker(blocker: string): Severity {
  if (blocker.includes(BLOCKER_NEVER_PUSHED) || blocker.includes(BLOCKER_DETACHED_HEAD)) {
    return 'Danger';
  }
  return 'Warning';
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

type SuggestionGenerator = (gitState: GitState) => string;

const SUGGESTION_CONFIG: {
  condition: (gitState: GitState) => boolean;
  generator: SuggestionGenerator;
}[] = [
  {
    condition: (gitState) => gitState.hasStaged,
    generator: () => 'Run `git commit` to commit staged changes',
  },
  {
    condition: (gitState) => gitState.hasUnstaged,
    generator: () => 'Run `git add` and `git commit` to save unstaged changes',
  },
  {
    condition: (gitState) => gitState.hasUntracked,
    generator: () => 'Run `git add` to track untracked files, then commit',
  },
  {
    condition: (gitState) => gitState.stashCount > 0,
    generator: () =>
      'Run `git stash pop` to apply stashed changes, or `git stash drop` to discard them',
  },
  {
    condition: (gitState) => gitState.unpushedBranches.length > 0,
    generator: (gitState) =>
      `Run \`git push\` to push unpushed commits on: ${gitState.unpushedBranches.join(', ')}`,
  },
  {
    condition: (gitState) => gitState.neverPushedBranches.length > 0,
    generator: (gitState) =>
      `Run \`git push -u origin <branch>\` for never-pushed branches: ${gitState.neverPushedBranches.join(', ')}`,
  },
  {
    condition: (gitState) => gitState.isDetachedHead,
    generator: () =>
      'Run `git checkout <branch>` to reattach HEAD, or `git checkout -b <new-branch>` to save work',
  },
];

/**
 * Return actionable suggestions based on git state.
 * Each suggestion tells the user exactly what command to run.
 */
export function getSuggestions(gitState: GitState): string[] {
  return SUGGESTION_CONFIG.filter((entry) => entry.condition(gitState)).map((entry) =>
    entry.generator(gitState)
  );
}

// ─── Report Formatting ──────────────────────────────────────────────────────

/**
 * Format a comprehensive safety report for terminal display.
 *
 * Produces a structured report with:
 * - Header with instance name
 * - Severity-tagged blocker list
 * - Actionable suggestions
 * - Hint about --force flag
 *
 * @param instanceName - The instance that failed safety checks
 * @param blockers - List of blocker strings from evaluateSafetyChecks()
 * @param gitState - The full git state for generating suggestions
 * @returns Formatted multi-line string for terminal output
 */
export function formatSafetyReport(
  instanceName: string,
  blockers: string[],
  gitState: GitState
): string {
  const lines: string[] = [];

  // Header
  lines.push(`Cannot remove '${instanceName}' — safety checks failed:`);
  lines.push('');

  // Blocker list with severity
  const items: ReportItem[] = blockers.map((blocker) => ({
    severity: classifyBlocker(blocker),
    message: blocker,
  }));

  for (const item of items) {
    const prefix = item.severity === 'Danger' ? chalk.red('[Danger]') : chalk.yellow('[Warning]');
    lines.push(`  ${prefix} ${item.message}`);
  }

  // Suggestions
  const suggestions = getSuggestions(gitState);
  if (suggestions.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Suggestions:'));
    for (const suggestion of suggestions) {
      lines.push(`  - ${suggestion}`);
    }
  }

  // Force hint
  lines.push('');
  lines.push(chalk.gray('Or use --force to bypass safety checks (data loss is permanent).'));

  return lines.join('\n');
}
