---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
workflowComplete: true
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/test-design-system.md'
---

# BMAD Orchestrator - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for BMAD Orchestrator, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Instance Discovery & Status (FR1-4):**
- FR1: User can view all active instances in a single unified display
- FR2: System can auto-discover instances via naming convention without manual configuration
- FR3: User can optionally override auto-discovery with explicit configuration
- FR4: User can see which project/workspace each instance is working on

**Story & Progress Visibility (FR5-10):**
- FR5: User can see current story assignment for each instance
- FR6: User can see story status (done, running, needs-input, inactive)
- FR7: User can see time since last activity/heartbeat per instance
- FR8: User can see task progress within a story (e.g., "3/7 tasks completed")
- FR8a: User can see epic progress (overall completion percentage) for the epic containing the current story
- FR9: User can see the backlog of unassigned stories
- FR10: System can detect idle instances (completed story, no current assignment)

**Needs-Input Handling (FR11-15) - DEFERRED TO PHASE 2:**
- FR11: System can detect when Claude is waiting for user input
- FR12: User can see the specific question Claude is asking
- FR13: User can see the session ID for resume operations
- FR14: User can provide an answer to resume a paused session
- FR15: System can generate copy-paste resume command with answer

**Inactive Detection & Alerts (FR16-18):**
- FR16: System can detect inactive workers (no activity within threshold via file mtime)
- FR17: User can see visual indication of inactive status
- FR18: User can see attach command to investigate inactive instances

**Command Generation (FR19-23):**
- FR19: User can see copy-paste ready dispatch commands for idle instances
- FR20: User can see suggested next story to assign
- FR21: User can see copy-paste ready resume commands
- FR22: User can see command to attach to interactive tmux session
- FR23: All generated commands use JSON output mode by default

**Dashboard Interface (FR24-28):**
- FR24: User can launch a persistent TUI dashboard
- FR25: User can quit the dashboard gracefully
- FR26: User can refresh dashboard state manually
- FR27: User can drill into detail view for specific instance
- FR28: User can navigate back from detail view to main view

**CLI Commands - Scriptable (FR29-32):**
- FR29: User can get one-shot status dump via CLI command
- FR30: User can list discovered instances via CLI command
- FR31: User can get output in JSON format for any CLI command
- FR32: User can use shell completion for instance names and commands

**Installation & Configuration (FR33-35):**
- FR33: User can install via pnpm
- FR34: User can run dashboard from any directory on host machine
- FR35: System can read BMAD state files from instance workspaces on host filesystem

### NonFunctional Requirements

**Performance:**
- NFR1: Dashboard initial render completes within 2 seconds of launch
- NFR2: Status refresh completes within 1 second
- NFR3: CLI commands return within 500ms for status queries
- NFR4: Instance discovery completes within 3 seconds for up to 10 instances

**Reliability:**
- NFR5: Inactive detection has zero false negatives (never misses an inactive instance)
- NFR6: False positive rate for inactive detection is acceptable (may flag active instance briefly)
- NFR7: Dashboard gracefully handles unreachable instances without crashing
- NFR8: Partial failures (one instance unreachable) do not block display of other instances

**Integration & Compatibility:**
- NFR9: Runs on macOS (Intel and Apple Silicon)
- NFR10: Runs on Linux (Ubuntu 22.04+, Debian-based)
- NFR11: Works with agent-env CLI for instance discovery
- NFR12: Correctly parses BMAD state files (sprint-status.yaml, story files)
- NFR13: Works with Claude CLI `--output-format json` responses
- NFR14: Compatible with existing claude-instance tmux session naming

**Maintainability:**
- NFR15: Codebase is understandable by owner without extensive documentation
- NFR16: Clear separation between TUI rendering, state aggregation, and command generation
- NFR17: No external runtime dependencies beyond Node.js packages
- NFR18: Configuration schema is self-documenting (YAML with comments)

### Additional Requirements

**From Architecture - Technical Constraints:**
- AR1: Manual project setup with full tooling (ESLint, Prettier, Vitest, CI) - no scaffolding tool
- AR2: Single TypeScript package structure (not a monorepo)
- AR3: Zero container footprint in Phase 1 (no modifications to BMAD workflows or agent-env instances)
- AR4: Read-only observer pattern - derives ALL state from existing BMAD artifacts
- AR5: Git-native state using existing sprint-status.yaml and story files only
- AR6: agent-env CLI dependency for instance discovery (agent-env list --json)
- AR7: Promise.allSettled pattern for error isolation per instance
- AR8: execa 9.x with reject: false pattern for subprocess handling
- AR9: Dependency injection pattern enabling testability without global mocks
- AR10: Test fixtures required from day 1 (instanceList.json, sprintStatus.yaml, story files)
- AR11: Scoped package: @zookanalytics/bmad-orchestrator

**From Architecture - Data Sources:**
- AR12: Sprint status from `_bmad-output/implementation-artifacts/sprint-status.yaml`
- AR13: Story files from `_bmad-output/implementation-artifacts/stories/*.md`
- AR14: Epic files from `_bmad-output/implementation-artifacts/epics/*.md`
- AR15: Activity detection via file mtime with 1-hour default threshold

**From Architecture - Module Structure:**
- AR16: lib/ layer for pure business logic (no React imports)
- AR17: hooks/ layer for React state bridge
- AR18: components/ layer for Ink TUI components
- AR19: commands/ layer for CLI entry points

