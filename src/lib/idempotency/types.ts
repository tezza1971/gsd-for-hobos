/**
 * Record of a single skill file's path and modification time.
 * Used to detect changes in GSD installation between runs.
 */
export interface SkillFileRecord {
  /**
   * Absolute path to the skill file.
   * Example: "/home/user/.claude/get-shit-done/workflows/execute-plan.md"
   */
  path: string;

  /**
   * File modification timestamp in milliseconds since Unix epoch.
   * From fs.statSync(file).mtimeMs.
   * Example: 1737584123456
   */
  mtime: number;
}

/**
 * Snapshot of GSD import state at a point in time.
 * Persisted to ~/.gsdo/last-imported-gsd for idempotency checking.
 */
export interface ImportState {
  /**
   * ISO 8601 timestamp of when import/transpilation completed.
   * Example: "2026-01-23T12:30:45.123Z"
   */
  importedAt: string;

  /**
   * ISO 8601 timestamp of when docs cache was last refreshed.
   * Empty string if cache not yet populated.
   * Independent freshness tracking from import state.
   * Example: "2026-01-23T12:25:00.000Z"
   */
  docsCachedAt: string;

  /**
   * Array of skill file records with paths and modification times.
   * Sorted by path for deterministic comparison.
   */
  skills: SkillFileRecord[];
}
