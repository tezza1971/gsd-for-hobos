/**
 * Log Rotator - Daily rotation with compression and 7-day retention
 *
 * Handles rotation for install.log and gsdo.log files in ~/.gsdo/.
 * Rotation strategy:
 * - Daily rotation on first run of new day (checked via mtime)
 * - Current log: [name].log (uncompressed)
 * - Yesterday: [name].1.log.gz
 * - 2 days ago: [name].2.log.gz
 * - ...
 * - 7 days ago: [name].7.log.gz
 * - Older logs deleted automatically
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { resolveHome } from '../paths.js';

const gzipAsync = promisify(gzip);

/**
 * Maximum number of rotated logs to retain (7 days)
 */
const MAX_ROTATED_LOGS = 7;

/**
 * Returns absolute path to log file in ~/.gsdo/
 */
function getLogPath(logFilename: string): string {
  return resolveHome(`~/.gsdo/${logFilename}`);
}

/**
 * Returns absolute path to rotated log file
 * Example: install.1.log.gz, gsdo.3.log.gz
 */
function getRotatedLogPath(logFilename: string, index: number): string {
  const baseName = logFilename.replace(/\.log$/, '');
  return resolveHome(`~/.gsdo/${baseName}.${index}.log.gz`);
}

/**
 * Extracts date string (YYYY-MM-DD) from Date object
 */
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Checks if log file was last modified on a different day than today.
 * Returns true if rotation is needed (log is from previous day or older).
 */
async function needsRotation(logPath: string): Promise<boolean> {
  try {
    const stats = await stat(logPath);
    const lastModified = new Date(stats.mtime);
    const today = new Date();

    const lastModifiedDate = getDateString(lastModified);
    const todayDate = getDateString(today);

    return lastModifiedDate !== todayDate;
  } catch (error) {
    // If stat fails, assume no rotation needed (file might not exist)
    return false;
  }
}

/**
 * Compresses a log file using gzip compression.
 *
 * @param sourcePath - Path to uncompressed source file
 * @param destPath - Path to compressed destination file (.gz)
 */
async function compressLog(sourcePath: string, destPath: string): Promise<void> {
  try {
    // Read source file
    const content = await readFile(sourcePath);

    // Compress with gzip
    const compressed = await gzipAsync(content);

    // Write to destination
    await writeFile(destPath, compressed);

    // Delete original (only after successful compression)
    await unlink(sourcePath);
  } catch (error) {
    throw new Error(
      `Failed to compress log from ${sourcePath} to ${destPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Shifts existing rotated logs up by one index.
 * Example:
 * - install.6.log.gz -> install.7.log.gz (delete 7)
 * - install.5.log.gz -> install.6.log.gz
 * - ...
 * - install.1.log.gz -> install.2.log.gz
 *
 * Works backwards to avoid overwriting files.
 */
async function shiftRotatedLogs(logFilename: string): Promise<void> {
  const baseName = logFilename.replace(/\.log$/, '');

  // First, delete the oldest log if it exists (index MAX_ROTATED_LOGS)
  const oldestLogPath = getRotatedLogPath(logFilename, MAX_ROTATED_LOGS);
  if (existsSync(oldestLogPath)) {
    try {
      await unlink(oldestLogPath);
    } catch (error) {
      // Non-critical: log warning but continue
      console.warn(
        `Warning: Failed to delete oldest log ${oldestLogPath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Shift logs backwards (from MAX_ROTATED_LOGS-1 down to 1)
  for (let i = MAX_ROTATED_LOGS - 1; i >= 1; i--) {
    const currentPath = getRotatedLogPath(logFilename, i);
    const nextPath = getRotatedLogPath(logFilename, i + 1);

    if (existsSync(currentPath)) {
      try {
        await rename(currentPath, nextPath);
      } catch (error) {
        // Non-critical: log warning but continue
        console.warn(
          `Warning: Failed to rotate ${currentPath} to ${nextPath}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  // Clean up any logs beyond MAX_ROTATED_LOGS (shouldn't exist, but defensive)
  for (let i = MAX_ROTATED_LOGS + 1; i <= MAX_ROTATED_LOGS + 10; i++) {
    const extraLogPath = getRotatedLogPath(logFilename, i);
    if (existsSync(extraLogPath)) {
      try {
        await unlink(extraLogPath);
      } catch (error) {
        console.warn(
          `Warning: Failed to delete extra log ${extraLogPath}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }
}

/**
 * Rotates log file if it's from a previous day.
 * Performs:
 * 1. Check if rotation needed (same-day check)
 * 2. Shift existing rotated logs (N -> N+1)
 * 3. Compress current log to .1.log.gz
 * 4. Delete logs older than MAX_ROTATED_LOGS days
 *
 * Rotation is transparent - failures log warnings but don't throw.
 * This ensures log rotation issues don't crash installer or /gsdo.
 *
 * @param logFilename - Name of log file ('install.log' or 'gsdo.log')
 */
export async function rotateLogsIfNeeded(
  logFilename: 'install.log' | 'gsdo.log'
): Promise<void> {
  try {
    const logPath = getLogPath(logFilename);

    // Early return if log doesn't exist
    if (!existsSync(logPath)) {
      return;
    }

    // Check if rotation needed (different day)
    const shouldRotate = await needsRotation(logPath);
    if (!shouldRotate) {
      return; // Same day - no rotation needed
    }

    // Perform rotation
    // Step 1: Shift existing rotated logs (6->7, 5->6, ..., 1->2)
    await shiftRotatedLogs(logFilename);

    // Step 2: Compress current log to .1.log.gz
    const firstRotatedPath = getRotatedLogPath(logFilename, 1);
    await compressLog(logPath, firstRotatedPath);

    // Current log now deleted (by compressLog), ready for new entries
  } catch (error) {
    // Graceful error handling - rotation failures shouldn't crash
    console.warn(
      `Warning: Log rotation failed for ${logFilename}:`,
      error instanceof Error ? error.message : String(error)
    );
    console.warn('Continuing without rotation (log will keep growing)');
  }
}
