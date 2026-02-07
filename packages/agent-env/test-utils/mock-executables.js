#!/usr/bin/env node

/**
 * This script acts as a mock for external commands like `git` and `docker` for integration tests.
 * It reads environment variables to determine how to behave.
 *
 * Usage:
 * Set MOCK_COMMAND to 'git' or 'docker'.
 * Set MOCK_GIT_STATE to a JSON string representing the desired GitState (for 'git').
 * Set MOCK_DOCKER_AVAILABLE to 'true' or 'false' (for 'docker').
 * Set MOCK_DOCKER_STOP_FAIL to 'true' (for 'docker stop' to fail).
 * Set MOCK_DOCKER_RM_FAIL to 'true' (for 'docker rm' to fail).
 * Set TEMP_DIR_OVERRIDE to override tmpdir() for debug logs.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const command = process.env.MOCK_COMMAND;
const args = process.argv.slice(2);

const effectiveTmpDir = process.env.TEMP_DIR_OVERRIDE || tmpdir(); // Use override if present

async function main() { // Wrap in async function
  console.error(`[MOCK-EXEC] Running mock for command: ${command}`);
  console.error(`[MOCK-EXEC] PID: ${process.pid}`);
  console.error(`[MOCK-EXEC] Effective Tmpdir: ${effectiveTmpDir}`);
  console.error(`[MOCK-EXEC] MOCK_DOCKER_AVAILABLE: ${process.env.MOCK_DOCKER_AVAILABLE}`);

  // Dump environment to a unique file for debugging
  await writeFile(join(effectiveTmpDir, `mock_exec_env_${process.pid}_${command || 'undefined_command'}.log`), JSON.stringify(process.env, null, 2))
    .catch(err => console.error(`[MOCK-EXEC] Failed to write debug env file for ${command || 'undefined_command'}: ${err}`));

  function exitWithError(message, code = 1) {
    console.error(message);
    process.exit(code);
  }

  async function handleGit() { // Made async to be consistent with main
    console.error(`[MOCK-EXEC] Handling git command: ${args.join(' ')}`);

    // git remote get-url origin — used by resolveRepoUrl for --repo .
    if (args[0] === 'remote' && args[1] === 'get-url' && args[2] === 'origin') {
      console.log('https://github.com/mock-user/mock-repo.git');
      process.exit(0);
    }

    const mockGitState = process.env.MOCK_GIT_STATE;
    if (!mockGitState) {
      exitWithError('MOCK_GIT_STATE not set for mock git command.');
      return;
    }

    const gitState = JSON.parse(mockGitState);

    if (args[0] === 'status' && args.includes('--porcelain')) {
      let output = '';
      if (gitState.hasUnstaged) output += ' M some-file.ts\n';
      if (gitState.hasStaged) output += 'A  staged-file.txt\n';
      if (gitState.hasUntracked) output += '?? untracked-file.txt\n';
      console.log(output);
      process.exit(0);
    }

    // git stash list — used by getGitState() to count stash entries
    if (args[0] === 'stash' && args[1] === 'list') {
      const stashCount = gitState.stashCount || 0;
      if (stashCount > 0) {
        for (let i = 0; i < stashCount; i++) {
          console.log(`stash@{${i}}: WIP on main: fake_commit_sha message`);
        }
      }
      process.exit(0);
    }

    // git for-each-ref — used by getGitState() to detect unpushed/never-pushed branches
    if (args[0] === 'for-each-ref') {
      const unpushed = gitState.unpushedBranches || [];
      const neverPushed = gitState.neverPushedBranches || [];
      const lines = [];
      // Branches with upstream that have unpushed commits
      for (const branch of unpushed) {
        lines.push(`${branch} origin/${branch} [ahead 1]`);
      }
      // Branches with no upstream (never pushed) — only branch name, no tracking info
      for (const branch of neverPushed) {
        lines.push(branch);
      }
      // Include a clean branch so output isn't empty when there's nothing to report
      if (lines.length === 0) {
        lines.push('main origin/main');
      }
      console.log(lines.join('\n'));
      process.exit(0);
    }

    // git symbolic-ref HEAD — used by getGitState() to detect detached HEAD
    if (args[0] === 'symbolic-ref' && args[1] === 'HEAD') {
      if (gitState.isDetachedHead) {
        // symbolic-ref fails when HEAD is detached
        exitWithError('fatal: ref HEAD is not a symbolic ref', 128);
      } else {
        console.log('refs/heads/main');
        process.exit(0);
      }
    }

    // Default to success for unhandled git commands for now
    process.exit(0);
  }

  async function handleDocker() { // Made async
    console.error(`[MOCK-EXEC] Handling docker command: ${args.join(' ')}`);
    const dockerAvailable = process.env.MOCK_DOCKER_AVAILABLE === 'true';
    console.error(`[MOCK-EXEC] Inside handleDocker - dockerAvailable: ${dockerAvailable}`);


    if (!dockerAvailable && args[0] !== 'info') {
      // If docker is not available, all commands except 'docker info' should fail
      exitWithError('Cannot connect to the Docker daemon. Is the docker daemon running?', 1);
    }

    if (args[0] === 'info') {
      if (dockerAvailable) {
        console.log('Client: Docker Engine - Community');
        process.exit(0);
      } else {
        exitWithError('Cannot connect to the Docker daemon. Is the docker daemon running?', 1);
      }
    }

    if (args[0] === 'stop') {
      if (process.env.MOCK_DOCKER_STOP_FAIL === 'true') {
        exitWithError(`Error: Failed to stop container ${args[1]}`, 1);
      }
      console.log(args[1]); // Docker stop prints the container name on success
      process.exit(0);
    }

    if (args[0] === 'rm') {
      if (process.env.MOCK_DOCKER_RM_FAIL === 'true') {
        exitWithError(`Error: Failed to remove container ${args[1]}`, 1);
      }
      console.log(args[1]); // Docker rm prints the container name on success
      process.exit(0);
    }

    // Default to success for other docker commands
    process.exit(0);
  }

  async function handleDevcontainer() { // Made async
    console.error(`[MOCK-EXEC] Handling devcontainer command: ${args.join(' ')}`);
    // Always report success for devcontainer up for now, until we need complex mock behavior
    if (args[0] === 'up') {
      console.log(JSON.stringify({ outcome: 'success', containerId: 'mock-container-id' }));
      process.exit(0);
    }
    process.exit(0);
  }

  switch (command) {
    case 'git':
      await handleGit();
      break;
    case 'docker':
      await handleDocker();
      break;
    case 'devcontainer':
      await handleDevcontainer();
      break;
    default:
      exitWithError(`Unknown MOCK_COMMAND: ${command}`, 127);
  }
}

main(); // Call the async function
