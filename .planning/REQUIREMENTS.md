# Requirements: GSD Open

**Defined:** 2026-01-22
**Core Value:** The /gsdo LLM enhancement makes transpiled commands actually usable

## v1 Requirements

### Detection & Validation

- [x] **DETECT-01**: Installer auto-detects GSD at `~/.claude/get-shit-done/`
- [x] **DETECT-02**: Installer auto-detects OpenCode config directory (`.opencode/`, `~/.config/opencode/`, `%APPDATA%/opencode/`)
- [x] **DETECT-03**: Installer exits with clear error if GSD not found
- [x] **DETECT-04**: Installer exits with clear error if OpenCode not accessible

### Idempotency

- [x] **IDEM-01**: Installer checks `~/.gsdo/last-imported-gsd` for previous import timestamp
- [x] **IDEM-02**: Installer skips re-transpilation if GSD source unchanged
- [x] **IDEM-03**: Installer shows "Already up to date" message when skipping
- [x] **IDEM-04**: Installer updates `last-imported-gsd` file after successful transpilation

### Documentation Caching

- [x] **CACHE-01**: Installer downloads OpenCode docs from GitHub on first run
- [x] **CACHE-02**: Installer caches docs in `~/.gsdo/cache/docs-opencode/` with timestamp
- [x] **CACHE-03**: Installer checks cache age and refreshes if older than 24 hours
- [x] **CACHE-04**: Installer handles network failures gracefully when fetching docs

### Command Transpilation

- [x] **TRANS-01**: Installer scans `~/.claude/get-shit-done/skills/` for `/gsd:*` command files
- [x] **TRANS-02**: Installer converts command names from `/gsd:*` to `/gsd:*` (or `/gsd-*` if colons unsupported)
- [x] **TRANS-03**: Installer extracts prompt templates from GSD markdown files
- [x] **TRANS-04**: Installer parses template variables from prompt templates
- [x] **TRANS-05**: Installer maps GSD fields to OpenCode command schema
- [x] **TRANS-06**: Installer handles partial success (installs working commands, logs failures)
- [x] **TRANS-07**: Installer preserves GSD namespace prefix in command names

### Installation & Output

- [x] **INSTALL-01**: Installer creates `/gsdo` command definition with context references
- [x] **INSTALL-02**: Installer reads existing OpenCode `commands.json` if present
- [x] **INSTALL-03**: Installer adds/updates commands in `commands.json` without breaking existing commands
- [x] **INSTALL-04**: Installer writes updated `commands.json` to OpenCode config directory
- [x] **INSTALL-05**: Installer shows verbose progress during transpilation (detection, scanning, writing)

### /gsdo Enhancement

- [x] **ENHANCE-01**: `/gsdo` command reads `~/.gsdo/install.log` for transpilation context
- [x] **ENHANCE-02**: `/gsdo` command reads cached OpenCode docs from `~/.gsdo/cache/`
- [x] **ENHANCE-03**: `/gsdo` command lists all `/gsd-*` commands from OpenCode's `commands.json`
- [x] **ENHANCE-04**: `/gsdo` command uses OpenCode's configured LLM to analyze and enhance commands
- [x] **ENHANCE-05**: `/gsdo` command fixes naming issues in transpiled commands
- [x] **ENHANCE-06**: `/gsdo` command improves prompt templates for OpenCode patterns
- [x] **ENHANCE-07**: `/gsdo` command adds missing parameters to commands
- [x] **ENHANCE-08**: `/gsdo` command fixes broken agent/tool references
- [x] **ENHANCE-09**: `/gsdo` command updates `commands.json` in place
- [x] **ENHANCE-10**: `/gsdo` command operates autonomously without user input

### Logging

- [x] **LOG-01**: Installer writes timestamped entries to `~/.gsdo/install.log`
- [x] **LOG-02**: Installer logs include transpilation results (success/warnings/errors per command)
- [x] **LOG-03**: `/gsdo` command writes timestamped entries to `~/.gsdo/gsdo.log`
- [x] **LOG-04**: `/gsdo` command logs include enhancement results per command
- [x] **LOG-05**: Both logs rotate automatically (keep only past 7 days)
- [x] **LOG-06**: Logs use markdown format for human and LLM readability

### User Experience

- [x] **UX-01**: Installer requires zero user input (fully automated)
- [x] **UX-02**: Installer shows ASCII art success screen after completion
- [x] **UX-03**: Success screen includes disclaimer about best-effort migration
- [x] **UX-04**: Success screen shows clear next steps (/gsdo command)
- [x] **UX-05**: Success screen includes tip about re-running for updates
- [x] **UX-06**: Error messages are specific and actionable
- [x] **UX-07**: Partial success transparently shows what worked and what didn't

