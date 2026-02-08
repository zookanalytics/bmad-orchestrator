import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { PROJECT_ROOT } from './changeset-test-utils.js';

/**
 * Validates that the CI workflow's changeset status step uses advisory warnings
 * for "no changesets" while still hard-failing on config/tool errors.
 *
 * Story: rel-3-3 (Add Publish Status and Version Visibility) - AC3
 *
 * Key requirements:
 * - CI changeset status step must warn (not fail) if no changesets are found
 * - Config/tool failures must still hard-fail the build
 */

const CI_WORKFLOW_PATH = resolve(PROJECT_ROOT, '.github/workflows/ci.yml');

interface CiWorkflowYaml {
  on: Record<string, unknown>;
  jobs: Record<
    string,
    {
      steps: Array<{
        name?: string;
        if?: string;
        run?: string;
      }>;
    }
  >;
}

function loadCiWorkflow(): CiWorkflowYaml {
  const raw = readFileSync(CI_WORKFLOW_PATH, 'utf-8');
  return parse(raw) as CiWorkflowYaml;
}

describe('CI changeset status step is advisory (rel-3-3 AC3)', () => {
  it('ci.yml workflow file exists', () => {
    expect(existsSync(CI_WORKFLOW_PATH)).toBe(true);
  });

  it('has a changeset status validation step', () => {
    const workflow = loadCiWorkflow();
    const steps = workflow.jobs.check.steps;
    const changesetStep = steps.find((s) => s.name?.toLowerCase().includes('changeset'));
    expect(changesetStep).toBeDefined();
  });

  it('changeset step only runs on pull requests', () => {
    const workflow = loadCiWorkflow();
    const steps = workflow.jobs.check.steps;
    const changesetStep = steps.find((s) => s.name?.toLowerCase().includes('changeset'));
    expect(changesetStep?.if).toContain("github.event_name == 'pull_request'");
  });

  it('uses ::warning:: for missing changesets', () => {
    const raw = readFileSync(CI_WORKFLOW_PATH, 'utf-8');
    expect(raw).toContain('::warning::');
  });

  it('hard-fails on unexpected changeset errors (not just missing changesets)', () => {
    const raw = readFileSync(CI_WORKFLOW_PATH, 'utf-8');
    // Must distinguish "no changesets" from other failures
    expect(raw).toContain('No changesets present');
    // Must use ::error:: and exit 1 for unexpected failures
    expect(raw).toContain('::error::');
    expect(raw).toContain('exit 1');
  });

  it('changeset step captures output for failure differentiation', () => {
    const workflow = loadCiWorkflow();
    const steps = workflow.jobs.check.steps;
    const changesetStep = steps.find((s) => s.name?.toLowerCase().includes('changeset'));
    // The run script should capture output to distinguish failure types
    expect(changesetStep?.run).toContain('pnpm changeset status');
  });
});
