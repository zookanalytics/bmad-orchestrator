import { formatError, createError, createExecutor } from '@zookanalytics/shared';
import { Command } from 'commander';
import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { homedir, platform } from 'node:os';

import type { SetupAudioDeps } from '../lib/setup-audio.js';

import { setupAudio } from '../lib/setup-audio.js';

export function createDefaultSetupAudioDeps(): SetupAudioDeps {
  const exec = createExecutor();
  return {
    platform: platform(),
    homeDir: homedir(),
    execute: exec,
    readFile: (path, encoding) => readFile(path, encoding) as Promise<string>,
    writeFile: (path, content, encoding) => writeFile(path, content, encoding),
    copyFile,
    mkdir: (path, opts) => mkdir(path, opts),
    access: (path) => access(path),
  };
}

export const setupAudioCommand = new Command('setup-audio')
  .description('Configure macOS PulseAudio for audio passthrough to containers')
  .action(async () => {
    const deps = createDefaultSetupAudioDeps();
    const result = await setupAudio(deps);

    if (!result.ok) {
      console.error(
        formatError(createError('AUDIO_SETUP_FAILED', result.error ?? 'Unknown error'))
      );
      process.exit(1);
      return;
    }

    for (const step of result.steps) {
      console.log(`\x1b[32m✓\x1b[0m ${step}`);
    }
    console.log('');
    console.log(
      'Audio passthrough configured. Changes take effect on next container start or rebuild.'
    );
  });
