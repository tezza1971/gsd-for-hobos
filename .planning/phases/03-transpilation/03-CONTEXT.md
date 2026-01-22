# Phase 3: Transpilation - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Parse GSD context files into an intermediate representation and transform them into valid OpenCode configuration. Handle conflicts with existing configs through backup and overwrite. Rollback on errors to maintain clean state. Report generation is a separate phase.

</domain>

<decisions>
## Implementation Decisions

### Transformation strategy
- Use intermediate representation (parse GSD → internal model → emit OpenCode)
- Best-effort approximation when GSD construct has no direct OpenCode equivalent (note gaps in report)
- Config-driven transform rules (mappings in config file, not hardcoded)
- User-overridable config: ship defaults in package, allow `~/.gsdo/transforms.json` to override

### Conflict resolution
- Backup then overwrite (auto-backup existing configs, no prompts)
- Timestamped subfolder for backups: `.opencode-backup/2025-01-21_143022/`
- Always backup + overwrite on re-run (consistent behavior, manual edits get backed up)
- `--no-backup` flag available for power users who want to skip backups

### Error handling
- Fail fast on errors (stop on first error, report it, exit)
- Rollback all on mid-transpilation error (delete written files, restore backups, clean state)
- Developer-friendly error messages (include stack traces, internal state for debugging)
- `--dry-run` performs full validation (parse all files, validate transforms, report all potential issues without writing)

### Output structure
- Auto-detect OpenCode config location; prompt if multiple options or not obvious
- Follow OpenCode conventions for file layout (adapt to OpenCode's expected organization)
- Create manifest file: `.gsdo-manifest.json` with source→output mappings, timestamps
- Match OpenCode's expected format for output configs (JSON, YAML, TOML, etc.)

### Claude's Discretion
- Exact intermediate representation schema
- Specific rollback implementation strategy
- Manifest file structure details
- How to detect OpenCode config location

</decisions>

<specifics>
## Specific Ideas

- Transpilation should be idempotent (running twice produces identical results)
- Error messages should help users debug their own GSD files
- The intermediate representation enables future platform targets beyond OpenCode

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-transpilation*
*Context gathered: 2026-01-21*
