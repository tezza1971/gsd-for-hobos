/**
 * Markdown report generator for transpilation results.
 *
 * Produces detailed markdown reports with:
 * - YAML frontmatter (date, tool, version)
 * - Table of contents with anchor links
 * - Summary section with statistics
 * - Artifact sections (commands, agents, models)
 * - Shortfalls section with categorized gaps
 * - Configuration section with collapsed JSON snippets
 */

import type {
  TranspileResult,
  TransformGaps,
  OpenCodeConfig,
  UnmappedField,
  ApproximationEntry,
  GapCategory,
} from '../../types/index.js';

/** Tool version - should match package.json */
const TOOL_VERSION = '0.1.0';

/**
 * Escape special markdown characters in text.
 *
 * @param text - Text to escape
 * @returns Escaped text safe for markdown
 */
function escapeMarkdown(text: string): string {
  // Escape characters that have special meaning in markdown
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/#/g, '\\#')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
    .replace(/_/g, '\\_');
}

/**
 * Generate YAML frontmatter for the report.
 *
 * @returns YAML frontmatter string
 */
function generateFrontmatter(): string {
  const date = new Date().toISOString();
  return `---
title: Transpilation Report
date: ${date}
tool: gsd-for-hobos
version: ${TOOL_VERSION}
---`;
}

/**
 * Generate table of contents with anchor links.
 *
 * @param hasGaps - Whether there are gaps to report
 * @param hasConfig - Whether config data is available
 * @returns TOC markdown string
 */
function generateTOC(hasGaps: boolean, hasConfig: boolean): string {
  const lines = [
    '## Table of Contents',
    '',
    '- [Summary](#summary)',
    '- [Commands](#commands)',
    '- [Agents](#agents)',
    '- [Models](#models)',
  ];

  if (hasGaps) {
    lines.push('- [Shortfalls](#shortfalls)');
  }

  if (hasConfig) {
    lines.push('- [Configuration](#configuration)');
  }

  return lines.join('\n');
}

/**
 * Generate summary section with statistics.
 *
 * @param result - Transpilation result
 * @returns Summary markdown string
 */
function generateSummary(result: TranspileResult): string {
  const lines = [
    '## Summary',
    '',
    '| Metric | Value |',
    '|--------|-------|',
  ];

  // Status
  const status = result.success ? 'Success' : 'Failed';
  lines.push(`| Status | ${status} |`);

  // Artifact counts
  const artifacts = result.transformedArtifacts;
  if (artifacts) {
    lines.push(`| Commands | ${artifacts.commands.length} |`);
    lines.push(`| Agents | ${artifacts.agents.length} |`);
    lines.push(`| Models | ${artifacts.models.length} |`);
  }

  // Gap counts
  const gaps = result.gaps;
  if (gaps) {
    const totalGaps = gaps.unmappedFields.length + gaps.approximations.length;
    lines.push(`| Total Gaps | ${totalGaps} |`);
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push(`| Warnings | ${result.warnings.length} |`);
  }

  // Backup location
  if (result.backupLocation) {
    lines.push(`| Backup | ${escapeMarkdown(result.backupLocation)} |`);
  }

  // Manifest path
  if (result.manifestPath) {
    lines.push(`| Manifest | ${escapeMarkdown(result.manifestPath)} |`);
  }

  return lines.join('\n');
}

/**
 * Determine artifact status based on gaps.
 *
 * @param artifactName - Name of the artifact
 * @param sourceFile - Source file to match against gaps
 * @param gaps - Transform gaps
 * @returns Status string (Success, Partial, Warning)
 */
function getArtifactStatus(
  artifactName: string,
  sourceFile: string,
  gaps?: TransformGaps
): string {
  if (!gaps) {
    return 'Success';
  }

  // Check if any gaps relate to this source file
  const relatedUnmapped = gaps.unmappedFields.filter(
    g => g.sourceFile.toLowerCase().includes(sourceFile.toLowerCase())
  );
  const relatedApprox = gaps.approximations.filter(
    g => g.sourceFile.toLowerCase().includes(sourceFile.toLowerCase())
  );

  if (relatedUnmapped.length > 0) {
    return `Partial (${relatedUnmapped.length} unmapped)`;
  }

  if (relatedApprox.length > 0) {
    return `Warning (${relatedApprox.length} approximated)`;
  }

  return 'Success';
}

