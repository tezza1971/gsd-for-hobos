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
  createGsdoCommand,
} from './lib/installer/commands-manager.js';
import { ensureOpenCodeDocsCache } from './lib/cache/manager.js';
import {
  loadEnhancementContext,
  backupCommandsJson,
  writeEnhancedCommands,
} from './lib/enhancer/engine.js';
import { enhanceAllCommands } from './lib/enhancer/enhancer.js';
import { readImportState, writeImportState, buildCurrentState } from './lib/idempotency/state-manager.js';
import { checkFreshness } from './lib/idempotency/freshness-checker.js';
import { getDocsOpenCodeCachePath } from './lib/cache/paths.js';
import { writeInstallLog } from './lib/logger/install-logger.js';
import { LogEntry, LogLevel, CommandResult } from './lib/logger/types.js';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  // Parse --force flag
  const forceRefresh = process.argv.includes('--force');

  console.log('→ Detecting GSD installation...');
  const gsdResult = detectGsd();

  if (!gsdResult.found) {
    console.error('✗', gsdResult.error);
    process.exit(1);
  }

  console.log('  ✓ Found at', gsdResult.path);

  console.log('→ Detecting OpenCode installation...');
  const opencodeResult = detectOpenCode();

  if (!opencodeResult.found) {
    console.error('✗', opencodeResult.error);
    process.exit(1);
  }

  console.log(
    '  ✓',
    opencodeResult.created ? 'Created at' : 'Found at',
    opencodeResult.path
  );

  // Check if re-transpilation needed
  console.log('→ Checking for changes...');

  const previousState = readImportState();
  const currentState = buildCurrentState(gsdResult.path!);
  const freshness = checkFreshness(previousState, currentState);

  if (!forceRefresh && freshness.fresh) {
    console.log('  ✓ GSD files unchanged since last import');
    console.log('  ✓ Already up to date');
    console.log('');
    console.log('Tip: Run with --force to re-transpile anyway');

    // Still check docs cache freshness independently
    const cacheResult = await ensureOpenCodeDocsCache();
    if (cacheResult.cached && !cacheResult.stale) {
      console.log('  ✓ Documentation cache fresh');
    } else if (cacheResult.stale) {
      console.log('  ⚠ Documentation cache refreshed');
    }

    process.exit(0); // Success - nothing to do
  }

  if (forceRefresh) {
    console.log('  → Forcing re-transpilation (--force flag)');
  } else {
    console.log(`  → Changes detected: ${freshness.reason}`);
  }

  // Cache OpenCode documentation for future /gsdo use
  console.log('→ Caching OpenCode documentation...');
  const cacheResult = await ensureOpenCodeDocsCache();

  if (cacheResult.cached) {
    if (cacheResult.stale) {
      console.log('  ⚠ Using stale cache (download failed)');
    } else {
      console.log('  ✓ Documentation cached');
    }
  } else {
    console.log('  ⚠ Cache unavailable:', cacheResult.error);
    console.log('  → Continuing without cached docs');
  }

  console.log('→ Scanning for /gsd:* commands...');
  const gsdCommands = scanGsdCommands(gsdResult.path!);
  console.log(`  ✓ Found ${gsdCommands.length} commands`);

  if (gsdCommands.length === 0) {
    console.log('\n✓ No commands to transpile');
    process.exit(0);
  }

  console.log('→ Transpiling commands...');

  // Show per-command progress
  const transpileResults = [];
  for (const gsdCommand of gsdCommands) {
    const result = convertCommand(gsdCommand);
    transpileResults.push(result);

    if (result.success && result.command) {
      console.log(`  ✓ ${gsdCommand.name} → ${result.command.name}`);
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          console.log(`    ⚠ ${warning}`);
        });
      }
    } else if (result.error) {
      console.log(`  ✗ ${gsdCommand.name}: ${result.error}`);
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

  console.log(`  ✓ ${transpileResult.successful.length} successful`);

  if (transpileResult.failed.length > 0) {
    console.log(`  ✗ ${transpileResult.failed.length} failed:`);
    transpileResult.failed.slice(0, 5).forEach((failure) => {
      console.log(`    - ${failure.name}: ${failure.error}`);
    });
    if (transpileResult.failed.length > 5) {
      console.log(`    ... and ${transpileResult.failed.length - 5} more`);
    }
  }

  if (transpileResult.warnings.length > 0) {
    console.log(`  ⚠ ${transpileResult.warnings.length} warnings (see above for details)`);
  }

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
    console.warn('Failed to write install log:', logError instanceof Error ? logError.message : String(logError));
  }

  console.log('→ Writing to OpenCode...');
  const existingCommands = readCommands(opencodeResult.path!);

  // Add /gsdo command to the transpiled commands
  const gsdoCommand = createGsdoCommand();
  const allNewCommands = [...transpileResult.successful, gsdoCommand];

  const mergedCommands = mergeCommands(
    existingCommands,
    allNewCommands
  );
  writeCommands(opencodeResult.path!, mergedCommands);
  console.log(`  ✓ ${opencodeResult.path}/commands.json updated`);

  // Auto-enhance commands after installation
  console.log('→ Enhancing commands with /gsdo...');

  try {
    // Load enhancement context
    const enhancementContext = await loadEnhancementContext();

    // Create backup before enhancement
    const backupFilename = await backupCommandsJson(opencodeResult.path!);
    if (backupFilename) {
      console.log(`  ✓ Backup created: ${backupFilename}`);
    }

    // Enhance all commands
    const enhancementResults = await enhanceAllCommands(
      enhancementContext,
      opencodeResult.path!
    );

    // Display per-command results
    let enhancedCount = 0;
    let failedCount = 0;

    for (const result of enhancementResults) {
      if (result.error) {
        console.log(`  ⚠ ${result.commandName}: ${result.error}`);
        failedCount++;
      } else if (result.enhanced && result.changes.length > 0) {
        console.log(`  ✓ ${result.commandName}: ${result.changes.join(', ')}`);
        enhancedCount++;
      }
    }

    // Write enhanced commands back
    writeEnhancedCommands(opencodeResult.path!, enhancementContext.commands);

    console.log(`  ✓ ${enhancedCount} commands enhanced, ${failedCount} failed`);
  } catch (error) {
    // Non-blocking: enhancement failure doesn't prevent installation success
    console.log('  ⚠ Enhancement unavailable:', error instanceof Error ? error.message : String(error));
    console.log('  → Commands installed but not enhanced');
  }

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

  console.log('\n✓ Installation complete');
  console.log(
    `  ${transpileResult.successful.length + 1} GSD commands available in OpenCode`
  );
  console.log('  Run /gsdo in OpenCode to re-enhance commands anytime');
}

// Run main and handle errors
main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
