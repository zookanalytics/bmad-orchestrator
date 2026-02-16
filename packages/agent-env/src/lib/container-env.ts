/**
 * Container environment detection helpers for agent-env
 *
 * Provides utilities to detect whether the CLI is running inside
 * an agent-env container and resolve the appropriate state file path.
 *
 * Detection mechanism: The `AGENT_ENV_CONTAINER` environment variable
 * is set to "true" in devcontainer.json containerEnv (Story 6.1/6.2).
 */

/** Path to state.json when running inside a container (bind-mounted from host) */
export const CONTAINER_STATE_PATH = '/etc/agent-env/state.json';

/** Path to the agent-env directory inside the container */
export const CONTAINER_AGENT_ENV_DIR = '/etc/agent-env';

// ─── Types for dependency injection ──────────────────────────────────────────

export interface ContainerEnvDeps {
  getEnv: (key: string) => string | undefined;
}

const defaultContainerEnvDeps: ContainerEnvDeps = {
  getEnv: (key: string) => process.env[key],
};

// ─── Detection Helpers ──────────────────────────────────────────────────────

/**
 * Detect whether the CLI is running inside an agent-env container.
 *
 * Checks the `AGENT_ENV_CONTAINER` environment variable, which is set
 * to "true" in the baseline devcontainer.json containerEnv.
 *
 * @param deps - Injectable dependencies for testing
 * @returns true if running inside a container
 */
export function isInsideContainer(deps: ContainerEnvDeps = defaultContainerEnvDeps): boolean {
  return deps.getEnv('AGENT_ENV_CONTAINER') === 'true';
}

/**
 * Resolve the state.json file path based on execution environment.
 *
 * Inside a container: returns `/etc/agent-env/state.json` (bind-mounted)
 * On the host: returns undefined (caller should use workspace-based lookup)
 *
 * @param deps - Injectable dependencies for testing
 * @returns Absolute path to state.json if inside container, undefined if on host
 */
export function resolveContainerStatePath(
  deps: ContainerEnvDeps = defaultContainerEnvDeps
): string | undefined {
  if (isInsideContainer(deps)) {
    return CONTAINER_STATE_PATH;
  }
  return undefined;
}
