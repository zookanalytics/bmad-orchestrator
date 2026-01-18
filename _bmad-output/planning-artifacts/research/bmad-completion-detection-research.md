# AI Agent Workflow Completion Detection Research

**Date**: 2025-12-30
**Context**: Research conducted to improve BMAD phase completion detection

## Problem Statement

When running BMAD workflows, the system needs to detect when Claude has completed a phase (e.g., create-story, dev-story, code-review) so it can automatically proceed to the next phase without requiring the user to manually quit Claude.

## Current Implementation

Our solution uses:

1. **Stop hook** (`.claude/hooks/bmad-phase-complete.sh`) - Fires when Claude stops responding
2. **Status comparison** - Compares `starting_status` in lock file against current `sprint-status.yaml`
3. **Signal file** - When status changes, writes `.claude/.bmad-phase-signal.json`
4. **Custom PTY loop** - `_pty_spawn_with_signal()` in `executor.py` watches for signal file and terminates Claude gracefully

## Research Findings

### 1. CrewAI Approach: Callbacks & Guardrails

CrewAI uses a multi-layered approach:

- **Task callbacks** - Fire after task completion with output context
- **Guardrails** - Validation functions that can reject outputs and trigger rework
- **LLM-based guardrails** - Use an LLM to evaluate if output meets criteria

**Example guardrail pattern:**

```python
def validate_output(result: TaskOutput) -> GuardrailResult:
    if not meets_criteria(result):
        return GuardrailResult(success=False, error="Missing required sections")
    return GuardrailResult(success=True, result=result)
```

**Relevance**: Guardrails concept could enhance our Stop hook - instead of just detecting status change, we could validate phase output quality.

### 2. Claude-flow: Stream-JSON Chaining

The claude-flow project (GitHub) uses:

- **Structured JSON output between agents** - Each agent outputs structured data
- **Dependency-based execution** - Next task waits for specific outputs
- **Checkpointing** - State saved between phases for recovery
- **Stream-based communication** - Agents chain via stdout/stdin JSON streams

**Relevance**: Our `sprint-status.yaml` approach is similar to their structured output validation. Could enhance by adding explicit "phase complete" markers.

### 3. Agent Loop Termination Patterns

Research identified 4 common patterns for detecting agent completion:

| Pattern | Description | Reliability | Our Usage |
|---------|-------------|-------------|-----------|
| LLM says complete | Agent explicitly signals "I'm done" | Low (can hallucinate) | Not used |
| Function/tool signal | Agent calls a `finish()` tool | High | Not yet implemented |
| Max steps reached | Safety limit on iterations | Medium (may cut off early) | Yes (`max_same_status_retries`) |
| Specific info produced | Validates expected output exists | High | Yes (status file change) |

**Relevance**: Pattern #4 aligns with our approach. Could add Pattern #2 via `/phase-complete` skill.

### 4. State Machine Orchestration (LangGraph)

LangGraph uses:

- **StateGraph** - Explicit state transitions with validation
- **Conditional edges** - Routing based on output analysis
- **Self-reflection loops** - Quality gates before proceeding
- **Interrupt/resume** - Human-in-the-loop at defined points

**Relevance**: Our status-based transitions already implement a state machine:

```
backlog → ready-for-dev → in-progress → review → done
```

Adding validation at each edge would strengthen reliability.

### 5. Orchestrator Pattern (Multi-Agent)

From Claude Code orchestration research:

- **Orchestrator delegates, never implements** - Prevents context pollution
- **Sub-agents get focused context** - Only what they need for their task
- **Clear handoff points** - Explicit signals between agents
- **Context management** - Summarization between phases

**Relevance**: Our phase-based approach naturally segments context. Each Claude invocation starts fresh with focused task.

## Industry Comparison

| Approach | CrewAI | Claude-flow | LangGraph | Our BMAD |
|----------|--------|-------------|-----------|----------|
| State machine | ✅ | ✅ | ✅ | ✅ |
| Structured output | ✅ | ✅ | ✅ | ✅ |
| Safety limits | ✅ | ✅ | ✅ | ✅ |
| Checkpointing | ✅ | ✅ | ✅ | ✅ (status file) |
| Explicit completion signal | ✅ | ✅ | ✅ | ⚠️ Partial |
| Output guardrails | ✅ | ❌ | ✅ | ❌ |
| Human-in-loop | ✅ | ❌ | ✅ | ✅ |

## Recommendations

### Short-term (Current Implementation is Solid)

Our Stop hook + signal file approach aligns with industry patterns:

- Status-based detection = "specific info produced" pattern
- Lock file tracking = checkpointing pattern
- Max retries = safety limit pattern

**No immediate changes needed** - the current implementation is sound.

### Medium-term Enhancements

1. **Add `/phase-complete` skill**
   - Workflows explicitly call when done
   - Provides explicit signaling (Pattern #2)
   - Reduces reliance on status file timing

2. **Enhanced status markers**
   - Add `phase_completed_at` timestamp to status
   - Include `completed_by` (which workflow)
   - Enables better debugging and audit trail

### Long-term Enhancements

1. **Output guardrails**
   - Before accepting phase complete, validate outputs exist
   - For dev-story: tests pass, code compiles, files created
   - For code-review: review comments addressed, no blockers

2. **LLM-based validation**
   - Use lightweight model to verify phase output quality
   - "Does this code review output indicate approval or changes needed?"

3. **Structured phase output**
   - Each workflow outputs JSON summary
   - Orchestrator validates expected fields present

## Risk Analysis

| Risk | Mitigation |
|------|------------|
| False positive (Claude pauses mid-thought) | Status change check prevents this |
| False negative (status not updated) | Max retry limit catches stuck states |
| Race condition (status check vs file write) | Signal file is atomic signal |
| Claude crashes mid-phase | Lock file persists, can resume |

## Files Modified in Implementation

- `.claude/hooks/bmad-phase-complete.sh` - Stop hook script
- `.claude/settings.json` - Hook registration
- `scripts/bmad/executor.py` - Custom PTY loop with signal watching
- `scripts/bmad/cli.py` - Lock file starting_status tracking

## References

- CrewAI Documentation: Callbacks and Guardrails
- Claude-flow GitHub Wiki: Workflow Orchestration
- LangGraph: StateGraph patterns
- Agent loop termination best practices (various sources)
