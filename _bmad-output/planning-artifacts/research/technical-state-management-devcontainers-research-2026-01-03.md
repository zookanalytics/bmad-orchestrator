---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: ['_bmad-output/planning-artifacts/decisions/orchestration-infrastructure-decision.md']
workflowType: 'research'
research_type: 'technical'
research_topic: 'State management solutions for BMAD across multiple devcontainers/DevPods'
user_name: 'Node'
date: '2026-01-03'
status: 'complete'
---

# State Management for BMAD Multi-DevPod Architecture

**Date:** 2026-01-03
**Author:** Node
**Status:** Complete

---

## Executive Summary

### Research Question

Are there existing open-source tools that could manage BMAD workflow state across multiple devcontainers better than building from scratch?

### Answer: Git-Native Architecture (No Additional Tools Required)

After evaluating Valkey, rqlite, Syncthing, etcd, Consul, and LiteFS, the recommended architecture uses **no additional infrastructure**:

```
GitHub (source of truth for completed work)
    │
    ├── DevPod 1 ──► .worker-state.yaml + sprint-status.yaml
    ├── DevPod 2 ──► .worker-state.yaml + sprint-status.yaml
    └── DevPod 3 ──► .worker-state.yaml + sprint-status.yaml
                          │
                          ▼
              Orchestrator (reads all, writes none)
              └── Aggregates global view
              └── Assigns work to idle workers
              └── Detects stale workers via heartbeat
```

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Zero new infrastructure** | No databases, no sync services |
| **BMAD unchanged** | Works exactly as designed |
| **Git-native** | Leverages existing workflow |
| **Distributed state** | Each worker owns its state |
| **Scalable** | Add DevPods without coordination overhead |

### Implementation Effort

| Component | Effort |
|-----------|--------|
| `.worker-state.yaml` schema | 1 hour |
| Heartbeat update in DevPod | 2-4 hours |
| Orchestrator aggregation logic | 4-8 hours |
| **Total** | **~1-2 days** |

---

## Key Constraints

These constraints, discovered during research, drove the architecture decision:

1. **`_bmad-output` is committed to GitHub** — cannot use shared Docker volumes
2. **Each DevPod has its own git clone** — separate working directories
3. **Stories are already individual files** — `{epic}-{story}-{title}.md` (no changes needed)
4. **`sprint-status.yaml` is the coordination point** — tracks all story statuses
5. **BMAD should work unchanged** — no modifications to existing workflows

---

