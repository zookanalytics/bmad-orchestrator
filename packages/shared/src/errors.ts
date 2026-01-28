import type { AppError } from './types.js';

/**
 * Format an AppError for terminal display with colors
 *
 * Output format:
 * ❌ [ERROR_CODE] Error message
 *    💡 Suggestion text (if provided)
 */
export function formatError(error: AppError): string {
  const lines: string[] = [];

  // Red color for error prefix
  lines.push(`\x1b[31m❌ [${error.code}]\x1b[0m ${error.message}`);

  if (error.suggestion) {
    // Cyan color for suggestion with indentation
    lines.push(`   \x1b[36m💡 ${error.suggestion}\x1b[0m`);
  }

  return lines.join('\n');
}

/**
 * Create an AppError with required fields
 */
export function createError(code: string, message: string, suggestion?: string): AppError {
  return { code, message, ...(suggestion && { suggestion }) };
}
