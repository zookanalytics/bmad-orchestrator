---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowComplete: true
completedAt: "2026-02-13"
inputDocuments:
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/agent-env/product-brief.md'
  - '_bmad-output/planning-artifacts/orchestrator/product-brief.md'
  - '_bmad-output/planning-artifacts/release-infrastructure/product-brief.md'
date: 2026-02-10
author: Node
---

# agent-tools Ecosystem Brief

## Executive Summary

This repository houses a growing ecosystem of independent tools for AI-assisted development. The tools share a common foundation, a common npm scope (`@zookanalytics`), and a common purpose: making it safe and practical to run AI coding agents with increasing automation and decreasing human involvement.

This document is not a product brief for a single shippable thing. It's the **shared context** that the individual tools operate within — the concerns they collectively address, the principles they follow, the integration rules they respect, and the structural decisions already made. It exists so that any tool in this repo (or any agent working on one) understands the bigger picture and its place in it.

The ecosystem addresses three core concerns:

- **Isolate** — Agents run in sandboxed environments where they can't escape, cross-contaminate, or damage the host. Defense in depth: containerized environments, CLI hook restrictions, and extensible mechanisms.
- **Automate** — Development workflows are declared, not manually driven. Steps either require human engagement (workflow pauses) or run autonomously. Everything is observable by default.
- **Observe** — A single pane of glass shows what's happening across all active workstreams: which agents are working, which need attention, what's next.

Each concern is served by one or more components. Components will emerge, split, merge, and be replaced over time. **The concerns and principles are stable. Components are not.**

---

## Ecosystem Context

### Why These Tools Exist Together

AI-assisted development relies on running agents in terminals to do real work: implementing features, reviewing code, running retrospectives. Without tooling, the developer is the orchestration layer — switching panes, pasting prompts, watching for completion, deciding what's next. The constraint on parallel AI development isn't compute or models — it's human attention.

No single tool solves the full picture. Isolation tools don't know about workflows. Workflow engines don't handle interactive terminal sessions. Session managers don't execute declared DAGs. This repository exists because the concerns are interrelated — isolation enables confident automation, automation requires visibility, visibility motivates running more agents — and the tools need shared context to avoid making conflicting assumptions.

### The Three Concerns

The ecosystem organizes around three stable concerns. Each is served by multiple components — present and future — not a single tool.

**Isolate** — Prevent agents from doing anything dangerous. This is defense in depth, not a single mechanism:

- Containerized environments (agent-env) provide filesystem, process, and optional network isolation
- CLI hooks restrict dangerous commands at the agent level
- Potential future mechanisms: network proxies, capability-based permissions, Claude plugins for permission management
- Any tool that prevents an agent from causing harm contributes to Isolate

**Automate** — Replace manual steps in development workflows with declared sequences:

- The orchestrator's workflow engine (to be built) for multi-step declared workflows
- Keystone workflows for single-prompt isolated workflow execution
- Potential future contributors: additional workflow runners, Claude plugins for step orchestration
- Any tool that replaces a manual step in the development sequence contributes to Automate

**Observe** — Give the developer visibility into what's happening across all workstreams:

- The orchestrator's dashboard for cross-workspace status
- Potential future contributors: Claude plugins, notification systems, log aggregators
- Any tool that surfaces status or routes attention contributes to Observe

When evaluating whether to build or integrate an external tool, classify it by concern and assess fit. The three-concern model is the classification system.

### Tool Integration Map

External tools can accelerate specific concerns rather than being competitors to replace:

| Concern | External Tool | How It Could Help |
|---------|--------------|-------------------|
| Automate | wezterm_automata | Terminal pane capture, delta extraction, pattern-based completion detection |
| Isolate | devcontainer CLI | Container lifecycle management — already wrapped by agent-env |
| Automate | Dagu / Temporal | DAG execution engines — potential backend for workflow execution if declared workflows grow complex |
| Observe | tmux control mode | Session and pane status programmatically — already used for output capture |

The principle: embrace external tools that accelerate a concern. Wrap them behind interfaces so they're replaceable. Minimize build time relative to value.

---

## Ecosystem Principles

These apply to every component regardless of which concern it serves. They are the acceptance criteria for the ecosystem.

