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
 * Category indicating the cause of a transformation gap.
 * Used in reporting to help users understand why features couldn't map.
 *
 * - 'unsupported' - Feature doesn't exist in OpenCode (shown as red in reports)
 * - 'platform' - Feature exists but syntax differs (shown as yellow in reports)
 * - 'missing-dependency' - Requires external plugin/module (shown as blue in reports)
 */
export type GapCategory = 'unsupported' | 'platform' | 'missing-dependency';

/**
 * Unmapped field entry with full attribution and actionable guidance.
 * Enhanced for detailed shortfall reporting.
 */
export interface UnmappedField {
  /** Field name that couldn't be mapped */
  field: string;
  /** Original value from GSD */
  value: unknown;
  /** Why the field couldn't be mapped */
  reason: string;
  /** GSD file path containing this field (e.g., 'agents.xml', 'commands.xml') */
  sourceFile: string;
  /** Category indicating cause of the gap */
  category: GapCategory;
  /** Actionable suggestion for the user */
  suggestion: string;
}

/**
 * Approximation entry with source attribution.
 * Enhanced for detailed shortfall reporting.
 */
export interface ApproximationEntry {
  /** Original GSD field reference (e.g., 'agent.myagent.tools') */
  original: string;
  /** What it was approximated as in OpenCode */
  approximatedAs: string;
  /** Explanation of the approximation */
  reason: string;
  /** GSD file path containing the approximated field */
  sourceFile: string;
  /** Category indicating cause of the approximation */
  category: GapCategory;
}

/**
 * Gaps tracking for unmapped or approximated transformations.
 * Enhanced with source attribution, categorization, and suggestions for reporting.
 *
 * Used by the transpilation pipeline to track what couldn't be directly mapped
 * and provide actionable guidance to users.
 */
export interface TransformGaps {
  /** Fields from GSD that have no equivalent in OpenCode */
  unmappedFields: UnmappedField[];
  /** Transformations that required approximation */
  approximations: ApproximationEntry[];
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
 * GSD Open manifest tracking transpilation state.
 */
export interface GSDOManifest {
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
 * Metadata about transformed artifacts for reporting.
 * Populated by orchestrator to provide artifact lists for status sections.
 */
export interface TransformedArtifactsMetadata {
  /** Command names that were transformed (e.g., '/gsd:plan-phase') */
  commands: string[];
  /** Agent names that were transformed */
  agents: string[];
  /** Model IDs that were transformed */
  models: string[];
}

/**
 * Result of the transpilation process.
 */
export interface TranspileResult {
  /** Whether transpilation succeeded */
  success: boolean;
  /** Path to backup directory if created */
  backupLocation?: string;
  /** Path to GSD Open manifest file */
  manifestPath?: string;
  /** Errors encountered during transpilation */
  errors: string[];
  /** Non-critical warnings */
  warnings: string[];
  /** Gap tracking for unmapped/approximated content */
  gaps?: TransformGaps;
  /**
   * OpenCode configuration generated (for markdown export).
   * Populated by orchestrator when reporting needs full config access.
   */
  opencode?: OpenCodeConfig;
  /**
   * Transformed artifacts metadata for reporting.
   * Provides simple lists of artifact names for iteration in status sections.
   * Populated by orchestrator from the generated OpenCode config.
   */
  transformedArtifacts?: TransformedArtifactsMetadata;
}
