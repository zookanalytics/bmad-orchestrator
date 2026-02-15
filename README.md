# BMAD Orchestrator

[![Publish](https://github.com/ZookAnalytics/bmad-orchestrator/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/ZookAnalytics/bmad-orchestrator/actions/workflows/publish.yml)
[![npm version](https://img.shields.io/npm/v/@zookanalytics/agent-env)](https://www.npmjs.com/package/@zookanalytics/agent-env)

Monorepo for BMAD workflow tooling: orchestrator CLI and agent-env instance manager.

## Packages

| Package | Description |
|---------|-------------|
| [`@zookanalytics/agent-env`](packages/agent-env) | CLI for creating isolated, AI-ready development environments |
| [`@zookanalytics/keystone-workflows`](packages/keystone-workflows) | Declarative automation workflows for AI-assisted development on keystone-cli |
| [`@zookanalytics/orchestrator`](packages/orchestrator) | CLI for managing BMAD workflow across multiple agent-env instances |

## Development

```bash
pnpm install
pnpm -r build
pnpm -r test:run
```
