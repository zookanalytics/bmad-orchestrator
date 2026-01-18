---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
workflowComplete: true
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
---

# UX Design Specification - BMAD Orchestrator

**Author:** Node
**Date:** 2026-01-05

---

## Executive Summary

### Project Vision

BMAD Orchestrator is a unified command center for multi-DevPod development. The core UX goal is **confidence through clarity** - eliminating decision paralysis by making the next action obvious at a glance.

Users stop asking "where are we?" and start executing.

### Target Users

**Primary Persona: The Solo Orchestrator**

- Single developer managing 1-6 parallel DevPods (up to 10 supported)
- Uses BMAD methodology for structured AI-assisted development
- Intermediate technical skill, comfortable with terminal workflows
- Needs quick situational awareness (especially morning check-ins)
- Values efficiency and clarity over feature richness

**Usage Context:**
- Host machine terminal (Mac/Linux)
- Brief interactions: check status → identify action → execute → return
- Keyboard-driven workflow preferred

### Key Design Challenges

1. **Information Density** - Display multiple DevPods with status, story assignment, and timing in a scannable format without overwhelming the user
2. **Instant Pattern Recognition** - Problems (stale, needs-input) must visually "pop" without requiring line-by-line reading
3. **Two-Level Navigation** - Clear mental model for main grid view vs. detail drill-down, with obvious entry/exit points
4. **Command Accessibility** - Copy-paste commands must be immediately visible and ready to use
5. **Progressive Disclosure** - Show summary by default, details on demand

### Design Opportunities

1. **Visual Status Language** - Unicode indicators (✓ ● ○ ✗ ⚠) combined with color coding create instant scanability
2. **"Next Action" Intelligence** - Surface the single most important thing to do, reducing cognitive load
3. **Keyboard-First UX** - vim-style navigation (j/k, Enter, q) for power-user efficiency
4. **Contextual Commands** - Selected DevPod shows its relevant command, eliminating search
5. **Color Hierarchy** - Green (good) / Yellow (attention) / Red (problem) with terminal color support

## Core User Experience

### Defining Experience

**The Core Loop:** Glance → Identify → Execute

The BMAD Orchestrator experience centers on a single, repeating interaction pattern:
1. **Glance** at the dashboard to see current state
2. **Identify** what needs attention (or confirm everything is running smoothly)
3. **Execute** the next action with a ready-to-use command

This loop should complete in seconds, not minutes. The dashboard exists to eliminate the cognitive overhead of tracking multiple parallel workstreams.

### Platform Strategy

| Aspect | Decision | Implementation |
|--------|----------|----------------|
| **Runtime** | Persistent TUI (always running) | Ink 6.x React-based terminal UI |
| **Data Freshness** | Auto-refresh | Interval-based or file-watch, never stale |
| **Navigation** | Keyboard-driven with selection | j/k navigation, Enter for detail, q to quit |
| **CLI Companion** | Individual commands available | `bmad-orchestrator status`, `bmad-orchestrator list` for scripting |
| **Platforms** | Mac + Linux terminals | Standard terminal emulators |

### Effortless Interactions

**What must require zero thought:**

1. **Knowing what's next** - The dashboard surfaces the recommended action; user doesn't have to figure it out
2. **Finding problems** - Status indicators make issues visually obvious instantly
3. **Getting commands** - Copy-paste ready, no manual assembly or editing
4. **Switching context** - Selected DevPod shows its details; navigation is instant

**What the dashboard handles automatically:**

- Detecting stale/stuck workers
- Identifying idle DevPods ready for new work
- Surfacing needs-input situations with the actual question
- Suggesting which story to assign next

### Critical Success Moments

| Moment | What Success Looks Like |
|--------|------------------------|
| **Morning check-in** | Open dashboard → immediately know state of all work → act within 30 seconds |
| **Needs-input detection** | See the question, provide answer, resume - without opening VS Code |
| **Idle worker dispatch** | Spot idle DevPod, see suggested story, copy command, execute |
| **Long-running confidence** | Dashboard shows healthy heartbeats; user trusts work is progressing |

**The Vision Moment:** Autonomous workers run for hours. Human reviews completed artifacts, tweaks if needed, dispatches next work. Git provides the safety net - everything is recorded, nothing is lost.

### Experience Principles

1. **Instant Clarity** - Status and problems visible at a glance. No hunting, no reading logs, no switching windows.

2. **Next Action Obvious** - The dashboard doesn't just show status; it tells you what to do. Eliminate decision paralysis.

3. **Minimize Interrupts** - Optimize for worker autonomy. Human reviews outcomes, not process. Less frequent but higher-value interactions.

4. **Trust the Safety Net** - Git records everything. Confidence to let workers run, knowing you can review and adjust any output.

5. **Persistent Presence** - Always-on, always-current. The dashboard is THE interface into BMAD work, not a secondary tool.

## Desired Emotional Response

### Primary Emotional Goals

**Core Feeling: "I've got this."**

The BMAD Orchestrator should evoke a sense of calm control. Users should feel like capable orchestrators, not overwhelmed jugglers. The dashboard carries cognitive load so users don't have to.

| Primary Emotion | Description |
|-----------------|-------------|
| **Calm Control** | Multiple workstreams feel manageable, not chaotic |
| **Relief** | The dashboard handles tracking so you don't have to |
| **Confidence** | Complete picture visible; no fear of missing something |

### Emotional Journey Mapping

| Stage | Desired Emotion | Design Implication |
|-------|-----------------|-------------------|
| **Opening dashboard** | Anticipation → Clarity | Instant status render, no loading anxiety |
| **Scanning status** | Calm assessment | Clean visual hierarchy, problems stand out |
| **Spotting an issue** | Alert but not alarmed | Clear indicators, actionable next step shown |
| **Executing action** | Confident | Copy-paste commands, no assembly required |
| **Closing dashboard** | Satisfied, informed | Know you've handled what needs handling |
| **Returning later** | Trust | Data is fresh, nothing slipped through |

### Micro-Emotions

**Emotions to Cultivate:**

| Emotion | How to Achieve |
|---------|----------------|
| **Confidence** | Always-current data, clear status indicators |
| **Trust** | Reliable stale detection, no false negatives |
| **Calm** | Information density without overwhelm |
| **Control** | Keyboard-driven, responsive, predictable |

**Emotions to Prevent:**

| Emotion | How to Avoid |
|---------|--------------|
| **Confusion** | Never wonder "is this stale?" - timestamps visible |
| **Anxiety** | Problems surfaced clearly, not hidden |
| **Frustration** | Commands ready to use, no manual editing |
| **Doubt** | Heartbeat indicators confirm workers are alive |

### Design Implications

