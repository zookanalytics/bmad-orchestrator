---
stepsCompleted: [1, 2, 3]
inputDocuments: []
session_topic: 'AI-first workflow orchestration — command-driven, decomposable work units, evolvable logic, human-optimized handoffs'
session_goals: 'Validate need for new system vs composing existing tools; explore design space across skill portability, workflow chaining, and human re-entry UX; resolve build vs compose vs extend decision'
selected_approach: 'ai-recommended'
techniques_used: ['First Principles Thinking', 'Morphological Analysis']
ideas_generated: ['Fundamentals 1-17', 'Morphological D1-D6']
context_file: '_bmad/bmm/data/project-context-template.md'
technique_execution_complete: false
facilitation_notes: 'Session naturally converged from exploration to concrete experiment definition. Cross-Pollination skipped by user choice — domain is too novel/fast-moving for external analogies to add value. Session pivoted to actionable planning.'
---

# Brainstorming Session Results

**Facilitator:** Node
**Date:** 2026-03-04

## Session Overview

**Topic:** AI-first workflow orchestration — command-driven entry, decomposable work units (beads), evolvable logic, human-optimized handoffs
**Goals:** Validate whether a new orchestration system is needed vs. composing existing tools (Beads, GasTown, BMAD patterns); explore design space; address three core pain points

### Context Guidance

_Project context focuses on software/product development. Key exploration areas: user problems, feature ideas, technical approaches, UX, business model, differentiation, risks, and success metrics. Results may feed into product briefs, PRDs, technical specs, or research activities._

### Session Setup

**Pain Points Driving Exploration:**
1. Skills ecosystem fragmentation — great open-source skills exist but each has own conventions; hard to evolve without forking
2. Workflow chaining is manual glue — connecting steps across context windows, models, and parallel execution requires human-as-scheduler
3. Human re-entry is brutal — too much output, poor context summarization, not optimized for multitasking humans

**Evaluated Tools:**
- **Beads** (steveyegge) — Git-backed graph issue tracker with hash IDs, hierarchical decomposition, semantic links, agent-optimized output
- **GasTown** (steveyegge) — Multi-agent orchestration on Beads; Mayor/Convoy/Polecat model; complex metaphor layer, high coordination overhead
- **Meta Skill** (Dicklesworthstone) — Skill management with SQLite+Git dual persistence, bandit learning, MCP integration, beads-style export
- **Keystone CLI** — Explicit step control but no branching or AI-driven next-step selection
- **Claude Teams** — Multi-agent execution, generally works, but no workflow awareness
- **BMAD** — Planning + guided workflows, but human is the glue, skills not easily evolvable

**Key Tension:** Build vs. compose vs. extend — where does the existing ecosystem fall short enough to justify new work?

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Complex architectural exploration by expert user with months of prior evaluation

**Recommended Techniques:**
- **First Principles Thinking:** Strip away existing tool assumptions to find irreducible requirements
- **Morphological Analysis:** Systematically map solution space across orthogonal dimensions
- **Cross-Pollination:** Skipped — user determined domain too novel for external analogies to add value

**AI Rationale:** User has deep existing knowledge and has been circling the problem — needs assumption-breaking (Phase 1), systematic mapping (Phase 2), and external validation (Phase 3) rather than pure volume generation.

## Phase 1: First Principles — Bedrock Truths

### The Raw Frustrations

1. **The Codification Gap** — Better practices discovered through experience can't be cheaply encoded into the system. Knowledge stays in your head; you become manual middleware.
2. **The Thread Continuity Problem** — Ideas should flow from inception to implementation as a coherent thread, but you're constantly re-injecting yourself to manage transitions. You are the glue.
3. **Framework Lock-In** — Every tool demands total commitment to its worldview. You can't compose the best pieces from different tools.
4. **Observability Across Parallel Work** — When work fans out, you lose the thread. Can't see lineage from idea to current state without deep-diving each branch.
5. **The Human Bandwidth Bottleneck** — Finite attention managing an increasingly parallel AI workforce. Every re-engagement costs context-switching time.

### The Meta-Problem

"Lots of ideas to implement. I can only mentally follow so many things at once. It takes effort every time I dive back into a conversation. I hate getting pulled into things I could delegate with a strong prompt. And I hate not having the necessary context to quickly know what was being done."

### Bedrock Principles

1. **Human attention is the only scarce resource.** Compute is disposable. Development labor is cheap. Use AI resources to reduce human time. It's ok to throw away work if it saves attention.
2. **Organizational knowledge is systems and processes that reliably execute** — not documentation, not individual memory. (Checklist Manifesto insight.)
3. **The atomic unit is a rule** — situational instructions that vary in shape but share a common primitive. All codified knowledge (pre-commit checks, workflow steps, persona guidance, retrospective learnings) is rules to be followed in specific situations.
4. **Rules are immutable** — they get replaced, not edited. Version 1 doesn't become version 2; version 2 supersedes version 1. Event-sourcing for practices.
5. **Rules layer** — base from experts/community, project-specific overrides scoped by context. Like CSS specificity for AI behavior.
6. **Capabilities are plug-ins** — brainstorming, code review, planning are solved problems. You invoke them, not build them. The problem isn't "how to brainstorm well" — it's knowing WHEN to apply brainstorming.
7. **Orchestration is the missing layer** — not decision-making (AI can decide), but the explicit definition of flow constraints: what's mandatory, what's flexible, what's gated, where agents have freedom to improvise. A constraint map.
8. **The constraint spectrum** — each step declares its degree of freedom, from fully prescribed to fully autonomous, with human gates as explicit points. Existing tools force a binary (scripted pipeline or autonomous agent); the real need is per-step constraint declaration.
9. **The feedback loop must be cheap** — rule creation/replacement/observation near-frictionless, or it won't happen. The unit economics of improvement are currently broken.
10. **Locality with live-linking** — rules live where they apply but can be shared across repos without deploy cycles.
11. **Speculative execution is fine** — run multiple paths, discard losers, surface winners. The cost of a bad path is cheap compute, not expensive human time.
12. **Human gate is late and narrow** — don't pull the human in until there's a distilled decision point with the ask, the ancestry, and the relevant context.

