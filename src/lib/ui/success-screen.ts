/**
 * Success screen renderer with ASCII art and installation summary
 */

import pc from 'picocolors';
import type { SuccessScreenData } from './types.js';

/**
 * Check if terminal supports colors
 */
function supportsColor(): boolean {
  return process.stdout.isTTY !== false && !process.env.NO_COLOR;
}

/**
 * Render success screen with ASCII art, stats, and next steps
 */
export function renderSuccessScreen(data: SuccessScreenData): void {
  const hasColor = supportsColor();

  // Helper functions for conditional coloring
  const green = hasColor ? pc.green : (s: string) => s;
  const yellow = hasColor ? pc.yellow : (s: string) => s;
  const bold = hasColor ? pc.bold : (s: string) => s;
  const dim = hasColor ? pc.dim : (s: string) => s;

  // ASCII art - rocket ship for launch/energy metaphor
  const art = `
    ${green('🚀')}
   ${green('/|\\')}
  ${green('/ | \\')}
`;

  // Build output sections
  const lines: string[] = [];

  lines.push(art);

  // Success message (different for partial vs full success)
  if (data.partialSuccess) {
    lines.push(yellow('⚠ Installation Complete (with warnings)'));
    lines.push('');
    lines.push(`${green('✓')} Installed ${bold(String(data.commandsInstalled))} GSD commands`);
    if (data.failedCount && data.failedCount > 0) {
      lines.push(`${yellow('⚠')} ${data.failedCount} commands failed to transpile`);
    }
    if (data.warningCount && data.warningCount > 0) {
      lines.push(`${yellow('⚠')} ${data.warningCount} warnings during transpilation`);
    }
  } else {
    lines.push(green('✓ Installation Complete!'));
    lines.push('');
    lines.push(`Installed ${bold(String(data.commandsInstalled))} GSD commands`);
  }

  // Installation details
  lines.push('');
  lines.push(bold('Installation Details:'));
  lines.push(`  GSD: ${dim(data.gsdPath)}`);
  lines.push(`  OpenCode: ${dim(data.opencodePath)}`);

  // Cache status with appropriate coloring
  const cacheStatusLabel =
    data.cacheStatus === 'fresh' ? green('Fresh') :
    data.cacheStatus === 'stale' ? yellow('Stale') :
    yellow('Unavailable');
  lines.push(`  Docs Cache: ${cacheStatusLabel}`);

  // Next steps
  lines.push('');
  lines.push(bold('Next Steps:'));
  lines.push('  1. Launch OpenCode');
  lines.push('  2. Type: /gsdo');
  lines.push('  3. Follow prompts to transpile GSD commands');
  lines.push('');
  lines.push(dim('What /gsdo does:'));
  lines.push(dim('  • Examines original GSD files in ~/.gsdo/copied/'));
  lines.push(dim('  • Reviews cached documentation'));
  lines.push(dim('  • Transpiles each command for OpenCode compatibility'));
  lines.push(dim('  • Outputs enhanced commands to ~/.config/opencode/command/'));

  // Disclaimer about best-effort migration
  lines.push('');
  lines.push(dim('Note: This is a best-effort migration. Review commands before use.'));

  // Tip about re-running
  lines.push('');
  lines.push(dim('Tip: Run \'npx gsd-open\' again anytime to update'));

  // Log reference for troubleshooting (if partial success)
  if (data.partialSuccess) {
    lines.push('');
    lines.push(dim('See ~/.gsdo/install.md for details'));
  }

  // Print all lines
  console.log(lines.join('\n'));
}
