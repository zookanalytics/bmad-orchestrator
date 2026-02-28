---
date: '2026-02-27'
author: Node
research_type: 'strategic'
research_topic: 'Multi-Agent Orchestration Landscape: Gastown, Agent Flywheel, and the Continuous Improvement Gap'
research_goals: 'Evaluate external multi-agent orchestration frameworks against the agent-tools ecosystem; identify borrowable patterns for closing the continuous improvement loop'
web_research_enabled: true
source_verification: true
---

# Strategic Analysis: Multi-Agent Orchestration Landscape

**Date:** 2026-02-27
**Author:** Node
**Type:** Strategic — Competitive Landscape & Gap Analysis

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [1. Systems Under Evaluation](#1-systems-under-evaluation)
- [2. Architectural Comparison](#2-architectural-comparison)
  - [2.1. Concern Mapping](#21-concern-mapping)
  - [2.2. Isolation Models](#22-isolation-models)
  - [2.3. Workflow Execution Models](#23-workflow-execution-models)
  - [2.4. Agent Coordination](#24-agent-coordination)
  - [2.5. Observation and Visibility](#25-observation-and-visibility)
- [3. Deep Dive: Beads Formula Workflow vs. Keystone-Workflows](#3-deep-dive-beads-formula-workflow-vs-keystone-workflows)
- [4. Deep Dive: The Continuous Improvement Problem](#4-deep-dive-the-continuous-improvement-problem)
  - [4.1. The Three Improvement Loops](#41-the-three-improvement-loops)
  - [4.2. Skills vs. Procedural Memory](#42-skills-vs-procedural-memory)
  - [4.3. Toward a Synthesis](#43-toward-a-synthesis)
- [5. Gap Analysis: What Each System Lacks](#5-gap-analysis-what-each-system-lacks)
- [6. Borrowable Patterns](#6-borrowable-patterns)
- [7. Strategic Recommendations](#7-strategic-recommendations)
- [8. Sources](#8-sources)

---

## Executive Summary

This analysis evaluates two external multi-agent orchestration frameworks — **Gastown** (Steve Yegge) and **Agent Flywheel** (Jeffrey Emanuel) — against the agent-tools ecosystem's strategic goals and keystone-workflows package. The three systems share the same root problem: human attention is the bottleneck in parallel AI development. They diverge in architecture, operating model, and how they approach continuous improvement.

**Key findings:**

1. **The three-concern taxonomy (Isolate/Automate/Observe) maps cleanly onto both external systems**, validating its stability as a classification framework. However, both external systems surface a fourth concern — **Remember** — that the current taxonomy does not name.

2. **Gastown's Beads Formula Workflow** and **keystone-workflows** are convergent designs with complementary strengths. Gastown integrates work tracking into workflow execution (durable execution records tied to work items). Keystone-workflows has stronger human-in-the-loop semantics and explicit engine replaceability.

3. **Agent Flywheel's CASS Memory System** implements the autonomous continuous improvement loop that the agent-tools ecosystem currently lacks. Its three-layer cognitive architecture (Episodic → Working → Procedural) with confidence decay, harmful multipliers, and anti-pattern auto-inversion is a concrete reference implementation for closing the gap between "process failed" and "process improved" without requiring human diagnosis.

4. **The superpowers skills system has a unique structural advantage** that neither external system possesses: mandatory hook-enforced process discipline. Skills are not advisory — they are enforced. This property, combined with an autonomous learning layer, would produce a system stronger than any of the three evaluated individually.

5. **Two concrete gaps** in the current ecosystem should be addressed: structured execution telemetry (enabling post-run analysis) and confidence-tracked procedural memory (enabling autonomous learning from that analysis).

---

## 1. Systems Under Evaluation

### Gastown

**Author:** Steve Yegge
**Repository:** [github.com/steveyegge/gastown](https://github.com/steveyegge/gastown)
**Language:** Go
**Architecture:** Monolithic CLI (`gt`) with theatrical metaphor (Mayor, Polecats, Rigs, Hooks, Convoys)

Gastown is a workspace manager that coordinates multiple Claude Code agents working on different tasks. Its core innovation is persistent work state using git-backed hooks, enabling reliable multi-agent workflows that survive agent restarts. It uses the **Beads** issue tracking system for work decomposition and tracking, with **Formulas** as TOML-defined repeatable workflows.

### Agent Flywheel (ACFS)

**Author:** Jeffrey Emanuel
**Website:** [agent-flywheel.com](https://agent-flywheel.com)
**Repository:** [github.com/Dicklesworthstone/agentic_coding_flywheel_setup](https://github.com/Dicklesworthstone/agentic_coding_flywheel_setup)
**Language:** Go, TypeScript, Python (multiple independent tools)
**Architecture:** Compound toolbox — 16+ independent tools creating value through interaction rather than unified architecture

Agent Flywheel transforms a fresh VPS into a fully-configured multi-agent coding environment. Its distinctive contribution is the **flywheel thesis**: every tool added makes every agent more productive, with compounding returns. Key tools include NTM (agent spawning/management), Agent Mail (async coordination), CASS (session search), Beads Viewer (graph-theoretic task prioritization), and the CASS Memory System (three-layer cognitive architecture for procedural learning).

### Agent-Tools Ecosystem (This Monorepo)

**Packages:** agent-env, keystone-workflows, orchestrator
**Architecture:** Concern-separated monorepo — three independent packages communicating via CLI contracts

The ecosystem addresses three concerns (Isolate, Automate, Observe) through loosely coupled tools. keystone-workflows provides declarative YAML workflow execution on keystone-cli. The superpowers skills system provides hook-enforced process discipline with self-validating operational knowledge. Strategic design prioritizes modularity, replaceability, and independent upgradeability.

---

## 2. Architectural Comparison

### 2.1. Concern Mapping

| Concern | Agent-Tools | Gastown | Agent Flywheel |
|---|---|---|---|
| **Isolate** | agent-env (containers, filesystem/process/network isolation) | Rigs + Git worktrees (workspace separation, no container isolation) | DCG (PreToolUse command blocking across 17 categories, no containers) |
| **Automate** | keystone-workflows (YAML DAGs on keystone-cli) | Beads Formulas (TOML pipelines) + Mayor (autonomous coordinator) | NTM (agent spawning) + Beads/BV (task prioritization) + Agent Mail (coordination) |
| **Observe** | orchestrator (TUI dashboard, in progress) | Convoy tracking + Dashboard + Activity feed | CASS (session search) + NTM dashboard + BV bottleneck visualization |
| **Remember** | Superpowers skills (manual evolution, hook-enforced) | Agent CVs (work history, capability tracking) | CASS Memory System (three-layer cognitive architecture, autonomous learning) |

The fourth concern — **Remember** — is the strategic finding. All three systems address accumulated knowledge persistence, but through fundamentally different mechanisms. The agent-tools ecosystem encodes it in skills. Gastown encodes it in agent identity records. Agent Flywheel encodes it in confidence-tracked procedural rules.

### 2.2. Isolation Models

| Dimension | Agent-Tools | Gastown | Agent Flywheel |
|---|---|---|---|
| **Mechanism** | Docker containers via devcontainer CLI | Git worktrees | Shared VPS, no isolation |
| **Threat model** | Agents can't escape sandbox, cross-contaminate, or damage host | Agents can't step on each other's branches | Agents can't execute dangerous commands |
| **Filesystem isolation** | Full (separate container) | Partial (separate worktree) | None |
| **Process isolation** | Full (containerized) | None | None |
| **Network isolation** | Optional | None | None |
| **Safety hooks** | CLI hooks restrict dangerous commands | Git hooks for workflow state | DCG blocks 50+ command patterns in 17 categories |

**Assessment:** Agent-tools has the strongest isolation model by a wide margin. Gastown provides branch-level workspace separation. Agent Flywheel provides command-level guardrails only. For the agent-tools ecosystem's strategic goals, the container-based isolation remains the correct design.

### 2.3. Workflow Execution Models

| Dimension | Keystone-Workflows | Gastown Formulas | Agent Flywheel |
|---|---|---|---|
| **Definition format** | YAML (declarative DAGs) | TOML (sequential with dependencies) | No declared workflows (ad-hoc coordination) |
| **Execution engine** | keystone-cli (external, replaceable) | Built into `gt` and `bd` CLIs | NTM + Agent Mail (emergent, not declared) |
| **State persistence** | keystone-cli internal state | Git-backed Beads ledger | NTM session state + CASS indexing |
| **Resume on failure** | Yes (checkpointed) | Yes (molecule state tracking) | No formal resume mechanism |
| **Human-in-the-loop** | Two modes: Gates (approve/reject) and Collaboration (park + resume) | Mayor makes autonomous decisions; manual override available | No formal HITL; agents work autonomously |
| **Work item integration** | None (pipelines execute, no durable records) | Deep (Formulas create Beads with IDs; every execution is tracked as a molecule) | Beads Viewer for prioritization, no formula integration |
| **Engine replaceability** | Explicit design goal with documented evaluation criteria | Tightly coupled to `gt` binary | N/A (no unified engine) |
| **Multi-model review** | Built-in (dual Claude + Gemini code review in bmad-story) | Single agent per task | Multiple agents possible via Agent Mail, not codified |

**Assessment:** Keystone-workflows and Gastown Formulas are convergent designs. Keystone-workflows is stronger on human-in-the-loop semantics and engine replaceability. Gastown is stronger on work item integration and durable execution records. Agent Flywheel doesn't compete on declared workflow execution — its value is in the coordination and memory layers.

### 2.4. Agent Coordination

| Dimension | Agent-Tools | Gastown | Agent Flywheel |
|---|---|---|---|
| **Coordination model** | Sequential pipeline steps (single agent per step) | Mayor decomposes work → distributes via hooks → agents execute autonomously | Agent Mail (async messaging + file reservation) |
| **Inter-agent communication** | None (agents are isolated step invocations) | Git-backed hooks and mailboxes | MCP-based Agent Mail with thread management |
| **Conflict prevention** | Isolation (separate containers, can't conflict) | Separate git worktrees per agent | Advisory file reservations with pre-commit guards |
| **Agent identity** | None (agents are ephemeral CLI invocations) | Persistent identity with work history (CVs) | None (agents are fungible generalists) |
| **Scale target** | 3-6 parallel workstreams | 20-30 agents | 10+ agents on shared VPS |
| **Autonomy level** | Low (human decides what's next) | High (Mayor makes routing decisions) | Medium (agents self-organize via mail/beads) |

**Assessment:** The three systems occupy different points on the autonomy spectrum. Agent-tools prioritizes human control with visibility support. Gastown bets on AI-driven autonomous coordination. Agent Flywheel enables self-organization through communication infrastructure. The appropriate autonomy level depends on trust in agent decision-making, which is evolving rapidly.

### 2.5. Observation and Visibility

| Dimension | Agent-Tools | Gastown | Agent Flywheel |
|---|---|---|---|
| **Dashboard** | orchestrator TUI (in progress) | Built-in convoy and activity dashboard | NTM pane management + BV for task graph visualization |
| **Session history** | None (sessions are ephemeral) | Agent CVs + event logs | CASS indexes 11 agent formats with sub-60ms search |
| **Bottleneck detection** | Not yet implemented | Convoy status + cross-rig visibility | BV applies PageRank and critical path analysis |
| **Real-time monitoring** | Planned (auto-refresh in orchestrator) | Streaming activity feed | NTM context window monitoring + conflict detection |

**Assessment:** Agent Flywheel's CASS session indexing and BV's graph-theoretic analysis are notable capabilities that neither of the other systems match. The orchestrator's planned TUI is well-positioned for real-time visibility but lacks the historical analysis layer.

---

## 3. Deep Dive: Beads Formula Workflow vs. Keystone-Workflows

The Beads Formula Workflow was the initial point of interest that prompted this analysis. The two systems are convergent designs — both are declarative workflow definitions with DAG semantics, variable parameterization, and state persistence. The interesting differences are at the edges.

### Where Gastown Formulas Go Further

**Work item integration.** Formulas create trackable Beads (issue-like work items with IDs like `gt-abc12`) that persist in a git-backed ledger. Keystone-workflows executes pipelines but does not create durable work records. The formula command `bd mol pour` creates an instance of the formula as a trackable molecule with its own ID, enabling queries like "what happened on run #47?" Keystone-cli has state persistence for resume, but not for historical querying.

**Three-tier resolution.** Formulas resolve through project → town → system tiers, allowing per-project customization while maintaining defaults. Keystone-workflows uses a flat `~/.keystone/workflows/` directory with no override hierarchy. This matters less at current scale (single user, single set of workflows) but matters if per-project workflow variants become necessary.

**Capability metadata.** Formulas declare what skills they exercise, enabling capability-based routing ("this formula needs Go expertise, route to an agent with a strong Go track record"). Keystone-workflows are runtime-agnostic but don't participate in agent selection.

### Where Keystone-Workflows Goes Further

**Two modes of human-in-the-loop.** Gate mode (approve/reject) and Collaboration mode (park workflow, human works elsewhere, resume on signal) are more nuanced than Gastown's formula execution semantics. Gastown handles this through the Mayor's autonomous judgment rather than explicit workflow semantics.

**Dual code review pattern.** The `bmad-story.yaml` workflow encodes a specific operational insight — running both Gemini and Claude as reviewers catches more issues than either alone. This kind of baked-in multi-model strategy is absent from Gastown's formula examples.

**Explicit engine evaluation criteria.** Documented criteria for what the workflow engine needs to support (agent-aware execution, semantic output interpretation, both HITL modes) enables systematic re-evaluation as the landscape evolves. Gastown is tightly coupled to its own runtime — replacing the engine means replacing Gastown.

**The "no timeout" insight.** Keystone-workflows documentation explicitly calls out that timeouts corrupt agent state on long-running tasks. This is hard-won operational knowledge encoded in the workflow design.

### The Borrowable Idea

The specific pattern worth borrowing is not the TOML syntax or the formula resolution tiers. It is the **durable execution record tied to work items**. Every formula execution in Gastown creates a trackable molecule with an ID, connected to specific Beads, queryable after the fact. Keystone-workflows currently produces exit codes and whatever state keystone-cli persists for resume, but no structured historical record.

If the orchestrator's Observe concern eventually needs to answer "what happened last sprint across all workstreams?", something like this is required. Implementation options: structured JSON logs per workflow run, a SQLite database, or a git-backed state file. The concept — **durable, queryable execution records tied to work items** — is the gap, not the specific technology.

---

## 4. Deep Dive: The Continuous Improvement Problem

This is the strategic question that connects all three systems. How do you build a process that improves itself with minimal human intervention?

### 4.1. The Three Improvement Loops

**Loop 1: Within a run (immediate).** A skill fires, validates its own output, catches a problem, and corrects it before moving on. The `verification-before-completion` skill is a pure example — it refuses to claim "done" without evidence.

- **Agent-tools status:** Fully operational via superpowers skills.
- **Gastown status:** Not present. Agents execute tasks but don't self-validate process adherence.
- **Agent Flywheel status:** UBS (Universal Bug Scanner) provides pattern-based code quality checking but doesn't enforce process discipline.

**Loop 2: Between runs (retrospective).** Something goes wrong on run N. The issue is diagnosed, a process change is made, and run N+1 is better.

- **Agent-tools status:** Human-driven. Retrospective surfaces issues → human edits skill/workflow → next run is better. The bottleneck is human attention for diagnosis and encoding.
- **Gastown status:** Agent CVs provide performance data for diagnosis. Formulas can be edited. The diagnosis-to-fix cycle is still human-driven.
- **Agent Flywheel status:** **Substantially automated.** CASS Memory System extracts patterns from session history, generates procedural rules with confidence tracking, applies decay and harmful multipliers, and auto-inverts bad rules into anti-pattern warnings. The human is reduced from "driver" to "observer" for most operational improvements.

**Loop 3: Structural (systemic).** A class of problems keeps recurring, requiring architectural changes — new skills, new hooks, new workflow steps.

- **Agent-tools status:** Human-driven. The `writing-skills` skill provides a validated process for creating new skills, but the decision to create one is human-initiated.
- **Gastown status:** Human-driven with data support. Agent CVs and formula execution history inform structural decisions.
- **Agent Flywheel status:** Partially automated. The maturity progression (candidate → established → proven) means frequently-validated patterns naturally surface as candidates for structural encoding. However, the actual encoding step (creating a new tool or modifying architecture) remains human-driven.

**Assessment:** Loop 2 is the critical gap for the agent-tools ecosystem. Agent Flywheel demonstrates a concrete, working implementation of autonomous inter-run improvement. The current reliance on human-driven retrospectives for Loop 2 is the largest scalability constraint on the process.

### 4.2. Skills vs. Procedural Memory

The superpowers skills system and Agent Flywheel's CASS Procedural Memory are solving the same problem from opposite directions.

| Dimension | Superpowers Skills | CASS Procedural Memory |
|---|---|---|
| **Origin** | Human-authored, AI-validated | AI-extracted from session history |
| **Enforcement** | Mandatory via hooks (`using-superpowers` meta-skill) | Advisory — agents query before acting |
| **Evolution** | Manual: retrospective → human edits skill → validated via `writing-skills` | Automatic: sessions → patterns → rules with confidence tracking |
| **Quality control** | `writing-skills` validates before deployment | Confidence decay (90-day half-life) + harmful multiplier (4x) + auto-inversion |
| **Rigidity** | High — rigid skills must be followed exactly | Low — rules are weighted suggestions |
| **Scope** | Process-level (how to do TDD, how to debug, how to commit) | Pattern-level (this API is flaky use retry, this module breaks often) |
| **Cross-agent learning** | Same skills available to all agents (shared `.claude/skills/`) | Explicit: a technique discovered in Cursor is immediately available to Claude Code |
| **Failure handling** | Skill provides instructions; agent follows or re-attempts | Bad rules auto-invert into anti-pattern warnings |

**Neither approach alone is sufficient:**

- **Skills without memory** means process knowledge is encoded but operational knowledge (specific to the codebase, the tools, the failure patterns) must be manually captured and encoded by a human. When an agent discovers that a specific test suite is flaky and needs retry, that knowledge dies with the session unless a human encodes it into a skill.

- **Memory without skills** means agents learn from experience but have no structural enforcement of process discipline. An agent might "know" from memory that TDD produces better outcomes but skip it because there is no hook forcing invocation. Memory is advisory; discipline requires enforcement.

### 4.3. Toward a Synthesis

The architecture that emerges from this analysis combines both mechanisms:

```
Skills (process discipline)
    Mandatory, hook-enforced, human-authored
    Defines: how to approach categories of work
    Examples: TDD, systematic debugging, verification before completion
        +
Procedural Memory (operational knowledge)
    Advisory, confidence-tracked, AI-extracted
    Defines: what to watch out for in specific contexts
    Examples: "payment module tests are flaky", "parseConfig swallows errors"
        +
Execution Telemetry (session indexing)
    Persistent, cross-agent, searchable
    Enables: post-run analysis without human session review
        =
Self-improving process with structural enforcement
```

The full continuous improvement loop:

```
1. Workflow executes        → keystone-workflows runs a pipeline
2. Sessions are indexed     → CASS-like telemetry captures what happened
3. Patterns are extracted   → working memory compresses sessions into insights
4. Rules are distilled      → procedural memory creates confidence-tracked rules
5. Rules inform behavior    → agents query memory within skill-enforced processes
6. Rules propose changes    → when evidence accumulates, suggest skill modifications
7. Human approves           → (or auto-approves within defined bounds)
8. Skills are updated       → improved skills enforce improved process via hooks
9. Next run is better       → loop restarts with higher baseline
```

Steps 1-5 are fully automatable. Step 6 requires the system to recognize when accumulated procedural memory contradicts or extends an existing skill. Step 7 is the minimal human gate — reviewing a proposed skill modification, not performing diagnosis. Step 8 is handled by existing infrastructure (`writing-skills` validation).

---

## 5. Gap Analysis: What Each System Lacks

### Agent-Tools Ecosystem Gaps

| Gap | Severity | Reference |
|---|---|---|
| **No structured execution telemetry** — workflow runs produce exit codes, not queryable historical records | High | Gastown's Beads ledger, Agent Flywheel's CASS |
| **No autonomous learning loop** — operational knowledge requires human capture and encoding | High | Agent Flywheel's CASS Memory System |
| **No inter-agent communication** — agents are isolated step invocations with no mid-workflow coordination | Medium | Gastown's hooks/mailboxes, Agent Flywheel's Agent Mail |
| **No agent identity/attribution** — agents are ephemeral; no performance tracking across runs | Low | Gastown's Agent CVs |
| **No capability-based routing** — work assignment doesn't consider agent/model strengths | Low | Gastown's formula capabilities metadata |
| **Flat workflow directory** — no per-project override hierarchy for workflows | Low | Gastown's three-tier formula resolution |

### Gastown Gaps

| Gap | Severity |
|---|---|
| **No hard isolation** — agents share host OS; no container, process, or network isolation | High |
| **No self-validating process enforcement** — no equivalent to hook-enforced skills | High |
| **Tightly coupled architecture** — can't replace engine without replacing Gastown | Medium |
| **No dual code review pattern** — single-model review only | Medium |
| **No explicit engine evaluation criteria** — difficult to assess when to migrate | Low |

### Agent Flywheel Gaps

| Gap | Severity |
|---|---|
| **No declared workflows** — all coordination is ad-hoc through Agent Mail and NTM | High |
| **No hard isolation** — shared VPS with command-level guards only | High |
| **No process enforcement** — memory is advisory; no mandatory discipline hooks | High |
| **No concern separation** — tools are loosely coupled but not architecturally bounded | Medium |
| **No resume on failure** — no formal workflow checkpointing | Medium |
| **"Vibe mode" defaults** — passwordless sudo and skip-permissions as default operating mode | Medium |

---

## 6. Borrowable Patterns

Patterns from external systems that could be adopted without compromising the agent-tools ecosystem's architectural principles.

### 6.1. From Gastown: Durable Execution Records

**Pattern:** Every workflow execution creates a persistent, queryable record tied to work items. Not just "did the pipeline succeed?" but "which stories were processed, what outcomes did each produce, what issues were found during review?"

**Implementation path:** Structured JSON log files per keystone-workflows run, stored alongside git history or in a dedicated `.workflow-history/` directory. Each record includes: workflow name, run ID, timestamp, step outcomes, git commits produced, review findings, and final status.

**Architectural fit:** Clean. Execution telemetry is Observe-concern data produced as a side effect of Automate-concern execution. The orchestrator reads it; keystone-workflows writes it. No concern boundary violation. Could be implemented as a keystone-cli enhancement or as a post-run script step in existing workflows.

**Prerequisite for:** The autonomous learning loop (6.2). Without structured records, there is nothing for the memory system to analyze.

### 6.2. From Agent Flywheel: Confidence-Tracked Procedural Memory

**Pattern:** A three-layer cognitive architecture that transforms raw execution data into actionable, self-correcting operational knowledge.

| Layer | Function | Agent-Tools Equivalent |
|---|---|---|
| Episodic | Raw session indexing and search | Does not exist. Needed: CASS-like session indexing. |
| Working | Compressed summaries of what matters | Does not exist. Needed: post-run analysis agent. |
| Procedural | Rules with confidence, decay, and auto-inversion | Partially exists: superpowers skills encode process rules. Missing: operational-level rules with confidence tracking. |

**Implementation path:** This could be built as a new component serving the Remember concern, or as an extension of the orchestrator's observation capabilities. The key properties to preserve:

- **Confidence decay** (90-day half-life): prevents stale rules from accumulating
- **Harmful multiplier** (4x weight for mistakes): ensures the system is conservative about bad advice
- **Maturity progression** (candidate → established → proven): new rules don't get full weight immediately
- **Auto-inversion**: rules demonstrated to be harmful become anti-pattern warnings rather than silently disappearing

**Architectural fit:** This is a new concern (Remember) that sits between Observe and Automate. It reads execution telemetry (produced by Automate, visible to Observe) and produces advisory knowledge that agents consume within skill-enforced processes. It does not mutate workflow state or bypass skill enforcement. The integration contract: skills can reference memory ("before debugging, check known issues for this module"), and memory can propose skill modifications ("accumulated evidence suggests adding a coverage check to the TDD skill").

### 6.3. From Agent Flywheel: Cross-Agent Session Search

**Pattern:** CASS indexes sessions from 11 different agent formats with sub-60ms search. An agent can query "has anyone on this codebase encountered this error before?" and get relevant context from any previous session, regardless of which agent or model produced it.

**Implementation path:** Lighter than full CASS adoption. Within the containerized agent-env model, session transcripts could be persisted to a shared volume and indexed. The orchestrator (Observe concern) could surface search results. Alternatively, CASS itself could be evaluated for adoption as an external tool — it fits cleanly into the Tool Integration Map as an Observe-concern accelerator.

**Architectural fit:** Clean if implemented as a read-only Observe-concern tool. The session data is already produced (Claude Code transcripts exist in `~/.claude/`); the gap is indexing and search across workstreams.

### 6.4. From Gastown: Agent Identity and Attribution

**Pattern:** Every agent has a persistent identity with a work history. Enables capability-based routing, A/B model testing, and accountability tracking.

**Implementation path:** Not immediately actionable. Relevant when the orchestrator reaches Phase 3+ (semi-autonomous dispatch). At that point, attribution data would inform routing decisions ("Gemini reviews catch more issues on Go code; route Go reviews to Gemini").

**Architectural fit:** Would extend the Observe concern with historical agent performance data. Low priority until autonomous dispatch is implemented.

---

## 7. Strategic Recommendations

### 7.1. Near-Term: Structured Execution Telemetry

**Priority:** High
**Rationale:** Prerequisite for all other improvements. Without queryable execution records, there is no data to feed autonomous learning, bottleneck analysis, or historical reporting.

**Scope:** Add structured JSON output to keystone-workflow runs. Each run produces a record containing: workflow name, run ID, timestamp, step-by-step outcomes, git commits produced, and final status. Records persist in a known location readable by the orchestrator.

**Constraint:** This should be a minimal addition to existing workflows, not a new component. A post-run script step or keystone-cli enhancement, not a new package.

### 7.2. Medium-Term: Procedural Memory Layer

**Priority:** High
**Rationale:** Closes the Loop 2 gap — the largest scalability constraint on the current process. Transforms the retrospective from a human-driven diagnosis exercise into a human-reviewed approval of AI-generated improvements.

**Scope:** Evaluate CASS Memory System for direct adoption or as a reference implementation for a purpose-built component. Key decision: adopt CASS as an external tool (faster, less control) or build a Remember-concern component that integrates with the skills system (slower, tighter integration).

**Constraint:** The memory layer must be advisory, not authoritative. Skills remain the enforcement mechanism. Memory informs decisions within skill-enforced processes; it does not override or bypass skills.

### 7.3. Medium-Term: Session Indexing

**Priority:** Medium
**Rationale:** Enables cross-agent learning and historical debugging. Currently, knowledge from one agent session is invisible to subsequent sessions unless manually encoded into a skill.

**Scope:** Evaluate CASS for adoption as an Observe-concern tool. If CASS is too heavyweight or doesn't fit the containerized model, evaluate lighter alternatives or build a minimal session indexer that covers Claude Code transcripts.

### 7.4. Long-Term: Skill-Memory Integration

**Priority:** Medium (dependent on 7.2)
**Rationale:** The synthesis described in section 4.3 — skills that reference memory, and memory that proposes skill modifications — is the full continuous improvement loop. This is the system that can be "set loose" with minimal oversight.

**Scope:** Define the integration contract between skills and procedural memory. Skills gain a "consult memory" step. Memory gains a "propose skill modification" capability. The `writing-skills` skill validates proposed modifications. Human approves (initially) or auto-approves within defined bounds (eventually).

**Constraint:** Auto-approval bounds must be conservative. Procedural memory can auto-approve operational-level rules ("this test suite needs retry"). Structural changes to process-level skills (modifying the TDD workflow) require human approval.

### 7.5. The Fourth Concern

**Priority:** Deferred (conceptual)
**Rationale:** The three-concern taxonomy (Isolate/Automate/Observe) has proven stable and useful. Adding a fourth concern (Remember) should be done only when there is a concrete component to classify, not as a speculative taxonomy expansion.

**Trigger:** When either the procedural memory layer (7.2) or session indexing (7.3) is implemented as a distinct component, revisit the taxonomy. If the new component doesn't fit cleanly into Observe, formalize Remember as a fourth concern. If it does fit into Observe (as a subfunction of observation), leave the taxonomy at three.

---

## 8. Sources

### Gastown
- Repository: [github.com/steveyegge/gastown](https://github.com/steveyegge/gastown)
- Architecture overview: [docs/overview.md](https://github.com/steveyegge/gastown/blob/main/docs/overview.md)
- Hooks management: [docs/HOOKS.md](https://github.com/steveyegge/gastown/blob/main/docs/HOOKS.md)
- Formula resolution: [docs/formula-resolution.md](https://github.com/steveyegge/gastown/blob/main/docs/formula-resolution.md)
- Design rationale: [docs/why-these-features.md](https://github.com/steveyegge/gastown/blob/main/docs/why-these-features.md)

### Agent Flywheel
- Website: [agent-flywheel.com](https://agent-flywheel.com)
- Setup repository: [github.com/Dicklesworthstone/agentic_coding_flywheel_setup](https://github.com/Dicklesworthstone/agentic_coding_flywheel_setup)
- CASS Memory System: [github.com/Dicklesworthstone/cass_memory_system](https://github.com/Dicklesworthstone/cass_memory_system)
- NTM (Named Tmux Manager): [github.com/Dicklesworthstone/ntm](https://github.com/Dicklesworthstone/ntm)
- Beads Rust: [github.com/Dicklesworthstone/beads_rust](https://github.com/Dicklesworthstone/beads_rust)
- Claude Code Agent Farm: [github.com/Dicklesworthstone/claude_code_agent_farm](https://github.com/Dicklesworthstone/claude_code_agent_farm)
- Projects overview: [jeffreyemanuel.com/projects](https://jeffreyemanuel.com/projects)

### Agent-Tools Ecosystem (Internal)
- Ecosystem brief: `_bmad-output/planning-artifacts/monorepo-brief.md`
- Keystone-workflows product brief: `_bmad-output/planning-artifacts/keystone-workflows/product-brief-keystone-workflows-2026-02-14.md`
- DAG engine research: `_bmad-output/planning-artifacts/research/technical-dag-engines-for-agent-orchestration-research-2026-02-15.md`
- Sandboxing alternatives research: `_bmad-output/planning-artifacts/research/technical-ai-agent-sandboxing-alternatives-research-2026-02-14.md`
