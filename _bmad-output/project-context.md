---
project_name: 'agent-tools'
user_name: 'Node'
date: '2026-01-27'
sections_completed: ['technology_stack', 'typescript_rules', 'react_ink_rules', 'testing_rules', 'code_quality_rules', 'workflow_rules', 'critical_rules']
scope: ['agent-env', 'bmad-orchestrator', 'shared']
status: 'complete'
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Package:** `@zookanalytics/agent-tools`

| Technology | Version | Notes |
|------------|---------|-------|
| Node.js | ≥20.0.0 | Required (enforced in engines) |
| TypeScript | 5.x | Strict mode enabled |
| Commander | 14.0.2 | CLI argument parsing |
| Ink | 6.6.0 | React for terminal UI |
| @inkjs/ui | 2.0.0 | UI components (Spinner, Select) |
| React | 19.x | Required by Ink 6 |
| Vitest | 4.x | Testing framework |
| execa | 9.x | Subprocess execution |
| timeago.js | latest | Relative timestamps |
| @devcontainers/cli | latest | agent-env only |
| yaml | latest | orchestrator only |
| pnpm | latest | Package manager |

**Version Constraints:**
- Ink 6 requires React 19 - do not downgrade React
- Commander 14 requires Node 20+ - matches our engines requirement
- execa 9.x uses ESM - all imports must use `.js` extension

## Critical Implementation Rules

### TypeScript Rules

**Configuration:**
- Strict mode is ON - do not disable `strict`, `noImplicitAny`, `strictNullChecks`
- Target ES2022, module NodeNext
- JSX set to `react-jsx` for Ink components

**Import Patterns:**
- Use `.js` extension for all local imports (ESM requirement)
- Import order (ESLint enforced):
  1. Node built-ins (`node:fs`, `node:path`)
  2. External packages (`execa`, `ink`, `react`)
  3. Internal shared (`../shared/errors.js`)
  4. Local imports (`./hooks/useAgentEnv.js`)

**Type Conventions:**
- Interfaces for object shapes: `interface Instance { ... }`
- Type aliases for unions/primitives: `type Status = 'running' | 'stopped'`
- Export types explicitly: `export type { Instance }`
- Avoid `any` - use `unknown` and narrow with type guards

**Async Patterns:**
- Always use async/await over raw Promises
- Never swallow errors - always handle or re-throw
- Use `Promise.allSettled()` for parallel operations that can partially fail

### React/Ink Rules

**Hook Patterns:**
- One main hook per CLI: `useAgentEnv` or `useOrchestrator`
- Use `useReducer` for complex state, not multiple `useState`
- Group all `useEffect` calls together in hooks
- Use `useCallback` for action functions returned from hooks
- Ink's `useInput` for keyboard handling - always in the main hook

**Reducer Actions:**
- SCREAMING_SNAKE_CASE with domain prefix
- Examples: `INSTANCES_LOAD_START`, `INSTANCE_SELECT`, `REFRESH_COMPLETE`
- Always include `payload` for actions that carry data

**Component Structure:**
- PascalCase for component files: `InstanceList.tsx`
- Components in `components/` directory
- Props interface named `{ComponentName}Props`
- Keep components pure - business logic lives in `lib/`

**Ink-Specific:**
- Use `<Box>` for layout, `<Text>` for text
- Flexbox via `flexDirection`, `gap`, `padding`
- Colors via `color` prop: `<Text color="green">✓</Text>`
- Use `@inkjs/ui` components: `Spinner`, `Select`, `TextInput`

### Testing Rules

**Test Organization:**
- Co-locate tests: `workspace.ts` → `workspace.test.ts` (same directory)
- Fixtures in `lib/__fixtures__/` directory
- Test file naming: `*.test.ts` or `*.test.tsx`

**Dependency Injection Pattern:**
- Never mock globals - use dependency injection
- Factory functions accept executor parameter:
  ```typescript
  export function createDiscovery(executor = execa) { ... }
  ```
- Tests inject mock executor:
  ```typescript
  const mockExecutor = vi.fn().mockResolvedValue({ stdout: '[]', failed: false });
  const discover = createDiscovery(mockExecutor);
  ```

**ESM Mocking Pitfalls (CRITICAL):**
- This project uses ESM (`module: NodeNext`). CJS mocking patterns do not work:
  ```typescript
  // ❌ BROKEN: require() is not defined in ESM — throws ReferenceError
  vi.spyOn(require('node:fs'), 'readFileSync');

  // ❌ UNRELIABLE: vi.mock without factory cannot auto-mock Node built-ins
  // in ESM because built-ins are not standard modules — mocks silently fail
  vi.mock('node:fs');
  ```
- **Correct patterns for unit tests:**
  ```typescript
  // ✅ PREFERRED: Dependency injection (our standard pattern)
  export async function readConfig(deps = { readFile: fs.readFile }) { ... }

  // ✅ OK: vi.spyOn works on global objects (process, console)
  vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

  // ✅ ALTERNATIVE: vi.mock with explicit factory (when DI isn't practical)
  vi.mock('node:fs', () => ({
    readFileSync: vi.fn().mockReturnValue('mocked content'),
  }));
  ```
