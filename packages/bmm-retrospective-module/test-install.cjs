#!/usr/bin/env node

/**
 * Local install test — simulates what `npm install` + `bmad install` would do.
 *
 * Usage:
 *   node packages/bmm-retrospective-module/test-install.cjs [project-root]
 *
 * Defaults to the monorepo root (../../ relative to this script).
 * Pass a temp directory to test without touching the real _bmad tree.
 */

const path = require('node:path');
const fs = require('node:fs');
const { install } = require('./_module-installer/installer.cjs');

const projectRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', '..');

console.log(`\n— Test install into: ${projectRoot}\n`);

install({
  projectRoot,
  config: {},
  installedIDEs: [],
  logger: console,
}).then((ok) => {
  console.log(`\nResult: ${ok ? 'SUCCESS' : 'FAILED'}`);

  // Show what was written
  const dest = path.join(projectRoot, '_bmad', 'bmm', 'workflows');
  if (fs.existsSync(dest)) {
    console.log(`\nInstalled files under ${dest}:`);
    listTree(dest, '');
  }

  process.exitCode = ok ? 0 : 1;
});

function listTree(dir, prefix) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      console.log(`${prefix}${entry.name}/`);
      listTree(full, prefix + '  ');
    } else {
      console.log(`${prefix}${entry.name}`);
    }
  }
}
