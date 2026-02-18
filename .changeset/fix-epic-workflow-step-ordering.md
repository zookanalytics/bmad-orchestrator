---
"@zookanalytics/keystone-workflows": patch
---

Fix step dependency ordering in bmad-epic workflow

- Four steps had `needs` pointing at the previous prompt instead of its action,
  causing the action and next prompt to run concurrently
- This produced interleaved shell output in human prompts (e.g., temp file paths
  appearing in [Y/n] lines) and missing prompt text when shell output scrolled it away
