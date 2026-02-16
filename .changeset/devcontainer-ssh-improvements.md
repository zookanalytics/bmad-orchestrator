---
"@zookanalytics/agent-env": patch
---

fix(devcontainer): prevent container hang during SSH setup

Replaces direct sudo commands with a dedicated install-ssh-host-keys.sh script in post-create.sh. The previous approach used sudo cp/chown/chmod which hung indefinitely because these commands weren't in sudoers, causing the container to wait for a password that would never come.

Also adds agent-env README documentation for workspace structure, SSH access (host keys vs user keys), and commit signing setup (SSH signing recommended over GPG).

Additionally improves the local image testing workflow by using docker tag/pull to switch between local and remote images, avoiding modifications to tracked config files.
