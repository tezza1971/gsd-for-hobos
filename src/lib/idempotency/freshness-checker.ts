import type { ImportState } from './types.js';

/**
 * Result of freshness check indicating whether re-transpilation is needed.
 */
export interface FreshnessResult {
  /**
   * True if no changes detected (skip transpilation).
   * False if changes detected (re-transpilation required).
   */
  fresh: boolean;

  /**
   * Human-readable reason explaining why re-transpilation is needed.
   * Only present when fresh=false.
   * Examples:
   * - "First run"
   * - "File count changed (3 -> 4)"
   * - "New file: /path/to/skill.md"
   * - "Modified: /path/to/skill.md"
   * - "Deleted: /path/to/skill.md"
   */
  reason?: string;
}

/**
 * Checks if GSD source files have changed since last import.
 * Compares previous vs current state to detect file additions, deletions, or modifications.
 *
 * Detection algorithm:
 * 1. Check if previous state exists (null = first run)
 * 2. Compare file counts (quick check for additions/deletions)
 * 3. Build maps of files by path
 * 4. Check for new files not in previous state
 * 5. Check for deleted files not in current state
 * 6. Check for modified files (mtime changed)
 *
 * @param previous - Previous import state from state file (null if first run)
 * @param current - Current import state from filesystem scan
 * @returns FreshnessResult with fresh=true if no changes, fresh=false with reason if changes detected
 */
export function checkFreshness(
  previous: ImportState | null,
  current: ImportState
): FreshnessResult {
  // First run - no previous state to compare
  if (previous === null) {
    return {
      fresh: false,
      reason: 'First run'
    };
  }

  // Quick check: file count changed
  if (previous.skills.length !== current.skills.length) {
    return {
      fresh: false,
      reason: `File count changed (${previous.skills.length} -> ${current.skills.length})`
    };
  }

  // Build maps for efficient lookup: path -> mtime
  const previousMap = new Map<string, number>();
  for (const skill of previous.skills) {
    previousMap.set(skill.path, skill.mtime);
  }

  const currentMap = new Map<string, number>();
  for (const skill of current.skills) {
    currentMap.set(skill.path, skill.mtime);
  }

  // Check for new files (in current but not in previous)
  for (const skill of current.skills) {
    if (!previousMap.has(skill.path)) {
      return {
        fresh: false,
        reason: `New file: ${skill.path}`
      };
    }
  }

  // Check for deleted files (in previous but not in current)
  for (const skill of previous.skills) {
    if (!currentMap.has(skill.path)) {
      return {
        fresh: false,
        reason: `Deleted: ${skill.path}`
      };
    }
  }

  // Check for modifications (same path, different mtime)
  for (const skill of current.skills) {
    const previousMtime = previousMap.get(skill.path);
    if (previousMtime !== undefined && previousMtime !== skill.mtime) {
      return {
        fresh: false,
        reason: `Modified: ${skill.path}`
      };
    }
  }

  // All checks passed - no changes detected
  return {
    fresh: true
  };
}
