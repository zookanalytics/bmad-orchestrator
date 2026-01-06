# Auto-Claude Patterns Analysis

**Date:** 2026-01-03
**Purpose:** Task 1.3 - Extract reusable patterns from Auto-Claude (NOT for adoption)
**Status:** COMPLETE - 4 actionable patterns identified

---

## Overview

**Repository:** [github.com/AndyMik90/Auto-Claude](https://github.com/AndyMik90/Auto-Claude)
**Purpose:** Autonomous multi-agent coding framework

Auto-Claude is NOT evaluated for adoption (has its own methodology), but provides valuable patterns for visualization, job tracking, and state management that can inform our SDK-based implementation.

---

## Pattern 1: Kanban Visualization for Agent State

### Problem Solved
How do you visualize multi-agent workflow progress without complex real-time synchronization?

### Auto-Claude's Approach
- Task cards represent agent work items
- State transitions (planning → building → review → done) update cards
- Real-time display without polling

### BMAD Application (<50 LOC)

```python
# visualization/kanban.py
from dataclasses import dataclass
from enum import Enum
import json

class StoryState(Enum):
    BACKLOG = "backlog"
    READY = "ready-for-dev"
    IN_PROGRESS = "in-progress"
    REVIEW = "review"
    DONE = "done"

@dataclass
class KanbanCard:
    story_id: str
    title: str
    state: StoryState
    agent: str = ""
    progress: str = ""

def sprint_to_kanban(sprint_status: dict) -> list[KanbanCard]:
    """Convert sprint-status.yaml to Kanban cards."""
    cards = []
    for story in sprint_status.get("stories", []):
        cards.append(KanbanCard(
            story_id=story["id"],
            title=story["title"],
            state=StoryState(story["status"]),
            agent=story.get("assigned_agent", ""),
            progress=story.get("last_update", "")
        ))
    return cards

def render_kanban(cards: list[KanbanCard]) -> str:
    """Render cards as terminal-friendly Kanban board."""
    columns = {state: [] for state in StoryState}
    for card in cards:
        columns[card.state].append(card)

    output = []
    for state in StoryState:
        output.append(f"\n=== {state.value.upper()} ===")
        for card in columns[state]:
            output.append(f"  [{card.story_id}] {card.title}")
            if card.agent:
                output.append(f"       → {card.agent}")
    return "\n".join(output)
```

**Mapping to Pain Points:**
- **Visualization (Pain Point 3):** Direct solution - Kanban board from YAML state
- **LOC:** ~40 lines

---

## Pattern 2: Spec-Based Job Tracking

### Problem Solved
How do you track discrete jobs through a pipeline with clear handoff points?

### Auto-Claude's Approach
```bash
spec_runner.py --interactive  # Define work
run.py --spec 001             # Execute autonomously
run.py --spec 001 --review    # Human checkpoint
run.py --spec 001 --merge     # Integrate results
```

Separates definition, execution, review, and merge into distinct CLI operations.

### BMAD Application (<60 LOC)

```python
# job_tracker.py
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
import json

class JobPhase(Enum):
    PENDING = "pending"
    EXECUTING = "executing"
    REVIEW = "review"
    MERGING = "merging"
    COMPLETE = "complete"
    FAILED = "failed"

@dataclass
class Job:
    job_id: str
    story_id: str
    skill: str
    phase: JobPhase
    session_id: str = ""
    started_at: str = ""
    completed_at: str = ""
    error: str = ""
    history: list = field(default_factory=list)

    def transition(self, new_phase: JobPhase, details: str = ""):
        self.history.append({
            "from": self.phase.value,
            "to": new_phase.value,
            "at": datetime.now().isoformat(),
            "details": details
        })
        self.phase = new_phase

class JobTracker:
    def __init__(self, jobs_dir: Path):
        self.jobs_dir = jobs_dir
        self.jobs_dir.mkdir(exist_ok=True)

    def create_job(self, story_id: str, skill: str) -> Job:
        job_id = f"{story_id}-{skill.split(':')[-1]}-{datetime.now().strftime('%H%M%S')}"
        job = Job(job_id=job_id, story_id=story_id, skill=skill, phase=JobPhase.PENDING)
        self._save(job)
        return job

    def start_execution(self, job: Job, session_id: str):
        job.session_id = session_id
        job.started_at = datetime.now().isoformat()
        job.transition(JobPhase.EXECUTING, f"Session: {session_id}")
        self._save(job)

    def complete(self, job: Job, success: bool, error: str = ""):
        job.completed_at = datetime.now().isoformat()
        if success:
            job.transition(JobPhase.COMPLETE)
        else:
            job.error = error
            job.transition(JobPhase.FAILED, error)
        self._save(job)

    def _save(self, job: Job):
        path = self.jobs_dir / f"{job.job_id}.json"
        path.write_text(json.dumps(job.__dict__, default=str, indent=2))

    def load(self, job_id: str) -> Job:
        path = self.jobs_dir / f"{job_id}.json"
        data = json.loads(path.read_text())
        data["phase"] = JobPhase(data["phase"])
        return Job(**data)
```

**Mapping to Pain Points:**
- **Job Tracking (Pain Point 2):** Clear success/failure per job, history, retry capability
- **LOC:** ~55 lines

---

## Pattern 3: Isolation-First Execution

### Problem Solved
How do you allow multiple agents to work in parallel without conflicts?

### Auto-Claude's Approach
- Uses git worktrees for each agent
- Main branch is read-only during agent operations
- Merge is a deliberate final step with conflict resolution

### BMAD Application (Conceptual - Future)

```
Current BMAD:
┌──────────────────┐
│   Instance A     │ ──→ sprint-status.yaml (shared)
└──────────────────┘
┌──────────────────┐
│   Instance B     │ ──→ sprint-status.yaml (shared) ← CONFLICT RISK
└──────────────────┘

With Worktree Pattern:
┌──────────────────┐
│   Instance A     │ ──→ worktree/A/sprint-status.yaml
└──────────────────┘
┌──────────────────┐
│   Instance B     │ ──→ worktree/B/sprint-status.yaml
└──────────────────┘
          │
          ▼ (merge coordinator)
    ┌─────────────┐
    │ Main branch │ ← Controlled merge
    └─────────────┘
```

**Pattern Insight:** Instead of complex locking, use isolation + smart merge.

**BMAD Application:**
- Each instance works in isolated copy of sprint-status.yaml
- Coordinator merges status changes atomically
- Conflicts resolved by "last-writer-wins" for status field

**LOC Estimate:** ~100 lines for worktree management + merge logic

**Mapping to Pain Points:**
- **Coordination (Pain Point 4):** Reliable agent-to-agent handoffs via isolation

---

## Pattern 4: Event-Driven State Updates

### Problem Solved
How do you keep visualization in sync with agent state without polling?

### Auto-Claude's Approach
- Kanban board updates reflect agent internal state
- Changes propagate without explicit refresh
- Visual representation of autonomous progression

### BMAD Application (<30 LOC)

```python
# event_bus_viz.py (extends existing event_bus.py)
from event_bus import EventBus, EventType, Event
import json
import sys

class StateChangeLogger:
    """Log state changes for external visualization tools."""

    def __init__(self, bus: EventBus, output=sys.stdout):
        self.output = output
        bus.subscribe(EventType.STORY_STATUS_CHANGED, self._on_status_change)
        bus.subscribe(EventType.SKILL_STARTED, self._on_skill_start)
        bus.subscribe(EventType.SKILL_COMPLETED, self._on_skill_complete)

    def _emit(self, event_type: str, data: dict):
        line = json.dumps({"event": event_type, **data})
        self.output.write(line + "\n")
        self.output.flush()

    def _on_status_change(self, event: Event):
        self._emit("status_change", event.payload)

    def _on_skill_start(self, event: Event):
        self._emit("skill_start", event.payload)

    def _on_skill_complete(self, event: Event):
        self._emit("skill_complete", event.payload)
```

External visualization tools can tail the output stream for real-time updates.

**Mapping to Pain Points:**
- **Visualization (Pain Point 3):** Event stream enables dashboards
- **LOC:** ~25 lines

---

## Summary: Patterns vs Pain Points

| Pattern | Pain Point Solved | LOC | Priority |
|---------|-------------------|-----|----------|
| **Kanban Visualization** | Visualization (#3) | ~40 | Medium |
| **Job Tracking** | Job Tracking (#2) | ~55 | High |
| **Isolation-First** | Coordination (#4) | ~100 | Medium (Phase 2) |
| **Event-Driven Updates** | Visualization (#3) | ~25 | High |

**Total actionable LOC:** ~120 lines for MVP (Job Tracking + Event Updates)
**Deferred:** Isolation pattern for multi-instance (Phase 2+)

---

## Integration with SDK Prototype

These patterns enhance the Claude Agent SDK foundation:

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ State Mgr   │ │ Executor    │ │ Event Bus   │            │
│  │ (fallback)  │ │ (SDK wrap)  │ │ + Logger    │ ← NEW      │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │ Job Tracker │ │ Kanban Viz  │                ← NEW       │
│  │ (Pattern 2) │ │ (Pattern 1) │                            │
│  └─────────────┘ └─────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Conclusion

**Task 1.3 Status: COMPLETE**

Extracted 4 actionable patterns from Auto-Claude:
1. ✅ Kanban Visualization - ~40 LOC
2. ✅ Job Tracking - ~55 LOC
3. ✅ Isolation-First (deferred) - ~100 LOC
4. ✅ Event-Driven Updates - ~25 LOC

All patterns have <200 LOC implementation sketches as required by tech-spec.

**Recommendation:** Incorporate Job Tracking and Event-Driven Updates into Phase 2 prototype. Defer Isolation-First and full Kanban to post-MVP.
