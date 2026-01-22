/**
 * Transpile command that orchestrates GSD to OpenCode transformation.
 *
 * Flow:
 * 1. Detect GSD installation
 * 2. Run transpilation pipeline
 * 3. Report results using reporter module
 * 4. Set appropriate exit code
 * 5. Optionally save markdown report
 */

import { isCancel, confirm } from '@clack/prompts';
import pc from 'picocolors';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CLIOptions, TranspileOptions, TranspileResult } from '../types/index.js';
import { detectGSD } from '../lib/detection/gsd-detector.js';
import { runTranspilation } from '../lib/transpilation/orchestrator.js';
import { generateReport } from '../lib/transpilation/reporter.js';
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

  // Step 3: Generate formatted report
  const report = generateReport(result, {
    dryRun: options.dryRun,
    quietMode: options.quiet,
  });

  // Display console output
  if (!options.quiet) {
    console.log(report.console);
  } else if (!result.success) {
    // Always show errors even in quiet mode
    console.log(report.console);
  }

  // Set exit code based on summary
  if (report.summary.failed > 0 || !result.success) {
    process.exitCode = ExitCode.ERROR;
  } else if (report.summary.partial > 0 || result.warnings.length > 0) {
    process.exitCode = ExitCode.WARNING;
  } else {
    process.exitCode = ExitCode.SUCCESS;
  }
}