| Emotional Goal | UX Design Approach |
|----------------|-------------------|
| **Calm Control** | Clean layout, visual hierarchy, whitespace |
| **Relief** | "Next Action" suggestion removes decision burden |
| **Confidence** | Timestamps on all data, refresh indicator visible |
| **Trust** | Consistent status indicators, predictable behavior |

### Emotional Design Principles

1. **Clarity Over Cleverness** - No ambiguous states. Every indicator has one clear meaning.

2. **Problems Are Obvious** - Issues should visually "pop" without requiring interpretation.

3. **Actions Are Ready** - Never make users assemble commands or figure out next steps.

4. **Freshness Is Visible** - Always show when data was last updated. Eliminate staleness anxiety.

5. **Predictable Behavior** - Same inputs produce same outputs. No surprises in a tool you rely on.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Primary Inspiration: Sparkline-Aesthetic Dashboard**

From research phase, a BMAD-style tool demonstrated the ideal aesthetic:
- Overall percent complete displayed graphically
- Work remaining visualized simply
- Chart-driven, sparkline-esque presentation
- Immediate comprehension without interpretation

**Secondary Inspiration: top/watch**

Functional Unix tools that excel at data clarity:
- Open the tool → immediately see the state
- No onboarding required for core value
- Data presentation is the entire product
- Refreshes automatically, always current

### Transferable UX Patterns

**Navigation Patterns:**

| Pattern | Source | Application |
|---------|--------|-------------|
| Visible keybindings | Modern TUIs | Footer bar showing available actions |
| Simple key model | vim basics | j/k for movement, Enter for action, q for quit |
| No modal states | Functional simplicity | Same keys work the same way everywhere |

**Visual Patterns:**

| Pattern | Source | Application |
|---------|--------|-------------|
| Sparkline progress | BMAD research tool | Progress bars for story/task completion |
| Data-first layout | top | Status grid dominates, chrome is minimal |
| Unicode indicators | Modern terminals | ✓ ● ○ ✗ ⚠ for instant status recognition |

**Interaction Patterns:**

| Pattern | Source | Application |
|---------|--------|-------------|
| Immediate value | top | Main view shows everything needed at a glance |
| Drill-down available | k9s, lazygit | Detail view accessible but not required |
| Auto-refresh | top, htop | Data stays current without manual action |

### Anti-Patterns to Avoid

| Anti-Pattern | Example | Why It Fails |
|--------------|---------|--------------|
| **Hidden commands** | top's keyboard shortcuts | Users don't know what's possible |
| **Complex modes** | vim's modal editing for new users | Learning curve blocks core value |
| **Feature density** | htop's many panels | Overwhelms when simplicity suffices |
| **Text-only status** | Log files | Requires reading, not scanning |
| **Undiscoverable navigation** | man pages for keybindings | Breaks flow to learn basics |

### Design Inspiration Strategy

**Adopt Directly:**

1. **Sparkline/progress bar visuals** - Graphical status beats text
2. **Data-first hierarchy** - Status grid is the product
3. **Auto-refresh** - Never stale, no manual intervention
4. **Unicode status indicators** - Instant recognition

**Adapt for Context:**

1. **Visible keybindings footer** - Unlike top, show what's available
2. **Minimal key vocabulary** - j/k/Enter/q covers 90% of use cases
3. **Single-mode interaction** - No learning curve for navigation

**Explicitly Avoid:**

1. **Hidden functionality** - If it's useful, it's visible
2. **Modal complexity** - Same keys, same behavior, everywhere
3. **Documentation dependency** - Core value without reading docs
4. **Feature accumulation** - Resist adding; simplicity is the feature

## Design System Foundation

### Design System Choice

**Foundation: Ink Ecosystem Libraries**

Rather than building custom components, we leverage the mature Ink ecosystem:

| Library | Purpose | Downloads |
|---------|---------|-----------|
| **@inkjs/ui** | Core UI components (Badge, ProgressBar, Spinner, Alert) | Official |
| **ink-chart** | Sparkline visualizations matching desired aesthetic | Community |
| **ink-table** | Table/row layouts for DevPod grid | 251k+ |
| **timeago.js** | Relative timestamp formatting | 10M+ |

### Rationale for Selection

1. **Proven Patterns** - These libraries represent community best practices, not reinvented wheels
2. **Sparkline Aesthetic** - ink-chart provides exactly the visualization style identified as inspiring
3. **Theming Support** - @inkjs/ui includes theme context for consistent styling
4. **Minimal Custom Code** - Only 2 trivial wrappers needed vs. building from scratch
5. **Maintenance** - Community-maintained components reduce long-term burden

### Component Mapping

| Dashboard Need | Component | Source |
|----------------|-----------|--------|
| Status indicators (✓ ● ○ ✗ ⚠) | `Badge` | @inkjs/ui |
| Story/task progress | `ProgressBar` + `Sparkline` | @inkjs/ui + ink-chart |
| Worker activity | `Spinner` | @inkjs/ui |
| Needs-input alerts | `Alert`, `StatusMessage` | @inkjs/ui |
| DevPod grid | `Table` | ink-table |
| Relative timestamps | `timeago.js` + `<Text>` | Custom wrapper (5 lines) |
| Keybinding footer | `Box` + `Text` + `Spacer` | Custom composition (10 lines) |

### Risk Mitigations

Based on multi-perspective review, the following safeguards are built into this approach:

| Risk | Mitigation |
|------|------------|
| **Ink 6.x / React 19 compatibility** | Verify package versions before adding to dependencies; check last update dates |
| **Library abandonment** | Use re-export pattern - all imports through `components/index.ts` for single-point swap |
| **Visual inconsistency** | Build prototype early; unify via @inkjs/ui theme layer if libraries clash |
| **Testing gaps** | Verify ink-testing-library works with all deps; use snapshot tests for TUI output |

### Implementation Approach

**Phase 1: Validation Sprint**

- Verify each package supports Ink 6.x / React 19
- Write one test rendering Sparkline with ink-testing-library
- Build quick visual prototype: Badge + Sparkline + Table row together

**Phase 2: Component Architecture**

Use re-export pattern for swap flexibility:

```tsx
// src/components/index.ts
export { Badge, ProgressBar, Spinner, Alert, StatusMessage } from '@inkjs/ui'
export { Sparkline } from 'ink-chart'
export { default as Table } from 'ink-table'
export { Timestamp } from './Timestamp'
export { KeyHints } from './KeyHints'
```

**Phase 3: Theme Customization**

- Extend @inkjs/ui default theme
- Define color palette matching status hierarchy (green/yellow/red)
- Configure Badge variants for DevPod states
- Ensure visual cohesion across all library components

### Custom Wrappers (Minimal)

