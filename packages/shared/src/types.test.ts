import { describe, expectTypeOf, it } from 'vitest';

import type { AppError, JsonOutput } from './types.js';

describe('types', () => {
  describe('AppError', () => {
    it('has required code and message fields', () => {
      const error: AppError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
      };

      expectTypeOf(error.code).toBeString();
      expectTypeOf(error.message).toBeString();
    });

    it('has optional suggestion field', () => {
      const error: AppError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        suggestion: 'Try this instead',
      };

      expectTypeOf(error.suggestion).toEqualTypeOf<string | undefined>();
    });

    it('works without suggestion field', () => {
      const error: AppError = {
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace does not exist',
      };

      expectTypeOf(error).toMatchTypeOf<AppError>();
    });
  });

  describe('JsonOutput', () => {
    it('works with generic data type', () => {
      interface TestData {
        id: number;
        name: string;
      }

      const successOutput: JsonOutput<TestData> = {
        ok: true,
        data: { id: 1, name: 'test' },
        error: null,
      };

      expectTypeOf(successOutput.ok).toBeBoolean();
      expectTypeOf(successOutput.data).toEqualTypeOf<TestData | null>();
      expectTypeOf(successOutput.error).toEqualTypeOf<AppError | null>();
    });

    it('works with array data type', () => {
      const output: JsonOutput<string[]> = {
        ok: true,
        data: ['a', 'b', 'c'],
        error: null,
      };

      expectTypeOf(output.data).toEqualTypeOf<string[] | null>();
    });

    it('works for error case', () => {
      const errorOutput: JsonOutput<never> = {
        ok: false,
        data: null,
        error: {
          code: 'GIT_ERROR',
          message: 'Git command failed',
        },
      };

      expectTypeOf(errorOutput.ok).toBeBoolean();
      expectTypeOf(errorOutput.error).toEqualTypeOf<AppError | null>();
    });

    it('data and error are nullable', () => {
      const output: JsonOutput<string> = {
        ok: true,
        data: 'hello',
        error: null,
      };

      // Both can be null
      expectTypeOf(output.data).toEqualTypeOf<string | null>();
      expectTypeOf(output.error).toEqualTypeOf<AppError | null>();
    });
  });
});
