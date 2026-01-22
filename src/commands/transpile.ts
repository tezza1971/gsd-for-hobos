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
import { generateMarkdown } from '../lib/transpilation/markdown-generator.js';
import { ExitCode } from '../lib/exit-codes.js';
import { log } from '../lib/logger.js';
import { detectAndConfirmAPIConfig } from '../lib/llm/api-config.js';
import { LLMEnhancer } from '../lib/llm/llm-enhancer.js';
import { DocsCacheManager } from '../lib/llm/cache-manager.js';

/**
 * Extended options for transpile command.
 */
export interface TranspileCommandOptions extends CLIOptions {
  /** Force re-transpilation even if source unchanged */
  force?: boolean;
  /** Skip backup of existing configs */
  noBackup?: boolean;
  /** Skip LLM enhancement phase */
  noEnhance?: boolean;
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
    log.info('Run detection first: gsdo --detect');
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

  // Step 3.5: LLM Enhancement Pass (optional)
  if (!options.noEnhance && result.success && !options.dryRun && !options.quiet) {
    try {
      const enhanceOffer = await confirm({
        message: 'Enhance transpilation with LLM? (requires API key)',
        initialValue: false,
      });

      if (!isCancel(enhanceOffer) && enhanceOffer) {
        // Detect and confirm API configuration
        const apiConfig = await detectAndConfirmAPIConfig();

        if (apiConfig === null) {
          // No API key configured - show fallback message
          log.info('');
          log.info(pc.yellow('No API key configured. You can still get enhanced reports by running a local LLM:'));
          log.info('');
          log.info(pc.dim('  • Ollama: https://ollama.ai/docs/getting-started'));
          log.info(pc.dim('  • LM Studio: https://lmstudio.ai/'));
          log.info(pc.dim('  • llama.cpp: https://github.com/ggerganov/llama.cpp'));
          log.info('');
          log.info(pc.dim('Or use --no-enhance to skip this prompt next time.'));
          log.info('');
        } else {
          // API key validated - run enhancement
          const cacheManager = new DocsCacheManager();
          const enhancer = new LLMEnhancer(apiConfig, cacheManager);

          // Determine OpenCode config directory (same logic as orchestrator)
          const opencodeConfigDir = transpileOptions.opencodeConfigDir ?? join(process.cwd(), '.opencode');

          const enhancementResult = await enhancer.enhanceTranspilationResult(result, opencodeConfigDir);

          if (enhancementResult.success && enhancementResult.appliedRules > 0) {
            log.success(`Enhancement complete! Applied ${enhancementResult.appliedRules} new rule(s)`);
            log.info('');

            // Offer to regenerate report with new rules
            const regenerate = await confirm({
              message: 'Regenerate transpilation with LLM-enhanced rules?',
              initialValue: false,
            });

            if (!isCancel(regenerate) && regenerate) {
              log.info('Note: Re-transpilation with LLM rules is a future enhancement.');
              log.info('For now, LLM rules are saved to llm-rules.json for manual review.');
            }
          }

          if (enhancementResult.errors.length > 0) {
            log.warn('Enhancement encountered errors:');
            enhancementResult.errors.forEach(error => {
              log.warn(`  - ${error}`);
            });
            log.info('');
          }
        }
      }
    } catch (error) {
      // Never let LLM enhancement failure block transpilation
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.warn(`LLM enhancement failed: ${errorMsg}. Continuing with algorithmic result.`);
      if (error instanceof Error && error.stack) {
        log.verbose(error.stack);
      }
    }
  }

  // Step 4: Offer markdown export (only on success, not in quiet/dry-run mode)
  if (result.success && !options.quiet && !options.dryRun) {
    const saveMarkdown = await confirm({
      message: 'Save report to markdown?',
      initialValue: true,
    });

    if (isCancel(saveMarkdown)) {
      log.info('Markdown export cancelled.');
    } else if (saveMarkdown) {
      try {
        const markdown = generateMarkdown(result);
        const filePath = join(process.cwd(), 'transpilation-report.md');
        await writeFile(filePath, markdown, 'utf-8');
        log.success(`Report saved to ${filePath}`);
      } catch (error) {
        log.error(`Failed to save report: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}
