---
stepsCompleted: [1, 2, 3, 4, 5, 6]
workflowComplete: true
completedAt: "2026-02-14"
inputDocuments:
  - '_bmad-output/planning-artifacts/monorepo-brief.md'
  - 'tech-spec-keystone-installation-rework.md'
  - 'packages/keystone-workflows/package.json'
  - 'packages/keystone-workflows/config/keystone-config.yaml'
  - 'packages/keystone-workflows/workflows/bmad-story.yaml'
  - 'packages/keystone-workflows/workflows/bmad-epic.yaml'
  - 'packages/keystone-workflows/workflows/bmad-epic-status.yaml'
  - 'packages/keystone-workflows/scripts/postinstall.sh'
  - 'docs/commit_specification.md'
date: 2026-02-14
author: Node
---

# Product Brief: keystone-workflows

## Executive Summary

keystone-workflows is a package of declarative automation workflows for AI-assisted development. It codifies sequences of CLI agent invocations (Claude, Gemini, shell commands) as YAML workflow definitions that run on the keystone-cli engine -- a local-first, DAG-based workflow orchestrator. The package serves the Automate concern of the agent-tools ecosystem, replacing manual terminal-switching and prompt-pasting with declared, resumable, improvable pipelines.

This is a pragmatic, need-driven tool. The workflows exist because running AI agents manually doesn't scale past a handful of parallel workstreams. keystone-cli was selected as the engine because it was the closest available match, not because it's the ideal long-term solution. The package is built properly but with full awareness that the underlying engine may be replaced if a more capable DAG solution with human-in-the-loop support emerges. The workflows themselves -- their structure, sequencing, and the learnings baked into them -- are the durable asset. The engine is not.

The package scope is explicitly **workflow execution** -- running declared pipelines to completion with resume-on-failure and human-in-the-loop support. Broader concerns like cross-workspace visibility, observability, and workflow coordination belong to the orchestrator. keystone-workflows does one thing: you tell it to run a workflow, and it executes it.

---

## Core Vision

### Problem Statement

AI-assisted development at scale requires running multiple agents across parallel workstreams: implementing stories, reviewing code with multiple models, verifying tests, committing changes, and iterating through epics. Without automation, the developer is the orchestration layer -- manually invoking agents, watching for completion, deciding what's next, and repeating. The constraint on parallel AI development isn't compute or models -- it's human attention.

### Problem Impact

Every manual step in a development workflow is a context switch. A single story cycle (develop, dual code review, verify, commit) involves at least 5 sequential agent invocations. An epic with 8 stories means 40+ manual interventions. The developer can't do other work during these sequences because each step depends on the previous one completing. Time spent orchestrating agents is time not spent on product decisions, architecture, or the work that actually requires human judgment.

### Why Existing Solutions Fall Short

- **Shell scripts and Makefiles** -- too primitive. No state persistence, no resume-on-failure, no human-in-the-loop support. A failed step means starting over.
- **Enterprise DAG engines (Temporal, Airflow)** -- overbuilt for this use case. Server infrastructure, deployment complexity, and operational overhead that doesn't match a solo developer's workflow.
- **Dagu** -- compelling lightweight DAG runner, but lacks human prompt/approval steps, which are essential for workflows that need developer sign-off at key decision points.
- **Manual terminal management** -- the status quo. Works for 1-2 agents, breaks down at 3+. No codified learning -- each run is ad-hoc.

keystone-cli sits in the gap: lightweight, local-first, YAML-declarative, with human-in-the-loop steps and state persistence for resume. It wasn't built for AI agent orchestration specifically, but it's close enough to be useful now.

### Proposed Solution

A package of encoded operational knowledge about how to run AI agents effectively in development workflows, expressed as declarative pipeline definitions on the keystone-cli engine. The package includes:

- **Workflow definitions** -- Declarative pipelines expressing multi-step agent sequences (story development, epic iteration, code review chains, and future non-BMAD automations). These encode accumulated knowledge about effective agent invocation patterns, failure handling, and sequencing strategies -- not just step ordering.
- **Default configuration** -- keystone-cli config for AI provider setup, engine allowlisting, and operational defaults
- **Standard packaging** -- installable via `npm install -g` in a single command, following the ecosystem's distribution model

The scope boundary is clear: keystone-workflows **executes declared workflows**. It does not provide cross-workspace visibility, observability dashboards, or workflow coordination -- those belong to the orchestrator's Observe concern. keystone-workflows is invoked to run a specific workflow and reports its own execution state. The orchestrator reads that state; keystone-workflows doesn't push it.

The workflows are the iterable artifact. After each epic retrospective, the workflow definitions are refined based on learnings -- adjusting review sequences, modifying prompts, adding or removing steps. This iteration is typically driven by external processes (retrospectives, code reviews, evaluation reports) that surface what should change, rather than by the package itself.

### Key Differentiators

