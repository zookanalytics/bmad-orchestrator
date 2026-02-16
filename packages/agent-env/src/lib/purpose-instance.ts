/**
 * Purpose management for agent-env instances
 *
 * Handles getting and setting the purpose/label for instances.
 * Uses dependency injection for all I/O operations to enable testing.
 *
 * Environment-aware: when running inside an agent-env container
 * (detected via AGENT_ENV_CONTAINER env var), reads/writes state
 * from /etc/agent-env/state.json (bind-mounted from host).
 */

import { appendFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';

import type { ContainerEnvDeps } from './container-env.js';
import type { StateFsDeps } from './state.js';
import type { InstanceState, WorkspacePath } from './types.js';
import type { FsDeps } from './workspace.js';

import { findWorkspaceByName } from './attach-instance.js';
import { CONTAINER_AGENT_ENV_DIR, CONTAINER_STATE_PATH } from './container-env.js';
import { readState, writeStateAtomic, isValidState } from './state.js';
import { getWorkspacePathByName } from './workspace.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum allowed length for a purpose string */
export const MAX_PURPOSE_LENGTH = 200;

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
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validatePurposeLength(value: string): PurposeSetResult | null {
  if (value.length > MAX_PURPOSE_LENGTH) {
    return {
      ok: false,
      error: {
        code: 'PURPOSE_TOO_LONG',
        message: `Purpose must be ${MAX_PURPOSE_LENGTH} characters or fewer (got ${value.length})`,
      },
    };
  }
  return null;
}

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
  const lengthError = validatePurposeLength(value);
  if (lengthError) return lengthError;

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

// ─── Container-Aware Purpose Operations ─────────────────────────────────────

export interface ContainerPurposeDeps {
  stateFsDeps: StateFsDeps;
  containerEnvDeps: ContainerEnvDeps;
  statePath: string;
  agentEnvDir: string;
}

/**
 * Create default dependencies for container-mode purpose operations.
 */
export function createContainerPurposeDefaultDeps(): ContainerPurposeDeps {
  return {
    stateFsDeps: { readFile, writeFile, rename, mkdir, appendFile },
    containerEnvDeps: { getEnv: (key: string) => process.env[key] },
    statePath: CONTAINER_STATE_PATH,
    agentEnvDir: CONTAINER_AGENT_ENV_DIR,
  };
}

type ContainerStateReadResult =
  | { ok: true; state: InstanceState }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

async function readContainerState(deps: ContainerPurposeDeps): Promise<ContainerStateReadResult> {
  try {
    const content = await deps.stateFsDeps.readFile(deps.statePath, 'utf-8');
    const parsed: unknown = JSON.parse(content);

    if (!isValidState(parsed)) {
      return {
        ok: false,
        error: {
          code: 'STATE_CORRUPT',
          message: `State file at ${deps.statePath} contains invalid or incomplete state data`,
        },
      };
    }

    return { ok: true, state: parsed };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        ok: false,
        error: {
          code: 'STATE_NOT_FOUND',
          message: `State file not found at ${deps.statePath}`,
          suggestion: 'This container may not have been created by agent-env.',
        },
      };
    }
    if (err instanceof SyntaxError) {
      return {
        ok: false,
        error: {
          code: 'STATE_CORRUPT',
          message: `State file at ${deps.statePath} contains invalid JSON`,
        },
      };
    }
    throw err;
  }
}

/**
 * Get the current purpose when running inside a container.
 *
 * Reads directly from /etc/agent-env/state.json (bind-mounted from host).
 * No instance name needed — there's only one instance per container.
 *
 * @param deps - Injectable dependencies
 * @returns PurposeGetResult with purpose string or null
 */
export async function getContainerPurpose(deps: ContainerPurposeDeps): Promise<PurposeGetResult> {
  const read = await readContainerState(deps);
  if (!read.ok) return read;

  return { ok: true, purpose: read.state.purpose ?? null };
}

/**
 * Set or clear the purpose when running inside a container.
 *
 * Writes atomically to /etc/agent-env/state.json (bind-mounted from host).
 * The tmux status bar will pick up the change on its next 15-second refresh.
 *
 * @param value - New purpose string, or empty string to clear
 * @param deps - Injectable dependencies
 * @returns PurposeSetResult with success/failure info
 */
export async function setContainerPurpose(
  value: string,
  deps: ContainerPurposeDeps
): Promise<PurposeSetResult> {
  const lengthError = validatePurposeLength(value);
  if (lengthError) return lengthError;

  const read = await readContainerState(deps);
  if (!read.ok) return read;

  const cleared = value === '';
  const updatedState: InstanceState = {
    ...read.state,
    purpose: cleared ? null : value,
  };

  // Use writeStateAtomic for consistency, mocking WorkspacePath for the container
  const wsPath: WorkspacePath = {
    root: deps.agentEnvDir,
    name: read.state.name,
    agentEnvDir: deps.agentEnvDir,
    stateFile: deps.statePath,
  };

  await writeStateAtomic(wsPath, updatedState, deps.stateFsDeps);

  return { ok: true, cleared };
}
