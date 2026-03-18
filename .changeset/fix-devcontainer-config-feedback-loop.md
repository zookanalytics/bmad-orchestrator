---
"@zookanalytics/agent-env": patch
---

Fix devcontainer config feedback loop that caused init-host.sh to run twice in parallel during rebuild, crashing on SSH pub key staging. The persistent `.devcontainer/devcontainer.json` symlink was being read back as a repo config by readRepoConfig. Now uses an ephemeral `.devcontainer.json` symlink at workspace root (created before `devcontainer open`, removed after), adds symlink detection in readRepoConfig as defense-in-depth, and makes init-host.sh robust with non-fatal SSH key staging.
