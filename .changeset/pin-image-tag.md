---
'@zookanalytics/agent-env': minor
---

Pin Docker image tag to agent-env version.

Image is now requested as `:<agent-env-version>` instead of `:latest`, ensuring
upgrading the npm package reliably picks up the matching container image on the
next rebuild. The interactive menu (`agent-env on <ws>`) surfaces an image-drift
banner when the workspace's pinned image differs from the running CLI version,
and relabels the Rebuild action to show the new image tag.

When the pinned image tag is not yet published (post-release lag window),
agent-env returns an actionable `IMAGE_VERSION_NOT_PUBLISHED` error pointing at
the publish-image workflow and the GitHub Packages page. Use `--no-pull` as an
emergency unblock if a previously cached image is available locally.
