# Design: `on` Command & Unified Interactive Menu

## Problem

Users switch between attach, rebuild, code, and purpose commands for the same instance repeatedly. Each invocation requires remembering the right command and re-typing the instance name. The existing default interactive menu is underused and doesn't cover all actions (missing VS Code open).

## Solution

Add an `agent-env on <name>` command that presents a persistent action menu for a named instance. Replace the existing default no-arg interactive menu with the same component — the only difference is whether the instance is pre-selected or picked from a list first.

## Entry Points

```
agent-env              → list instances → pick one → action loop
agent-env on <name>    → resolve instance → action loop
```

Both accept `--repo <slug>` for scoped instance lookup. For the no-arg flow, `--repo` filters the instance list to only that repo's instances.

## Action Loop

The menu displays a header with instance context, then an action list. After any action completes, the menu re-displays. The loop exits on "Exit" selection or Ctrl-C.

### Header

Shows instance name, container status, repo slug, and current purpose:

```
myinstance  ▶  my-repo  "JWT authentication"
```

When purpose is null, the purpose segment is omitted entirely (no placeholder text). Purpose updates live after Set Purpose.

### Actions

| Action | Behavior |
|--------|----------|
| Attach | Runs `attachInstance` (stdio: inherit for tmux). Returns to menu when tmux detaches. |
| Open in VS Code | Runs `codeInstance`. Returns to menu immediately after launch. |
| Rebuild | Runs `rebuildInstance` with `force: true` (menu selection is implicit confirmation). Shows progress via `createProgressLine()`. Returns to menu on completion. |
| Set Purpose | Prompts for text input. Updates purpose via `setPurpose`. Returns to menu with updated header. Escape during text input cancels back to action menu without changes. |
| Exit | Exits the loop and process. |

Remove is deliberately excluded — destroying the loop's target instance mid-session is a footgun. Users run `agent-env remove` directly when needed.

### TTY Requirement

- `on` command: exits with error if not TTY (interactive menu requires terminal input).
- Default no-arg: shows help if not TTY (existing behavior preserved).

## Files

| File | Change |
|------|--------|
| `src/commands/on.ts` | New command. Takes `<name>` argument + `--repo`. Resolves instance via `resolveRepoOrExit` + `resolveInstance`. Launches action loop. TTY gate. |
| `src/commands/on.test.ts` | New tests. Verifies option parsing, TTY gate, instance resolution, and action dispatch via mocked orchestration. |
| `src/commands/attach.ts` | Revert `--rebuild` flag (restore to pre-feature state). |
| `src/commands/code.ts` | Revert `--rebuild` flag (restore to pre-feature state). |
| `src/commands/attach.test.ts` | Delete (tested `--rebuild` flag being removed). |
| `src/commands/code.test.ts` | Delete (tested `--rebuild` flag being removed). |
| `/.changeset/add-rebuild-to-attach-and-code.md` | Delete (changeset for removed feature, at monorepo root). |
| `src/components/InteractiveMenu.tsx` | Replace with new component: instance header with purpose display, action Select list (Attach, VS Code, Rebuild, Set Purpose, Exit), inline TextInput for Set Purpose with Escape to cancel. Instance selection step removed (handled by orchestration). |
| `src/lib/interactive-menu.ts` | Replace with new orchestration: persistent action loop, pre-selected instance support, all five actions, state refresh between iterations. |
| `src/lib/interactive-menu.test.ts` | New tests. Mocks `renderMenu` to verify action dispatch, loop continuation, state refresh, and exit behavior. |
| `src/cli.ts` | Register `on` command. Update default no-arg action to use new menu (instance picker → action loop). |

## Dependency Injection

The orchestration layer (`interactive-menu.ts`) receives injected dependencies for all I/O:

```typescript
interface InteractiveMenuDeps {
  // Action executors (pre-bound with their sub-deps by the caller)
  attachInstance: (name: string, repoSlug?: string) => Promise<AttachResult>;
  codeInstance: (name: string, repoSlug?: string) => Promise<CodeResult>;
  rebuildInstance: (name: string, repoSlug?: string) => Promise<RebuildResult>;
  setPurpose: (name: string, value: string, repoSlug?: string) => Promise<PurposeSetResult>;

  // Instance data
  listInstances: () => Promise<ListResult>;
  getInstanceInfo: (workspaceName: string) => Promise<InstanceInfo>;

  // Rendering
  renderMenu: (props: MenuProps) => Promise<MenuSelection>;
}
```