```tsx
// Timestamp.tsx - Trivial wrapper
import { format } from 'timeago.js'
import { Text } from 'ink'

export function Timestamp({ date }: { date: Date }) {
  return <Text dimColor>{format(date)}</Text>
}

// KeyHints.tsx - Simple composition
import { Box, Text, Spacer } from 'ink'

export function KeyHints({ hints }: { hints: Array<{ key: string; action: string }> }) {
  return (
    <Box borderStyle="single" paddingX={1}>
      {hints.map((h, i) => (
        <Fragment key={h.key}>
          {i > 0 && <Spacer />}
          <Text><Text bold>{h.key}</Text>: {h.action}</Text>
        </Fragment>
      ))}
    </Box>
  )
}
```

### Customization Strategy

**What We Customize:**

- Theme colors to match status hierarchy
- Badge variants for DevPod states (done, running, needs-input, stale, idle)
- Table cell renderers for custom row composition

**What We Use As-Is:**

- Sparkline rendering and gradients
- ProgressBar mechanics
- Spinner animations
- Alert/StatusMessage styling
- Table layout engine

**Principle:** Customize styling, not behavior. Trust library defaults for interaction patterns.

## Defining Experience

### The Core Interaction

**"Open → See what needs attention → Know exactly what to do"**

The BMAD Orchestrator defining experience in one sentence:
> "It's a dashboard that shows me all my DevPods and tells me what to do next."

This is what users will describe to others. If we nail this, everything else follows.

### User Mental Model

**Current workflow (without dashboard):**
- Open VS Code for each DevPod
- Run `/workflow-status` in each
- Mentally aggregate state across windows
- Decide which needs attention first
- Figure out the right command

**Pain points addressed:**
- Context switching between windows → Single unified view
- Holding state in your head → Dashboard maintains the picture
- Forgetting which had the issue → Spatial consistency aids memory
- Figuring out commands → Ready to copy, no assembly

### Spatial Consistency Principle

A key differentiator: DevPods maintain stable positions in the grid.

| Pattern | Benefit |
|---------|---------|
| **Stable positioning** | DevPods stay in same row/order across refreshes |
| **Visual identity** | Name + purpose visible = instant recognition |
| **Muscle memory** | "j j Enter" always gets to the same DevPod |
| **Recognition over recall** | Brain remembers location, not labels |

**Implementation rules:**
- Sort order is deterministic (not by status)
- Position never jumps on status change
- Selection persists across refreshes

### Success Criteria

| Criteria | Target |
|----------|--------|
| **Time to clarity** | < 2 seconds from open to knowing state |
| **Mental aggregation** | Zero - dashboard does the thinking |
| **Problem recognition** | Instant - visual distinction without reading |
| **Action readiness** | Command visible, copy-paste, done |
| **Exit confidence** | "I handled what needed handling" |

### Pattern Analysis

**Established patterns adopted:**
- Status grid layout (top, htop)
- j/k keyboard navigation (vim, lazygit)
- Detail drill-down (k9s)
- Copy-paste command suggestions (gh CLI)

**Our innovation layer:**
- "Next Action" intelligence - surfaces what to do, not just status
- Needs-input visibility - shows Claude's actual question
- Spatial consistency - positions aid memory

**Result:** Familiar mechanics + smart suggestions = immediate value, no learning curve.

### Experience Mechanics

**1. Initiation**
- Run `bmad-orchestrator` from any terminal
- Brief discovery phase: "Scanning DevPods..." with spinner
- Grid renders once discovery completes (target: < 2 seconds)
- Auto-refresh maintains freshness from then on
- No cached state needed - persistent dashboard means one-time startup cost

**2. Scanning (Core Moment)**
- Eyes scan familiar positions (DevPods in stable locations)
- Status indicators draw attention (green fades, yellow/red pops)
- Pattern matching: "middle one is yellow - that's the API work"
- Recognition without reading for familiar DevPods

**3. Selection & Detail**
- j/k moves selection highlight through grid
- Selected pane displays contextual command in command bar
- Enter drills into detail view for full context (see Detail View below)
- Esc returns to grid view

**Detail View (MVP):**
- Full question text (untruncated)
- Session ID for resume commands
- Task progress (e.g., "3/7 tasks completed")
- Last completed task name
- Copy-paste command for SSH/resume

**Detail View (Phase 2 - deferred):**
- Answer input field for quick responses
- Interactive Mode button (tmux attach)

**4. Action**
- Copy command shown for selected DevPod
- Paste into separate terminal
- Return to dashboard - observe status update
- Confidence: "I handled it"

**5. Exit**
- q quits dashboard
- Or leave running - glance back anytime

## Visual Design Foundation

### Color System

**Semantic Color Mapping (Terminal ANSI Colors):**

| Semantic Use | Terminal Color | Meaning |
|--------------|----------------|---------|
| **Success/Done** | Green | Completed, healthy |
| **Active/Running** | Blue or Cyan | In progress, working |
| **Warning/Attention** | Yellow | Needs input, idle |
| **Error/Stale** | Red | Problem, action required |
| **Neutral/Info** | Default/White | Normal text |
| **Dimmed** | Gray/Dim | Secondary info, timestamps |

**Status Indicator Symbols:**

| Symbol | Status | Color |
|--------|--------|-------|
| ✓ | Done/Complete | Green |
| ● | Running/Active | Blue |
| ○ | Idle/Pending | Gray |
| ⏸ | Needs Input | Yellow |
| ✗ | Error/Failed | Red |
| ⚠ | Stale/Warning | Yellow |

**Principle:** Symbols + color together. Never rely on color alone for meaning.

### Typography System

Terminal constraints define typography - no font choice, only text styling:

| Aspect | Value | Usage |
|--------|-------|-------|
| **Font** | User's terminal monospace | Fixed, not configurable |
| **Bold** | `<Text bold>` | Labels, emphasis, keybindings |
| **Normal** | `<Text>` | Values, content |
| **Dim** | `<Text dimColor>` | Timestamps, secondary info |
| **Color** | ANSI semantic colors | Status indicators |

**Hierarchy Through Styling:**
- **Primary:** Bold + color for status and labels
- **Secondary:** Normal weight for values
- **Tertiary:** Dim for timestamps and hints

### Spacing & Layout Foundation

**Spacing Units (Character-Based):**

| Element | Spacing | Rationale |
|---------|---------|-----------|
| **Row padding** | 1 character horizontal | Breathing room without waste |
| **Section gaps** | 1 empty line | Visual grouping |
| **Column alignment** | Fixed widths per column | Spatial consistency |
| **Border style** | Single line box drawing | Clean, not heavy |

**Layout Zones:**

