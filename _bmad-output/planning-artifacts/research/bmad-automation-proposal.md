# BMAD Pipeline Automation Proposal

## Executive Summary

Build a lightweight dispatcher that orchestrates BMAD (Breakthrough Method for Agile AI-Driven Development) workflows across multiple parallel Claude instances. The dispatcher watches for ready features, assigns them to existing devcontainer infrastructure, and tracks each feature through a sequential story → development → testing pipeline.

---

## Current State

### What We Have

| Component | Implementation | Notes |
|-----------|----------------|-------|
| Parallel Claude execution | `claude-instance` script | Launches Claude in isolated devcontainers |
| Sandboxing | Docker containers | Already configured and working |
| Context/Memory | BMAD artifact files | PRD, architecture, stories, etc. |
| Monitoring | tmux | Functional but requires manual attention |
| BMAD method | Installed | Agents, workflows, templates in place |

### What We're Missing

1. **Trigger mechanism** — No automated detection when a feature is ready for work
2. **Status tracking** — No centralized view of which features are in which phase
3. **Workflow sequencing** — No automation of the story → dev → test progression per feature
4. **Dashboard** — No quick-glance visibility across all active work

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BMAD Dispatcher                            │
│                                                                 │
│  • Watches: docs/sprint-status.yaml                             │
│  • Dispatches to: existing claude-instance infrastructure       │
│  • Tracks: feature phase progression                            │
│  • Reports: terminal dashboard                                  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌───────────┐        ┌───────────┐        ┌───────────┐
   │ Container │        │ Container │        │ Container │
   │ feature-a │        │ feature-b │        │ feature-c │
   │           │        │           │        │           │
   │ Branch:   │        │ Branch:   │        │ Branch:   │
   │ feature/a │        │ feature/b │        │ feature/c │
   │           │        │           │        │           │
   │ Phase:    │        │ Phase:    │        │ Phase:    │
   │ dev       │        │ story     │        │ test      │
   └───────────┘        └───────────┘        └───────────┘
```

### Data Flow

1. **User** marks feature as `ready-for-stories` in `sprint-status.yaml`
2. **Dispatcher** detects change, spawns container via `claude-instance`
3. **Container** executes story creation, updates status to `story-complete`
4. **Dispatcher** detects completion, advances to dev phase, re-dispatches
5. **Repeat** for dev → test → complete
6. **Dashboard** shows real-time status across all features

---

## File Specifications

### sprint-status.yaml (Enhanced)

```yaml
# docs/sprint-status.yaml
current_sprint: 3
max_parallel_features: 4  # Limit concurrent work

features:
  - id: user-auth
    status: ready-for-stories  # Triggers pipeline
    prd_section: "2.1"
    priority: high
    branch: feature/user-auth
    
  - id: dashboard-widgets
    status: implementing  # Currently in dev phase
    prd_section: "3.2"
    priority: medium
    branch: feature/dashboard-widgets
    started_at: "2025-12-28T10:30:00Z"
    
  - id: notification-system
    status: complete
    prd_section: "2.4"
    priority: high
    branch: feature/notification-system
    completed_at: "2025-12-27T16:45:00Z"

# Valid status values (in order):
# - backlog
# - ready-for-stories  ← triggers dispatcher
# - creating-story
# - story-complete
# - implementing
# - dev-complete
# - testing
# - test-complete
# - complete
# - blocked (with blocked_reason field)
```

### Dispatcher Configuration

```yaml
# .bmad/dispatcher-config.yaml
polling_interval_seconds: 10
max_parallel_features: 4

claude_instance:
  script_path: ./scripts/claude-instance.sh
  default_args:
    - --dangerously-skip-permissions
    
phases:
  story:
    trigger_status: ready-for-stories
    working_status: creating-story
    complete_status: story-complete
    prompt_template: prompts/story-creation.md
    
  dev:
    trigger_status: story-complete
    working_status: implementing
    complete_status: dev-complete
    prompt_template: prompts/implementation.md
    
  test:
    trigger_status: dev-complete
    working_status: testing
    complete_status: complete
    prompt_template: prompts/testing.md

notifications:
  on_phase_complete: true
  on_error: true
  # Future: slack webhook, etc.
