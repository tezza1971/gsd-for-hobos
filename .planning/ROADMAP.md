# Roadmap: GSD Open

## Overview

A frictionless migration tool that transpiles GSD context engineering from Claude Code to OpenCode in 7 phases. Starting with core detection and basic transpilation, we layer on documentation caching, LLM enhancement, advanced transpilation features, idempotency, comprehensive logging, and final polish for a production-ready installer.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Installer** - Detection, basic transpilation, and OpenCode integration
- [x] **Phase 2: Documentation Cache** - Fetch and cache OpenCode docs for LLM context
- [x] **Phase 3: /gsdo Command** - Install LLM enhancement command in OpenCode
- [x] **Phase 4: Enhanced Transpilation** - Template extraction and variable parsing
- [x] **Phase 5: Idempotency** - Version tracking and skip-if-unchanged logic
- [x] **Phase 6: Exit Logging** - Detailed logs and /gsdo enhancement output
- [x] **Phase 7: Polish** - Error messages, ASCII art, and cross-platform refinement

## Phase Details

### Phase 1: Core Installer
**Goal**: User can run installer and get transpiled GSD commands in OpenCode
**Depends on**: Nothing (first phase)
**Requirements**: DETECT-01, DETECT-02, DETECT-03, DETECT-04, TRANS-01, TRANS-02, TRANS-05, TRANS-07, INSTALL-02, INSTALL-03, INSTALL-04, PLATFORM-01, PLATFORM-02, PLATFORM-03
**Success Criteria** (what must be TRUE):
  1. User runs `npx gsd-open` and installer automatically detects GSD at `~/.claude/get-shit-done/`
  2. Installer automatically detects OpenCode config directory without user input
  3. Installer scans GSD skills directory and converts `/gsd:*` command names to `/gsd:*` (or `/gsd-*` fallback)
  4. Installer writes transpiled commands to OpenCode's `commands.json` without breaking existing commands
  5. Installer works identically on Windows, macOS, and Linux using only Node.js built-in modules
**Plans**: 3 plans complete

Plans:
- [x] 01-01: Detection Infrastructure
- [x] 01-02: Transpilation Engine
- [x] 01-03: OpenCode Integration

### Phase 2: Documentation Cache
**Goal**: Installer caches OpenCode documentation for /gsdo LLM context
**Depends on**: Phase 1
**Requirements**: CACHE-01, CACHE-02, CACHE-03, CACHE-04
**Success Criteria** (what must be TRUE):
  1. Installer downloads OpenCode docs from GitHub on first run
  2. Docs are cached in `~/.gsdo/cache/docs-opencode/` with timestamp
  3. Installer checks cache age and refreshes only if older than 24 hours
  4. Installer handles network failures gracefully and continues with stale cache if available
**Plans**: 2 plans complete

Plans:
- [x] 02-01: Cache Infrastructure & Download
- [x] 02-02: Cache Management & Integration

### Phase 3: /gsdo Command
**Goal**: User can run /gsdo in OpenCode to enhance transpiled commands
**Depends on**: Phase 2
**Requirements**: INSTALL-01, ENHANCE-01, ENHANCE-02, ENHANCE-03, ENHANCE-04, ENHANCE-10
**Success Criteria** (what must be TRUE):
  1. Installer creates `/gsdo` command definition with references to install.log and cached docs
  2. User runs `/gsdo` in OpenCode and it reads install.log for transpilation context
  3. /gsdo command reads cached OpenCode docs from `~/.gsdo/cache/`
  4. /gsdo uses OpenCode's configured LLM to analyze all `/gsd-*` commands
  5. /gsdo operates autonomously without requesting user input
**Plans**: 3 plans complete

Plans:
- [x] 03-01: Enhancement engine core with context loading and backup
- [x] 03-02: LLM integration and per-command enhancement logic
- [x] 03-03: /gsdo command installation and CLI integration