- **Integration tests (e.g., `src/release/*.test.ts`) intentionally use real I/O** to validate actual config files. Do not add mocking to these — they should fail when files are wrong.
- When using `vi.mock` with a factory, the call is hoisted above all imports by Vitest. You cannot reference test-scoped variables in the factory, but you can reference `vi.fn()` and other imports. Configure return values in individual tests via `vi.mocked()`.
- **When to use DI vs. `vi.mock`:** Prefer DI for all new code. Use `vi.mock` with factory only when the dependency is deeply embedded and DI would require threading it through 3+ layers of function signatures.

**Subprocess Testing:**
- Never call real `git`, `docker`, or `devcontainer` in tests
- Create fixtures for command outputs (JSON, text)
- Test both success and failure paths

**Coverage Targets:**

| Module | Target |
|--------|--------|
| `shared/*` | 100% |
| `lib/git.ts` | 90%+ |
| `lib/workspace.ts` | 90%+ |
| `lib/container.ts` | 80%+ |
| `hooks/*` | 80%+ |
| `components/*` | Key interactions |

**Component Testing:**
- Use `ink-testing-library` for Ink components
- Test keyboard interactions via `useInput` mocks
- Snapshot tests for UI structure, interaction tests for behavior

### Code Quality & Style Rules

**File Naming:**

| Type | Convention | Example |
|------|------------|---------|
| React components | PascalCase.tsx | `InstanceList.tsx` |
| Lib modules | lowercase.ts | `workspace.ts` |
| Tests | *.test.ts | `workspace.test.ts` |
| Fixtures | camelCase.json | `instanceList.json` |

**Code Naming:**

| Type | Convention | Example |
|------|------------|---------|
| Functions | camelCase | `getGitState()` |
| Variables | camelCase | `instanceList` |
| Constants | SCREAMING_SNAKE | `DEFAULT_TIMEOUT` |
| Types/Interfaces | PascalCase | `Instance`, `GitState` |

**JSON Fields:**
- Always camelCase: `{ "lastAttached": "...", "gitState": {...} }`
- Never snake_case in JSON output

**Layered Architecture:**
```
cli.ts → commands/ → lib/ → shared/
              ↓
         components/ → hooks/
```
- Lower layers NEVER import from higher layers
- `lib/` has NO React imports
- `shared/` imports nothing from `agent-env/` or `orchestrator/`

**Run Before Commit:**
```bash
pnpm check  # type-check + lint + test
```

### Development Workflow Rules

**Shared Code Governance:**
- Changes to `shared/` require CI to run ALL tests (both CLIs)
- Breaking changes to shared interfaces require updating both CLIs
- Prefer adding new exports over modifying existing ones

**CI Requirements:**
- All PRs must pass: `pnpm check` (type-check + lint + test)
- CI workflow: `.github/workflows/ci.yml`
- Tests run on Node 20+

**Adding a New Command (agent-env):**
1. Create `src/agent-env/commands/foo.ts`
2. Create `src/agent-env/commands/foo.test.ts`
3. Register in `src/agent-env/cli.ts`
4. Run `pnpm test:agent-env`

**Adding Shared Code:**
1. Add to `src/shared/`
2. Export from `src/shared/index.ts`
3. Run `pnpm test` (all tests must pass)

**JSON Output Contract:**
All `--json` output uses this structure:
```typescript
interface JsonOutput<T> {
  ok: boolean;
  data: T | null;
  error: AppError | null;
}
```

### Critical Don't-Miss Rules

**Subprocess Handling (CRITICAL):**
```typescript
// ALWAYS use reject: false
const result = await execa('git', ['status'], { reject: false });

// ALWAYS check result.failed
if (result.failed) {
  return { ok: false, error: { code: 'GIT_ERROR', message: result.stderr } };
}
```
- Never let subprocess throw - use `reject: false`
- Always check `result.failed` before using `result.stdout`
- Set appropriate `timeout` for each command

**Atomic File Writes (CRITICAL):**
```typescript
// Write to temp, then rename
const tempPath = `${filePath}.tmp`;
await fs.writeFile(tempPath, content);
await fs.rename(tempPath, filePath);
```
- Never write directly to state files
- Prevents corruption on crash/interrupt

**Error Handling (CRITICAL):**
- Always use `formatError()` from `shared/errors.ts`
- Include error `code`, `message`, and `suggestion` where helpful
- Error codes: `SAFETY_CHECK_FAILED`, `WORKSPACE_NOT_FOUND`, `CONTAINER_ERROR`, `GIT_ERROR`, `ORBSTACK_REQUIRED`

**Anti-Patterns to AVOID:**
- ❌ `import { thing } from './module'` → ✅ `import { thing } from './module.js'`
- ❌ `await execa('git', [...])` → ✅ `await execa('git', [...], { reject: false })`
- ❌ `fs.writeFileSync(statePath, data)` → ✅ Atomic write pattern
- ❌ `useState` for complex state → ✅ `useReducer`
- ❌ Business logic in components → ✅ Business logic in `lib/`
- ❌ Importing `lib/` from `shared/` → ✅ `shared/` has no internal imports

**agent-env Specific:**
- Workspace folder is the atomic unit, not the container
- Git state checks must cover ALL branches, not just current
- Safety checks: zero false negatives (blocking work loss > convenience)

