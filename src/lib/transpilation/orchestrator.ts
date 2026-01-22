/**
 * Transpilation Orchestrator
 *
 * Coordinates the full transpilation pipeline: parse → transform → emit → write.
 * Handles backup/rollback, idempotency checking, and atomic file operations.
 */

import { writeFile, mkdir, access, constants } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { log } from '../logger.js';
import { parseGSDFiles } from './parser.js';
import { transformToOpenCode } from './transformer.js';
import { emitOpenCodeConfig } from './emitter.js';
import { BackupManager } from './backup-manager.js';
import { checkIdempotency, writeManifest, hashDirectory } from './idempotency.js';
import type {
  TranspileOptions,
  TranspileResult,
  GSDOManifest,
  TransformGaps,
  TransformedArtifactsMetadata,
} from '../../types/index.js';

/**
 * Standard OpenCode configuration directories to check.
 */
const OPENCODE_CONFIG_DIRS = [
  // Project-local (highest priority)
  '.opencode',
  // Linux/Mac standard
  join(homedir(), '.config', 'opencode'),
  // Windows standard
  process.env.APPDATA ? join(process.env.APPDATA, 'opencode') : '',
].filter(Boolean);

/**
 * Detect OpenCode configuration directory.
 * Checks standard locations in order of priority.
 *
 * @returns Detected config directory path, or null if none found
 */
async function detectOpenCodeConfigDir(): Promise<string | null> {
  for (const dir of OPENCODE_CONFIG_DIRS) {
    try {
      await access(dir, constants.R_OK | constants.W_OK);
      log.verbose(`Found OpenCode config directory: ${dir}`);
      return dir;
    } catch {
      // Directory doesn't exist or isn't accessible
    }
  }

  // Default to project-local .opencode (will be created)
  log.verbose('No existing OpenCode config found, will create .opencode/');
  return '.opencode';
}

/**
 * Run the full transpilation pipeline.
 *
 * @param options - Transpilation options
 * @returns Transpilation result with status, backup location, and any errors
 */
