# Autopilot Integration Architecture

**Date:** 2026-01-08
**Status:** Research / Future Consideration
**Phase:** Phase 3+ (Autonomous Execution)
**Source:** https://github.com/hanibalsk/autopilot

## Executive Summary

This document sketches an integration architecture for incorporating the Autopilot tool as one possible execution engine option within DevPods. Autopilot provides autonomous epic-to-merge workflow execution that aligns with BMAD Orchestrator's Phase 3+ vision.

**Key Insight:** Autopilot is an *executor* (runs inside DevPod), while BMAD Orchestrator is an *orchestrator* (runs on host). They're complementary layers, not competing solutions.

---

## Integration Model

### Two-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BMAD Orchestrator (Host)                            │
│                                                                             │
│  Responsibilities:                                                          │
│  ├─ Cross-DevPod visibility                                                 │
│  ├─ Next-action determination                                               │
│  ├─ Dispatch commands (to any execution engine)                             │
│  ├─ Progress aggregation                                                    │
│  └─ Human-in-the-loop intervention points                                   │
│                                                                             │
│  Data Sources (reads from each DevPod):                                     │
│  ├─ sprint-status.yaml (existing BMAD artifact)                             │
│  ├─ story files (existing BMAD artifact)                                    │
│  └─ .execution/status.json (NEW - execution engine contract)                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                           Dispatch Interface                                │
│                                                                             │
│  devpod ssh <pod> -- <execution-engine> <command> <args>                    │
│                                                                             │
│  Examples:                                                                  │
│  ├─ autopilot --epic 2A                     # Autopilot engine              │
│  ├─ claude -p "/dev-story 2-1-api"          # Direct Claude engine          │
│  └─ bmad-runner --story 2-1-api             # Future custom engine          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ SSH
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DevPod Container                                  │
│                                                                             │
│  ┌─ Execution Engine (one of) ───────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │  Option A: Autopilot                                                   │  │
│  │  ├─ Full epic → story → PR → review → merge automation                 │  │
│  │  ├─ State machine with resumability                                    │  │
│  │  ├─ GitHub Copilot review integration                                  │  │
│  │  └─ Writes: .execution/status.json                                     │  │
│  │                                                                        │  │
│  │  Option B: Direct Claude                                               │  │
│  │  ├─ Single story execution                                             │  │
│  │  ├─ Human manages story-to-story transitions                           │  │
│  │  └─ Orchestrator infers status from BMAD artifacts                     │  │
│  │                                                                        │  │
│  │  Option C: Custom Engine (Future)                                      │  │
│  │  ├─ TypeScript-based for better maintainability                        │  │
│  │  ├─ Claude Agent SDK integration                                       │  │
│  │  └─ Full contract compliance                                           │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Shared Contract: .execution/status.json                                    │
│  (All engines write to this location for orchestrator visibility)           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Execution Engine Contract

### Status File Specification

All execution engines MUST write status to `.execution/status.json` for orchestrator visibility.

```typescript
interface ExecutionStatus {
  // Engine identification
  engine: 'autopilot' | 'direct-claude' | 'custom';
  engineVersion: string;

  // Current work
  phase: ExecutionPhase;
  epicId?: string;
  storyId?: string;

  // Progress
  progress?: {
    tasksCompleted: number;
    tasksTotal: number;
    percentage: number;
  };

  // Human interaction
  needsInput: boolean;
  lastQuestion?: string;        // Claude's pending question, if any
  questionOptions?: string[];   // If multiple choice

  // Timing
  startedAt: string;            // ISO timestamp
  lastActivity: string;         // ISO timestamp

  // PR tracking (if applicable)
  pendingPrs?: PendingPR[];

  // Error state
  error?: {
    message: string;
    phase: ExecutionPhase;
    recoverable: boolean;
  };
}

type ExecutionPhase =
  | 'idle'
  | 'starting'
  | 'developing'
  | 'reviewing'
  | 'waiting-ci'
  | 'waiting-review'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'needs-input';

interface PendingPR {
  number: number;
  url: string;
  status: 'open' | 'approved' | 'changes-requested' | 'merged';
  ciStatus: 'pending' | 'passing' | 'failing';
}
```

