/**
 * Repo listing logic for agent-env
 *
 * Scans workspaces and aggregates repo information from state.json files.
 * The repo registry is derived from existing workspaces — no separate file.
 */

import type { StateFsDeps } from './state.js';
import type { FsDeps } from './workspace.js';

import { readState } from './state.js';
import { getWorkspacePathByName, scanWorkspaces } from './workspace.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Aggregated information about a tracked repository */
export interface RepoInfo {
  /** Repo slug derived from git remote URL (e.g., "bmad-orchestrator") */
  slug: string;
  /** Full git remote URL */
  url: string;
  /** Number of instances for this repo */
  instanceCount: number;
}

/** Successful result from listing repos */
export type ListReposSuccess = {
  ok: true;
  repos: RepoInfo[];
};

/** Error result from listing repos */
export type ListReposError = {
  ok: false;
  repos: null;
  error: { code: string; message: string };
};

/** Result from listing repos */
export type ListReposResult = ListReposSuccess | ListReposError;

/** Dependencies for the repo lister */
export interface ListReposDeps {
  workspaceFsDeps: FsDeps;
  stateFsDeps: Pick<StateFsDeps, 'readFile'>;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * List all tracked repositories by scanning existing workspaces.
 *
 * Scans workspace directories, reads state.json for each, and aggregates
 * by repo slug. Repos with only "unknown" slugs (corrupted state) are excluded.
 *
 * @param deps - Injectable dependencies for testing
 * @returns ListReposResult with aggregated repo info sorted alphabetically by slug
 */
export async function listRepos(deps?: Partial<ListReposDeps>): Promise<ListReposResult> {
  try {
    const wsFsDeps = deps?.workspaceFsDeps;
    const stateFsDeps = deps?.stateFsDeps;

    // Step 1: Scan for workspace names
    const workspaceNames = await scanWorkspaces(wsFsDeps);

    if (workspaceNames.length === 0) {
      return { ok: true, repos: [] };
    }

    // Step 2: Read state for each workspace and aggregate by repo slug
    const repoMap = new Map<string, { url: string; count: number }>();

    for (const wsName of workspaceNames) {
      const wsPath = getWorkspacePathByName(wsName, wsFsDeps);
      const state = await readState(wsPath, stateFsDeps);

      // Skip workspaces with unknown/fallback state
      if (state.repoSlug === 'unknown') {
        continue;
      }

      const existing = repoMap.get(state.repoSlug);
      if (existing) {
        existing.count += 1;
      } else {
        repoMap.set(state.repoSlug, { url: state.repoUrl, count: 1 });
      }
    }

    // Step 3: Convert to sorted array
    const repos: RepoInfo[] = Array.from(repoMap.entries())
      .map(([slug, { url, count }]) => ({
        slug,
        url,
        instanceCount: count,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));

    return { ok: true, repos };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      repos: null,
      error: { code: 'LIST_REPOS_ERROR', message: `Failed to list repos: ${message}` },
    };
  }
}
