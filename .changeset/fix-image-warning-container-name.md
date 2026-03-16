---
"@zookanalytics/agent-env": patch
---

Suppress misleading image override warning when repo uses the same image as agent-env managed image. Self-heal legacy container names on rebuild by re-deriving the canonical ae-* name instead of perpetuating random Docker-assigned names from state.
