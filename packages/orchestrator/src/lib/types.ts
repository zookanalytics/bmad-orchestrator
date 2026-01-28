/**
 * Type definitions for DevPod discovery and orchestration
 *
 * These types match the DevPod CLI output structure from `devpod list --output json`
 * and `devpod status --output json`.
 *
 * @see https://github.com/loft-sh/devpod
 */

/**
 * Status of a DevPod workspace as reported by DevPod CLI
 *
 * @remarks
 * These values match the Status constants in DevPod's client package:
 * - Running: Workspace is active and accessible
 * - Stopped: Workspace exists but is not running
 * - Busy: Workspace is currently in transition (starting/stopping)
 * - NotFound: Workspace configuration exists but container is missing
 */
export type DevPodStatus = 'Busy' | 'NotFound' | 'Running' | 'Stopped';

/**
 * Source specification for a DevPod workspace
 *
 * Represents where the workspace code comes from - can be a local folder,
 * git repository, Docker image, or existing container.
 */
export interface DevPodSource {
  /** Git branch name */
  gitBranch?: string;
  /** Git commit SHA */
  gitCommit?: string;
  /** Git pull request reference */
  gitPRReference?: string;
  /** Git repository URL */
  gitRepository?: string;
  /** Subdirectory within the git repository */
  gitSubPath?: string;
  /** Docker image identifier */
  image?: string;
  /** Local folder path on host machine */
  localFolder?: string;
}

/**
 * Machine configuration for a DevPod workspace
 */
export interface DevPodMachineConfig {
  /** Whether to automatically delete the machine when workspace is deleted */
  autoDelete?: boolean;
  /** Machine identifier */
  id?: string;
}

/**
 * Provider configuration for a DevPod workspace
 */
export interface DevPodProviderConfig {
  /** Provider name (e.g., "docker", "kubernetes", "ssh") */
  name?: string;
  /** Provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * IDE configuration for a DevPod workspace
 */
export interface DevPodIDEConfig {
  /** IDE name (e.g., "vscode", "cursor", "openvscode") */
  name?: string;
  /** IDE-specific options */
  options?: Record<string, unknown>;
}

/**
 * DevPod workspace information from `devpod list --output json`
 *
 * @remarks
 * This interface represents a single workspace entry as returned by the
 * DevPod CLI. The field names use camelCase to match the JSON output.
 */
export interface DevPod {
  /** Optional context name */
  context?: string;
  /** Workspace creation timestamp */
  creationTimestamp?: DevPodTimestamp;
  /** Custom devcontainer.json path relative to workspace root */
  devContainerPath?: string;
  /** Workspace unique identifier (typically the workspace name) */
  id: string;
  /** IDE configuration */
  ide?: DevPodIDEConfig;
  /** Whether workspace was imported from external source */
  imported?: boolean;
  /** Timestamp of last workspace access */
  lastUsedTimestamp?: DevPodTimestamp;
  /** Machine configuration */
  machine?: DevPodMachineConfig;
  /** Configuration file origin path */
  origin?: string;
  /** Social media preview image URL */
  picture?: string;
  /** Provider configuration */
  provider?: DevPodProviderConfig;
  /** Workspace source specification */
  source?: DevPodSource;
  /** Unique identifier for this workspace instance */
  uid?: string;
}

/**
 * Timestamp structure from DevPod CLI
 */
export interface DevPodTimestamp {
  /** ISO 8601 timestamp string */
  Time?: string;
}

/**
 * Result of DevPod discovery operation
 *
 * @remarks
 * This interface wraps the discovery result, providing both the list of
 * discovered DevPods and any error that occurred during discovery.
 */
export interface DiscoveryResult {
  /** List of discovered DevPod workspaces */
  devpods: DevPod[];
  /** Error message if discovery failed, null otherwise */
  error: string | null;
}

/**
 * Generic raw object type for parsing unknown JSON structures.
 */
export type RawObject = Record<string, unknown>;
