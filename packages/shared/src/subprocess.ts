import { execa, type Options } from 'execa';

export type Executor = typeof execa;

export interface ExecuteResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Create a subprocess executor with the reject: false pattern
 *
 * @param executor - The execa function (injectable for testing)
 * @returns Wrapped executor that never throws
 */
export function createExecutor(executor: Executor = execa) {
  return async function execute(
    command: string,
    args: string[] = [],
    options: Options = {}
  ): Promise<ExecuteResult> {
    const result = await executor(command, args, {
      reject: false,
      ...options,
    });

    return {
      ok: !result.failed,
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      exitCode: result.exitCode ?? -1,
    };
  };
}

/**
 * Default executor using execa
 */
export const execute = createExecutor();
