---
"@zookanalytics/agent-env": patch
---

Fix tmux autosave overwriting `program: 'claude'` with `null` when claude is mid-tool-execution. Detection now trusts `claude-sessions.json` (written on launch, removed on graceful exit) instead of `pane_current_command`, which reflects whichever subprocess claude has in the foreground.
