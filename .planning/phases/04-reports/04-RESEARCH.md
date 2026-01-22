# Phase 4: Reports - Research

**Researched:** 2026-01-22
**Domain:** Console reporting and markdown export for transpilation results, shortfall analysis, and metrics
**Confidence:** HIGH

## Summary

Phase 4 generates human-readable reports that reveal transpilation success/failure at the GSD artifact level (commands, agents) and highlight which features couldn't be mapped to OpenCode. The phase must produce two outputs: (1) a formatted console report showing status of all transpiled items, source/destination mappings, timing, and a dedicated shortfall section with categorized gaps and actionable suggestions, and (2) an optional markdown file for documentation, including full config snippets in collapsed details blocks and YAML frontmatter.

The standard approach is: consume the `TranspileResult` returned by the orchestrator (which includes `TransformGaps`, warnings, and metadata), build a reporter module that formats console output using existing picocolors patterns, offer interactive markdown export via @clack/prompts, and structure the report to present success/partial/warning/skipped/failed status for each artifact with source path references, section timings, and a dedicated shortfall section with categorized gaps (by cause: unsupported feature, platform difference, missing dependency).

**Primary recommendation:** Build a dedicated `reporter.ts` module in `src/lib/transpilation/` that consumes `TranspileResult` and emits formatted console output via existing logger and picocolors, separate markdown generation into `markdown-generator.ts` for reusability, enhance `TransformGaps` type to track source file paths and gap cause categories (unsupported/platform/missing), offer markdown export via post-transpilation prompt at command level, and use Node.js built-in file operations for markdown write.

## Standard Stack

The established libraries/tools for console reporting and markdown generation in 2026:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| picocolors | ^1.1.1 | Color and text styling (already in use) | Lightweight, zero-dependency, established pattern |
| @clack/prompts | ^0.11.0 | Interactive prompts (already in use) | Consistent with Phase 2/3 patterns |
| node:fs/promises | Built-in | Async file I/O for markdown write | Zero dependency, async-first, reliable |
| node:path | Built-in | Path handling for file destinations | Already in use via existing modules |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | No additional dependencies needed | Plain string concatenation for markdown is sufficient |

### Why These Choices
- **picocolors preferred:** Already in use throughout codebase (logger.ts, reporter.ts, transpile.ts); provides bold, dim, red, yellow, green, cyan
- **@clack/prompts for markdown save prompt:** Consistent with existing prompt patterns in detect.ts and transpile.ts
- **Node.js built-ins:** fs/promises and path already established; no external file management dependencies needed
- **Plain markdown strings:** No markdown generation library needed; simple string concatenation with proper heading/table/code-block syntax is adequate