```

---

## Component Specifications

### 1. Dispatcher (`bmad_dispatcher.py`)

**Responsibilities:**
- Poll `sprint-status.yaml` for status changes
- Maintain in-memory state of active features
- Spawn containers via `claude-instance` script
- Detect phase completion and advance workflow
- Respect `max_parallel_features` limit
- Handle errors gracefully (mark feature as blocked)

**Key Functions:**

```python
def load_sprint_status() -> dict:
    """Load and parse sprint-status.yaml"""
    
def get_actionable_features(status: dict) -> list[Feature]:
    """Find features that need work started or advanced"""
    
def dispatch_feature(feature: Feature, phase: Phase) -> subprocess.Popen:
    """Launch claude-instance for a feature/phase combination"""
    
def check_phase_complete(feature: Feature) -> bool:
    """Check if feature's current phase is complete (via status file)"""
    
def advance_feature(feature: Feature) -> None:
    """Move feature to next phase and dispatch if not done"""
    
def main_loop() -> None:
    """Primary polling loop"""
```

**Error Handling:**
- If a container exits non-zero, mark feature as `blocked`
- Add `blocked_reason` field with error details
- Continue processing other features
- Log errors for later review

### 2. Prompt Templates

Each phase uses a template that gets feature-specific values interpolated:

**prompts/story-creation.md:**
```markdown
You are the BMAD Scrum Master agent.

## Context
- Feature ID: {{feature_id}}
- PRD Section: {{prd_section}}
- Branch: {{branch}}

## Task
1. Read `docs/prd.md` section {{prd_section}}
2. Read `docs/architecture.md` for technical constraints
3. Create `docs/stories/{{feature_id}}-story.md` following the template in `docs/templates/story-template.md`

## Requirements
- Include clear acceptance criteria (testable)
- Include technical implementation notes
- List files that will be created/modified
- Note any dependencies on other features

## On Completion
1. Git add and commit: `feat(stories): create {{feature_id}} story`
2. Update `docs/sprint-status.yaml`: set {{feature_id}} status to `story-complete`
3. Git add and commit: `chore: mark {{feature_id}} story complete`
```

**prompts/implementation.md:**
```markdown
You are the BMAD Developer agent.

## Context
- Feature ID: {{feature_id}}
- Story: `docs/stories/{{feature_id}}-story.md`
- Branch: {{branch}}

## Task
1. Read the story file completely
2. Read `docs/architecture/coding-standards.md`
3. Implement the feature per acceptance criteria

## Requirements
- Follow existing code patterns
- Add appropriate comments
- Do not modify files outside the story's scope
- Commit logical chunks with descriptive messages

## On Completion
1. Final commit with implementation
2. Update `docs/sprint-status.yaml`: set {{feature_id}} status to `dev-complete`
3. Git commit: `chore: mark {{feature_id}} implementation complete`
```

**prompts/testing.md:**
```markdown
You are the BMAD QA agent.

## Context
- Feature ID: {{feature_id}}
- Story: `docs/stories/{{feature_id}}-story.md`
- Branch: {{branch}}

## Task
1. Read the story's acceptance criteria
2. Create test files in `tests/{{feature_id}}/`
3. Write tests that verify each acceptance criterion
4. Run the test suite

## Requirements
- Each acceptance criterion should have at least one test
- Tests should be independent and repeatable
- Include both positive and negative cases where appropriate

## On Completion
1. Commit test files: `test({{feature_id}}): add tests`
2. Update `docs/sprint-status.yaml`: set {{feature_id}} status to `complete`
3. Git commit: `chore: mark {{feature_id}} complete`

## If Tests Fail
- Document failures in `docs/stories/{{feature_id}}-test-failures.md`
- Set status to `blocked` with reason
- Do NOT attempt to fix implementation code
```

### 3. Status Dashboard (`bmad_status.py`)

**Responsibilities:**
- Real-time terminal display of all feature statuses
- Show phase, duration, branch for each feature
- Highlight blocked features
- Refresh automatically

**Display Format:**
```
╭─────────────────────────────────────────────────────────────╮
│                 BMAD Pipeline Status                        │
│                 Updated: 2025-12-28 14:32:05                │
├──────────────────┬────────────┬─────────────┬───────────────┤
│ Feature          │ Phase      │ Duration    │ Branch        │
├──────────────────┼────────────┼─────────────┼───────────────┤
│ user-auth        │ 🔨 Dev     │ 12m 34s     │ feature/...   │
│ dashboard        │ 📝 Story   │ 3m 21s      │ feature/...   │
│ notifications    │ 🧪 Test    │ 8m 02s      │ feature/...   │
│ settings         │ ✅ Done    │ —           │ feature/...   │
│ api-v2           │ 🚫 Blocked │ 45m 12s     │ feature/...   │
├──────────────────┴────────────┴─────────────┴───────────────┤
│ Active: 3/4 max │ Completed today: 2 │ Blocked: 1          │
╰─────────────────────────────────────────────────────────────╯
```

**Dependencies:**
- `rich` for terminal formatting
- `pyyaml` for status file parsing

### 4. Integration with claude-instance

The dispatcher calls the existing `claude-instance` script. Required interface:

```bash
./claude-instance.sh \
  --name <feature-id> \
  --branch <branch-name> \
  --prompt-file <path-to-prompt> \
  [--timeout <seconds>] \
  [additional args passed through]
