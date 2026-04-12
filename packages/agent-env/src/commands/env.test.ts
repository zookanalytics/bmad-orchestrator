import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockGetRepoEnvDir = vi.fn().mockReturnValue('/home/user/.agent-env/repos/my-repo');
const mockLoadRepoEnv = vi.fn().mockResolvedValue({});

vi.mock('@zookanalytics/shared', () => ({
  formatError: (err: unknown) => JSON.stringify(err),
  createError: (code: string, message: string) => ({ code, message }),
}));

vi.mock('../lib/repo-env.js', () => ({
  getRepoEnvDir: (...args: unknown[]) => mockGetRepoEnvDir(...args),
  loadRepoEnv: (...args: unknown[]) => mockLoadRepoEnv(...args),
}));

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn().mockReturnValue({ status: 0 }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
}));

// Import after mocks
const { envCommand } = await import('./env.js');

// ─── Tests ──────────────────────────────────────────────────────────────────

let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockGetRepoEnvDir.mockReset().mockReturnValue('/home/user/.agent-env/repos/my-repo');
  mockLoadRepoEnv.mockReset().mockResolvedValue({});
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('env command', () => {
  it('prints repo env directory with --path', async () => {
    await envCommand.parseAsync(['node', 'env', 'my-repo', '--path']);

    expect(consoleLogSpy).toHaveBeenCalledWith('/home/user/.agent-env/repos/my-repo');
  });

  it('shows empty message when no env files exist', async () => {
    mockLoadRepoEnv.mockResolvedValue({});

    await envCommand.parseAsync(['node', 'env', 'my-repo']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No env files found'));
  });

  it('lists merged env vars when files exist', async () => {
    mockLoadRepoEnv.mockResolvedValue({ API_KEY: 'abc123', DB_HOST: 'localhost' });

    await envCommand.parseAsync(['node', 'env', 'my-repo']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Repo env vars'));
    expect(consoleLogSpy).toHaveBeenCalledWith('  API_KEY=abc123');
    expect(consoleLogSpy).toHaveBeenCalledWith('  DB_HOST=localhost');
  });

  it('opens editor with --edit using spawnSync', async () => {
    const { spawnSync } = await import('node:child_process');

    await envCommand.parseAsync(['node', 'env', 'my-repo', '--edit']);

    expect(spawnSync).toHaveBeenCalledWith(
      expect.any(String),
      ['/home/user/.agent-env/repos/my-repo/.env'],
      { stdio: 'inherit' }
    );
  });

  it('opens editor for .env.local with --edit-local', async () => {
    const { spawnSync } = await import('node:child_process');

    await envCommand.parseAsync(['node', 'env', 'my-repo', '--edit-local']);

    expect(spawnSync).toHaveBeenCalledWith(
      expect.any(String),
      ['/home/user/.agent-env/repos/my-repo/.env.local'],
      { stdio: 'inherit' }
    );
  });
});
