/**
 * Metadata stored alongside cached documentation.
 * Tracks download timestamp and source information for freshness checking.
 */
export interface CacheMetadata {
  /**
   * ISO 8601 timestamp of when the documentation was downloaded.
   * Example: "2026-01-22T10:30:00.000Z"
   */
  downloadedAt: string;

  /**
   * Source URL where the documentation was fetched from.
   * Example: "https://raw.githubusercontent.com/OpenAgentsInc/opencode/main/README.md"
   */
  source: string;

  /**
   * Optional version identifier for the cached documentation.
   * May be commit hash, tag, or version string.
   */
  version?: string;
}

/**
 * Result of a documentation download operation.
 * Indicates success/failure and whether cache was used.
 */
export interface DownloadResult {
  /**
   * True if download succeeded or cache was valid, false on errors.
   */
  success: boolean;

  /**
   * Error message if success is false. Undefined on success.
   */
  error?: string;

  /**
   * True if existing cache was used instead of downloading.
   * False if fresh download occurred.
   */
  cached: boolean;
}
