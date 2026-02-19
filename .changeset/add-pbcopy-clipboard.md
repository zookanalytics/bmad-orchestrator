---
"@zookanalytics/agent-env": minor
---

Add pbcopy clipboard script using OSC 52

- Add pbcopy shim that copies stdin to system clipboard via OSC 52 escape sequences
- Enable tmux set-clipboard on for reliable OSC 52 relay through nested tmux/SSH/Docker pty chains