### Phase 4: Enhanced Transpilation
**Goal**: Installer extracts prompt templates and variables from GSD commands
**Depends on**: Phase 3
**Requirements**: TRANS-03, TRANS-04, TRANS-06, INSTALL-05
**Success Criteria** (what must be TRUE):
  1. Installer extracts prompt templates from GSD markdown files
  2. Installer parses template variables (e.g., `{{phase}}`, `{{context}}`) from templates
  3. Installer handles partial success (installs working commands, logs failures)
  4. Installer shows verbose progress during transpilation (detection, scanning, writing phases)
**Plans**: 3 plans complete

Plans:
- [x] 04-01: Template Extraction - Extract clean prompt templates from GSD markdown
- [x] 04-02: Variable Parser - Parse {{var}} patterns and add to schema
- [x] 04-03: Verbose Progress & Error Handling - Enhanced CLI output with partial success display

### Phase 5: Idempotency
**Goal**: Installer skips re-transpilation when GSD source is unchanged
**Depends on**: Phase 4
**Requirements**: IDEM-01, IDEM-02, IDEM-03, IDEM-04, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. Installer checks `~/.gsdo/last-imported-gsd` for previous import timestamp
  2. Installer compares GSD source timestamps and skips transpilation if unchanged
  3. User sees "Already up to date" message when installer skips work
  4. Installer updates `last-imported-gsd` file after successful transpilation
  5. Installer uses caching to avoid redundant work (docs, transpilation)
**Plans**: 2 plans complete

Plans:
- [x] 05-01: State file infrastructure for tracking import history
- [x] 05-02: Freshness checking and CLI integration with skip logic

### Phase 6: Exit Logging
**Goal**: All installer and /gsdo activity is logged in detailed, readable format
**Depends on**: Phase 5
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, ENHANCE-05, ENHANCE-06, ENHANCE-07, ENHANCE-08, ENHANCE-09
**Success Criteria** (what must be TRUE):
  1. Installer writes timestamped entries to `~/.gsdo/install.log` with transpilation results
  2. Install log includes success/warnings/errors per command in markdown format
  3. /gsdo command writes timestamped entries to `~/.gsdo/gsdo.log` with enhancement results
  4. /gsdo fixes naming issues, improves prompt templates, adds missing parameters, and fixes broken references
  5. /gsdo updates `commands.json` in place with enhanced commands
  6. Both logs rotate automatically (keep only past 7 days)
**Plans**: 3 plans complete

Plans:
- [x] 06-01: Installer logging infrastructure with markdown/JSON hybrid format
- [x] 06-02: Enhancement logging and validation improvements
- [x] 06-03: Log rotation with daily rotation and 7-day retention

### Phase 7: Polish
**Goal**: Installer provides excellent UX with clear messaging and fast performance
**Depends on**: Phase 6
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, PERF-01, PLATFORM-04
**Success Criteria** (what must be TRUE):
  1. Installer requires zero user input and completes in under 10 seconds
  2. Installer shows ASCII art success screen with disclaimer about best-effort migration
  3. Success screen shows clear next steps (run /gsdo in OpenCode)
  4. Error messages are specific and actionable (e.g., "GSD not found at ~/.claude/get-shit-done/")
  5. Partial success transparently shows what worked and what didn't
  6. Installer adapts command naming based on platform filesystem limitations
**Plans**: 2 plans

Plans:
- [x] 07-01: Success screen with ASCII art and enhanced progress reporting
- [x] 07-02: Error handling, exit codes, and platform adaptation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Installer | 3/3 | ✓ Complete | 2026-01-22 |
| 2. Documentation Cache | 2/2 | ✓ Complete | 2026-01-22 |
| 3. /gsdo Command | 3/3 | ✓ Complete | 2026-01-22 |
| 4. Enhanced Transpilation | 3/3 | ✓ Complete | 2026-01-23 |
| 5. Idempotency | 2/2 | ✓ Complete | 2026-01-23 |
| 6. Exit Logging | 3/3 | ✓ Complete | 2026-01-23 |
| 7. Polish | 2/2 | ✓ Complete | 2026-01-23 |