Callers (cli.ts, on.ts) create wrapper functions that bind sub-dependencies and callbacks before injecting. Each wrapper is responsible for its own progress display and callbacks:

```typescript
attachInstance: (name, repoSlug) => {
  const deps = createAttachDefaultDeps();
  return attachInstanceLib(name, deps,
    () => console.log('Starting container...'),
    () => console.log('Attaching to tmux session...'),
    repoSlug);
},
codeInstance: (name, repoSlug) => {
  const deps = createCodeDefaultDeps();
  return codeInstanceLib(name, deps,
    () => console.log('Starting container...'),
    () => console.log('Opening VS Code...'),
    repoSlug);
},
rebuildInstance: (name, repoSlug) => {
  const deps = createRebuildDefaultDeps();
  const progress = createProgressLine();
  return rebuildInstanceLib(name, deps,
    { force: true, onProgress: progress.update },
    repoSlug)
    .finally(() => progress.clear());
},
setPurpose: (name, value, repoSlug) => {
  const deps = createPurposeDefaultDeps();
  return setPurposeLib(name, value, deps, repoSlug);
},
listInstances: () => listInstancesLib({ repoFilter }),
```

Progress lifecycle and callbacks are owned by the wrappers, not the orchestration layer. This keeps the orchestration interface clean — it doesn't need to know about `AttachInstanceDeps`, `PurposeInstanceDeps`, `createProgressLine`, etc.

Note: `listInstances` receives the resolved `repoFilter` via closure. For the no-arg flow with `--repo`, the filter is captured at startup and bound into the wrapper. For `on <name>`, `listInstances` is unused (instance already resolved).

## Instance State Refresh

After each action, the orchestration layer calls `getInstanceInfo(workspaceName)` to re-read instance state before re-rendering. This function reads `state.json` and checks container status for a single named instance, returning:

```typescript
interface InstanceInfo {
  name: string;
  repoSlug: string;
  purpose: string | null;
  status: InstanceDisplayStatus; // 'running' | 'stopped' | 'not-found' | 'orphaned' | 'unknown'
}
```

This avoids calling `listInstances()` (which scans all workspaces) on every loop iteration. `getInstanceInfo` is a new lightweight function in `list-instances.ts` that reads state, checks container status, and maps to `InstanceDisplayStatus` (handling orphaned/unknown states the same way `listInstances` does) for one workspace.

## Repo Slug Threading

The resolved `repoSlug` from the `--repo` flag (or cwd git inference) is captured once at command startup and threaded through every action call in the loop. The orchestration layer receives it as a parameter and passes it to each action executor.

## Component Structure

The `InteractiveMenu` React component handles presentation only:

- Receives `InstanceInfo` as props for the header
- Renders header + Select action list
- Calls `onAction` callback with selected action string
- For Set Purpose: switches to inline `TextInput`, calls `onSetPurpose(value)` on Enter, returns to action list on Escape
- No instance selection step — that is handled before the component renders

The orchestration layer handles the loop:

1. Get instance info (state + container status)
2. Render menu component, wait for action selection
3. Unmount menu (clear terminal)
4. Execute action (may take over terminal, e.g., attach)
5. Go to step 1 (re-read state, re-render)
6. Exit on "exit" action or Ctrl-C

## Error Handling

- Action errors display formatted error message, then return to menu (non-fatal to the loop).
- Instance resolution failure at startup exits with error (fatal).
- Docker unavailable errors display once, return to menu.

## Testing Strategy

- `src/commands/on.test.ts`: Unit tests with vi.mock for orchestration layer. Tests option parsing (`--repo`), TTY gate (exits with error when not TTY), and delegation to orchestration.
- `src/lib/interactive-menu.test.ts`: Unit tests with mocked dependencies. Tests action dispatch (each action calls correct function), loop continuation (menu re-renders after action), state refresh (getInstanceInfo called between iterations), exit behavior, and error recovery (action failure returns to menu).
- `src/components/InteractiveMenu.test.tsx`: Component tests with ink-testing-library. Tests header rendering, action selection callbacks, Set Purpose text input flow, and Escape cancellation.
