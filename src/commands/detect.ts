import { select, text, isCancel } from '@clack/prompts';
import pc from 'picocolors';
import { spawnSync } from 'node:child_process';
import type { CLIOptions, ValidationReport } from '../types/index.js';
import { detectGSD } from '../lib/detection/gsd-detector.js';
import { detectOpenCode } from '../lib/detection/opencode-detector.js';
import { formatDetectionReport } from '../lib/detection/reporter.js';
import { ExitCode } from '../lib/exit-codes.js';
import { log } from '../lib/logger.js';

/**
 * Detection command that orchestrates GSD and OpenCode detection with interactive prompts.
 *
 * Flow:
 * 1. Run detections in parallel
 * 2. Handle GSD not found at default location (prompt for custom path or show install instructions)
 * 3. Build and display ValidationReport
 * 4. Set appropriate exit code
 *
 * @param options - CLI options (quiet mode skips interactive prompts)
 */
export async function detectCommand(options: CLIOptions): Promise<void> {
  // Run detections in parallel for performance
  const [gsdResult, opencodeResult] = await Promise.all([
    detectGSD(),
    detectOpenCode(),
  ]);

  // Build initial report
  let report: ValidationReport = {
    gsd: gsdResult,
    opencode: opencodeResult,
    ready: Boolean(gsdResult.found && gsdResult.valid && opencodeResult.found),
  };

  // Display initial report
  console.log(formatDetectionReport(report));

  // In quiet mode, skip interactive prompts
  if (options.quiet) {
    setExitCode(report);
    return;
  }

  // Handle GSD not found - offer choices
  if (!gsdResult.found) {
    const action = await select({
      message: 'GSD not found. What would you like to do?',
      options: [
        { value: 'enter-path', label: 'Enter custom GSD path' },
        { value: 'install-instructions', label: 'Show installation instructions' },
        { value: 'cancel', label: 'Cancel' },
      ],
    });

    if (isCancel(action)) {
      log.info('Detection cancelled.');
      process.exitCode = ExitCode.SUCCESS;
      return;
    }

    if (action === 'enter-path') {
      const customPath = await text({
        message: 'Enter path to GSD directory:',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Path cannot be empty';
          }
          return undefined;
        },
      });

      if (isCancel(customPath)) {
        log.info('Detection cancelled.');
        process.exitCode = ExitCode.SUCCESS;
        return;
      }

      // Re-run GSD detection with custom path
      // Note: detectGSD currently only checks default path
      // For custom path support, we would need to extend detectGSD
      // For now, inform the user to place GSD at default location
      log.info(`Custom path support coming soon. For now, place GSD at ~/.claude/`);
      log.verbose(`Entered path: ${customPath}`);
    } else if (action === 'install-instructions') {
      showGSDInstallInstructions();
    }
    // action === 'cancel' - just fall through to set exit code
  }

  // Handle stale GSD - offer update option
  if (gsdResult.found && gsdResult.valid && gsdResult.fresh === false) {
    const action = await select({
      message: `GSD installation is ${gsdResult.daysOld} days old. What would you like to do?`,
      options: [
        { value: 'update', label: 'Update GSD (git pull)' },
        { value: 'continue', label: 'Continue anyway' },
        { value: 'cancel', label: 'Cancel' },
      ],
    });

    if (isCancel(action)) {
      log.info('Detection cancelled.');
      process.exitCode = ExitCode.SUCCESS;
      return;
    }

    if (action === 'update') {
      log.info('Updating GSD installation...');

      const result = spawnSync('git', ['pull'], {
        cwd: gsdResult.path,
        encoding: 'utf-8',
        timeout: 30000,
        stdio: 'inherit'
      });

      if (result.error || result.status !== 0) {
        log.info(pc.red('Failed to update GSD. Please update manually.'));
        showGSDUpdateInstructions();
      } else {
        log.info(pc.green('GSD updated successfully!'));
      }
    } else if (action === 'cancel') {
      process.exitCode = ExitCode.SUCCESS;
      return;
    }
    // action === 'continue' - just fall through
  }

  // Handle OpenCode not found - offer installation instructions
  if (!opencodeResult.found) {
    const action = await select({
      message: 'OpenCode not found. What would you like to do?',
      options: [
        { value: 'show-install', label: 'Show installation instructions' },
        { value: 'cancel', label: 'Cancel' },
      ],
    });

    if (isCancel(action)) {
      log.info('Detection cancelled.');
      process.exitCode = ExitCode.SUCCESS;
      return;
    }

    if (action === 'show-install') {
      showOpenCodeInstallInstructions();
    }
    // action === 'cancel' - just fall through to set exit code
  }

  // Set exit code based on final report
  setExitCode(report);
}

/**
 * Set process exit code based on detection results.
 */
function setExitCode(report: ValidationReport): void {
  if (report.ready) {
    process.exitCode = ExitCode.SUCCESS;
  } else if (report.gsd.found && report.gsd.valid && !report.gsd.fresh) {
    // GSD found but stale - warning
    process.exitCode = ExitCode.WARNING;
  } else {
    // Missing installations - error
    process.exitCode = ExitCode.ERROR;
  }
}

/**
 * Display GSD installation instructions.
 */
function showGSDInstallInstructions(): void {
  console.log('');
  console.log(pc.bold('GSD Installation Instructions:'));
  console.log('');
  console.log(pc.dim('GSD is the context engineering system for Claude Code.'));
  console.log(pc.dim('Clone the repository:'));
  console.log('');
  console.log(pc.green('  git clone https://github.com/glittercowboy/get-shit-done.git ~/.claude'));
  console.log('');
  console.log(pc.dim('After cloning, verify these files exist:'));
  console.log(pc.yellow('  ~/.claude/package.json'));
  console.log(pc.yellow('  ~/.claude/README.md'));
  console.log(pc.yellow('  ~/.claude/commands/'));
  console.log(pc.yellow('  ~/.claude/agents/'));
  console.log('');
  console.log(pc.dim('Once installed, run detection again to verify.'));
  console.log('');
}

/**
 * Display OpenCode installation instructions.
 */
function showOpenCodeInstallInstructions(): void {
  console.log('');
  console.log(pc.bold('OpenCode Installation Instructions:'));
  console.log('');
  console.log(pc.dim('OpenCode is an open-source AI coding assistant.'));
  console.log(pc.dim('Install from npm:'));
  console.log('');
  console.log(pc.green('  npm install -g opencode-ai'));
  console.log('');
  console.log(pc.dim('Or download from:'));
  console.log(pc.cyan('  https://github.com/opencode-ai/opencode'));
  console.log('');
  console.log(pc.dim('After installing, ensure opencode is in your PATH.'));
  console.log(pc.dim('Run detection again to verify.'));
  console.log('');
}

/**
 * Display GSD update instructions for manual updating.
 */
function showGSDUpdateInstructions(): void {
  console.log('');
  console.log(pc.bold('Manual GSD Update Instructions:'));
  console.log('');
  console.log(pc.dim('To manually update your GSD installation:'));
  console.log('');
  console.log(pc.green('  cd ~/.claude'));
  console.log(pc.green('  git pull'));
  console.log('');
  console.log(pc.dim('After updating, run detection again to verify.'));
  console.log('');
}
