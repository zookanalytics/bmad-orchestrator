# Research Index

This directory contains research documents informing the BMAD Orchestrator project architecture and technology decisions.

---

## BMAD Orchestration Architecture

Core research on how to build the BMAD workflow orchestrator.

- **[bmad-orchestration-implementation-brief.md](./bmad-orchestration-implementation-brief.md)** - Implementation specification for thin orchestration layer on BMAD state files
- **[bmad-automation-proposal.md](./bmad-automation-proposal.md)** - Dispatcher design for multi-feature parallel Claude execution
- **[bmad-build-vs-buy-analysis.md](./bmad-build-vs-buy-analysis.md)** - Strategic analysis of custom bmad-cli vs. Temporal/Prefect/Argo
- **[bmad-filesystem-orchestration.md](./bmad-filesystem-orchestration.md)** - Filesystem-based coordination alternative to Docker socket dependency
- **[bmad-completion-detection-research.md](./bmad-completion-detection-research.md)** - AI agent workflow completion detection patterns and strategies
- **[technical-bmad-marshal-feasibility-2026-01-06.md](./technical-bmad-marshal-feasibility-2026-01-06.md)** - Feasibility analysis of bmad-marshal autonomous orchestration concepts

---

## Tool Evaluations

Assessments of external tools for potential adoption.

- **[claude-agent-sdk-eval.md](./claude-agent-sdk-eval.md)** - Claude Agent SDK evaluation (ADOPT - scored 4.94/5)
- **[codemachine-cli-eval.md](./codemachine-cli-eval.md)** - CodeMachine-CLI evaluation (REJECT - scored 2.47/5)
- **[devpod-eval.md](./devpod-eval.md)** - DevPod container management evaluation (COEXIST strategy)
- **[devpod-in-devcontainer-investigation.md](./devpod-in-devcontainer-investigation.md)** - Investigation of DevPod CLI access from within containers
- **[auto-claude-patterns.md](./auto-claude-patterns.md)** - Reusable patterns extracted from Auto-Claude project
- **[quick-scans.md](./quick-scans.md)** - Quick evaluations of secondary tools (LangGraph, MARSYS, ClaudeBox, etc.)
- **[prototype-decision.md](./prototype-decision.md)** - Phase 2 prototype selection: Claude Agent SDK chosen

---

## Technical Research

Deep-dive technical investigations.

- **[technical-ai-dev-environment-tools-research-2026-01-03.md](./technical-ai-dev-environment-tools-research-2026-01-03.md)** - Comprehensive research on DevPod, CrewAI, MCP, container security, and build-vs-adopt decisions
- **[technical-nimbalyst-deep-dive-research-2026-01-03.md](./technical-nimbalyst-deep-dive-research-2026-01-03.md)** - Deep dive on Nimbalyst WYSIWYG editor and Crystal parallel session manager
- **[technical-state-management-devcontainers-research-2026-01-03.md](./technical-state-management-devcontainers-research-2026-01-03.md)** - State management solutions for multi-DevPod architecture (Git-native recommended)

---

*Last updated: 2026-01-06*
