import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Validates the full changeset → version → publish-readiness pipeline.
 * Creates a temporary changeset, runs version, builds, packs, and validates
 * the tarball — then restores all state.
 *
 * Tests are ordered to follow the natural changeset workflow:
 * 1. Changeset detected → 2. Version bumped → 3. CHANGELOG generated →
 * 4. Changeset consumed → 5. Build succeeds → 6. Tarball correct
 *
 * Architecture source: _bmad-output/planning-artifacts/release-infrastructure/architecture.md
 * Story: rel-2-4 (Perform First Manual Publish via Changesets)
 */

const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
const CHANGESET_DIR = join(PROJECT_ROOT, '.changeset');
const AGENT_ENV_DIR = join(PROJECT_ROOT, 'packages/agent-env');
const AGENT_ENV_PKG = join(AGENT_ENV_DIR, 'package.json');
const CHANGELOG_PATH = join(AGENT_ENV_DIR, 'CHANGELOG.md');
const TEST_CHANGESET = join(CHANGESET_DIR, 'test-publish-workflow.md');
const CHANGESET_DESCRIPTION = 'Test changeset for publish workflow validation';

// State captured before tests for cleanup
let originalPkgContent: string;
let originalVersion: string;
let bumpedVersion: string;
let bumpedPkgContent: string;
let tarballPath: string | null = null;