### Alternatives NOT Recommended
| Instead of | Could Use | Why We Don't |
|------------|-----------|-------------|
| Plain string concatenation | markdown-it or remark | These are overkill for generating markdown (we don't parse); string concat is transparent |
| picocolors | chalk | chalk is heavier; picocolors already in use and is maintained |
| No markdown export | Custom HTML generator | Markdown is more portable and user-friendly for documentation |
| File write after prompt | commander auto-save flags | @clack/prompts gives better UX for optional save flow |

**Installation:**
```bash
# No new dependencies - all reporting uses existing stack
npm install
# All dependencies already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── transpilation/
│       ├── orchestrator.ts         # Returns TranspileResult (exists)
│       ├── reporter.ts             # Format console output (NEW)
│       └── markdown-generator.ts   # Generate markdown content (NEW)
└── commands/
    └── transpile.ts                # Integrate reporter, prompt for markdown export (UPDATE)
```

### Pattern 1: Reporter Module Architecture
**What:** Separate concern - consume TranspileResult, format for console, handle markdown generation
**When to use:** Decoupling reporting from transpilation orchestration
**Example:**

```typescript
// Source: Phase 4 recommended pattern
// src/lib/transpilation/reporter.ts

import pc from 'picocolors';
import type { TranspileResult, OpenCodeConfig, TransformGaps } from '../../types/index.js';

export interface ReportOptions {
  dryRun?: boolean;
  quietMode?: boolean;
}

export interface FormattedReport {
  console: string;        // Formatted console output
  markdown: string;       // Markdown version for export
  summary: ReportSummary;
}

export interface ReportSummary {
  totalArtifacts: number;
  successful: number;
  partial: number;
  failed: number;
  shortfallCount: number;
  shortfallsByCategory: {
    unsupported: number;
    platform: number;
    missingDep: number;
  };
}

export async function generateReport(
  result: TranspileResult,
  options?: ReportOptions
): Promise<FormattedReport> {
  // Validate input
  // Format artifact results (commands, agents, models)
  // Format shortfall section with categorized gaps
  // Generate summary
  // Build console and markdown versions
  // Return FormattedReport
}
```

### Pattern 2: Shortfall Categorization and Source Tracking
**What:** Enhance TransformGaps to track cause category and source file for each gap
**When to use:** When reporting gaps and offering workarounds
**Purpose:** Enable categorized presentation (Red: unsupported, Yellow: platform, Blue: missing) and source attribution

```typescript
// Enhanced TransformGaps structure for reporting
export interface TransformGaps {
  unmappedFields: Array<{
    field: string;
    value: unknown;
    reason: string;
    sourceFile: string;        // NEW: path to GSD file containing gap
    category: 'unsupported' | 'platform' | 'missing-dependency';
    suggestion: string;         // NEW: user action suggestion
  }>;
  approximations: Array<{
    original: string;
    approximatedAs: string;
    reason: string;
    sourceFile: string;         // NEW: path to GSD file containing approximation
    category: 'unsupported' | 'platform' | 'missing-dependency';
  }>;
}
```

### Pattern 3: Console Report Structure
**What:** Section-based layout with colors, timing, and artifact status
**When to use:** Displaying results to user in terminal
**Pattern:**

```
[bold] TRANSPILATION REPORT [/bold]

[bold]Commands (3 items, 1.2s)[/bold]

  [green]✓[/green] /gsd:plan -> agents.json
    Source: ~/.claude/commands.xml
    Status: Success

  [yellow]⚠[/yellow] /gsd:execute -> commands.json
    Source: ~/.claude/commands.xml
    Status: Partial (2 features not supported)
    Dropped: variable templates, conditional execution

  [red]✗[/red] /gsd:cleanup
    Source: ~/.claude/commands.xml
    Status: Failed
    Reason: Missing required agent reference

[bold]Agents (2 items, 0.8s)[/bold]
  ...

[bold]SHORTFALLS (6 issues: 3 unsupported, 2 platform, 1 missing)[/bold]

  [red]Unsupported (3)[/red]
  - Conditional execution: Not available in OpenCode. Suggestion: Use agent routing.
    Source: ~/.claude/commands.xml

  [yellow]Platform (2)[/yellow]
  - Variable templates: OpenCode uses template literals. Suggestion: Rewrite using {{variable}} syntax.
    Source: ~/.claude/commands.xml

  [blue]Missing Dependency (1)[/blue]
  - Tool registration: Requires tool-plugin module. Suggestion: Install @opencode/tool-plugin.
    Source: ~/.claude/agents.xml

[bold]SUMMARY[/bold]
  Total artifacts: 5
  Successful: 2 (40%)
  Partial: 1 (20%)
  Failed: 2 (40%)
  Gaps: 6 total (3 unsupported, 2 platform, 1 missing dependency)
  Files written: 4
  Backup: ~/.opencode-backup/2026-01-22_142530/
```

### Pattern 4: Markdown Export with Collapsed Config Snippets
**What:** Generate markdown with YAML frontmatter, TOC, and `<details>` collapsed sections for config
**When to use:** Creating documentation-friendly report
**Pattern:**

```markdown
---
title: Transpilation Report
date: 2026-01-22
gsdVersion: 1.0.0
tool: gsd-open
---

# Transpilation Report

## Table of Contents
- [Summary](#summary)
- [Commands](#commands)
- [Agents](#agents)
- [Shortfalls](#shortfalls)
- [Configuration](#configuration)

## Summary
...

## Shortfalls
...

## Configuration

### Generated Commands
<details>
<summary>commands.json</summary>

\`\`\`json
{...}
\`\`\`
</details>

### Generated Agents
<details>
<summary>agents.json</summary>

\`\`\`json
{...}
\`\`\`
</details>
```

### Anti-Patterns to Avoid
- **Embedding all config in console output:** Console gets too long; use sections, summaries, and markdown for full details
- **Not tracking source files in gaps:** Users can't find what caused the gap; always include source path
- **Deduplicating gaps by root cause:** User requirements specify "list each gap individually"; same root cause should show multiple times
- **Building markdown in console formatter:** Separate concerns; report.ts generates console, markdown-generator.ts builds markdown
- **Not offering markdown save as optional:** User decisions specify interactive prompt; don't auto-save or force flag

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Color/style formatting | Custom ANSI code strings | picocolors (already in use) | Handles edge cases, portability, already integrated |
| User prompt for markdown save | Yes/no confirm via readline | @clack/prompts.confirm (already in use) | Consistent UX, better error handling |
| Markdown generation | Custom string builders | Plain string concatenation (sufficient) | Markdown is simple format; full generator adds complexity |
| File writes with error handling | Custom retry logic | node:fs/promises + try/catch | Built-in, reliable, matches existing patterns |
| Source file attribution | Guessing from gap reason | Enhanced TransformGaps type (new field) | Requires parser/transformer to track source; can't infer |

**Key insight:** The reporting phase doesn't need new dependencies because the transpilation pipeline already provides all needed data (gaps, warnings, files), and picocolors + @clack/prompts already handle styling and interaction. The work is in organizing that data clearly, not building new tools.

## Common Pitfalls

### Pitfall 1: Losing Source File Context During Transformation
**What goes wrong:** Gaps are tracked during transformation (transformer.ts), but only as "field name" and "reason"; when reporting, you can't tell users which GSD file contained the gap, so suggestions feel disconnected
**Why it happens:** IR types (GSDAgent, GSDCommand) don't carry source file path; gaps structure doesn't store it
**How to avoid:** Enhance TransformGaps interface to include `sourceFile: string` field; pass source filename through transformation pipeline (agent name "from agents.xml" is visible but command "from commands.xml" is not)
**Warning signs:** Reporter code doing string inference ("is this an agent or command? guess from name pattern"); gaps reported without context of where they came from
**Validation:** Check that every gap has a non-empty `sourceFile` field; test with GSD that has agents and commands in separate files

### Pitfall 2: Shortfall Count Mismatch in Console vs Summary
**What goes wrong:** Shortfall section header says "6 issues" but summary says "5" because they're calculated independently; counts diverge if deduplication logic differs
**Why it happens:** Shortfall enumeration and summary generation happen in separate functions; no single source of truth
**How to avoid:** Build shortfall list once in reporter, reuse for both console section and summary; maintain single `shortfalls: Array<...>` collection that populates header count, list, and summary stats
**Warning signs:** Unit tests for count formatting, separate unit tests for summary; gap lists don't match counts
**Validation:** Shortfall header count == sum of items in shortfall list; summary count == same list; test with gaps that have duplicates to ensure no unexpected deduplication

### Pitfall 3: Markdown File Written But No User Feedback
**What goes wrong:** Markdown save prompt at end of transpile command uses @clack/prompts but doesn't confirm when write succeeds; user unsure if file was actually saved
**Why it happens:** Prompt collects yes/no, code writes file in background, no console message about destination
**How to avoid:** After successful markdown write, log `log.success('Report saved to transpilation-report.md')` with full path; if write fails, log error and offer suggestion (check permissions, etc.)
**Warning signs:** User runs transpile with successful result but no feedback about markdown save; confusion about file destination
**Validation:** Test with mock file system: yes→file write succeeds→check log.success() called; no→skip write→check no log; write error→check log.error() called

### Pitfall 4: Partial Transpilation Status Not Distinct From Success
**What goes wrong:** Report shows command/agent status as only "Success" or "Failed", not "Partial"; users with partial results (some fields mapped, some not) think everything succeeded
**Why it happens:** TranspileResult doesn't track per-artifact status; orchestrator returns overall success/false only
**How to avoid:** Add `status: 'success' | 'partial' | 'warning' | 'skipped' | 'failed'` to each reported artifact; infer from gaps + warnings for that specific agent/command; ensure partial shows exactly what was kept vs dropped
**Warning signs:** No way to report "command transpiled but lost variable templates"; all-or-nothing success/failure per artifact
**Validation:** Test with command that has variables (should be partial because variables were approximated); check reporter shows "Partial: 2 features not supported"

### Pitfall 5: Colorization Not Respecting Quiet Mode
**What goes wrong:** Report uses `pc.red()`, `pc.green()` but user ran with `--quiet` flag; colored output is still printed even though quiet mode suppresses other output
**Why it happens:** Reporter calls picocolors directly without checking log level; quiet mode check in logger.ts only applies to log.* functions, not direct pc.* calls
**How to avoid:** Report generation respects `options.quiet` flag and either: (1) strips colors when quiet mode active, or (2) skips report entirely. Check context: user expectation is --quiet suppresses non-error output, so report section should be suppressed entirely or shown without color
**Warning signs:** `--quiet` mode still outputs colored text; log output and reporter output follow different quiet rules
**Validation:** Run with `--quiet` flag; verify report not shown, or shown without ANSI color codes (test in CI/CD pipeline that doesn't support colors)

## Code Examples

Verified patterns from existing code and standards:

### Example 1: Console Output with picocolors (Existing Pattern)
```typescript
// Source: src/lib/detection/reporter.ts and src/lib/logger.ts
// Established pattern for picocolors styling

import pc from 'picocolors';

export function formatReport(report: SomeReport): string {
  const sections: string[] = [];

  sections.push(pc.bold('Section Header'));  // Bold
  sections.push('');                          // Blank line
  sections.push(`${pc.green('✓')} Item passed`);  // Green checkmark
  sections.push(`${pc.yellow('⚠')} Item warned`); // Yellow warning
  sections.push(`${pc.red('✗')} Item failed`);    // Red X
  sections.push(`${pc.dim('(details)')}`);        // Dim text for secondary info

  return sections.join('\n');
}

// Usage:
console.log(formatReport(...));
```

### Example 2: Interactive Prompt with @clack/prompts (Existing Pattern)
```typescript
// Source: src/commands/detect.ts and transpile.ts
// Established pattern for optional file operations

import { confirm, isCancel } from '@clack/prompts';
import { log } from '../lib/logger.js';

// In command after transpilation completes:
if (!options.quiet) {
  const saveMarkdown = await confirm({
    message: 'Save report to markdown?',
    initialValue: true,
  });

  if (isCancel(saveMarkdown)) {
    log.info('Markdown export cancelled.');
    return;
  }

  if (saveMarkdown) {
    // Write markdown file
    log.success('Report saved to transpilation-report.md');
  }
}
```

### Example 3: Async File Write with Error Handling
```typescript
// Source: src/lib/transpilation/orchestrator.ts
// Established pattern for file operations

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

try {
  const content = generateMarkdown(result);
  const filePath = join(process.cwd(), 'transpilation-report.md');
  await writeFile(filePath, content, 'utf-8');
  log.success(`Report saved to ${filePath}`);
} catch (error) {
  log.error(`Failed to save report: ${error instanceof Error ? error.message : String(error)}`);
}
```

### Example 4: Structured Gap Reporting with Category
```typescript
// Source: Pattern from src/lib/transpilation/transformer.ts
// Adapted for shortfall reporting with categories

interface CategorizedGap {
  category: 'unsupported' | 'platform' | 'missing-dependency';
  sourceFile: string;
  field: string;
  reason: string;
  suggestion: string;
}

export function formatShortfallSection(gaps: CategorizedGap[]): string {
  const sections: string[] = [];

  sections.push(pc.bold('SHORTFALLS'));
  sections.push('');

  // Group by category
  const byCategory = groupBy(gaps, 'category');

  const counts = {
    unsupported: (byCategory.unsupported || []).length,
    platform: (byCategory.platform || []).length,
    'missing-dependency': (byCategory['missing-dependency'] || []).length,
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const countStr = `${counts.unsupported} unsupported, ${counts.platform} platform, ${counts['missing-dependency']} missing`;

  sections.push(pc.bold(`SHORTFALLS (${totalCount} issues: ${countStr})`));
  sections.push('');

  // Format each category
  if (byCategory.unsupported?.length) {
    sections.push(pc.red(`Unsupported (${counts.unsupported})`));
    for (const gap of byCategory.unsupported) {
      sections.push(`  - ${gap.field}: ${gap.reason}`);
      sections.push(`    Suggestion: ${gap.suggestion}`);
      sections.push(`    Source: ${gap.sourceFile}`);
    }
    sections.push('');
  }

  if (byCategory.platform?.length) {
    sections.push(pc.yellow(`Platform (${counts.platform})`));
    for (const gap of byCategory.platform) {
      sections.push(`  - ${gap.field}: ${gap.reason}`);
      sections.push(`    Suggestion: ${gap.suggestion}`);
      sections.push(`    Source: ${gap.sourceFile}`);
    }
    sections.push('');
  }

  if (byCategory['missing-dependency']?.length) {
    sections.push(pc.blue(`Missing Dependency (${counts['missing-dependency']})`));
    for (const gap of byCategory['missing-dependency']) {
      sections.push(`  - ${gap.field}: ${gap.reason}`);
      sections.push(`    Suggestion: ${gap.suggestion}`);
      sections.push(`    Source: ${gap.sourceFile}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain text error logs | Structured console report with sections and colors | 2020s CLI UX standard | Users see clear status at a glance; errors organized by type |
| Custom HTML reports | Markdown reports for documentation | Markdown universality (2010s onward) | More portable, version-controllable, editor-friendly |
| Auto-saving reports | Optional interactive save prompt | Better UX (2020s) | User controls whether to save; reduces clutter if reports not needed |
| Per-file results logging | Aggregated artifact-level results | Phase 4 design | Users see command/agent status, not low-level file mappings |

**Deprecated/outdated:**
- Colored output without respecting quiet mode: Modern CLIs respect terminal capabilities and quiet flags
- No categorization of errors: Grouping by cause (unsupported vs platform vs missing) is standard for actionable feedback
- Markdown export without frontmatter: YAML frontmatter (date, version, tool) is standard for generated documents

## Open Questions

Questions that couldn't be fully resolved during research:

1. **Per-artifact timing precision**
   - What we know: Transpilation phases report overall timing; requirements ask for "per-section timing information"
   - What's unclear: Should timing show transformation time per agent/command? Or just high-level (Commands section: 0.5s, Agents section: 0.3s)?
   - Recommendation: Start with high-level section timing (commands, agents, models); if per-artifact precision needed, add timing wrapper in transformer

2. **GSD feature → gap category mapping**
   - What we know: User decisions specify categories (unsupported, platform, missing dependency) but transformer.ts doesn't yet emit categorized gaps
   - What's unclear: How does parser/transformer know if a missing feature is "unsupported in OpenCode" vs "platform-specific" vs "requires external tool"?
   - Recommendation: Define category in transformer rules (`transform-rules.json`): for each field mapping, specify `category: 'unsupported' | 'platform' | 'missing-dependency'`; populate TransformGaps from rules

3. **Markdown file destination and naming**
   - What we know: Context specifies filename `transpilation-report.md`, location "current working directory"
   - What's unclear: If user runs gsdo from subdirectory, should report go there? Or to GSD directory? Or to OpenCode directory?
   - Recommendation: Save to `process.cwd()` (where user ran command); this is standard CLI behavior; user can control via `cd` before running

## Sources

### Primary (HIGH confidence)
- Code review of src/lib/transpilation/orchestrator.ts (TranspileResult structure, gaps tracking)
- Code review of src/lib/detection/reporter.ts (picocolors pattern for console formatting)
- Code review of src/commands/transpile.ts (where reporter integrates, existing gap reporting)
- Code review of src/lib/logger.ts (logger API and quiet mode handling)
- Code review of src/types/index.ts (TransformGaps type, OpenCodeConfig structure)
- Code review of package.json dependencies (picocolors, @clack/prompts already present)

### Secondary (MEDIUM confidence)
- Code review of src/lib/transpilation/transformer.ts (gap creation logic, field mapping patterns)
- Code review of existing tests (detect.test.ts showing @clack/prompts testing patterns)

### Tertiary (LOW confidence)
- None; research based entirely on codebase examination

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - picocolors and @clack/prompts already integrated; no new dependencies needed
- Architecture: HIGH - reporter module pattern matches existing detection/reporter.ts; markdown generation is straightforward string building
- Pitfalls: HIGH - based on existing patterns observed in codebase (lose context, count mismatches, mode handling)
- Integration points: HIGH - TranspileResult and TransformGaps structures clearly understood from types.ts and orchestrator.ts

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (stable domain; may need refresh if new transpiler features added)

**Phase prerequisites fulfilled:**
- Phase 3 output (TranspileResult, gaps, warnings) - understood and validated in code
- Logger and picocolors patterns - confirmed in existing codebase
- @clack/prompts integration - confirmed working in detect.ts and transpile.ts
- File operations patterns - confirmed in orchestrator.ts
