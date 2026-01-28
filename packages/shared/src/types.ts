/**
 * Standardized error type for all CLI operations
 */
export interface AppError {
  /** Machine-readable error code (e.g., "GIT_ERROR") */
  code: string;
  /** Human-readable error description */
  message: string;
  /** Optional actionable suggestion for the user */
  suggestion?: string;
}

/**
 * Standardized JSON output for --json flag
 */
export interface JsonOutput<T> {
  ok: boolean;
  data: T | null;
  error: AppError | null;
}
