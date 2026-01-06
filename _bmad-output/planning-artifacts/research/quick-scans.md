# Quick Scans: Secondary Candidates

**Date:** 2026-01-03
**Purpose:** Task 1.5 - Quick evaluation of secondary tools
**Status:** COMPLETE - No promotions needed (primary candidate succeeded)

---

## Context

Per tech-spec:
> **Scope:** These tools are NOT evaluated unless Task 1.1 and 1.2 both score <4 on critical criteria.

**Actual Results:**
- Task 1.1 (Claude Agent SDK): **4.94/5** - PASSED
- Task 1.2 (CodeMachine-CLI): 2.47/5 - FAILED

Since Claude Agent SDK passed with flying colors, secondary candidates are documented for reference only, not promoted to full evaluation.

---

## Quick Scan Results

### LangGraph

**Source:** [langchain.com/langgraph](https://langchain.com/langgraph)
**Quick Scan Duration:** 15 minutes

**Can it wrap CLI tools?**
LangGraph is a graph-based workflow orchestration library. It can execute subprocess calls as part of node actions, but its primary model is direct LLM API calls, not CLI wrapping.

**Verdict:** Would require significant adapter work to use Claude Code CLI as a node action. Not worth pursuing given SDK availability.

**Promotion:** ❌ NO - SDK is direct integration

---

### MARSYS

**Source:** [github.com/rezaho/MARSYS](https://github.com/rezaho/MARSYS)
**Quick Scan Duration:** 20 minutes

**Do topology patterns fit BMAD?**
MARSYS offers 7 topology patterns:
- Hub-spoke (matches orchestrator → agents)
- Pipeline (matches analyst → architect → dev flow)
- Mesh, parallel, etc.

The pipeline pattern conceptually matches BMAD's phased approach.

**Verdict:** Interesting patterns, but uses direct Anthropic API, not Claude Code CLI. Would lose all Claude Code features (tools, context, skills).

**Promotion:** ❌ NO - API-based, not CLI-based

---

### ClaudeBox

**Source:** [github.com/RchGrav/claudebox](https://github.com/RchGrav/claudebox)
**Quick Scan Duration:** 10 minutes

**Security model conflicts?**
ClaudeBox provides containerized Claude Code with profiles. Its security model adds additional isolation layers.

**Verdict:** Similar to our devcontainer approach but less flexible. DevPod + our security hooks is more powerful.

**Promotion:** ❌ NO - Covered by DevPod evaluation

---

### zhsama/claude-sub-agent

**Source:** [github.com/zhsama/claude-sub-agent](https://github.com/zhsama/claude-sub-agent)
**Quick Scan Duration:** 15 minutes

**Agent model matches BMAD?**
Very similar! Has:
- spec-analyst (≈ Analyst)
- spec-architect (≈ Architect)
- spec-developer (≈ Dev)
- spec-tester (≈ TEA)
- Quality gates between stages

**Verdict:** Closest to BMAD pattern, but is a reference implementation, not a framework. We can learn from it, but Claude Agent SDK provides the actual runtime we need.

**Promotion:** ❌ NO - Reference implementation, not framework

---

### Nimbalyst

**Source:** [nimbalyst.com](https://nimbalyst.com/)
**Quick Scan Duration:** 5 minutes

**Relevant at all?**
WYSIWYG editor and session manager for Claude Code. Session management focus, not orchestration.

**Verdict:** Likely not relevant to our orchestration needs.

**Promotion:** ❌ EXCLUDE - Session manager, not orchestrator

---

## Summary

| Tool | Quick Assessment | Promote? |
|------|------------------|----------|
| **LangGraph** | Graph-based, needs adapter for CLI | ❌ NO |
| **MARSYS** | Good patterns, but API-based | ❌ NO |
| **ClaudeBox** | Similar to our approach, less flexible | ❌ NO |
| **zhsama/claude-sub-agent** | Good patterns, reference impl only | ❌ NO |
| **Nimbalyst** | Session manager, not orchestrator | ❌ EXCLUDE |

**Conclusion:** No secondary candidates need promotion. Claude Agent SDK (Task 1.1) provides everything we need.

---

## Patterns Worth Noting

From zhsama/claude-sub-agent:
- Quality gates between agent stages
- Structured spec format for handoffs
- Agent specialization matches BMAD roles

These patterns are already captured in our Auto-Claude patterns document (Task 1.3).
