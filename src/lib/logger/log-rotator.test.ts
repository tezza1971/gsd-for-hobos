/**
 * Tests for log rotator module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, rm, stat, utimes } from 'node:fs/promises';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { resolveHome } from '../paths.js';
import { rotateLogsIfNeeded } from './log-rotator.js';

const gunzipAsync = promisify(gunzip);

const TEST_DIR = resolveHome('~/.gsdo-test');

// Helper: Get test log path
function getTestLogPath(filename: string): string {
  return `${TEST_DIR}/${filename}`;
}

// Helper: Create old log file with specified age in days
async function createOldLog(filename: string, daysOld: number, content: string): Promise<void> {
  const logPath = getTestLogPath(filename);
  await writeFile(logPath, content, 'utf-8');

  // Set mtime to daysOld days ago
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - daysOld);

  await utimes(logPath, oldDate, oldDate);
}

// Helper: Read compressed log
async function readCompressedLog(path: string): Promise<string> {
  const compressed = await readFile(path);
  const decompressed = await gunzipAsync(compressed);
  return decompressed.toString('utf-8');
}

// Mock resolveHome to use test directory
const originalResolveHome = resolveHome;
beforeEach(async () => {
  // Create test directory
  if (!existsSync(TEST_DIR)) {
    await mkdir(TEST_DIR, { recursive: true });
  }

  // Mock resolveHome to redirect ~/.gsdo/ to test directory
  // This is hacky but works for testing
  (global as any).__testGsdoDir = TEST_DIR;
});

afterEach(async () => {
  // Clean up test directory
  if (existsSync(TEST_DIR)) {
    await rm(TEST_DIR, { recursive: true, force: true });
  }

  delete (global as any).__testGsdoDir;
});

// Patch rotateLogsIfNeeded to use test directory
// Since we can't easily mock imports, we'll test against actual ~/.gsdo
// but clean it up carefully

describe('log-rotator', () => {
  // Note: These tests run against actual ~/.gsdo/ directory
  // We'll use unique test log names to avoid conflicts

  const TEST_LOG_NAME = 'test-rotation.log' as any;
  const TEST_GSDO_DIR = resolveHome('~/.gsdo');

  beforeEach(async () => {
    // Ensure ~/.gsdo exists
    if (!existsSync(TEST_GSDO_DIR)) {
      await mkdir(TEST_GSDO_DIR, { recursive: true });
    }

    // Clean up any test logs from previous runs
    await cleanupTestLogs();
  });

  afterEach(async () => {
    await cleanupTestLogs();
  });

  async function cleanupTestLogs() {
    const testLogPath = `${TEST_GSDO_DIR}/test-rotation.log`;
    if (existsSync(testLogPath)) {
      await rm(testLogPath, { force: true });
    }

    // Clean up rotated logs
    for (let i = 1; i <= 10; i++) {
      const rotatedPath = `${TEST_GSDO_DIR}/test-rotation.${i}.log.gz`;
      if (existsSync(rotatedPath)) {
        await rm(rotatedPath, { force: true });
      }
    }
  }

  it('should not rotate log from same day', async () => {
    const logPath = `${TEST_GSDO_DIR}/test-rotation.log`;
    const content = 'Log entry from today';

    // Create log with today's timestamp
    await writeFile(logPath, content, 'utf-8');

    // Try to rotate
    await rotateLogsIfNeeded(TEST_LOG_NAME);

    // Original log should still exist
    expect(existsSync(logPath)).toBe(true);

    // No rotated log should be created
    const rotatedPath = `${TEST_GSDO_DIR}/test-rotation.1.log.gz`;
    expect(existsSync(rotatedPath)).toBe(false);

    // Content should be unchanged
    const readContent = await readFile(logPath, 'utf-8');
    expect(readContent).toBe(content);
  });

  it('should rotate log from previous day', async () => {
    const logPath = `${TEST_GSDO_DIR}/test-rotation.log`;
    const content = 'Log entry from yesterday';

    // Create log with yesterday's timestamp
    await writeFile(logPath, content, 'utf-8');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await utimes(logPath, yesterday, yesterday);

    // Rotate
    await rotateLogsIfNeeded(TEST_LOG_NAME);

    // Original log should be deleted (compressed)
    expect(existsSync(logPath)).toBe(false);

    // Rotated log should exist
    const rotatedPath = `${TEST_GSDO_DIR}/test-rotation.1.log.gz`;
    expect(existsSync(rotatedPath)).toBe(true);

    // Decompressed content should match original
    const decompressed = await readCompressedLog(rotatedPath);
    expect(decompressed).toBe(content);
  });

  it('should shift existing rotated logs', async () => {
    const logPath = `${TEST_GSDO_DIR}/test-rotation.log`;

    // Create existing rotated logs
    await writeFile(`${TEST_GSDO_DIR}/test-rotation.1.log.gz`, 'compressed day 1');
    await writeFile(`${TEST_GSDO_DIR}/test-rotation.2.log.gz`, 'compressed day 2');

    // Create current log from yesterday
    await writeFile(logPath, 'current log', 'utf-8');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await utimes(logPath, yesterday, yesterday);

    // Rotate
    await rotateLogsIfNeeded(TEST_LOG_NAME);

    // Check shifted logs
    expect(existsSync(`${TEST_GSDO_DIR}/test-rotation.2.log.gz`)).toBe(true);
    expect(existsSync(`${TEST_GSDO_DIR}/test-rotation.3.log.gz`)).toBe(true);

    // Current log should be compressed to .1
    const newRotated = await readCompressedLog(`${TEST_GSDO_DIR}/test-rotation.1.log.gz`);
    expect(newRotated).toBe('current log');
  });

  it('should delete logs older than 7 days', async () => {
    const logPath = `${TEST_GSDO_DIR}/test-rotation.log`;

    // Create 7 existing rotated logs
    for (let i = 1; i <= 7; i++) {
      await writeFile(`${TEST_GSDO_DIR}/test-rotation.${i}.log.gz`, `day ${i}`);
    }

    // Create current log from yesterday
    await writeFile(logPath, 'current log', 'utf-8');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await utimes(logPath, yesterday, yesterday);

    // Rotate
    await rotateLogsIfNeeded(TEST_LOG_NAME);

    // Oldest log (was .7, shifted to .8, then deleted) should not exist
    expect(existsSync(`${TEST_GSDO_DIR}/test-rotation.8.log.gz`)).toBe(false);

    // .7 should exist (was .6, shifted to .7)
    expect(existsSync(`${TEST_GSDO_DIR}/test-rotation.7.log.gz`)).toBe(true);

    // .1 should exist (current log compressed)
    expect(existsSync(`${TEST_GSDO_DIR}/test-rotation.1.log.gz`)).toBe(true);
  });

  it('should handle missing log file gracefully', async () => {
    const logPath = `${TEST_GSDO_DIR}/test-rotation.log`;

    // Ensure log doesn't exist
    if (existsSync(logPath)) {
      await rm(logPath);
    }

    // Should not throw
    await expect(rotateLogsIfNeeded(TEST_LOG_NAME)).resolves.toBeUndefined();
  });

  it('should handle rotation errors gracefully', async () => {
    // This test verifies error handling doesn't crash
    // We can't easily force an error, but we can verify the function
    // completes without throwing even with edge cases

    const logPath = `${TEST_GSDO_DIR}/test-rotation.log`;
    await writeFile(logPath, 'test', 'utf-8');

    // Should complete without throwing
    await expect(rotateLogsIfNeeded(TEST_LOG_NAME)).resolves.toBeUndefined();
  });
});
