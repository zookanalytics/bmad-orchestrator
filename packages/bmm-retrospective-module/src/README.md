# Retro Followup

Transform retrospective action items into executable workflows.

Parse retros, route to BMM workflows, track completion.

---

## Overview

Retrospectives generate action items. This module closes the gap between "we should do X" and "X is done" by:

1. Parsing retrospective markdown files
2. AI-routing each action item to the appropriate BMM workflow
3. Generating a machine-parseable YAML file for orchestrated execution
4. Tracking completion status

---

## Installation

This module extends BMM. Install via npm + BMAD:

```bash
npm install @zookanalytics/bmm-retrospective-module
bmad install bmm-retrospective-module
```

---

## Quick Start

### 1. Generate Followup YAML

After completing a retrospective:

```
/bmad-bmm-retro-followup <retro-file-path>
```

**Example:**
```
/bmad-bmm-retro-followup _bmad-output/implementation-artifacts/epic-1-retro.md
```

**Output:** `epic-1-retro.followup.yaml` (sibling file)

### 2. Execute Action Items

Execute items one at a time:

```
/bmad-bmm-retro-item-execute <yaml-file> [item-id]
```

**Example:**
```
/bmad-bmm-retro-item-execute _bmad-output/implementation-artifacts/epic-1-retro.followup.yaml
```

Omit `item-id` to execute the next pending item.

---

## Workflows

| Workflow | Purpose |
|----------|---------|
| `retro-followup` | Parse retro → AI-route items → generate YAML |
| `retro-item-execute` | Execute item → invoke workflow → confirm done |

---

## YAML Schema

```yaml
source: string          # Path to source retrospective file
generated: string       # ISO date when generated

items:
  - id: integer         # Sequential ID (1, 2, 3...)
    action_item: integer # Original action item number from retro
    workflow: string    # BMM workflow path, "bash", or "human"
    status: string      # pending | done | skipped
    summary: string     # Actionable summary with context
```

### Workflow Routing Values

| Value | Use Case |
|-------|----------|
| `bmad:bmm:workflows:research` | Spikes, investigations |
| `bmad:bmm:workflows:quick-dev` | Code changes, simple implementations |
| `bmad:bmm:workflows:create-story` | Items that should become stories |
| `bash` | Direct CLI commands |
| `human` | Manual action required |

---

## Module Structure

```
bmm-retrospective-module/
├── package.json
├── _module-installer/
│   └── installer.js
└── src/
    ├── module.yaml
    ├── README.md
    ├── TODO.md
    └── workflows/
        ├── retro-followup/
        │   └── workflow.md
        └── retro-item-execute/
            └── workflow.md
```

---

## Development Status

- [ ] `retro-followup` workflow
- [ ] `retro-item-execute` workflow

See TODO.md for details.

---

_Created via BMAD Module workflow_
