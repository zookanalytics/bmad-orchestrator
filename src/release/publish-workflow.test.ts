import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { PROJECT_ROOT } from './changeset-test-utils.js';

/**
 * Validates .github/workflows/publish.yml matches the architecture specification.
 * Catches configuration drift that could break the automated publishing pipeline.
 *
 * Architecture source: _bmad-output/planning-artifacts/release-infrastructure/architecture.md
 * Story: rel-3-1 (Implement Automated Publish Workflow)
 *
 * Key requirements validated:
 * - Trusted Publishing (OIDC) via id-token: write permission
 * - Explicit minimal permissions (NFR2)
 * - Concurrency queue with cancel-in-progress: false (FR15)
 * - changesets/action@v1 integration
 */

const PUBLISH_WORKFLOW_PATH = resolve(PROJECT_ROOT, '.github/workflows/publish.yml');

interface WorkflowYaml {
  name: string;
  on: {
    push?: {
      branches?: string[];
    };
  };
  concurrency?: {
    group: string;
    'cancel-in-progress': boolean;
  };
  permissions?: Record<string, string>;
  jobs: Record<
    string,
    {
      'runs-on': string;
      steps: Array<{
        name?: string;
        uses?: string;
        with?: Record<string, string>;
        env?: Record<string, string | boolean>;
        id?: string;
        run?: string;
        shell?: string;
      }>;
    }
  >;
}

function loadWorkflow(): WorkflowYaml {
  const raw = readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8');
  return parse(raw) as WorkflowYaml;
}

