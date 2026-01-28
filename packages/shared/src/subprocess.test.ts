import { describe, expect, it, vi } from 'vitest';

import type { Executor } from './subprocess.js';

import { createExecutor, execute } from './subprocess.js';

describe('subprocess', () => {
  describe('createExecutor', () => {
    it('returns a function that never throws', async () => {
      // Mock executor that simulates a failed command
      const mockExecutor = vi.fn().mockResolvedValue({
        failed: true,
        stdout: '',
        stderr: 'command not found',
        exitCode: 127,
      }) as unknown as Executor;

      const exec = createExecutor(mockExecutor);

      // Should not throw even though command "failed"
      await expect(exec('nonexistent', [])).resolves.not.toThrow();
    });

    it('accepts custom executor for dependency injection', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        failed: false,
        stdout: 'mocked output',
        stderr: '',
        exitCode: 0,
      }) as unknown as Executor;

      const exec = createExecutor(mockExecutor);
      const result = await exec('test', ['arg1', 'arg2']);

      expect(mockExecutor).toHaveBeenCalledWith('test', ['arg1', 'arg2'], {
        reject: false,
      });
      expect(result.stdout).toBe('mocked output');
    });

    it('passes through custom options with reject: false always set', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        failed: false,
        stdout: '',
        stderr: '',
        exitCode: 0,
      }) as unknown as Executor;

      const exec = createExecutor(mockExecutor);
      await exec('test', [], { timeout: 5000, cwd: '/tmp' });

      expect(mockExecutor).toHaveBeenCalledWith('test', [], {
        reject: false,
        timeout: 5000,
        cwd: '/tmp',
      });
    });
  });

  describe('execute', () => {
    it('returns ok: true for successful commands', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        failed: false,
        stdout: 'success output',
        stderr: '',
        exitCode: 0,
      }) as unknown as Executor;

      const exec = createExecutor(mockExecutor);
      const result = await exec('echo', ['hello']);

      expect(result.ok).toBe(true);
      expect(result.stdout).toBe('success output');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
    });

    it('returns ok: false for failed commands', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        failed: true,
        stdout: '',
        stderr: 'error: permission denied',
        exitCode: 1,
      }) as unknown as Executor;

      const exec = createExecutor(mockExecutor);
      const result = await exec('rm', ['/protected']);

      expect(result.ok).toBe(false);
      expect(result.stderr).toBe('error: permission denied');
      expect(result.exitCode).toBe(1);
    });

    it('captures stdout, stderr, and exitCode', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        failed: false,
        stdout: 'standard output',
        stderr: 'standard error',
        exitCode: 0,
      }) as unknown as Executor;

      const exec = createExecutor(mockExecutor);
      const result = await exec('some-cmd', []);

      expect(result).toEqual({
        ok: true,
        stdout: 'standard output',
        stderr: 'standard error',
        exitCode: 0,
      });
    });

    it('handles undefined stdout/stderr/exitCode gracefully', async () => {
      // Some edge cases might return undefined fields
      const mockExecutor = vi.fn().mockResolvedValue({
        failed: false,
        stdout: undefined,
        stderr: undefined,
        exitCode: undefined,
      }) as unknown as Executor;

      const exec = createExecutor(mockExecutor);
      const result = await exec('test', []);

      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(-1);
    });

    it('handles null stdout/stderr gracefully', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        failed: false,
        stdout: null,
        stderr: null,
        exitCode: 0,
      }) as unknown as Executor;

      const exec = createExecutor(mockExecutor);
      const result = await exec('test', []);

      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });
  });

  describe('default execute export', () => {
    it('is pre-configured with default execa', () => {
      // The default execute function should be a function
      expect(typeof execute).toBe('function');
    });
  });
});
