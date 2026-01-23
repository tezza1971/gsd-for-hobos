/**
 * Install logger - persists transpilation results to ~/.gsdo/install.md
 * in markdown/JSON hybrid format for human readability and machine parseability.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveHome } from '../paths.js';
import { LogEntry, LogLevel } from './types.js';

/**
 * Returns absolute path to install log file
 */
function getInstallLogPath(): string {
  return resolveHome('~/.gsdo/install.md');
}

/**
 * Returns absolute path to .gsdo directory
 */
function getGsdoDir(): string {
  return resolveHome('~/.gsdo');
}

/**
 * Maps error message to standardized error code
 */
function getErrorCode(error: string): string {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('template extraction') || lowerError.includes('extract template')) {
    return 'E001';
  }
  if (lowerError.includes('invalid markdown') || lowerError.includes('parse markdown')) {
    return 'E002';
  }
  if (lowerError.includes('missing description')) {
    return 'W001';
  }
  if (lowerError.includes('empty template')) {
    return 'W002';
  }
  if (lowerError.includes('undocumented variable')) {
    return 'W003';
  }
  return 'E000'; // Generic error
}

/**
 * Formats a log entry as markdown with embedded JSON
 */
function formatLogEntry(entry: LogEntry): string {
  const lines: string[] = [];

  // Header
  lines.push('# Installation Log');
  lines.push('');
  lines.push(`## ${entry.timestamp} - ${entry.summary}`);
  lines.push('');

  // Metadata summary
  lines.push(
    `**Summary:** ${entry.metadata.successful} successful, ${entry.metadata.warnings} warnings, ${entry.metadata.errors} errors`
  );
  lines.push('');

  // Per-command details
  if (entry.commands.length > 0) {
    lines.push('### Commands');
    lines.push('');

    for (const cmd of entry.commands) {
      let icon = '✓';
      if (cmd.status === 'failure') {
        icon = '✗';
      } else if (cmd.warnings && cmd.warnings.length > 0) {
        icon = '⚠';
      }

      lines.push(`${icon} **${cmd.name}** - ${cmd.status}`);

      if (cmd.error) {
        const code = cmd.errorCode || getErrorCode(cmd.error);
        lines.push(`  - Error [${code}]: ${cmd.error}`);
      }

      if (cmd.warnings && cmd.warnings.length > 0) {
        for (const warning of cmd.warnings) {
          const code = getErrorCode(warning);
          lines.push(`  - Warning [${code}]: ${warning}`);
        }
      }

      lines.push('');
    }
  }

  // Embedded JSON block
  lines.push('### Raw Data');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(entry, null, 2));
  lines.push('```');
  lines.push('');

  // Separator between entries
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * Writes a log entry to the install log file.
 * Appends to existing log (doesn't overwrite).
 * Creates ~/.gsdo/ directory if it doesn't exist.
 *
 * @param entry - Log entry to write
 * @throws Error if file writing fails
 */
export async function writeInstallLog(entry: LogEntry): Promise<void> {
  const gsdoDir = getGsdoDir();
  const logPath = getInstallLogPath();

  try {
    // Create ~/.gsdo/ directory if it doesn't exist
    if (!existsSync(gsdoDir)) {
      await mkdir(gsdoDir, { recursive: true });
    }

    // Format entry as markdown/JSON hybrid
    const formatted = formatLogEntry(entry);

    // Append to log file (doesn't overwrite)
    await appendFile(logPath, formatted, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to write install log: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
