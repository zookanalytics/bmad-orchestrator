---
moduleCode: bmm
moduleName: Retro Followup
moduleType: Extension
folderName: bmm-workflow-retro-followup
briefFile: _bmad-output/bmb-creations/modules/module-brief-retro-followup.md
stepsCompleted:
  - step-01-load-brief
  - step-02-structure
  - step-03-config
  - step-04-installer (skipped - not needed)
  - step-05-agents (skipped - workflow-only module)
  - step-06-workflows
  - step-07-docs
  - step-08-complete
targetLocation: packages/bmm-retrospective-module/src
created: 2026-01-29
completed: 2026-01-29
status: COMPLETE
---

# Module Build Tracking: Retro Followup

## Module Summary

- **Code:** bmm (matches base module for extension)
- **Name:** Retro Followup
- **Type:** Extension (extends BMM)
- **Target Location:** packages/bmm-retrospective-module/src

## Components

### Agents
None — workflow-only module

### Workflows
1. `retro-followup` — Parse retrospective → AI-route action items → generate YAML
2. `retro-item-execute` — Execute a single item → invoke routed workflow → confirm done

## Build Progress

- [x] Step 1: Load Brief
- [x] Step 2: Structure
- [x] Step 3: module.yaml
- [x] Step 4: Agents (skipped - none)
- [x] Step 5: Workflows
- [x] Step 6: README
- [x] Step 7: TODO
- [x] Step 8: Final Review
