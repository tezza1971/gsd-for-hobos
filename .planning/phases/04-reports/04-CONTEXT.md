# Phase 4: Reports - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate reports showing transpilation results and shortfall analysis. Console output for immediate feedback, markdown export for documentation. LLM enhancement belongs to Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Console output format
- Grouped sections with bold text headers (no emoji)
- Items show: name + status + reason for failures
- Items display source file path (full paths)
- Prominent summary at bottom of report
- Per-section timing information
- Comfortable spacing (blank line between sections)
- Items in original order (as they appeared in GSD source)
- Colorful styling: green success, red failures, yellow warnings, bold headers
- Brief success message when 100%: "All commands transpiled successfully!"
- Use existing --dry-run flag for preview mode

### Shortfall presentation
- Own clearly-labeled section after all results
- Categorized by cause: Unsupported feature, Platform difference, Missing dependency
- Color by category: Red unsupported, yellow platform, blue missing dep
- Section header with detailed count: "SHORTFALLS (6 issues: 3 unsupported, 2 platform, 1 missing)"
- Each gap includes:
  - Suggestion for what user can do (always)
  - Source file reference showing which GSD feature caused it
- Gap count in summary (by category)
- Partial transpilation as distinct status category
- Full breakdown for partials: exactly what was kept vs dropped
- Workarounds collected in separate "What you can do" section
- No deduplication: list each gap individually even if same root cause

### Report content
- Categories: Commands + Agents (main GSD artifacts)
- Source mapping: Full paths to GSD source files
- Destination paths: Show where each item ended up in OpenCode
- Status levels: Success, Partial, Warning, Skipped, Failed (detailed)
- Transform view: Show source→target mapping inline in console

### Markdown export
- Filename: transpilation-report.md
- Location: Current working directory
- Triggered by: Interactive prompt at end ("Save report to markdown?")
- More detail than console: includes full generated config snippets
- Table of contents: Always included
- Metadata: YAML frontmatter (date, GSD version, etc.)
- Config snippets: All collapsed using `<details>` tags

### Claude's Discretion
- Exact color hex/ANSI codes
- Table column widths and alignment
- Markdown section ordering
- How to truncate long paths in console
- Frontmatter fields beyond date/version

</decisions>

<specifics>
## Specific Ideas

No specific product references — open to standard CLI report patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-reports*
*Context gathered: 2026-01-22*
