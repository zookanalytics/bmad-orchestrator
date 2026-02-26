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

function createTestDeps(): StatusBarDeps {
  return { readFile, writeFile };
}

const TEMPLATE_CONTENT = JSON.stringify(
  {
    'betterStatusBar.commands': [
      {
        id: 'agent-env-purpose',
        label: '$(bookmark) {{PURPOSE}}',
        tooltip: 'agent-env instance purpose',
        alignment: 2,
        priority: 100,
        color: 'statusBar.foreground',
      },
    ],
  },
  null,
  2
);

// ─── regenerateStatusBar tests ──────────────────────────────────────────────

describe('regenerateStatusBar', () => {
  it('replaces {{PURPOSE}} with the purpose value', async () => {
    const vscodeDir = join(tempDir, '.vscode');
    await mkdir(vscodeDir, { recursive: true });
    await writeFile(join(vscodeDir, STATUS_BAR_TEMPLATE_JSON), TEMPLATE_CONTENT, 'utf-8');
    const deps = createTestDeps();

    await regenerateStatusBar(tempDir, 'JWT authentication', deps);

    const output = await readFile(join(vscodeDir, STATUS_BAR_JSON), 'utf-8');
    expect(output).toContain('JWT authentication');
    expect(output).not.toContain('{{PURPOSE}}');
  });

  it('skips silently when template does not exist', async () => {
    const deps = createTestDeps();

    // Should not throw
    await regenerateStatusBar(tempDir, 'Some purpose', deps);

    // No statusBar.json should be created
    try {
      await readFile(join(tempDir, '.vscode', STATUS_BAR_JSON), 'utf-8');
      throw new Error('Expected file to not exist');
    } catch (err) {
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
    }
  });

  it('replaces {{PURPOSE}} with "(no purpose set)" when purpose is null', async () => {
    const vscodeDir = join(tempDir, '.vscode');
    await mkdir(vscodeDir, { recursive: true });
    await writeFile(join(vscodeDir, STATUS_BAR_TEMPLATE_JSON), TEMPLATE_CONTENT, 'utf-8');
    const deps = createTestDeps();

    await regenerateStatusBar(tempDir, null, deps);

    const output = await readFile(join(vscodeDir, STATUS_BAR_JSON), 'utf-8');
    expect(output).toContain('(no purpose set)');
    expect(output).not.toContain('{{PURPOSE}}');
  });

  it('replaces all occurrences of {{PURPOSE}} in the template', async () => {
    const vscodeDir = join(tempDir, '.vscode');
    await mkdir(vscodeDir, { recursive: true });
    const multiTemplate = JSON.stringify({
      'betterStatusBar.commands': [
        { id: 'purpose-1', label: '$(bookmark) {{PURPOSE}}' },
        { id: 'purpose-2', tooltip: 'Current purpose: {{PURPOSE}}' },
      ],
    });
    await writeFile(join(vscodeDir, STATUS_BAR_TEMPLATE_JSON), multiTemplate, 'utf-8');
    const deps = createTestDeps();

    await regenerateStatusBar(tempDir, 'OAuth work', deps);

    const output = await readFile(join(vscodeDir, STATUS_BAR_JSON), 'utf-8');
    expect(output).not.toContain('{{PURPOSE}}');
    // Both occurrences should be replaced
    const matches = output.match(/OAuth work/g);
    expect(matches).toHaveLength(2);
  });

  it('preserves template content except for {{PURPOSE}} substitution', async () => {
    const vscodeDir = join(tempDir, '.vscode');
    await mkdir(vscodeDir, { recursive: true });
    await writeFile(join(vscodeDir, STATUS_BAR_TEMPLATE_JSON), TEMPLATE_CONTENT, 'utf-8');
    const deps = createTestDeps();

    await regenerateStatusBar(tempDir, 'My purpose', deps);

    const output = await readFile(join(vscodeDir, STATUS_BAR_JSON), 'utf-8');
    const parsed = JSON.parse(output);
    const commands = parsed['betterStatusBar.commands'];
    expect(commands).toHaveLength(1);
    expect(commands[0].id).toBe('agent-env-purpose');
    expect(commands[0].label).toBe('$(bookmark) My purpose');
    expect(commands[0].tooltip).toBe('agent-env instance purpose');
    expect(commands[0].alignment).toBe(2);
    expect(commands[0].priority).toBe(100);
    expect(commands[0].color).toBe('statusBar.foreground');
  });

  it('writes output to same .vscode directory where template lives', async () => {
    const vscodeDir = join(tempDir, '.vscode');
    await mkdir(vscodeDir, { recursive: true });
    await writeFile(join(vscodeDir, STATUS_BAR_TEMPLATE_JSON), TEMPLATE_CONTENT, 'utf-8');
    const deps = createTestDeps();

    await regenerateStatusBar(tempDir, 'Test purpose', deps);

    const output = await readFile(join(vscodeDir, STATUS_BAR_JSON), 'utf-8');
    expect(output).toContain('Test purpose');
  });
});
