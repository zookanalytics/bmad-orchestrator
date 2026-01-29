# Workflow Routing Reference

**Purpose:** Available workflow options for routing retrospective action items.

---

## Available Workflows

| Workflow | Use Case | Keywords |
|----------|----------|----------|
| `bmad:bmm:workflows:research` | Spikes, investigations, documentation research | explore, evaluate, assess, investigate, research, spike, study |
| `bmad:bmm:workflows:quick-dev` | Code changes, template edits, config updates, simple implementations | add, update, implement, create, fix, modify, change, edit, configure |
| `bmad:bmm:workflows:create-tech-spec` | Items needing detailed technical design before implementation | design, architect, spec, plan, propose |
| `bmad:bmm:workflows:create-story` | Items that should become backlog stories for future epics | story, backlog, epic, feature, requirement |
| `bmad:bmm:workflows:sprint-planning` | Sprint status updates, tracking changes | sprint, status, tracking, update status |
| `bash` | Direct CLI commands | gh issue, npm, git, cli, command, script, run |
| `human` | Requires manual human action, cannot be automated | manual, verify, validate physically, test on device |

---

## Routing Priority

1. **Explicit command** — If the retro item includes a workflow command (e.g., `/bmad:bmm:workflows:research`), use it directly
2. **Detailed spec match** — If the item has a linked specification section with clear deliverables, match based on deliverable type
3. **Keyword match** — Match action text keywords to workflow keywords above
4. **Context inference** — Use surrounding retrospective context to determine intent
5. **Default** — If still ambiguous, use `bmad:bmm:workflows:quick-dev`

---

## Status Values

| Value | Meaning |
|-------|---------|
| `pending` | Not yet executed |
| `done` | Successfully completed |
| `skipped` | Intentionally not executed |

All items are initialized with `status: pending`.
