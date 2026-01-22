/**
 * GSD-to-OpenCode Command Converter
 *
 * Algorithmic conversion (no LLM) that transforms GSD commands to OpenCode format.
 * Phase 1: Basic name transformation and field mapping.
 */

import type {
  GsdCommand,
  OpenCodeCommand,
  TranspileResult,
  TranspileBatchResult,
} from './types.js';

/**
 * Converts a single GSD command to OpenCode format
 *
 * Name conversion: /gsd:plan-phase -> gsd-plan-phase
 * - Remove leading slash
 * - Replace colon with dash
 *
 * @param gsd - GSD command to convert
 * @returns Transpilation result with success/error status
 */
export function convertCommand(gsd: GsdCommand): TranspileResult {
  try {
    // Convert name: remove leading '/', replace ':' with '-'
    // Example: /gsd:plan-phase -> gsd-plan-phase
    const name = gsd.name.replace(/^\//, '').replace(/:/, '-');

    // Use description from GSD or generate default
    const description =
      gsd.description || `Transpiled from GSD: ${gsd.name}`;

    // Phase 1: Use raw markdown content as promptTemplate
    // Future phases will extract and transform the template
    const promptTemplate = gsd.rawContent;

    const warnings: string[] = [];

    // Add warning if description was generated (not extracted from markdown)
    if (!gsd.description) {
      warnings.push('No description found in markdown, using generated default');
    }

    const command: OpenCodeCommand = {
      name,
      description,
      promptTemplate,
    };

    return {
      success: true,
      command,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error during conversion',
    };
  }
}

/**
 * Converts multiple GSD commands in batch
 *
 * Processes all commands and separates successful/failed conversions.
 * Collects warnings from all operations.
 *
 * @param commands - Array of GSD commands to convert
 * @returns Batch result with successful/failed/warnings arrays
 */
export function convertBatch(commands: GsdCommand[]): TranspileBatchResult {
  const successful: OpenCodeCommand[] = [];
  const failed: Array<{ name: string; error: string }> = [];
  const warnings: Array<{ name: string; warning: string }> = [];

  for (const command of commands) {
    const result = convertCommand(command);

    if (result.success && result.command) {
      successful.push(result.command);

      // Collect warnings for this command
      if (result.warnings) {
        for (const warning of result.warnings) {
          warnings.push({ name: command.name, warning });
        }
      }
    } else if (result.error) {
      failed.push({ name: command.name, error: result.error });
    }
  }

  return {
    successful,
    failed,
    warnings,
  };
}
