/**
 * Transpile command that orchestrates GSD to OpenCode transformation.
 *
 * Flow:
 * 1. Detect GSD installation
 * 2. Run transpilation pipeline
 * 3. Report results with backup location and gaps
 * 4. Set appropriate exit code
 */

import { isCancel, confirm } from '@clack/prompts';
import pc from 'picocolors';
import type { CLIOptions, TranspileOptions, TranspileResult } from '../types/index.js';
import { detectGSD } from '../lib/detection/gsd-detector.js';
import { runTranspilation } from '../lib/transpilation/orchestrator.js';
import { ExitCode } from '../lib/exit-codes.js';
import { log } from '../lib/logger.js';

/**
 * Extended options for transpile command.
 */
export interface TranspileCommandOptions extends CLIOptions {
  /** Force re-transpilation even if source unchanged */
  force?: boolean;
  /** Skip backup of existing configs */
  noBackup?: boolean;
}

/**
 * Transpile command that converts GSD context to OpenCode configuration.
 *
 * @param options - CLI options
 */
export async function transpileCommand(options: TranspileCommandOptions): Promise<void> {
  log.verbose('Starting transpilation...');

  // Step 1: Detect GSD installation
  const gsdResult = detectGSD();

  if (!gsdResult.found || !gsdResult.path) {
    log.error('GSD installation not found.');
    log.info('Run detection first: gfh --detect');
    process.exitCode = ExitCode.ERROR;
    return;
  }

  if (!gsdResult.valid) {
    log.error('GSD installation is invalid.');
    if (gsdResult.missingFiles && gsdResult.missingFiles.length > 0) {
      log.error(`Missing files: ${gsdResult.missingFiles.join(', ')}`);
    }
    if (gsdResult.missingDirs && gsdResult.missingDirs.length > 0) {
      log.error(`Missing directories: ${gsdResult.missingDirs.join(', ')}`);
    }
    process.exitCode = ExitCode.ERROR;
    return;
  }

  log.verbose(`GSD found at: ${gsdResult.path}`);

  // Warn about stale GSD
  if (gsdResult.fresh === false && !options.quiet) {
    log.warn(`GSD installation is ${gsdResult.daysOld} days old. Consider updating.`);
  }

  // Warn about --no-backup
  if (options.noBackup && !options.quiet && !options.dryRun) {
    const shouldContinue = await confirm({
      message: pc.yellow('--no-backup is set. Existing configs will be overwritten without backup. Continue?'),
      initialValue: false,
    });

    if (isCancel(shouldContinue) || !shouldContinue) {
      log.info('Transpilation cancelled.');
      process.exitCode = ExitCode.SUCCESS;
      return;
    }
  }

  // Build transpilation options
  const transpileOptions: TranspileOptions = {
    gsdPath: gsdResult.path,
    dryRun: options.dryRun ?? false,
    force: options.force ?? false,
    noBackup: options.noBackup ?? false,
  };

  // Step 2: Run transpilation
  let result: TranspileResult;
  try {
    result = await runTranspilation(transpileOptions);
  } catch (error) {
    log.error(`Transpilation failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      log.verbose(error.stack);
    }
    process.exitCode = ExitCode.ERROR;
    return;
  }

  // Step 3: Report results
  if (result.success) {
    if (options.dryRun) {
      log.success('Dry run complete. No files were written.');
    } else {
      log.success('Transpilation complete!');

      if (result.backupLocation) {
        log.info(`Backup: ${result.backupLocation}`);
      }

      if (result.manifestPath) {
        log.info(`Manifest: ${result.manifestPath}`);
      }
    }

    // Report warnings
    if (result.warnings.length > 0) {
      log.warn('Warnings:');
      for (const warning of result.warnings) {
        log.warn(`  - ${warning}`);
      }
    }

    // Report gaps
    if (result.gaps) {
      const totalGaps = result.gaps.unmappedFields.length + result.gaps.approximations.length;
      if (totalGaps > 0) {
        log.info('');
        log.info(pc.yellow(`${totalGaps} GSD features could not be directly mapped:`));

        for (const field of result.gaps.unmappedFields) {
          log.info(pc.dim(`  - Unmapped: ${field}`));
        }

        for (const approx of result.gaps.approximations) {
          log.info(pc.dim(`  - Approximated: ${approx.original} → ${approx.approximatedAs}`));
        }

        log.info(pc.dim('See manifest for full details.'));
      }
    }

    // Set exit code
    if (result.warnings.length > 0) {
      process.exitCode = ExitCode.WARNING;
    } else {
      process.exitCode = ExitCode.SUCCESS;
    }
  } else {
    log.error('Transpilation failed!');

    for (const error of result.errors) {
      log.error(`  - ${error}`);
    }

    if (result.backupLocation) {
      log.info(`Original configs restored from backup: ${result.backupLocation}`);
    }

    process.exitCode = ExitCode.ERROR;
  }
}
