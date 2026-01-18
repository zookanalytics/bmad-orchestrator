# BMAD Workflow Orchestration Implementation Brief

## Executive Summary

This document captures research and decisions from a conversation about bringing structure to AI agent-driven software development at scale. The conclusion: **BMAD Method is the right methodology**, but we need a thin orchestration layer that eliminates the manual cognitive load of knowing "where am I?" and "what step is next?"

---

## Problem Statement

We currently use BMAD (Breakthrough Method for Agile AI-Driven Development) manually. The methodology is solid—it provides:

- Structured 4-phase lifecycle (Analysis → Planning → Solutioning → Implementation)
- Specialized agents (PM, Architect, Developer, Scrum Master, etc.)
- Artifact management (PRD, Architecture docs, Epic sharding, Stories)
- Context preservation across handoffs

**The friction point:** Triggering each phase manually and knowing which step to trigger next is more complicated than desired. We want the system to know where we are and what comes next.

---

## Research Summary: Alternatives Considered

### Full Methodology Alternatives

| Framework | What It Is | Why We Didn't Choose It |
|-----------|-----------|------------------------|
| **GitHub Spec Kit** | Spec-driven development (Spec → Plan → Tasks → Implement) | Lighter weight, less opinionated about agent roles. Would require rebuilding process structure we already have. |
| **MetaGPT** | Simulates software company with 5 roles (PM, Architect, Project Manager, Engineer, QA) | More automated but less flexible. Roles are less customizable than BMAD. |
| **CrewAI** | Role-based multi-agent orchestration framework | Building blocks, not methodology. Would need to rebuild BMAD-like structure on top. |
| **LangGraph** | Graph-based workflow orchestration | Infrastructure, not methodology. Same issue as CrewAI. |

### Orchestration-Specific Options

| Approach | Assessment |
|----------|------------|
| **State machine framework (LangGraph, etc.)** | Overkill. BMAD workflow is mostly linear, not complex branching. Would require maintaining two parallel state systems. |
| **BMAD MCP Server (third-party)** | Worth evaluating. Claims "automatic workflow progression" but needs validation. |
| **Roll our own on BMAD state file** | **Recommended.** BMAD's `bmm-workflow-status.yaml` already IS the state. We just need a thin interpreter. |

---

## Decision: Build a Thin Orchestration Layer

### Why This Approach

1. BMAD's state file (`bmm-workflow-status.yaml` + `sprint-status.yaml`) already captures workflow state
2. The workflow logic is simple—mostly linear with iteration on stories
3. A state machine framework would require reimplementing BMAD's workflow graph in a second system
4. Estimated effort: 50-100 lines of core logic

### What the Orchestrator Does

1. **Reads** current state from BMAD status files
2. **Computes** next step based on track and completion status
3. **Returns** the agent to load and workflow to run
4. **Optionally** auto-triggers with confirmation prompt

---

## BMAD Workflow Structure (For Implementation Reference)

### Tracks (Determined by `workflow-init`)

- **Quick Flow** (Level 0-1): Bug fixes, simple features. Skips Phase 3.
- **BMad Method** (Level 2): Standard features. All phases.
- **Enterprise** (Level 3+): Large scale. All phases with additional rigor.

### Phase Progression

```
Phase 1: Analysis (Optional)
├── brainstorm-project (optional)
├── research (optional)
└── product-brief (recommended)

Phase 2: Planning (Required)
└── prd (REQUIRED) → generates PRD.md

Phase 3: Solutioning (Required for BMad Method + Enterprise, skip for Quick Flow)
├── create-architecture (required) → generates architecture.md
├── create-epics-and-stories (required) → generates epic files
└── implementation-readiness (gate check)

Phase 4: Implementation (Required)
├── sprint-planning (sets up sprint)
├── For each Epic:
│   ├── epic-tech-context (optional)
│   └── For each Story:
│       ├── create-story (SM generates story file)
│       ├── dev-story (Dev implements)
│       ├── code-review (review)
│       └── story-done (mark complete)
└── Repeat until all epics complete
```

### Key Status Files

- **`docs/bmm-workflow-status.yaml`** - Tracks Phases 1-3 completion
- **`docs/sprint-status.yaml`** - Tracks Phase 4 (stories, epics, sprint progress)

### Agent ↔ Workflow Mapping

| Workflow | Agent |
|----------|-------|
| product-brief | Analyst |
| prd | PM |
| create-architecture | Architect |
| create-epics-and-stories | PM |
| sprint-planning | Scrum Master |
| create-story | Scrum Master |
| dev-story | Developer |
| code-review | (Fresh LLM / separate reviewer) |

---

## Proposed Implementation

### Core Logic (Pseudocode)

