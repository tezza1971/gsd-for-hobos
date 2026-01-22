# Features Research: CLI Config Migration/Transpilation Tools

**Domain:** CLI tools that migrate/transpile configuration between AI coding assistant platforms
**Researched:** 2026-01-21
**Confidence:** MEDIUM (cross-verified patterns from multiple CLI design sources)

## Executive Summary

CLI config migration tools must balance "just works" immediacy with enough transparency to build trust. The best tools follow a pattern: detect everything automatically, show what will change, execute quietly, then report comprehensively. For gsdo specifically, the "user" audience adds unique constraints: users are frustrated (rate-limited) or skeptical (free tier users wondering "what's the catch?"). Features must earn trust fast.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Auto-detection of source configs** | Users shouldn't need to know where GSD lives. Find it or fail gracefully with helpful message. | Low | Default `~/.claude/`, prompt if not found. ESLint migrators, Biome all auto-detect. |
| **Dry-run / Preview mode** | Users need to see what will change before it happens. "Being able to see the output before it happens for real is helpful." ([Nick Janetakis](https://nickjanetakis.com/blog/cli-tools-that-support-previews-dry-runs-or-non-destructive-actions)) | Medium | `--dry-run` flag showing diff of what would be created/modified. Critical for trust. |
| **Non-destructive by default** | Never overwrite existing configs without explicit consent. Users fear losing their customizations. | Low | Check for existing files, warn before overwriting, offer backup. |
| **Clear exit codes** | Scripts/automation need to know if it worked. "Exit with nonzero status codes if and only if the program terminated with errors." ([clig.dev](https://clig.dev/)) | Low | 0 = success, 1 = partial success with warnings, 2+ = failure modes. |
| **Error messages with actionable fixes** | Users need to know what went wrong AND how to fix it. "Tell users exactly what went wrong and how to fix it." ([Chloe Zhou](https://medium.com/@czhoudev/error-handling-in-cli-tools-a-practical-pattern-thats-worked-for-me-6c658a9141a9)) | Medium | Not "Config invalid" but "CLAUDE.md not found at ~/.claude/. Expected location: [X]. Run with --source to specify." |
| **Silent/quiet mode execution** | Per PROJECT.md: "Quiet execution (no prompts during transpilation work)." Experienced users and scripts need non-interactive mode. | Low | No spinners/progress during work. Aligns with project requirements. |
| **Completion summary report** | Users need to know what happened. What worked, what didn't, what to expect. | Medium | Per PROJECT.md: "Rich exit report (what worked, what didn't, what to expect)." |
| **Idempotent operations** | Running the tool twice should have the same result as running once. "Idempotent scripts can be called multiple times and each time it's called, it will have the same effects on the system." ([arslan.io](https://arslan.io/2019/07/03/how-to-write-idempotent-bash-scripts/)) | Medium | If configs already exist and match, report "already up to date" not error. |
| **Verbose mode for debugging** | When things go wrong, users need visibility. "Provide a verbosity flag to control the amount of logging output." ([codyaray.com](https://codyaray.com/2020/07/cli-design-best-practices)) | Low | `-v`, `-vv`, `-vvv` levels. Errors to stderr, verbose logs to stderr. |
| **Target platform detection** | Auto-detect what platforms are installed (OpenCode, Cursor, etc.) so users don't have to specify. | Medium | Similar to how Biome detects ESLint/Prettier configs. Check common install paths. |

---

## Differentiators

Features that set gsdo apart. Not expected, but valued. These align with project identity.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Notice disclaimer** | Expectation management + brand identity. Sets the "this is best-effort, not perfect parity" tone immediately. Per PROJECT.md: required feature. | Low | Displayed at start. Combines humor with genuine expectation setting. |
| **Algorithmic shortfall report** | Honest reporting of what couldn't be transpiled and why. Most migration tools hide failures. gsdo embraces them with professional humor. | Medium | "Features too high-society for your fallback tools to handle." Trust through honesty. |
| **Optional LLM enhancement pass** | Two-tier architecture: algorithmic baseline (free), LLM enhancement (if user has API key). Lets stone-broke users get value while API-having users get more. | High | Per PROJECT.md: "Offer optional LLM enhancement pass with OpenAI-compatible API key." |
| **Local LLM fallback tip** | When user has no API key, suggest local LLM options instead of dead-ending. Respects the "user" audience. | Low | "No API key? Consider running Ollama locally for the enhanced pass." |
| **Themed tone throughout** | Satirical, utilitarian, user metaphors. "Scavenging for configs," "boarding the freight train." Creates memorable experience. | Low | Per PROJECT.md: "Satirical professional tone throughout." |
| **Markdown report export** | Save the migration report locally for reference. Useful for documenting what was done. | Low | Per PROJECT.md: "Offer to save markdown version of report locally." |
| **GSD freshness check** | Ensure user isn't migrating stale GSD configs. Offer to update before transpiling. | Medium | Per PROJECT.md: "Check GSD freshness and offer to update/install if needed." |
| **Multi-platform targeting** | Support multiple fallback platforms from single run. (Future: Cursor, Windsurf, etc.) | High | MVP is OpenCode only. But architecture should support expansion. |
| **Config validation before transpilation** | Validate source GSD configs are well-formed before attempting transpilation. Fail fast with clear message. | Medium | Prevents garbage-in-garbage-out. "Why wait for your app to tell you a file is wrong when deployed?" ([faun.pub](https://faun.pub/cli-tools-for-validating-and-linting-yaml-files-5627b66849b1)) |

---

## Anti-Features

Features to deliberately NOT build. Common mistakes in this domain that gsdo should avoid.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Interactive prompts during transpilation** | Per PROJECT.md: "Quiet execution (no prompts during transpilation work)." Breaks scriptability, annoys experienced users. | All prompts at start (manifesto, options). Work happens silently. Report at end. |
| **Storing API keys** | Per PROJECT.md: "API keys used in-memory only, never persisted." Security risk, unnecessary complexity. | Accept API key via env var or flag, use once, discard. |
| **Auto-updating GSD without consent** | Per PROJECT.md: "Automated GSD updates without user consent always ask first." Violates user trust. | Detect staleness, suggest update, require explicit yes. |
| **Claiming perfect parity** | Per PROJECT.md: "Perfect feature parity this is 'best effort,' not a replacement." Sets false expectations. | Notice + shortfall report make limitations explicit. |
| **Over-engineered progress indicators** | For a quick CLI tool, spinners and progress bars add complexity without value. | Simple status messages at start/end. Trust the "quiet execution" philosophy. |
| **Config file backups by default** | Clutters user's system with .bak files they'll never clean up. | Create backups only when overwriting existing configs, and only if user confirms. |
| **Wizard/interactive setup mode** | Adds friction for the target user who "needs a fallback NOW." | One command, sensible defaults, flags for customization. |
| **Automatic platform install** | Installing OpenCode/Cursor/etc. if not found is scope creep and potentially dangerous. | Detect, report not found, link to install instructions. Don't install. |
| **Web dashboard or GUI** | This is a CLI tool for developers. GUIs add maintenance burden without serving the audience. | CLI only. Rich terminal output for the report. |
| **Telemetry/analytics** | Hobo users are privacy-conscious. Any data collection would violate trust. | No telemetry. No phone-home. Ever. |

---

## Feature Dependencies

```
Notice (start)
        |
        v
Auto-detect GSD source -----> GSD Freshness Check (optional update)
        |                              |
        v                              v
Auto-detect target platforms <---------+
        |
        v
Config validation
        |
        v
Dry-run mode (if --dry-run) --> Show diff --> Exit
        |
        | (if not dry-run)
        v
Transpilation (silent)
        |
        +---> Algorithmic shortfall detection
        |
        v
Optional LLM pass (if API key provided)
        |       |
        |       +--> Local LLM tip (if no API key)
        |
        v
Generate completion report
        |
        v
Display report --> Offer markdown export --> Exit with code
```

**Key dependency chains:**
1. Manifesto must display before any work happens
2. Source detection must succeed before freshness check
3. Validation must pass before transpilation
4. Transpilation must complete before shortfall analysis
5. Algorithmic pass must complete before LLM pass can enhance

---

## MVP Feature Prioritization

For MVP (OpenCode only), prioritize in this order:

**Must Have (P0):**
1. Notice disclaimer
2. Auto-detect GSD source at `~/.claude/`
3. Auto-detect OpenCode installation
4. Basic transpilation (CLAUDE.md -> OpenCode format)
5. Quiet execution during work
6. Completion summary report to console
7. Clear exit codes

**Should Have (P1):**
1. Dry-run mode with diff preview
2. Non-destructive checks (warn before overwrite)
3. Algorithmic shortfall report
4. Verbose mode for debugging
5. Markdown report export option

**Nice to Have (P2):**
1. GSD freshness check
2. Optional LLM enhancement pass
3. Local LLM fallback tip
4. Config validation before transpilation

**Defer to Post-MVP:**
- Multi-platform support (Cursor, Windsurf, etc.)
- Interactive LLM refinement loop
- Any GUI or web interface

---

## Sources

**HIGH Confidence (Official docs, authoritative):**
- [Command Line Interface Guidelines](https://clig.dev/) - Comprehensive CLI design reference
- [ESLint Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide) - Example of config migration UX
- [Biome Migration from ESLint/Prettier](https://biomejs.dev/guides/migrate-eslint-prettier/) - Modern config migration patterns

**MEDIUM Confidence (Multiple credible sources agree):**
- [UX patterns for CLI tools](http://lucasfcosta.com/2022/06/01/ux-patterns-cli-tools.html) - CLI UX fundamentals
- [CLI UX best practices: progress displays](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) - When and how to show progress
- [Error Handling in CLI Tools](https://medium.com/@czhoudev/error-handling-in-cli-tools-a-practical-pattern-thats-worked-for-me-6c658a9141a9) - Error message patterns
- [Exit code best practices](https://chrisdown.name/2013/11/03/exit-code-best-practises.html) - Exit code conventions
- [CLI tools that support dry runs](https://nickjanetakis.com/blog/cli-tools-that-support-previews-dry-runs-or-non-destructive-actions) - Dry-run pattern examples
- [How to write idempotent Bash scripts](https://arslan.io/2019/07/03/how-to-write-idempotent-bash-scripts/) - Idempotency patterns

**LOW Confidence (WebSearch only, needs validation):**
- Community discussions on config validation tooling
- Comparisons of AI coding assistant migration features
