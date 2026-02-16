---
"@zookanalytics/agent-env": patch
---

Fix SSH connection discovery for OrbStack direct networking

- Detect exposed-but-not-published ports (OrbStack doesn't use host port mapping)
- Read `dev.orbstack.domains` container label for hostname override
- Add `labels` field to container status results
- Fix node user account lock preventing SSH pubkey auth
- Set login shell to zsh so SSH sessions match tmux environment
