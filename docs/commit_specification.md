# Commit Specification

## Commit Message Convention

The project uses [Conventional Commit Specification](https://www.conventionalcommits.org/en/v1.0.0/#specification), with the specification repeated below.

### Great Descriptions

A commit messages should focus on explaining what and why of the change as opposed to focusing on how.
If you don't know why a change is being made, ask, find out, and then include it in the commit body.

### Types

- Changes relevant to the API or UI:
  - `feat` Commits that add, adjust or remove a new feature
  - `fix` Commits that fix a bug of a preceded `feat` commit
- `refactor` Commits that rewrite or restructure code without altering API or UI behavior
  - `perf` Commits are special type of `refactor` commits that specifically improve application performance (runtime speed, memory usage, etc.).
    Do not use for CI/CD optimizations - use `build` instead.
- `style` Commits that address code style (e.g., white-space, formatting, missing semi-colons) and do not affect application behavior
- `test` Commits that add missing tests or correct existing ones
- `docs` Commits that exclusively affect documentation
- `build` Commits that affect build-related components such as build tools, dependencies, project version, CI/CD pipelines, workflow optimizations, ...
- `ops` Commits that affect operational components like infrastructure, deployment, backup, recovery procedures, ...
  Do not include .devcontainer changes here.
- `security` Commits that affect security in production code or operational systems.
  Do not use for development environment security configurations (e.g., `.devcontainer` firewall rules) - use `chore` instead.
- `chore` Miscellaneous commits including development environment configuration (e.g., `.devcontainer`, `.gitignore`, editor settings, ...)
- `revert` Commits that directly revert a previously made change

### Scopes

The `scope` provides additional contextual information about which part of the codebase is affected.

Scopes are **encouraged** for most commit types but **optional** for inherently clear or cross-cutting changes.

**When to use scopes:**

- **Required for:** `feat`, `fix`, `refactor`, `perf`, `test`, `build`, `ops`, `security`
- **Optional for:** `docs`, `style`, `chore`, `revert` (type alone is usually sufficient)

**Examples:**

- ✅ `feat(app): add user dashboard` - scope clarifies which part of app
- ✅ `docs: update README` - type alone is clear (no redundant `docs(docs)`)
- ✅ `style: apply prettier formatting` - cross-cutting change, scope not needed
- ✅ `chore: update .gitignore` - maintenance task, type is sufficient

#### Standardized Scopes

| Scope              | Description                                                             | Example                                                  |
| ------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `ai-tools`         | Claude Code, Gemini CLI, custom commands, skills, prompts               | `feat(ai-tools): add documentation review skill`         |
| `bmad-dashboard`   | TUI dashboard package for DevPod orchestration                          | `feat(bmad-dashboard): add worker list component`        |
| `bmad-orchestrator`| BMAD workflow automation package                                        | `feat(bmad-orchestrator): add task queue`                |
| `ci`               | GitHub Actions workflows, CI/CD pipelines, automation                   | `feat(ci): add automated issue labeling workflow`        |
| `claude-instance`  | Instance management CLI package                                         | `fix(claude-instance): handle connection timeout`        |
| `deps`             | Package updates, dependency changes, version upgrades                   | `build(deps): upgrade typescript to 5.x`                 |
| `devcontainer`     | Development container configuration, scripts, environment setup         | `feat(devcontainer): add DNS logging`                    |
| `docs`             | Project documentation, guides, specifications                           | `docs: add pull request workflow guidelines`             |
| `git-workflow`     | Git commands and skills package                                         | `feat(git-workflow): add branch cleanup command`         |
| `tests`            | Test files, test configuration, test utilities (unit, integration, e2e) | `test(tests): add visual regression tests`               |

#### Scope Selection Guidelines

| Directory/File Pattern                    | Scope              |
| ----------------------------------------- | ------------------ |
| `.claude/`, `.gemini/`                    | `ai-tools`         |
| `packages/bmad-dashboard/`                | `bmad-dashboard`   |
| `packages/bmad-orchestrator/`             | `bmad-orchestrator`|
| `packages/claude-instance/`               | `claude-instance`  |
| `packages/git-workflow/`                  | `git-workflow`     |
| `.github/workflows/`                      | `ci`               |
| `package.json`, `pnpm-lock.yaml`          | `deps`             |
| `.devcontainer/`                          | `devcontainer`     |
| `docs/`, `*.md`                           | `docs`             |
| `**/__tests__/`, `*.test.ts`, `*.spec.ts` | `tests`            |

**When changes span multiple scopes:**

Choose the scope that represents the primary intent of the change.
If truly equal, prefer the scope that matches the user-facing impact.

**Multi-scope examples:**

- Adding CI workflow that validates docs → Use `ci` (primary mechanism)
- Updating app components and test files for a feature → Use `app` (user-facing impact)
- Refactoring tests across multiple test types → Use `tests` (primary scope of work)
- Docs change that also updates a config file → Use `docs` (primary intent)

#### Restrictions

- **Do not** use issue identifiers as scopes (e.g., `feat(#123):` is invalid)
- **Do not** invent new scopes - use only the 10 standardized scopes above
- Scopes **must** be lowercase
- Scopes **must not** contain spaces

### Breaking Changes Indicator

- A commit that introduce breaking changes **must** be indicated by an `!` before the `:` in the subject line e.g. `feat(api)!: remove status endpoint`
- Breaking changes **should** be described in the commit footer section, if the commit description isn't sufficiently informative

### Atomic Commits

Each commit should represent one logical change:

- **Do:** One bug fix per commit
- **Do:** One feature addition per commit
- **Don't:** Mix refactoring with bug fixes
- **Don't:** Combine unrelated changes

### Line Length Limits

To ensure readability and consistency:

- **Subject line:** Maximum 72 characters
- **Body lines:** Maximum 100 characters per line
- **Footer lines:** Maximum 100 characters per line

Break longer descriptions into multiple lines rather than exceeding these limits except for urls.

### Conventional Commit Specification

The key words “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “MAY”, and “OPTIONAL” in this document are to be interpreted as described in RFC 2119.

1. Commits MUST be prefixed with a type, which consists of a noun, feat, fix, etc., followed by the OPTIONAL scope, OPTIONAL !, and REQUIRED terminal colon and space.
1. The type feat MUST be used when a commit adds a new feature to your application or library.
1. The type fix MUST be used when a commit represents a bug fix for your application.
1. A scope MAY be provided after a type.
   A scope MUST consist of a noun describing a section of the codebase surrounded by parenthesis, e.g., fix(parser):
1. A description MUST immediately follow the colon and space after the type/scope prefix.
   The description is a short summary of the code changes, e.g., fix: array parsing issue when multiple spaces were contained in string.
1. A longer commit body MAY be provided after the short description, providing additional contextual information about the code changes.
   The body MUST begin one blank line after the description.
1. A commit body is free-form and MAY consist of any number of newline separated paragraphs.
1. One or more footers MAY be provided one blank line after the body.
   Each footer MUST consist of a word token, followed by either a : or # separator, followed by a string value (this is inspired by the git trailer convention).
1. A footer’s token MUST use - in place of whitespace characters, e.g., Acked-by (this helps differentiate the footer section from a multi-paragraph body).
   An exception is made for BREAKING CHANGE, which MAY also be used as a token.
1. A footer’s value MAY contain spaces and newlines, and parsing MUST terminate when the next valid footer token/separator pair is observed.
1. Breaking changes MUST be indicated in the type/scope prefix of a commit, or as an entry in the footer.
1. If included as a footer, a breaking change MUST consist of the uppercase text BREAKING CHANGE, followed by a colon, space, and description, e.g., BREAKING CHANGE: environment variables now take precedence over config files.
1. If included in the type/scope prefix, breaking changes MUST be indicated by a ! immediately before the :.
   If ! is used, BREAKING CHANGE: MAY be omitted from the footer section, and the commit description SHALL be used to describe the breaking change.
1. Types other than feat and fix MAY be used in your commit messages, e.g., docs: update ref docs.
1. The units of information that make up Conventional Commits MUST NOT be treated as case sensitive by implementors, with the exception of BREAKING CHANGE which MUST be uppercase.
   BREAKING-CHANGE MUST be synonymous with BREAKING CHANGE, when used as a token in a footer.