```

**Expected behavior:**
- Creates/attaches to a devcontainer named after the feature
- Checks out the specified branch
- Executes Claude with the provided prompt
- Exits with 0 on success, non-zero on failure

If the current script interface differs, document the actual interface and we'll adapt the dispatcher.

---

## Implementation Plan

### Phase 1: Core Dispatcher (MVP)
- [ ] Create `bmad_dispatcher.py` with basic polling loop
- [ ] Implement feature detection from `sprint-status.yaml`
- [ ] Integrate with `claude-instance` script
- [ ] Implement phase advancement logic
- [ ] Add basic logging

### Phase 2: Status Dashboard
- [ ] Create `bmad_status.py` with rich terminal UI
- [ ] Add duration tracking
- [ ] Add blocked feature highlighting
- [ ] Test alongside dispatcher

### Phase 3: Robustness
- [ ] Add error handling and `blocked` status support
- [ ] Add timeout handling for stuck features
- [ ] Add graceful shutdown (SIGTERM handling)
- [ ] Add configuration file support

### Phase 4: Enhancements (Optional)
- [ ] Web dashboard alternative (simple Flask/FastAPI)
- [ ] Slack/webhook notifications
- [ ] Metrics collection
- [ ] Historical tracking

---

## Directory Structure

```
project-root/
├── .bmad/
│   ├── dispatcher-config.yaml
│   └── prompts/
│       ├── story-creation.md
│       ├── implementation.md
│       └── testing.md
├── scripts/
│   ├── claude-instance.sh        # Existing
│   ├── bmad_dispatcher.py        # New
│   └── bmad_status.py            # New
├── docs/
│   ├── sprint-status.yaml        # Enhanced
│   ├── prd.md
│   ├── architecture.md
│   ├── stories/
│   │   └── {feature-id}-story.md
│   └── templates/
│       └── story-template.md
└── tests/
    └── {feature-id}/
```

---

## Questions for Implementation

1. **What is the exact interface of `claude-instance.sh`?** 
   - What arguments does it accept?
   - How does it handle branch checkout?
   - How is the prompt passed (file, stdin, argument)?

2. **Where should the dispatcher run?**
   - Same machine as devcontainers?
   - Separate orchestration container?

3. **How should we handle branch conflicts?**
   - Auto-rebase from main before each phase?
   - Fail and mark blocked?

4. **Timeout policy?**
   - How long should each phase be allowed to run?
   - Same timeout for all phases or phase-specific?

5. **Notification preferences?**
   - Terminal only for MVP?
   - Future: Slack, email, etc.?

---

## Success Criteria

1. User can mark a feature as `ready-for-stories` and walk away
2. Feature automatically progresses through story → dev → test
3. Multiple features run in parallel (up to configured limit)
4. Status is visible at a glance in terminal dashboard
5. Failures are caught and surfaced, not silent
6. Integrates with existing `claude-instance` infrastructure without modification

---

## Non-Goals (Explicit Exclusions)

- **No new sandboxing** — Use existing devcontainer setup
- **No conversation persistence** — BMAD files are the memory
- **No external dependencies** — Beyond Python stdlib + rich + pyyaml
- **No web UI for MVP** — Terminal dashboard is sufficient
- **No GitHub Actions** — This runs locally
- **No multi-user support** — Single developer workflow

---

## References

- BMAD Method: https://github.com/bmad-code-org/BMAD-METHOD
- Current sprint-status.yaml location: `docs/sprint-status.yaml`
- Existing claude-instance script: `scripts/claude-instance.sh`

---

*Document version: 1.0*
*Created: 2025-12-28*
*For: Claude instance with repository access*
