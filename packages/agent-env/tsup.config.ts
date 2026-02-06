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
  // shared is a private workspace package that won't be on npm
  noExternal: ['@zookanalytics/shared'],
  // Note: src/cli.ts has a shebang that tsup preserves in the output.
  // The bin/agent-env.js wrapper imports dist/cli.js, so no banner config needed.
});