### Performance

- [x] **PERF-01**: Installer completes in < 10 seconds for typical GSD installation
- [x] **PERF-02**: Installer uses caching to avoid redundant work
- [x] **PERF-03**: Installer skips unnecessary transpilation via idempotency checks

### Cross-Platform Support

- [x] **PLATFORM-01**: Installer works on Windows, macOS, and Linux
- [x] **PLATFORM-02**: Installer handles platform-specific path differences automatically
- [x] **PLATFORM-03**: Installer uses only Node.js built-in modules (no external dependencies)
- [x] **PLATFORM-04**: Installer adapts command naming based on platform filesystem limitations

## v2 Requirements

(None defined yet - v1 is complete feature set for initial release)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive CLI with prompts | Contradicts zero-input automation philosophy |
| Perfect parity with Claude Code GSD | Best-effort migration (80% target), not 1:1 replication |
| Backup and rollback mechanisms | Re-running installer is the recovery mechanism |
| Complex manifest/state tracking | Simple timestamp-based idempotency sufficient |
| Multiple platform support (Antigravity, Cursor) | OpenCode only for v1 |
| Separate API key management | Uses OpenCode's configured LLM |
| LLM in installer | Algorithmic only, LLM reserved for /gsdo command |
| GSD version management | User updates GSD via Claude Code separately |
| Conflict resolution/merging | Overwrite strategy sufficient |
| Strict schema validation | Best-effort approach, no validation errors |
| Custom GSD installation locations | Standard path only (`~/.claude/get-shit-done/`) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DETECT-01 | Phase 1 | Complete |
| DETECT-02 | Phase 1 | Complete |
| DETECT-03 | Phase 1 | Complete |
| DETECT-04 | Phase 1 | Complete |
| IDEM-01 | Phase 5 | Complete |
| IDEM-02 | Phase 5 | Complete |
| IDEM-03 | Phase 5 | Complete |
| IDEM-04 | Phase 5 | Complete |
| CACHE-01 | Phase 2 | Complete |
| CACHE-02 | Phase 2 | Complete |
| CACHE-03 | Phase 2 | Complete |
| CACHE-04 | Phase 2 | Complete |
| TRANS-01 | Phase 1 | Complete |
| TRANS-02 | Phase 1 | Complete |
| TRANS-03 | Phase 4 | Complete |
| TRANS-04 | Phase 4 | Complete |
| TRANS-05 | Phase 1 | Complete |
| TRANS-06 | Phase 4 | Complete |
| TRANS-07 | Phase 1 | Complete |
| INSTALL-01 | Phase 3 | Complete |
| INSTALL-02 | Phase 1 | Complete |
| INSTALL-03 | Phase 1 | Complete |
| INSTALL-04 | Phase 1 | Complete |
| INSTALL-05 | Phase 4 | Complete |
| ENHANCE-01 | Phase 3 | Complete |
| ENHANCE-02 | Phase 3 | Complete |
| ENHANCE-03 | Phase 3 | Complete |
| ENHANCE-04 | Phase 3 | Complete |
| ENHANCE-05 | Phase 6 | Complete |
| ENHANCE-06 | Phase 6 | Complete |
| ENHANCE-07 | Phase 6 | Complete |
| ENHANCE-08 | Phase 6 | Complete |
| ENHANCE-09 | Phase 6 | Complete |
| ENHANCE-10 | Phase 3 | Complete |
| LOG-01 | Phase 6 | Complete |
| LOG-02 | Phase 6 | Complete |
| LOG-03 | Phase 6 | Complete |
| LOG-04 | Phase 6 | Complete |
| LOG-05 | Phase 6 | Complete |
| LOG-06 | Phase 6 | Complete |
| UX-01 | Phase 7 | Complete |
| UX-02 | Phase 7 | Complete |
| UX-03 | Phase 7 | Complete |
| UX-04 | Phase 7 | Complete |
| UX-05 | Phase 7 | Complete |
| UX-06 | Phase 7 | Complete |
| UX-07 | Phase 7 | Complete |
| PERF-01 | Phase 7 | Complete |
| PERF-02 | Phase 5 | Complete |
| PERF-03 | Phase 5 | Complete |
| PLATFORM-01 | Phase 1 | Complete |
| PLATFORM-02 | Phase 1 | Complete |
| PLATFORM-03 | Phase 1 | Complete |
| PLATFORM-04 | Phase 7 | Complete |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0

---
*Requirements defined: 2026-01-22*
*Last updated: 2026-01-22 after roadmap creation*
