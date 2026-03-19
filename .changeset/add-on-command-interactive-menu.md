---
"@zookanalytics/agent-env": minor
---

Add `on` command for persistent interactive instance menu

`agent-env on <name>` opens a persistent action menu for a named instance with options to Attach, Open in VS Code, Rebuild, Set Purpose, or Exit. The menu loops after each action, refreshing instance state between iterations. Also replaces the default no-arg interactive menu with an instance picker followed by the same action loop.
