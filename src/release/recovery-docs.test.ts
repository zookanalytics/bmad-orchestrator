import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PROJECT_ROOT } from './changeset-test-utils.js';

/**
 * Validates inline recovery and Trusted Publishing documentation in publish.yml.
 * These tests ensure the documentation meets FR27 (npm deprecate rollback)
 * and FR28 (inline recovery docs) requirements.
 *
 * Story: rel-3-4 (Document Recovery and Trusted Publishing Procedures)
 *
 * Key requirements validated:
 * - AC1: Re-run recovery procedure with idempotency explanation (FR10, FR11, FR12, FR28)
 * - AC2: Trusted Publishing (OIDC) configuration documentation (FR29, FR30)
 * - AC3: npm deprecate rollback instructions (FR27)
 */

const PUBLISH_WORKFLOW_PATH = resolve(PROJECT_ROOT, '.github/workflows/publish.yml');

function loadWorkflowRaw(): string {
  return readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8');
}

describe('AC1: re-run recovery procedure documentation (FR10, FR11, FR12, FR28)', () => {
  it('documents idempotent re-run safety', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('idempotent');
    expect(raw).toContain('safe to re-run');
  });

  it('references FR10 (re-run without side effects)', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('FR10');
  });

  it('references FR11 (detect already-bumped versions)', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('FR11');
    expect(raw).toContain('already-bumped versions');
  });

  it('references FR12 (detect already-published versions)', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('FR12');
    expect(raw).toContain('checks npm registry before publishing');
  });

  it('documents primary recovery: re-run workflow for failed publish', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('PUBLISH FAILED');
    expect(raw).toContain('Re-run this workflow');
  });

  it('documents manual fallback recovery from local checkout', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('Manual fallback from local checkout');
    expect(raw).toContain('git checkout main');
    expect(raw).toContain('npm login');
    expect(raw).toContain('pnpm changeset publish');
  });

  it('documents changelog plugin failure workaround', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('CHANGELOG PLUGIN CRASHES');
    expect(raw).toContain('@changesets/changelog-git');
    expect(raw).toContain('Revert after the publish succeeds');
  });
});

describe('AC2: Trusted Publishing (OIDC) documentation (FR29, FR30)', () => {
  it('has a dedicated Trusted Publishing documentation section', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('TRUSTED PUBLISHING (OIDC)');
  });

  it('documents the linked package name', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('Package: @zookanalytics/agent-env');
  });

  it('documents the linked repository', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('Repository: ZookAnalytics/bmad-orchestrator');
  });

  it('documents the linked workflow name', () => {
    const raw = loadWorkflowRaw();
    // The Trusted Publishing section must specify which workflow file is configured
    expect(raw).toContain('Workflow: publish.yml');
  });

  it('explains how OIDC authentication works', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('id-token: write');
    expect(raw).toContain('OIDC token');
    expect(raw).toContain('no NPM_TOKEN needed');
  });

  it('provides step-by-step verification/fix instructions', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('To verify/fix Trusted Publishing');
    expect(raw).toContain('names must match exactly');
  });

  it('includes npm package settings URL for quick access', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('npmjs.com/package/@zookanalytics/agent-env/access');
  });

  it('references FR29 and FR30', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('FR29');
    expect(raw).toContain('FR30');
  });
});

describe('AC3: npm deprecate rollback instructions (FR27)', () => {
  it('has a dedicated rollback section', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('ROLLBACK');
    expect(raw).toContain('FR27');
  });

  it('provides the npm deprecate command with package name', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('npm deprecate @zookanalytics/agent-env@<version>');
  });

  it('explains deprecation behavior (warning on install)', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('warning on `npm install`');
  });

  it('explains npm unpublish limitation', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('does not allow unpublishing versions older than 72 hours');
  });

  it('documents how to undo deprecation', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('To undo deprecation');
  });

  it('documents follow-up: publish a fix version after deprecating', () => {
    const raw = loadWorkflowRaw();
    expect(raw).toContain('publish a fix version');
    expect(raw).toContain('pnpm changeset');
  });
});

describe('documentation is inline in publish.yml (not a separate file)', () => {
  it('recovery docs are in the same file as the publish step', () => {
    const raw = loadWorkflowRaw();
    // All docs must be in the same file that contains changesets/action
    expect(raw).toContain('changesets/action@v1');
    expect(raw).toContain('RECOVERY PROCEDURES');
    expect(raw).toContain('TRUSTED PUBLISHING');
    expect(raw).toContain('ROLLBACK');
  });

  it('documentation is placed as YAML comments (lines starting with #)', () => {
    const raw = loadWorkflowRaw();
    const lines = raw.split('\n');
    // Find lines containing key documentation strings
    const recoveryLine = lines.find((l) => l.includes('RECOVERY PROCEDURES'));
    const trustedLine = lines.find((l) => l.includes('TRUSTED PUBLISHING'));
    const rollbackLine = lines.find((l) => l.includes('ROLLBACK'));

    expect(recoveryLine?.trimStart().startsWith('#')).toBe(true);
    expect(trustedLine?.trimStart().startsWith('#')).toBe(true);
    expect(rollbackLine?.trimStart().startsWith('#')).toBe(true);
  });
});
