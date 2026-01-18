# BMAD Filesystem-Based Orchestration

> **Status:** Future consideration
> **Created:** 2026-01-02
> **Context:** Alternative to host-level orchestration that eliminates Docker socket dependency

## Problem Statement

The current bmad-cli architecture has two distinct roles:

1. **Orchestrator** (host-level): Discovers containers, checks process status, dispatches work
2. **Executor** (container-level): Runs Claude, manages story lifecycle

The orchestrator requires Docker socket access to:
- Call `claude-instance list --json` to discover running containers
- Call `docker exec` to check if processes are running inside containers
- Dispatch via `claude-instance run <name> <cmd>`

This creates a distribution problem: orchestrator commands can't run from inside sandboxed containers without compromising security.

## Current Solution (Quick Win)

Distribute orchestrator commands for host-only installation via npm global install. See package.json `bin` field and README for installation instructions.

## Future Option: Filesystem-Based Coordination

Rearchitect to use shared filesystem for coordination instead of Docker commands.

### Proposed Directory Structure

```
.claude/.bmad-coordination/
├── workers/
│   ├── instance-1.json      # Worker registration + heartbeat
│   ├── instance-2.json
│   └── ...
├── dispatch/
│   ├── story-1-abc123.json  # Dispatch request (unique ID prevents races)
│   └── ...
├── claims/
│   ├── story-1-abc123.json  # Worker claims dispatch (atomic rename)
│   └── ...
└── results/
    ├── story-1.json         # Completion notification
    └── ...
```

### Worker Registration (workers/*.json)

```json
{
  "instance": "worker-1",
  "container_id": "abc123...",
  "path": "/path/to/workspace",
  "pid": 12345,
  "started": "2026-01-02T10:00:00Z",
  "heartbeat": "2026-01-02T10:05:00Z",
  "status": "idle",
  "current_story": null
}
```

Workers update heartbeat every 30 seconds. Orchestrator considers workers stale after 2 minutes without heartbeat.

### Dispatch Request (dispatch/*.json)

```json
{
  "id": "story-1-abc123",
  "story_id": "1-1-project-setup",
  "action": "run-story",
  "created": "2026-01-02T10:00:00Z",
  "priority": 1,
  "yolo": true
}
```

### Claim Process

1. Worker polls `dispatch/` directory for new work
2. Worker attempts atomic rename: `dispatch/story-1-abc123.json` → `claims/story-1-abc123.json`
3. If rename succeeds, worker owns the dispatch
4. If rename fails (file gone), another worker claimed it first
5. Worker updates its registration with `status: "working"` and `current_story`

### Result Notification (results/*.json)

```json
{
  "story_id": "1-1-project-setup",
  "dispatch_id": "story-1-abc123",
  "instance": "worker-1",
  "status": "completed",
  "final_story_status": "done",
  "phases_completed": ["create-story", "dev-story", "code-review"],
  "completed": "2026-01-02T11:30:00Z"
}
```

### Orchestrator Changes

The orchestrator would:
1. Write dispatch files instead of calling `claude-instance run`
2. Read worker registrations instead of calling `claude-instance list`
3. Check heartbeats instead of calling `docker exec` for liveness
4. Read results directory for completion notifications

### Worker Daemon

Each container runs a lightweight daemon (or integrates into existing process):

```python
# Simplified worker loop
while True:
    update_heartbeat()

    if status == "idle":
        dispatch = try_claim_next_dispatch()
        if dispatch:
            run_story(dispatch)
            write_result(dispatch)
            status = "idle"

    sleep(5)  # Poll interval
```

### Advantages

1. **No Docker socket needed** - Pure filesystem coordination
2. **Works anywhere** - Orchestrator can run on host, in container, or remotely
3. **Simpler security** - No special privileges required
4. **Natural persistence** - Dispatch state survives restarts
5. **Easy debugging** - Just inspect JSON files

### Disadvantages

1. **Polling latency** - 5-30 second delay vs immediate dispatch
2. **Heartbeat overhead** - Continuous filesystem writes
3. **Race conditions** - Atomic rename is reliable but adds complexity
4. **Filesystem dependency** - Requires shared volume between all workers

### Migration Path

1. Add worker daemon to container (alongside existing executor)
2. Add filesystem coordination to orchestrator (alongside Docker commands)
3. Feature flag to choose coordination method
4. Deprecate Docker-based coordination once stable

### Open Questions

- Should workers self-register or require explicit creation?
- How to handle worker crashes mid-story? (Orphaned claims)
- Should dispatch files include full story context or just ID?
- How to prioritize between multiple pending dispatches?
- Should we use inotify/fswatch instead of polling?

## Decision

For now, we're using the quick-win approach of host-only distribution for orchestrator commands. This document captures the filesystem-based alternative for future consideration if:

1. Host installation becomes too friction-heavy
2. We need orchestration from within containers
3. We want to support remote/distributed orchestration