- **Workflows as encoded operational knowledge** -- Each workflow run produces learnings that feed back into definitions via retrospectives and reviews. The value compounds with usage: the package doesn't just define steps, it encodes what the team has learned about how to invoke agents reliably, what prompts produce good results, what review sequences catch the most issues, and what to do when agents misbehave.
- **Beyond simple DAGs** -- Running AI agents is fundamentally harder than running scripts. Agent steps have unpredictable duration, produce output that requires semantic interpretation to judge success, create side effects (file changes, git commits) that are the actual deliverable, and may need re-invocation with adjusted instructions. This isn't a thin orchestration layer -- it's a more complex execution model that takes everything about a DAG and compounds it with agent-specific concerns.
- **Two modes of human-in-the-loop** -- Mode 1: *Gates* -- simple approve/reject decisions before proceeding. Mode 2: *Collaboration* -- parking the workflow while the human performs substantial work elsewhere (e.g., running an interactive retrospective in another terminal) and resuming when ready. Both are essential; most workflow engines only support Mode 1.
- **Dead-simple distribution** -- One command to install, zero configuration to start running workflows. If it takes more than `npm install -g` to get working, something is wrong.
- **Pragmatic replaceability** -- Built properly as a package but with explicit awareness that keystone-cli may be superseded. Workflows are simple enough to rewrite for a new engine if needed; the sequencing knowledge transfers even if the syntax doesn't.

### Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Engine gaps become the bottleneck** -- keystone-cli treats agents as scripts with no success/failure detection, no interactive prompt support, and clunky resume. Workarounds accumulate as complex shell steps, making workflows brittle. | High | Maintain clear research criteria for what the ideal engine looks like. Regularly re-evaluate whether keystone-cli (or a fork enhancement like a `cli_agent` step type) still meets needs, or whether a better DAG runner has emerged. Research should be cheap to re-run as the landscape evolves. |
| **Scope creeps into orchestrator territory** -- Workflow-level intelligence grows into dashboards, cross-workspace queries, and coordination features that duplicate the orchestrator. | Medium | Enforce the boundary: keystone-workflows owns execution of a given workflow. Visibility, observability, and coordination are explicitly out of scope. |
| **Distribution friction kills usage** -- Installation requires multiple steps, config placement, or debugging. The developer defaults back to manual terminal commands. | Medium | Installation must be a single `npm install -g` command. First-run initialization handles defaults. The tech-spec rework for installation must be executed, not just planned. |

### Engine Evaluation Criteria

To support regular re-evaluation of keystone-cli as the workflow engine, the following criteria capture what keystone-workflows needs from any engine:

- **Agent-aware execution** (primary differentiating criterion) -- Understand that a step is invoking an AI agent, not a script. This means: semantic interpretation of agent output to determine success/failure (not just exit codes), handling unpredictable execution duration, awareness that side effects (file modifications, git operations) are the deliverable, and support for re-invocation with adjusted instructions when output is unsatisfactory. This is the fundamental gap in every general-purpose DAG runner -- they treat steps as black boxes with exit codes, but agent steps are fundamentally more complex.
- **Declarative workflow definitions** -- Define step sequences, dependencies, inputs/outputs in a declarative format
- **State persistence and resume** -- Failed workflows resume from last checkpoint, not from scratch
- **Human-in-the-loop steps (both modes)** -- Gate mode: pause for simple approval/rejection. Collaboration mode: park the workflow while the human performs substantial work elsewhere, resume on signal.
- **Shell and script step types** -- Execute CLI commands and inline scripts
- **Sub-workflow composition** -- Invoke one workflow from another (foreach iteration, nesting)
- **Conditional execution** -- Skip steps based on prior step output
- **Timeout and retry** -- Per-step timeout and retry with backoff
- **Local-first** -- No server infrastructure, runs on developer's machine

---

## Target Users

### Primary User

The sole developer of the agent-tools ecosystem, running multiple AI agents across parallel workstreams daily. Comfortable with containers, terminal workflows, CLI tools, and AI-assisted development. Uses keystone-workflows to offload sequential agent invocations that would otherwise require constant manual attention.

**Context:** Working across multiple concurrent development efforts (features, reviews, infrastructure), where each workstream involves multi-step agent pipelines. The bottleneck is human attention, not compute. Every workflow that runs unattended frees time for work that actually requires human judgment -- architecture decisions, product direction, and the creative work that agents can't do.

**Current workaround:** Manually invoking agents in terminals, watching for completion, deciding what's next. This works for 1-2 parallel workstreams and breaks down beyond that.

**Success looks like:** Kick off a workflow, do other work, come back when it needs a human decision or when it's done. Failed workflows resume without re-running completed steps. New workflows are easy to define by copying and modifying existing ones.

### Secondary Users

N/A. This is a single-user tool. No other developers, CI systems, or programmatic consumers are planned. If that changes, this section gets revisited.

### User Journey

