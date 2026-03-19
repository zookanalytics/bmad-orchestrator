---
"@zookanalytics/agent-env": minor
---

Add non-blocking update check that notifies host users when a newer version is available on npm

On CLI startup, an async registry check fires concurrently with command execution. After the command completes, a notice is printed to stderr if a newer version exists. Results are cached for 1 hour at `~/.agent-env/update-check.json`. The check is suppressed in non-TTY environments, inside containers, and during local development.
