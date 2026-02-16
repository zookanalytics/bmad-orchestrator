import { execa } from 'execa';
import { mkdir, readdir, rm, writeFile, chmod, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';

// Constants from workspace.ts and types.ts for setting up test environment
const AGENT_ENV_DIR = '.agent-env';
const WORKSPACES_DIR = 'workspaces';
const STATE_FILE = 'state.json';

// Path to the mock executable script
const MOCK_EXECUTABLE_SCRIPT_PATH = join(
  import.meta.dirname,
  '../test-utils',
  'mock-executables.js'
);

// Helper function to strip ANSI escape codes
function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[\d+m/g, '');
}

// ─── Environment setup ───────────────────────────────────────────────────────

let tempTestBinDir: string; // Directory for mock git/docker executables
let tempRoot: string; // Acts as ~ for agent-env to store its workspaces

/**
 * Creates an executable shim script for a command (e.g., 'git', 'docker')
 * that points to our central mock-executables.js.
 */
async function createMockExecutableShim(commandName: string) {
  const shimPath = join(tempTestBinDir, commandName);
  const shimContent = `#!/usr/bin/env bash
  export MOCK_COMMAND="${commandName}"
  exec node "${MOCK_EXECUTABLE_SCRIPT_PATH}" "$@"
  `;
  await writeFile(shimPath, shimContent, { encoding: 'utf8' });
  await chmod(shimPath, 0o755); // Make it executable
}

beforeAll(async () => {
  // Create a temporary directory for our mock executables
  tempTestBinDir = join(
    tmpdir(),
    `agent-env-test-bin-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempTestBinDir, { recursive: true });

  // Create mock 'git', 'docker', 'devcontainer' executables
  await createMockExecutableShim('git');
  await createMockExecutableShim('docker');
  await createMockExecutableShim('devcontainer');
});

beforeEach(async () => {
  // Create a temporary directory to act as the user's home directory
  tempRoot = join(
    tmpdir(),
    `agent-env-temp-home-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempRoot, { recursive: true });

  // Reset mock environment variables for each test
  delete process.env.MOCK_GIT_STATE;
  delete process.env.MOCK_DOCKER_AVAILABLE;
  delete process.env.MOCK_DOCKER_STOP_FAIL;
  delete process.env.MOCK_DOCKER_RM_FAIL;
});

afterEach(async () => {
  // Clean up the temporary home directory
  await rm(tempRoot, { recursive: true, force: true });
});

afterAll(async () => {
  // Clean up the temporary bin directory
  await rm(tempTestBinDir, { recursive: true, force: true });
});

/**
 * Helper to run the agent-env CLI with the test environment.
 */
const runCli = async (args: string[], extraEnv: Record<string, string> = {}) => {
  // Determine the correct CWD for the CLI executable
  const cliCwd = join(import.meta.dirname, '..'); // Go up one level from 'src'
  return execa('tsx', [join(cliCwd, 'src', 'cli.ts'), ...args], {
    cwd: cliCwd,
    reject: false,
    env: {
      ...process.env, // Inherit current process environment
      HOME: tempRoot, // Redirect user's home to our temp directory
      PATH: `${tempTestBinDir}:${process.env.PATH}`, // Prepend mock executables to PATH
      ...extraEnv, // Allow test-specific environment variables
    },
  });
};

/**
 * Creates a mock workspace for testing `remove` command.
 */
async function createMockWorkspace(
  instanceName: string,
  stateOverrides: Record<string, unknown> = {}
) {
  const wsRoot = join(tempRoot, AGENT_ENV_DIR, WORKSPACES_DIR, `repo-${instanceName}`);
  const agentEnvDir = join(wsRoot, AGENT_ENV_DIR);
  const stateFile = join(agentEnvDir, STATE_FILE);

  await mkdir(agentEnvDir, { recursive: true });

  const defaultState = {
    name: `repo-${instanceName}`,
    repo: 'https://github.com/test/repo.git',
    createdAt: '2026-01-01T00:00:00Z',
    containerName: `ae-repo-${instanceName}`,
    ...stateOverrides,
  };

  await writeFile(stateFile, JSON.stringify(defaultState, null, 2), 'utf8');

  // If git related mocks are used, create a .git dir to make git commands work
  await mkdir(join(wsRoot, '.git'), { recursive: true });
}