```
┌─────────────────────────────────────────────────┐
│  Header: Project name, refresh indicator        │
├─────────────────────────────────────────────────┤
│  Main Grid: DevPod panes (bulk of screen)       │
│    [selected pane highlighted]                  │
│                                                 │
├─────────────────────────────────────────────────┤
│  Command Bar: Copy-paste command for selection  │
├─────────────────────────────────────────────────┤
│  Backlog Bar: Story count summary               │
├─────────────────────────────────────────────────┤
│  Footer: Keybindings (j/k Enter b q)            │
└─────────────────────────────────────────────────┘
```

**Zone Purposes:**

| Zone | Content | Behavior |
|------|---------|----------|
| **Header** | Project name, last refresh time | Static, always visible |
| **Main Grid** | DevPod panes with status | Scrollable if > screen height |
| **Command Bar** | Command for selected DevPod | Updates on selection change |
| **Backlog Bar** | Story count + summary | Static; `b` opens full overlay |
| **Footer** | Available keybindings | Static, always visible |

**Backlog Bar Example:**
```
│  Backlog: 3 stories ready │ 1-4-tests, 2-3-validation, 2-4-integration    │
```

**Backlog Overlay (triggered by `b` key):**

```
┌─ Backlog ─────────────────────────────────────────────────────────────────┐
│                                                                            │
│  Ready to assign (3 stories):                                              │
│                                                                            │
│  │ ID              │ Epic                │ Title                         │ │
│  ├─────────────────┼─────────────────────┼───────────────────────────────┤ │
│  │ 1-4-tests       │ Epic 1: Core        │ Add unit test coverage        │ │
│  │ 2-3-validation  │ Epic 2: Auth        │ Input validation layer        │ │
│  │ 2-4-integration │ Epic 2: Auth        │ OAuth integration             │ │
│                                                                            │
│  Press Esc to close                                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

The overlay provides full detail on demand while the footer bar maintains ambient awareness of queue depth.

### Accessibility Considerations

| Consideration | Approach |
|---------------|----------|
| **Color-only information** | Never - symbols always accompany color |
| **Contrast** | Use terminal defaults + bold for emphasis |
| **No-color terminals** | Symbols remain fully meaningful |
| **Keyboard-only** | Full functionality via j/k/Enter/Esc/q |
| **Screen readers** | Limited TUI support, but text-based output is parseable |

**Graceful Degradation:**
- With color: Full visual experience
- Without color: Symbols + bold convey all status information
- Reduced terminal: Fixed-width columns maintain alignment

## Design Direction

### Design Directions Explored

Three layout directions were evaluated:

| Direction | Concept | Tradeoffs |
|-----------|---------|-----------|
| **A: Minimal Table** | Dense rows, maximum DevPods visible | Less context, no room for questions |
| **B: Card-Style Rows** | More context per row, progress visible | Vertical space, still cramped for questions |
| **C: Terminal Panes** | 2x2 grid, each DevPod as mini-terminal | Requires wide terminal, but generous space |

### Chosen Direction: Terminal Panes (C)

**Concept:** Each DevPod is a self-contained pane within a grid layout, like tmux panes or dashboard cards. Not a compact table - a purpose-built terminal for each workstream.

**Layout:**

```
┌─ BMAD Orchestrator ──────────────────────────────────────────── ↻ 5s ago ─┐
│                                                                            │
│  ┌─ api-service ─────────────────────┐  ┌─ web-frontend ─────────────────┐ │
│  │  ● RUNNING                 2m ago │  │  ✓ DONE               15m ago │ │
│  │                                   │  │                                │ │
│  │  Epic 2: Authentication           │  │  Epic 1: Core UI               │ │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░ 60%        │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%     │ │
│  │                                   │  │                                │ │
│  │  → STORY-12: Add OAuth            │  │  → STORY-08: Navigation        │ │
│  │    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 71%      │  │    Complete                    │ │
│  │                                   │  │                                │ │
│  └───────────────────────────────────┘  └────────────────────────────────┘ │
│                                                                            │
│  ╔═ data-pipeline ═══════════════════╗  ┌─ ml-service ───────────────────┐ │
│  ║  ⏸ NEEDS INPUT             8m ago ║  │  ○ IDLE                 1h ago │ │
│  ║                                   ║  │                                │ │
│  ║  Epic 3: Data Layer               ║  │  Epic 4: ML Pipeline           │ │
│  ║  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ 50%        ║  │  ░░░░░░░░░░░░░░░░░░░░ 0%       │ │
│  ║                                   ║  │                                │ │
│  ║  → STORY-15: ETL optimization     ║  │  No story assigned             │ │
│  ║                                   ║  │                                │ │
│  ║  ╭─ Claude is asking ───────────╮ ║  │  Suggested: STORY-18           │ │
│  ║  │ I need to configure the DB   │ ║  │  Model training pipeline       │ │
│  ║  │ connection. Should we use:   │ ║  │                                │ │
│  ║  │                              │ ║  │                                │ │
│  ║  │ 1. pg (PostgreSQL native)    │ ║  │                                │ │
│  ║  │ 2. mysql2 (MySQL driver)     │ ║  │                                │ │
│  ║  ╰──────────────────────────────╯ ║  │                                │ │
│  ╚═══════════════════════════════════╝  └────────────────────────────────┘ │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  ▸ data-pipeline selected                                                  │
│  devpod ssh data-pipeline                                                  │
├────────────────────────────────────────────────────────────────────────────┤
│  j/k: select   Enter: terminal   r: respond   c: copy   q: quit           │
└────────────────────────────────────────────────────────────────────────────┘
```

*Note: Needs-input pane (data-pipeline) uses double-line border to visually "scream" for attention.*

### Design Rationale

| Decision | Rationale |
|----------|-----------|
| **2x2 pane grid** | 6-8 DevPods max; vertical space available |
| **Generous card sizing** | Each DevPod is a "purpose-built terminal" |
| **Epic + Story progress** | Epic progress is valuable context |
| **Inline Claude questions** | Full multi-line questions need real space |
| **Heavy box borders** | Clear visual structure and separation |
| **Suggested stories for idle** | Reduce decision-making for dispatch |
| **Wide terminal assumption** | 120+ columns; optimize for real usage |

### Attention Hierarchy

Problems should scream. Healthy states should whisper.

| Status | Visual Treatment | Attention Level |
|--------|------------------|-----------------|
| **Needs Input** | Double-line border (═), yellow/orange color | LOUD - demands attention |
| **Stale/Error** | Red border or background tint | LOUD - problem state |
| **Running** | Normal border, blue status indicator | Medium - active but fine |
| **Done** | Dimmed/muted appearance | Quiet - no action needed |
| **Idle** | Dimmed, shows suggestion | Quiet - optional action |

### Selection Feedback

Selected pane must be instantly recognizable:

| Element | Behavior |
|---------|----------|
| **Border** | Highlighted/inverted or thicker weight |
| **Header bar** | Inverted colors (dark bg, light text) |
| **Background** | Subtle tint if terminal supports |
| **Command bar** | Updates to show selected DevPod's command |

### Grid Navigation

j/k navigation in 2x2 grid:

```
  [1] [2]     j = next (1→2→3→4→1)
  [3] [4]     k = prev (1→4→3→2→1)
