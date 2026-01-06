# BMAD Orchestration: Build vs Buy Analysis

> **Status:** Strategic assessment
> **Created:** 2026-01-02
> **Context:** Evaluating whether to continue custom bmad-cli development or adopt external workflow solutions

## Executive Summary

bmad-cli has evolved into a workflow orchestration engine (~1700 lines of Python) that reimplements patterns available in mature external solutions. This document analyzes what's genuinely BMAD-specific vs what's general workflow infrastructure, and recommends a hybrid approach.

## Current State

### What bmad-cli Does

| Capability | Implementation | Lines of Code |
|------------|----------------|---------------|
| State machine (status transitions) | Custom YAML parsing | ~200 |
| Task dispatch + queue | File-based + subprocess | ~300 |
| Worker management | Docker exec + PID checks | ~150 |
| Health/liveness checking | Lock files + heartbeats | ~200 |
| Retry/failure handling | max_same_status_retries | ~100 |
| Terminal dashboard | Custom rich UI | ~400 |
| PTY process management | Custom signal file watching | ~150 |
| CLI interface | argparse + menus | ~200 |

**Total: ~1700 lines** of workflow infrastructure code.

### What's Actually BMAD-Specific

Only these components are unique to our problem:

1. **Claude CLI as worker** - PTY interaction required, not HTTP/RPC
2. **Stop hook + signal file** - Phase completion detection via Claude Code hooks
3. **BMAD skill invocation** - Mapping status → skill → agent
4. **sprint-status.yaml parsing** - BMAD's native state format

**Estimated: ~300-400 lines** of genuinely unique code.

## Comparison with External Solutions

| Capability | bmad-cli | Temporal | Prefect | Celery | Argo |
|------------|----------|----------|---------|--------|------|
| State machine | Custom | Built-in | Built-in | Manual | DAG-based |
| Task dispatch | Subprocess | Activity workers | Task runners | Workers | Pods |
| Distributed coordination | File-based | Durable execution | Server-based | Broker-based | K8s-native |
| Failure recovery | Lock files | Automatic replay | Checkpoints | Retry policies | Pod restart |
| Observability | Custom terminal | Web UI + metrics | Web UI + metrics | Flower | Argo UI |
| Scalability | Single machine | Unlimited | Unlimited | Unlimited | Cluster-wide |
| Operational complexity | None | Temporal server | Prefect server | Broker + backend | Kubernetes |

### Why External Solutions Were Previously Dismissed

From `bmad-orchestration-implementation-brief.md`:

> "State machine framework (LangGraph, etc.) - Overkill. BMAD workflow is mostly linear, not complex branching."

> "Roll our own on BMAD state file - Recommended. BMAD's `bmm-workflow-status.yaml` already IS the state. We just need a thin interpreter."

**This assessment was correct initially** - the first version was ~100 lines. But scope grew:
- Multi-instance dispatch added ~400 lines
- Stale detection added ~200 lines
- Interactive menus added ~300 lines
- Lock file management added ~200 lines

We're no longer building a "thin interpreter."

## The Core Challenge

bmad-cli conflates two distinct concerns:

### 1. Workflow Orchestration (Generic)
- When to run tasks
- How to dispatch to workers
- How to handle failures
- How to track state across restarts
- How to coordinate parallel work

### 2. BMAD Method Execution (Specific)
- What skill to invoke for each status
- How to spawn Claude CLI with PTY
- How to detect phase completion via hooks
- How to parse sprint-status.yaml

**External solutions excel at #1. We must build #2 regardless.**

## Options

### Option A: Continue Custom Development

**Approach:** Accept bmad-cli is a workflow engine, continue building.

**Pros:**
- Already working for current use case
- No external dependencies
- Full control over behavior
- No operational overhead

**Cons:**
- Reinventing solved problems
- Distributed coordination is hard to get right
- Limited observability
- Maintenance burden grows with features

**Best for:** Single-developer, single-machine, BMAD-only use.

### Option B: Temporal.io Integration

**Approach:** Use Temporal for orchestration, custom activities for BMAD execution.

```python
# Workflow definition (Temporal handles state, retries, coordination)
@workflow.defn
class StoryWorkflow:
    @workflow.run
    async def run(self, story_id: str):
        status = await workflow.execute_activity(
            get_story_status, story_id,
            start_to_close_timeout=timedelta(seconds=30)
        )

        if status == "backlog":
            await workflow.execute_activity(
                run_bmad_phase, args=["create-story", story_id],
                start_to_close_timeout=timedelta(hours=1),
                retry_policy=RetryPolicy(maximum_attempts=3)
            )

        if status in ["backlog", "ready-for-dev"]:
            await workflow.execute_activity(
                run_bmad_phase, args=["dev-story", story_id],
                start_to_close_timeout=timedelta(hours=2)
            )

        await workflow.execute_activity(
            run_bmad_phase, args=["code-review", story_id],
            start_to_close_timeout=timedelta(hours=1)
        )

# Activity (our BMAD-specific code)
@activity.defn
async def run_bmad_phase(phase: str, story_id: str):
    """Spawns Claude CLI with PTY, handles signal file detection."""
    # This is where our unique code lives
    cmd = build_claude_command(phase, story_id)
    exit_code, was_signaled = pty_spawn_with_signal(cmd)
    if exit_code != 0 and not was_signaled:
        raise ApplicationError(f"Phase {phase} failed")
```