// ─── CLI tests ───────────────────────────────────────────────────────────────

describe('agent-env CLI', () => {
  describe('--help', () => {
    it('displays usage information', async () => {
      const result = await runCli(['--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('agent-env');
      expect(result.stdout).toContain('Usage:');
    });

    it('lists available commands', async () => {
      const result = await runCli(['--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('create');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('attach');
      expect(result.stdout).toContain('remove');
      expect(result.stdout).toContain('purpose');
      expect(result.stdout).toContain('completion');
    });
  });

  describe('--version', () => {
    it('displays version number', async () => {
      const result = await runCli(['--version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('no arguments', () => {
    it('shows help output in non-TTY mode (piped)', async () => {
      const result = await runCli([]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Usage:');
    });
  });

  describe('create command', () => {
    it('create without --repo shows missing option error', async () => {
      const result = await runCli(['create', 'test-instance']);
      const stderrStripped = stripAnsiCodes(result.stderr);
      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(/❌ \[MISSING_OPTION\] The --repo flag is required\./);
    });

    it('create --help shows --repo, --purpose, and --attach options', async () => {
      const result = await runCli(['create', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--repo');
      expect(result.stdout).toContain('--purpose');
      expect(result.stdout).toContain('--attach');
    });

    it('create with --repo . resolves current directory git remote', async () => {
      const result = await runCli(['create', 'test-instance', '--repo', '.']);
      const output = stripAnsiCodes(result.stdout + result.stderr);

      // Should NOT show MISSING_OPTION error
      expect(output).not.toContain('MISSING_OPTION');
      // Should show "Creating instance" (meaning URL was resolved via mock git)
      expect(output).toContain('Creating instance');
    }, 15000);
  });

  describe('list command', () => {
    it('list shows no instances when workspace directory does not exist', async () => {
      const result = await runCli(['list']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No instances found');
    });

    it('list --json returns valid JSON with empty data when no instances', async () => {
      const result = await runCli(['list', '--json']);
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.ok).toBe(true);
      expect(output.data).toEqual([]);
      expect(output.error).toBeNull();
    });

    it('ps alias works identically to list', async () => {
      const result = await runCli(['ps']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No instances found');
    });
  });

  describe('attach command', () => {
    it('attach shows instance not found when instance does not exist', async () => {
      const result = await runCli(['attach', 'test-instance']);
      const stderrStripped = stripAnsiCodes(result.stderr);
      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(
        /❌ \[WORKSPACE_NOT_FOUND\] Instance 'test-instance' not found/
      );
    });
  });

  describe('purpose command', () => {
    it('purpose shows instance not found when instance does not exist', async () => {
      const result = await runCli(['purpose', 'test-instance']);
      const stderrStripped = stripAnsiCodes(result.stderr);
      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(
        /❌ \[WORKSPACE_NOT_FOUND\] Instance 'test-instance' not found/
      );
    });

    it('purpose on host requires instance name', async () => {
      const result = await runCli(['purpose']);
      const stderrStripped = stripAnsiCodes(result.stderr);
      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(/MISSING_ARGUMENT/);
    });

    it('purpose inside container reads from /etc/agent-env/state.json', async () => {
      // Create state file at temp location simulating container mount
      const etcAgentEnv = join(tempRoot, 'etc-agent-env');
      await mkdir(etcAgentEnv, { recursive: true });
      const statePath = join(etcAgentEnv, 'state.json');
      await writeFile(
        statePath,
        JSON.stringify({
          name: 'test-instance',
          repo: 'https://github.com/test/repo.git',
          createdAt: '2026-01-01T00:00:00Z',
          lastAttached: '2026-01-01T00:00:00Z',
          purpose: 'JWT authentication',
          containerName: 'ae-test-instance',
        }),
        'utf-8'
      );

      // Run purpose in simulated container mode
      // Note: We can't easily redirect /etc/agent-env in the CLI test,
      // but we can verify the container detection works with env var
      const result = await runCli(['purpose'], {
        AGENT_ENV_CONTAINER: 'true',
      });

      // Inside container mode, it tries to read /etc/agent-env/state.json
      // which won't exist in test environment, so expect STATE_NOT_FOUND error
      const stderrStripped = stripAnsiCodes(result.stderr);
      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(/STATE_NOT_FOUND/);
    });

    it('purpose inside container sets purpose without instance name', async () => {
      // Same as above — verifies container detection with set mode
      const result = await runCli(['purpose', 'new purpose text'], {
        AGENT_ENV_CONTAINER: 'true',
      });

      // In container mode, the first arg is the purpose value (not instance name)
      // Tries to write to /etc/agent-env/state.json which doesn't exist in test
      const stderrStripped = stripAnsiCodes(result.stderr);
      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(/STATE_NOT_FOUND/);
    });
  });

  describe('completion command', () => {
    it('completion bash outputs bash completion script', async () => {
      const result = await runCli(['completion', 'bash']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('#!/usr/bin/env bash');
      expect(result.stdout).toContain('complete -F _agent_env_completions agent-env');
    });

    it('completion zsh outputs zsh completion script', async () => {
      const result = await runCli(['completion', 'zsh']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('#compdef agent-env');
      expect(result.stdout).toMatch(/_agent_env\s*\(\)/); // Check for the function definition
    });

    it('completion --help shows installation instructions', async () => {
      const result = await runCli(['completion', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('eval "$(agent-env completion bash)"');
      expect(result.stdout).toContain('eval "$(agent-env completion zsh)"');
    });
  });

  describe('remove command', () => {
    it('remove shows instance not found when instance does not exist', async () => {
      const result = await runCli(['remove', 'test-instance']);
      const stderrStripped = stripAnsiCodes(result.stderr);
      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toMatch(
        /❌ \[WORKSPACE_NOT_FOUND\] Instance 'test-instance' not found/
      );
    });
  });

  describe('remove command with --force option', () => {
    it('should block removal by default if git state is dirty (unstaged changes)', async () => {
      const instanceName = 'dirty-instance';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName], {
        MOCK_GIT_STATE: JSON.stringify({ hasUnstaged: true }),
        MOCK_DOCKER_AVAILABLE: 'true', // Docker is available, so git is the only blocker
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain("Cannot remove 'dirty-instance'");
      expect(stderrStripped).toContain('1 unstaged change detected');
      expect(stderrStripped).toContain('--force');
    });

    it('should allow removal with --force --yes even if git state is dirty (unstaged changes)', async () => {
      const instanceName = 'force-dirty-instance';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName, '--force', '--yes'], {
        MOCK_GIT_STATE: JSON.stringify({ hasUnstaged: true }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stdoutStripped = stripAnsiCodes(result.stdout);
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(0);
      expect(stdoutStripped).toContain(`Instance 'force-dirty-instance' force-removed`);
      expect(stdoutStripped).toContain('Data permanently deleted');
      expect(stderrStripped).not.toContain('SAFETY_CHECK_FAILED');

      // Verify workspace is actually removed
      const wsRoot = join(tempRoot, AGENT_ENV_DIR, WORKSPACES_DIR, `repo-${instanceName}`);
      await expect(stat(wsRoot)).rejects.toThrow(/ENOENT/);
    });

    it('should still block removal with --force if Docker is unavailable', async () => {
      const instanceName = 'force-no-docker';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName, '--force'], {
        MOCK_GIT_STATE: JSON.stringify({ hasUnstaged: true }), // Git state would normally block
        MOCK_DOCKER_AVAILABLE: 'false', // Docker is unavailable
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain('❌ [ORBSTACK_REQUIRED]');
      expect(stderrStripped).toContain('Docker is not available');
      expect(stderrStripped).not.toContain('SAFETY_CHECK_FAILED');
    });

    it('should still block removal with --force if instance does not exist', async () => {
      const result = await runCli(['remove', 'nonexistent-force', '--force'], {
        MOCK_GIT_STATE: JSON.stringify({ isClean: true }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain('❌ [WORKSPACE_NOT_FOUND]');
      expect(stderrStripped).toContain("Instance 'nonexistent-force' not found");
    });
  });

  describe('safety prompt UI output', () => {
    it('shows severity indicators for staged changes (Warning)', async () => {
      const instanceName = 'safety-staged';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName], {
        MOCK_GIT_STATE: JSON.stringify({ hasStaged: true }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain('[Warning]');
      expect(stderrStripped).toContain('1 staged file detected');
      expect(stderrStripped).toContain('Suggestions');
      expect(stderrStripped).toContain('git commit');
    });

    it('shows danger severity for never-pushed branches', async () => {
      const instanceName = 'safety-never-pushed';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName], {
        MOCK_GIT_STATE: JSON.stringify({ neverPushedBranches: ['new-feature'] }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain('[Danger]');
      expect(stderrStripped).toContain('new-feature');
      expect(stderrStripped).toContain('git push');
    });

    it('shows multiple blockers with mixed severity', async () => {
      const instanceName = 'safety-multi';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName], {
        MOCK_GIT_STATE: JSON.stringify({
          hasUnstaged: true,
          neverPushedBranches: ['feature-x'],
        }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain('[Warning]');
      expect(stderrStripped).toContain('[Danger]');
      expect(stderrStripped).toContain('1 unstaged change detected');
      expect(stderrStripped).toContain('feature-x');
      expect(stderrStripped).toContain('Suggestions');
    });

    it('shows suggestions for unpushed commits', async () => {
      const instanceName = 'safety-unpushed';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName], {
        MOCK_GIT_STATE: JSON.stringify({ unpushedBranches: ['main', 'develop'] }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain(
        'unpushed commits on branches: main (1 commit), develop (1 commit)'
      );
      expect(stderrStripped).toContain('git push');
    });

    it('shows stash count in output', async () => {
      const instanceName = 'safety-stash';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName], {
        MOCK_GIT_STATE: JSON.stringify({ stashCount: 3 }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain('3 stashes');
      expect(stderrStripped).toContain('git stash');
    });

    it('includes --force bypass hint', async () => {
      const instanceName = 'safety-force-hint';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName], {
        MOCK_GIT_STATE: JSON.stringify({ hasUntracked: true }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain('--force');
      expect(stderrStripped).toContain('data loss is permanent');
    });
  });

  describe('force-remove with --yes and audit log', () => {
    it('force-removes dirty instance with --yes and writes audit log', async () => {
      const instanceName = 'force-audit';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName, '--force', '--yes'], {
        MOCK_GIT_STATE: JSON.stringify({
          hasStaged: true,
          neverPushedBranches: ['feature-x'],
        }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stdoutStripped = stripAnsiCodes(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(stdoutStripped).toContain('force-removed');
      expect(stdoutStripped).toContain('Data permanently deleted');

      // Verify workspace is removed
      const wsRoot = join(tempRoot, AGENT_ENV_DIR, WORKSPACES_DIR, `repo-${instanceName}`);
      await expect(stat(wsRoot)).rejects.toThrow(/ENOENT/);

      // Verify audit log was written
      const auditLogPath = join(tempRoot, AGENT_ENV_DIR, 'audit.log');
      const auditContent = await readFile(auditLogPath, 'utf-8');
      const entry = JSON.parse(auditContent.trim());
      expect(entry.action).toBe('force-remove');
      expect(entry.instanceName).toBe(instanceName);
      expect(entry.confirmationMethod).toBe('yes-flag');
      expect(entry.gitState).toBeDefined();
      expect(entry.gitState.hasStaged).toBe(true);
    });

    it('force-removes clean instance with --force (no confirmation needed)', async () => {
      const instanceName = 'force-clean';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName, '--force'], {
        MOCK_GIT_STATE: JSON.stringify({}), // clean state
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stdoutStripped = stripAnsiCodes(result.stdout);

      expect(result.exitCode).toBe(0);
      expect(stdoutStripped).toContain('force-removed');

      // Verify workspace is removed
      const wsRoot = join(tempRoot, AGENT_ENV_DIR, WORKSPACES_DIR, `repo-${instanceName}`);
      await expect(stat(wsRoot)).rejects.toThrow(/ENOENT/);

      // Verify audit log was written with not-required confirmation
      const auditLogPath = join(tempRoot, AGENT_ENV_DIR, 'audit.log');
      const auditContent = await readFile(auditLogPath, 'utf-8');
      const entry = JSON.parse(auditContent.trim());
      expect(entry.action).toBe('force-remove');
      expect(entry.confirmationMethod).toBe('not-required');
    });

    it('shows warning about data loss when force-removing dirty instance', async () => {
      const instanceName = 'force-warn';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName, '--force', '--yes'], {
        MOCK_GIT_STATE: JSON.stringify({
          hasUnstaged: true,
          unpushedBranches: ['develop'],
        }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      expect(result.exitCode).toBe(0);
      // Warning about unsaved work should be shown on stderr
      expect(stderrStripped).toContain('WARNING');
      expect(stderrStripped).toContain('unsaved work');
      expect(stderrStripped).toContain('PERMANENTLY DELETED');
    });

    it('--force without --yes in non-TTY shows hint to use --yes', async () => {
      const instanceName = 'force-no-tty';
      await createMockWorkspace(instanceName);
      const result = await runCli(['remove', instanceName, '--force'], {
        MOCK_GIT_STATE: JSON.stringify({ hasStaged: true }),
        MOCK_DOCKER_AVAILABLE: 'true',
      });
      const stderrStripped = stripAnsiCodes(result.stderr);

      // In non-TTY (piped test), should fail with hint
      expect(result.exitCode).toBe(1);
      expect(stderrStripped).toContain('--yes');
      expect(stderrStripped).toContain('non-interactive');
    });

    it('--yes flag is documented in --help', async () => {
      const result = await runCli(['remove', '--help']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--yes');
      expect(result.stdout).toContain('--force');
    });
  });
});

describe('MOCK EXECUTABLE DIRECT INVOKE DEBUG', () => {
  it('mock-executables.js should correctly receive environment variables when directly invoked', async () => {
    const testVarValue = 'DIRECT_INVOKE_TEST_VALUE';
    const specificTempDir = join(tempRoot, 'mock-exec-direct-invoke-logs');
    await mkdir(specificTempDir, { recursive: true });

    // Directly execute mock-executables.js
    const execaResult = await execa('node', [MOCK_EXECUTABLE_SCRIPT_PATH], {
      env: {
        ...process.env,
        MOCK_COMMAND: 'docker', // Explicitly set command for mock-executables.js
        MOCK_DOCKER_AVAILABLE: 'true',
        TEST_DEBUG_VAR: testVarValue,
        TEMP_DIR_OVERRIDE: specificTempDir,
      },
      reject: false,
    });

    // Check stderr for console.error messages from mock-executables.js
    expect(execaResult.stderr).toContain('[MOCK-EXEC] Running mock for command: docker');
    expect(execaResult.stderr).toContain('[MOCK-EXEC] MOCK_DOCKER_AVAILABLE: true');

    // Find the log file by listing the directory and filtering
    const allFiles = await readdir(specificTempDir);
    const files = allFiles
      .filter((f) => f.startsWith('mock_exec_env_') && f.endsWith('_docker.log'))
      .map((f) => join(specificTempDir, f));

    expect(files.length).toBeGreaterThan(0);
    const logFilePath = files[0];

    const envContent = await readFile(logFilePath, 'utf8');
    const parsedEnv = JSON.parse(envContent);

    expect(parsedEnv.MOCK_COMMAND).toBe('docker');
    expect(parsedEnv.MOCK_DOCKER_AVAILABLE).toBe('true');
    expect(parsedEnv.TEST_DEBUG_VAR).toBe(testVarValue);

    await rm(specificTempDir, { recursive: true, force: true });
  }, 10000);
});
