---
"@zookanalytics/agent-env": minor
---

Add VS Code status bar purpose display and repo registry

- Add status bar template rendering with `{{PURPOSE}}` substitution and configurable template resolution
- Add filewatcher to refresh Better Status Bar extension when statusBar.json changes externally
- Add repo registry commands (`repo add`, `repo remove`, `repo list`) for managing known repositories
- Support repo slugs in the `create` command for quick instance creation from registered repos
