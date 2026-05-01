---
"@zookanalytics/agent-env": patch
---

Re-apply SSH agent socket permissions on every container start instead of only at creation, so SSH operations (e.g. git over SSH) keep working after a host reboot recreates the bind-mounted `/run/host-services/ssh-auth.sock` with default `0660` permissions.
