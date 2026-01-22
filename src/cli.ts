#!/usr/bin/env node

/**
 * GSD Open CLI
 *
 * Main entry point that orchestrates the full installer flow:
 * 1. Detect GSD installation
 * 2. Detect/create OpenCode config directory
 * 3. Cache OpenCode documentation
 * 4. Scan GSD commands from skills/
 * 5. Transpile commands to OpenCode format
 * 6. Merge with existing commands
 * 7. Write updated commands.json
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

async function main() {
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