**Pros:**
- Durable execution (survives restarts)
- Built-in retries with backoff
- Web UI for monitoring
- Scales to distributed workers
- Battle-tested coordination

**Cons:**
- Requires running Temporal server (or Temporal Cloud)
- Learning curve
- Adds infrastructure dependency

**Best for:** Production use, multiple developers, reliability requirements.

### Option C: Kubernetes + Argo Workflows

**Approach:** Define BMAD phases as container steps in Argo DAGs.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
spec:
  entrypoint: story-workflow
  templates:
    - name: story-workflow
      dag:
        tasks:
          - name: create-story
            template: bmad-phase
            arguments:
              parameters: [{name: phase, value: create-story}]
          - name: dev-story
            template: bmad-phase
            dependencies: [create-story]
            arguments:
              parameters: [{name: phase, value: dev-story}]
          - name: code-review
            template: bmad-phase
            dependencies: [dev-story]
            arguments:
              parameters: [{name: phase, value: code-review}]

    - name: bmad-phase
      inputs:
        parameters:
          - name: phase
      container:
        image: ghcr.io/zookanalytics/claude-devcontainer:latest
        command: [bmad-cli, run-phase, "{{inputs.parameters.phase}}"]
```

**Pros:**
- Native container orchestration
- Parallel execution built-in
- Retry policies per step
- Argo UI for monitoring
- GitOps-friendly (workflows as YAML)

**Cons:**
- Requires Kubernetes cluster
- Higher operational complexity
- Container startup overhead per phase

**Best for:** Teams already on Kubernetes, CI/CD integration.

### Option D: Hybrid - Simplified bmad-cli + Clear Boundaries

**Approach:** Keep bmad-cli but explicitly limit scope.

**What bmad-cli does:**
- Parse sprint-status.yaml
- Determine next BMAD action
- Spawn Claude CLI with PTY
- Detect phase completion via signal file
- Update status file

**What bmad-cli does NOT do:**
- Distributed coordination (single machine only)
- Automatic retry with backoff (manual restart)
- Persistent task queue (in-memory only)
- Monitoring/alerting (terminal output only)

**Document these boundaries clearly. If requirements exceed them, migrate to Option B or C.**

## Recommendation

### Short-term (Current)
**Option D: Simplified bmad-cli with clear boundaries.**

The current implementation works for the current use case. Acknowledge limitations in documentation.

### Medium-term (If scaling needed)
**Option B: Temporal.io integration.**

If requirements grow to include:
- Multiple developers using BMAD simultaneously
- Reliability guarantees (survive machine restart)
- Distributed workers across machines
- Production monitoring

Then migrate orchestration to Temporal while keeping BMAD-specific activities custom.

### Migration Path

1. **Extract BMAD-specific code** into standalone module:
   - `bmad_executor.py` - PTY spawning, signal detection
   - `bmad_status.py` - Status file parsing, action determination

2. **Create Temporal activities** that call the extracted code

3. **Define workflows** for story/epic lifecycle

4. **Run Temporal server** (or use Temporal Cloud)

5. **Deprecate** bmad-cli dispatch/coordination code

## What to Keep Regardless

These components are BMAD-specific and should remain custom:

| Component | Reason |
|-----------|--------|
| Stop hook (`bmad-phase-complete.sh`) | Claude Code hook integration |
| Signal file detection | Unique completion mechanism |
| PTY spawn with signal watching | Claude CLI requires interactive terminal |
| Status file parsing | BMAD's native format |
| Skill/agent mapping | BMAD method specifics |

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-12 | Build custom orchestrator | "Thin interpreter" on BMAD state files |
| 2025-01 | Add multi-instance support | Needed parallel feature development |
| 2025-01 | Add stale detection | Production reliability requirement |
| 2026-01 | Strategic review | Scope grew beyond "thin interpreter" |

## References

- [Temporal.io Documentation](https://docs.temporal.io/)
- [Prefect Documentation](https://docs.prefect.io/)
- [Argo Workflows](https://argoproj.github.io/argo-workflows/)
- [bmad-automation-proposal.md](./bmad-automation-proposal.md)
- [bmad-orchestration-implementation-brief.md](./bmad-orchestration-implementation-brief.md)
- [bmad-filesystem-orchestration.md](./bmad-filesystem-orchestration.md)
