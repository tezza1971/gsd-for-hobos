/**
 * Enhancement Logger for /gsdo command
 *
 * Writes detailed enhancement logs with before/after command JSON and LLM reasoning.
 * Format: Human-readable markdown with embedded JSON blocks for machine parsing.
 * Location: ~/.gsdo/gsdo.log
 */

import { existsSync, mkdirSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveHome } from '../paths.js';
import type { OpenCodeCommand } from '../transpiler/types.js';

/**
 * Single command enhancement result for logging.
 */
export interface CommandEnhancementLogEntry {
  commandName: string;
  enhanced: boolean;
  changes: string[];
  reasoning: string;
  before: OpenCodeCommand | null;
  after: OpenCodeCommand | null;
  error?: string;
}

/**
 * Full enhancement log entry (one per /gsdo run).
 */
export interface EnhancementLogEntry {
  /** ISO timestamp of enhancement run */
  timestamp: string;
  /** Human-readable summary (e.g., "Enhanced 5 commands") */
  summary: string;
  /** Per-command results with before/after snapshots */
  results: CommandEnhancementLogEntry[];
  /** Aggregate metadata */
  metadata: {
    enhanced: number;
    unchanged: number;
    failed: number;
  };
}

/**
 * Formats a single command result as markdown section.
 *
 * @param result - Command enhancement result
 * @returns Markdown section with status, changes, reasoning, JSON blocks
 */
function formatCommandResult(result: CommandEnhancementLogEntry): string {
  const sections: string[] = [];

  // Command heading
  sections.push(`### ${result.commandName}`);
  sections.push('');

  // Status indicator
  let status: string;
  if (result.error) {
    status = `**Status:** ✗ Failed`;
  } else if (result.enhanced) {
    status = `**Status:** ✓ Enhanced`;
  } else {
    status = `**Status:** — Unchanged`;
  }
  sections.push(status);
  sections.push('');

  // Changes list (if enhanced)
  if (result.enhanced && result.changes.length > 0) {
    sections.push('**Changes:**');
    for (const change of result.changes) {
      sections.push(`- ${change}`);
    }
    sections.push('');
  }

  // Reasoning (if available)
  if (result.reasoning) {
    sections.push('**Reasoning:**');
    sections.push(result.reasoning);
    sections.push('');
  }

  // Error message (if failed)
  if (result.error) {
    sections.push('**Error:**');
    sections.push(result.error);
    sections.push('');
  }

  // Before JSON
  if (result.before) {
    sections.push('**Before:**');
    sections.push('```json');
    sections.push(JSON.stringify(result.before, null, 2));
    sections.push('```');
    sections.push('');
  }

  // After JSON (if enhanced)
  if (result.after && result.enhanced) {
    sections.push('**After:**');
    sections.push('```json');
    sections.push(JSON.stringify(result.after, null, 2));
    sections.push('```');
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Formats full enhancement log entry as markdown.
 *
 * @param entry - Enhancement log entry
 * @returns Formatted markdown string
 */
function formatLogEntry(entry: EnhancementLogEntry): string {
  const sections: string[] = [];

  // Main header (only for first entry)
  // Note: We'll check if file exists and only add header if creating new file

  // Entry header with timestamp
  sections.push(`## ${entry.timestamp} - ${entry.summary}`);
  sections.push('');

  // Metadata summary
  sections.push('**Summary:**');
  sections.push(
    `- Enhanced: ${entry.metadata.enhanced}`,
    `- Unchanged: ${entry.metadata.unchanged}`,
    `- Failed: ${entry.metadata.failed}`
  );
  sections.push('');

  // Per-command results
  for (const result of entry.results) {
    sections.push(formatCommandResult(result));
  }

  // Separator between entries
  sections.push('---');
  sections.push('');

  return sections.join('\n');
}

/**
 * Writes enhancement log entry to ~/.gsdo/gsdo.log.
 * Creates directory and file if needed. Appends to existing log.
 * Non-blocking: logs warnings but doesn't throw on write failures.
 *
 * @param entry - Enhancement log entry to write
 */
export async function writeEnhancementLog(
  entry: EnhancementLogEntry
): Promise<void> {
  try {
    const logPath = resolveHome('~/.gsdo/gsdo.log');
    const logDir = dirname(logPath);

    // Create directory if needed
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Check if file exists to decide on header
    const fileExists = existsSync(logPath);
    let content = '';

    // Add main header if creating new file
    if (!fileExists) {
      content += '# Enhancement Log\n\n';
      content += 'This file contains detailed enhancement results from /gsdo command runs.\n\n';
      content += '---\n\n';
    }

    // Add formatted entry
    content += formatLogEntry(entry);

    // Append to file
    await appendFile(logPath, content, 'utf-8');
  } catch (error) {
    // Non-blocking: log warning but don't throw
    console.warn(
      'Failed to write enhancement log:',
      error instanceof Error ? error.message : String(error)
    );
  }
}