**From UX Design - Responsive Requirements:**
- UX1: Three responsive breakpoints: ≥120 cols (2-column grid), 80-119 cols (1-column stack), <80 cols (compact)
- UX2: Use Ink's useStdoutDimensions() for terminal size detection

**From UX Design - Accessibility Requirements:**
- UX3: Never rely on color alone - symbols + text + color triple redundancy
- UX4: Full keyboard-only operation (j/k/h/l/Enter/Esc/q)
- UX5: Respect NO_COLOR and TERM=dumb environment variables
- UX6: ASCII fallback symbols for terminals without Unicode support

**From UX Design - Interaction Patterns:**
- UX7: Clipboard-based handoff (dashboard never spawns terminals)
- UX8: Auto-refresh with visible timestamp indicator
- UX9: Backlog overlay triggered by 'b' key
- UX10: Empty state with BMAD-contextual guidance for new users
- UX11: No animations - instant state change for simplicity
- UX12: Selection persists across refreshes (by instance name, not index)
- UX13: Double-line border for needs-input panes to visually "scream" for attention

**From UX Design - Error Handling:**
- UX14: Every error state has a visible next action (no dead ends)
- UX15: Clipboard failure fallback: show command inline for manual copy
- UX16: Partial discovery results shown with "R to retry" hint

**From UX Design - Visual Standards:**
- UX17: STATE_CONFIG as single source of truth for status visuals
- UX18: Status symbols: ● (running), ✓ (done), ○ (idle), ⏸ (needs-input), ⚠ (inactive), ✗ (error)
- UX19: Success feedback: 3 seconds duration, green ✓
- UX20: Error feedback: persistent until resolved, red ✗

**From Test Design - Test Framework Requirements:**
- TD1: Test framework: Vitest 4.0.16 with globals and node environment
- TD2: TUI testing: ink-testing-library for component testing
- TD3: Coverage targets: 80% global, 90% for lib modules
- TD4: Test levels: 60% unit, 25% integration, 15% E2E
- TD5: jscpd duplication check (<5% threshold)
- TD6: CI workflow: type-check, lint, test on every commit

**From Test Design - Required Test Fixtures:**
- TD7: instanceList.json - Normal instance list (3 instances, mixed states)
- TD8: instanceListEmpty.json - Empty array (no instances)
- TD9: instanceListError.json - CLI error (stderr output)
- TD10: sprintStatus.yaml - Normal sprint (multiple stories, various statuses)
- TD11: sprintStatusMinimal.yaml - Minimal valid (one story)
- TD12: sprintStatusMalformed.yaml - Invalid YAML (error handling)
- TD13: story-1-1.md - In-progress story (some tasks checked)
- TD14: story-1-1-complete.md - Completed story (all tasks checked)