/**
 * Generate artifact section (commands, agents, or models).
 *
 * @param title - Section title
 * @param items - List of artifact names
 * @param sourceFile - Source file pattern for gap matching
 * @param targetPath - Target path for generated config
 * @param gaps - Transform gaps for status determination
 * @returns Artifact section markdown string
 */
function generateArtifactSection(
  title: string,
  items: string[],
  sourceFile: string,
  targetPath: string,
  gaps?: TransformGaps
): string {
  const lines = [
    `## ${title}`,
    '',
  ];

  if (items.length === 0) {
    lines.push(`*No ${title.toLowerCase()} found.*`);
    return lines.join('\n');
  }

  // Table header
  lines.push('| Name | Status | Source | Target |');
  lines.push('|------|--------|--------|--------|');

  // Table rows
  for (const item of items) {
    const status = getArtifactStatus(item, sourceFile, gaps);
    const escapedItem = escapeMarkdown(item);
    const escapedSource = escapeMarkdown(sourceFile);
    const escapedTarget = escapeMarkdown(targetPath);
    lines.push(`| ${escapedItem} | ${status} | ${escapedSource} | ${escapedTarget} |`);
  }

  return lines.join('\n');
}

/**
 * Get category display name with proper casing.
 *
 * @param category - Gap category
 * @returns Display name
 */
function getCategoryDisplayName(category: GapCategory): string {
  switch (category) {
    case 'unsupported':
      return 'Unsupported';
    case 'platform':
      return 'Platform Differences';
    case 'missing-dependency':
      return 'Missing Dependencies';
    default:
      return 'Other';
  }
}

/**
 * Generate shortfalls section with categorized gaps.
 *
 * @param gaps - Transform gaps
 * @returns Shortfalls markdown string
 */
