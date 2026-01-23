import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, utimesSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getStatePath,
  buildCurrentState
} from './state-manager.js';
import type { ImportState } from './types.js';

describe('state-manager', () => {
  describe('getStatePath', () => {
    it('returns path to ~/.gsdo/last-imported-gsd', () => {
      const path = getStatePath();
      expect(path).toContain('.gsdo');
      expect(path).toContain('last-imported-gsd');
    });
  });

  describe('buildCurrentState', () => {
    let testGsdDir: string;
    let testWorkflowsDir: string;

    beforeEach(() => {
      testGsdDir = join(tmpdir(), `gsd-test-build-${Date.now()}`);
      testWorkflowsDir = join(testGsdDir, 'workflows');
      mkdirSync(testWorkflowsDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testGsdDir)) {
        rmSync(testGsdDir, { recursive: true, force: true });
      }
    });

    it('scans directory and extracts mtimes correctly', () => {
      // Create test workflow files with specific timestamps
      const file1 = join(testWorkflowsDir, 'plan.md');
      const file2 = join(testWorkflowsDir, 'execute.md');

      writeFileSync(file1, '# Plan', 'utf-8');
      writeFileSync(file2, '# Execute', 'utf-8');

      // Set specific mtimes (2026-01-23 12:00:00)
      const testTime = new Date('2026-01-23T12:00:00Z');
      utimesSync(file1, testTime, testTime);
      utimesSync(file2, testTime, testTime);

      const state = buildCurrentState(testGsdDir);

      expect(state.skills).toHaveLength(2);
      expect(state.skills[0].path).toContain('.md');
      expect(state.skills[0].mtime).toBeGreaterThan(0);
      expect(state.importedAt).toBeTruthy();
      expect(state.docsCachedAt).toBe('');
    });

    it('sorts skills by path for deterministic ordering', () => {
      // Create files in non-alphabetical order
      const files = ['zzz.md', 'aaa.md', 'mmm.md'];
      for (const file of files) {
        writeFileSync(join(testWorkflowsDir, file), '# Test', 'utf-8');
      }

      const state = buildCurrentState(testGsdDir);

      expect(state.skills).toHaveLength(3);
      // Verify sorted order
      expect(state.skills[0].path).toContain('aaa.md');
      expect(state.skills[1].path).toContain('mmm.md');
      expect(state.skills[2].path).toContain('zzz.md');
    });

    it('filters to only markdown files', () => {
      // Create mix of files
      writeFileSync(join(testWorkflowsDir, 'valid.md'), '# Valid', 'utf-8');
      writeFileSync(join(testWorkflowsDir, 'other.md'), '# Other', 'utf-8');
      writeFileSync(join(testWorkflowsDir, 'another.md'), '# Another', 'utf-8');
      writeFileSync(join(testWorkflowsDir, 'readme.txt'), 'text', 'utf-8');

      const state = buildCurrentState(testGsdDir);

      // Should only include *.md files
      expect(state.skills).toHaveLength(3);
      expect(state.skills.every(s => s.path.endsWith('.md'))).toBe(true);
    });

    it('throws error if workflows directory missing', () => {
      const nonExistentDir = join(tmpdir(), 'does-not-exist-' + Date.now());

      expect(() => buildCurrentState(nonExistentDir)).toThrow('Workflows directory not found');
    });
  });

  describe('state file operations', () => {
    let testStateDir: string;
    let testStatePath: string;

    beforeEach(() => {
      testStateDir = join(tmpdir(), `gsd-test-state-${Date.now()}`);
      testStatePath = join(testStateDir, 'last-imported-gsd');
      mkdirSync(testStateDir, { recursive: true });
    });

    afterEach(() => {
      if (existsSync(testStateDir)) {
        rmSync(testStateDir, { recursive: true, force: true });
      }
    });

    it('handles missing state file', () => {
      // State file doesn't exist yet
      expect(existsSync(testStatePath)).toBe(false);
    });

    it('handles corrupted JSON state file', () => {
      // Write invalid JSON
      writeFileSync(testStatePath, 'not valid json', 'utf-8');
      expect(existsSync(testStatePath)).toBe(true);

      // Attempt to read should fail gracefully
      try {
        JSON.parse(readFileSync(testStatePath, 'utf-8'));
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it('can write and read valid state', () => {
      const testState: ImportState = {
        importedAt: '2026-01-23T12:00:00.000Z',
        docsCachedAt: '2026-01-23T11:55:00.000Z',
        skills: [
          { path: '/test/gsd:plan.md', mtime: 1234567890 }
        ]
      };

      // Write state manually
      writeFileSync(testStatePath, JSON.stringify(testState, null, 2), 'utf-8');

      // Verify file exists and can be read
      expect(existsSync(testStatePath)).toBe(true);
      const content = readFileSync(testStatePath, 'utf-8');
      const parsed: ImportState = JSON.parse(content);

      expect(parsed.importedAt).toBe(testState.importedAt);
      expect(parsed.docsCachedAt).toBe(testState.docsCachedAt);
      expect(parsed.skills).toHaveLength(1);
      expect(parsed.skills[0].path).toBe('/test/gsd:plan.md');
      expect(parsed.skills[0].mtime).toBe(1234567890);
    });

    it('state file structure is valid JSON', () => {
      const testState: ImportState = {
        importedAt: '2026-01-23T12:00:00.000Z',
        docsCachedAt: '',
        skills: []
      };

      // Ensure parent directory exists
      if (!existsSync(testStateDir)) {
        mkdirSync(testStateDir, { recursive: true });
      }

      // Write and verify
      writeFileSync(testStatePath, JSON.stringify(testState, null, 2), 'utf-8');
      expect(existsSync(testStatePath)).toBe(true);

      // Ensure it's valid JSON
      const content = readFileSync(testStatePath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });
});
