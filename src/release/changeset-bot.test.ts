import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PROJECT_ROOT } from './changeset-test-utils.js';

/**
 * Validates FR32 (changeset bot) is delivered via the changeset-bot GitHub App,
 * NOT via a workflow Action. The changesets/bot repository is a GitHub App with
 * no action.yml — any workflow referencing it would fail at runtime.
 *
 * Architecture source: _bmad-output/planning-artifacts/release-infrastructure/architecture.md
 * Story: rel-3-3 (Add Publish Status and Version Visibility)
 *
 * The changeset-bot GitHub App is installed on the repository at:
 *   https://github.com/apps/changeset-bot
 * It automatically comments on PRs showing changeset coverage — no workflow needed.
 */

const BOT_WORKFLOW_PATH = resolve(PROJECT_ROOT, '.github/workflows/changeset-bot.yml');

describe('FR32 changeset bot is delivered via GitHub App (not workflow)', () => {
  it('changeset-bot.yml workflow file must NOT exist (App replaces it)', () => {
    expect(existsSync(BOT_WORKFLOW_PATH)).toBe(false);
  });

  it('no workflow file references changesets/bot action', () => {
    // Verify no other workflow accidentally references the non-existent action
    const workflowDir = resolve(PROJECT_ROOT, '.github/workflows');
    const files = readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));
    for (const file of files) {
      const content = readFileSync(resolve(workflowDir, file), 'utf-8');
      expect(content).not.toContain('changesets/bot@');
    }
  });
});