function generateShortfalls(gaps: TransformGaps): string {
  const lines = [
    '## Shortfalls',
    '',
  ];

  const unmapped = gaps.unmappedFields;
  const approx = gaps.approximations;
  const totalGaps = unmapped.length + approx.length;

  if (totalGaps === 0) {
    lines.push('*All features transpiled successfully! No shortfalls.*');
    return lines.join('\n');
  }

  // Group by category
  const categories: GapCategory[] = ['unsupported', 'platform', 'missing-dependency'];

  for (const category of categories) {
    const categoryUnmapped = unmapped.filter(g => g.category === category);
    const categoryApprox = approx.filter(g => g.category === category);
    const categoryCount = categoryUnmapped.length + categoryApprox.length;

    if (categoryCount === 0) {
      continue;
    }

    const displayName = getCategoryDisplayName(category);
    lines.push(`### ${displayName} (${categoryCount})`);
    lines.push('');

    // Unmapped fields
    for (const gap of categoryUnmapped) {
      lines.push(`**${escapeMarkdown(gap.field)}**`);
      lines.push('');
      lines.push(`- **Reason:** ${escapeMarkdown(gap.reason)}`);
      lines.push(`- **Suggestion:** ${escapeMarkdown(gap.suggestion)}`);
      lines.push(`- **Source:** ${escapeMarkdown(gap.sourceFile)}`);
      if (gap.value !== undefined) {
        const valueStr = typeof gap.value === 'string' ? gap.value : JSON.stringify(gap.value);
        lines.push(`- **Original Value:** \`${escapeMarkdown(valueStr)}\``);
      }
      lines.push('');
    }

    // Approximations
    for (const gap of categoryApprox) {
      lines.push(`**${escapeMarkdown(gap.original)}**`);
      lines.push('');
      lines.push(`- **Approximated As:** ${escapeMarkdown(gap.approximatedAs)}`);
      lines.push(`- **Reason:** ${escapeMarkdown(gap.reason)}`);
      lines.push(`- **Source:** ${escapeMarkdown(gap.sourceFile)}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generate configuration section with collapsed JSON blocks.
 *
 * @param config - OpenCode configuration
 * @returns Configuration markdown string
 */
function generateConfiguration(config: OpenCodeConfig): string {
  const lines = [
    '## Configuration',
    '',
    'Generated OpenCode configuration files:',
    '',
  ];

  // Commands
  if (config.commands.length > 0) {
    lines.push('### Generated Commands');
    lines.push('<details>');
    lines.push('<summary>commands.json</summary>');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(config.commands, null, 2));
    lines.push('```');
    lines.push('</details>');
    lines.push('');
  }

  // Agents
  if (config.agents.length > 0) {
    lines.push('### Generated Agents');
    lines.push('<details>');
    lines.push('<summary>agents.json</summary>');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(config.agents, null, 2));
    lines.push('```');
    lines.push('</details>');
    lines.push('');
  }

  // Models
  if (config.models.length > 0) {
    lines.push('### Generated Models');
    lines.push('<details>');
    lines.push('<summary>models.json</summary>');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(config.models, null, 2));
    lines.push('```');
    lines.push('</details>');
    lines.push('');
  }

  // Settings
  if (Object.keys(config.settings).length > 0) {
    lines.push('### Generated Settings');
    lines.push('<details>');
    lines.push('<summary>settings.json</summary>');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(config.settings, null, 2));
    lines.push('```');
    lines.push('</details>');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a complete markdown report from transpilation results.
 *
 * The report includes:
 * - YAML frontmatter with metadata
 * - Table of contents
 * - Summary statistics
 * - Commands, agents, models sections
 * - Shortfalls (if any gaps)
 * - Full configuration snippets in collapsed blocks
 *
 * @param result - Transpilation result to report on
 * @returns Complete markdown report string
 */
export function generateMarkdown(result: TranspileResult): string {
  const sections: string[] = [];
  const hasGaps = result.gaps &&
    (result.gaps.unmappedFields.length > 0 || result.gaps.approximations.length > 0);
  const hasConfig = result.opencode !== undefined;

  // Frontmatter
  sections.push(generateFrontmatter());
  sections.push('');

  // Title
  sections.push('# Transpilation Report');
  sections.push('');

  // Table of contents
  sections.push(generateTOC(hasGaps ?? false, hasConfig));
  sections.push('');

  // Summary
  sections.push(generateSummary(result));
  sections.push('');

  // Artifacts
  const artifacts = result.transformedArtifacts;
  if (artifacts) {
    sections.push(generateArtifactSection(
      'Commands',
      artifacts.commands,
      'commands.xml',
      '.opencode/commands.json',
      result.gaps
    ));
    sections.push('');

    sections.push(generateArtifactSection(
      'Agents',
      artifacts.agents,
      'agents.xml',
      '.opencode/agents.json',
      result.gaps
    ));
    sections.push('');

    sections.push(generateArtifactSection(
      'Models',
      artifacts.models,
      'models.xml',
      '.opencode/models.json',
      result.gaps
    ));
    sections.push('');
  } else {
    // Fallback if no artifact metadata
    sections.push('## Commands');
    sections.push('');
    sections.push('*Artifact metadata not available. Check manifest for details.*');
    sections.push('');

    sections.push('## Agents');
    sections.push('');
    sections.push('*Artifact metadata not available. Check manifest for details.*');
    sections.push('');

    sections.push('## Models');
    sections.push('');
    sections.push('*Artifact metadata not available. Check manifest for details.*');
    sections.push('');
  }

  // Shortfalls
  if (hasGaps && result.gaps) {
    sections.push(generateShortfalls(result.gaps));
    sections.push('');
  }

  // Configuration
  if (hasConfig && result.opencode) {
    sections.push(generateConfiguration(result.opencode));
  }

  // Warnings section (if any)
  if (result.warnings.length > 0) {
    sections.push('## Warnings');
    sections.push('');
    for (const warning of result.warnings) {
      sections.push(`- ${escapeMarkdown(warning)}`);
    }
    sections.push('');
  }

  // Errors section (if failed)
  if (!result.success && result.errors.length > 0) {
    sections.push('## Errors');
    sections.push('');
    for (const error of result.errors) {
      sections.push(`- ${escapeMarkdown(error)}`);
    }
    sections.push('');
  }

  // Footer
  sections.push('---');
  sections.push('');
  sections.push(`*Generated by gsd-for-hobos v${TOOL_VERSION}*`);

  return sections.join('\n');
}
