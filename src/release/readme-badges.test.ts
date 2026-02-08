import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PROJECT_ROOT } from './changeset-test-utils.js';

/**
 * Validates that README.md contains required status badges for pipeline
 * health visibility and npm version tracking.
 *
 * Architecture source: _bmad-output/planning-artifacts/release-infrastructure/architecture.md
 * Story: rel-3-3 (Add Publish Status and Version Visibility)
 *
 * Key requirements validated:
 * - GitHub Actions publish workflow status badge (FR25)
 * - npm version badge for @zookanalytics/agent-env
 * - Badges positioned prominently near the top of README
 */

const README_PATH = resolve(PROJECT_ROOT, 'README.md');

function loadReadme(): string {
  return readFileSync(README_PATH, 'utf-8');
}

describe('README badges (FR25, rel-3-3)', () => {
  it('README.md exists at project root', () => {
    expect(() => readFileSync(README_PATH, 'utf-8')).not.toThrow();
  });

  it('contains GitHub Actions publish workflow status badge', () => {
    const readme = loadReadme();
    // Badge must reference the publish.yml workflow on main branch
    expect(readme).toContain('actions/workflows/publish.yml/badge.svg');
    expect(readme).toContain('branch=main');
  });

  it('contains npm version badge for @zookanalytics/agent-env', () => {
    const readme = loadReadme();
    // Must reference the scoped package name (URL-encoded or path-based)
    expect(readme).toMatch(/npm\/v\/@?zookanalytics/i);
  });

  it('badges appear in the first 10 lines (prominent positioning)', () => {
    const readme = loadReadme();
    const firstLines = readme.split('\n').slice(0, 10).join('\n');
    // Both badges should be near the top
    expect(firstLines).toContain('badge.svg');
    expect(firstLines).toMatch(/npm/i);
  });

  it('publish badge links to the workflow runs page', () => {
    const readme = loadReadme();
    // Badge should be wrapped in a link to the Actions workflow page
    expect(readme).toContain(
      'github.com/ZookAnalytics/bmad-orchestrator/actions/workflows/publish.yml'
    );
  });

  it('npm badge links to the npm package page', () => {
    const readme = loadReadme();
    // Badge should link to the npm package
    expect(readme).toContain('npmjs.com/package/@zookanalytics/agent-env');
  });
});
