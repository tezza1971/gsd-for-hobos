import pc from 'picocolors';
import type { GSDDetectionResult, OpenCodeDetectionResult, ValidationReport } from '../../types/index.js';

export function formatDetectionReport(report: ValidationReport): string {
  const sections: string[] = [];

  sections.push(pc.cyan('Detection Report:'));
  sections.push('');

  // GSD section
  sections.push(pc.bold('GSD:'));
  const gsdCheckmark = report.gsd.found && report.gsd.valid ? pc.green('✓') : pc.red('✗');
  const gsdStatus = report.gsd.found
    ? report.gsd.valid ? pc.green('Found') : pc.yellow('Not valid')
    : pc.red('Not found');
  sections.push(`${gsdCheckmark} ${gsdStatus}`);
  if (report.gsd.found && report.gsd.path) {
    sections.push(`  ${pc.dim(report.gsd.path)}`);
  }
  if (report.gsd.found && report.gsd.daysOld !== undefined) {
    const stale = report.gsd.daysOld && report.gsd.daysOld > 90;
    const staleMsg = stale ? pc.yellow(`⚠ ${report.gsd.daysOld} days old`) : pc.green('Fresh');
    sections.push(`  ${staleMsg}`);
  }
  if (report.gsd.reason) {
    sections.push(`  ${pc.dim(`(${report.gsd.reason})`)}`);
  }

  sections.push('');

  // OpenCode section
  sections.push(pc.bold('OpenCode:'));
  const openCodeCheckmark = report.opencode.found ? pc.green('✓') : pc.red('✗');
  const openCodeStatus = report.opencode.found
    ? report.opencode.found ? pc.green('Found') : pc.yellow('Not found')
    : pc.red('Not found');
  sections.push(`${openCodeCheckmark} ${openCodeStatus}`);
  if (report.opencode.found && report.opencode.path) {
    sections.push(`  ${pc.dim(report.opencode.path)}`);
  }
  if (report.opencode.reason) {
    sections.push(`  ${pc.dim(`(${report.opencode.reason})`)}`);
  }

  sections.push('');

  // Ready section
  const ready = report.gsd.found && report.gsd.valid && report.opencode.found && report.opencode.found;
  const readySymbol = ready ? pc.green('✓') : pc.red('✗');
  sections.push(pc.bold('Ready for transpilation:'));
  sections.push(`${readySymbol} ${ready ? 'YES' : 'NO'}`);

  sections.push('');

  return sections.join('\n');
}

export function formatGSDMissing(missingFiles: string[], missingDirs: string[]): string {
  const items: string[] = [];

  if (missingFiles.length > 0) {
    items.push(pc.red('✗ Missing files:'));
    for (const file of missingFiles) {
      items.push(`  ${pc.dim(file)}`);
    }
  }

  if (missingDirs.length > 0) {
    items.push(pc.red('✗ Missing directories:'));
    for (const dir of missingDirs) {
      items.push(`  ${pc.dim(dir)}`);
    }
  }

  return items.join('\n');
}

export function formatOpenCodeNotFound(reason: string): string {
  return `${pc.red('✗ Not found')} ${pc.dim(`(${reason})`)}`;
}