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

/**
 * OpenCode agent configuration.
 */
export interface OpenCodeAgent {
  name: string;
  model: string;
  systemMessage: string;
  description?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: string[];
  config?: Record<string, unknown>;
}

/**
 * OpenCode command configuration.
 */
export interface OpenCodeCommand {
  name: string;
  description: string;
  promptTemplate: string;
  config?: Record<string, unknown>;
}

/**
 * OpenCode model configuration.
 */
export interface OpenCodeModel {
  modelId: string;
  provider: string;
  endpoint?: string;
  config?: Record<string, unknown>;
}

/**
 * OpenCode settings configuration.
 */
export interface OpenCodeSettings {
  theme?: Record<string, unknown>;
  keybindings?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Complete OpenCode configuration structure.
 */
export interface OpenCodeConfig {
  agents: OpenCodeAgent[];
  commands: OpenCodeCommand[];
  models: OpenCodeModel[];
  settings: OpenCodeSettings;
}

/**
 * Gaps tracking for unmapped or approximated transformations.
 */
export interface TransformGaps {
  /** Fields from GSD that have no equivalent in OpenCode */
  unmappedFields: string[];
  /** Transformations that required approximation */
  approximations: Array<{
    original: string;
    approximatedAs: string;
    reason: string;
  }>;
}

/**
 * Result of transforming GSD IR to OpenCode configuration.
 */
export interface TransformResult {
  /** Whether transformation succeeded (no errors) */
  success: boolean;
  /** Transformed OpenCode configuration */
  opencode?: OpenCodeConfig;
  /** Transform errors encountered */
  errors: Array<{ message: string; stack?: string }>;
  /** Non-critical warnings */
  warnings: string[];
  /** Gap tracking for unmapped/approximated content */
  gaps: TransformGaps;
}

/**
 * Result of emitting OpenCode configuration to JSON files.
 */
export interface EmitResult {
  /** Whether emission succeeded */
  success: boolean;
  /** Map of filename to JSON content */
  files: Record<string, string>;
  /** Emit errors encountered */
  errors: Array<{ message: string }>;
}

/**
 * Entry in a backup manifest representing a backed-up file.
 */
export interface BackupFileEntry {
  /** Relative path from config directory */
  path: string;
  /** SHA256 hash of file contents */
  hash: string;
  /** File size in bytes */
  size: number;
  /** File permissions mode (for restoration) */
  mode?: number;
}

/**
 * Manifest for a backup operation.
 */
export interface BackupManifest {
  /** ISO 8601 timestamp of backup creation */
  timestamp: string;
  /** GSD source path that triggered the backup */
  source: string;
  /** List of backed-up files */
  files: BackupFileEntry[];
}

/**
 * GFH manifest tracking transpilation state.
 */
export interface GFHManifest {
  /** Manifest format version */
  version: '1.0';
  /** Last transpilation run details */
  lastRun: {
    /** ISO 8601 timestamp */
    timestamp: string;
    /** SHA256 hash of GSD source directory */
    sourceHash: string;
    /** SHA256 hash of generated OpenCode configs */
    outputHash: string;
    /** Backup details if created */
    backup?: {
      location: string;
      timestamp: string;
    };
  };
  /** Source to target file mappings */
  mappings: Array<{
    source: string;
    target: string;
    transformed: boolean;
  }>;
}

/**
 * Options for the transpilation process.
 */
export interface TranspileOptions {
  /** Path to GSD installation directory */
  gsdPath: string;
  /** OpenCode config directory (auto-detected if not provided) */
  opencodeConfigDir?: string;
  /** Preview changes without writing files */
  dryRun: boolean;
  /** Force transpilation even if source unchanged */
  force: boolean;
  /** Skip backup of existing configs */
  noBackup: boolean;
}

/**
 * Result of the transpilation process.
 */
export interface TranspileResult {
  /** Whether transpilation succeeded */
  success: boolean;
  /** Path to backup directory if created */
  backupLocation?: string;
  /** Path to GFH manifest file */
  manifestPath?: string;
  /** Errors encountered during transpilation */
  errors: string[];
  /** Non-critical warnings */
  warnings: string[];
  /** Gap tracking for unmapped/approximated content */
  gaps?: TransformGaps;
}
