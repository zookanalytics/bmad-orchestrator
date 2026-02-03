import type { JsonOutput } from '@zookanalytics/shared';

import { formatError, createError } from '@zookanalytics/shared';
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';

import type { InstanceInfo } from '../lib/list-instances.js';

import { InstanceList } from '../components/InstanceList.js';
import { listInstances } from '../lib/list-instances.js';

export const listCommand = new Command('list')
  .alias('ps')
  .description('List all instances with status')
  .option('--json', 'Output in JSON format')
  .action(async (options: { json?: boolean }) => {
    const result = await listInstances();

    if (!result.ok) {
      if (options.json) {
        const output: JsonOutput<never> = {
          ok: false,
          data: null,
          error: { code: result.error.code, message: result.error.message },
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.error(
          formatError(
            createError(
              result.error.code,
              result.error.message,
              'Check if ~/.agent-env/workspaces/ is accessible.'
            )
          )
        );
      }
      process.exit(1);
      return;
    }

    if (options.json) {
      const output: JsonOutput<InstanceInfo[]> = {
        ok: true,
        data: result.instances.map((i) => ({
          name: i.name,
          status: i.status,
          lastAttached: i.lastAttached,
          purpose: i.purpose,
        })),
        error: null,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Render with Ink
    const { unmount, waitUntilExit } = render(
      React.createElement(InstanceList, {
        instances: result.instances,
        dockerAvailable: result.dockerAvailable,
      })
    );

    // Static render — unmount immediately after first render
    unmount();
    await waitUntilExit();
  });
