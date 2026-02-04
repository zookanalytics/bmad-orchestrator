# Story 4.4: Add Shell Completion

Status: done

## Story

As a **power user**,
I want **tab completion for agent-env commands and instance names**,
So that **I can work faster without typing full names**.

## Acceptance Criteria

1. **Given** I run `agent-env completion bash`
   **When** I view the output
   **Then** I see a bash completion script

2. **Given** I run `agent-env completion zsh`
   **When** I view the output
   **Then** I see a zsh completion script

3. **Given** I've installed the completion script
   **When** I type `agent-env att<TAB>`
   **Then** it completes to `agent-env attach`

4. **Given** I've installed the completion script and have instances "auth" and "api"
   **When** I type `agent-env attach a<TAB>`
   **Then** I see both "auth" and "api" as options

5. **Given** I run `agent-env completion --help`
   **When** I view the output
   **Then** I see installation instructions for bash and zsh

## Tasks / Subtasks

- [x] Task 1: Create completion lib module with script generation (AC: #1, #2, #3, #4)
  - [x] 1.1 Create `packages/agent-env/src/lib/completion.ts` with bash/zsh script generators
  - [x] 1.2 Generate bash completion script with command and instance name completion
  - [x] 1.3 Generate zsh completion script with command and instance name completion
  - [x] 1.4 Scripts dynamically complete instance names by scanning `~/.agent-env/workspaces/`

- [x] Task 2: Write tests for completion lib module (AC: #1, #2, #3, #4)
  - [x] 2.1 Test bash script generation contains expected completion function
  - [x] 2.2 Test zsh script generation contains expected completion function
  - [x] 2.3 Test scripts reference all registered commands
  - [x] 2.4 Test invalid shell type returns error (isValidShell)

- [x] Task 3: Create completion command (AC: #1, #2, #5)
  - [x] 3.1 Create `packages/agent-env/src/commands/completion.ts` with shell argument
  - [x] 3.2 Output appropriate script based on shell argument (bash/zsh)
  - [x] 3.3 Show installation instructions in --help description

- [x] Task 4: Write tests for completion command (AC: #1, #2, #5)
  - [x] 4.1 Test `completion bash` outputs bash completion script
  - [x] 4.2 Test `completion zsh` outputs zsh completion script
  - [x] 4.3 Test invalid shell argument shows error

- [x] Task 5: Register completion command in cli.ts (AC: #1, #2)
  - [x] 5.1 Import and register completionCommand in cli.ts

- [x] Task 6: Update CLI integration tests (AC: #1, #2, #5)
  - [x] 6.1 Test `agent-env completion bash` outputs bash script via CLI
  - [x] 6.2 Test `agent-env completion zsh` outputs zsh script via CLI
  - [x] 6.3 Test `agent-env completion --help` shows installation instructions

- [x] Task 7: Run full test suite and verify no regressions
  - [x] 7.1 Run `pnpm --filter @zookanalytics/agent-env test:run` — 320 tests pass
  - [x] 7.2 Run `pnpm -r test:run` for all packages — 396 tests pass (25 shared + 51 orchestrator + 320 agent-env)
  - [x] 7.3 Run `pnpm --filter @zookanalytics/agent-env type-check` — clean

## Dev Notes

### Architecture Requirements

**Existing Code Reused:**
- `scanWorkspaces()` from `workspace.ts` — lists workspace names for dynamic completion
- Command pattern from `commands/purpose.ts` — Commander command export pattern

**New Modules:**
- `lib/completion.ts` — shell completion script generation with `generateCompletionScript()`, `isValidShell()`, `getInstallInstructions()`
- `commands/completion.ts` — CLI command for completion output

**Key Design Decisions:**
- Shell completion scripts use direct filesystem scanning of `~/.agent-env/workspaces/` for dynamic instance name completion (no subprocess call to agent-env needed)
- Bash uses `complete -F` with `compgen` for command/instance completion
- Zsh uses `compdef` with `_describe` and `_arguments` for typed command/instance completion
- Scripts complete instance names for `attach`, `remove`, and `purpose` commands
- Scripts complete options per command (e.g., `--repo`, `--attach` for create; `--json` for list; `--force` for remove)
- No external dependencies needed — pure shell script generation from TypeScript
- Commands list includes: create, list, ps, attach, remove, purpose, completion

### References

- [Source: _bmad-output/planning-artifacts/agent-env/epics.md#Story-4.4]
- [Source: packages/agent-env/src/lib/workspace.ts]
- [Source: _bmad-output/project-context.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None — implementation proceeded without issues.

### Completion Notes List

- Created `lib/completion.ts` with `generateCompletionScript()` for bash and zsh shell completion
- Bash script uses `_agent_env_completions` function with `compgen -W` for command/instance/option completion
- Zsh script uses `_agent_env` function with `_describe`, `_arguments`, and `_agent_env_instances` helper
- Both scripts scan `~/.agent-env/workspaces/` directory for dynamic instance name completion
- Both scripts complete per-command options (--repo, --attach, --json, --force, etc.)
- Created `commands/completion.ts` with Commander command accepting shell type argument
- Installation instructions embedded in `--help` description with both eval and file-based installation methods
- `isValidShell()` type guard for input validation
- 16 lib unit tests covering bash/zsh generation, command inclusion, instance completion, option completion, validation
- 4 command unit tests covering bash output, zsh output, error handling, help content
- 3 CLI integration tests covering bash/zsh script output and help display
- Registered `completionCommand` in `cli.ts` alongside existing commands
- Updated `--help` test to verify `completion` command appears in help output
- All 320 agent-env tests pass, 396 total across all packages, type-check clean

### Change Log

- 2026-02-04: Story created and implementation completed — shell completion fully functional with tests
- 2026-02-04: Code review — 6 issues found (1 HIGH, 3 MEDIUM, 2 LOW). 4 issues auto-fixed: test case mismatch, non-portable `find -printf` replaced with `ls`, unreachable `remove` option completion in bash/zsh fixed. 2 LOW issues noted but not fixed (process.exit consistency, missing --force test). All 324 agent-env tests pass, 400 total.

### File List

**New Files:**
- packages/agent-env/src/lib/completion.ts
- packages/agent-env/src/lib/completion.test.ts
- packages/agent-env/src/commands/completion.ts
- packages/agent-env/src/commands/completion.test.ts

**Modified Files:**
- packages/agent-env/src/cli.ts (imported and registered completionCommand)
- packages/agent-env/src/cli.test.ts (added completion command integration tests, updated help test)
- _bmad-output/implementation-artifacts/sprint-status.yaml (env-4-4 status updated)
- _bmad-output/implementation-artifacts/env-4-4-add-shell-completion.md (story file)
