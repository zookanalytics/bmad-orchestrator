import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PROJECT_ROOT } from './changeset-test-utils.js';

/**
 * Validates publish-readiness of agent-env by building, packing, and
 * inspecting the tarball — without mutating committed files.
 *
 * What this guards against:
 * - tsup misconfiguration leaking @zookanalytics/shared into dist
 * - package.json files/bin/exports pointing at wrong paths
 * - Source files, tests, or dev config leaking into tarball
 * - workspace: protocol references in runtime dependencies
 *
 * What this does NOT test (third-party tool behavior):
 * - changeset version bumping (tested by publishing 0.1.1)
 * - CHANGELOG generation (changesets' responsibility)
 * - changeset file consumption (changesets' responsibility)
 *
 * Architecture source: _bmad-output/planning-artifacts/release-infrastructure/architecture.md
 * Story: rel-2-4 (Perform First Manual Publish via Changesets)
 */

const AGENT_ENV_DIR = join(PROJECT_ROOT, 'packages/agent-env');
const AGENT_ENV_PKG = join(AGENT_ENV_DIR, 'package.json');

let tarballPath: string | null = null;
let currentVersion: string;

describe('publish readiness', () => {
  beforeAll(() => {
    const pkg = JSON.parse(readFileSync(AGENT_ENV_PKG, 'utf-8')) as { version: string };
    currentVersion = pkg.version;

    // Build agent-env (writes to dist/ which is gitignored — safe)
    execSync('pnpm --filter @zookanalytics/agent-env build', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout: 60_000,
    });

    // Pack into tarball (creates .tgz in package dir — cleaned up in afterAll)
    const output = execSync('npm pack', {
      cwd: AGENT_ENV_DIR,
      encoding: 'utf-8',
      timeout: 30_000,
    });

    const lines = output.trim().split('\n');
    const tarballName = lines[lines.length - 1];
    tarballPath = join(AGENT_ENV_DIR, tarballName);
  });

  afterAll(() => {
    if (tarballPath && existsSync(tarballPath)) rmSync(tarballPath);
  });

  // === Build validation ===

  describe('build output', () => {
    it('produces dist/cli.js', () => {
      expect(existsSync(join(AGENT_ENV_DIR, 'dist/cli.js'))).toBe(true);
    });

    it('dist/cli.js contains no imports from @zookanalytics/shared', () => {
      const distContent = readFileSync(join(AGENT_ENV_DIR, 'dist/cli.js'), 'utf-8');
      expect(distContent).not.toContain("from '@zookanalytics/shared'");
      expect(distContent).not.toContain("require('@zookanalytics/shared')");
    });
  });

  // === Tarball contents ===

  describe('tarball contents', () => {
    it('npm pack produces a tarball', () => {
      expect(tarballPath).not.toBeNull();
      expect(existsSync(tarballPath as string)).toBe(true);
    });

    it('contains expected files (dist, bin, config, README, LICENSE)', () => {
      const output = execSync(`tar tzf "${tarballPath}"`, {
        encoding: 'utf-8',
        timeout: 10_000,
      });

      const files = output.trim().split('\n');

      expect(files.some((f) => f.startsWith('package/dist/'))).toBe(true);
      expect(files.some((f) => f.startsWith('package/bin/'))).toBe(true);
      expect(files.some((f) => f.startsWith('package/config/'))).toBe(true);
      expect(files.some((f) => f.includes('README.md'))).toBe(true);
      expect(files.some((f) => f.includes('LICENSE'))).toBe(true);
      expect(files.some((f) => f.includes('package.json'))).toBe(true);
    });

    it('does not contain source files, tests, or dev config', () => {
      const output = execSync(`tar tzf "${tarballPath}"`, {
        encoding: 'utf-8',
        timeout: 10_000,
      });

      const files = output.trim().split('\n');

      expect(files.some((f) => f.startsWith('package/src/'))).toBe(false);
      expect(files.some((f) => f.includes('.test.'))).toBe(false);
      expect(files.some((f) => f.includes('tsup.config'))).toBe(false);
      expect(files.some((f) => f.includes('tsconfig'))).toBe(false);
    });
  });

  // === Tarball package.json validation ===

  describe('tarball package.json', () => {
    it('has valid semver version', () => {
      const pkgJson = execSync(`tar xzf "${tarballPath}" --to-stdout package/package.json`, {
        encoding: 'utf-8',
        timeout: 10_000,
      });

      const pkg = JSON.parse(pkgJson) as { version: string };
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(pkg.version).toBe(currentVersion);
    });

    it('has no workspace: references in runtime dependencies', () => {
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
  });
});
