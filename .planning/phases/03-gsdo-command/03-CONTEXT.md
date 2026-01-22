# Phase 3: /gsdo Command - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Install an LLM enhancement command (`/gsdo`) in OpenCode that autonomously analyzes and improves transpiled GSD commands using cached documentation and installation logs. The command reads install.log and cached docs, uses OpenCode's configured LLM to enhance `/gsd-*` commands, and operates without user input.

New capabilities (like rollback, validation, or testing) belong in separate phases.

</domain>

<decisions>
## Implementation Decisions

### Command invocation & output
- **Output style:** Detailed per-command report showing what changed for each command (e.g., "gsd-progress: fixed prompt template, added 2 parameters")
- **Execution model:** Both auto-run and manual
  - Installer automatically runs /gsdo after transpilation
  - User can manually re-run /gsdo later in OpenCode to re-enhance commands
- **Change preview:** No preview \u2014 apply enhancements immediately (fully autonomous, no user blocking)
- **Exit codes:** Always exit 0 on success, regardless of whether changes were made

### LLM interaction design
- **Context included in prompt:**
  - Current commands.json content (all /gsd-* commands)
  - Install.log transpilation details (warnings, partial failures)
  - Cached OpenCode docs (schema, examples, best practices)
  - Original GSD workflow markdown (what each command does)
  - Location of user's Claude GSD folder (profile directory path)
- **Prompt structure:** Per-command prompts \u2014 separate LLM call for each command (focused analysis, better quality)
- **Model choice:** Use OpenCode's configured model (respect user's settings)
- **LLM failure handling:** Retry once with refined prompt, then skip if still fails (partial success acceptable)

### Enhancement scope & safety
- **Allowed enhancements:**
  - Fix command naming issues
  - Fix broken references
  - Add missing parameters
  - Improve prompt templates
- **Destructive edits:** Only modify existing commands \u2014 NEVER remove, merge, or restructure commands
- **Enhancement philosophy:** Conservative \u2014 fix only clear issues (broken refs, invalid syntax, missing required fields)
- **GSD-specific references:** Replace with OpenCode equivalents where possible (e.g., GSD STATE.md \u2192 OpenCode session context)
- **Question migration:** Rewrite GSD's AskUserQuestion patterns as OpenCode-native (not just syntax translation \u2014 rethink flow to match OpenCode's capabilities)

### Error handling & recovery
- **Missing cache:** Try to download fresh docs on-the-fly, then proceed with enhancement
- **Missing install.log:** Continue with partial context (use commands.json and GSD source)
- **Write failure:** Retry with backoff (multiple attempts with delays for transient issues)
- **Backup strategy:** Timestamped backups before modification (e.g., commands.json.2026-01-22T10-30-00.backup)

### Claude's Discretion
- Exact format of per-command output reports
- Number of retry attempts and backoff timing
- How to detect and translate GSD patterns to OpenCode equivalents
- Fallback behavior when OpenCode equivalents don't exist

</decisions>

<specifics>
## Specific Ideas

- GSD uses a questioning system (like we just used) to gather user input \u2014 /gsdo must intelligently migrate these quiz routines to work with OpenCode's questioning mechanism
- The enhancement should feel like "it just works" \u2014 autonomous, confident, minimal friction
- Per-command enhancement allows focused, high-quality improvements rather than batch processing

</specifics>

<deferred>
## Deferred Ideas

None \u2014 discussion stayed within phase scope

</deferred>

---

*Phase: 03-gsdo-command*
*Context gathered: 2026-01-22*
