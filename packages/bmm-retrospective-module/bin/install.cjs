#!/usr/bin/env node

const path = require('node:path');
const { install } = require('../_module-installer/installer.cjs');

// Support: npx @zookanalytics/bmm-retrospective-module --directory /path/to/project
const dirIndex = process.argv.indexOf('--directory');
const projectRoot =
  dirIndex !== -1 && process.argv[dirIndex + 1]
    ? path.resolve(process.argv[dirIndex + 1])
    : process.cwd();

install({
  projectRoot,
  config: {},
  installedIDEs: [],
  logger: console,
}).then((ok) => {
  process.exitCode = ok ? 0 : 1;
});
