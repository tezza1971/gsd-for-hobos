/**
 * Logging types for installer and enhancement operations
 */

/**
 * Log severity levels
 */
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Result of a single command transpilation/enhancement
 */
export interface CommandResult {
  /** Command name (e.g., gsd-execute-phase) */
  name: string;
  /** Success or failure status */
  status: 'success' | 'failure';
  /** Warning messages (empty template, undocumented variables, etc.) */
  warnings?: string[];
  /** Error message if failed */
  error?: string;
  /** Standardized error code (E001, E002, W001, etc.) */
  errorCode?: string;
}

/**
 * Complete log entry for a single installer run
 */
export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Severity level */
  level: LogLevel;
  /** Human-readable summary of the operation */
  summary: string;
  /** Per-command results */
  commands: CommandResult[];
  /** Aggregate metadata */
  metadata: {
    successful: number;
    warnings: number;
    errors: number;
  };
}
