import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { resolveHome } from '../paths.js';
import type { ImportState, SkillFileRecord } from './types.js';

/**
 * Returns absolute path to the import state file.
 * Location: ~/.gsdo/last-imported-gsd
 * @returns Absolute path to state file
 */
export function getStatePath(): string {
  return resolveHome('~/.gsdo/last-imported-gsd');
}

/**
 * Reads import state from persistent storage.
 * Returns null if file doesn't exist or contains invalid JSON.
 *
 * @returns ImportState if valid file exists, null otherwise
 */
export function readImportState(): ImportState | null {
  const statePath = getStatePath();

  // Check existence
  if (!existsSync(statePath)) {
    return null;
  }

  try {
    // Read and parse JSON
    const content = readFileSync(statePath, 'utf-8');
    const state: ImportState = JSON.parse(content);

    // Basic validation - check required fields exist
    if (!state.importedAt || state.docsCachedAt === undefined || !Array.isArray(state.skills)) {
      console.warn('  ⚠ Invalid state file structure, treating as missing');
      return null;
    }

    return state;
  } catch (error) {
    // Handle read errors or JSON parse errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`  ⚠ Failed to read state file: ${errorMessage}`);
    return null;
  }
}

/**
 * Writes import state to persistent storage.
 * Creates parent directory if it doesn't exist.
 *
 * @param state - Import state to persist
 */
export function writeImportState(state: ImportState): void {
  const statePath = getStatePath();
  const stateDir = dirname(statePath);

  // Ensure parent directory exists
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  // Write JSON with formatting for readability
  const content = JSON.stringify(state, null, 2);
  writeFileSync(statePath, content, 'utf-8');
}

/**
 * Builds current import state by scanning GSD workflows directory.
 * Reads all .md files in workflows/ and extracts their modification times.
 *
 * Algorithm:
 * 1. Scan workflows/ directory for markdown files
 * 2. Extract mtime for each .md file
 * 3. Sort by path for deterministic ordering
 * 4. Return ImportState snapshot
 *
 * @param gsdPath - Absolute path to GSD installation directory
 * @returns ImportState reflecting current filesystem state
 */
export function buildCurrentState(gsdPath: string): ImportState {
  const workflowsDir = join(gsdPath, 'workflows');
  const skills: SkillFileRecord[] = [];

  // Check if workflows directory exists
  if (!existsSync(workflowsDir)) {
    throw new Error(`Workflows directory not found: ${workflowsDir}`);
  }

  // Read all files in workflows directory
  const files = readdirSync(workflowsDir);

  // Filter to markdown files
  const skillFiles = files.filter(file => file.endsWith('.md'));

  // Extract path and mtime for each skill file
  for (const file of skillFiles) {
    const filePath = join(workflowsDir, file);
    try {
      const stats = statSync(filePath);
      skills.push({
        path: filePath,
        mtime: stats.mtimeMs
      });
    } catch (error) {
      // Skip files that can't be stat'd (permissions, etc.)
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`  ⚠ Failed to stat ${file}: ${errorMessage}`);
    }
  }

  // Sort by path for deterministic comparison
  skills.sort((a, b) => a.path.localeCompare(b.path));

  // Return snapshot with current timestamp
  return {
    importedAt: new Date().toISOString(),
    docsCachedAt: '', // CLI will update this separately
    skills
  };
}
