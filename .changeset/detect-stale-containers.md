---
"@zookanalytics/agent-env": patch
---

Detect stale containers before devcontainer up to prevent silent workspace rollback. Adds pre-flight check using Docker label query, improves error reporting with container name conflict detection, and replaces console.warn with injectable logger.
