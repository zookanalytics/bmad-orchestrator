import { Command } from 'commander';

import type { ContainerEnvDeps } from '../lib/container-env.js';
import type { TmuxStatusDeps } from '../lib/tmux-status.js';

import { CONTAINER_STATE_PATH, isInsideContainer } from '../lib/container-env.js';
import { getTmuxStatus } from '../lib/tmux-status.js';

export interface TmuxStatusCommandDeps {
  isInsideContainer: (deps?: ContainerEnvDeps) => boolean;
  getTmuxStatus: (statePath: string, deps?: TmuxStatusDeps) => Promise<string>;
  statePath: string;
}

const defaultDeps: TmuxStatusCommandDeps = {
  isInsideContainer,
  getTmuxStatus,
  statePath: CONTAINER_STATE_PATH,
};

export function createTmuxStatusCommand(deps: TmuxStatusCommandDeps = defaultDeps): Command {
  return new Command('tmux-status')
    .description('Output formatted instance status for tmux status bar (container only)')
    .action(async () => {
      if (!deps.isInsideContainer()) {
        console.log('?');
        return;
      }

      const display = await deps.getTmuxStatus(deps.statePath);
      console.log(display);
    });
}

export const tmuxStatusCommand = createTmuxStatusCommand();