describe('publish workflow exists and has correct structure', () => {
  it('publish.yml file exists', () => {
    expect(() => readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8')).not.toThrow();
  });

  it('has name "Publish"', () => {
    const workflow = loadWorkflow();
    expect(workflow.name).toBe('Publish');
  });

  it('triggers on push to main branch only', () => {
    const workflow = loadWorkflow();
    expect(workflow.on.push?.branches).toEqual(['main']);
  });

  it('has a publish job', () => {
    const workflow = loadWorkflow();
    expect(workflow.jobs).toHaveProperty('publish');
  });

  it('runs on ubuntu-latest', () => {
    const workflow = loadWorkflow();
    expect(workflow.jobs.publish['runs-on']).toBe('ubuntu-latest');
  });
});

describe('publish workflow permissions (NFR2)', () => {
  it('declares explicit permissions block', () => {
    const workflow = loadWorkflow();
    expect(workflow.permissions).toBeDefined();
  });

  it('has contents: write for GitHub releases', () => {
    const workflow = loadWorkflow();
    expect(workflow.permissions?.contents).toBe('write');
  });

  it('has pull-requests: write for Version Packages PR', () => {
    const workflow = loadWorkflow();
    expect(workflow.permissions?.['pull-requests']).toBe('write');
  });

  it('has id-token: write for Trusted Publishing (OIDC)', () => {
    const workflow = loadWorkflow();
    expect(workflow.permissions?.['id-token']).toBe('write');
  });

  it('has exactly 3 permissions (minimal scope)', () => {
    const workflow = loadWorkflow();
    const permissionKeys = Object.keys(workflow.permissions ?? {});
    expect(permissionKeys).toHaveLength(3);
    expect(permissionKeys.sort()).toEqual(['contents', 'id-token', 'pull-requests']);
  });
});

describe('publish workflow concurrency (FR15)', () => {
  it('has concurrency configuration', () => {
    const workflow = loadWorkflow();
    expect(workflow.concurrency).toBeDefined();
  });

  it('uses publish concurrency group', () => {
    const workflow = loadWorkflow();
    expect(workflow.concurrency?.group).toBe('publish');
  });

  it('never cancels in-progress publishes', () => {
    const workflow = loadWorkflow();
    expect(workflow.concurrency?.['cancel-in-progress']).toBe(false);
  });
});

describe('publish workflow changesets/action configuration', () => {
  it('includes changesets/action@v1 step', () => {
    const workflow = loadWorkflow();
    const changesetsStep = workflow.jobs.publish.steps.find(
      (s) => s.uses && s.uses.startsWith('changesets/action@')
    );
    expect(changesetsStep).toBeDefined();
    expect(changesetsStep?.uses).toBe('changesets/action@v1');
  });

  it('configures publish command as pnpm changeset publish', () => {
    const workflow = loadWorkflow();
    const changesetsStep = workflow.jobs.publish.steps.find(
      (s) => s.uses === 'changesets/action@v1'
    );
    expect(changesetsStep?.with?.publish).toBe('pnpm changeset publish');
  });

  it('passes GITHUB_TOKEN for PR creation', () => {
    const workflow = loadWorkflow();
    const changesetsStep = workflow.jobs.publish.steps.find(
      (s) => s.uses === 'changesets/action@v1'
    );
    expect(changesetsStep?.env?.GITHUB_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}');
  });

  it('enables npm provenance for Trusted Publishing (OIDC)', () => {
    const workflow = loadWorkflow();
    const changesetsStep = workflow.jobs.publish.steps.find(
      (s) => s.uses === 'changesets/action@v1'
    );
    expect(changesetsStep?.env?.NPM_CONFIG_PROVENANCE).toBe(true);
  });
});

describe('publish workflow setup steps', () => {
  it('includes checkout step', () => {
    const workflow = loadWorkflow();
    const checkoutStep = workflow.jobs.publish.steps.find(
      (s) => s.uses && s.uses.startsWith('actions/checkout@')
    );
    expect(checkoutStep).toBeDefined();
  });

  it('includes Node.js 22 setup with npm registry', () => {
    const workflow = loadWorkflow();
    const nodeStep = workflow.jobs.publish.steps.find(
      (s) => s.uses && s.uses.startsWith('actions/setup-node@')
    );
    expect(nodeStep).toBeDefined();
    expect(nodeStep?.with?.['node-version']).toBe('22');
    expect(nodeStep?.with?.['registry-url']).toBe('https://registry.npmjs.org');
  });

  it('includes pnpm setup', () => {
    const workflow = loadWorkflow();
    const pnpmStep = workflow.jobs.publish.steps.find(
      (s) => s.uses && s.uses.startsWith('pnpm/action-setup@')
    );
    expect(pnpmStep).toBeDefined();
  });

  it('includes install with frozen lockfile', () => {
    const raw = readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8');
    expect(raw).toContain('pnpm install --frozen-lockfile');
  });

  it('includes build all packages step', () => {
    const raw = readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8');
    expect(raw).toContain('pnpm -r build');
  });
});

describe('publish workflow inline documentation', () => {
  it('contains recovery procedure documentation', () => {
    const raw = readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8');
    expect(raw).toContain('RECOVERY PROCEDURES');
    expect(raw).toContain('Re-run this workflow');
    expect(raw).toContain('pnpm changeset publish');
  });

  it('contains Trusted Publishing (OIDC) documentation', () => {
    const raw = readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8');
    expect(raw).toContain('TRUSTED PUBLISHING (OIDC)');
    expect(raw).toContain('ZookAnalytics/bmad-orchestrator');
    expect(raw).toContain('publish.yml');
  });

  it('contains rollback/deprecation documentation', () => {
    const raw = readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8');
    expect(raw).toContain('npm deprecate');
    expect(raw).toContain('ROLLBACK');
  });

  it('contains changelog plugin failure workaround', () => {
    const raw = readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8');
    expect(raw).toContain('@changesets/changelog-git');
  });
});

describe('publish workflow step ordering', () => {
  it('runs checkout before Node.js setup', () => {
    const workflow = loadWorkflow();
    const steps = workflow.jobs.publish.steps;
    const checkoutIndex = steps.findIndex((s) => s.uses?.startsWith('actions/checkout@'));
    const nodeIndex = steps.findIndex((s) => s.uses?.startsWith('actions/setup-node@'));
    expect(checkoutIndex).toBeGreaterThan(-1);
    expect(nodeIndex).toBeGreaterThan(-1);
    expect(checkoutIndex).toBeLessThan(nodeIndex);
  });

  it('runs pnpm setup before install', () => {
    const workflow = loadWorkflow();
    const steps = workflow.jobs.publish.steps;
    const pnpmIndex = steps.findIndex((s) => s.uses?.startsWith('pnpm/action-setup@'));
    const installIndex = steps.findIndex((s) => s.run?.includes('pnpm install'));
    expect(pnpmIndex).toBeGreaterThan(-1);
    expect(installIndex).toBeGreaterThan(-1);
    expect(pnpmIndex).toBeLessThan(installIndex);
  });

  it('runs build before changesets/action', () => {
    const workflow = loadWorkflow();
    const steps = workflow.jobs.publish.steps;
    const buildIndex = steps.findIndex((s) => s.run?.includes('pnpm -r build'));
    const changesetsIndex = steps.findIndex((s) => s.uses?.startsWith('changesets/action@'));
    expect(buildIndex).toBeGreaterThan(-1);
    expect(changesetsIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeLessThan(changesetsIndex);
  });

  it('changesets/action is the last step', () => {
    const workflow = loadWorkflow();
    const steps = workflow.jobs.publish.steps;
    const changesetsIndex = steps.findIndex((s) => s.uses?.startsWith('changesets/action@'));
    expect(changesetsIndex).toBe(steps.length - 1);
  });
});

describe('publish workflow safety guards', () => {
  it('does not trigger on pull_request', () => {
    const workflow = loadWorkflow();
    expect(workflow.on).not.toHaveProperty('pull_request');
  });

  it('checkout does not use fetch-depth: 0 (not needed for publish)', () => {
    const workflow = loadWorkflow();
    const checkoutStep = workflow.jobs.publish.steps.find((s) =>
      s.uses?.startsWith('actions/checkout@')
    );
    expect(checkoutStep?.with?.['fetch-depth']).toBeUndefined();
  });

  it('quotes $GITHUB_ENV in shell commands', () => {
    const raw = readFileSync(PUBLISH_WORKFLOW_PATH, 'utf-8');
    expect(raw).toContain('"$GITHUB_ENV"');
    expect(raw).not.toMatch(/>> \$GITHUB_ENV/);
  });
});
