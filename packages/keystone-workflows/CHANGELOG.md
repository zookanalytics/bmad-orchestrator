# @zookanalytics/keystone-workflows

## 0.2.1

### Patch Changes

- [#19](https://github.com/zookanalytics/bmad-orchestrator/pull/19) [`3e5d947`](https://github.com/zookanalytics/bmad-orchestrator/commit/3e5d947b12eb4c1efc452526450a2bab14dd54ad) Thanks [@johnzook](https://github.com/johnzook)! - Improve core workflows for better reliability, security, and user experience
  - Standardize step naming to camelCase
  - Replace hardcoded temp file paths with dynamic `mktemp` generated paths
  - Add existence checks before unlinking temp files in script steps
  - Remove redundant "Final Evaluation" and "Final Sign-off" steps from epic workflow
  - Sequential auto-fixes enabled for both Gemini and Claude reviews
  - Add comprehensive documentation in `packages/keystone-workflows/README.md`
  - Add `@zookanalytics/keystone-workflows` to the root `README.md`
  - Add `use_tea` input to epic workflows to enable Test-Evidence-Architecture steps

## 0.2.0

### Minor Changes

- [#13](https://github.com/zookanalytics/bmad-orchestrator/pull/13) [`76103cc`](https://github.com/zookanalytics/bmad-orchestrator/commit/76103ccb9af7001be3832e684f262cd24a4b3310) Thanks [@johnzook](https://github.com/johnzook)! - Rework installation for clean global install and upgrade path
  - Fix package.json metadata (repository URL, description, keywords)
  - Rewrite postinstall.sh for non-fatal, backup-aware installation
  - Add LICENSE file
  - Fix stale claude-devcontainer references