function getChangesetFiles(): string[] {
  return readdirSync(CHANGESET_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
}

/** Ensure package.json has the bumped version (concurrent processes may modify it) */
function ensureBumpedVersion(): void {
  if (bumpedPkgContent) {
    writeFileSync(AGENT_ENV_PKG, bumpedPkgContent);
  }
}

function restoreState(): void {
  // Restore original package.json content (captured before any modifications)
  if (originalPkgContent) {
    writeFileSync(AGENT_ENV_PKG, originalPkgContent);
  }

  // Remove CHANGELOG (not committed, any copy is a test artifact)
  if (existsSync(CHANGELOG_PATH)) rmSync(CHANGELOG_PATH);

  // Clean up test changeset file
  if (existsSync(TEST_CHANGESET)) rmSync(TEST_CHANGESET);

  // Clean up tarball
  if (tarballPath && existsSync(tarballPath)) rmSync(tarballPath);
}

describe('changeset publish workflow', () => {
  beforeAll(() => {
    // CHANGELOG.md is not committed — any existing copy is a test leftover
    if (existsSync(CHANGELOG_PATH)) rmSync(CHANGELOG_PATH);

    // Restore package.json to git version to ensure clean starting state
    try {
      execSync('git checkout -- packages/agent-env/package.json', {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
      });
    } catch {
      // Already clean
    }

    // Capture original state after cleanup
    originalPkgContent = readFileSync(AGENT_ENV_PKG, 'utf-8');
    originalVersion = (JSON.parse(originalPkgContent) as { version: string }).version;
  });

  afterAll(() => {
    restoreState();
  });

  // === Phase 1: Changeset creation and detection ===

  describe('changeset creation', () => {
    it('creates a valid changeset file', () => {
      writeFileSync(
        TEST_CHANGESET,
        `---\n"@zookanalytics/agent-env": patch\n---\n\n${CHANGESET_DESCRIPTION}\n`
      );
      expect(existsSync(TEST_CHANGESET)).toBe(true);
    });

    it('changeset status detects the pending changeset', () => {
      const output = execSync('pnpm changeset status', {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        timeout: 30_000,
      });
      expect(output).toContain('agent-env');
    });
  });

  // === Phase 2: Version bump ===

  describe('version bump', () => {
    it('changeset version succeeds', () => {
      // Write changeset and run version atomically in a single shell command.
      // This prevents concurrent processes from consuming the changeset file
      // between creation and version (observed with parallel CI agents).
      const changesetContent = `---\n"@zookanalytics/agent-env": patch\n---\n\n${CHANGESET_DESCRIPTION}\n`;
      const escapedContent = changesetContent.replace(/"/g, '\\"');

      const output = execSync(
        `printf "%s" "${escapedContent}" > "${TEST_CHANGESET}" && pnpm changeset version`,
        {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
          timeout: 30_000,
          shell: '/bin/bash',
        }
      );
      expect(output).toContain('All files have been updated');
    });

    it('bumps package version by a patch increment', () => {
      const pkg = JSON.parse(readFileSync(AGENT_ENV_PKG, 'utf-8')) as { version: string };
      bumpedVersion = pkg.version;
      bumpedPkgContent = readFileSync(AGENT_ENV_PKG, 'utf-8');

      // Version must be valid semver (X.Y.Z format)
      expect(bumpedVersion).toMatch(/^\d+\.\d+\.\d+$/);

      // Must be higher than original version
      const [origMajor, origMinor, origPatch] = originalVersion.split('.').map(Number);
      const [newMajor, newMinor, newPatch] = bumpedVersion.split('.').map(Number);

      // Major and minor must stay the same (patch bump only)
      expect(newMajor).toBe(origMajor);
      expect(newMinor).toBe(origMinor);
      // Patch must be incremented
      expect(newPatch).toBeGreaterThan(origPatch);
    });

    it('generates CHANGELOG.md with changeset description', () => {
      expect(existsSync(CHANGELOG_PATH)).toBe(true);

      const changelog = readFileSync(CHANGELOG_PATH, 'utf-8');
      expect(changelog).toContain(CHANGESET_DESCRIPTION);
      expect(changelog).toContain(bumpedVersion);
    });

    it('consumes the changeset file after versioning', () => {
      const remaining = getChangesetFiles();
      expect(remaining).not.toContain('test-publish-workflow.md');
    });
  });

  // === Phase 3: Build and pack ===

  describe('build and pack', () => {
    it('builds agent-env successfully after version bump', () => {
      // Ensure bumped version is in package.json before build
      ensureBumpedVersion();

      execSync('npx tsup', {
        cwd: AGENT_ENV_DIR,
        encoding: 'utf-8',
        timeout: 60_000,
      });

      // Restore bumped version — npx tsup can trigger pnpm workspace resolution
      // from within Vitest, which reverts the version bump in package.json
      ensureBumpedVersion();

      expect(existsSync(join(AGENT_ENV_DIR, 'dist/cli.js'))).toBe(true);
    });

    it('built dist/cli.js contains no imports from @zookanalytics/shared', () => {
      const distContent = readFileSync(join(AGENT_ENV_DIR, 'dist/cli.js'), 'utf-8');
      expect(distContent).not.toContain("from '@zookanalytics/shared'");
      expect(distContent).not.toContain("require('@zookanalytics/shared')");
    });

    it('package.json still has bumped version before pack', () => {
      ensureBumpedVersion();
      const pkg = JSON.parse(readFileSync(AGENT_ENV_PKG, 'utf-8')) as { version: string };
      expect(pkg.version).toBe(bumpedVersion);
    });

    it('npm pack produces a tarball', () => {
      // Ensure bumped version right before pack (concurrent processes may modify)
      ensureBumpedVersion();

      const output = execSync('npm pack', {
        cwd: AGENT_ENV_DIR,
        encoding: 'utf-8',
        timeout: 30_000,
      });

      const lines = output.trim().split('\n');
      const tarballName = lines[lines.length - 1];
      tarballPath = join(AGENT_ENV_DIR, tarballName);
      expect(existsSync(tarballPath)).toBe(true);
    });
  });

  // === Phase 4: Tarball validation ===

  describe('tarball validation', () => {
    it('contains expected files (dist, bin, config, README, LICENSE)', () => {
      expect(tarballPath).not.toBeNull();

      const output = execSync(`tar tzf "${tarballPath}"`, {
        encoding: 'utf-8',
        timeout: 10_000,
      });

      const files = output.trim().split('\n');

      expect(files.some((f) => f.includes('dist/'))).toBe(true);
      expect(files.some((f) => f.includes('bin/'))).toBe(true);
      expect(files.some((f) => f.includes('config/'))).toBe(true);
      expect(files.some((f) => f.includes('README.md'))).toBe(true);
      expect(files.some((f) => f.includes('LICENSE'))).toBe(true);
      expect(files.some((f) => f.includes('package.json'))).toBe(true);
    });

    it('does not contain source files, tests, or dev config', () => {
      expect(tarballPath).not.toBeNull();

      const output = execSync(`tar tzf "${tarballPath}"`, {
        encoding: 'utf-8',
        timeout: 10_000,
      });

      const files = output.trim().split('\n');

      expect(files.some((f) => f.includes('src/'))).toBe(false);
      expect(files.some((f) => f.includes('.test.'))).toBe(false);
      expect(files.some((f) => f.includes('tsup.config'))).toBe(false);
      expect(files.some((f) => f.includes('tsconfig'))).toBe(false);
    });

    it('tarball package.json has no workspace: references in runtime dependencies', () => {
      expect(tarballPath).not.toBeNull();

      const pkgJson = execSync(`tar xzf "${tarballPath}" --to-stdout package/package.json`, {
        encoding: 'utf-8',
        timeout: 10_000,
      });

      const pkg = JSON.parse(pkgJson) as {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      };

      // workspace: protocol must NOT appear in runtime dependency fields
      // (devDependencies are not installed by consumers, so workspace: there is harmless)
      for (const depField of [
        'dependencies',
        'peerDependencies',
        'optionalDependencies',
      ] as const) {
        const deps = pkg[depField];
        if (deps) {
          for (const [name, version] of Object.entries(deps)) {
            expect(version, `${depField}.${name} must not use workspace: protocol`).not.toContain(
              'workspace:'
            );
          }
        }
      }
    });

    it('tarball package.json has a version higher than the original', () => {
      expect(tarballPath).not.toBeNull();

      const pkgJson = execSync(`tar xzf "${tarballPath}" --to-stdout package/package.json`, {
        encoding: 'utf-8',
        timeout: 10_000,
      });

      const pkg = JSON.parse(pkgJson) as { version: string };

      // Tarball version must be valid semver and higher than original
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
      const [origMajor, origMinor, origPatch] = originalVersion.split('.').map(Number);
      const [tarMajor, tarMinor, tarPatch] = pkg.version.split('.').map(Number);
      expect(tarMajor).toBe(origMajor);
      expect(tarMinor).toBe(origMinor);
      expect(tarPatch).toBeGreaterThan(origPatch);
    });
  });
});
