import { describe, it, expect, vi } from 'vitest';

import type { SetupAudioDeps } from './setup-audio.js';

import { setupAudio } from './setup-audio.js';

function createMockDeps(overrides: Partial<SetupAudioDeps> = {}): SetupAudioDeps {
  return {
    platform: 'darwin',
    homeDir: '/Users/testuser',
    execute: vi.fn().mockResolvedValue({ ok: true, stdout: '', stderr: '', exitCode: 0 }),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('setupAudio', () => {
  describe('platform check', () => {
    it('rejects non-macOS platforms', async () => {
      const deps = createMockDeps({ platform: 'linux' });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/macOS/i);
    });

    it('accepts darwin platform', async () => {
      const deps = createMockDeps();
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
    });
  });

  describe('PulseAudio check', () => {
    it('fails when brew --prefix pulseaudio fails', async () => {
      const deps = createMockDeps({
        execute: vi
          .fn()
          .mockResolvedValue({ ok: false, stdout: '', stderr: 'not found', exitCode: 1 }),
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/brew install pulseaudio/);
    });
  });

  describe('TCP module', () => {
    it('loads module when not already loaded', async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          stdout: '/opt/homebrew/opt/pulseaudio',
          stderr: '',
          exitCode: 0,
        }) // brew --prefix
        .mockResolvedValueOnce({
          ok: true,
          stdout: 'module-cli-protocol-unix',
          stderr: '',
          exitCode: 0,
        }) // pactl list (no TCP)
        .mockResolvedValueOnce({ ok: true, stdout: '42', stderr: '', exitCode: 0 }); // pactl load-module
      const deps = createMockDeps({ execute: mockExecute });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(mockExecute).toHaveBeenCalledWith('pactl', [
        'load-module',
        'module-native-protocol-tcp',
        'auth-cookie-enabled=1',
        'listen=127.0.0.1',
        'port=4713',
      ]);
      expect(result.steps).toContain('TCP module loaded');
    });

    it('skips loading when module is already loaded', async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          stdout: '/opt/homebrew/opt/pulseaudio',
          stderr: '',
          exitCode: 0,
        }) // brew --prefix
        .mockResolvedValueOnce({
          ok: true,
          stdout: '25\tmodule-native-protocol-tcp',
          stderr: '',
          exitCode: 0,
        }); // pactl list (has TCP)
      const deps = createMockDeps({ execute: mockExecute });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(result.steps).toContain('TCP module already loaded');
    });
  });

  describe('default.pa persistence', () => {
    it('appends TCP module line when not present', async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          stdout: '/opt/homebrew/opt/pulseaudio',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          ok: true,
          stdout: '25\tmodule-native-protocol-tcp',
          stderr: '',
          exitCode: 0,
        });
      const mockWriteFile = vi.fn().mockResolvedValue(undefined);
      const deps = createMockDeps({
        execute: mockExecute,
        readFile: vi.fn().mockResolvedValue('.include /etc/pulse/default.pa.d\n'),
        writeFile: mockWriteFile,
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/opt/homebrew/opt/pulseaudio/etc/pulse/default.pa',
        expect.stringContaining('module-native-protocol-tcp'),
        'utf-8'
      );
      expect(result.steps).toContain('TCP module persisted to default.pa');
    });

    it('skips write when TCP module already in default.pa', async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          stdout: '/opt/homebrew/opt/pulseaudio',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          ok: true,
          stdout: '25\tmodule-native-protocol-tcp',
          stderr: '',
          exitCode: 0,
        });
      const mockWriteFile = vi.fn();
      const deps = createMockDeps({
        execute: mockExecute,
        readFile: vi
          .fn()
          .mockResolvedValue('load-module module-native-protocol-tcp auth-cookie-enabled=1\n'),
        writeFile: mockWriteFile,
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(result.steps).toContain('TCP module already in default.pa');
    });
  });

  describe('cookie staging', () => {
    it('copies cookie to ~/.agent-env/pulse/', async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          stdout: '/opt/homebrew/opt/pulseaudio',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          ok: true,
          stdout: '25\tmodule-native-protocol-tcp',
          stderr: '',
          exitCode: 0,
        });
      const mockCopyFile = vi.fn().mockResolvedValue(undefined);
      const mockMkdir = vi.fn().mockResolvedValue(undefined);
      const deps = createMockDeps({
        execute: mockExecute,
        readFile: vi.fn().mockResolvedValue('load-module module-native-protocol-tcp\n'),
        copyFile: mockCopyFile,
        mkdir: mockMkdir,
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(true);
      expect(mockMkdir).toHaveBeenCalledWith('/Users/testuser/.agent-env/pulse', {
        recursive: true,
      });
      expect(mockCopyFile).toHaveBeenCalledWith(
        '/Users/testuser/.config/pulse/cookie',
        '/Users/testuser/.agent-env/pulse/cookie'
      );
      expect(result.steps).toContain('Cookie staged');
    });

    it('fails when cookie does not exist', async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          stdout: '/opt/homebrew/opt/pulseaudio',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          ok: true,
          stdout: '25\tmodule-native-protocol-tcp',
          stderr: '',
          exitCode: 0,
        });
      const deps = createMockDeps({
        execute: mockExecute,
        readFile: vi.fn().mockResolvedValue('load-module module-native-protocol-tcp\n'),
        access: vi.fn().mockRejectedValue(new Error('ENOENT')),
      });
      const result = await setupAudio(deps);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/cookie not found/i);
    });
  });
});
