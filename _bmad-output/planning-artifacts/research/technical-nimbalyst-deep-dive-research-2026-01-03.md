# Technical Research: Nimbalyst Deep Dive

**Date:** 2026-01-03
**Research Type:** Technical
**Topic:** Nimbalyst - UI for Claude Code with WYSIWYG Editor
**Context:** Re-evaluation based on BMAD Discord intel

---

## Executive Summary

Nimbalyst is significantly more relevant than the initial 5-minute quick scan suggested. It's a free, local Electron-based desktop application providing a proper UI for Claude Code with WYSIWYG markdown editing, visual AI diffs, and parallel session management. The company (Stravu) also maintains **Crystal**, an open-source MIT-licensed tool for managing parallel Claude Code sessions in git worktrees.

**Key Findings:**
- **Not just a session manager** - Full WYSIWYG editor with inline AI diffs
- **Parallel session orchestration** - Manages multiple Claude Code agents simultaneously
- **Worktrees coming** - Discord confirms native worktree support being added
- **Crystal companion** - Open source worktree-based parallel session manager already available
- **BMAD-relevant** - Could serve as UI layer for document-centric workflows

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Nimbalyst Core Features](#nimbalyst-core-features)
3. [Crystal - Parallel Session Manager](#crystal---parallel-session-manager)
4. [Technical Architecture](#technical-architecture)
5. [BMAD Workflow Relevance](#bmad-workflow-relevance)
6. [Comparison to Original Assessment](#comparison-to-original-assessment)
7. [Recommendations](#recommendations)
8. [Sources](#sources)

---

## Product Overview

### What is Nimbalyst?

Nimbalyst is a desktop application that provides a graphical interface for Claude Code, replacing terminal-based workflows with a visual workspace. It combines:

- **WYSIWYG markdown editing** with real-time rendering
- **AI diff visualization** in red/green format for reviewing changes
- **Session management** for organizing and resuming Claude Code sessions
- **Document-session linking** - sessions tied to specific documents

### Company: Stravu

Stravu produces both Nimbalyst (closed-source, free) and Crystal (open-source, MIT). The Discord comment about "adding worktrees soon" suggests convergence between the two products.

### Target Users

1. **Product Managers** - "Best way for PMs to think, research, write, mockup, and plan with agents"
2. **Developers** - Visual workflow for Claude Code development

### Availability

| Platform | Status |
|----------|--------|
| macOS 10.15+ | Available |
| Windows 10+ | Available |
| Linux | Available |
| **Price** | **Free** |
| **Requirement** | Claude Pro or Max subscription |

---

## Nimbalyst Core Features

### 1. WYSIWYG Markdown Editor

**Capabilities:**
- Real-time markdown rendering (not plaintext)
- Visual editing of documents, tables, lists
- Mermaid diagram support with inline rendering
- HTML mockup editing with Claude Code annotations
- Data model building with export to standard formats

**User Feedback:**
> "I can see the changes in rendered markdown instead of having to view them plaintext" - HN commenter

### 2. AI Diff Visualization

When Claude Code makes changes:
- **Red highlighting** for deletions
- **Green highlighting** for additions
- **Per-change acceptance** - approve/reject individual modifications
- **Human oversight maintained** - nothing applied without explicit approval

### 3. Session Management

**Core Capabilities:**
- **Document-session linking** - Sessions tied to specific documents
- **Search and resume** - Find previous sessions quickly
- **Parallel session view** - Manage multiple agents simultaneously
- **Session-as-context** - Previous sessions inform current work

**Agent Manager View:**
- Switch to dedicated view for managing multiple concurrent sessions
- Visual status indicators per session
- Cross-session coordination

### 4. Git Integration

- Git status visibility within UI
- Commit workflows integrated
- Code review capabilities
- Open storage in plain files on disk

### 5. Content Types Supported

- Markdown documents
- HTML mockups
- Mermaid diagrams
- Data models
- Tables and structured content
- Images embedded in markdown
- Code files

---

## Crystal - Parallel Session Manager

Crystal is Stravu's **open-source** (MIT License) companion tool focused specifically on parallel development workflows using git worktrees.

### Core Concept

> "Each session operates in its own git worktree, preventing conflicts between parallel development efforts."

### Key Features

| Feature | Description |
|---------|-------------|
| **Worktree Isolation** | Each Claude Code session in separate worktree |
| **Conflict Prevention** | Parallel sessions can't overwrite each other |
| **Automatic Cleanup** | Worktrees cleaned when sessions deleted |
| **Branch Management** | Support existing branches or create new |
| **Diff Visualization** | Syntax-highlighted change viewing |
| **Commit Tracking** | History with stats (additions, deletions, files) |
| **Rebase/Squash** | Git workflow operations within app |
| **Run Scripts** | Execute tests directly in Crystal |

### Use Cases

1. **Comparative Solutions** - Run same problem through multiple approaches simultaneously
2. **Parallel Feature Development** - Multiple features developed in isolation
3. **UX Experimentation** - Try different design variations concurrently
4. **Implementation Analysis** - Compare strategies side-by-side

### Technical Details

- **Repository:** https://github.com/stravu/crystal
- **Stars:** ~2,700
- **License:** MIT
- **Tech Stack:** TypeScript, Electron, pnpm
- **Platforms:** macOS (Homebrew), Linux/Windows (source build)

### How Crystal Works

1. Create sessions from prompts → isolated git worktrees
2. Iterate with Claude Code → auto-commits each iteration
3. Review diffs → make manual edits as needed
4. Squash commits → merge to main branch

---

## Technical Architecture

### Nimbalyst Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron |
| Text Editor | Lexical (Meta's editor library) |
| UI | React |
| Distribution | Auto-updating desktop app |

### Integration Model

```
┌─────────────────────────────────────┐
│           Nimbalyst UI              │
│  ┌───────────────────────────────┐  │
│  │  WYSIWYG Markdown Editor      │  │
│  │  (Lexical)                    │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  Session Manager              │  │
│  │  - Document-session linking   │  │
│  │  - Parallel agent tracking    │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  AI Diff Viewer               │  │
│  │  - Red/green change display   │  │
│  │  - Per-change approval        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│         Claude Code CLI             │
│  (Anthropic Pro/Max subscription)   │
└─────────────────────────────────────┘
```

### Data Storage

- **Open format** - Plain markdown files on disk
- **Git-compatible** - Files can be version controlled
- **No lock-in** - Documents are standard markdown

---

## BMAD Workflow Relevance

### Re-Assessment

**Original Quick Scan Verdict:** "Session manager, not orchestrator" - EXCLUDE

**Revised Assessment:** Nimbalyst + Crystal provide complementary capabilities relevant to BMAD:

### How Nimbalyst Could Help BMAD

| BMAD Need | Nimbalyst Capability |
|-----------|---------------------|
| PRD authoring | WYSIWYG markdown with AI assistance |
| Architecture docs | Mermaid diagrams, structured documents |
| Story writing | Visual editing with Claude Code iteration |
| Document review | AI diff visualization for changes |
| Multi-agent tracking | Session manager for parallel agents |

### How Crystal Could Help BMAD

| BMAD Need | Crystal Capability |
|-----------|-------------------|
| Parallel story development | Isolated worktrees per story |
| Approach comparison | Run different implementations simultaneously |
| Dev phase acceleration | Multiple devs running concurrently |
| Safe experimentation | Changes isolated until intentionally merged |

### Potential Integration Points

1. **Document Phase UI** - Use Nimbalyst for PRD, architecture, stories creation
2. **Parallel Dev Phase** - Use Crystal to run multiple story implementations
3. **Session Continuity** - Resume agent sessions across workflow phases
4. **Visual Progress Tracking** - Agent Manager view for orchestration visibility

### What It's NOT

- **Not an orchestrator** - Doesn't replace Claude Agent SDK for agent coordination
- **Not workflow automation** - Manual session creation, no BMAD workflow awareness
- **Not agent-to-agent handoff** - Sessions are independent

### Verdict: Complementary Tool

Nimbalyst/Crystal are **UI/UX layer tools** that could sit on top of BMAD workflows, not replace orchestration. They solve the "Claude Code in a proper interface" problem without solving the "multi-agent orchestration" problem.

---

## Comparison to Original Assessment

| Aspect | Original Scan | Updated Assessment |
|--------|---------------|-------------------|
| **Duration** | 5 minutes | 45+ minutes deep dive |
| **Classification** | Session manager | WYSIWYG editor + session manager |
| **Relevance** | "Likely not relevant" | Complementary UI layer |
| **Worktrees** | Not mentioned | Coming to Nimbalyst; available in Crystal |
| **Open Source** | Not assessed | Crystal is MIT licensed |
| **BMAD Value** | EXCLUDE | CONSIDER for UX improvement |

---

## Recommendations

### For BMAD Project

1. **Don't use for orchestration** - Claude Agent SDK remains the correct choice
2. **Consider for document authoring** - WYSIWYG could improve PRD/architecture workflow
3. **Evaluate Crystal for parallel dev** - Open source worktree solution worth testing
4. **Monitor worktree integration** - Discord suggests this is coming to Nimbalyst

### Next Steps if Interested

1. Download and test Nimbalyst with BMAD document workflows
2. Evaluate Crystal for parallel story development in Phase 4
3. Track Discord for worktree feature release in Nimbalyst
4. Consider contributing to Crystal given MIT license

### Not Recommended

- Replacing devcontainer approach with Nimbalyst
- Using for agent orchestration (not designed for this)
- Depending on closed-source Nimbalyst for critical infrastructure

---

## Sources

1. [Nimbalyst Official Site](https://nimbalyst.com) - Product overview and features
2. [Nimbalyst GitHub](https://github.com/Nimbalyst/nimbalyst) - Public releases and issue tracking
3. [Crystal GitHub](https://github.com/stravu/crystal) - Open source parallel session manager
4. [Nimbalyst for Product Managers](https://nimbalyst.com/for-product-managers) - Use case documentation
5. [Crystal Blog Post](https://nimbalyst.com/blog/crystal-supercharge-your-development-with-multi-session-claude-code-management) - Crystal feature overview
6. [Hacker News Discussion](https://news.ycombinator.com/item?id=46318191) - Community feedback
7. [Hacker News (earlier)](https://news.ycombinator.com/item?id=46048338) - Initial launch discussion
8. [Git Worktrees with Claude Code](https://dev.to/datadeer/part-2-running-multiple-claude-code-sessions-in-parallel-with-git-worktree-165i) - Worktree pattern context
9. [incident.io Blog](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees) - Worktree workflow patterns

---

## Appendix: Key Discord Intel

From BMAD Discord:
> "UI for BMAD with Claude Code. WYSIWYG markdown editor. Session Management."
> "Claude Code in a proper interface. We are adding worktrees soon."

This confirms:
- Active development continuing
- Worktree feature in roadmap
- Community interest in BMAD + Nimbalyst integration
