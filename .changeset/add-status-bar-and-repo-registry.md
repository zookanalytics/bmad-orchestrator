---
"@zookanalytics/agent-env": minor
---

Add VS Code status bar purpose display and repo listing

- Add status bar template rendering with `{{PURPOSE}}` substitution and configurable template resolution
- Add filewatcher to refresh Better Status Bar extension when statusBar.json changes externally
- Add read-only `agent-env repos` command for listing repositories derived from workspace state
- Support repo slugs in the `create` command for quick instance creation from listed repos
