# agent-env Update Check

## Summary

Add a non-blocking version check to the `agent-env` CLI that notifies host users when a newer version is available on the npm registry. The check runs on every CLI invocation (including interactive menu mode) but is cached for 1 hour to avoid repeated network calls.

## Behavior

On CLI startup, fire an async registry check. After the command (or interactive menu session) completes, await the result and print a notice to stderr if a newer version exists.

Output example:
```
Update available: 0.9.1 -> 0.10.0
Run: pnpm add -g @zookanalytics/agent-env
```

### Suppression

The check is skipped entirely when any of these are true:

- `!process.stderr.isTTY` (CI, piped output — checked on stderr since that's where the notice is printed)
- `isInsideContainer()` (container version is tied to Dockerfile build)
- `isLinked` (local monorepo development)
- `isBakedDev` (dev build baked into image)

## Architecture

### New module: `src/lib/update-check.ts`

Single module with one public function:

```ts
checkForUpdate(opts: UpdateCheckOpts): Promise<string | null>
```

Returns a styled message string if an update is available, `null` otherwise.

#### `UpdateCheckOpts`

```ts
interface UpdateCheckOpts {
  currentVersion: string;       // from package.json, pre-stripped of +local/+dev
  packageName: string;          // "@zookanalytics/agent-env"
  cachePath: string;            // ~/.agent-env/update-check.json
  cacheTtlMs: number;           // 3_600_000 (1 hour)
  fetchFn?: typeof fetch;       // injectable for testing
  readFile?: typeof fs.readFile;
  writeFile?: typeof fs.writeFile;
  mkdir?: typeof fs.mkdir;
  now?: () => number;           // injectable clock for testing
}
```

### Cache file: `~/.agent-env/update-check.json`

```json
{
  "lastCheck": 1710806400000,
  "latestVersion": "0.10.0"
}
```

- Created on first successful registry fetch
- Directory (`~/.agent-env/`) created if it doesn't exist
- All filesystem failures are silent (no error output)

### Registry call

- URL: `https://registry.npmjs.org/@zookanalytics/agent-env/latest`
- Method: GET with `Accept: application/json` header
- Timeout: 5 seconds via `AbortSignal.timeout(5000)`
- Uses native `fetch()` (Node 20+ required, already in engines)
- Network/parse failures return `null` silently

### Version comparison

Lightweight semver comparison function (no external dependency):

1. Strip any `+suffix` from current version
2. Split both versions on `.`, compare each segment numerically
3. Return true if registry version is strictly greater

Pre-release versions (e.g., `1.0.0-beta.1`) are not expected in this project. If a pre-release tag is present on either version, strip it before comparison (treat `1.0.0-beta.1` as `1.0.0`). This avoids incorrect lexicographic ordering of numeric pre-release identifiers.

### Integration in `cli.ts`

The cli.ts entry point must be converted to use `program.parseAsync()` (instead of `program.parse()`) so that async subcommand handlers are properly awaited before the update notice prints.

```ts
// Early in cli.ts, after version/suppression detection:
const updateCheckPromise = shouldCheck
  ? checkForUpdate({ currentVersion, packageName, cachePath, cacheTtlMs })
  : Promise.resolve(null);

// Switch from program.parse() to parseAsync() so all async command
// handlers complete before we print the update notice.
await program.parseAsync();

// After all commands (including interactive menu) have completed:
const updateMessage = await updateCheckPromise;
if (updateMessage) {
  process.stderr.write(updateMessage + '\n');
}
```

The `shouldCheck` boolean combines the suppression conditions. The `cachePath` must be constructed at call time using `os.homedir()` (not a module-level constant) so that integration tests can override `HOME` for isolation. The promise is fired before `parseAsync()` so the fetch runs concurrently with whatever command executes.

### Flow

```
CLI starts
  -> shouldCheck? (stderr is TTY + not container + not linked + not dev)
    -> No: skip
    -> Yes: Is cache fresh (< 1 hour)?
      -> Yes: compare cached version to current
      -> No: fire async fetch
        -> Success: write cache, compare
        -> Failure: return null silently
Command/menu runs normally (check is concurrent)
Command/menu completes
  -> Await check promise
  -> If newer version: print notice to stderr
```

## Testing

Unit tests in `src/lib/update-check.test.ts` with full dependency injection:

- **Cache fresh, newer version available**: returns update message
- **Cache fresh, same/older version**: returns null
- **Cache stale, fetch succeeds with newer version**: writes cache, returns message
- **Cache stale, fetch succeeds with same version**: writes cache, returns null
- **Cache stale, fetch fails (network error)**: returns null, no crash
- **Cache stale, fetch times out**: returns null, no crash
- **Cache stale, fetch returns 200 with invalid/missing JSON**: returns null, no crash
- **Cache file missing/corrupt**: treated as stale, triggers fetch
- **Cache directory doesn't exist**: created silently
- **Cache directory not writable**: fails silently, still returns comparison result from fetch
- **Suppression conditions**: verify check is skipped for each condition

Integration coverage in `cli.test.ts`:

- Verify no update notice in non-TTY mode
- Verify no update notice when `AGENT_ENV_CONTAINER=true`

## Files Changed

| File | Change |
|------|--------|
| `src/lib/update-check.ts` | New module |
| `src/lib/update-check.test.ts` | New test file |
| `src/cli.ts` | Switch `program.parse()` to `await program.parseAsync()`, fire check before parse, await after command/menu completes |
| `src/cli.test.ts` | Integration tests for suppression |
