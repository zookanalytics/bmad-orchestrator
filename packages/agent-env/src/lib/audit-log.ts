/**
 * Audit log for force-remove operations
 *
 * Writes JSON Lines entries to ~/.agent-env/audit.log for tracking
 * force-remove operations with full git state context.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { GitState } from './types.js';

import { AGENT_ENV_DIR } from './types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** How the user confirmed the force removal */
export type ConfirmationMethod = 'typed-name' | 'yes-flag' | 'not-required';

/** A single audit log entry for a force-remove operation */
export interface AuditLogEntry {
  timestamp: string;
  action: 'force-remove';
  instanceName: string;
  gitState: GitState | null;
  confirmationMethod: ConfirmationMethod;
}

/** Filesystem dependencies for audit log operations */
export interface AuditLogDeps {
  appendFile: typeof appendFile;
  mkdir: typeof mkdir;
  homedir: typeof homedir;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAuditLogDefaultDeps(): AuditLogDeps {
  return { appendFile, mkdir, homedir };
}

// ─── Audit Log Operations ────────────────────────────────────────────────────

/**
 * Get the path to the audit log file.
 * @returns Absolute path to ~/.agent-env/audit.log
 */
export function getAuditLogPath(deps: Pick<AuditLogDeps, 'homedir'>): string {
  return join(deps.homedir(), AGENT_ENV_DIR, 'audit.log');
}

/**
 * Write an audit log entry for a force-remove operation.
 *
 * Appends a single JSON line to ~/.agent-env/audit.log.
 * Creates the directory if it doesn't exist.
 *
 * @param entry - The audit log entry to write
 * @param deps - Injectable filesystem dependencies
 */
export async function writeAuditLogEntry(
  entry: AuditLogEntry,
  deps: AuditLogDeps = createAuditLogDefaultDeps()
): Promise<void> {
  const logPath = getAuditLogPath(deps);

  // Ensure ~/.agent-env/ directory exists
  await deps.mkdir(join(deps.homedir(), AGENT_ENV_DIR), { recursive: true });

  // Append JSON line
  const line = JSON.stringify(entry) + '\n';
  await deps.appendFile(logPath, line, 'utf-8');
}

/**
 * Create an audit log entry for a force-remove operation.
 *
 * @param instanceName - The instance that was force-removed
 * @param gitState - The git state at time of removal (null if detection failed)
 * @param confirmationMethod - How the user confirmed the removal
 * @returns A complete AuditLogEntry ready to write
 */
export function createAuditEntry(
  instanceName: string,
  gitState: GitState | null,
  confirmationMethod: ConfirmationMethod
): AuditLogEntry {
  return {
    timestamp: new Date().toISOString(),
    action: 'force-remove',
    instanceName,
    gitState,
    confirmationMethod,
  };
}
