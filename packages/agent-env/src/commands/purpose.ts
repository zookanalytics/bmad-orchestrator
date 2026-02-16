import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';

import type { ContainerEnvDeps } from '../lib/container-env.js';
import type { PurposeGetResult, PurposeSetResult } from '../lib/purpose-instance.js';

import { isInsideContainer } from '../lib/container-env.js';
import {
  createContainerPurposeDefaultDeps,
  createPurposeDefaultDeps,
  getContainerPurpose,
  getPurpose,
  setContainerPurpose,
  setPurpose,
} from '../lib/purpose-instance.js';

export interface PurposeCommandDeps {
  isInsideContainer: (deps?: ContainerEnvDeps) => boolean;
}

const defaultPurposeCommandDeps: PurposeCommandDeps = {
  isInsideContainer,
};

export function createPurposeCommand(
  deps: PurposeCommandDeps = defaultPurposeCommandDeps
): Command {
  return new Command('purpose')
    .description(
      'Get or set the purpose/label for an instance. ' +
        'Inside a container: no instance name needed (agent-env purpose [value])'
    )
    .argument('[nameOrValue]', 'Instance name (host) or purpose value (container)')
    .argument('[value]', 'New purpose value (omit to get current, empty string to clear)')
    .action(async (nameOrValue?: string, value?: string) => {
      if (deps.isInsideContainer()) {
        // Container mode: nameOrValue is actually the purpose value (if provided)
        await handleContainerMode(nameOrValue);
      } else {
        // Host mode: nameOrValue is the instance name (required)
        await handleHostMode(nameOrValue, value);
      }
    });
}

export const purposeCommand = createPurposeCommand();

async function handleContainerMode(purposeValue?: string): Promise<void> {
  const deps = createContainerPurposeDefaultDeps();

  if (purposeValue === undefined) {
    // Get mode
    const result = await getContainerPurpose(deps);
    handleGetResult(result);
  } else {
    // Set mode
    const result = await setContainerPurpose(purposeValue, deps);
    handleSetResult(result);
  }
}

async function handleHostMode(name?: string, value?: string): Promise<void> {
  if (!name) {
    console.error(
      formatError(
        createError(
          'MISSING_ARGUMENT',
          'Instance name is required when running on the host',
          'Usage: agent-env purpose <name> [value]'
        )
      )
    );
    process.exit(1);
  }

  const deps = createPurposeDefaultDeps();

  if (value === undefined) {
    // Get mode
    const result = await getPurpose(name, deps);
    handleGetResult(result);
  } else {
    // Set mode
    const result = await setPurpose(name, value, deps);
    handleSetResult(result);
  }
}

function handleGetResult(result: PurposeGetResult): void {
  if (!result.ok) {
    const { code, message, suggestion } = result.error;
    console.error(formatError(createError(code, message, suggestion)));
    process.exit(1);
  }

  if (result.purpose === null) {
    console.log('(no purpose set)');
  } else {
    console.log(result.purpose);
  }
}

function handleSetResult(result: PurposeSetResult): void {
  if (!result.ok) {
    const { code, message, suggestion } = result.error;
    console.error(formatError(createError(code, message, suggestion)));
    process.exit(1);
  }

  if (result.cleared) {
    console.log('Purpose cleared');
  } else {
    console.log('Purpose updated');
  }
}
