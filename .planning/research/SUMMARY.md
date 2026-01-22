# Research Summary

**Project:** gsd-open (gsdo)
**Domain:** CLI config transpilation tool
**Researched:** 2026-01-21
**Confidence:** MEDIUM-HIGH

## Stack Decision

**Node.js ESM with minimal dependencies:** Commander.js for CLI, @clack/prompts for UX, picocolors for terminal styling, native fetch for API calls. Only 3 production dependencies. Built-in fs/promises, path, os for file operations.

## Table Stakes Features

- Auto-detection of GSD source configs at `~/.claude/`
- Auto-detection of OpenCode installation
- Dry-run mode with preview of changes
- Non-destructive by default (warn before overwriting)
- Quiet execution during transpilation work
- Clear exit codes (0 success, 1 warnings, 2+ errors)
- Actionable error messages with suggested fixes
- Completion summary report to console
- Idempotent operations (running twice = same result)
- Verbose mode for debugging (`-v`, `-vv`)

## Key Architecture Decisions

- **Adapter pattern for platforms:** Core transpiler is platform-agnostic; each target (OpenCode, future Cursor) gets its own adapter implementing a common interface
- **Intermediate representation (IR):** Parse GSD into IR first, then transform to target format. Enables multi-platform without rewriting parser.
- **Pipeline architecture:** Sequential stages (detect -> parse -> shortfall -> transpile -> report), with optional LLM enhancement stage
- **Two-pass design:** Algorithmic baseline (works for everyone) + optional LLM enhancement (for users with API keys)
- **Graceful degradation:** Each phase handles errors independently; partial results still generate useful reports

## Watch Out For

1. **Cross-platform path handling** — Use `path.join()` and `os.homedir()` everywhere. Never hardcode `/` or `~`. Establish patterns in Phase 1.

2. **Slash command format incompatibility** — Claude Code and OpenCode have different frontmatter schemas, argument syntax, and file reference mechanisms. Build explicit mapping table; validate output against target schema.

3. **API key exposure** — Never log objects that might contain keys. Use environment variables only, memory-only storage. Pattern: sanitize all log output.

4. **Partial install detection** — Check multiple paths, distinguish "not found" from "permission denied," verify installation completeness not just existence.

5. **Config parsing failures** — Always try/catch parsing, validate against expected schema, provide helpful error messages with fix suggestions.

## Build Order Recommendation

### Phase 1: Foundation
**Delivers:** Project scaffolding, CLI skeleton, Notice display
**Rationale:** Everything depends on basic structure. Establish cross-platform path utilities and encoding patterns from day one.
**Uses:** Commander.js, @clack/prompts, picocolors, fs/promises, path, os

### Phase 2: GSD Detection and Parsing
**Delivers:** Find GSD files, parse into intermediate representation, freshness check
**Rationale:** Cannot transpile without reading source. Parser defines IR used by all downstream components.
**Addresses:** Auto-detection, validation, actionable errors
**Avoids:** Partial install detection failures, config parsing bombs

### Phase 3: Transpilation Engine
**Delivers:** Core transpilation logic, OpenCode adapter, shortfall calculation
**Rationale:** This is the core value. Build adapter interface before implementation so the contract is clear.
**Implements:** Adapter pattern, IR -> OpenCode transformation
**Avoids:** Slash command incompatibility, schema drift

### Phase 4: Reports and Output
**Delivers:** Console report with user theme, markdown export, exit codes
**Rationale:** Need transpilation working before reporting on it. Console reporter enables faster feedback during development.
**Addresses:** Completion summary, shortfall report, markdown export

### Phase 5: LLM Enhancement (Optional)
**Delivers:** Optional LLM pass for improving transpilation quality
**Rationale:** Explicitly optional, can be added after MVP core works. Uses native fetch for OpenAI-compatible APIs.
**Avoids:** API key exposure, tight coupling to provider

### Phase Ordering Rationale

1. **Foundation first** — Cross-platform utilities, async patterns, and encoding conventions must be established before any file operations
2. **Detection before transpilation** — Can't transform what you can't read; parser defines data contract
3. **Adapter interface early** — Even with only OpenCode, defining the interface prevents rewrite when adding platforms
4. **Reports after transpilation** — Reports consume transpilation results
5. **LLM optional and last** — Core value is algorithmic transpilation; LLM is enhancement, not requirement

## Open Questions

1. **OpenCode config format specifics** — Need to verify exact file locations, format (YAML/JSON), and schema during Phase 3. Requires testing with actual OpenCode installation.

2. **GSD file structure** — Need to inspect actual `~/.claude/` contents to finalize parser. Commands directory structure, settings.json schema.

3. **Slash command mapping completeness** — Which Claude Code features have no OpenCode equivalent? Need testing to validate shortfall list.

4. **Windows-specific detection** — OpenCode install path on Windows unclear. May need `where opencode` plus config directory checks.

5. **LLM prompt design** — What prompts work best for the enhancement pass? Needs experimentation during Phase 5.

---

## Research Flags

**Needs deeper research during planning:**
- Phase 3 (Transpilation): OpenCode config format research required
- Phase 5 (LLM Enhancement): Prompt engineering for quality enhancement

**Standard patterns (skip research-phase):**
- Phase 1 (Foundation): Well-documented Commander.js, fs/promises patterns
- Phase 2 (Detection): Standard file system operations
- Phase 4 (Reports): Standard terminal output and file writing

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified current (2025), mature with large communities |
| Features | MEDIUM | Cross-verified patterns from multiple CLI design sources |
| Architecture | MEDIUM | Patterns synthesized from multiple sources, not copied from identical tools |
| Pitfalls | MEDIUM-HIGH | Verified with official docs and multiple credible sources |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **OpenCode specifics:** Config location, format, and capabilities need verification with actual installation
- **GSD structure:** Need to inspect live `~/.claude/` directory to finalize parser
- **Cross-platform testing:** Windows path handling and detection logic needs real Windows testing
- **LLM enhancement prompts:** No clear pattern; requires experimentation

## Sources

### Primary (HIGH confidence)
- [Commander.js GitHub](https://github.com/tj/commander.js) — CLI framework patterns
- [OpenAI: Best Practices for API Key Safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety) — Security patterns
- [Node.js Documentation](https://nodejs.org/api/) — Built-in APIs
- [clig.dev](https://clig.dev/) — CLI design guidelines

### Secondary (MEDIUM confidence)
- [Semgrep: Cross-Platform Tools](https://semgrep.dev/blog/2025/five-considerations-when-building-cross-platform-tools-for-windows-and-macos/) — Path handling
- [@clack/prompts npm](https://www.npmjs.com/package/@clack/prompts) — Interactive prompts
- [Tao of Node](https://alexkondov.com/tao-of-node/) — Architecture patterns

### Tertiary (LOW confidence)
- OpenCode config format — Needs validation with actual installation
- GSD file structure — Needs inspection of live installation

---
*Research completed: 2026-01-21*
*Ready for roadmap: yes*