### Key Refinements During Exploration

- **The Iteration Barrier:** You don't need perfect skills upfront. You need to cheaply start a rough encoding and have it improve through use. Current systems make even starting expensive (wrong repo, external versioning, deployment overhead).
- **The Locality Problem:** Knowledge about how to work on THIS project lives somewhere else (external BMAD repo, npm package). Project-specific learnings can't live next to the code they apply to.
- **The Agent-Modifies-Wrong-Thing Problem:** When agents try to improve practices, they reach for framework core code (externally versioned) rather than user-space customizations. No clean separation between core behavior and user extension.
- **Routing, Not Execution:** The problem isn't "how to do code review well" — it's "given a situation, how does the system know which capability to invoke, with what context, in what sequence?"

## Phase 2: Morphological Analysis — Solution Space Mapping

### Dimension 1: Rule Architecture → File-Backed Store + Template Injection

**Rule Storage:** File-backed rules store (JSONL, SQLite, or Beads-native). Not file-per-rule, not rules-grouped-by-theme — a queryable store that happens to live as a file. Beads interesting because it bridges file-backed and structured.

**Rule Composition:** Template + Rule Injection model. Skills/capabilities remain standard template files (community-authored). Rules define replacements into template sections. Change a rule, template gets regenerated with overrides. No-replacement template = vanilla copy of original skill. Skill author maintains their template; you maintain your rules; they compose at render time.

### Dimension 2: Orchestration Model → Step-to-Step Handoffs

**Flow Model:** Each step's output includes what comes next, driven by rules. No global graph — flow emerges from each step knowing its exit conditions. AI task list management handles sequencing. Visualization is a derived artifact (generated from chain of rules/handoffs), not a primary authoring surface.

### Dimension 3: Human Interface → Collapsed into Rules

**Finding:** Human engagement isn't a separate architectural layer. Gates, exceptions, escalations are all rules that resolve to "engage the human." The variety is in the trigger (explicit gate, low confidence, high stakes, completion checkpoint) and the presentation (digest summary, decision points, full output). Presentation mode is rule metadata.

### Dimension 4: Execution Model → Bead-Centric Loop

**Model:** Everything is a bead. A bead has: a skill to run, rules that constrain it, exit conditions that define what happens next. The outer loop is trivially simple:
1. Any beads ready? (no open blockers)
2. Pick one. What skill does it need?
3. Run the skill with the bead's context and rules (fresh context per execution)
4. Skill completes. Evaluate exit rules.
5. Exit rules say: create new beads / mark done / engage human / enqueue next.
6. Go to 1.

Claude Teams handles parallel bead execution when rules call for it. The loop never gets complex. Context never blows out.

**Human Re-Entry:** When a bead's exit rule says "engage human," present three layers: (1) why you're here (what rule triggered engagement), (2) the thread (bead ancestry from original idea to current point), (3) the decision needed (assumptions made, options available). Bead graph IS the observability — no separate system needed.

### Dimension 5: Scope & Locality → Live-Linked, No Indirection

**Model:** Rules live in a central location directly accessible from every environment (mounted volume in Docker, devcontainer bind mount). Edit a file, it's live everywhere immediately. No publish cycle, no npm install, no marketplace refresh.

**Config Adaptation:** Rules reference local config rather than forking per-project. A rule checks for `.project/config.yaml` and adapts behavior. The rule stays universal; behavior adapts based on what it finds locally.

### Dimension 6: Feedback & Observability → Execution Logging First

**Model:** Start with rich logging — every bead execution captures what rule fired, what skill ran, inputs, outputs, outcome. More sophisticated analysis (bandit learning via Meta Skill, automated effectiveness signals) layers on top later. Instrument first, optimize later.

### Grand Synthesis: Composition, Not Construction

The system isn't a new framework — it's a **composition layer** for existing tools:

| Component | Source | Status |
|---|---|---|
| Unit of work tracking | Beads | Exists |
| Skill management + learning | Meta Skill | Needs validation |
| Multi-agent execution | Claude Teams | Exists |
| Skill authoring + workflows | BMAD + community | Exists |
| Execution logging | Beads history | May need enrichment |
| Human-facing lineage view | **Build** | Missing |
| The execution loop | **Build** | Missing (but trivially simple) |
| Live-linked rules | **Build** | Missing (directory structure + mounts) |
| Template + rule injection | **Build** | Missing |

**Caveat:** "Exists" reflects tools personally evaluated. The landscape is broader — other tools may address items listed as "Missing." This synthesis is a personal decision framework, not an industry landscape analysis.

## Experiment Definition: Validate Assumption A

**Riskiest assumption:** If rules are instantly editable and immediately available across all environments, will you actually create and iterate on them more?

**Experiment:** Live-linked rules directory — superpowers fork pulled into mono-repo, mounted into every agent-env devcontainer, editable and committable from any environment.

**Success criteria:** Over the next few weeks, do you find yourself writing/modifying rules that you previously would have dealt with manually?

**What you deliberately DON'T build:** Rule database, template injection, execution loop, UI, feedback tracking. Just files in a directory, live everywhere, with a convention that agents check them.
