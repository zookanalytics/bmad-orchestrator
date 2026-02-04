/**
 * Purpose management for agent-env instances
 *
 * Handles getting and setting the purpose/label for instances.
 * Uses dependency injection for all I/O operations to enable testing.
 */

import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';

import type { StateFsDeps } from './state.js';
import type { FsDeps } from './workspace.js';

import { findWorkspaceByName } from './attach-instance.js';
import { readState, writeStateAtomic } from './state.js';
import { getWorkspacePathByName } from './workspace.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PurposeGetResult =
  | { ok: true; purpose: string | null }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export type PurposeSetResult =
  | { ok: true; cleared: boolean }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export interface PurposeInstanceDeps {
  workspaceFsDeps: FsDeps;
  stateFsDeps: StateFsDeps;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create default dependencies for purpose operations.
 * Useful for production; tests inject their own.
 */
export function createPurposeDefaultDeps(): PurposeInstanceDeps {
  return {
    workspaceFsDeps: { mkdir, readdir, stat, homedir },
    stateFsDeps: { readFile, writeFile, rename, mkdir },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type LookupError = { ok: false; error: { code: string; message: string; suggestion?: string } };

function mapLookupError(
  lookup: Exclude<Awaited<ReturnType<typeof findWorkspaceByName>>, { found: true }>,
  instanceName: string
): LookupError {
  if (lookup.reason === 'ambiguous') {
    return {
      ok: false,
      error: {
        code: 'AMBIGUOUS_MATCH',
        message: `Multiple instances match '${instanceName}': ${lookup.matches.join(', ')}`,
        suggestion: 'Use the full workspace name to specify which instance.',
      },
    };
  }
  return {
    ok: false,
    error: {
      code: 'WORKSPACE_NOT_FOUND',
      message: `Instance '${instanceName}' not found`,
      suggestion: 'Use `agent-env list` to see available instances.',
    },
  };
}

// ─── Purpose Operations ──────────────────────────────────────────────────────

/**
 * Get the current purpose for an instance.
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param deps - Injectable dependencies
 * @returns PurposeGetResult with purpose string or null
 */
export async function getPurpose(
  instanceName: string,
  deps: PurposeInstanceDeps
): Promise<PurposeGetResult> {
  const lookup = await findWorkspaceByName(instanceName, deps.workspaceFsDeps);

  if (!lookup.found) {
    return mapLookupError(lookup, instanceName);
  }

  const wsPath = getWorkspacePathByName(lookup.workspaceName, deps.workspaceFsDeps);
  const state = await readState(wsPath, deps.stateFsDeps);

  return { ok: true, purpose: state.purpose };
}

/**
 * Set or clear the purpose for an instance.
 *
 * @param instanceName - User-provided instance name (e.g., "auth")
 * @param value - New purpose string, or empty string to clear
 * @param deps - Injectable dependencies
 * @returns PurposeSetResult with success/failure info
 */
export async function setPurpose(
  instanceName: string,
  value: string,
  deps: PurposeInstanceDeps
): Promise<PurposeSetResult> {
  const lookup = await findWorkspaceByName(instanceName, deps.workspaceFsDeps);

  if (!lookup.found) {
    return mapLookupError(lookup, instanceName);
  }

  const wsPath = getWorkspacePathByName(lookup.workspaceName, deps.workspaceFsDeps);
  const state = await readState(wsPath, deps.stateFsDeps);

  const cleared = value === '';
  const updatedState = {
    ...state,
    purpose: cleared ? null : value,
  };

  await writeStateAtomic(wsPath, updatedState, deps.stateFsDeps);

  return { ok: true, cleared };
}