```python
def get_next_step(project_path):
    """
    Reads BMAD state files and returns the next workflow to execute.
    
    Returns:
        {
            'phase': int,
            'agent': str,
            'workflow': str,
            'context': dict,  # Additional context like story_id, epic_id
            'status': 'pending' | 'complete'
        }
    """
    workflow_status = load_yaml(f"{project_path}/docs/bmm-workflow-status.yaml")
    track = workflow_status.get('track', 'bmad-method')
    
    # Phase 1: Analysis (all optional, skip to Phase 2 if not started)
    # User can manually invoke these, orchestrator focuses on required paths
    
    # Phase 2: Planning
    if not is_complete(workflow_status, 'phase_2', 'prd'):
        return {
            'phase': 2,
            'agent': 'pm',
            'workflow': 'prd',
            'context': {},
            'status': 'pending'
        }
    
    # Phase 3: Solutioning (skip for quick-flow)
    if track != 'quick-flow':
        if not is_complete(workflow_status, 'phase_3', 'architecture'):
            return {
                'phase': 3,
                'agent': 'architect',
                'workflow': 'create-architecture',
                'context': {},
                'status': 'pending'
            }
        
        if not is_complete(workflow_status, 'phase_3', 'epics'):
            return {
                'phase': 3,
                'agent': 'pm',
                'workflow': 'create-epics-and-stories',
                'context': {},
                'status': 'pending'
            }
        
        if not is_complete(workflow_status, 'phase_3', 'readiness'):
            return {
                'phase': 3,
                'agent': 'architect',  # or dedicated gate agent
                'workflow': 'implementation-readiness',
                'context': {},
                'status': 'pending'
            }
    
    # Phase 4: Implementation
    sprint_status = load_yaml(f"{project_path}/docs/sprint-status.yaml")
    
    if not sprint_status or not sprint_status.get('initialized'):
        return {
            'phase': 4,
            'agent': 'scrum-master',
            'workflow': 'sprint-planning',
            'context': {},
            'status': 'pending'
        }
    
    next_story = find_next_incomplete_story(sprint_status)
    if next_story:
        return {
            'phase': 4,
            'agent': 'dev',
            'workflow': 'dev-story',
            'context': {
                'epic_id': next_story['epic_id'],
                'story_id': next_story['story_id'],
                'story_file': next_story['file_path']
            },
            'status': 'pending'
        }
    
    # All complete
    return {'status': 'complete'}


def find_next_incomplete_story(sprint_status):
    """
    Iterates through epics and stories to find the next one to work on.
    
    Story states: not_started → in_progress → review → done
    """
    for epic in sprint_status.get('epics', []):
        for story in epic.get('stories', []):
            if story.get('state') not in ['done', 'review']:
                return {
                    'epic_id': epic['id'],
                    'story_id': story['id'],
                    'file_path': story.get('file'),
                    'state': story.get('state', 'not_started')
                }
    return None
```

### Integration Options

#### Option A: Claude Code Custom Command

Create a custom slash command that:
1. Calls the orchestrator logic
2. Displays current status and recommended next step
3. On confirmation, loads the appropriate agent and runs the workflow

```
User: /continue
Orchestrator: 
  Current: Phase 2 - Planning
  Status: PRD not started
  Next: Run 'prd' workflow with PM agent
  
  Continue? (y/n)
  
User: y
[Loads PM agent, executes *prd workflow]
```

#### Option B: MCP Tool

Expose as an MCP tool that can be called from any Claude interface:
- `bmad_status()` - Returns current state
- `bmad_next()` - Returns next step recommendation  
- `bmad_continue()` - Executes next step (with confirmation)

#### Option C: Wrapper Script (Simplest)

A script that outputs the next command to run:
```bash
$ ./bmad-next
Next step: Load PM agent, run *prd
Command: claude-code --agent pm --workflow prd
```

---

## Implementation Considerations

### Devcontainer Integration

When implementing, consider how this integrates with the existing devcontainer setup:
- The orchestrator should work within the devcontainer environment
- Access to project files (status yamls, story files) should use container paths
- May want to expose orchestrator as a service or CLI tool within the container

### State File Locations

Default BMAD v6 structure:
```
project/
├── bmad/
│   ├── config.yaml
│   └── _cfg/
│       └── agents/
├── docs/
│   ├── bmm-workflow-status.yaml  ← Primary state
│   ├── sprint-status.yaml         ← Implementation state
│   ├── prd.md
│   ├── architecture.md
│   └── stories/
│       ├── epic-1/
│       │   ├── story-1.md
│       │   └── story-2.md
│       └── epic-2/
│           └── ...
```

### Error Handling

- If status files don't exist, prompt to run `workflow-init`
- If status is corrupted, provide recovery guidance
- If a workflow fails mid-execution, state should remain at current step (not advance)

### Human-in-the-Loop Gates

Preserve BMAD's existing approval gates:
- PRD review before architecture
- Architecture review before epic creation
- Story review before marking complete

The orchestrator should recognize these gates and prompt for human confirmation before advancing.

---

## Success Criteria

The implementation is successful when:

1. **Single command** shows current state and next step
2. **Automatic progression** (with confirmation) through the workflow
3. **No memorization required** - system always knows what's next
4. **Preserves BMAD methodology** - doesn't bypass steps or gates
5. **Works in existing devcontainer** environment
6. **Minimal maintenance** - tracks BMAD state files as source of truth

---

## Next Steps for Implementation

1. **Review existing codebase** - Understand devcontainer setup, existing Claude integration scripts
2. **Locate/create BMAD status files** - Ensure we have examples to work with
3. **Implement core logic** - The `get_next_step()` function
4. **Choose integration point** - Claude Code command, MCP tool, or wrapper script
5. **Test with real project** - Run through a full workflow cycle
6. **Iterate** - Add edge case handling based on real usage

---

## Appendix: BMAD Resources

- **BMAD GitHub**: https://github.com/bmad-code-org/BMAD-METHOD
- **BMAD v6 Quick Start**: In repo at `src/modules/bmm/docs/quick-start.md`
- **Workflow Reference**: https://deepwiki.com/bmadcode/BMAD-METHOD/8-workflow-reference
- **BMM Module Docs**: https://deepwiki.com/bmadcode/BMAD-METHOD/4-development-workflow

---

## Document Metadata

- **Created**: December 2024
- **Purpose**: Implementation brief for BMAD workflow orchestration
- **Context**: To be loaded into Claude instance with repository access
- **Action**: Implement thin orchestration layer based on this specification