| Principle | Why It's Constitutional |
|-----------|----------------------|
| **Common foundation** | Components share a common framework — CLI patterns, UI components, error handling, output contracts — via Shared packages. Building a new tool starts with most of the scaffolding done. Cognitive consistency: if you've used one tool, the next feels familiar. Shared is a means, not a mandate — components that genuinely don't benefit from it aren't forced to use it. |
| **Independently upgradeable** | Components upgrade without requiring changes to others, ideally in a running system. This is loose coupling's runtime expression. If upgrading one tool requires restarting or modifying another, the boundaries have leaked. |
| **Trivially installable** | `npm install -g` and it works. Applies to everything — npm packages, Claude plugins, hooks. If installation requires a guide longer than three lines, something's wrong. |
| **Comprehensively tested** | Every component has thorough tests. This isn't just a quality bar — it's the foundation for trusting automation. You can remove human oversight from a step only where tests provide confidence. Testing discipline enables the automation ambition. |

### New Component Checklist

Any new component — tool, plugin, hook, proxy — runs through:

1. **Which concern does it serve?** → Isolate, Automate, or Observe
2. **Does it use the common foundation where beneficial?** → Reuse
3. **Can it be upgraded independently?** → Coupling check
4. **Can it be installed trivially?** → Distribution check
5. **Is it well tested?** → Confidence check

---

## Internal Boundaries

Integration rules are scoped to concerns, not components. These hold regardless of how many components exist.

- Tools in the **Isolate** concern don't know about workflow state
- Tools in the **Automate** concern use Isolate tools via their CLI contracts, never directly managing containers or hooks
- Tools in the **Observe** concern read state but don't mutate it
- Any component that crosses concerns needs an explicit interface contract
- CLI contracts (`--json` output) are the integration mechanism between independently deployed tools
- agent-env owns the workspace data directory structure, including a reserved path for workflow state, without knowing what that state contains

---

## Architectural Decisions

Ecosystem-level structural decisions. Component-specific architecture decisions belong in those components' architecture docs.

**ADR-1: Loosely coupled CLI tools.** Independent packages communicate via CLI contracts. The boundary enforcement prevents scope creep and keeps tools independently testable. Loose coupling also serves cognitive boundaries — when working on agent-env, the workflow engine isn't in your head — and enables parallel AI-assisted development of the ecosystem itself. *Trade-off accepted:* Cross-tool features require CLI contract extensions, which is slower than shared-process calls.

**ADR-2: Workspace-scoped workflows, cross-workspace-ready data model.** Workflows execute within a single workspace. The state model includes workspace identity so the Observe concern can query across workspaces and future triggers don't require a schema migration. No cross-workspace orchestration until a concrete use case demands it. *Trade-off accepted:* Can't run a single workflow across multiple workspaces initially.

---

## Known Risks

Ecosystem-level risks. Component-specific risks belong in those components' briefs.

| Risk | Tripwire | Prevention |
|------|----------|------------|
| **Automate concern has no runtime** | The Automate concern is the most novel and hardest part of the ecosystem. Isolate and Observe are proven patterns. Without a workflow runner, the ecosystem's core value proposition — less human involvement — remains aspirational. | Define the smallest useful automation: a linear sequence of prompts with completion detection. Ship that before a full DAG engine. Completion detection is solvable via tmux output capture. |
| **Loose coupling erodes under pressure** | *Tripwire:* the orchestrator imports from agent-env's internal modules, or agent-env reads workflow state. | Integration rules are concern-scoped, not negotiable. If a tool needs something from another concern, the other tool's CLI contract gets extended. |
| **Shared becomes a coupling mechanism** | *Tripwire:* a component can't be tested without the full monorepo, or Shared contains business logic from a specific tool. | Shared provides framework, not features. Components that don't benefit from Shared aren't forced to use it. Shared imports nothing from any specific tool. |

---

## Target Users

### Primary User

**The developer who uses these tools.** One person, running multiple AI agents across parallel workstreams daily. Comfortable with containers, terminal workflows, and AI-assisted development. Uses agent-env for isolation, will use the orchestrator for automation and visibility.

Detailed personas exist in each tool's own product brief — the "Parallel AI Developer" in agent-env's brief, the "BMAD Power User" in the orchestrator's brief. This document doesn't duplicate those. The ecosystem-level user context is:

