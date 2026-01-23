#!/usr/bin/env node

/**
 * GSD Open Enhancement CLI (/gsdo command)
 *
 * Standalone CLI for re-enhancing GSD commands after installation.
 * Runs the full enhancement flow autonomously:
 * 1. Load enhancement context (install.log, docs, commands.json, GSD source)
 * 2. Create backup of commands.json
 * 3. Enhance all gsd-* commands using LLM
 * 4. Write enhanced commands back
 * 5. Display detailed per-command results
 *
 * Usage: npx gsdo (run in OpenCode directory)
 */

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

async function main() {
  console.log('→ Loading context...');

  let context;
  try {
    context = await loadEnhancementContext();
  } catch (error) {
    console.error('✗ Failed to load enhancement context:', error instanceof Error ? error.message : String(error));
    console.error('  Make sure you have run npx gsd-open first to install commands');
    process.exit(1);
  }

  // Filter to gsd-* commands only
  const gsdCommands = context.commands.filter(cmd => cmd.name.startsWith('gsd-'));

  if (gsdCommands.length === 0) {
    console.log('  ⚠ No GSD commands found to enhance');
    console.log('  Run npx gsd-open first to install commands');
    process.exit(0);
  }

  console.log(`  ✓ Found ${gsdCommands.length} GSD commands to enhance`);

  console.log('→ Creating backup...');
  try {
    const backupFilename = await backupCommandsJson(context.opencodeConfigPath);
    if (backupFilename) {
      console.log(`  ✓ Backup created: ${backupFilename}`);
    } else {
      console.log('  ⚠ No existing commands.json to backup');
    }
  } catch (error) {
    console.error('✗ Failed to create backup:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log(`→ Enhancing ${gsdCommands.length} commands...`);

  let results;
  try {
    results = await enhanceAllCommands(context, context.opencodeConfigPath);
  } catch (error) {
    console.error('✗ Enhancement failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Display per-command results
  let enhancedCount = 0;
  let failedCount = 0;
  let unchangedCount = 0;

  for (const result of results) {
    if (result.error) {
      console.log(`  ✗ ${result.commandName}: ${result.error}`);
      failedCount++;
    } else if (result.enhanced && result.changes.length > 0) {
      console.log(`  ✓ ${result.commandName}: ${result.changes.join(', ')}`);
      enhancedCount++;
    } else {
      unchangedCount++;
    }
  }

  console.log('→ Writing enhanced commands...');
  try {
    writeEnhancedCommands(context.opencodeConfigPath, context.commands);
    console.log('  ✓ Commands updated');
  } catch (error) {
    console.error('✗ Failed to write commands:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Write enhancement log
  const logEntry: EnhancementLogEntry = {
    timestamp: new Date().toISOString(),
    summary: `Enhanced ${enhancedCount} of ${results.length} commands`,
    results: results.map(
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
  writeEnhancementLog(logEntry).catch((err) =>
    console.warn('Failed to write enhancement log:', err)
  );

  // Summary
  console.log(`\n✓ Enhancement complete`);
  console.log(`  ${enhancedCount} enhanced, ${failedCount} failed, ${unchangedCount} unchanged`);

  process.exit(0);
}

// Run main and handle errors
main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
