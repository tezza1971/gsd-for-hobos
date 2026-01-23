# GSD Open

## What This Is

A frictionless, zero-input installer that migrates GSD context engineering from Claude Code to OpenCode. Run `npx gsd-open`, it transpiles all `/gsd:*` commands algorithmically, installs a `/gsdo` enhancement command, and exits with clear next steps. The `/gsdo` command then uses OpenCode's LLM to enhance transpiled commands autonomously. Not perfect parity, just best-effort migration that gets users 80% of the way there.

## Core Value

The `/gsdo` LLM enhancement makes transpiled commands actually usable. Algorithmic transpilation alone produces working but rough commands—the LLM refinement adapts them to OpenCode's patterns, fixes edge cases, and makes them production-ready.

## Requirements

### Validated

- ✓ Installer detects GSD at `~/.claude/get-shit-done/` automatically — v0.0.1
- ✓ Installer checks idempotency via timestamps (skip if source unchanged) — v0.0.1
- ✓ Installer caches OpenCode documentation (24hr TTL) in `~/.gsdo/cache/` — v0.0.1
- ✓ Installer installs `/gsdo` command in OpenCode's commands.json — v0.0.1
- ✓ Installer transpiles all `/gsd:*` commands to `/gsd:*` (or `/gsd-*` fallback) — v0.0.1
- ✓ Installer writes timestamped exit log to `~/.gsdo/install.log` — v0.0.1
- ✓ Installer shows ASCII success screen with disclaimer and next steps — v0.0.1
- ✓ `/gsdo` command reads install.log and cached docs for context — v0.0.1
- ✓ `/gsdo` command autonomously enhances all transpiled commands using OpenCode's LLM — v0.0.1
- ✓ `/gsdo` command writes results to `~/.gsdo/gsdo.log` (timestamped, rotated) — v0.0.1
- ✓ Zero user input throughout entire flow (installer + /gsdo) — v0.0.1
- ✓ Partial transpilation success is acceptable (install what works, log what doesn't) — v0.0.1
- ✓ Cross-platform support (Windows, Mac, Linux) — v0.0.1
- ✓ Installation completes in < 10 seconds (typical: 6-7s) — v0.0.1

### Active

(None — all v0.0.1 requirements shipped. Next milestone begins with /gsd:new-milestone)

### Out of Scope

- **Interactive CLI** — No prompts, no user decisions, fully automated
- **Perfect parity with Claude Code GSD** — 80% good enough, not 1:1 replication
- **Backups and rollback** — User can re-run installer to reset if needed
- **Multiple platform support** — OpenCode only, not Antigravity/Cursor/etc
- **API key management** — Uses OpenCode's configured LLM, no separate keys
- **Complex state tracking** — No manifests, just timestamp-based idempotency
- **Validation and schema checking** — Best effort approach, no strict validation
- **User skill assessment** — Assumes Claude builds, not user
- **GSD updates** — User updates GSD via Claude Code, we just transpile

## Context

### Migration Tool Philosophy

GSD Open is a **migration tool**, not a project management tool. All state lives in `~/.gsdo/`, never pollutes OpenCode's configuration space with metadata files. We only write the transpiled commands to OpenCode's expected locations.

### Two-Pass Architecture

1. **Algorithmic Pass (Installer)**: Deterministic transpilation using pattern matching. Converts command names, extracts templates, maps basic fields. Fast, repeatable, no LLM needed.

2. **Logical Pass (/gsdo Command)**: LLM-based enhancement in OpenCode's context. Adapts prompts, fixes edge cases, improves usability. Uses OpenCode's configured LLM, sees actual usage context.

### Autonomous Operation

Neither the installer nor `/gsdo` command request user input. Smart defaults everywhere. Errors exit with clear messages, don't hang waiting for input. User runs command, sees results, done.

### Log Rotation Strategy

- **install.log**: Timestamped entries, keep past week only
- **gsdo.log**: Timestamped entries, keep past week only
- Automatic cleanup on each run

## Constraints

- **Runtime**: Node.js 20+ required
- **Dependencies**: Zero external dependencies for installer (built-in modules only)
- **GSD Location**: Must be at `~/.claude/get-shit-done/` (no custom locations)
- **OpenCode Detection**: Auto-detects config at `.opencode/`, `~/.config/opencode/`, or `%APPDATA%/opencode/`
- **Performance**: Must complete installation in < 10 seconds
- **Platform**: Must work on Windows, Mac, Linux without platform-specific code
- **Naming**: Preserve `/gsd:` namespace prefix (or `/gsd-` fallback if filesystem limitations)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use timestamps for idempotency (not version parsing) | Simpler, more reliable, works even if GSD has no version file | ✓ Good |
| Prefer `/gsd:*` naming, fallback to `/gsd-*` | Namespace preservation, but adapt to platform filesystem limits | ✓ Good |
| Install partial success (10/15 commands) | Better to have working subset than all-or-nothing failure | ✓ Good |
| /gsdo enhances everything every run | Autonomous, idempotent, user doesn't manage individual commands | ✓ Good |
| Separate logs (install.log vs gsdo.log) | Clear separation of concerns, easier troubleshooting | ✓ Good |
| 7-day log rotation | Balances history preservation with disk space | ✓ Good |
| No backups or rollback | Re-running installer is the recovery mechanism | ✓ Good |
| Two-pass architecture (algorithmic + LLM) | Separates concerns, keeps installer fast, enables smart enhancement | ✓ Good |

## Current Status

**v0.0.1: ✅ SHIPPED (2026-01-23)**

Delivered a production-ready migration tool with:
- 54/54 requirements satisfied (100% coverage)
- 7 phases, 18 plans, 50+ tasks completed
- 144/144 tests passing
- ~6-7s typical install time (under 10s target)
- Zero external dependencies
- Cross-platform support (Windows, macOS, Linux)

**What was delivered:**
- Frictionless `npx gsd-open` installer with automatic detection and transpilation
- Comprehensive `/gsdo` enhancement command for OpenCode with LLM-powered refinement
- Full logging infrastructure (install.log, gsdo.log) with 7-day rotation
- Idempotent installation with timestamp-based freshness checking
- Actionable error messages with troubleshooting links and exit codes

**Next milestone:** v0.1 (post-release polish, user feedback, documentation)

---
*Last updated: 2026-01-23 after v0.0.1 milestone completion*
