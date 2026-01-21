import { select, text } from '@clack/prompts';
import type { CLIOptions } from '../../types/index.js';
import { detectGSD, detectOpenCode } from '../detection/gsd-detector.js';
import { detectOpenCode as detectOpenCodeAlias } from '../detection/opencode-detector.js';
import { formatDetectionReport, formatGSDMissing, formatOpenCodeNotFound } from '../detection/reporter.js';

export async function detectCommand(options: CLIOptions): Promise<void> {
  const [gsdResult, opencodeResult] = await Promise.all([
    detectGSD(),
    detectOpenCode(),
  ]);

  const report = {
    gsd: gsdResult,
    opencode: opencodeResult,
    ready: gsdResult.found && gsdResult.valid && opencodeResult.found
  };

  console.log(formatDetectionReport(report));

  if (!report.ready) {
    if (options.quiet) {
      return;
    }

    const needsGSDPrompt = !gsdResult.found;
    const needsOpenCodeInstall = !opencodeResult.found;

    if (needsGSDPrompt) {
      const action = await select({
        message: 'GSD not found. What would you like to do?',
        options: [
          { value: 'enter-path', label: 'Enter custom GSD path' },
          { value: 'install-instructions', label: 'Show installation instructions' },
          { value: 'cancel', label: 'Cancel detection' },
        ],
      });

      if (action === 'enter-path') {
        const path = await text({
          message: 'Enter path to GSD directory:',
          validate: (input) => input.trim().length > 0,
        });

        const [newGSDResult] = await detectGSD();
        console.log(formatDetectionReport({ gsd: newGSDResult, opencode: opencodeResult, ready: newGSDResult.found && newGSDResult.valid && opencodeResult.found }));
      } else if (action === 'install-instructions') {
        console.log('');
        console.log(pc.bold('GSD Installation Instructions:'));
        console.log('');
        console.log(pc.dim('GSD is the context engineering system for Claude Code.'));
        console.log(pc.dim('Clone the repository:'));
        console.log(pc.green('  git clone https://github.com/glittercowboy/get-shit-done.git ~/.claude'));
        console.log('');
        console.log(pc.dim('After cloning, verify these files exist:'));
        console.log(pc.yellow('  ~/.claude/package.json'));
        console.log(pc.yellow('  ~/.claude/commands/'));
        console.log(pc.yellow('  ~/.claude/agents/'));
        console.log('');
        console.log(pc.dim('Once installed, run detection again to verify.'));
      } else if (action === 'cancel') {
        return;
      }
    }

    if (needsOpenCodeInstall) {
      const action = await select({
        message: 'OpenCode not found. What would you like to do?',
        options: [
          { value: 'install', label: 'Install OpenCode' },
          { value: 'cancel', label: 'Cancel detection' },
        ],
      });

      if (action === 'install') {
        console.log('');
        console.log(pc.bold('OpenCode Installation Instructions:'));
        console.log('');
        console.log(pc.dim('Download OpenCode CLI from:'));
        console.log(pc.green('  https://github.com/opencodeai/opencode'));
        console.log('');
        console.log(pc.dim('Install with:'));
        console.log(pc.yellow('  npm install -g opencode-ai'));
        console.log('');
        console.log(pc.dim('After installing, run detection again to verify.'));
      } else if (action === 'cancel') {
        return;
      }
    }

  if (!report.ready && !options.quiet) {
    const exitCode = report.gsd.found && report.gsd.valid ? 0 : 1;
    process.exitCode = exitCode;
  }
}