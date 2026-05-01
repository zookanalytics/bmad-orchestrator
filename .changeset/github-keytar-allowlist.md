---
"@zookanalytics/agent-env": patch
---

Add `@github/keytar` to the pnpm `--allow-build` list so the `@google/gemini-cli` global install no longer stalls on a build-script approval prompt during devcontainer post-create.
