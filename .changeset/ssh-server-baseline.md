---
"@zookanalytics/agent-env": minor
---

feat(agent-env): add SSH server support to baseline devcontainer

Install and configure openssh-server in baseline config with hardened key-only authentication. Host public keys are staged (private keys never enter the container) and per-container host keys are generated and persisted in the workspace. Containers are accessible via `ssh node@ae-<instance>.orb.local` on OrbStack. Existing instances require rebuild.
