import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeEnhancementLog, type EnhancementLogEntry } from './gsdo-logger.js';

describe('gsdo-logger', () => {
  let testDir: string;
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    // Create temporary directory for test logs
    testDir = join(tmpdir(), `gsdo-logger-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Mock HOME and USERPROFILE to use test directory (Windows uses USERPROFILE)
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = testDir;
    process.env.USERPROFILE = testDir;
  });

  afterEach(() => {
    // Restore original env vars
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    if (originalUserProfile !== undefined) {
      process.env.USERPROFILE = originalUserProfile;
    } else {
      delete process.env.USERPROFILE;
    }

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('writeEnhancementLog', () => {
    it('creates log file with header on first write', async () => {
      const entry: EnhancementLogEntry = {
        timestamp: '2024-01-20T10:30:00.000Z',
        summary: 'Enhanced 2 commands',
        results: [
          {
            commandName: 'gsd-test',
            enhanced: true,
            changes: ['Updated description', 'Improved prompt template'],
            reasoning: 'The original description was too vague. Template needed clearer structure.',
            before: { name: 'gsd-test', description: 'old', promptTemplate: 'old template' },
            after: { name: 'gsd-test', description: 'new', promptTemplate: 'new template' },
          },
        ],
        metadata: { enhanced: 1, unchanged: 0, failed: 0 },
      };

      await writeEnhancementLog(entry);

      const logPath = join(testDir, '.gsdo', 'gsdo.log');
      expect(existsSync(logPath)).toBe(true);

      const content = readFileSync(logPath, 'utf-8');
      expect(content).toContain('# Enhancement Log');
      expect(content).toContain('## 2024-01-20T10:30:00.000Z - Enhanced 2 commands');
      expect(content).toContain('### gsd-test');
      expect(content).toContain('**Status:** ✓ Enhanced');
    });

    it('includes before/after JSON blocks', async () => {
      const entry: EnhancementLogEntry = {
        timestamp: '2024-01-20T10:30:00.000Z',
        summary: 'Enhanced 1 command',
        results: [
          {
            commandName: 'gsd-plan-phase',
            enhanced: true,
            changes: ['Fixed naming'],
            reasoning: 'Command name had inconsistent capitalization',
            before: { name: 'gsd-plan-phase', description: 'old desc', promptTemplate: 'old' },
            after: { name: 'gsd-plan-phase', description: 'Plan a phase', promptTemplate: 'new' },
          },
        ],
        metadata: { enhanced: 1, unchanged: 0, failed: 0 },
      };

      await writeEnhancementLog(entry);

      const logPath = join(testDir, '.gsdo', 'gsdo.log');
      const content = readFileSync(logPath, 'utf-8');

      expect(content).toContain('**Before:**');
      expect(content).toContain('```json');
      expect(content).toContain('"name": "gsd-plan-phase"');
      expect(content).toContain('"description": "old desc"');

      expect(content).toContain('**After:**');
      expect(content).toContain('"description": "Plan a phase"');
    });

    it('includes reasoning section', async () => {
      const entry: EnhancementLogEntry = {
        timestamp: '2024-01-20T10:30:00.000Z',
        summary: 'Enhanced 1 command',
        results: [
          {
            commandName: 'gsd-test',
            enhanced: true,
            changes: ['Improved clarity'],
            reasoning: 'The LLM determined that the command description needed more specificity and the prompt template should include better context about the expected workflow.',
            before: { name: 'gsd-test', description: 'test', promptTemplate: 'do test' },
            after: { name: 'gsd-test', description: 'test', promptTemplate: 'do test better' },
          },
        ],
        metadata: { enhanced: 1, unchanged: 0, failed: 0 },
      };

      await writeEnhancementLog(entry);

      const logPath = join(testDir, '.gsdo', 'gsdo.log');
      const content = readFileSync(logPath, 'utf-8');

      expect(content).toContain('**Reasoning:**');
      expect(content).toContain('The LLM determined');
      expect(content).toContain('better context about the expected workflow');
    });

    it('handles failed enhancements with error messages', async () => {
      const entry: EnhancementLogEntry = {
        timestamp: '2024-01-20T10:30:00.000Z',
        summary: 'Failed to enhance 1 command',
        results: [
          {
            commandName: 'gsd-broken',
            enhanced: false,
            changes: [],
            reasoning: '',
            before: { name: 'gsd-broken', description: 'test', promptTemplate: 'test' },
            after: null,
            error: 'LLM API returned 429 - rate limit exceeded',
          },
        ],
        metadata: { enhanced: 0, unchanged: 0, failed: 1 },
      };

      await writeEnhancementLog(entry);

      const logPath = join(testDir, '.gsdo', 'gsdo.log');
      const content = readFileSync(logPath, 'utf-8');

      expect(content).toContain('**Status:** ✗ Failed');
      expect(content).toContain('**Error:**');
      expect(content).toContain('LLM API returned 429');
    });

    it('handles unchanged commands', async () => {
      const entry: EnhancementLogEntry = {
        timestamp: '2024-01-20T10:30:00.000Z',
        summary: 'No changes needed',
        results: [
          {
            commandName: 'gsd-perfect',
            enhanced: false,
            changes: [],
            reasoning: 'Command is already well-structured',
            before: { name: 'gsd-perfect', description: 'perfect', promptTemplate: 'perfect' },
            after: null,
          },
        ],
        metadata: { enhanced: 0, unchanged: 1, failed: 0 },
      };

      await writeEnhancementLog(entry);

      const logPath = join(testDir, '.gsdo', 'gsdo.log');
      const content = readFileSync(logPath, 'utf-8');

      expect(content).toContain('**Status:** — Unchanged');
      expect(content).toContain('**Reasoning:**');
      expect(content).toContain('already well-structured');
    });

    it('appends multiple entries without overwriting', async () => {
      const entry1: EnhancementLogEntry = {
        timestamp: '2024-01-20T10:00:00.000Z',
        summary: 'First run',
        results: [
          {
            commandName: 'gsd-first',
            enhanced: true,
            changes: ['Initial enhancement'],
            reasoning: 'First enhancement run',
            before: { name: 'gsd-first', description: 'old', promptTemplate: 'old' },
            after: { name: 'gsd-first', description: 'new', promptTemplate: 'new' },
          },
        ],
        metadata: { enhanced: 1, unchanged: 0, failed: 0 },
      };

      const entry2: EnhancementLogEntry = {
        timestamp: '2024-01-20T11:00:00.000Z',
        summary: 'Second run',
        results: [
          {
            commandName: 'gsd-second',
            enhanced: true,
            changes: ['Second enhancement'],
            reasoning: 'Second enhancement run',
            before: { name: 'gsd-second', description: 'old2', promptTemplate: 'old2' },
            after: { name: 'gsd-second', description: 'new2', promptTemplate: 'new2' },
          },
        ],
        metadata: { enhanced: 1, unchanged: 0, failed: 0 },
      };

      await writeEnhancementLog(entry1);
      await writeEnhancementLog(entry2);

      const logPath = join(testDir, '.gsdo', 'gsdo.log');
      const content = readFileSync(logPath, 'utf-8');

      // Should have header only once
      const headerMatches = content.match(/# Enhancement Log/g);
      expect(headerMatches).toHaveLength(1);

      // Should have both entries
      expect(content).toContain('2024-01-20T10:00:00.000Z - First run');
      expect(content).toContain('2024-01-20T11:00:00.000Z - Second run');
      expect(content).toContain('gsd-first');
      expect(content).toContain('gsd-second');

      // Should have separator between entries
      const separators = content.match(/---/g);
      expect(separators!.length).toBeGreaterThanOrEqual(2);
    });

    it('includes metadata summary with counts', async () => {
      const entry: EnhancementLogEntry = {
        timestamp: '2024-01-20T10:30:00.000Z',
        summary: 'Mixed results',
        results: [
          {
            commandName: 'gsd-enhanced',
            enhanced: true,
            changes: ['Change 1'],
            reasoning: 'Reason 1',
            before: { name: 'gsd-enhanced', description: 'old', promptTemplate: 'old' },
            after: { name: 'gsd-enhanced', description: 'new', promptTemplate: 'new' },
          },
          {
            commandName: 'gsd-unchanged',
            enhanced: false,
            changes: [],
            reasoning: 'Already good',
            before: { name: 'gsd-unchanged', description: 'good', promptTemplate: 'good' },
            after: null,
          },
          {
            commandName: 'gsd-failed',
            enhanced: false,
            changes: [],
            reasoning: '',
            before: { name: 'gsd-failed', description: 'test', promptTemplate: 'test' },
            after: null,
            error: 'API error',
          },
        ],
        metadata: { enhanced: 1, unchanged: 1, failed: 1 },
      };

      await writeEnhancementLog(entry);

      const logPath = join(testDir, '.gsdo', 'gsdo.log');
      const content = readFileSync(logPath, 'utf-8');

      expect(content).toContain('**Summary:**');
      expect(content).toContain('- Enhanced: 1');
      expect(content).toContain('- Unchanged: 1');
      expect(content).toContain('- Failed: 1');
    });
  });
});
