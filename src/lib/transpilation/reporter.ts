/**
 * Transpilation reporter for console output formatting.
 *
 * Generates formatted reports showing:
 * - Artifact status sections (commands, agents, models)
 * - Shortfall analysis with categorized gaps
 * - Summary statistics with percentages
 *
 * @module
 */

import pc from 'picocolors';
import type {
  TranspileResult,
  TransformGaps,
  OpenCodeConfig,
  UnmappedField,
  ApproximationEntry,
  GapCategory,
  TransformedArtifactsMetadata,
} from '../../types/index.js';

/**
 * Options for report generation.
 */
export interface ReportOptions {
  /** Preview mode - no files were written */
  dryRun?: boolean;
  /** Minimal output - summary only */
  quietMode?: boolean;
}

/**
 * Formatted report output in multiple formats.
 */
export interface FormattedReport {
  /** Formatted console output with colors */
  console: string;
  /** Markdown version for export (Plan 03 will implement) */
  markdown: string;
  /** Computed summary statistics */
  summary: ReportSummary;
}

/**
 * Summary statistics for the transpilation report.
 */
export interface ReportSummary {
  /** Total number of artifacts processed */
  totalArtifacts: number;
  /** Artifacts with no gaps */
  successful: number;
  /** Artifacts with approximations */
  partial: number;
  /** Artifacts with unmapped fields */
  failed: number;
  /** Total number of shortfalls */
  shortfallCount: number;
  /** Shortfalls broken down by category */
  shortfallsByCategory: {
    unsupported: number;
    platform: number;
    missingDep: number;
  };
}

/**
 * Combined gap entry for unified processing.
 * Internal type used during report generation.
 */
interface GapEntry {
  field: string;
  reason: string;
  suggestion: string;
  sourceFile: string;
  category: GapCategory;
  type: 'unmapped' | 'approximation';
  approximatedAs?: string;
}

/**
 * Collect all gaps into unified entries for processing.
 * @internal
 */
function collectGapEntries(gaps: TransformGaps): GapEntry[] {
  const entries: GapEntry[] = [];

  // Add unmapped fields
  for (const unmapped of gaps.unmappedFields) {
    entries.push({
      field: unmapped.field,
      reason: unmapped.reason,
      suggestion: unmapped.suggestion,
      sourceFile: unmapped.sourceFile,
      category: unmapped.category,
      type: 'unmapped',
    });
  }

  // Add approximations
  for (const approx of gaps.approximations) {
    entries.push({
      field: approx.original,
      reason: approx.reason,
      suggestion: `Approximated as: ${approx.approximatedAs}`,
      sourceFile: approx.sourceFile,
      category: approx.category,
      type: 'approximation',
      approximatedAs: approx.approximatedAs,
    });
  }

  return entries;
}

/**
 * Format artifact sections showing commands, agents, models status.
 * @internal
 */
