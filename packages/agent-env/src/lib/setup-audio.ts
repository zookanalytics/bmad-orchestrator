import type { ExecuteResult } from '@zookanalytics/shared';

/**
 * Subprocess executor signature.
 * Compatible with the return type of createExecutor() from @zookanalytics/shared.
 * Uses a minimal options type to avoid coupling to execa's Options type.
 */
export type Execute = (
  command: string,
  args?: string[],
  options?: object
) => Promise<ExecuteResult>;

/** Dependency injection for setup-audio (enables testing without real shell/fs) */
export interface SetupAudioDeps {
  platform: string;
  homeDir: string;
  execute: Execute;
  readFile: (path: string, encoding: BufferEncoding) => Promise<string>;
  writeFile: (path: string, content: string, encoding: BufferEncoding) => Promise<void>;
  copyFile: (src: string, dst: string) => Promise<void>;
  mkdir: (path: string, options: { recursive: boolean }) => Promise<string | undefined>;
  access: (path: string) => Promise<void>;
}

export interface SetupAudioResult {
  ok: boolean;
  /** Steps that were performed */
  steps: string[];
  /** Error message if !ok */
  error?: string;
}

export async function setupAudio(deps: SetupAudioDeps): Promise<SetupAudioResult> {
  const steps: string[] = [];

  // Step 1: Platform check
  if (deps.platform !== 'darwin') {
    return {
      ok: false,
      steps,
      error:
        'Audio passthrough is only supported on macOS. On Linux, use native PulseAudio directly.',
    };
  }

  // Step 2: Check PulseAudio is installed
  const brewPrefix = await deps.execute('brew', ['--prefix', 'pulseaudio']);
  if (!brewPrefix.ok) {
    return {
      ok: false,
      steps,
      error: 'PulseAudio not found. Install with: brew install pulseaudio',
    };
  }
  const paPrefix = brewPrefix.stdout.trim();
  steps.push('PulseAudio found');

  // Step 3: Check if TCP module is already loaded
  const moduleCheck = await deps.execute('pactl', ['list', 'short', 'modules']);
  const tcpAlreadyLoaded =
    moduleCheck.ok && moduleCheck.stdout.includes('module-native-protocol-tcp');

  if (!tcpAlreadyLoaded) {
    // Load TCP module
    const loadResult = await deps.execute('pactl', [
      'load-module',
      'module-native-protocol-tcp',
      'auth-cookie-enabled=1',
      'listen=127.0.0.1',
      'port=4713',
    ]);
    if (!loadResult.ok) {
      return {
        ok: false,
        steps,
        error: `Failed to load PulseAudio TCP module: ${loadResult.stderr}`,
      };
    }
    steps.push('TCP module loaded');
  } else {
    steps.push('TCP module already loaded');
  }

  // Step 4: Persist TCP module to default.pa
  const defaultPaPath = `${paPrefix}/etc/pulse/default.pa`;
  const tcpModuleLine =
    'load-module module-native-protocol-tcp auth-cookie-enabled=1 listen=127.0.0.1 port=4713';
  try {
    let paContent: string;
    try {
      paContent = await deps.readFile(defaultPaPath, 'utf-8');
    } catch {
      // File doesn't exist yet — create directory and start fresh
      await deps.mkdir(`${paPrefix}/etc/pulse`, { recursive: true });
      paContent = '';
    }
    const hasActiveModule = paContent.split('\n').some((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith('#') &&
        !trimmed.startsWith(';') &&
        trimmed.includes('load-module module-native-protocol-tcp')
      );
    });
    if (!hasActiveModule) {
      const newContent = paContent
        ? paContent.trimEnd() + '\n' + tcpModuleLine + '\n'
        : tcpModuleLine + '\n';
      await deps.writeFile(defaultPaPath, newContent, 'utf-8');
      steps.push('TCP module persisted to default.pa');
    } else {
      steps.push('TCP module already in default.pa');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      steps,
      error: `Failed to write ${defaultPaPath}: ${msg}`,
    };
  }

  // Step 5: Stage cookie
  const cookieSrc = `${deps.homeDir}/.config/pulse/cookie`;
  const cookieDstDir = `${deps.homeDir}/.agent-env/pulse`;
  const cookieDst = `${cookieDstDir}/cookie`;
  try {
    await deps.access(cookieSrc);
    await deps.mkdir(cookieDstDir, { recursive: true });
    await deps.copyFile(cookieSrc, cookieDst);
    steps.push('Cookie staged');
  } catch {
    return {
      ok: false,
      steps,
      error: `PulseAudio cookie not found at ${cookieSrc}. Is PulseAudio running? Try: pulseaudio --start`,
    };
  }

  return { ok: true, steps };
}
