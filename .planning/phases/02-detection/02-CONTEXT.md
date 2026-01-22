# Phase 2: Detection - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Find GSD and OpenCode installations, validate completeness, report readiness for transpilation. User runs the CLI and gets clear status on whether their setup is ready. Discovery logic, validation rules, and installation prompts are in scope. Actual transpilation is Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Output & Messaging
- **Default verbosity:** Detailed — show paths, versions, validation results for everything
- **Status format:** Checkmarks/X visual style (✓ GSD found  ✗ OpenCode missing)
- **Error guidance:** Problem + actionable fix ("GSD not found. Run: git clone ... OR use --gsd-path=/your/path")
- **Warnings:** Show unless --quiet (default on, suppressible)

### Claude's Discretion
- GSD auto-detection logic (check ~/.claude first, then prompt)
- What constitutes a "complete" GSD installation (which files/folders required)
- OpenCode detection method (check common paths, config files, etc.)
- Freshness checking implementation (git status, file dates, etc.)
- Exact wording of professional status messages

</decisions>

<specifics>
## Specific Ideas

- Visual checkmarks fit the "at-a-glance" need for quick status
- Actionable fixes help the stone broke user who may not know GSD internals
- Detailed by default because this is a diagnostic phase — user wants to know what's happening

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-detection*
*Context gathered: 2026-01-21*
