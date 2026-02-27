/**
 * Status bar template regeneration for VS Code better-status-bar extension
 *
 * Reads a `statusBar.template.json` from the workspace, replaces `{{PURPOSE}}`
 * placeholders with the current purpose value, and writes `statusBar.json`
 * to the agent-env directory.
 *
 * Template resolution order:
 * 1. `.vscode/statusBar.template.json` (repo-provided override)
 * 2. `<agentEnvDir>/statusBar.template.json` (agent-env default)
 * 3. Neither found → throws TEMPLATE_NOT_FOUND error
 *
 * The generated file is read by the `RobertOstermann.better-status-bar`
 * VS Code extension to display custom status bar items.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Template file name (checked into repos or deployed to .agent-env/) */
export const STATUS_BAR_TEMPLATE_JSON = 'statusBar.template.json';

/** Generated file name (in .agent-env/, gitignored) */
export const STATUS_BAR_JSON = 'statusBar.json';

/** Placeholder token in the template */
const PURPOSE_PLACEHOLDER = '{{PURPOSE}}';

/** Fallback text when purpose is null */
const NO_PURPOSE_TEXT = '(no purpose set)';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StatusBarDeps {
  readFile: typeof readFile;
  writeFile: typeof writeFile;
}

const defaultDeps: StatusBarDeps = { readFile, writeFile };

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Regenerate `statusBar.json` from the template file.
 *
 * Resolution chain:
 * 1. `.vscode/statusBar.template.json` from `workspaceRoot` (repo-provided override)
 * 2. `statusBar.template.json` from `agentEnvDir` (agent-env default)
 * 3. Neither found → throws error with code `TEMPLATE_NOT_FOUND`
 *
 * Replaces all `{{PURPOSE}}` occurrences with the given purpose value
 * and writes the result to `<agentEnvDir>/statusBar.json`.
 *
 * @param workspaceRoot - Absolute path to the workspace root directory
 * @param agentEnvDir - Absolute path to the agent-env directory (.agent-env on host, /etc/agent-env in container)
 * @param purpose - Current purpose value, or null if no purpose is set
 * @param deps - Injectable dependencies for testing
 */
export async function regenerateStatusBar(
  workspaceRoot: string,
  agentEnvDir: string,
  purpose: string | null,
  deps: StatusBarDeps = defaultDeps
): Promise<void> {
  // 1. Try repo-provided template in .vscode/
  const vscodeTemplatePath = join(workspaceRoot, '.vscode', STATUS_BAR_TEMPLATE_JSON);
  let templateContent: string | null = null;

  try {
    templateContent = await deps.readFile(vscodeTemplatePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  // 2. Fallback to agent-env default template
  if (templateContent === null) {
    const agentEnvTemplatePath = join(agentEnvDir, STATUS_BAR_TEMPLATE_JSON);
    try {
      templateContent = await deps.readFile(agentEnvTemplatePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  // 3. Neither found → error
  if (templateContent === null) {
    throw Object.assign(
      new Error(
        'No status bar template found. Expected .vscode/statusBar.template.json or .agent-env/statusBar.template.json. ' +
          'Create a template manually or use `agent-env init-template` when available.'
      ),
      { code: 'TEMPLATE_NOT_FOUND' }
    );
  }

  // Replace all {{PURPOSE}} occurrences
  const replacementText = purpose ?? NO_PURPOSE_TEXT;
  const output = templateContent.replaceAll(PURPOSE_PLACEHOLDER, replacementText);

  // Write the generated file to agent-env directory
  const outputPath = join(agentEnvDir, STATUS_BAR_JSON);
  await deps.writeFile(outputPath, output, 'utf-8');
}