```

- Linear traversal: left-to-right, top-to-bottom
- Wraps at edges
- Simple mental model: j = forward, k = backward

### Responsive Behavior

| Terminal Width | Layout |
|----------------|--------|
| **≥120 cols** | 2-column grid |
| **80-119 cols** | 1-column stack |
| **<80 cols** | Graceful degradation (compact mode) |

Use Ink's `useStdoutDimensions()` to detect and adapt.

### Component Architecture

```
<Dashboard>
  <Header />                    // Title + refresh indicator
  <PaneGrid>                    // Dumb grid layout
    <DevPodPane pod={pod1} />   // Owns all pane complexity
    <DevPodPane pod={pod2} />
    ...
  </PaneGrid>
  <CommandBar />                // Selected DevPod's command
  <KeyHints />                  // Footer keybindings
</Dashboard>
```

**Grid Layout:**
- `<Box flexDirection="row" flexWrap="wrap">`
- Each pane has fixed equal width
- Internal scroll if content overflows

**Pane Contents:**
- Header: DevPod name + status badge + timestamp
- Epic row: Name + progress bar + percentage
- Story row: Name + progress bar (indented)
- Content area: Question (if needs-input), suggestion (if idle), or empty

**Prototype Early:**
- Nested borders (question box inside pane box) need testing
- Unicode box-drawing alignment can be tricky in Ink

## User Journey Flows

### Journey 1: Morning Orchestration

**Goal:** Open dashboard → understand state of all work → take action within 30 seconds

**Entry Point:** User runs `bmad-orchestrator` from terminal

**Flow:**

1. User runs `bmad-orchestrator`
2. "Scanning DevPods..." spinner (1-2 sec)
3. DevPods found? → Grid renders / No → Empty state
4. Eyes scan familiar positions
5. Attention drawn to problem panes (needs-input, stale)
6. Navigate with j/k, act with Enter/r/c

**Success Criteria:**
- < 2 seconds from command to full render
- Problem panes visually identifiable without reading
- Action taken within 30 seconds of opening

### Journey 2: Needs-Input Resolution

**Goal:** See Claude's question → provide answer → work resumes

**Entry Point:** Dashboard shows pane with ⏸ NEEDS INPUT status

**Flow:**

1. Dashboard shows NEEDS INPUT pane (double border, yellow)
2. Question visible inline in pane
3. Navigate to pane with j/k
4. Press 'r' to respond
5. Command copied to clipboard
6. User opens separate terminal, pastes SSH command
7. Find Claude session, provide response
8. Dashboard auto-refreshes, pane updates to RUNNING

**Terminal Handoff Strategy:** Dashboard stays running, command copied to clipboard, user opens their own terminal. Simpler, cross-platform.

**Success Criteria:**
- Question visible without opening terminal
- Single keypress copies command to clipboard
- Dashboard reflects status change via auto-refresh

### Journey 3: Idle Worker Dispatch

**Goal:** Assign next story to idle DevPod

**Flow:**

1. Dashboard shows IDLE pane (dimmed, ○ indicator)
2. Suggested story visible in pane
3. Navigate to pane with j/k
4. Press Enter - command copied to clipboard
5. Open terminal, paste, run
6. Work begins, dashboard auto-updates to RUNNING

**Success Criteria:**
- Suggested story visible without action
- Clear path to accept or choose different story
- Dashboard reflects new assignment via auto-refresh

### Journey 4: Stale Worker Recovery

**Goal:** Detect and recover stuck/dead workers

**Flow:**

1. Dashboard shows STALE pane (red border, ⚠ indicator)
2. "No heartbeat for X minutes" visible
3. Navigate to pane with j/k
4. Press Enter - SSH command copied
5. Open terminal, paste, investigate
6. Restart session / fix issue / update state
7. Dashboard auto-updates

**Success Criteria:**
- Stale state clearly distinguished from needs-input
- Time since last heartbeat visible
- Recovery path is SSH into DevPod

### Journey 5: Empty State (First Time)

**Goal:** Guide new users when no DevPods exist

**Display:**

```
┌─ BMAD Orchestrator ──────────────────────────────────────────┐
│                                                               │
│                    No DevPods detected.                       │
│                                                               │
│              To get started with BMAD Orchestrator:           │
│                                                               │
│              1. Create a DevPod:                              │
│                 devpod up <repository-url>                    │
│                                                               │
│              2. Dashboard will auto-refresh                   │
│                 when DevPods are available                    │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  q: quit   R: manual refresh                                  │
└───────────────────────────────────────────────────────────────┘
```

**Success Criteria:**
- Clear guidance for new users
- No confusing empty grid
- Auto-refresh detects new DevPods

### Keyboard Mapping

Contextual keys avoid conflicts:

| Key | Context | Action |
|-----|---------|--------|
| j/k | Always | Navigate between panes |
| Enter | Any pane | Copy SSH command to clipboard |
| r | Needs-input pane | Copy SSH command (semantic alias for respond) |
| c | Any pane | Copy command to clipboard |
| b | Always | Open backlog overlay |
| R | Always | Manual refresh (Shift+R) |
| q | Always | Quit dashboard |
| Esc | Detail view / Overlay | Return to grid / Close overlay |

**Note:** 'r' is contextual - on needs-input pane it means "respond", elsewhere no action. 'R' (shift) is global refresh. 'b' opens the backlog overlay showing all unassigned stories.

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Multiple needs-input** | All show double border; user chooses which to address first |
| **Wrong story suggestion** | Enter opens terminal; user runs different command |
| **SSH/network failure** | Dashboard shows connection error in pane |
| **DevPod offline** | Pane shows "Unreachable" status with last known state |

### Journey Patterns

**Scan → Select → Act**

All journeys follow this pattern:
1. **Scan:** Eyes find target pane (visual hierarchy guides attention)
2. **Select:** j/k navigation highlights pane
3. **Act:** Single key triggers action (r, Enter, c, q)

**Problem Panes Scream**

Visual hierarchy ensures problems are noticed first:
- Needs Input: Double border, yellow
- Stale/Error: Red indicators
- Running: Normal, blue
- Done/Idle: Dimmed, muted

**Clipboard-Based Handoff**

Dashboard never spawns terminals. It:
1. Copies command to clipboard
2. User opens their own terminal
3. Dashboard stays running, auto-refreshes

This is simpler, cross-platform, and keeps dashboard persistent.

### Flow Optimization Principles

1. **Minimize Steps to Value** - Every journey completes in 3-5 keystrokes
2. **No Dead Ends** - Every state has a clear next action
3. **Progressive Disclosure** - Summary visible, details on demand
4. **Error Prevention** - Visual hierarchy prevents selecting wrong pane
5. **Recovery Path** - Esc returns to grid, q quits, problems are visible
6. **Empty State Guidance** - New users aren't lost

### Acceptance Criteria

**Morning Orchestration:**
- [ ] Dashboard renders within 2 seconds
- [ ] Problem panes visually distinct without reading text
- [ ] User can take action within 30 seconds

**Needs-Input Resolution:**
- [ ] Question visible in pane without extra navigation
- [ ] Single keypress copies command to clipboard
- [ ] Status updates after response provided (via auto-refresh)

**Idle Worker Dispatch:**
- [ ] Suggested story visible in idle pane
- [ ] Enter copies SSH command for that DevPod

**Stale Recovery:**
- [ ] Stale panes show red border and time since heartbeat
- [ ] Enter copies SSH command to investigate

**Empty State:**
- [ ] Helpful message when no DevPods exist
- [ ] Auto-refresh detects new DevPods

## Component Strategy

### Design System Components

**From @inkjs/ui:**

| Component | Usage in Orchestrator |
|-----------|-------------------|
| `Badge` | Status indicators (✓ ● ○ ⏸ ✗ ⚠) |
| `ProgressBar` | Epic and story progress |
| `Spinner` | Loading state during discovery |
| `StatusMessage` | Alerts and status feedback |

**From ink-chart:**

| Component | Usage in Orchestrator |
|-----------|-------------------|
| `Sparkline` | Optional enhancement (defer until needed) |

**From Ink core:**

| Component | Usage in Orchestrator |
|-----------|-------------------|
| `Box` | All layout (flexbox) |
| `Text` | All text rendering |
| `Spacer` | Flexible spacing |

### Custom Components

**Only ONE custom component needed:**

#### DevPodPane

**Purpose:** Pure display component rendering a single DevPod as a self-contained pane. No internal logic - receives all data via props.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `pod` | DevPod | DevPod data object |
| `selected` | boolean | Whether this pane is currently selected |
| `width` | number | Pane width (for responsive layout) |

**Design Principle:** DevPodPane is pure display. All keyboard handling and actions live in Orchestrator. This keeps the component simple and testable.

**States:**

| State | Border | Color | Content |
|-------|--------|-------|---------|
| Running | Single | Blue | Progress only |
| Done | Single (dimmed) | Green | "Complete" |
| Needs Input | Double | Yellow | Question box |
| Stale | Single | Red | "No heartbeat" |
| Idle | Single (dimmed) | Gray | Suggested story |
| Selected | Highlighted | - | Any above + highlight |

### Custom Hook

#### useDevPods

**Purpose:** Encapsulates all DevPod state management and keyboard navigation.

```tsx
const {
  devPods,           // DevPod[]
  selectedIndex,     // number
  isLoading,         // boolean
  lastRefresh,       // Date
  selectNext,        // () => void
  selectPrev,        // () => void
  refresh,           // () => Promise<void>
  copyCommand,       // () => void
} = useDevPods()
```

**Benefits:**
- Dashboard component stays clean
- Logic is testable separately from UI
- Easy to mock for component tests

### Pure Utility Functions

Extract testable pure functions:

```tsx
// src/utils/status.ts
function deriveStatus(pod: DevPod): PodStatus { ... }
function isStale(lastHeartbeat: Date, thresholdMs: number): boolean { ... }