- **Uses multiple tools from this ecosystem simultaneously** — agent-env and the orchestrator aren't separate workflows, they're parts of the same workday
- **Evaluates tools by attention cost** — will a tool save more human attention than it costs to learn, install, and maintain? If not, it doesn't get used
- **Cares about the ecosystem's coherence** — tools should feel like they belong together (common foundation), work together (CLI contracts), and stay out of each other's way (concern boundaries)
- **Other developers benefiting is a nice side effect**, not a design target. If the tools are good enough to publish without embarrassment, that's sufficient. Community needs don't override the primary user's workflow.

### Secondary User: AI Agents

**AI agents working on components in this repository.** This document is written as much for them as for the human. When an agent is tasked with building a feature for agent-env or the orchestrator, it reads this document to understand:

- Which concern does this component serve?
- What are the integration boundaries it must respect?
- What ecosystem principles apply to its work?
- What architectural decisions constrain its design?

This is why the document is structured as a taxonomy and ruleset rather than a narrative. Agents need classification systems and clear rules, not persuasive prose. The New Component Checklist, Internal Boundaries, and ADRs are specifically designed to be agent-consumable.

### User Journey

Not applicable at the ecosystem level. Individual tool briefs define their own user journeys. This document's "journey" is: a human or agent is about to work on a component → they read this document → they understand the bigger picture → they make better decisions about scope, boundaries, and integration.

---

## Success Metrics

### How We Know It's Working

Success at the ecosystem level is measured by two things:

**Time to context.** When starting any chunk of work — a new feature for agent-env, a bug fix in the orchestrator, a new component entirely — how quickly does the developer (or agent) understand what exists, where things belong, and what rules apply? If this document, the concern taxonomy, and the integration boundaries make that fast, the ecosystem is working. If someone has to reverse-engineer the relationships between tools by reading source code, it's not.

**Time to embark.** Once context is loaded, how quickly can new work begin? If the common foundation, shared patterns, and clear boundaries mean a new component starts with 80% of scaffolding done and zero ambiguity about scope — that's success. If starting new work requires navigating undocumented assumptions or resolving conflicts between components — that's failure.

### How We Know It's Failing

**The ecosystem costs more than it saves.** If maintaining the shared foundation, enforcing boundaries, extending CLI contracts, and keeping this document current consumes more developer attention than it frees up — the ecosystem is overhead, not infrastructure. The moment the tooling around the tools becomes the bottleneck, something needs to be cut or simplified.

### What We Don't Measure

The concerns taxonomy (Isolate/Automate/Observe), the principles, and the integration rules are hypotheses. They're structured to be useful, and if they're useful, they'll be referenced and respected naturally. If they're not, they'll be ignored and eventually revised. No metric will surface this faster than direct experience. We're not tracking "number of times an agent referenced the taxonomy" — we're trusting that useful things get used and useless things get noticed.

### Business Objectives

N/A. This is a personal tool ecosystem. No revenue, growth, or market targets. The quality bar is: good enough to publish without embarrassment. The success bar is: saves more attention than it costs.

---

## Scope

This document defines ecosystem-level context: the concerns taxonomy, principles, integration boundaries, and structural decisions. Everything component-specific — features, roadmap, architecture, user personas — lives in that component's own planning artifacts.

### Component Documentation

Component planning artifacts follow the convention: `_bmad-output/planning-artifacts/<component-name>/`

Components that represent significant standalone tools (installable CLIs, major plugins) are expected to create their own product brief and architecture documents as they mature. Lightweight components (hooks, small plugins, scripts) need only document which concern they serve and what interfaces they expose.

This ecosystem brief sets boundaries that individual tool documents operate within. Boundary violations surface as cross-package imports. If a component needs to import from another component's internals, that's the signal to extend a CLI contract or revisit the boundary — not to add the import.

### Future Evolution

This document is designed to be stable. The concerns, principles, and integration rules should rarely change. What will change:

- **New components** will emerge and self-classify into concerns using the New Component Checklist
- **The Tool Integration Map** will grow as external tools are evaluated and adopted
- **ADRs** may be added when new ecosystem-level structural decisions arise, or revised when existing decisions are challenged by new evidence
- **Known Risks** will be updated as risks materialize or are retired