### Exit Code Contract

| Code | Meaning | Orchestrator Action |
|------|---------|---------------------|
| 0 | Success - work completed | Mark complete, consider next dispatch |
| 1 | Error - recoverable | Investigate, potentially retry |
| 2 | Needs input - waiting | Display question, await human response |
| 3 | Error - unrecoverable | Alert human, do not retry |

---

## Autopilot-Specific Integration

### Required Modifications to Autopilot

To integrate Autopilot as an execution engine option, these modifications are needed:

| Modification | Purpose | Complexity |
|--------------|---------|------------|
| Write `.execution/status.json` | Orchestrator visibility | Low |
| Capture Claude's last question | Needs-input display | Medium |
| Abstract reviewer interface | Support non-Copilot reviews | Medium |
| Configurable epic source path | Work with BMAD conventions | Low |
| Structured exit codes | Orchestrator decision support | Low |

### Autopilot State Mapping

Map Autopilot's internal phases to the contract:

| Autopilot Phase | Contract Phase |
|-----------------|----------------|
| CHECK_PENDING_PR | waiting-review |
| FIND_EPIC | starting |
| CREATE_BRANCH | starting |
| DEVELOP_STORIES | developing |
| CODE_REVIEW | reviewing |
| CREATE_PR | reviewing |
| WAIT_COPILOT | waiting-review |
| FIX_ISSUES | developing |
| MERGE_PR | merging |

### Integration Script Wrapper

```bash
#!/bin/bash
# .execution/run-autopilot.sh
# Wrapper that ensures contract compliance

# Run autopilot with output capture
./autopilot.sh "$@" 2>&1 | tee .execution/autopilot.log

EXIT_CODE=$?

# Ensure status file exists even on crash
if [ ! -f .execution/status.json ]; then
  echo '{"engine":"autopilot","phase":"failed","error":{"message":"Unexpected termination","recoverable":false}}' > .execution/status.json
fi

exit $EXIT_CODE
```

---

## Execution Engine Comparison

| Capability | Autopilot | Direct Claude | Custom Engine |
|------------|-----------|---------------|---------------|
| **Autonomy Level** | High (full epic) | Low (single story) | Configurable |
| **Resumability** | Yes (state.json) | Limited (session resume) | Yes |
| **Review Integration** | GitHub Copilot | Manual | Pluggable |
| **Implementation** | Bash | N/A | TypeScript |
| **Maintainability** | Medium | N/A | High |
| **Contract Compliance** | Needs modification | Needs wrapper | Native |
| **Availability** | Now (fork) | Now | Future build |

### Decision Matrix: When to Use Each

| Scenario | Recommended Engine | Rationale |
|----------|-------------------|-----------|
| Full autonomous epic execution | Autopilot | Built for this purpose |
| Single story, human-guided | Direct Claude | Simpler, more control |
| Complex approval workflows | Custom Engine | Need typed logic |
| Experimentation / learning | Direct Claude | Lower commitment |
| Production at scale | Custom Engine | Maintainability matters |

---

## Orchestrator Integration Points

### Discovery Enhancement

```typescript
// lib/discovery.ts - Enhanced for execution engine detection

interface DevPodInfo {
  name: string;
  workspacePath: string;
  bmadInitialized: boolean;

  // NEW: Execution engine info
  executionEngine?: {
    type: 'autopilot' | 'direct-claude' | 'custom' | 'none';
    status?: ExecutionStatus;  // From .execution/status.json
  };
}

async function discoverExecutionEngine(workspacePath: string): Promise<ExecutionEngineInfo> {
  const statusPath = path.join(workspacePath, '.execution', 'status.json');

  if (await exists(statusPath)) {
    const status = await readJson<ExecutionStatus>(statusPath);
    return { type: status.engine, status };
  }

  // Check for autopilot installation
  if (await exists(path.join(workspacePath, 'autopilot.sh'))) {
    return { type: 'autopilot', status: undefined };  // Installed but not running
  }

  return { type: 'none', status: undefined };
}
```

