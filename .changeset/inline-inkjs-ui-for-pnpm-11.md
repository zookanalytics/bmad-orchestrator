---
"@zookanalytics/agent-env": patch
---

Fix `pnpm add -g @zookanalytics/agent-env` failing with `ERR_MODULE_NOT_FOUND` for `react` on pnpm >= 11.

`@inkjs/ui@2.0.0` imports `react` but declares neither a dependency nor a peer dependency on it. Under pnpm <= 10, the missing declaration resolved by accident because Node's resolver walked up from `<root>/node_modules/.pnpm/<pkg>/node_modules/<pkg>` into pnpm's hoisted fallback `.pnpm/node_modules/` directory (which held `react`). pnpm 11 moved packages into the shared content-addressable store at `<store>/v11/links/@inkjs/ui/2.0.0/<hash>/node_modules/@inkjs/ui`, a path with no `.pnpm/node_modules/` ancestor, so the accidental resolution broke and every global install crashed on startup at `@inkjs/ui/build/components/badge/badge.js`.

Inlined `@inkjs/ui` into `dist/cli.js` via tsup's `noExternal` so its `react` import now resolves from `agent-env`'s own declared `react` dependency inside the bundle. `react` itself remains external — a single instance is used, so Ink hooks continue to work correctly. Moved `@inkjs/ui` from `dependencies` to `devDependencies` since consumers no longer need it installed at runtime.
