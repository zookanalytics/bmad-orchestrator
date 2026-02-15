# @zookanalytics/keystone-workflows

Declarative automation workflows for AI-assisted development on [keystone-cli](https://github.com/ZookAnalytics/keystone-cli).

## Workflows

### `bmad-story`
Main workflow for developing a single story.
- **Pre-flight:** Checks git state.
- **ATDD (Optional):** Designs acceptance tests.
- **Development:** Implements the story using AI agents.
- **Review:** Adversarial code review by Gemini and Claude.
- **Verification:** Ensures all tests pass.
- **Commit:** Automatically commits changes.

**Inputs:**
- `story_id`: The ID of the story to process (e.g., `1-1-initialization`).
- `use_tea`: Boolean (default `false`). Enables Test-Evidence-Architecture (TEA) steps.

### `bmad-epic`
Iterates through all stories in an epic by parsing `sprint-status.yaml`.
- Performs architecture validation and readiness checks.
- Processes each story sequentially using `bmad-story`.
- Generates a summary report.
- **Note:** Only processes stories not marked as `done` in sprint-status.yaml.

**Inputs:**
- `epic_id`: The ID of the epic (e.g., `env-1`).
- `sprint_status_path`: Path to `sprint-status.yaml` (default: `_bmad-output/implementation-artifacts/sprint-status.yaml`).
- `use_tea`: Boolean (default `false`). Enables TEA steps for all stories.

### `bmad-epic-status`
Iterative epic processor that queries for the next story dynamically. Useful for workflows where the story list might change during execution.

**Inputs:**
- `epic_id`: The ID of the epic (e.g., `3c`).
- `require_approval`: Boolean (default `true`). Require human approval after each story.
- `max_stories`: Number (default `10`). Maximum stories to process in one run.
- `use_tea`: Boolean (default `false`). Enable TEA steps in story workflows.

## Concepts

### Test-Evidence-Architecture (TEA)
When `use_tea` is enabled, workflows follow the TEA/ATDD methodology:
1. **Acceptance Test Design**: Generate failing acceptance tests based on story criteria before implementation
2. **Development**: Implement features to make tests pass
3. **Traceability Check**: Verify implementation satisfies all acceptance criteria

This ensures test-driven development with clear traceability from requirements to implementation.

## Usage Examples

### Process a single story
```bash
keystone run bmad-story --story_id=1-1-initialization
```

### Process a single story with TEA
```bash
keystone run bmad-story --story_id=1-1-initialization --use_tea=true
```

### Process all stories in an epic
```bash
keystone run bmad-epic --epic_id=env-1
```

### Process an epic with TEA and custom sprint status path
```bash
keystone run bmad-epic --epic_id=env-1 --use_tea=true --sprint_status_path=./my-sprint.yaml
```

### Iteratively process epic stories
```bash
keystone run bmad-epic-status --epic_id=3c --max_stories=5
```

## Troubleshooting

### Workflow fails to find story file
Ensure your story files are located in the path specified in `sprint_status_path` and follow the naming convention `{epic_id}-{story_num}-{story-name}.md`.

### Temp file errors
If you see temp file errors, check that `/tmp/` has write permissions and sufficient disk space.

### Git state warnings
The pre-flight check will warn about uncommitted changes. Commit or stash changes before running workflows to avoid confusion about what the workflow modified.

### Story marked done but still being processed
Check your `sprint-status.yaml` format. Stories should be marked with `: done` (with space) to be excluded from `bmad-epic`.

## Installation

```bash
npm install -g @zookanalytics/keystone-workflows
```

This installs the workflows to `~/.keystone/workflows/` and a default configuration to `~/.config/keystone/config.yaml`.