**From Test Design - Test Priority:**
- TD15: Critical priority: lib/discovery.ts and lib/state.ts (90%+ coverage)
- TD16: High priority: lib/activity.ts, hooks/useOrchestrator.ts (80%+ coverage)
- TD17: Medium priority: components/*.tsx (snapshot + key interactions)
- TD18: Low priority: cli.ts (integration test only)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | View all active instances in unified display |
| FR2 | Epic 1 | Auto-discover instances via naming convention |
| FR3 | Epic 1 | Optional override with explicit configuration |
| FR4 | Epic 1 | See project/workspace per instance |
| FR5 | Epic 2 | See current story assignment |
| FR6 | Epic 2 | See story status (done, running, etc.) |
| FR7 | Epic 2 | See time since last activity |
| FR8 | Epic 2 | See task progress within story |
| FR8a | Epic 2 | See epic progress percentage |
| FR9 | Epic 2 | See backlog of unassigned stories |
| FR10 | Epic 2 | Detect idle instances |
| FR11-15 | **Deferred** | Needs-Input Handling (Phase 2) |
| FR16 | Epic 2 | Detect inactive workers via mtime |
| FR17 | Epic 2 | Visual indication of inactive status |
| FR18 | Epic 2 | Attach command to investigate |
| FR19 | Epic 4 | Copy-paste dispatch commands |
| FR20 | Epic 4 | Suggested next story |
| FR21 | Epic 4 | Copy-paste resume commands |
| FR22 | Epic 4 | Command to attach to tmux |
| FR23 | Epic 4 | JSON output mode by default |
| FR24 | Epic 3 | Launch persistent TUI dashboard |
| FR25 | Epic 3 | Quit dashboard gracefully |
| FR26 | Epic 3 | Manual refresh |
| FR27 | Epic 3 | Drill into detail view |
| FR28 | Epic 3 | Navigate back from detail |
| FR29 | Epic 5 | One-shot status dump CLI |
| FR30 | Epic 1 | List instances CLI (validates Epic 1 delivery) |
| FR31 | Epic 5 | JSON output for CLI |
| FR32 | Epic 5 | Shell completion |
| FR33 | Epic 1 | Install via pnpm |
| FR34 | Epic 1 | Run from any directory |
| FR35 | Epic 1 | Read BMAD state files |

## Epic List

### Epic 1: Project Foundation & Instance Discovery
**User Outcome:** I can install the tool and it discovers my instances

This epic establishes the project with full quality gates (CI, testing, linting) and implements the core discovery mechanism. After this epic, users can run `bmad-orchestrator list` and see their instances.

**FRs covered:** FR1, FR2, FR3, FR4, FR30, FR33, FR34, FR35
**ARs covered:** AR1-AR11 (tooling, package structure, execa, testing)
**Deliverable:** Working `bmad-orchestrator list` command

---

### Epic 2: BMAD State Parsing & Activity Detection
**User Outcome:** I can see what each instance is working on and whether it's active

This epic adds meaning to discovered instances by parsing BMAD state files (sprint-status.yaml, story files) and detecting activity via file mtime. After this epic, the `list` command shows story assignments, task progress, epic progress, and inactive status.

**FRs covered:** FR5, FR6, FR7, FR8, FR8a, FR9, FR10, FR16, FR17, FR18
**ARs covered:** AR12-AR15 (data sources, mtime detection)
**Deliverable:** Enhanced `list` output with BMAD state

---

### Epic 3: Dashboard Experience
**User Outcome:** I have a visual dashboard showing all instances at a glance with keyboard navigation

This epic creates the persistent TUI using Ink, implementing the pane-based grid layout, keyboard navigation (j/k/h/l), selection highlighting, responsive breakpoints, and all UX patterns.

**FRs covered:** FR24, FR25, FR26, FR27, FR28
**UX covered:** UX1-UX13 (responsive, accessibility, navigation, visual standards)
**NFRs addressed:** NFR1, NFR2 (performance)
**Deliverable:** `bmad-orchestrator` launches persistent TUI dashboard

---

### Epic 4: Command Generation & Clipboard Actions
**User Outcome:** I can see and copy actionable commands for any instance

This epic adds command generation (dispatch, attach, tmux attach) and clipboard integration. The dashboard shows contextual commands and users can copy them with a single keypress.

**FRs covered:** FR19, FR20, FR21, FR22, FR23
**UX covered:** UX7, UX14, UX15, UX16 (clipboard handoff, error recovery)
**Deliverable:** Command bar with copy-paste functionality

---

### Epic 5: CLI Polish & Package Publishing
**User Outcome:** I can script the tool and install it globally

This epic adds the `status` CLI command with JSON output, shell completion, and publishes the package as @zookanalytics/bmad-orchestrator.

**FRs covered:** FR29, FR31, FR32
**ARs covered:** AR11 (scoped package)
**NFR addressed:** NFR3 (CLI performance <500ms)
**Deliverable:** Published package with full CLI

---

## Epic 1: Project Foundation & Instance Discovery

**Goal:** Establish the project with full quality gates and implement core instance discovery, delivering a working `bmad-orchestrator list` command.

### Story 1.1: Project Initialization with Quality Gates

As a **developer**,
I want **a properly configured TypeScript project with CI, linting, and testing**,
So that **code quality is enforced from the first commit**.

**Acceptance Criteria:**

**Given** a new project directory
**When** I run `pnpm install`
**Then** all dependencies install without errors
**And** the following tooling is configured:
- TypeScript 5.x with strict mode
- ESLint with @typescript-eslint rules
- Prettier for code formatting
- Vitest for testing
- Pre-commit hooks via husky/lint-staged

**Given** the project is initialized
**When** I run `pnpm check`
**Then** type-check, lint, and tests all pass

**Given** a pull request is opened
**When** CI runs on GitHub Actions
**Then** the workflow executes type-check, lint, and test
**And** fails if any check fails

**Given** the CI workflow runs tests
**When** code coverage is calculated
**Then** the build fails if coverage drops below 80% global threshold (TD3)
**And** coverage report is generated for review

**Technical Notes:**
- Package name: `@zookanalytics/bmad-orchestrator`
- Entry point: `bin/bmad-orchestrator.js`
- Use ESM modules with `.js` extensions for imports
- Project structure: `src/`, `bin/`, `.github/workflows/`

---

### Story 1.2: Test Fixtures and Discovery Types

As a **developer**,
I want **test fixtures and type definitions for instance discovery**,
So that **I can develop and test the discovery module with realistic data**.

**Acceptance Criteria:**

**Given** the project structure
**When** I look in `src/lib/__fixtures__/`
**Then** I find these fixture files:
- `instanceList.json` - Normal response with 3 instances (mixed statuses, git state, purpose)
- `instanceListEmpty.json` - Empty array response (ok: true, data: [])
- `instanceListError.json` - CLI error response (ok: false, error object)

**Given** the type definitions in `src/lib/types.ts`
**When** I import instance-related types
**Then** I can use:
- `Instance` interface (name, status, lastAttached, purpose, gitState — matching agent-env JSON output)
- `DiscoveryResult` interface (instances array, error)
- `InstanceDisplayStatus` type ('running' | 'stopped' | 'not-found' | 'orphaned' | 'unknown')

**Given** fixture files exist
**When** tests import them
**Then** they load correctly and match type definitions

**Technical Notes:**
- Fixtures based on actual `agent-env list --json` format (ok/data/error envelope)
- Types should align with agent-env CLI output structure

---

### Story 1.3: Instance Discovery Module

As a **developer**,
I want **a discovery module that queries agent-env CLI for active instances**,
So that **the application can find all agent-env instances on the host machine**.

**Acceptance Criteria:**

**Given** agent-env CLI is installed
**When** I call `discoverInstances()`
**Then** it executes `agent-env list --json`
**And** returns parsed Instance array with name, status, lastAttached, purpose, gitState

**Given** agent-env CLI returns an empty list
**When** I call `discoverInstances()`
**Then** it returns `{ instances: [], error: null }`

**Given** agent-env CLI is not installed or fails
**When** I call `discoverInstances()`
**Then** it returns `{ instances: [], error: "DISCOVERY_FAILED: ..." }`
**And** does not throw an exception

**Given** agent-env CLI returns an error envelope (`{ ok: false, error: {...} }`)
**When** I call `discoverInstances()`
**Then** it returns `{ instances: [], error: "DISCOVERY_FAILED: {message}" }`

**Given** the discovery module
**When** I want to test it
**Then** I can inject a mock executor via `createDiscovery(mockExecutor)`

**Given** a 10-second timeout
**When** agent-env CLI hangs
**Then** the function returns an error result (not throws)

**Technical Notes:**
- Use execa 9.x with `reject: false` pattern
- Factory function pattern: `createDiscovery(executor)` — same DI pattern as agent-env itself
- Located at `src/lib/discovery.ts`
- Parses agent-env JSON envelope: `{ ok, data, error }` — extract `data` on success
- agent-env provides richer data than DevPod ever did (git state, purpose, typed status come free)
- 90%+ test coverage required

---

### Story 1.4: List Command Implementation

As a **user**,
I want **to run `bmad-orchestrator list` and see my instances**,
So that **I can verify the tool discovers my development instances**.

**Acceptance Criteria:**

**Given** I have instances running
**When** I run `bmad-orchestrator list`
**Then** I see a list of instance names and their statuses

**Given** no instances are running
**When** I run `bmad-orchestrator list`
**Then** I see "No instances discovered"

**Given** I run the command with `--json` flag
**When** output is generated
**Then** it returns valid JSON matching the output schema:
```json
{ "version": "1", "instances": [...], "errors": [...] }
```

**Given** the package is installed globally
**When** I run `bmad-orchestrator list` from any directory
**Then** it executes successfully (FR34)

**Given** agent-env CLI fails
**When** I run `bmad-orchestrator list`
**Then** I see an error message with suggestion to check agent-env installation

**Technical Notes:**
- Use Commander 14.x for CLI parsing
- Entry point: `src/cli.ts`
- Command handler: `src/commands/list.ts`
- Plain text output by default, `--json` for structured output

---

## Epic 2: BMAD State Parsing & Activity Detection

**Goal:** Add meaning to discovered instances by parsing BMAD state files and detecting activity, delivering enhanced `list` output with story assignments, progress, and inactive status.

### Story 2.1: BMAD State Fixtures and Types

As a **developer**,
I want **test fixtures and type definitions for BMAD state parsing**,
So that **I can develop and test state modules with realistic data**.

**Acceptance Criteria:**

**Given** the project structure
**When** I look in `src/lib/__fixtures__/`
**Then** I find these additional fixture files:
- `sprintStatus.yaml` - Valid sprint with multiple stories in various statuses
- `sprintStatusMinimal.yaml` - Minimal valid sprint (one story)
- `sprintStatusMalformed.yaml` - Invalid YAML for error handling tests
- `story-1-1.md` - Story with some tasks checked (3/7)
- `story-1-1-complete.md` - Story with all tasks checked

**Given** the type definitions in `src/lib/types.ts`
**When** I import BMAD state types
**Then** I can use:
- `SprintStatus` interface (stories map, metadata)
- `StoryStatus` type ('backlog' | 'ready-for-dev' | 'in-progress' | 'done')
- `StoryState` interface (id, status, epic, title)
- `TaskProgress` interface (completed, total)
- `BmadState` interface (aggregated state per instance)

**Given** fixture files exist
**When** tests import them
**Then** they parse correctly and match type definitions

**Technical Notes:**
- Sprint status path: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story files path: `_bmad-output/implementation-artifacts/stories/*.md`
- Use `yaml` package for YAML parsing

---

### Story 2.2: Sprint Status Parser

As a **developer**,
I want **a module that parses sprint-status.yaml files**,
So that **I can extract story assignments and statuses for each instance**.

**Acceptance Criteria:**

**Given** a valid sprint-status.yaml file
**When** I call `parseSprintStatus(filePath)`
**Then** it returns a `SprintStatus` object with:
- Map of story IDs to their status
- List of stories per status category
- Current epic information

**Given** an instance workspace path
**When** I call `getSprintStatusPath(workspacePath)`
**Then** it returns `{workspacePath}/_bmad-output/implementation-artifacts/sprint-status.yaml`

**Given** sprint-status.yaml does not exist
**When** I call `parseSprintStatus(filePath)`
**Then** it returns `{ error: "NOT_BMAD_INITIALIZED", stories: [] }`

**Given** sprint-status.yaml is malformed
**When** I call `parseSprintStatus(filePath)`
**Then** it returns `{ error: "PARSE_ERROR: ...", stories: [] }`
**And** does not throw an exception

**Given** sprint-status.yaml contains stories with various statuses
**When** I extract the backlog
**Then** I get stories with status 'ready-for-dev' or 'backlog' (FR9)

**Technical Notes:**
- Located at `src/lib/state.ts`
- Use `yaml` package for parsing
- Return error states, never throw
- 90%+ test coverage required

---

### Story 2.3: Story File Parser

As a **developer**,
I want **a module that parses story markdown files**,
So that **I can extract task progress within each story**.

**Acceptance Criteria:**

**Given** a story markdown file with task checkboxes
**When** I call `parseStoryTasks(filePath)`
**Then** it returns `TaskProgress` with completed and total counts
**And** correctly parses `- [x]` as completed and `- [ ]` as incomplete

**Given** a story file path pattern
**When** I call `getStoryFilePath(workspacePath, storyId)`
**Then** it returns `{workspacePath}/_bmad-output/implementation-artifacts/stories/{storyId}.md`

**Given** a story file does not exist
**When** I call `parseStoryTasks(filePath)`
**Then** it returns `{ completed: 0, total: 0, error: "FILE_NOT_FOUND" }`

**Given** a story file with no task checkboxes
**When** I call `parseStoryTasks(filePath)`
**Then** it returns `{ completed: 0, total: 0 }`

**Given** an epic directory
**When** I call `parseEpicProgress(workspacePath, epicId)`
**Then** it returns overall completion percentage across all stories in that epic (FR8a)

**Technical Notes:**
- Located at `src/lib/state.ts` (same module as sprint parser)
- Task regex: `/- \[(x| )\]/gi`
- Epic files path: `_bmad-output/implementation-artifacts/epics/*.md`

---

### Story 2.4: Activity Detection Module

As a **developer**,
I want **a module that detects inactive instances via file modification time**,
So that **users can identify instances that may need attention**.

**Acceptance Criteria:**

**Given** an instance workspace path
**When** I call `checkActivity(workspacePath)`
**Then** it returns the last modification time of BMAD state files

**Given** a file was modified within the last hour
**When** I call `isInactive(mtime, threshold)`
**Then** it returns `false`

**Given** a file was modified more than 1 hour ago
**When** I call `isInactive(mtime, threshold)`
**Then** it returns `true` (FR16)

**Given** the default threshold
**When** activity detection runs
**Then** it uses 1 hour (3600000 ms) as the inactive threshold (AR15)

**Given** activity detection completes
**When** results are returned
**Then** they include:
- `lastActivity: Date` - timestamp of last file change
- `isInactive: boolean` - whether threshold exceeded
- `inactiveDuration: string` - human-readable duration (e.g., "2h ago")

**Technical Notes:**
- Located at `src/lib/activity.ts`
- Use `fs.stat().mtime` for modification time
- Check sprint-status.yaml and current story file
- Use `timeago.js` for duration formatting

---

### Story 2.5: Enhanced List Output

As a **user**,
I want **to see BMAD state information when I run `bmad-orchestrator list`**,
So that **I know what each instance is working on and whether it needs attention**.

**Acceptance Criteria:**

**Given** instances with BMAD state files
**When** I run `bmad-orchestrator list`
**Then** I see for each instance:
- Current story assignment (FR5)
- Story status (done, running, idle) (FR6)
- Time since last activity (FR7)
- Task progress (e.g., "3/7 tasks") (FR8)

**Given** an instance with an in-progress story
**When** the list displays
**Then** I see the epic name and progress percentage (FR8a)

**Given** an instance with no in-progress story
**When** the list displays
**Then** it shows as "Idle" with suggested next story (FR10, FR20)

**Given** an instance inactive for more than 1 hour
**When** the list displays
**Then** I see a warning indicator "⚠ Inactive (2h)" (FR17)

**Given** the backlog of unassigned stories
**When** I run `bmad-orchestrator list`
**Then** I see a summary line: "Backlog: 3 stories ready" (FR9)

**Given** an instance without BMAD initialized
**When** the list displays
**Then** it shows "Not BMAD-initialized" instead of state

**Given** I run with `--json` flag
**When** output is generated
**Then** JSON includes all state fields (story, progress, activity, backlog)

**Technical Notes:**
- Integrate state.ts and activity.ts into list command
- Use Promise.allSettled for parallel state reads (AR7)
- Status symbols: ● running, ✓ done, ○ idle, ⚠ inactive

---

## Epic 3: Dashboard Experience

**Goal:** Create a persistent TUI dashboard using Ink that displays all instances at a glance with keyboard navigation, responsive layout, and auto-refresh.

### Story 3.1: Orchestrator State Hook

As a **developer**,
I want **a single useOrchestrator hook that manages all dashboard state**,
So that **state logic is centralized, testable, and separate from UI components**.

**Acceptance Criteria:**

**Given** the useOrchestrator hook
**When** I call it in a component
**Then** it returns:
- `instances: Instance[]` - list of discovered instances with state
- `selected: number` - index of currently selected pane
- `loading: boolean` - whether refresh is in progress
- `lastRefresh: Date | null` - timestamp of last successful refresh
- `error: string | null` - any error message

**Given** the hook initializes
**When** the component mounts
**Then** it triggers an initial discovery and state load

**Given** the hook
**When** I call `refresh()`
**Then** it dispatches REFRESH_START, fetches data, then dispatches REFRESH_COMPLETE or REFRESH_ERROR

**Given** the hook
**When** I call `selectNext()` or `selectPrev()`
**Then** it updates the selected index with wrap-around

**Given** the hook uses useReducer
**When** actions are dispatched
**Then** state transitions follow this pattern:
- `REFRESH_START` → `{ loading: true }`
- `REFRESH_COMPLETE` → `{ loading: false, instances: [...], lastRefresh: Date }`
- `REFRESH_ERROR` → `{ loading: false, error: "..." }`
- `SELECT_NEXT` / `SELECT_PREV` → `{ selected: newIndex }`

**Technical Notes:**
- Located at `src/hooks/useOrchestrator.ts`
- Uses useReducer for complex state transitions
- Composes discovery.ts, state.ts, and activity.ts
- Testable in isolation without rendering

---

### Story 3.2: InstancePane Component

As a **developer**,
I want **a pure display component that renders a single instance pane**,
So that **pane rendering is consistent and testable via snapshots**.

**Acceptance Criteria:**

**Given** an InstancePane component
**When** I pass an instance with status "running"
**Then** it displays:
- Single-line border
- Cyan ● indicator with "RUNNING"
- Epic name and progress bar
- Story name and task progress
- Time since last activity

**Given** an instance with status "done"
**When** rendered
**Then** it displays dimmed styling with green ✓ indicator

**Given** an instance with status "needs-input"
**When** rendered
**Then** it displays double-line border (═) with yellow ⏸ indicator (UX13)

**Given** an instance with status "inactive"
**When** rendered
**Then** it displays yellow ⚠ indicator with duration (e.g., "⚠ Inactive (2h)")

**Given** an instance with status "idle"
**When** rendered
**Then** it displays dim ○ indicator with suggested next story

**Given** the `selected` prop is true
**When** rendered
**Then** the pane has highlighted/inverted border style

**Given** any status
**When** rendered
**Then** symbols convey meaning without relying on color alone (UX3)

**Technical Notes:**
- Located at `src/components/InstancePane.tsx`
- Props: `{ instance: Instance, selected: boolean, width: number }`
- Uses STATE_CONFIG from patterns for consistent visuals
- Snapshot tests for each state

---

### Story 3.3: Dashboard Layout and Grid

As a **user**,
I want **a dashboard that displays all instances in a grid layout**,
So that **I can see everything at a glance when I launch the tool**.

**Acceptance Criteria:**

**Given** I run `bmad-orchestrator` (no subcommand)
**When** the dashboard launches
**Then** I see:
- Header with "BMAD Orchestrator" and refresh timestamp
- Grid of instance panes
- Footer with keybinding hints

**Given** multiple instances are discovered
**When** the dashboard renders
**Then** panes are arranged in a 2-column grid (at ≥120 cols)

**Given** instances maintain stable positions
**When** the dashboard refreshes
**Then** panes stay in the same order (sorted by name, not status) (UX12)

**Given** no instances are discovered
**When** the dashboard renders
**Then** I see the empty state with BMAD-contextual guidance (UX5, UX10)

**Given** the footer
**When** displayed
**Then** it shows: "j/k: navigate  Enter: detail  b: backlog  c: copy  q: quit"

**Technical Notes:**
- Located at `src/components/Dashboard.tsx`
- Uses Ink's Box with flexDirection="row" and flexWrap="wrap"
- Imports InstancePane and useOrchestrator
- Entry point switches between TUI (default) and CLI commands

---

### Story 3.4: Keyboard Navigation

As a **user**,
I want **to navigate the dashboard using keyboard shortcuts**,
So that **I can quickly select and interact with instances without a mouse**.

**Acceptance Criteria:**

**Given** the dashboard is displayed
**When** I press `j`
**Then** selection moves to the next pane (down/right)

**Given** the dashboard is displayed
**When** I press `k`
**Then** selection moves to the previous pane (up/left)

**Given** a 2x2 grid layout
**When** I press `h`
**Then** selection moves left (1→0, 3→2)

**Given** a 2x2 grid layout
**When** I press `l`
**Then** selection moves right (0→1, 2→3)

**Given** selection is at the last pane
**When** I press `j`
**Then** selection wraps to the first pane

**Given** a pane is selected
**When** I press `Enter`
**Then** I enter detail view for that instance (FR27)

**Given** I am in detail view
**When** I press `Esc`
**Then** I return to the grid view (FR28)

**Given** the dashboard is displayed
**When** I press `q`
**Then** the dashboard exits gracefully (FR25)

**Given** the dashboard is displayed
**When** I press `b`
**Then** the backlog overlay opens (UX9)

**Technical Notes:**
- Use Ink's `useInput` hook for keyboard handling
- Navigation logic in useOrchestrator hook
- Detail view can be a modal overlay or separate render mode

---

### Story 3.5: Auto-Refresh and Loading States

As a **user**,
I want **the dashboard to automatically refresh and show loading states**,
So that **data stays current without manual intervention**.

**Acceptance Criteria:**

**Given** the dashboard is running
**When** 30 seconds pass
**Then** data automatically refreshes (UX8)

**Given** a refresh is in progress
**When** the header renders
**Then** it shows a spinner indicator "↻ Refreshing..."

**Given** a refresh completes
**When** the header renders
**Then** it shows the timestamp "↻ 5s ago" using timeago format

**Given** I press `R` (shift+r)
**When** the dashboard is displayed
**Then** a manual refresh is triggered (FR26)

**Given** the initial load
**When** discovery is in progress
**Then** I see a centered spinner with "Discovering instances..."

**Given** a partial failure occurs
**When** one instance is unreachable
**Then** other instances still display, and the failed one shows error state (NFR8)

**Technical Notes:**
- Use useEffect with setInterval for auto-refresh
- Spinner from @inkjs/ui
- Timestamp formatting with timeago.js
- Clear interval on unmount

---

### Story 3.6: Responsive Breakpoints

As a **user**,
I want **the dashboard to adapt to my terminal size**,
So that **it works well on different screen widths**.

**Acceptance Criteria:**

**Given** terminal width ≥120 columns
**When** the dashboard renders
**Then** panes display in a 2-column grid (UX1)

**Given** terminal width 80-119 columns
**When** the dashboard renders
**Then** panes stack in a single column (UX1)

**Given** terminal width <80 columns
**When** the dashboard renders
**Then** panes display in compact mode with minimal content (UX1)

**Given** the terminal is resized
**When** dimensions change
**Then** the layout adapts automatically

**Given** more than 4 instances in a 2-column layout
**When** the grid overflows
**Then** vertical scrolling is available with scroll indicators

**Technical Notes:**
- Use Ink's `useStdoutDimensions()` hook (UX2)
- Calculate pane width based on available columns
- Pass width prop to InstancePane for internal layout adjustments

---

## Epic 4: Command Generation & Clipboard Actions

**Goal:** Add command generation (dispatch, attach, tmux attach) and clipboard integration, enabling users to see and copy actionable commands for any instance with a single keypress.

### Story 4.1: Command Generation Module

As a **developer**,
I want **a module that generates contextual commands for instances**,
So that **users get copy-paste ready commands without manual assembly**.

**Acceptance Criteria:**

**Given** an instance name
**When** I call `generateAttachCommand(instanceName)`
**Then** it returns `agent-env attach {instanceName}`

**Given** an instance name and a story ID
**When** I call `generateDispatchCommand(instanceName, storyId)`
**Then** it returns `agent-env attach {instanceName} -- claude -p "/bmad:bmm:workflows:dev-story {storyId}" --output-format json` (FR23)

**Given** an instance name
**When** I call `generateTmuxAttachCommand(instanceName)`
**Then** it returns the command to attach to the tmux session (FR22)

**Given** an idle instance with a suggested story
**When** I call `generateNextStoryCommand(instanceName, suggestedStoryId)`
**Then** it returns the dispatch command for that story (FR19, FR20)

**Given** an instance that needs input (Phase 2 prep)
**When** I call `generateResumeCommand(instanceName, sessionId, answer)`
**Then** it returns the resume command structure (FR21)

**Given** any generated command
**When** the command is displayed
**Then** it uses JSON output mode by default (FR23)

**Technical Notes:**
- Located at `src/lib/commands.ts`
- Pure functions, no side effects
- All commands are strings ready for copy-paste
- Unit tests for all command variations

---

### Story 4.2: Command Bar Component

As a **user**,
I want **to see the relevant command for my selected instance**,
So that **I know exactly what action I can take without thinking**.

**Acceptance Criteria:**

**Given** an instance is selected in the dashboard
**When** the command bar renders
**Then** it shows the contextual command for that instance's state

**Given** an idle instance is selected
**When** the command bar renders
**Then** it shows the dispatch command with suggested next story

**Given** a running instance is selected
**When** the command bar renders
**Then** it shows the attach command to check on it

**Given** an inactive instance is selected
**When** the command bar renders
**Then** it shows the attach command with "investigate" context (FR18)

**Given** an instance in needs-input state is selected
**When** the command bar renders
**Then** it shows the attach command to provide input

**Given** the command bar
**When** displayed
**Then** it shows:
- Selected instance name: `▸ {instanceName} selected`
- The command on its own line for easy selection

**Technical Notes:**
- Located at `src/components/CommandBar.tsx`
- Receives selected instance from useOrchestrator
- Uses commands.ts for command generation
- Styled with single-line border

---

### Story 4.3: Clipboard Integration

As a **user**,
I want **to copy commands with a single keypress**,
So that **I can quickly paste and execute them in my terminal**.

**Acceptance Criteria:**

**Given** an instance is selected
**When** I press `c`
**Then** the displayed command is copied to the system clipboard

**Given** a command is successfully copied
**When** the copy completes
**Then** I see success feedback "✓ Copied to clipboard" for 3 seconds (UX19)

**Given** clipboard access fails (e.g., SSH session without clipboard)
**When** copy is attempted
**Then** I see the command inline with message "Copy manually:" (UX15)
**And** the error is not blocking

**Given** an instance is selected
**When** I press `Enter`
**Then** the command is also copied (Enter = primary action)

**Given** the copy feedback
**When** displayed
**Then** it appears in the command bar area, replacing the command temporarily

**Technical Notes:**
- Use `clipboardy` package for cross-platform clipboard access
- Wrap in try/catch for graceful degradation
- Feedback via temporary state in useOrchestrator
- 3-second timeout via useEffect

---

### Story 4.4: Backlog Panel and Story Suggestions

As a **user**,
I want **to see unassigned stories and get suggestions for idle instances**,
So that **I can quickly decide what work to dispatch next**.

**Acceptance Criteria:**

**Given** the dashboard is displayed
**When** I look at the backlog bar
**Then** I see: "Backlog: {N} stories ready │ {story-id-1}, {story-id-2}, ..." (FR9)

**Given** the dashboard is displayed
**When** I press `b`
**Then** a backlog overlay opens showing all ready-for-dev stories (UX9)

**Given** the backlog overlay is open
**When** I look at it
**Then** I see a table with: Story ID, Epic, Title

**Given** the backlog overlay is open
**When** I press `Esc`
**Then** the overlay closes and I return to the grid

**Given** the backlog overlay is open
**When** I press `b` again
**Then** the overlay closes (toggle behavior for muscle memory)

**Given** an idle instance
**When** rendered in the pane
**Then** it shows "Suggested: {storyId}" with the next logical story (FR20)

**Given** multiple idle instances
**When** suggestions are calculated
**Then** each gets a different story suggestion (no duplicates)

**Given** the backlog is empty
**When** the backlog bar renders
**Then** it shows "Backlog: No stories ready"

**Technical Notes:**
- BacklogPanel component at `src/components/BacklogPanel.tsx`
- Backlog bar is always visible, overlay triggered by 'b'
- Story suggestions based on epic order, then story order
- Overlay uses Ink's layering (position absolute or portal pattern)

---

## Epic 5: CLI Polish & Package Publishing

**Goal:** Add the `status` CLI command with JSON output, shell completion, and publish the package as @zookanalytics/bmad-orchestrator, completing the MVP.

### Story 5.1: Status Command Implementation

As a **user**,
I want **to get a one-shot status dump via CLI command**,
So that **I can script the orchestrator and integrate it with other tools**.

**Acceptance Criteria:**

**Given** instances are running with BMAD state
**When** I run `bmad-orchestrator status`
**Then** I see a summary of all instances with their current state (FR29)

**Given** I run `bmad-orchestrator status`
**When** output is generated
**Then** it completes within 500ms (NFR3)

**Given** I run `bmad-orchestrator status --json`
**When** output is generated
**Then** it returns valid JSON matching the schema (FR31):
```json
{
  "version": "1",
  "timestamp": "ISO-8601",
  "instances": [
    {
      "name": "string",
      "workspace": "string",
      "status": "running|done|idle|inactive|error",
      "story": { "id": "string", "title": "string", "progress": "3/7" },
      "epic": { "id": "string", "title": "string", "progress": 60 },
      "lastActivity": "ISO-8601",
      "isInactive": false
    }
  ],
  "backlog": [{ "id": "string", "epic": "string", "title": "string" }],
  "errors": []
}
```

**Given** I run `bmad-orchestrator status` with no instances
**When** output is generated
**Then** I see "No instances discovered" (text) or empty arrays (JSON)

**Given** partial failures occur
**When** one instance is unreachable
**Then** other instances still display with the failed one in errors array

**Technical Notes:**
- Located at `src/commands/status.ts`
- Reuses discovery.ts, state.ts, activity.ts from Epic 2
- Text output similar to enhanced list, JSON output structured
- Measure performance in tests

---

### Story 5.2: Shell Completion

As a **user**,
I want **tab completion for commands and instance names**,
So that **I can work faster in the terminal without typing full names**.

**Acceptance Criteria:**

**Given** shell completion is installed
**When** I type `bmad-orchestrator <TAB>`
**Then** I see available commands: `list`, `status`, `dispatch`, `--help`, `--version`

**Given** shell completion is installed
**When** I type `bmad-orchestrator status --<TAB>`
**Then** I see available flags: `--json`, `--help`

**Given** the package is installed
**When** I run `bmad-orchestrator completion`
**Then** it outputs the completion script for my shell (FR32)

**Given** I run `bmad-orchestrator completion --shell bash`
**When** output is generated
**Then** it outputs bash-compatible completion script

**Given** I run `bmad-orchestrator completion --shell zsh`
**When** output is generated
**Then** it outputs zsh-compatible completion script

**Given** the README
**When** I read installation instructions
**Then** I see how to install completion: `bmad-orchestrator completion >> ~/.bashrc`

**Technical Notes:**
- Use Commander's built-in completion generation
- Support bash and zsh (primary shells on Mac/Linux)
- Document in README with one-liner installation

---

### Story 5.3: Package Publishing Preparation

As a **developer**,
I want **the package ready for publishing**,
So that **users can install it globally with `pnpm add -g`**.

**Acceptance Criteria:**

**Given** the package.json
**When** I review it
**Then** it contains:
- `"name": "@zookanalytics/bmad-orchestrator"` (AR11)
- `"version": "0.1.0"` (initial release)
- `"bin": { "bmad-orchestrator": "./bin/bmad-orchestrator.js" }`
- `"type": "module"` (ESM)
- `"files": ["dist", "bin"]` (published files only)
- Proper `"description"`, `"keywords"`, `"repository"`, `"license"`

**Given** I run `pnpm pack`
**When** the tarball is created
**Then** it contains only the necessary files (no src/, no tests)

**Given** I install the package globally
**When** I run `bmad-orchestrator --version`
**Then** I see the version number

**Given** I install the package globally
**When** I run `bmad-orchestrator --help`
**Then** I see usage information for all commands

**Given** the bin entry point
**When** I examine `bin/bmad-orchestrator.js`
**Then** it has the correct shebang and imports dist/cli.js

**Given** the package is ready
**When** I run `pnpm publish --access public`
**Then** it publishes successfully (manual step, not automated)

**Technical Notes:**
- Ensure `prepublishOnly` script runs build
- Add `"engines": { "node": ">=22" }` for Node version requirement
- Include LICENSE file
- Test with `pnpm link` before publishing
