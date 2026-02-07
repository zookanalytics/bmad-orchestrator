import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** Shared constants and helpers for changeset tests */
export const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
export const CHANGESET_DIR = resolve(PROJECT_ROOT, '.changeset');

/** Returns all pending changeset markdown files (excludes README.md) */
export function getChangesetFiles(): string[] {
  return readdirSync(CHANGESET_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
}
