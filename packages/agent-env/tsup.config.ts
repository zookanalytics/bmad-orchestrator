import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  dts: true,
  splitting: false,
  sourcemap: false,
  // Bundle @zookanalytics/shared into the output so consumers don't need it
  // shared is a private workspace package that won't be on npm.
  //
  // @inkjs/ui is inlined because upstream @inkjs/ui@2.0.0 imports 'react' without
  // declaring it as a dep or peer dep. Under pnpm >=11's new store-links layout,
  // that unresolved import breaks global installs (ERR_MODULE_NOT_FOUND). Inlining
  // moves the react import into agent-env's own bundle, where react resolves from
  // agent-env's declared dependency.
  noExternal: ['@zookanalytics/shared', '@inkjs/ui'],
  // Note: src/cli.ts has a shebang that tsup preserves in the output.
  // The bin/agent-env.js wrapper imports dist/cli.js, so no banner config needed.
});