## Recommended Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          GITHUB                                  │
│  (Source of truth for COMMITTED work)                            │
│                                                                  │
│  main branch:                                                    │
│  └── _bmad-output/sprint-status.yaml (merged/completed states)   │
│                                                                  │
│  feature branches:                                               │
│  └── devpod-X/story-Y (committed but not merged)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       HOST MACHINE                               │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  DevPod 1   │  │  DevPod 2   │  │  DevPod 3   │              │
│  │  (clone A)  │  │  (clone B)  │  │  (clone C)  │              │
│  │             │  │             │  │             │              │
│  │ _bmad-output/                                                │
│  │ ├── sprint-status.yaml  (BMAD's view - uncommitted)          │
│  │ ├── 1-1-user-auth.md    (story file)                         │
│  │ └── .worker-state.yaml  (orchestrator metadata)              │
│  │                                                              │
│  │ BMAD works unchanged                                         │
│  │ Commits → pushes → PR → merge                                │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         │ host access    │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Host Filesystem Access                                  │    │
│  │  /var/devpods/devpod-1/_bmad-output/                     │    │
│  │  /var/devpods/devpod-2/_bmad-output/                     │    │
│  │  /var/devpods/devpod-3/_bmad-output/                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          │ reads (no writes)                     │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ORCHESTRATOR                                            │    │
│  │                                                          │    │
│  │  Data Sources:                                           │    │
│  │  1. GitHub (git fetch) → committed/merged state          │    │
│  │  2. DevPod filesystems → uncommitted work-in-progress    │    │
│  │                                                          │    │
│  │  Responsibilities:                                       │    │
│  │  - Aggregate global view of all work                     │    │
│  │  - Detect stale workers (heartbeat timeout)              │    │
│  │  - Assign available work to idle workers                 │    │
│  │  - Handle retries for failed/abandoned work              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Worker State File (Per-DevPod)

Each DevPod maintains its own state file for orchestrator visibility:

```yaml
# _bmad-output/.worker-state.yaml
worker_id: devpod-1
instance_started: 2026-01-03T09:00:00Z

current_assignment:
  story_id: 1-1-user-auth
  assigned_at: 2026-01-03T10:00:00Z
  status: in-progress  # in-progress | blocked | review | completing

heartbeat:
  last_update: 2026-01-03T10:47:32Z

history:
  - story_id: 0-1-setup
    completed_at: 2026-01-03T09:45:00Z
    result: success
```

### Data Flow

```
1. Orchestrator reads GitHub
   └── Sees: completed stories, available backlog

2. Orchestrator reads all DevPod filesystems
   └── Sees: uncommitted work-in-progress, heartbeats

3. Orchestrator aggregates
   └── Builds: global view of all work across all workers

4. Orchestrator assigns work
   └── Tells DevPod-3: "Work on story 2-1"

5. DevPod-3 starts work
   └── Updates .worker-state.yaml (heartbeat)
   └── BMAD updates sprint-status.yaml locally
   └── Works on story file

6. DevPod-3 completes work
   └── Commits all changes
   └── Pushes to feature branch
   └── Creates PR

7. PR merged to main
   └── GitHub now has completed state
   └── Other DevPods can pull to see it
   └── Orchestrator sees merge via git fetch
```

### Orchestrator Implementation

```python
from pathlib import Path
from datetime import datetime, timedelta
import yaml
import subprocess

class DistributedOrchestrator:
    def __init__(self, devpod_root: Path, repo_path: Path, heartbeat_timeout: int = 300):
        self.devpod_root = devpod_root  # /var/devpods/
        self.repo_path = repo_path      # Git repo for GitHub access
        self.heartbeat_timeout = timedelta(seconds=heartbeat_timeout)

    def get_global_state(self) -> dict:
        """Aggregate state from all sources"""
        state = {"stories": {}, "workers": {}}

        # 1. Read GitHub (committed state)
        subprocess.run(["git", "fetch", "--all"], cwd=self.repo_path)
        github_status = self._read_git_file("origin/main",
            "_bmad-output/implementation-artifacts/sprint-status.yaml")

        for story_id, status in github_status.get("development_status", {}).items():
            state["stories"][story_id] = {
                "status": status,
                "source": "github",
                "worker": None
            }

        # 2. Read all DevPod filesystems (live state)
        for devpod_dir in self.devpod_root.iterdir():
            if not devpod_dir.is_dir():
                continue

            worker_id = devpod_dir.name
            worker_state_file = devpod_dir / "_bmad-output" / ".worker-state.yaml"
            sprint_status_file = devpod_dir / "_bmad-output" / "implementation-artifacts" / "sprint-status.yaml"

            if worker_state_file.exists():
                worker_state = yaml.safe_load(worker_state_file.read_text())
                is_stale = self._is_stale(worker_state)

                state["workers"][worker_id] = {
                    "state": worker_state,
                    "stale": is_stale
                }

                # Override story status if worker is active
                if not is_stale and worker_state.get("current_assignment"):
                    story_id = worker_state["current_assignment"]["story_id"]
                    state["stories"][story_id] = {
                        "status": worker_state["current_assignment"]["status"],
                        "source": "filesystem",
                        "worker": worker_id
                    }

            # Also read sprint-status.yaml for uncommitted changes
            if sprint_status_file.exists():
                local_status = yaml.safe_load(sprint_status_file.read_text())
                for story_id, status in local_status.get("development_status", {}).items():
                    if story_id not in state["stories"] or state["stories"][story_id]["source"] == "github":
                        if status in ["in-progress", "review"]:
                            state["stories"][story_id] = {
                                "status": status,
                                "source": "filesystem",
                                "worker": worker_id
                            }

        return state

    def get_available_stories(self) -> list:
        """Stories that can be assigned"""
        state = self.get_global_state()
        return [
            story_id for story_id, info in state["stories"].items()
            if info["status"] in ["backlog", "ready-for-dev"]
            and info["worker"] is None
        ]

    def get_stale_workers(self) -> list:
        """Workers that haven't sent heartbeat"""
        state = self.get_global_state()
        return [
            {"worker_id": worker_id, "state": info["state"]}
            for worker_id, info in state["workers"].items()
            if info["stale"]
        ]

    def _is_stale(self, worker_state: dict) -> bool:
        last_heartbeat = datetime.fromisoformat(
            worker_state.get("heartbeat", {}).get("last_update", "1970-01-01T00:00:00Z")
        )
        return datetime.utcnow() - last_heartbeat > self.heartbeat_timeout

    def _read_git_file(self, ref: str, path: str) -> dict:
        result = subprocess.run(
            ["git", "show", f"{ref}:{path}"],
            cwd=self.repo_path, capture_output=True, text=True
        )
        if result.returncode == 0:
            return yaml.safe_load(result.stdout) or {}
        return {}
```

---

## Why Not Other Tools?

| Tool | Verdict | Reason |
|------|---------|--------|
| **Valkey/Redis** | Not needed | Git + filesystem reads achieve same goal without extra infrastructure |
| **Syncthing** | Not needed | Each DevPod has own git clone; `_bmad-output` must stay in repo |
| **rqlite** | Not needed | Adds HTTP API complexity without clear benefit |
| **Shared Docker volumes** | Won't work | `_bmad-output` is committed to GitHub, can't be external |
| **LiteFS** | Won't work | Requires FUSE/privileged containers in DevPods |
| **etcd** | Overkill | Designed for Kubernetes scale, too heavyweight |

### When Centralized State (Valkey) Makes Sense

A Valkey-based approach would be appropriate if:
- Sub-second state synchronization is required
- Workers need to see each other's state instantly (not via git)
- Centralized retry/failover logic is preferred
- The orchestrator should be the single writer of sprint-status.yaml

For BMAD's current use case (independent workers, git-based workflow, eventual consistency acceptable), the git-native approach is simpler.

---

## Comparison to Prior Architecture Decision

**Source:** `_bmad-output/planning-artifacts/decisions/orchestration-infrastructure-decision.md`

The prior decision designated **State Management → BUILD Minimal** (~150 LOC):
- State Manager - Atomic YAML read/write with locking
- Event Bus - Pub/sub for state changes

### Updated Recommendation

| Aspect | Prior (BUILD Minimal) | New (Git-Native) |
|--------|----------------------|------------------|
| **Approach** | Build state_manager.py + event_bus.py | Orchestrator reads existing files |
| **LOC** | ~150 estimated | ~100 (orchestrator only) |
| **New files** | state_manager.py, event_bus.py | .worker-state.yaml per DevPod |
| **BMAD changes** | Wrapper needed | None |
| **Infrastructure** | None | None |
| **Concurrency** | File locking (error-prone) | Each worker owns its files |

**Recommendation:** The git-native approach achieves the same goals with less code and no BMAD modifications.

---

## Potential UI Component: BMAD Progress Dashboard

**Source:** [github.com/ibadmore/bmad-progress-dashboard](https://github.com/ibadmore/bmad-progress-dashboard)

An existing Node.js terminal UI for BMAD progress tracking that could serve as a foundation or source of ideas for the orchestrator interface.

### Current Capabilities

- Terminal-based progress display with visual progress bars
- Reads BMAD story files and calculates completion
- Planning phase (40%) + Development phase (60%) weighting
- File watching for real-time updates
- Markdown dashboard generation

### Multi-DevPod Extension Concept

```
┌─────────────────────────────────────────────────────────────────┐
│  BMAD Multi-DevPod Dashboard                                     │
│                                                                  │
│  Overall Progress: ████████████░░░░░░░░ 58%                     │
│  Planning: ████████████████████ 100%  Dev: ████████░░░░ 42%     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Worker      │ Story           │ Status      │ Heartbeat     ││
│  │─────────────│─────────────────│─────────────│───────────────││
│  │ devpod-1    │ 1-1-user-auth   │ in-progress │ 2m ago        ││
│  │ devpod-2    │ 1-2-account-mgmt│ review      │ 30s ago       ││
│  │ devpod-3    │ (idle)          │ -           │ 1m ago        ││
│  │ devpod-4    │ 2-1-personality │ in-progress │ ⚠️ 8m ago     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Backlog: 5 stories │ In Progress: 2 │ Review: 1 │ Done: 3      │
│                                                                  │
│  [r] Refresh  [a] Assign work  [g] Git fetch  [q] Quit          │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

| Dashboard Feature | Data Source |
|-------------------|-------------|
| Overall progress | GitHub main branch (`sprint-status.yaml`) |
| Worker status | DevPod `.worker-state.yaml` files |
| Story assignments | Aggregated from all DevPods |
| Heartbeat monitoring | `.worker-state.yaml` timestamps |
| Stale detection | Orchestrator logic (heartbeat timeout) |
| Story details | Individual story markdown files |

### Extension Ideas

1. **Multi-source file watching** — Watch all DevPod directories, not just local
2. **Worker health indicators** — Visual heartbeat status, stale warnings
3. **Assignment interface** — Keyboard commands to assign stories to idle workers
4. **Git integration** — Fetch/pull status, PR notifications
5. **Conflict detection** — Warn if multiple workers claim same story

This existing project demonstrates the terminal UI patterns and BMAD file parsing that could be reused for the orchestrator dashboard.

---

## Appendix: Technology Research

### Tools Evaluated

The following tools were evaluated during research:

#### Distributed SQLite
- **LiteFS** - FUSE-based, requires privileged containers (not suitable for DevPods)
- **rqlite** - HTTP API, Raft consensus, good for distributed SQL but adds complexity

#### Key-Value Stores
- **Valkey** - Redis fork, BSD licensed, excellent performance, but requires export for git-trackable files
- **etcd** - Kubernetes-scale, overkill for BMAD
- **Consul** - Service networking + KV store, more than needed

#### File Synchronization
- **Syncthing** - P2P file sync, creates conflict files on simultaneous edits, requires host network mode

#### Container Patterns
- **Shared Docker volumes** - Don't work because `_bmad-output` is committed to git
- **Sidecar services** - Add operational complexity

### Key Technical Findings

1. **inotify doesn't work across containers** - File watchers don't see changes from other containers on shared volumes without polling
2. **YAML file locking in Python is unreliable** - Standard library support is poor
3. **BMAD stories are already individual files** - Reduces conflict surface for git merges
4. **Git line-based merge handles different stories cleanly** - As long as DevPods touch different stories

### Sources

- [Syncthing Conflict Resolution](https://docs.syncthing.net/users/syncing.html)
- [Docker inotify Issue](https://github.com/moby/moby/issues/18246)
- [DevPod Docs](https://devpod.sh/docs/what-is-devpod)
- [Valkey.io](https://valkey.io/)
- [rqlite.io](https://rqlite.io/)
- [Atomic Updates in Python](https://sahmanish20.medium.com/better-file-writing-in-python-embrace-atomic-updates-593843bfab4f)

---