- **Discovery:** Not applicable -- the user is the creator.
- **Onboarding:** `npm install -g @zookanalytics/keystone-workflows` installs the workflows. keystone-cli discovers them automatically. If this takes more than one command, something is wrong.
- **Core Usage:** Invoke a workflow by name (`keystone run bmad-epic --epic_id env-3`). Monitor progress occasionally. Respond to human-in-the-loop prompts when the workflow pauses. Review results when complete.
- **Success Moment:** An entire epic's worth of stories is developed, reviewed, verified, and committed while the developer was working on something else.
- **Long-term:** After each epic retrospective, the workflow definitions are tweaked based on learnings. Over months, the workflows encode increasingly refined operational knowledge about effective agent orchestration. The package becomes more valuable with each iteration cycle.

---

## Success Metrics

### How We Know It's Working

- **Unattended epic execution** -- An epic's worth of stories runs through the full pipeline (dev, review, verify, commit) without requiring manual intervention beyond the designed human-in-the-loop pause points. The developer kicks it off and comes back to results.
- **Easy post-retro modification** -- When a retrospective identifies a workflow improvement, the change is straightforward to make. Edit the YAML, test it on the next run. If modifying a workflow feels like a chore, the encoding format or structure is wrong.
- **Resume works reliably** -- When a step fails (and steps will fail -- agents are unpredictable), the workflow resumes from the failed step without re-running completed work. This is the minimum bar for the workflow being better than manual invocation.

### How We Know It's Failing

- **Fails more often than it works** -- If the developer spends more time debugging workflow failures, fixing resume state, or working around engine quirks than they save by not running commands manually, the tool is net-negative. The threshold is a feeling, not a number -- but it's an unmistakable feeling.
- **Installation or setup becomes a hassle** -- If getting workflows running after a container rebuild or update requires troubleshooting, the distribution model is broken.
- **Workflows ossify** -- If the YAML files stop being updated after retrospectives because the cost of modification is too high, the "encoded operational knowledge" value proposition has failed. The workflows become static config, not living artifacts.

### Business Objectives

N/A. This is a personal tool ecosystem. No revenue, growth, or market targets. The quality bar from the ecosystem brief applies: good enough to publish without embarrassment. The success bar: saves more attention than it costs. That's a felt sense, not a metric -- and that's fine.

---

## Scope

### Core Features (MVP)

The MVP is not about building new functionality -- it's about properly packaging and distributing what already works. The existing workflows (bmad-story, bmad-epic, bmad-epic-status) are functional. The MVP makes them installable, upgradeable, and aligned with monorepo best practices.

**1. Clean installation and distribution**
- Package publishes to npm as `@zookanalytics/keystone-workflows`
- Installs via `npm install -g @zookanalytics/keystone-workflows`
- Remove the postinstall.sh script and its clone-and-exec pattern
- First-run initialization handles default config and workflow placement without overwriting user modifications
- Upgrades work cleanly (`npm update -g`)

**2. Existing workflow definitions**
- `bmad-story.yaml` -- Single-story pipeline (dev, dual code review, verify, commit)
- `bmad-epic.yaml` -- Epic iterator using sprint-status.yaml parsing
- `bmad-epic-status.yaml` -- Alternative epic iterator using BMAD workflow-status queries
- Default keystone-cli configuration (`keystone-config.yaml`)

**3. Monorepo alignment**
- Package structure follows established patterns from agent-env and other packages
- Changesets integration for versioning
- CI/CD publish workflow consistent with existing packages

### Out of Scope for MVP

- **New workflow types** -- Non-BMAD workflows (mockups, docs sync, etc.) will be added via individual tech specs as needs arise, not planned upfront
- **Workflow-level intelligence** -- Awareness of what's runnable, epic status querying, and similar features belong to the future, likely informed by orchestrator development
- **keystone-cli fork enhancements** -- The `cli_agent` step type and other engine improvements are a separate concern with its own evaluation and research process
- **Agent-aware execution** -- Semantic output interpretation, success/failure detection beyond exit codes. This is the long-term vision but not MVP
- **Orchestrator integration contracts** -- CLI contracts for the orchestrator to read workflow state. Premature until the orchestrator's Observe concern is built

### MVP Success Criteria

- `npm install -g @zookanalytics/keystone-workflows` works in a fresh devcontainer
- `npm update -g @zookanalytics/keystone-workflows` upgrades without losing user-modified config or workflows
- Existing workflows (`bmad-story`, `bmad-epic`, `bmad-epic-status`) run successfully via keystone-cli after installation
- Package publishes through the monorepo's existing CI/CD pipeline with changesets

### Future Vision

New workflows will be created as needed, driven by tech specs rather than upfront planning. The product brief and engine evaluation criteria serve as the guide for each new workflow or engine enhancement. Expected future directions:

- **Additional BMAD workflows** -- Sprint-level automation, standalone retro workflows, planning workflows
- **Non-BMAD workflows** -- Documentation sync, mockup generation, and other development automations that benefit from declared pipelines
- **Engine evolution** -- Either enhancing the keystone-cli fork (e.g., `cli_agent` step type) or migrating to a better-suited engine, guided by regular re-evaluation against the Engine Evaluation Criteria
- **Workflow-level intelligence** -- Knowing what workflows are available, what's runnable given current project state, and surfacing that information for the orchestrator to consume
