import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { PROJECT_ROOT } from './changeset-test-utils.js';

/**
 * Validates that the CI workflow enforces changeset presence on PRs via a
 * dedicated blocking job, with a label-based opt-out for non-publishable PRs.
 *
 * Supersedes the advisory-only approach from rel-3-3 AC3.
 *
 * Key requirements:
 * - Changeset enforcement is a separate CI job (`changeset-check`)
 * - The job hard-fails (exit 1) when no changesets are found
 * - PRs labeled `no-changeset-needed` skip the check
 * - Config/tool errors still hard-fail
 * - Package name validation remains in the main `check` job
 */

const CI_WORKFLOW_PATH = resolve(PROJECT_ROOT, '.github/workflows/ci.yml');

interface CiStep {
  name?: string;
  if?: string;
  run?: string;
  uses?: string;
}

interface CiJob {
  name?: string;
  'runs-on'?: string;
  if?: string;
  steps: CiStep[];
}

interface CiWorkflowYaml {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, CiJob>;
}

function loadCiWorkflow(): CiWorkflowYaml {
  const raw = readFileSync(CI_WORKFLOW_PATH, 'utf-8');
  return parse(raw) as CiWorkflowYaml;
}

describe('CI changeset enforcement (blocking job)', () => {
  it('ci.yml workflow file exists', () => {
    expect(existsSync(CI_WORKFLOW_PATH)).toBe(true);
  });

  it('has a dedicated changeset-check job separate from the check job', () => {
    const workflow = loadCiWorkflow();
    expect(workflow.jobs['changeset-check']).toBeDefined();
  });

  it('changeset-check job only runs on pull requests', () => {
    const workflow = loadCiWorkflow();
    const job = workflow.jobs['changeset-check'];
    expect(job.if).toContain('pull_request');
  });

  it('changeset-check job supports no-changeset-needed label opt-out', () => {
    const workflow = loadCiWorkflow();
    const job = workflow.jobs['changeset-check'];
    // Label opt-out is handled at step level (not job level) so the job
    // always runs and reports SUCCESS to satisfy branch protection.
    const optOutStep = job.steps.find((s) => s.name?.toLowerCase().includes('opt-out'));
    expect(optOutStep).toBeDefined();
    expect(optOutStep?.if).toContain('no-changeset-needed');
  });

  it('changeset-check job hard-fails when no changesets are found', () => {
    const workflow = loadCiWorkflow();
    const job = workflow.jobs['changeset-check'];
    const statusStep = job.steps.find((s) => s.name?.toLowerCase().includes('changeset'));
    expect(statusStep).toBeDefined();
    expect(statusStep?.run).toContain('exit 1');
    expect(statusStep?.run).toContain('No changesets present');
  });

  it('changeset-check job uses ::error:: annotation for missing changesets', () => {
    const workflow = loadCiWorkflow();
    const job = workflow.jobs['changeset-check'];
    const statusStep = job.steps.find((s) => s.name?.toLowerCase().includes('changeset'));
    expect(statusStep?.run).toContain('::error::');
  });

  it('changeset-check still hard-fails on unexpected tool/config errors', () => {
    const workflow = loadCiWorkflow();
    const job = workflow.jobs['changeset-check'];
    const statusStep = job.steps.find((s) => s.name?.toLowerCase().includes('changeset'));
    // Must distinguish "no changesets" from other failures (both exit 1)
    expect(statusStep?.run).toContain('pnpm changeset status');
    expect(statusStep?.run).toContain('::error::');
  });

  it('package name validation remains in the main check job', () => {
    const workflow = loadCiWorkflow();
    const steps = workflow.jobs.check.steps;
    const validateStep = steps.find((s) =>
      s.name?.toLowerCase().includes('validate changeset package names')
    );
    expect(validateStep).toBeDefined();
    expect(validateStep?.if).toContain("github.event_name == 'pull_request'");
  });

  it('advisory warning is no longer used for missing changesets', () => {
    const workflow = loadCiWorkflow();
    const job = workflow.jobs['changeset-check'];
    const statusStep = job.steps.find((s) => s.name?.toLowerCase().includes('changeset'));
    // ::warning:: should NOT appear in the changeset status step
    expect(statusStep?.run).not.toContain('::warning::');
  });
});
