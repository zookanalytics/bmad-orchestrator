import { describe, expect, it } from 'vitest';

import type { AppError } from './types.js';

import { createError, formatError } from './errors.js';

describe('errors', () => {
  describe('formatError', () => {
    it('returns colored output with error code and message', () => {
      const error: AppError = {
        code: 'GIT_ERROR',
        message: 'Git command failed',
      };

      const result = formatError(error);

      // Should contain the error code in brackets
      expect(result).toContain('[GIT_ERROR]');
      // Should contain the message
      expect(result).toContain('Git command failed');
      // Should have red ANSI code for error
      expect(result).toContain('\x1b[31m');
      // Should have reset code
      expect(result).toContain('\x1b[0m');
    });

    it('includes suggestion when provided', () => {
      const error: AppError = {
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace does not exist',
        suggestion: 'Run "agent-env create" to create a new workspace',
      };

      const result = formatError(error);

      // Should contain the suggestion
      expect(result).toContain('Run "agent-env create" to create a new workspace');
      // Should have lightbulb emoji
      expect(result).toContain('💡');
      // Should have cyan color for suggestion
      expect(result).toContain('\x1b[36m');
    });

    it('handles missing suggestion gracefully', () => {
      const error: AppError = {
        code: 'CONTAINER_ERROR',
        message: 'Container failed to start',
      };

      const result = formatError(error);

      // Should not contain lightbulb or suggestion line
      expect(result).not.toContain('💡');
      // Should be single line (no newline)
      const lines = result.split('\n');
      expect(lines).toHaveLength(1);
    });

    it('formats multiline output with suggestion correctly', () => {
      const error: AppError = {
        code: 'SAFETY_CHECK_FAILED',
        message: 'Cannot remove workspace with uncommitted changes',
        suggestion: 'Commit or stash your changes first',
      };

      const result = formatError(error);
      const lines = result.split('\n');

      // Should have exactly 2 lines
      expect(lines).toHaveLength(2);
      // First line has error
      expect(lines[0]).toContain('[SAFETY_CHECK_FAILED]');
      // Second line has suggestion with indentation
      expect(lines[1]).toMatch(/^\s+/); // starts with whitespace
      expect(lines[1]).toContain('💡');
    });

    it('uses cross emoji prefix for errors', () => {
      const error: AppError = {
        code: 'TEST_ERROR',
        message: 'Test message',
      };

      const result = formatError(error);

      expect(result).toContain('❌');
    });
  });

  describe('createError', () => {
    it('creates AppError with all fields', () => {
      const error = createError(
        'ORBSTACK_REQUIRED',
        'OrbStack is not running',
        'Start OrbStack and try again'
      );

      expect(error).toEqual({
        code: 'ORBSTACK_REQUIRED',
        message: 'OrbStack is not running',
        suggestion: 'Start OrbStack and try again',
      });
    });

    it('creates AppError with only required fields', () => {
      const error = createError('GIT_ERROR', 'Git command failed');

      expect(error).toEqual({
        code: 'GIT_ERROR',
        message: 'Git command failed',
      });
      expect(error).not.toHaveProperty('suggestion');
    });

    it('omits undefined suggestion', () => {
      const error = createError('TEST_ERROR', 'Test message', undefined);

      expect(error).toEqual({
        code: 'TEST_ERROR',
        message: 'Test message',
      });
      // Ensure suggestion key is not present
      expect(Object.keys(error)).toEqual(['code', 'message']);
    });

    it('omits empty string suggestion (falsy value)', () => {
      // Empty string is falsy, so it should be omitted like undefined
      const error = createError('TEST_ERROR', 'Test message', '');

      expect(error).not.toHaveProperty('suggestion');
    });
  });
});
