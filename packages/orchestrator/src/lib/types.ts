/**
 * Type definitions for instance discovery and orchestration
 *
 * These types match the agent-env CLI output structure from `agent-env list --json`.
 */

/**
 * Display status of an instance as reported by agent-env CLI
 */
export type InstanceDisplayStatus = 'running' | 'stopped' | 'not-found' | 'orphaned' | 'unknown';

/**
 * Git state information for an instance
 */
export interface GitState {
  hasStaged: boolean;
  stagedCount: number;
  hasUnstaged: boolean;
  unstagedCount: number;
  hasUntracked: boolean;
  untrackedCount: number;
  stashCount: number;
  unpushedBranches: string[];
  neverPushedBranches: string[];
  isDetachedHead: boolean;
  isClean: boolean;
}

/**
 * Git state result from agent-env (may succeed or fail per-instance)
 */
export interface GitStateResult {
  ok: boolean;
  state: GitState | null;
  error?: { code: string; message: string; suggestion?: string };
}

/**
 * Instance information from `agent-env list --json`
 */
export interface Instance {
  name: string;
  status: InstanceDisplayStatus;
  lastAttached: string | null;
  purpose: string | null;
  gitState: GitStateResult | null;
}

/**
 * Result of instance discovery operation
 */
export interface DiscoveryResult {
  instances: Instance[];
  error: string | null;
}

/**
 * JSON envelope from `agent-env list --json`
 */
export interface AgentEnvJsonOutput {
  ok: boolean;
  data: Instance[] | null;
  error: { code: string; message: string; suggestion?: string } | null;
}
