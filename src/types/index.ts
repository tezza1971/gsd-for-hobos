import type { GSDIntermediate } from '../lib/transpilation/ir-types.js';

export interface CLIOptions {
  verbose: boolean;
  quiet: boolean;
  dryRun: boolean;
}

export interface GSDDetectionResult {
  found: boolean;
  path?: string;
  valid?: boolean;
  fresh?: boolean;
  daysOld?: number;
  missingFiles?: string[];
  missingDirs?: string[];
  reason?: string;
}

export interface OpenCodeDetectionResult {
  found: boolean;
  path?: string;
  reason?: string;
}

/**
 * Aggregated validation report for all detection results.
 * Used by reporter to format and display detection status.
 */
export interface ValidationReport {
  gsd: GSDDetectionResult;
  opencode: OpenCodeDetectionResult;
  ready: boolean;
}

/**
 * Parse error with location information.
 */
export interface ParseError {
  /** File path where error occurred */
  file: string;
  /** Line number (if available) */
  line?: number;
  /** Error message */
  message: string;
  /** Stack trace (if available) */
  stack?: string;
}

/**
 * Result of parsing GSD files into Intermediate Representation.
 */
export interface GSDParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed intermediate representation (undefined if parsing failed completely) */
  ir?: GSDIntermediate;
  /** Parse errors encountered (can have errors even with partial success) */
  errors: ParseError[];
  /** Non-critical warnings */
  warnings: string[];
}
