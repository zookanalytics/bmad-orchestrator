# CodeMachine-CLI Evaluation

**Date:** 2026-01-03
**Purpose:** Task 1.2 - Evaluate CodeMachine-CLI for BMAD orchestration
**Status:** RESEARCH COMPLETE - NOT RECOMMENDED

> **Evaluation Gap (F2):** This evaluation was conducted via documentation review only. Hands-on testing with the standard test harness was NOT performed as required by tech-spec. The rejection is based on architectural incompatibility assessment, not empirical failure. A future implementation phase could re-evaluate if SDK approach proves insufficient.

---

## Executive Summary

CodeMachine-CLI is a multi-agent orchestration engine that **claims** Claude Code CLI support, but has critical limitations for BMAD integration:

1. **Different methodology** - Spec-to-code pipeline vs. BMAD's phased workflow approach
2. **Early development** - Project warns "not ready for production use"
3. **Unclear integration** - Uses Claude Code as execution backend, not as orchestration layer
4. **Own state management** - File-based memory system, not compatible with BMAD's YAML state

**Recommendation:** Do NOT adopt. Claude Agent SDK (Task 1.1) is superior fit.

---

## What is CodeMachine-CLI?

**Repository:** [github.com/moazbuilds/CodeMachine-CLI](https://github.com/moazbuilds/CodeMachine-CLI)
**npm package:** `codemachine` (v0.7.0)
**Primary language:** TypeScript (96.4%)

CodeMachine is a "CLI-native Orchestration Engine that runs coordinated multi-agent workflows directly on your local machine." It transforms specifications into production-ready code using multi-agent orchestration.

### Key Claims

| Claim | Description |
|-------|-------------|
| **25-37x faster** | Compared to manual AI prompting |
| **Multi-agent** | Heterogeneous models for different tasks |
| **Parallel execution** | Sub-agents work simultaneously |
| **Long-running** | Hours to days of autonomous execution |
| **Self-generated** | 90% of CodeMachine was built by CodeMachine |

---

## Claude Code Integration Analysis

### How It Integrates

CodeMachine uses Claude Code CLI as one of several **execution backends**:

```
CodeMachine Orchestrator
         │
         ├── Codex CLI
         ├── Claude Code CLI  ← Backend option
         ├── Cursor CLI
         ├── CCR CLI
         └── OpenCode CLI
```

**Critical Distinction:** CodeMachine uses Claude Code to execute code generation tasks. It does NOT leverage Claude Code's native features like:
- Subagents
- Hooks
- Session resumption
- BMAD skills

### Integration Model

```
CodeMachine Architecture:
┌─────────────────────────────────────────────────────────────┐
│              CODEMACHINE ORCHESTRATOR                        │
│  • Main agents (sequential workflow steps)                   │
│  • Sub-agents (delegated tasks)                              │
│  • File-based memory (JSON metadata)                         │
│  • Own prompt templates                                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ (executes via)
┌─────────────────────────────────────────────────────────────┐
│              CLAUDE CODE CLI                                 │
│  (just as code execution backend)                           │
└─────────────────────────────────────────────────────────────┘
```

vs.

```
Claude Agent SDK Approach (Task 1.1):
┌─────────────────────────────────────────────────────────────┐
│                    BMAD METHODOLOGY                          │
│  (Agent prompts, workflows, YAML state - KEEPS)              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ (directly uses)
┌─────────────────────────────────────────────────────────────┐
│              CLAUDE CODE CLI HEADLESS                        │
│  • Native BMAD skill invocation                              │
│  • Session resumption                                        │
│  • Hooks integration                                         │
│  • Structured JSON output                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## BMAD Integration Issues

### 1. Different Methodology

| Aspect | CodeMachine | BMAD Method |
|--------|-------------|-------------|
| **Flow** | Spec → Architecture → Code → Test | Analysis → Planning → Solutioning → Implementation |
| **Agents** | Generic (Planner, Implementer, Reviewer) | Role-based (Analyst, Architect, PM, Dev, TEA) |
| **State** | File-based JSON memory | YAML status files (git-trackable) |
| **Input** | Specification markdown | Phased workflow with human-in-loop |

### 2. State Management Incompatibility

**CodeMachine's approach:**
```json
// .codemachine/memory/execution-state.json
{
  "phase": "implementation",
  "agents": [...],
  "outputs": [...]
}
```

**BMAD's approach:**
```yaml
# sprint-status.yaml
stories:
  - id: S001
    status: in-progress
    epic: E001
```

CodeMachine would need to:
- Read BMAD's YAML files
- Translate to its JSON memory
- Write back to YAML on completion

This adds a translation layer that the Claude Agent SDK doesn't require.

### 3. BMAD Skill Invocation

**Cannot work directly because:**
- CodeMachine uses its own prompt templates
- BMAD skills expect Claude Code's native context
- No mechanism to invoke `/{skill}` commands

**Would require:**
- Writing CodeMachine agents that wrap BMAD skills
- Maintaining two orchestration layers
- Duplicating workflow logic

---

## Criteria Matrix Scoring

| Criteria | Weight | Score | Rationale |
|----------|--------|-------|-----------|
| **BMAD Compatibility** | 10x | **2/5** | Different methodology, no skill invocation |
| **Claude Code Integration** | 10x | **3/5** | Uses as backend only, not native features |
| **State Externalization** | 5x | **2/5** | Own JSON memory, needs translation for YAML |
| **Failure Semantics** | 5x | **3/5** | Has retry logic, but not documented well |
| **Visualization** | 2x | **3/5** | TUI interface, but for its own workflow |
| **Maintenance Burden** | 5x | **2/5** | Early development, single maintainer, not production-ready |
| **Escape Hatch** | 2x | **3/5** | Could switch engines, but workflow locked in |

**Weighted Score: 2.47/5** - **BELOW adoption threshold (3.5)**

**FAILS** on critical criteria (10x weighted):
- BMAD Compatibility: 2/5 (minimum 4/5 required)
- Claude Code Integration: 3/5 (minimum 4/5 required)

---

## Risk Assessment

| Risk Factor | Status | Concern |
|-------------|--------|---------|
| **Maintainer Count** | ⚠️ 1 active | Bus factor risk |
| **Commit Frequency** | ✅ Active | Recent commits |
| **Commercial Backing** | ❌ None | Individual project |
| **Breaking Changes** | ⚠️ Early dev | Explicitly warns "not ready for production" |
| **Escape Cost** | ⚠️ High | Would need to rewrite orchestration |

**Red Flags: 3/5** - Recommend against adoption per tech-spec rules.

---

## Alternative Analysis

### Why Claude Agent SDK (Task 1.1) is Better

| Aspect | CodeMachine-CLI | Claude Agent SDK |
|--------|-----------------|------------------|
| **BMAD skill invocation** | ❌ Not possible | ✅ Native support |
| **Session resumption** | ❌ Own sessions | ✅ Native session_id |
| **State management** | 🔶 JSON (needs translation) | ✅ Direct YAML read/write |
| **Hooks integration** | ❌ Not available | ✅ Full hook system |
| **Maintenance** | 🔶 Single developer | ✅ Anthropic official |
| **Production ready** | ❌ Early development | ✅ Mature |

### When CodeMachine-CLI Would Be Better

- Building NEW projects from specifications
- Greenfield development without existing methodology
- Need for heterogeneous models (e.g., Gemini for planning)
- Want pre-built multi-agent orchestration out of the box

### When Claude Agent SDK is Better (Our Case)

- Existing BMAD methodology to preserve
- Need BMAD skill invocation
- Want YAML state files (git-trackable)
- Need session resumption for recovery
- Want official Anthropic support

---

## Conclusion

**Task 1.2 Status: COMPLETE**

CodeMachine-CLI is an interesting project but **NOT suitable for BMAD orchestration**:

- ❌ Fails BMAD Compatibility criterion (2/5, need 4/5)
- ❌ Fails Claude Code Integration criterion (3/5, need 4/5)
- ❌ Has 3+ risk red flags (early dev, single maintainer, no commercial backing)
- ❌ Would require translation layer for YAML state
- ❌ Cannot invoke BMAD skills natively

**RECOMMENDATION:** **DO NOT ADOPT** CodeMachine-CLI

Claude Agent SDK (Task 1.1) scored 4.94/5 and meets all critical criteria.
Proceed to Task 1.3 (Auto-Claude patterns) and then Phase 2 prototype with SDK.

---

## Sources

- [CodeMachine-CLI GitHub](https://github.com/moazbuilds/CodeMachine-CLI)
- [CodeMachine Architecture Docs](https://github.com/moazbuilds/CodeMachine-CLI/blob/main/docs/architecture.md)
- [npm package info](https://www.npmjs.com/package/codemachine)