// src/utils/format.ts
function formatTimeAgo(date: Date): string { ... }
function formatProgress(completed: number, total: number): number { ... }
```

### Project Structure

```
src/
  components/
    Dashboard.tsx       # Main screen, inline patterns
    DevPodPane.tsx      # The ONE custom component
  hooks/
    useDevPods.ts       # State management + keyboard
  services/
    discovery.ts        # DevPod scanning logic
  utils/
    status.ts           # Status derivation
    format.ts           # Formatting helpers
  types/
    devpod.ts           # Type definitions
```

### Inline Patterns (Not Components)

Everything else is inline JSX in `<Dashboard>`:

| Pattern | Implementation |
|---------|---------------|
| **Header** | `<Box><Text bold>BMAD</Text><Spacer/><Timestamp/></Box>` |
| **PaneGrid** | `<Box flexDirection="row" flexWrap="wrap">{panes}</Box>` |
| **CommandBar** | `<Box borderStyle="single"><Text>{command}</Text></Box>` |
| **KeyHints** | `<Box><Text>j/k: select</Text><Spacer/>...</Box>` |
| **EmptyState** | Conditional render when `devPods.length === 0` |

### Testing Strategy

**DevPodPane Snapshots:**

| Test | What It Captures |
|------|------------------|
| `running.snap` | Running state appearance |
| `done.snap` | Completed state (dimmed) |
| `needs-input.snap` | Double border + question |
| `stale.snap` | Red border + warning |
| `idle.snap` | Dimmed + suggestion |
| `selected.snap` | Highlight treatment |

**Pure Function Unit Tests:**
- `deriveStatus()` - all status conditions
- `isStale()` - threshold edge cases
- `formatTimeAgo()` - various time ranges

**Integration Tests:**
- Dashboard with mock devPods
- Simulate j/k/Enter keys
- Assert selection changes, clipboard calls

### Implementation Roadmap

**Phase 1: MVP (Core Experience)**
- [ ] Dashboard shell with layout and keyboard handling
- [ ] DevPodPane component (all 5 states)
- [ ] useDevPods hook with discovery integration
- [ ] Auto-refresh (core, not polish)
- [ ] Clipboard integration via `clipboardy`

**Phase 2: Enhancement (If Needed)**
- [ ] Responsive breakpoint (2-col → 1-col) - defer until needed
- [ ] Detail view on Enter
- [ ] Sparkline progress visualization
- [ ] Notification on state change

**Principle:** Build MVP with auto-refresh and clipboard as core features. Defer enhancements until real need emerges.

## UX Consistency Patterns

### Keyboard Action Hierarchy

**Primary Actions** (high frequency, immediate effect):

| Key | Action | Context | Feedback |
|-----|--------|---------|----------|
| `Enter` | Execute primary action | Selected pane | Copies command, shows confirmation |
| `j/k` | Navigate up/down | Always | Immediate visual highlight |
| `h/l` | Navigate left/right | Always | Immediate visual highlight |
| `q` | Exit dashboard | Always | Clean exit, no confirmation |

**Secondary Actions** (contextual, requires thought):

| Key | Action | Context | Feedback |
|-----|--------|---------|----------|
| `r` | Respond to input | Needs-Input selected | Opens response flow |
| `c` | Copy command | Any selected | "Copied!" flash message |

**Tertiary Actions** (infrequent, global):

| Key | Action | Context | Feedback |
|-----|--------|---------|----------|
| `b` | Open backlog | Always | Backlog overlay appears |
| `R` | Force refresh | Always | Spinner, "Refreshing..." |
| `?` | Show help | Always | Help overlay |

**Pattern Rules:**
- Single lowercase letter = contextual action
- Uppercase/Shift = global action
- Enter = always the primary action for selection
- No modifier key combinations (Ctrl+, Alt+) - keep simple
- h/l navigation included from start (vim-complete directional movement)

**Key Discoverability:**
- Footer always shows: `j/k: navigate  Enter: open  b: backlog  c: copy  ?: help  q: quit`
- Contextual keys highlighted when applicable (e.g., `r` only shown when Needs-Input selected)

### Feedback Patterns

**Success Feedback:**
- Duration: 3 seconds, then fade (extended for users who look away)
- Symbol: `✓` in green
- Example: "✓ Copied to clipboard"
- Position: Command preview zone (bottom)

**Error Feedback:**
- Duration: Persistent until dismissed or resolved
- Symbol: `✗` in red
- Example: "✗ DevPod unreachable: api-service"
- Position: Inline in affected pane OR status bar

**Warning Feedback:**
- Duration: Persistent, attention-seeking
- Symbol: `⚠` in yellow
- Example: Stale indicator `⚠ 15m` in pane header
- Position: Inline where relevant

**Info Feedback:**
- Duration: Transient (3 seconds)
- Symbol: `ℹ` in dim
- Example: "ℹ Auto-refreshing every 30s"
- Position: Status bar

**Feedback Priority (highest to lowest):**
1. Errors in active pane
2. Warnings (stale, needs-input)
3. Success confirmations
4. Informational messages

### Error Recovery Flows

When actions fail, users need clear recovery paths - not just error display.

| Error Scenario | Display | Recovery Pattern |
|----------------|---------|------------------|
| **Clipboard fail** | "✗ Clipboard unavailable" | Show command inline: "Copy manually: `devpod ssh ...`" |
| **DevPod unreachable** | "✗ Unreachable" in pane | Mark stale, show "R to retry" hint |
| **Discovery timeout** | "⚠ Partial results" | Show found DevPods + "R to retry discovery" |
| **SSH command fails** | N/A (external) | Dashboard shows last known state until next refresh |

**Recovery Principle:** Every error state has a visible next action. Users never hit a dead end.

### Navigation Patterns

**Selection Model:**
- Single selection only (one pane at a time)
- Wrap-around: bottom → top, right → left
- Selection persists across refreshes (by DevPod name, not index)
- **Graceful fallback:** If selected DevPod disappears, auto-select first needs-input if exists, else first pane
- Initial selection: first needs-input if exists, else first pane

**Visual Selection Indicators:**
```
Unselected:  ┌─ name ───────┐     (single line, dim)
Selected:    ╔═ name ═══════╗     (double line, bright)
```

**Navigation Grid Logic (full vim movement):**
```
[0] [1]     j = down (0→2, 1→3)
[2] [3]     k = up (2→0, 3→1)
            h = left (1→0, 3→2)
            l = right (0→1, 2→3)
