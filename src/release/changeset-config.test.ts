import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CHANGESET_DIR } from './changeset-test-utils.js';

const PROJECT_REPO = 'ZookAnalytics/bmad-orchestrator';

/**
 * Validates .changeset/config.json matches the architecture specification.
 * Catches config drift that could break the publishing pipeline.
 *
 * Architecture source: _bmad-output/planning-artifacts/release-infrastructure/architecture.md
 * Story: rel-2-3 (Create Manual Changeset Workflow)
 */

const CONFIG_PATH = join(CHANGESET_DIR, 'config.json');

function loadConfig(): Record<string, unknown> {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('changeset config', () => {
  it('has a config.json file', () => {
    expect(() => readFileSync(CONFIG_PATH, 'utf-8')).not.toThrow();
  });

  it('uses @changesets/changelog-github with correct repo', () => {
    const config = loadConfig();
    expect(config.changelog).toEqual(['@changesets/changelog-github', { repo: PROJECT_REPO }]);
  });

  it('has public access for npm publishing', () => {
    const config = loadConfig();
    expect(config.access).toBe('public');
  });

  it('targets main as base branch', () => {
    const config = loadConfig();
    expect(config.baseBranch).toBe('main');
  });

  it('sets updateInternalDependencies to patch for workspace:* rewriting', () => {
    const config = loadConfig();
    expect(config.updateInternalDependencies).toBe('patch');
  });

  it('does not auto-commit (changesets/action handles commits in CI)', () => {
    const config = loadConfig();
    expect(config.commit).toBe(false);
  });

  it('has empty ignore array (relies on private: true for exclusion)', () => {
    const config = loadConfig();
    expect(config.ignore).toEqual([]);
  });

  it('has empty fixed and linked arrays (single publishable package MVP)', () => {
    const config = loadConfig();
    expect(config.fixed).toEqual([]);
    expect(config.linked).toEqual([]);
  });
});
