---
"@zookanalytics/agent-env": patch
---

fix(agent-env): auto-discover and share Claude credentials across instances

Replace empty-file credential bootstrap with discovery-based promotion. On each
instance startup, the isolation script now validates credential state: uses shared
credentials if available, discovers and promotes from instance directories if not,
and gracefully handles first-instance scenarios. Self-heals broken symlinks and
local files on every start.