### Command Generation Enhancement

```typescript
// lib/commands.ts - Dispatch commands per engine

function generateDispatchCommand(
  devpod: DevPodInfo,
  epicId: string,
  engine: 'autopilot' | 'direct-claude'
): string {
  const base = `devpod ssh ${devpod.name} --`;

  switch (engine) {
    case 'autopilot':
      return `${base} ./autopilot.sh --epic ${epicId}`;
    case 'direct-claude':
      return `${base} claude -p "/bmad:bmm:workflows:dev-story" --output-format json`;
  }
}
```

### Dashboard Status Display

```
┌─ devpod-1 ──────────────────────┐
│  ● RUNNING [autopilot]   12m ago │
│  → Epic 2A / Story 2-1-api       │
│    ▓▓▓▓▓▓▓▓▓▓░░░░░░ 60%          │
│    Phase: developing             │
│                                  │
│  Pending PRs: #42 (CI passing)   │
└──────────────────────────────────┘

┌─ devpod-2 ──────────────────────┐
│  ⏸ NEEDS INPUT [autopilot] 2h   │
│  → Epic 3A / Story 3-2-auth      │
│                                  │
│  ╭─ Claude is asking ──────────╮ │
│  │ Use JWT or session cookies? │ │
│  ╰─────────────────────────────╯ │
└──────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1 (Current MVP)
- No execution engine integration
- Orchestrator is read-only, infers state from BMAD artifacts
- Commands are copy-paste (direct Claude invocation)

### Phase 2 (One-Click Dispatch)
- Add execution engine detection to discovery
- Generate engine-appropriate dispatch commands
- Still no autonomous execution

### Phase 3 (Autonomous Option)
- **Option A:** Fork and modify Autopilot
  - Add contract compliance
  - Abstract reviewer
  - Integrate as "autopilot engine"

- **Option B:** Build custom TypeScript engine
  - Native contract compliance
  - Claude Agent SDK integration
  - Higher maintainability

- **Option C:** Both (recommended)
  - Autopilot for immediate capability
  - Custom engine as long-term investment
  - User chooses per-DevPod

### Phase 4 (Full Autonomy)
- Orchestrator auto-dispatches to idle DevPods
- Engine selection based on epic complexity
- Human approval gates at key points

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bash brittleness at scale | Engine reliability | Accept for MVP; custom engine for production |
| Copilot coupling | Limited reviewer options | Abstract interface before deep integration |
| Divergent fork maintenance | Upgrade burden | Minimize modifications; contribute upstream |
| Contract violations | Orchestrator confusion | Wrapper script ensures compliance |
| Needs-input capture complexity | Missing questions | Dedicated Claude output parser |

---

## Open Questions

1. **Should Autopilot be bundled or externally installed?**
   - Bundled: Simpler deployment, version control
   - External: Easier updates, smaller footprint

2. **How to handle multi-repo orchestration?**
   - Autopilot is single-repo; orchestrator spans DevPods
   - May need orchestrator-level epic assignment logic

3. **Should we contribute contract compliance upstream?**
   - Benefits community
   - Reduces fork maintenance
   - May not align with upstream goals

4. **TypeScript rewrite timeline?**
   - Depends on Autopilot adoption success
   - Could be Phase 4 or never (if bash works)

---

## References

- [Autopilot Repository](https://github.com/hanibalsk/autopilot)
- [BMAD Orchestrator PRD](../prd.md)
- [BMAD Orchestrator Architecture](../architecture.md)
- [Claude Agent SDK Evaluation](./claude-agent-sdk-eval.md)

---

## Document History

| Date | Author | Change |
|------|--------|--------|
| 2026-01-08 | Node + Winston | Initial sketch |
