/**
 * Status bar template regeneration for VS Code better-status-bar extension
 *
 * Reads `.vscode/statusBar.template.json`, replaces `{{PURPOSE}}` placeholders
 * with the current purpose value, and writes `.vscode/statusBar.json`.
 *
 * The generated file is read by the `RobertOstermann.better-status-bar`
 * VS Code extension to display custom status bar items.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Template file name (checked into repos) */
export const STATUS_BAR_TEMPLATE_JSON = 'statusBar.template.json';

/** Generated file name (gitignored) */
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
 * Regenerate `.vscode/statusBar.json` from the template file.
 *
 * Reads `.vscode/statusBar.template.json` from the workspace root,
 * replaces all `{{PURPOSE}}` occurrences with the given purpose value,
 * and writes the result to `.vscode/statusBar.json`.
 *
 * If the template file does not exist, this function skips silently.
 * This allows repos to opt out of VS Code purpose display by simply
 * not including the template file.
 *
 * @param workspaceRoot - Absolute path to the workspace root directory
 * @param purpose - Current purpose value, or null if no purpose is set
 * @param deps - Injectable dependencies for testing
 */
export async function regenerateStatusBar(
  workspaceRoot: string,
  purpose: string | null,
  deps: StatusBarDeps = defaultDeps
): Promise<void> {
  const vscodeDir = join(workspaceRoot, '.vscode');
  const templatePath = join(vscodeDir, STATUS_BAR_TEMPLATE_JSON);

  // Read the template — skip silently if it doesn't exist
  let templateContent: string;
  try {
    templateContent = await deps.readFile(templatePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return; // No template — skip silently
    }
    throw err;
  }

  // Replace all {{PURPOSE}} occurrences
  const replacementText = purpose ?? NO_PURPOSE_TEXT;
  const output = templateContent.replaceAll(PURPOSE_PLACEHOLDER, replacementText);

  // Write the generated file
  const outputPath = join(vscodeDir, STATUS_BAR_JSON);
  await deps.writeFile(outputPath, output, 'utf-8');
}
