import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect } from 'vitest';

import type { InstanceInfo } from '../lib/list-instances.js';

import { InstanceList } from './InstanceList.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Strip ANSI escape codes for text assertions */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function makeInstance(overrides: Partial<InstanceInfo> = {}): InstanceInfo {
  return {
    name: 'test-instance',
    status: 'running',
    lastAttached: new Date().toISOString(),
    purpose: null,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('InstanceList', () => {
  describe('empty state', () => {
    it('shows helpful message when no instances exist', () => {
      const { lastFrame } = render(<InstanceList instances={[]} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('No instances found');
      expect(output).toContain('agent-env create');
    });
  });

  describe('table rendering (AC: #1)', () => {
    it('renders header row with column names', () => {
      const instances = [makeInstance()];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('NAME');
      expect(output).toContain('STATUS');
      expect(output).toContain('LAST ATTACHED');
      expect(output).toContain('PURPOSE');
    });

    it('renders all instances in the table', () => {
      const instances = [
        makeInstance({ name: 'alpha' }),
        makeInstance({ name: 'beta' }),
        makeInstance({ name: 'gamma' }),
      ];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('alpha');
      expect(output).toContain('beta');
      expect(output).toContain('gamma');
    });
  });

  describe('status color rendering', () => {
    it('renders running status text (AC: #2)', () => {
      const instances = [makeInstance({ status: 'running' })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('running');
    });

    it('renders stopped status text (AC: #3)', () => {
      const instances = [makeInstance({ status: 'stopped' })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('stopped');
    });

    it('renders orphaned status text (AC: #4)', () => {
      const instances = [makeInstance({ status: 'orphaned' })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('orphaned');
    });
  });

  describe('Docker unavailable (AC: #5)', () => {
    it('shows "unknown (Docker unavailable)" status label', () => {
      const instances = [makeInstance({ status: 'unknown' })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={false} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('unknown (Docker unavailable)');
    });

    it('shows Docker unavailable warning notice', () => {
      const instances = [makeInstance({ status: 'unknown' })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={false} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('Docker is not available');
    });

    it('still shows workspace-level info when Docker unavailable', () => {
      const instances = [
        makeInstance({
          name: 'my-ws',
          status: 'unknown',
          purpose: 'Auth work',
        }),
      ];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={false} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('my-ws');
      expect(output).toContain('Auth work');
    });
  });

  describe('last attached formatting (AC: #6)', () => {
    it('shows dash when lastAttached is null', () => {
      const instances = [makeInstance({ lastAttached: null })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      // The row should contain a dash for the last attached column
      expect(output).toContain('-');
    });

    it('formats relative timestamp for recent lastAttached', () => {
      const instances = [makeInstance({ lastAttached: new Date().toISOString() })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      // timeago.js returns "just now" for very recent timestamps
      expect(output).toContain('just now');
    });
  });

  describe('purpose column', () => {
    it('shows purpose text when set', () => {
      const instances = [makeInstance({ purpose: 'OAuth implementation' })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('OAuth implementation');
    });

    it('shows dash when purpose is null', () => {
      const instances = [makeInstance({ purpose: null })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      // Purpose column should show "-" for null
      const lines = output.split('\n');
      const dataLine = lines.find((l) => l.includes('test-instance'));
      expect(dataLine).toBeDefined();
      expect(dataLine).toContain('-');
    });

    it('truncates long purposes to 30 characters', () => {
      const longPurpose = 'This is a very long purpose string that exceeds thirty characters';
      const instances = [makeInstance({ purpose: longPurpose })];
      const { lastFrame } = render(<InstanceList instances={instances} dockerAvailable={true} />);

      const output = stripAnsi(lastFrame() ?? '');
      expect(output).toContain('...');
      expect(output).not.toContain(longPurpose);
    });
  });
});