export async function runTranspilation(options: TranspileOptions): Promise<TranspileResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let backupLocation: string | undefined;
  let manifestPath: string | undefined;
  let gaps: TransformGaps | undefined;

  // Determine OpenCode config directory
  const opencodeConfigDir = options.opencodeConfigDir ?? (await detectOpenCodeConfigDir());
  if (!opencodeConfigDir) {
    return {
      success: false,
      errors: ['Could not determine OpenCode configuration directory'],
      warnings: [],
    };
  }

  manifestPath = join(opencodeConfigDir, '.gsdo-manifest.json');

  // Step 1: Check idempotency (unless --force)
  if (!options.force) {
    const idempotencyCheck = await checkIdempotency(options.gsdPath, manifestPath);
    if (!idempotencyCheck.shouldRegenerate) {
      log.info(idempotencyCheck.reason ?? 'Source unchanged, skipping transpilation');
      return {
        success: true,
        manifestPath,
        errors: [],
        warnings: ['Transpilation skipped (source unchanged). Use --force to override.'],
      };
    }
    log.verbose(idempotencyCheck.reason ?? 'Regeneration needed');
  }

  // Step 2: Parse GSD files
  log.info('Parsing GSD files...');
  const parseResult = await parseGSDFiles(options.gsdPath);

  if (!parseResult.success || !parseResult.ir) {
    return {
      success: false,
      errors: parseResult.errors.map((e) => `${e.file}:${e.line ?? '?'}: ${e.message}`),
      warnings: parseResult.warnings,
    };
  }

  if (parseResult.warnings.length > 0) {
    warnings.push(...parseResult.warnings);
  }

  log.verbose(`Parsed ${parseResult.ir.agents.length} agents, ${parseResult.ir.commands.length} commands, ${parseResult.ir.models.length} models`);

  // Step 3: Transform to OpenCode
  log.info('Transforming to OpenCode format...');
  const transformResult = await transformToOpenCode(parseResult.ir);

  if (!transformResult.success || !transformResult.opencode) {
    return {
      success: false,
      errors: transformResult.errors.map((e) => e.message),
      warnings: transformResult.warnings,
    };
  }

  if (transformResult.warnings.length > 0) {
    warnings.push(...transformResult.warnings);
  }

  gaps = transformResult.gaps;

  // Step 4: Emit OpenCode JSON
  log.info('Generating OpenCode configuration files...');
  const emitResult = emitOpenCodeConfig(transformResult.opencode);

  if (!emitResult.success) {
    return {
      success: false,
      errors: emitResult.errors.map((e) => e.message),
      warnings,
    };
  }

  const filesToWrite = Object.keys(emitResult.files);
  log.verbose(`Will write ${filesToWrite.length} files: ${filesToWrite.join(', ')}`);

  // Dry-run mode: validate and report, don't write
  if (options.dryRun) {
    log.info('[DRY RUN] Validation complete. Would write:');
    for (const [filename, content] of Object.entries(emitResult.files)) {
      log.info(`  - ${join(opencodeConfigDir, filename)} (${content.length} bytes)`);
    }

    if (gaps && (gaps.unmappedFields.length > 0 || gaps.approximations.length > 0)) {
      log.warn('[DRY RUN] Gap report:');
      for (const gap of gaps.unmappedFields) {
        log.warn(`  - Unmapped: ${gap.field} (${gap.category})`);
        log.warn(`    Suggestion: ${gap.suggestion}`);
      }
      for (const approx of gaps.approximations) {
        log.warn(`  - Approximated: ${approx.original} -> ${approx.approximatedAs} (${approx.category})`);
      }
    }

    return {
      success: true,
      manifestPath,
      errors: [],
      warnings: [...warnings, 'Dry run - no files written'],
      gaps,
    };
  }

  // Step 5: Create backup (unless --no-backup)
  const backupManager = new BackupManager(opencodeConfigDir);

  if (!options.noBackup) {
    try {
      backupLocation = await backupManager.backup(filesToWrite, options.gsdPath);
    } catch (error) {
      log.warn(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
      warnings.push('Backup failed, proceeding without backup');
    }
  } else {
    log.warn('Backup skipped (--no-backup flag)');
  }

  // Step 6: Write files atomically
  log.info('Writing OpenCode configuration files...');
  const writtenFiles: string[] = [];

  try {
    // Ensure config directory exists
    await mkdir(opencodeConfigDir, { recursive: true });

    // Write all files
    for (const [filename, content] of Object.entries(emitResult.files)) {
      const filePath = join(opencodeConfigDir, filename);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf-8');
      writtenFiles.push(filename);
      log.verbose(`Wrote: ${filePath}`);
    }
  } catch (error) {
    // Rollback on error
    log.error(`Write failed: ${error instanceof Error ? error.message : String(error)}`);

    // Clean up partial writes
    await backupManager.cleanupWrittenFiles(writtenFiles);

    // Restore from backup if available
    if (backupLocation) {
      try {
        await backupManager.restore(backupLocation);
        log.info('Rolled back to previous state');
      } catch (restoreError) {
        errors.push(`Rollback failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`);
      }
    }

    return {
      success: false,
      backupLocation,
      errors: [`Transpilation failed during write: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
    };
  }

  // Step 7: Write manifest
  try {
    const sourceHash = await hashDirectory(options.gsdPath);
    const outputHash = await hashDirectory(opencodeConfigDir);

    const manifest: GFHManifest = {
      version: '1.0',
      lastRun: {
        timestamp: new Date().toISOString(),
        sourceHash,
        outputHash,
        backup: backupLocation
          ? {
              location: backupLocation,
              timestamp: new Date().toISOString(),
            }
          : undefined,
      },
      mappings: filesToWrite.map((filename) => ({
        source: options.gsdPath,
        target: join(opencodeConfigDir, filename),
        transformed: true,
      })),
    };

    await writeManifest(manifest, manifestPath);
  } catch (error) {
    warnings.push(`Failed to write manifest: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Report gaps
  if (gaps && (gaps.unmappedFields.length > 0 || gaps.approximations.length > 0)) {
    log.warn('Some GSD features could not be directly mapped:');
    for (const gap of gaps.unmappedFields) {
      log.warn(`  - Unmapped: ${gap.field} (${gap.category})`);
      log.warn(`    Suggestion: ${gap.suggestion}`);
    }
    for (const approx of gaps.approximations) {
      log.warn(`  - Approximated: ${approx.original} -> ${approx.approximatedAs} (${approx.category})`);
    }
  }

  log.success(`Transpilation complete! ${writtenFiles.length} files written to ${opencodeConfigDir}`);
  if (backupLocation) {
    log.info(`Backup location: ${backupLocation}`);
  }

  return {
    success: true,
    backupLocation,
    manifestPath,
    errors,
    warnings,
    gaps,
    opencode: transformResult.opencode,
    transformedArtifacts: {
      commands: (transformResult.opencode.commands ?? []).map(c => c.name),
      agents: (transformResult.opencode.agents ?? []).map(a => a.name),
      models: (transformResult.opencode.models ?? []).map(m => m.modelId),
    },
  };
}
