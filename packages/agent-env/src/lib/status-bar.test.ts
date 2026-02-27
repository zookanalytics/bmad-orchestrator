import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import type { StatusBarDeps } from './status-bar.js';

import { regenerateStatusBar, STATUS_BAR_JSON, STATUS_BAR_TEMPLATE_JSON } from './status-bar.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = join(
    tmpdir(),
    `agent-env-test-statusbar-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

/** Workspace root directory (simulates the cloned repo) */
function wsRoot(): string {
  return join(tempDir, 'workspace');
}

/** Agent-env directory within the workspace */
function agentEnvDir(): string {
  return join(wsRoot(), '.agent-env');
}

/** Create a template file at .vscode/statusBar.template.json (repo-provided override) */
async function createVscodeTemplate(content: string): Promise<void> {
  const dir = join(wsRoot(), '.vscode');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, STATUS_BAR_TEMPLATE_JSON), content, 'utf-8');
}

/** Create a template file at .agent-env/statusBar.template.json (agent-env default) */
async function createAgentEnvTemplate(content: string): Promise<void> {
  await mkdir(agentEnvDir(), { recursive: true });
  await writeFile(join(agentEnvDir(), STATUS_BAR_TEMPLATE_JSON), content, 'utf-8');
}

/** Read the generated statusBar.json */
async function readOutput(): Promise<string> {
  return readFile(join(agentEnvDir(), STATUS_BAR_JSON), 'utf-8');
}

const deps: StatusBarDeps = { readFile, writeFile };

// ─── Template resolution tests ──────────────────────────────────────────────

describe('regenerateStatusBar template resolution', () => {
  it('uses .vscode/ template when both exist (repo-provided wins)', async () => {
    await createVscodeTemplate('{"label": "repo: {{PURPOSE}}"}');
    await createAgentEnvTemplate('{"label": "default: {{PURPOSE}}"}');

    await regenerateStatusBar(wsRoot(), agentEnvDir(), 'Testing', deps);

    const output = await readOutput();
    expect(output).toBe('{"label": "repo: Testing"}');
  });

  it('falls back to .agent-env/ template when .vscode/ template missing', async () => {
    await createAgentEnvTemplate('{"label": "default: {{PURPOSE}}"}');

    await regenerateStatusBar(wsRoot(), agentEnvDir(), 'Fallback test', deps);

    const output = await readOutput();
    expect(output).toBe('{"label": "default: Fallback test"}');
  });

  it('throws TEMPLATE_NOT_FOUND when neither template exists', async () => {
    await mkdir(agentEnvDir(), { recursive: true });

    await expect(
      regenerateStatusBar(wsRoot(), agentEnvDir(), 'Any purpose', deps)
    ).rejects.toMatchObject({
      code: 'TEMPLATE_NOT_FOUND',
      message: expect.stringContaining('No status bar template found'),
    });
  });
});

// ─── Purpose replacement tests ──────────────────────────────────────────────

describe('regenerateStatusBar purpose replacement', () => {
  it('replaces {{PURPOSE}} with actual purpose string', async () => {
    await createAgentEnvTemplate('{"label": "$(bookmark) {{PURPOSE}}"}');

    await regenerateStatusBar(wsRoot(), agentEnvDir(), 'OAuth implementation', deps);

    const output = await readOutput();
    expect(output).toBe('{"label": "$(bookmark) OAuth implementation"}');
  });

  it('replaces all {{PURPOSE}} occurrences when multiple exist', async () => {
    await createAgentEnvTemplate('{"label": "{{PURPOSE}}", "tooltip": "Purpose: {{PURPOSE}}"}');

    await regenerateStatusBar(wsRoot(), agentEnvDir(), 'Multi-replace', deps);

    const output = await readOutput();
    expect(output).toBe('{"label": "Multi-replace", "tooltip": "Purpose: Multi-replace"}');
  });

  it('substitutes "(no purpose set)" when purpose is null', async () => {
    await createAgentEnvTemplate('{"label": "$(bookmark) {{PURPOSE}}"}');

    await regenerateStatusBar(wsRoot(), agentEnvDir(), null, deps);

    const output = await readOutput();
    expect(output).toBe('{"label": "$(bookmark) (no purpose set)"}');
  });

  it('writes output to agentEnvDir/statusBar.json', async () => {
    await createAgentEnvTemplate('{"label": "{{PURPOSE}}"}');

    await regenerateStatusBar(wsRoot(), agentEnvDir(), 'Test purpose', deps);

    const outputPath = join(agentEnvDir(), STATUS_BAR_JSON);
    const content = await readFile(outputPath, 'utf-8');
    expect(content).toBe('{"label": "Test purpose"}');
  });
});

// ─── Dependency injection tests ─────────────────────────────────────────────

describe('regenerateStatusBar dependency injection', () => {
  it('uses injected readFile and writeFile', async () => {
    const template = '{"purpose": "{{PURPOSE}}"}';
    const mockReadFile = async (path: string | URL) => {
      if (String(path).includes('.vscode')) {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      return template;
    };
    let writtenContent = '';
    let writtenPath = '';
    const mockWriteFile = async (path: string | URL, data: string | Uint8Array) => {
      writtenPath = String(path);
      writtenContent = String(data);
    };

    const mockDeps: StatusBarDeps = {
      readFile: mockReadFile as typeof readFile,
      writeFile: mockWriteFile as typeof writeFile,
    };

    await regenerateStatusBar(
      '/fake/workspace',
      '/fake/workspace/.agent-env',
      'injected',
      mockDeps
    );

    expect(writtenPath).toBe('/fake/workspace/.agent-env/statusBar.json');
    expect(writtenContent).toBe('{"purpose": "injected"}');
  });
});

// ─── Container-mode tests ────────────────────────────────────────────────────

describe('regenerateStatusBar container mode', () => {
  it('works with separate workspaceRoot and agentEnvDir paths', async () => {
    // Simulate container layout: workspace at /workspaces/<repo>, agent-env at /etc/agent-env
    const containerAgentEnv = join(tempDir, 'etc-agent-env');
    await mkdir(containerAgentEnv, { recursive: true });
    await writeFile(
      join(containerAgentEnv, STATUS_BAR_TEMPLATE_JSON),
      '{"label": "container: {{PURPOSE}}"}',
      'utf-8'
    );

    await regenerateStatusBar(wsRoot(), containerAgentEnv, 'Container test', deps);

    const output = await readFile(join(containerAgentEnv, STATUS_BAR_JSON), 'utf-8');
    expect(output).toBe('{"label": "container: Container test"}');
  });

  it('prefers .vscode/ template from workspaceRoot even with separate agentEnvDir', async () => {
    const containerAgentEnv = join(tempDir, 'etc-agent-env');
    await createVscodeTemplate('{"label": "repo: {{PURPOSE}}"}');
    await mkdir(containerAgentEnv, { recursive: true });
    await writeFile(
      join(containerAgentEnv, STATUS_BAR_TEMPLATE_JSON),
      '{"label": "default: {{PURPOSE}}"}',
      'utf-8'
    );

    await regenerateStatusBar(wsRoot(), containerAgentEnv, 'Pref test', deps);

    const output = await readFile(join(containerAgentEnv, STATUS_BAR_JSON), 'utf-8');
    expect(output).toBe('{"label": "repo: Pref test"}');
  });
});

// ─── Error propagation tests ─────────────────────────────────────────────────

describe('regenerateStatusBar error propagation', () => {
  it('re-throws non-ENOENT errors from readFile', async () => {
    const permError = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    const mockDeps: StatusBarDeps = {
      readFile: (async () => {
        throw permError;
      }) as unknown as typeof readFile,
      writeFile,
    };

    await expect(regenerateStatusBar(wsRoot(), agentEnvDir(), 'test', mockDeps)).rejects.toThrow(
      'Permission denied'
    );
  });
});
