/**
 * Managed image pull helper for agent-env.
 *
 * Shared by both create and rebuild orchestration paths to pull the
 * version-pinned managed container image, with a uniform `--no-pull`
 * warning so the user receives a consistent signal that the cached
 * image may not match the current agent-env version.
 */

import type { ContainerLifecycle } from './container.js';

export interface PullManagedImageDeps {
  container: ContainerLifecycle;
  logger?: { warn(m: string): void; info(m: string): void };
}

export type PullManagedImageResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; suggestion?: string } };

/**
 * Pull (or skip-with-warning) the agent-env managed container image.
 *
 * Used by both create and rebuild orchestration paths. When `pull` is
 * false, emits a warning whose message contains the literal substring
 * "Using cached image; not matched to current agent-env version"
 * (AC15 contract — keep this phrase verbatim).
 */
export async function pullManagedImage(
  managedImage: string,
  pull: boolean,
  deps: PullManagedImageDeps
): Promise<PullManagedImageResult> {
  if (!pull) {
    deps.logger?.warn(
      `Using cached image; not matched to current agent-env version. ` +
        `Skipping pull of ${managedImage} (--no-pull). The container will start with whichever ` +
        `image is already cached locally. Re-run without --no-pull to fetch the pinned image.`
    );
    return { ok: true };
  }
  deps.logger?.info(
    `Pulling ${managedImage}... (no progress output; a first download of this multi-GB image may take several minutes)`
  );
  const result = await deps.container.dockerPull(managedImage);
  if (!result.ok) return { ok: false, error: result.error };
  deps.logger?.info(`Pulled ${managedImage}`);
  return { ok: true };
}
