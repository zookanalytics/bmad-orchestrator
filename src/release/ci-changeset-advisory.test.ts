import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { PROJECT_ROOT } from './changeset-test-utils.js';

/**
 * Validates that the CI workflow's changeset status step uses advisory warnings
 * (not failures) so infrastructure-only PRs are not blocked.
 *
 * Story: rel-3-3 (Add Publish Status and Version Visibility) - AC3
 *
 * Key requirement:
 * - CI changeset status step must warn (not fail) if no changesets are found
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

  it('uses ::warning:: instead of failing when no changesets found', () => {
    const raw = readFileSync(CI_WORKFLOW_PATH, 'utf-8');
    // The changeset validation must use GitHub Actions warning annotation
    expect(raw).toContain('::warning::');
    // It should NOT use ::error:: for missing changesets
    expect(raw).not.toMatch(/::error::.*changeset/i);
  });

  it('changeset step does not use set -e or errexit that would cause failure', () => {
    const workflow = loadCiWorkflow();
    const steps = workflow.jobs.check.steps;
    const changesetStep = steps.find((s) => s.name?.toLowerCase().includes('changeset'));
    // The run script should handle failure gracefully (if ! pnpm changeset status)
    expect(changesetStep?.run).toContain('if !');
  });
});
