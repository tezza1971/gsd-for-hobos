/**
 * File Copier
 *
 * Copies original GSD skill markdown files to ~/.gsdo/copied/ for /gsdo command
 * to examine and transpile one by one.
 */

import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveHome } from '../paths.js';

/**
 * Returns absolute path to GSD copied files directory
 * Location: ~/.gsdo/copied/
 */
export function getGsdoCopiedPath(): string {
  return resolveHome('~/.gsdo/copied');
}

/**
 * Copies all GSD workflow markdown files to ~/.gsdo/copied/ for /gsdo to process.
 * This allows /gsdo to examine each file and do a true transpilation.
 *
 * @param gsdPath - Path to GSD installation (e.g., ~/.claude/get-shit-done)
 * @throws Error if copy operation fails
 */
export function copyGsdFiles(gsdPath: string): number {
  const workflowsPath = join(gsdPath, 'workflows');
  const copiedDir = getGsdoCopiedPath();

  // Ensure destination directory exists
  try {
    if (!existsSync(copiedDir)) {
      mkdirSync(copiedDir, { recursive: true });
    }
  } catch (error) {
    throw new Error(
      `Failed to create copied files directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  let copiedCount = 0;

  try {
    // Check if workflows directory exists
    if (!existsSync(workflowsPath)) {
      return 0;
    }

    const entries = readdirSync(workflowsPath);

    for (const entry of entries) {
      const fullPath = join(workflowsPath, entry);

      // Copy .md files from workflows directory
      if (entry.endsWith('.md')) {
        const destPath = join(copiedDir, entry);
        copyFileSync(fullPath, destPath);
        copiedCount++;
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to copy GSD files: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return copiedCount;
}
