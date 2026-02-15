---
"@zookanalytics/agent-env": minor
---

Add `--no-pull` and `--use-cache` flags to the rebuild command for controlling Docker image pulling and build cache behavior. By default, rebuild now pulls fresh base images and disables Docker layer cache to ensure fully reproducible builds. Includes Dockerfile resolution, FROM image parsing, and refactored rebuild orchestration.