function formatArtifactSections(
  result: TranspileResult,
  gaps: TransformGaps
): string {
  const sections: string[] = [];
  const artifacts = result.transformedArtifacts;

  if (!artifacts) {
    // Fallback when artifact metadata not provided
    sections.push(pc.dim('(Artifact details not available - check manifest for details)'));
    return sections.join('\n');
  }

  // TODO: Add timing integration when orchestrator supports it

  // Helper to determine artifact status based on gaps
  const getArtifactStatus = (
    artifactName: string,
    targetFile: string
  ): { symbol: string; status: string; color: (s: string) => string } => {
    // Check if any gaps reference this artifact's source file
    const allEntries = collectGapEntries(gaps);
    const relatedGaps = allEntries.filter(
      (g) =>
        g.sourceFile.includes(targetFile.replace('.json', '')) ||
        g.sourceFile.includes(artifactName)
    );

    if (relatedGaps.length === 0) {
      return { symbol: '\u2713', status: 'Success', color: pc.green };
    }

    const hasUnmapped = relatedGaps.some((g) => g.type === 'unmapped');
    if (hasUnmapped) {
      return {
        symbol: '\u2717',
        status: `Failed (${relatedGaps.length} gaps)`,
        color: pc.red,
      };
    }

    return {
      symbol: '\u26A0',
      status: `Partial (${relatedGaps.length} approximated)`,
      color: pc.yellow,
    };
  };

  // Commands section
  if (artifacts.commands.length > 0) {
    sections.push(pc.bold(`Commands (${artifacts.commands.length} items)`));
    sections.push('');
    for (const cmd of artifacts.commands) {
      const { symbol, status, color } = getArtifactStatus(cmd, 'commands.json');
      sections.push(`  ${color(symbol)} ${cmd}`);
      sections.push(`    Status: ${color(status)}`);
      sections.push(`    Target: .opencode/commands.json`);
    }
    sections.push('');
  }

  // Agents section
  if (artifacts.agents.length > 0) {
    sections.push(pc.bold(`Agents (${artifacts.agents.length} items)`));
    sections.push('');
    for (const agent of artifacts.agents) {
      const { symbol, status, color } = getArtifactStatus(agent, 'agents.json');
      sections.push(`  ${color(symbol)} ${agent}`);
      sections.push(`    Status: ${color(status)}`);
      sections.push(`    Target: .opencode/agents.json`);
    }
    sections.push('');
  }

  // Models section
  if (artifacts.models.length > 0) {
    sections.push(pc.bold(`Models (${artifacts.models.length} items)`));
    sections.push('');
    for (const model of artifacts.models) {
      const { symbol, status, color } = getArtifactStatus(model, 'models.json');
      sections.push(`  ${color(symbol)} ${model}`);
      sections.push(`    Status: ${color(status)}`);
      sections.push(`    Target: .opencode/models.json`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Format shortfall section with categorized gaps.
 * @internal
 */
function formatShortfallSection(gaps: TransformGaps): string {
  const sections: string[] = [];
  const entries = collectGapEntries(gaps);

  if (entries.length === 0) {
    sections.push(pc.green('All features transpiled successfully! No shortfalls.'));
    return sections.join('\n');
  }

  // Count by category
  const unsupported = entries.filter((e) => e.category === 'unsupported');
  const platform = entries.filter((e) => e.category === 'platform');
  const missingDep = entries.filter((e) => e.category === 'missing-dependency');

  // Header with counts
  const countParts: string[] = [];
  if (unsupported.length > 0) countParts.push(`${unsupported.length} unsupported`);
  if (platform.length > 0) countParts.push(`${platform.length} platform`);
  if (missingDep.length > 0) countParts.push(`${missingDep.length} missing dependency`);

  sections.push(
    pc.bold(`SHORTFALLS (${entries.length} issues: ${countParts.join(', ')})`)
  );
  sections.push('');

  // Unsupported section (red)
  if (unsupported.length > 0) {
    sections.push(`  ${pc.red(`Unsupported (${unsupported.length})`)}`);
    for (const gap of unsupported) {
      sections.push(`  - ${gap.field}: ${gap.reason}`);
      sections.push(`    ${pc.dim(`Suggestion: ${gap.suggestion}`)}`);
      sections.push(`    ${pc.dim(`Source: ${gap.sourceFile}`)}`);
    }
    sections.push('');
  }

  // Platform differences section (yellow)
  if (platform.length > 0) {
    sections.push(`  ${pc.yellow(`Platform Differences (${platform.length})`)}`);
    for (const gap of platform) {
      sections.push(`  - ${gap.field}: ${gap.reason}`);
      sections.push(`    ${pc.dim(`Suggestion: ${gap.suggestion}`)}`);
      sections.push(`    ${pc.dim(`Source: ${gap.sourceFile}`)}`);
    }
    sections.push('');
  }

  // Missing dependencies section (blue)
  if (missingDep.length > 0) {
    sections.push(`  ${pc.blue(`Missing Dependencies (${missingDep.length})`)}`);
    for (const gap of missingDep) {
      sections.push(`  - ${gap.field}: ${gap.reason}`);
      sections.push(`    ${pc.dim(`Suggestion: ${gap.suggestion}`)}`);
      sections.push(`    ${pc.dim(`Source: ${gap.sourceFile}`)}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Calculate summary statistics from result and gaps.
 * @internal
 */
function calculateSummary(
  result: TranspileResult,
  gaps: TransformGaps
): ReportSummary {
  const entries = collectGapEntries(gaps);
  const artifacts = result.transformedArtifacts;

  // Count artifacts
  const totalArtifacts = artifacts
    ? artifacts.commands.length + artifacts.agents.length + artifacts.models.length
    : 0;

  // Count gaps by category
  const unsupported = entries.filter((e) => e.category === 'unsupported').length;
  const platform = entries.filter((e) => e.category === 'platform').length;
  const missingDep = entries.filter((e) => e.category === 'missing-dependency').length;

  // Status calculation based on gap types
  const hasUnmapped = gaps.unmappedFields.length > 0;
  const hasApprox = gaps.approximations.length > 0;

  let successful = 0;
  let partial = 0;
  let failed = 0;

  if (totalArtifacts > 0) {
    if (hasUnmapped) {
      // Some features failed to map - count as failed
      // In reality, we'd track per-artifact, but simplified for now
      failed = totalArtifacts;
    } else if (hasApprox) {
      // Only approximations, partial success
      partial = totalArtifacts;
    } else {
      // No gaps at all - full success
      successful = totalArtifacts;
    }
  }

  return {
    totalArtifacts,
    successful,
    partial,
    failed,
    shortfallCount: entries.length,
    shortfallsByCategory: {
      unsupported,
      platform,
      missingDep,
    },
  };
}

/**
 * Format summary section with totals and percentages.
 * @internal
 */
function formatSummarySection(
  result: TranspileResult,
  summary: ReportSummary
): string {
  const sections: string[] = [];

  sections.push(pc.bold('SUMMARY'));

  if (summary.totalArtifacts > 0) {
    const pctSuccess = Math.round((summary.successful / summary.totalArtifacts) * 100);
    const pctPartial = Math.round((summary.partial / summary.totalArtifacts) * 100);
    const pctFailed = Math.round((summary.failed / summary.totalArtifacts) * 100);

    sections.push(`  Total artifacts: ${summary.totalArtifacts}`);
    sections.push(`  Successful: ${summary.successful} (${pctSuccess}%)`);
    sections.push(`  Partial: ${summary.partial} (${pctPartial}%)`);
    sections.push(`  Failed: ${summary.failed} (${pctFailed}%)`);
  } else {
    sections.push(`  ${pc.dim('No artifact metadata available')}`);
  }

  // Gap counts
  const { shortfallsByCategory: cat } = summary;
  const gapParts: string[] = [];
  if (cat.unsupported > 0) gapParts.push(`${cat.unsupported} unsupported`);
  if (cat.platform > 0) gapParts.push(`${cat.platform} platform`);
  if (cat.missingDep > 0) gapParts.push(`${cat.missingDep} missing dependency`);

  if (summary.shortfallCount > 0) {
    sections.push(`  Gaps: ${summary.shortfallCount} total (${gapParts.join(', ')})`);
  } else {
    sections.push(`  Gaps: ${pc.green('0 - all features mapped!')}`);
  }

  // Backup location
  if (result.backupLocation) {
    sections.push(`  Backup: ${pc.dim(result.backupLocation)}`);
  }

  sections.push('');

  return sections.join('\n');
}

/**
 * Generate a formatted transpilation report.
 *
 * Produces console output with:
 * - Artifact sections (commands, agents, models) with status
 * - Shortfall section with categorized gaps and suggestions
 * - Summary section with totals, percentages, and backup location
 *
 * @param result - The transpilation result to report on
 * @param options - Report generation options
 * @returns FormattedReport with console, markdown, and summary
 *
 * @example
 * ```typescript
 * const report = generateReport(transpileResult, { quietMode: false });
 * console.log(report.console);
 * ```
 */
export function generateReport(
  result: TranspileResult,
  options?: ReportOptions
): FormattedReport {
  const gaps: TransformGaps = result.gaps || {
    unmappedFields: [],
    approximations: [],
  };

  const summary = calculateSummary(result, gaps);
  const sections: string[] = [];

  // Dry run notice at top
  if (options?.dryRun) {
    sections.push(pc.yellow('DRY RUN - No files were written'));
    sections.push('');
  }

  // Status header
  if (result.success) {
    sections.push(pc.green('Transpilation complete!'));
  } else {
    sections.push(pc.red('Transpilation failed!'));
  }
  sections.push('');

  if (options?.quietMode) {
    // Quiet mode: summary only
    sections.push(formatSummarySection(result, summary));
  } else {
    // Full output

    // Backup and manifest info
    if (result.backupLocation && !options?.dryRun) {
      sections.push(`${pc.bold('Backup:')} ${result.backupLocation}`);
    }
    if (result.manifestPath && !options?.dryRun) {
      sections.push(`${pc.bold('Manifest:')} ${result.manifestPath}`);
    }
    if ((result.backupLocation || result.manifestPath) && !options?.dryRun) {
      sections.push('');
    }

    // Warnings
    if (result.warnings.length > 0) {
      sections.push(pc.yellow('Warnings:'));
      for (const warning of result.warnings) {
        sections.push(`  ${pc.yellow('-')} ${warning}`);
      }
      sections.push('');
    }

    // Errors
    if (!result.success && result.errors.length > 0) {
      sections.push(pc.red('Errors:'));
      for (const error of result.errors) {
        sections.push(`  ${pc.red('-')} ${error}`);
      }
      sections.push('');
    }

    // Artifact sections (if available)
    const artifactSection = formatArtifactSections(result, gaps);
    if (artifactSection.trim()) {
      sections.push(artifactSection);
    }

    // Shortfall section
    sections.push(formatShortfallSection(gaps));
    sections.push('');

    // Summary section
    sections.push(formatSummarySection(result, summary));
  }

  return {
    console: sections.join('\n'),
    markdown: '', // Plan 03 will implement
    summary,
  };
}
