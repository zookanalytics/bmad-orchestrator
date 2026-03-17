---
"@zookanalytics/agent-env": minor
---

Add tmux session persistence across container rebuilds. A claude-wrapper shell script tracks session IDs per tmux pane, and new `tmux-save`/`tmux-restore` CLI commands capture and reconstruct window state. Sessions auto-save periodically and before rebuilds, then restore automatically on container start.
