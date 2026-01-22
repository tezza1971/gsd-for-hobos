#!/usr/bin/env node

import { program } from 'commander';
import { setLogLevel, log } from './lib/logger.js';
import { ExitCode } from './lib/exit-codes.js';
import { showManifesto } from './lib/manifesto.js';
import { detectCommand } from './commands/detect.js';
import { transpileCommand } from './commands/transpile.js';

program
  .name('gfh')
  .description('GSD-for-Hobos: Transpile Claude Code configs to OpenCode')
  .version('0.1.0')
  .option('-v, --verbose', 'enable verbose output')
  .option('-q, --quiet', 'suppress all output except errors')
  .option('--dry-run', 'preview changes without writing files')
  .option('--detect', 'run detection only (skip transpilation)')
  .action(async (options) => {
    try {
      setLogLevel(options.verbose, options.quiet);

      const accepted = await showManifesto();

      if (!accepted) {
        process.exitCode = ExitCode.SUCCESS;
        return;
      }

      if (options.verbose) {
        log.verbose('Verbose mode enabled');
      }

      // Run detection
      await detectCommand({
        verbose: options.verbose ?? false,
        quiet: options.quiet ?? false,
        dryRun: options.dryRun ?? false,
      });

      // In --detect mode, stop after detection
      if (options.detect) {
        return;
      }

      // Run transpilation
      await transpileCommand({
        verbose: options.verbose ?? false,
        quiet: options.quiet ?? false,
        dryRun: options.dryRun ?? false,
      });
    } catch (error: unknown) {
      log.error(error instanceof Error ? error.message : String(error));
      process.exitCode = ExitCode.ERROR;
    }
  });

// Transpile subcommand for direct access
program
  .command('transpile')
  .description('Transpile GSD context to OpenCode configuration')
  .option('--force', 'Force re-transpilation even if source unchanged')
  .option('--no-backup', 'Skip backup of existing configs (dangerous)')
  .action(async (cmdOptions) => {
    try {
      // Get global options from parent
      const globalOptions = program.opts();
      setLogLevel(globalOptions.verbose, globalOptions.quiet);

      const accepted = await showManifesto();

      if (!accepted) {
        process.exitCode = ExitCode.SUCCESS;
        return;
      }

      await transpileCommand({
        verbose: globalOptions.verbose ?? false,
        quiet: globalOptions.quiet ?? false,
        dryRun: globalOptions.dryRun ?? false,
        force: cmdOptions.force ?? false,
        noBackup: cmdOptions.noBackup ?? false,
      });
    } catch (error: unknown) {
      log.error(error instanceof Error ? error.message : String(error));
      process.exitCode = ExitCode.ERROR;
    }
  });

program.parse();