```

**Scroll Behavior:**
- If more than 4 DevPods: vertical scroll within grid
- Selected pane always visible
- Scroll indicator: `▲ 2 more` / `▼ 1 more`

### State Display Patterns

**Consistency Rule:** Same state = same visual treatment everywhere.

**Single Source of Truth - STATE_CONFIG:**
```typescript
// src/patterns/state-config.ts
export const STATE_CONFIG = {
  running: { symbol: '●', color: 'cyan', border: 'single', intensity: 'normal' },
  done: { symbol: '✓', color: 'green', border: 'single', intensity: 'dim' },
  needsInput: { symbol: '⏸', color: 'yellow', border: 'double', intensity: 'bright' },
  stale: { symbol: '⚠', color: 'yellow', border: 'single', intensity: 'warning' },
  idle: { symbol: '○', color: 'dim', border: 'single', intensity: 'subtle' },
  error: { symbol: '✗', color: 'red', border: 'double', intensity: 'attention' },
} as const;
```

| State | Symbol | Color | Border | Intensity |
|-------|--------|-------|--------|-----------|
| Running | `●` | cyan | single | normal |
| Done | `✓` | green | single | dim |
| Needs Input | `⏸` | yellow | double | bright |
| Stale | `⚠` | yellow | single | warning |
| Idle | `○` | dim | single | subtle |
| Error | `✗` | red | double | attention |

**State Transition Animation:**
- No animation - instant state change
- Rationale: Terminal refresh is already instant; animation adds complexity

**State Priority for Attention:**
1. Needs Input (action required)
2. Error (problem to address)
3. Stale (may need refresh)
4. Running (in progress)
5. Done (completed)
6. Idle (awaiting assignment)

**Testing Strategy:**
- Each row in state table = one test case
- Snapshot tests for visual verification
- No animation frame testing (fragile)

### Loading & Transition Patterns

**Initial Load:**
```
┌─ BMAD Orchestrator ──────────────────────────────┐
│                                                  │
│              ⠋ Discovering DevPods...            │
│                                                  │
└──────────────────────────────────────────────────┘
```
- Spinner: Braille dots animation (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏)
- Message: "Discovering DevPods..."
- Duration: Until first discovery completes
- **Note:** Validate @inkjs/ui Spinner supports Braille type; implement custom if needed

**Refresh In Progress:**
- Status bar shows: `↻ Refreshing...`
- Panes remain visible with current data
- No blocking overlay
- On complete: timestamp updates, spinner disappears

**No Blocking Patterns:**
- Never block entire UI for single-pane operations
- Refresh happens in background
- Only initial load shows full-screen spinner

### Empty State Patterns

**No DevPods Found (BMAD-aware guidance):**
```
┌─ BMAD Orchestrator ──────────────────────────────┐
│                                                  │
│           No DevPods discovered                  │
│                                                  │
│     Get started:                                 │
│     • Run /dev-story in a DevPod session         │
│     • Or: devpod up <workspace>                  │
│                                                  │
│     Press R to refresh, q to quit                │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Pattern Elements:**
- Centered vertically and horizontally
- Clear message (what's wrong)
- **BMAD-contextual guidance** (users arrive via BMAD workflows)
- Available actions (what you can do now)
- Implemented as reusable inline pattern, not conditional blob

**Partial Empty States:**
- If grid has fewer than 4 DevPods, empty slots show nothing (no placeholder boxes)
- Grid adjusts: 1 pod = full width, 2 pods = side by side, 3+ = 2x2 grid

**Testing Edge Cases:**
- 0 pods (empty state)
- 1 pod (full width)
- 4 pods (full grid)
- 5+ pods (scroll behavior)

### Pattern Architecture

**Directory Structure:**
```
src/
  patterns/
    state-config.ts     # STATE_CONFIG - single source of truth
    feedback.ts         # Feedback timing, colors, positions
    keyboard.ts         # Key bindings and action mappings
    layout.ts           # Grid calculations, responsive rules
  components/
    DevPodPane.tsx      # Consumes patterns, never defines
  hooks/
    useDevPods.ts       # Uses keyboard patterns
```

**Consumption Rule:** Components import from `patterns/`, never duplicate values.

### Design System Integration

**@inkjs/ui Components:**

| Pattern | Component | Customization |
|---------|-----------|---------------|
| Loading spinner | `<Spinner>` | Validate Braille dots support |
| Success message | `<StatusMessage variant="success">` | 3s auto-dismiss |
| Error message | `<StatusMessage variant="error">` | Persistent |
| Progress bar | `<ProgressBar>` | Epic progress display |

**ink-chart Components:**

| Pattern | Component | Usage |
|---------|-----------|-------|
| Activity trend | `<Sparkline>` | Optional future enhancement |

**ink-table Components:**

| Pattern | Component | Usage |
|---------|-----------|-------|
| Structured data | `<Table>` | Help overlay, debug info |

**Custom Pattern Implementation:**
- All patterns implemented within DevPodPane component
- Patterns directory exports constants, components consume
- State-to-visual mapping via STATE_CONFIG

## Responsive Design & Accessibility

### TUI Responsive Strategy

**Terminal Dimensions (not pixels):**

BMAD Orchestrator adapts based on terminal column width, detected via Ink's `useStdoutDimensions()`:

| Terminal Width | Layout | Behavior |
|----------------|--------|----------|
| **≥120 columns** | 2-column grid | Full Terminal Panes experience |
| **80-119 columns** | 1-column stack | Panes stack vertically, still generous |
| **<80 columns** | Compact mode | Reduced pane content, essentials only |

**Vertical Space:**

| Terminal Height | Behavior |
|-----------------|----------|
| **≥24 rows** | Full pane content with question display |
| **<24 rows** | Truncate question preview, scroll available |

**Responsive Implementation:**

```tsx
const { columns, rows } = useStdoutDimensions()
const layout = columns >= 120 ? 'grid' : columns >= 80 ? 'stack' : 'compact'
```

### Graceful Degradation

| Scenario | Degradation |
|----------|-------------|
| **Narrow terminal** | 1-column stacked panes |
| **Very narrow (<80)** | Compact mode: status + name only per pane |
| **Short terminal** | Scroll within panes, question truncated |
| **No color support** | Symbols alone convey status (already designed) |
| **No Unicode support** | Fallback ASCII: [OK] [RUN] [?] [!] |

### TUI Accessibility Strategy

**Core Principle:** Never rely on color alone. Every visual distinction has a non-color signal.

**Color Independence:**

| Status | Color | Symbol | Text | Color-blind safe? |
|--------|-------|--------|------|-------------------|
| Running | Cyan | ● | "RUNNING" | ✓ Symbol + text |
| Done | Green | ✓ | "DONE" | ✓ Symbol + text |
| Needs Input | Yellow | ⏸ | "NEEDS INPUT" | ✓ Symbol + text |
| Stale | Yellow | ⚠ | "STALE" | ✓ Symbol + text |
| Idle | Gray | ○ | "IDLE" | ✓ Symbol + text |
| Error | Red | ✗ | "ERROR" | ✓ Symbol + text |

**Keyboard-Only Operation:**

All functionality accessible via keyboard (no mouse required):

| Action | Keys | Notes |
|--------|------|-------|
| Navigate | j/k/h/l | Vim-style, intuitive for terminal users |
| Primary action | Enter | Universal "do the thing" |
| Copy | c | Mnemonic |
| Respond | r | Contextual, only on needs-input |
| Refresh | R | Shift distinguishes from 'r' |
| Help | ? | Standard |
| Quit | q | Standard |

**Text-Based Output Benefits:**

TUI applications are inherently more accessible to screen readers than GUIs because:
- All content is text (screen readers can read terminal output)
- Linear information flow
- No hidden interactive elements
- Predictable keyboard navigation

**Limitations Acknowledged:**
- Screen reader support varies by terminal emulator
- Complex box-drawing may not announce well
- Recommendation: Provide `--plain` flag for simplified output if needed in future

### Testing Strategy

**Terminal Compatibility Testing:**

| Test | Method |
|------|--------|
| **Column widths** | Resize terminal, verify layout adapts |
| **Minimum viable** | Test at 80×24 (standard minimum) |
| **No color mode** | `NO_COLOR=1` or `TERM=dumb` |
| **Different terminals** | iTerm2, Terminal.app, Alacritty, Windows Terminal |

**Keyboard Testing:**

| Test | Expected |
|------|----------|
| Tab through all actions | All reachable without mouse |
| Unknown keys | Ignored gracefully, no crash |
| Rapid key repeat | Debounced, responsive |
| Escape key | Returns to grid from any state |

**Accessibility Testing:**

| Test | Method |
|------|----------|
| **Color blindness** | Verify symbols alone convey status |
| **Screen reader** | VoiceOver on macOS terminal |
| **High contrast** | User's terminal theme respected |

**Automated Testing:**

- Snapshot tests at different column widths
- Unit tests for layout breakpoint logic
- Integration tests for keyboard navigation

### Implementation Guidelines

**Responsive Development:**

```tsx
// Use hook for dimensions
const { columns } = useStdoutDimensions()

// Calculate layout based on columns
const paneWidth = columns >= 120
  ? Math.floor((columns - 4) / 2)  // 2-column
  : columns - 2                      // 1-column

// Pass width to panes for internal layout
<DevPodPane width={paneWidth} />
```

**Accessibility Development:**

1. **Symbol + Color + Text** - Triple redundancy for status
2. **Consistent key bindings** - Same keys work everywhere
3. **No modal traps** - Esc always returns to grid
4. **Visible feedback** - Every action has visual confirmation
5. **Respect terminal settings** - Use user's color theme

**Environment Variable Support:**

| Variable | Effect |
|----------|--------|
| `NO_COLOR` | Disable colors, symbols only |
| `FORCE_COLOR` | Force colors even in pipe |
| `TERM=dumb` | Minimal output mode |

**Future Accessibility Enhancements (defer):**

- `--plain` flag for simplified screen reader output
- `--no-unicode` flag for ASCII-only symbols
- Announcer pattern for status changes (if demand exists)
