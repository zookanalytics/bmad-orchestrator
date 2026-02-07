import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { PROJECT_ROOT } from './changeset-test-utils.js';

/**
 * Validates .github/workflows/changeset-bot.yml exists and is correctly configured
 * to comment on PRs with changeset coverage information.
 *
 * Architecture source: _bmad-output/planning-artifacts/release-infrastructure/architecture.md
 * Story: rel-3-3 (Add Publish Status and Version Visibility)
 *
 * Key requirements validated:
 * - changesets/bot action comments on PRs about changeset coverage (FR32)
 * - Minimal permissions (pull-requests: write)
 * - Triggers on pull_request events
 */

const BOT_WORKFLOW_PATH = resolve(PROJECT_ROOT, '.github/workflows/changeset-bot.yml');

interface BotWorkflowYaml {
  name: string;
  on: {
    pull_request_target?: {
      types?: string[];
    };
  };
  permissions?: Record<string, string>;
  jobs: Record<
    string,
    {
      'runs-on': string;
      steps: Array<{
        name?: string;
        uses?: string;
        env?: Record<string, string>;
      }>;
    }
  >;
}

function loadBotWorkflow(): BotWorkflowYaml {
  const raw = readFileSync(BOT_WORKFLOW_PATH, 'utf-8');
  return parse(raw) as BotWorkflowYaml;
}

describe('changeset bot workflow exists and has correct structure (FR32)', () => {
  it('changeset-bot.yml file exists', () => {
    expect(() => readFileSync(BOT_WORKFLOW_PATH, 'utf-8')).not.toThrow();
  });

  it('has a descriptive workflow name', () => {
    const workflow = loadBotWorkflow();
    expect(workflow.name).toBeTruthy();
  });

  it('triggers on pull_request_target events', () => {
    const workflow = loadBotWorkflow();
    expect(workflow.on).toHaveProperty('pull_request_target');
  });

  it('triggers on opened and synchronize events', () => {
    const workflow = loadBotWorkflow();
    const types = workflow.on.pull_request_target?.types;
    expect(types).toContain('opened');
    expect(types).toContain('synchronize');
  });
});

describe('changeset bot workflow permissions', () => {
  it('declares explicit permissions block', () => {
    const workflow = loadBotWorkflow();
    expect(workflow.permissions).toBeDefined();
  });

  it('has pull-requests: write for commenting on PRs', () => {
    const workflow = loadBotWorkflow();
    expect(workflow.permissions?.['pull-requests']).toBe('write');
  });
});

describe('changeset bot workflow action configuration', () => {
  it('includes changesets/bot action step', () => {
    const workflow = loadBotWorkflow();
    const job = Object.values(workflow.jobs)[0];
    const botStep = job.steps.find((s) => s.uses && s.uses.startsWith('changesets/bot@'));
    expect(botStep).toBeDefined();
  });

  it('uses changesets/bot@v1', () => {
    const workflow = loadBotWorkflow();
    const job = Object.values(workflow.jobs)[0];
    const botStep = job.steps.find((s) => s.uses?.startsWith('changesets/bot@'));
    expect(botStep?.uses).toBe('changesets/bot@v1');
  });

  it('passes GITHUB_TOKEN for PR commenting', () => {
    const workflow = loadBotWorkflow();
    const job = Object.values(workflow.jobs)[0];
    const botStep = job.steps.find((s) => s.uses?.startsWith('changesets/bot@'));
    expect(botStep?.env?.GITHUB_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}');
  });
});

describe('changeset bot workflow runs on ubuntu-latest', () => {
  it('job runs on ubuntu-latest', () => {
    const workflow = loadBotWorkflow();
    const job = Object.values(workflow.jobs)[0];
    expect(job['runs-on']).toBe('ubuntu-latest');
  });
});
