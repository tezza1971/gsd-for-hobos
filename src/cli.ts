#!/usr/bin/env node

/**
 * GSD Open CLI
 *
 * Main entry point that orchestrates the full installer flow:
 * 1. Detect GSD installation
 * 2. Detect/create OpenCode config directory
 * 3. Check for file changes (idempotency)
 * 4. Cache OpenCode documentation
 * 5. Scan GSD commands from skills/
 * 6. Transpile commands to OpenCode format
 * 7. Merge with existing commands
 * 8. Write updated commands.json
 * 9. Update import state
 */

import { detectGsd, detectOpenCode } from './lib/detector.js';
import { scanGsdCommands } from './lib/transpiler/scanner.js';
import { convertCommand } from './lib/transpiler/converter.js';
import {
  readCommands,
  mergeCommands,
  writeCommands,
  writeCommandFiles,
  createGsdoCommand,
} from './lib/installer/commands-manager.js';
import { ensureOpenCodeDocsCache } from './lib/cache/manager.js';
import {
  loadEnhancementContext,
  backupCommandsJson,
  writeEnhancedCommands,
} from './lib/enhancer/engine.js';
import { enhanceAllCommands } from './lib/enhancer/enhancer.js';
import {
  writeEnhancementLog,
  type EnhancementLogEntry,
  type CommandEnhancementLogEntry,
} from './lib/logger/gsdo-logger.js';
import { readImportState, writeImportState, buildCurrentState } from './lib/idempotency/state-manager.js';
import { checkFreshness } from './lib/idempotency/freshness-checker.js';
import { getDocsOpenCodeCachePath } from './lib/cache/paths.js';
import { writeInstallLog } from './lib/logger/install-logger.js';
import { rotateLogsIfNeeded } from './lib/logger/log-rotator.js';
import { LogEntry, LogLevel, CommandResult } from './lib/logger/types.js';
import { formatError, ErrorCategory } from './lib/ui/error-formatter.js';
import { ProgressReporter } from './lib/ui/progress-reporter.js';
import { renderSuccessScreen } from './lib/ui/success-screen.js';
import { VerbosityLevel, type SuccessScreenData } from './lib/ui/types.js';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  const startTime = Date.now();

  // Parse CLI flags
  const forceRefresh = process.argv.includes('--force');
  const quiet = process.argv.includes('--quiet');
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  const verbosity = quiet ? VerbosityLevel.QUIET :
                    verbose ? VerbosityLevel.VERBOSE :
                    VerbosityLevel.NORMAL;

  const progress = new ProgressReporter(verbosity);

  progress.startStep('Detecting GSD installation');
  const gsdResult = detectGsd();

  if (!gsdResult.found) {
    console.error('ERROR:', gsdResult.error);
    process.exit(1);
  }

  progress.log(`Found at ${gsdResult.path}`, 'success');
  progress.endStep();

  progress.startStep('Detecting OpenCode installation');
  const opencodeResult = detectOpenCode();

  if (!opencodeResult.found) {
    console.error('ERROR:', opencodeResult.error);
    process.exit(1);
  }

  progress.log(
    `${opencodeResult.created ? 'Created at' : 'Found at'} ${opencodeResult.path}`,
    'success'
  );
  progress.endStep();

  // Check if re-transpilation needed
  progress.startStep('Checking for changes');

  const previousState = readImportState();
  const currentState = buildCurrentState(gsdResult.path!);
  const freshness = checkFreshness(previousState, currentState);

  if (!forceRefresh && freshness.fresh) {
    progress.log('GSD files unchanged since last import', 'success');
    progress.log('Already up to date', 'success');
    progress.endStep();

    if (verbosity !== VerbosityLevel.QUIET) {
      console.log('');
      console.log('Tip: Run with --force to re-transpile anyway');
    }

    // Still check docs cache freshness independently
    const cacheResult = await ensureOpenCodeDocsCache();
    if (cacheResult.cached && !cacheResult.stale) {
      progress.log('Documentation cache fresh', 'success');
    } else if (cacheResult.stale) {
      progress.log('Documentation cache refreshed', 'warning');
    }

    process.exit(0); // Success - nothing to do
  }

  if (forceRefresh) {
    progress.log('Forcing re-transpilation (--force flag)', 'info');
  } else {
    progress.log(`Changes detected: ${freshness.reason}`, 'info');
  }
  progress.endStep();

  // Cache OpenCode documentation for future /gsdo use
  progress.startStep('Caching OpenCode documentation');
  const cacheResult = await ensureOpenCodeDocsCache();

  if (cacheResult.cached) {
    if (cacheResult.stale) {
      progress.log('Using stale cache (download failed)', 'warning');
    } else {
      progress.log('Documentation cached', 'success');
    }
  } else {
    const formatted = formatError(ErrorCategory.CACHE_FAILURE, {
      error: cacheResult.error
    });
    progress.log(`WARNING: ${formatted.message}`, 'warning');
    progress.log(formatted.resolution, 'info');
  }
  progress.endStep();

  progress.startStep('Scanning for /gsd:* commands');
  const gsdCommands = scanGsdCommands(gsdResult.path!);
  progress.log(`Found ${gsdCommands.length} commands`, 'success');
  progress.endStep();

  if (gsdCommands.length === 0) {
    if (verbosity !== VerbosityLevel.QUIET) {
      console.log('\n✓ No commands to transpile');
    }
    process.exit(0);
  }

  progress.startStep('Transpiling commands');

  // Show per-command progress
  const transpileResults = [];
  for (const gsdCommand of gsdCommands) {
    const result = convertCommand(gsdCommand);
    transpileResults.push(result);

    if (result.success && result.command) {
      progress.log(`${gsdCommand.name} → ${result.command.name}`, 'success');
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          progress.log(`  ${warning}`, 'warning');
        });
      }
    } else if (result.error) {
      progress.log(`${gsdCommand.name}: ${result.error}`, 'error');
    }
  }

  // Aggregate results
  const successful = transpileResults.filter(r => r.success && r.command).map(r => r.command!);
  const failed = transpileResults.filter(r => !r.success).map((r, idx) => ({
    name: gsdCommands[idx].name,
    error: r.error || 'Unknown error'
  }));
  const warnings = transpileResults
    .filter(r => r.success && r.warnings)
    .flatMap((r, idx) =>
      r.warnings!.map(warning => ({ name: gsdCommands[idx].name, warning }))
    );

  const transpileResult = { successful, failed, warnings };

  progress.log(`${transpileResult.successful.length} successful`, 'success');

  if (transpileResult.failed.length > 0) {
    progress.log(`${transpileResult.failed.length} failed:`, 'error');
    transpileResult.failed.slice(0, 5).forEach((failure) => {
      progress.log(`  ${failure.name}: ${failure.error}`, 'error');
    });
    if (transpileResult.failed.length > 5) {
      progress.log(`  ... and ${transpileResult.failed.length - 5} more`, 'error');
    }
  }

  if (transpileResult.warnings.length > 0) {
    progress.log(`${transpileResult.warnings.length} warnings (see above for details)`, 'warning');
  }

  progress.endStep();

  // Rotate install log if needed (daily rotation)
  await rotateLogsIfNeeded('install.log').catch(err =>
    console.warn('Log rotation failed:', err)
  );

  // Write install log entry
  try {
    const commandResults: CommandResult[] = transpileResults.map((result, idx) => {
      const cmdResult: CommandResult = {
        name: result.command?.name || gsdCommands[idx].name,
        status: result.success ? 'success' : 'failure'
      };

      if (result.warnings && result.warnings.length > 0) {
        cmdResult.warnings = result.warnings;
      }

      if (result.error) {
        cmdResult.error = result.error;
      }

      return cmdResult;
    });

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: transpileResult.failed.length > 0 ? LogLevel.ERROR :
             transpileResult.warnings.length > 0 ? LogLevel.WARN : LogLevel.INFO,
      summary: `Transpiled ${transpileResult.successful.length} commands from GSD`,
      commands: commandResults,
      metadata: {
        successful: transpileResult.successful.length,
        warnings: transpileResult.warnings.length,
        errors: transpileResult.failed.length
      }
    };

    await writeInstallLog(logEntry);
  } catch (logError) {
    // Non-blocking: log write failures shouldn't crash installer
    const formatted = formatError(ErrorCategory.LOG_WRITE_FAILURE, {
      error: logError instanceof Error ? logError.message : String(logError)
    });
    console.warn(`WARNING: ${formatted.message}`);
    console.warn(formatted.resolution);
  }

  progress.startStep('Writing to OpenCode');
  const existingCommands = readCommands(opencodeResult.path!);

  // Add /gsdo command to the transpiled commands
  const gsdoCommand = createGsdoCommand();
  const allNewCommands = [...transpileResult.successful, gsdoCommand];

  const mergedCommands = mergeCommands(
    existingCommands,
    allNewCommands
  );
  writeCommands(opencodeResult.path!, mergedCommands);
  writeCommandFiles(opencodeResult.path!, mergedCommands);
  progress.log(`${opencodeResult.path}/commands.json updated`, 'success');
  progress.log(`${opencodeResult.path}/command/*.md files created`, 'success');
  progress.endStep();

  // Auto-enhance commands after installation
  progress.startStep('Enhancing commands with /gsdo');

  try {
    // Load enhancement context
    const enhancementContext = await loadEnhancementContext();

    // Create backup before enhancement
    const backupFilename = await backupCommandsJson(opencodeResult.path!);
    if (backupFilename) {
      progress.log(`Backup created: ${backupFilename}`, 'success');
    }

    // Enhance all commands
    const enhancementResults = await enhanceAllCommands(
      enhancementContext,
      opencodeResult.path!
    );

    // Display per-command results
    let enhancedCount = 0;
    let failedCount = 0;
    let unchangedCount = 0;

    for (const result of enhancementResults) {
      if (result.error) {
        progress.log(`${result.commandName}: ${result.error}`, 'warning');
        failedCount++;
      } else if (result.enhanced && result.changes.length > 0) {
        progress.log(`${result.commandName}: ${result.changes.join(', ')}`, 'success');
        enhancedCount++;
      } else {
        unchangedCount++;
      }
    }

    // Write enhanced commands back
    writeEnhancedCommands(opencodeResult.path!, enhancementContext.commands);

    // Rotate enhancement log if needed (daily rotation)
    await rotateLogsIfNeeded('gsdo.log').catch(err =>
      console.warn('Log rotation failed:', err)
    );

    // Write enhancement log
    const enhancementLogEntry: EnhancementLogEntry = {
      timestamp: new Date().toISOString(),
      summary: `Enhanced ${enhancedCount} of ${enhancementResults.length} commands`,
      results: enhancementResults.map(
        (r): CommandEnhancementLogEntry => ({
          commandName: r.commandName,
          enhanced: r.enhanced,
          changes: r.changes,
          reasoning: r.reasoning,
          before: r.before,
          after: r.after,
          error: r.error,
        })
      ),
      metadata: {
        enhanced: enhancedCount,
        unchanged: unchangedCount,
        failed: failedCount,
      },
    };

    // Non-blocking log write
    writeEnhancementLog(enhancementLogEntry).catch((err) =>
      console.warn('Failed to write enhancement log:', err)
    );

    progress.log(`${enhancedCount} commands enhanced, ${failedCount} failed`, 'success');
  } catch (error) {
    // Non-blocking: enhancement failure doesn't prevent installation success
    const formatted = formatError(ErrorCategory.ENHANCEMENT_FAILURE, {
      error: error instanceof Error ? error.message : String(error)
    });
    progress.log(`WARNING: ${formatted.message}`, 'warning');
    progress.log(formatted.resolution, 'info');
  }

  progress.endStep();

  // Update import state for next run
  const finalState = buildCurrentState(gsdResult.path!);

  // Update docs cache timestamp from cache manager
  const cacheDir = getDocsOpenCodeCachePath();
  const metadataPath = join(cacheDir, 'metadata.json');
  if (existsSync(metadataPath)) {
    const metadataContent = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    finalState.docsCachedAt = metadata.downloadedAt;
  }

  writeImportState(finalState);

  // Render success screen
  const successData: SuccessScreenData = {
    commandsInstalled: transpileResult.successful.length + 1, // +1 for /gsdo
    gsdPath: gsdResult.path!,
    opencodePath: opencodeResult.path!,
    cacheStatus: cacheResult.cached ? (cacheResult.stale ? 'stale' : 'fresh') : 'unavailable',
    partialSuccess: transpileResult.failed.length > 0 || transpileResult.warnings.length > 0,
    failedCount: transpileResult.failed.length,
    warningCount: transpileResult.warnings.length
  };

  console.log(''); // Blank line before success screen

  /**
   * Performance requirement (PERF-01): Installation must complete in <10 seconds
   * for typical GSD setup (20-30 commands).
   *
   * Typical breakdown:
   * - Detection: <0.1s
   * - Cache check: <0.5s (if fresh) or <3s (if downloading)
   * - Scanning: <0.5s
   * - Transpilation: <2s (30 commands @ ~0.06s each)
   * - Enhancement: <4s (30 commands @ ~0.13s each)
   * - Writing: <0.1s
   *
   * Total: ~6-7s typical, <10s target includes buffer for slower systems
   */
  const totalTime = (Date.now() - startTime) / 1000;

  if (verbosity >= VerbosityLevel.VERBOSE) {
    progress.log(`Total installation time: ${totalTime.toFixed(1)}s`, 'info');
  }

  // Performance validation (PERF-01 requirement)
  if (totalTime > 10) {
    progress.log(`WARNING: Installation took ${totalTime.toFixed(1)}s (target: <10s)`, 'warning');
  }
  
  // Exit code strategy:
  // 0: Full success (all commands transpiled)
  // 1: Total failure (detection failed, critical error)
  // 2: Partial success (some commands failed, some succeeded)
  if (transpileResult.failed.length > 0) {
    renderSuccessScreen(successData);
    process.exit(2); // Partial success for scripting
  }
  
  renderSuccessScreen(successData);
}

// Run main and handle errors
main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
