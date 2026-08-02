// Sync the in-repo dogfood image pin to packages/agent-env/package.json's version.
//
// Run automatically by the Changesets `version` step (see package.json
// `version-packages` script) and manually as the recovery command surfaced
// by the CI "Verify dogfood image pin" step.
//
// Targeted regex replacement is used instead of full JSONC parsing because
// pnpm's strict isolation does not hoist `jsonc-parser` to the repo root,
// and the script needs to run at the monorepo root with zero deps.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve all paths from the repo root (parent of scripts/) so the script
// works regardless of the caller's cwd.
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const pkg = JSON.parse(await readFile(join(repoRoot, 'packages/agent-env/package.json'), 'utf8'));
const version = pkg.version;
const IMAGE_REPO = 'ghcr.io/zookanalytics/bmad-orchestrator/devcontainer';
const expectedImage = `${IMAGE_REPO}:${version}`;

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 1. .devcontainer/devcontainer.json — regex-replace the image line only,
//    preserving all surrounding JSONC comments, whitespace, and formatting.
{
  const path = join(repoRoot, '.devcontainer/devcontainer.json');
  const original = await readFile(path, 'utf8');
  const re = new RegExp(`("image"\\s*:\\s*")${escapeRegex(IMAGE_REPO)}:[^"]+(")`);
  if (!re.test(original)) {
    console.error(`✗ Could not locate ${IMAGE_REPO}:<tag> in ${path}`);
    process.exit(1);
  }
  const updated = original.replace(re, `$1${expectedImage}$2`);
  if (updated === original) {
    console.log(`✓ ${path} already pinned to ${expectedImage}`);
  } else {
    await writeFile(path, updated);
    console.log(`✓ Updated ${path} → ${expectedImage}`);
  }
}

// Note: root package.json's `build:image:use-remote` reads the agent-env
// version dynamically (via `node -p`) at invocation time, so it does NOT
// require sync at version-bump time. If a future contributor reintroduces
// a literal version pin under IMAGE_REPO in package.json, error so they can
// either remove it (preferred) or extend this script to sync it.
{
  const path = join(repoRoot, 'package.json');
  const original = await readFile(path, 'utf8');
  const literalRe = new RegExp(`(${escapeRegex(IMAGE_REPO)}:)\\d+\\.\\d+\\.\\d+(?:[-+][^"\\s]*)?`);
  if (literalRe.test(original)) {
    console.error(
      `✗ Found a literal versioned ${IMAGE_REPO} reference in ${path}. ` +
        `That coordinate should read the agent-env version dynamically (via node -p) — ` +
        `update the script entry to compose the tag from packages/agent-env/package.json.`
    );
    process.exit(1);
  }
}
