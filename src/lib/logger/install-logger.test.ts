import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeInstallLog } from './install-logger.js';
import { LogEntry, LogLevel } from './types.js';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_LOG_DIR = join(tmpdir(), 'gsdo-test');
const TEST_LOG_PATH = join(TEST_LOG_DIR, 'install.log');

// Mock the paths module to use test directory
vi.mock('../paths.js', () => ({
  resolveHome: (path: string) => {
    if (path === '~/.gsdo/install.log') {
      return TEST_LOG_PATH;
    }
    if (path === '~/.gsdo') {
      return TEST_LOG_DIR;
    }
    return path.replace('~/', `${process.env.HOME || process.env.USERPROFILE}/`);
  }
}));

describe('install-logger', () => {
  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(TEST_LOG_DIR)) {
      await rm(TEST_LOG_DIR, { recursive: true });
    }
  });

  afterEach(async () => {
    // Clean up after tests
    if (existsSync(TEST_LOG_DIR)) {
      await rm(TEST_LOG_DIR, { recursive: true });
    }
  });

  it('creates log directory if it does not exist', async () => {
    const entry: LogEntry = {
      timestamp: '2026-01-23T08:00:00Z',
      level: LogLevel.INFO,
      summary: 'Test entry',
      commands: [],
      metadata: { successful: 0, warnings: 0, errors: 0 }
    };

    await writeInstallLog(entry);

    expect(existsSync(TEST_LOG_DIR)).toBe(true);
    expect(existsSync(TEST_LOG_PATH)).toBe(true);
  });

  it('formats entry as markdown with headers and metadata', async () => {
    const entry: LogEntry = {
      timestamp: '2026-01-23T08:00:00Z',
      level: LogLevel.INFO,
      summary: 'Transpiled 3 commands from GSD',
      commands: [
        { name: 'gsd-execute-phase', status: 'success' },
        { name: 'gsd-plan-phase', status: 'success' },
        { name: 'gsd-research', status: 'success' }
      ],
      metadata: { successful: 3, warnings: 0, errors: 0 }
    };

    await writeInstallLog(entry);

    const content = await readFile(TEST_LOG_PATH, 'utf-8');

    expect(content).toContain('# Installation Log');
    expect(content).toContain('## 2026-01-23T08:00:00Z - Transpiled 3 commands from GSD');
    expect(content).toContain('**Summary:** 3 successful, 0 warnings, 0 errors');
    expect(content).toContain('✓ **gsd-execute-phase** - success');
  });

  it('includes warnings in command details', async () => {
    const entry: LogEntry = {
      timestamp: '2026-01-23T08:00:00Z',
      level: LogLevel.WARN,
      summary: 'Transpiled 1 command with warnings',
      commands: [
        {
          name: 'gsd-test',
          status: 'success',
          warnings: ['Empty template body', 'Undocumented variable: {{foo}}']
        }
      ],
      metadata: { successful: 1, warnings: 2, errors: 0 }
    };

    await writeInstallLog(entry);

    const content = await readFile(TEST_LOG_PATH, 'utf-8');

    expect(content).toContain('⚠ **gsd-test** - success');
    expect(content).toContain('Warning [W002]: Empty template body');
    expect(content).toContain('Warning [W003]: Undocumented variable: {{foo}}');
  });

  it('includes errors with error codes', async () => {
    const entry: LogEntry = {
      timestamp: '2026-01-23T08:00:00Z',
      level: LogLevel.ERROR,
      summary: 'Transpilation failed for 1 command',
      commands: [
        {
          name: 'gsd-broken',
          status: 'failure',
          error: 'Failed to extract template from markdown'
        }
      ],
      metadata: { successful: 0, warnings: 0, errors: 1 }
    };

    await writeInstallLog(entry);

    const content = await readFile(TEST_LOG_PATH, 'utf-8');

    expect(content).toContain('✗ **gsd-broken** - failure');
    expect(content).toContain('Error [E001]: Failed to extract template from markdown');
  });

  it('embeds JSON block with full entry data', async () => {
    const entry: LogEntry = {
      timestamp: '2026-01-23T08:00:00Z',
      level: LogLevel.INFO,
      summary: 'Test entry',
      commands: [{ name: 'gsd-test', status: 'success' }],
      metadata: { successful: 1, warnings: 0, errors: 0 }
    };

    await writeInstallLog(entry);

    const content = await readFile(TEST_LOG_PATH, 'utf-8');

    expect(content).toContain('### Raw Data');
    expect(content).toContain('```json');
    expect(content).toContain('"timestamp": "2026-01-23T08:00:00Z"');
    expect(content).toContain('"level": "INFO"');
    expect(content).toContain('```');
  });

  it('appends entries without overwriting', async () => {
    const entry1: LogEntry = {
      timestamp: '2026-01-23T08:00:00Z',
      level: LogLevel.INFO,
      summary: 'First entry',
      commands: [],
      metadata: { successful: 0, warnings: 0, errors: 0 }
    };

    const entry2: LogEntry = {
      timestamp: '2026-01-23T09:00:00Z',
      level: LogLevel.INFO,
      summary: 'Second entry',
      commands: [],
      metadata: { successful: 0, warnings: 0, errors: 0 }
    };

    await writeInstallLog(entry1);
    await writeInstallLog(entry2);

    const content = await readFile(TEST_LOG_PATH, 'utf-8');

    expect(content).toContain('First entry');
    expect(content).toContain('Second entry');
    expect(content.match(/# Installation Log/g)?.length).toBe(2);
    expect(content.match(/---/g)?.length).toBe(2); // Two separators
  });

  it('includes horizontal rule separator between entries', async () => {
    const entry: LogEntry = {
      timestamp: '2026-01-23T08:00:00Z',
      level: LogLevel.INFO,
      summary: 'Test entry',
      commands: [],
      metadata: { successful: 0, warnings: 0, errors: 0 }
    };

    await writeInstallLog(entry);

    const content = await readFile(TEST_LOG_PATH, 'utf-8');

    expect(content).toContain('---');
  });
});
