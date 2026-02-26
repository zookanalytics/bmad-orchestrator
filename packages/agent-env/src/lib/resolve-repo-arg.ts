/**
 * Repo argument resolution for agent-env
 *
 * Detects whether a --repo argument is a URL, ".", or a slug.
 * Slugs are resolved to full URLs via the repo registry (listRepos).
 */

import type { ListReposResult } from './list-repos.js';

import { listRepos } from './list-repos.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ResolveRepoArgResult =
  | { ok: true; url: string; resolvedFromSlug: boolean }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

export interface ResolveRepoArgDeps {
  listRepos: () => Promise<ListReposResult>;
}

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Detect whether a repo argument looks like a URL.
 *
 * Returns true if the value contains "://" or starts with "git@".
 * These are the two standard git URL formats (HTTPS and SSH).
 */
export function isRepoUrl(value: string): boolean {
  return value.includes('://') || value.startsWith('git@');
}

// ─── Resolution ──────────────────────────────────────────────────────────────

/**
 * Resolve a --repo argument to a full URL.
 *
 * Logic:
 * - If the value is ".", pass through (handled downstream by resolveRepoUrl)
 * - If the value looks like a URL (contains "://" or starts with "git@"), pass through
 * - Otherwise, treat as a slug and look up in the repo registry
 *
 * @param repoArg - The raw --repo flag value
 * @param deps - Injectable dependencies for testing
 * @returns Resolved URL or error
 */
export async function resolveRepoArg(
  repoArg: string,
  deps?: Partial<ResolveRepoArgDeps>
): Promise<ResolveRepoArgResult> {
  // "." is a special case handled by resolveRepoUrl — pass through
  if (repoArg === '.') {
    return { ok: true, url: '.', resolvedFromSlug: false };
  }

  // URL detection: contains :// or starts with git@
  if (isRepoUrl(repoArg)) {
    return { ok: true, url: repoArg, resolvedFromSlug: false };
  }

  // Treat as slug — resolve via repo registry
  const listFn = deps?.listRepos ?? listRepos;
  const result = await listFn();

  if (!result.ok) {
    return {
      ok: false,
      error: {
        code: 'REPO_LOOKUP_ERROR',
        message: `Failed to look up repo registry: ${result.error.message}`,
        suggestion: 'Check filesystem permissions for the ~/.agent-env directory.',
      },
    };
  }

  const match = result.repos.find((r) => r.slug === repoArg);
  if (!match) {
    return {
      ok: false,
      error: {
        code: 'REPO_NOT_FOUND',
        message: `Repository '${repoArg}' not found.`,
        suggestion: 'Use a full URL or run `agent-env repos` to see tracked repos.',
      },
    };
  }

  return { ok: true, url: match.url, resolvedFromSlug: true };
}
