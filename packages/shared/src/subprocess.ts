import { execa, type Options } from 'execa';

export type Executor = typeof execa;

export interface ExecuteResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Options for line-by-line streaming of subprocess output. */
export interface StreamingOptions {
  /**
   * Callback invoked for each non-empty line of stdout/stderr as it arrives.
   * Best-effort: silently ignored when the subprocess lacks readable streams
   * (e.g. in tests with mocked executors).
   */
  onLine?: (line: string) => void;
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
    options: Options & StreamingOptions = {}
  ): Promise<ExecuteResult> {
    const { onLine, ...execaOptions } = options;

    const subprocess = executor(command, args, {
      reject: false,
      ...execaOptions,
    });

    // Attach line-by-line streaming when callback is provided.
    // The subprocess returned by execa is a ResultPromise with stdout/stderr
    // as Readable streams. For mocked executors (plain Promises), streams
    // won't exist — the optional chaining handles this gracefully.
    if (onLine) {
      const sub = subprocess as unknown as {
        stdout?: NodeJS.ReadableStream;
        stderr?: NodeJS.ReadableStream;
      };
      const handleChunk = (chunk: Buffer | string) => {
        for (const line of chunk.toString().split('\n')) {
          const trimmed = line.trim();
          if (trimmed) onLine(trimmed);
        }
      };
      sub.stdout?.on?.('data', handleChunk);
      sub.stderr?.on?.('data', handleChunk);
    }

    const result = await subprocess;

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
