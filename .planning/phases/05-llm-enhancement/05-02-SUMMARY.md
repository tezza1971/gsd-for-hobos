---
phase: 05-llm-enhancement
plan: 02
subsystem: llm
tags: [openai, anthropic, caching, validation, enhancement, conversation-history]

# Dependency graph
requires:
  - phase: 05-01
    provides: API configuration detection and testing
provides:
  - GitHub docs caching with TTL for OpenCode schema
  - JSON schema validation for LLM-generated rules
  - LLM enhancement orchestrator with conversation history
  - Interactive refinement loop with validation and retry
affects: [05-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - File-based TTL cache with mtime checking
    - Manual schema validation (no external validator)
    - Conversation history accumulation for iterative refinement
    - Markdown JSON extraction for LLM response parsing

key-files:
  created:
    - src/lib/llm/cache-manager.ts
    - src/lib/llm/schema-validator.ts
    - src/lib/llm/llm-enhancer.ts
  modified: []

key-decisions:
  - "24-hour TTL for OpenCode docs cache (86400 seconds default)"
  - "Manual schema validation instead of zod/ajv for MVP simplicity"
  - "File-based cache using mtime for TTL checks"
  - "Conversation history persists across refinement iterations"
  - "Validation errors fed back to LLM for self-correction"
  - "Simple append merge strategy for llm-rules.json (MVP approach)"

patterns-established:
  - "TTL cache pattern: stat().mtimeMs for age calculation, unlink on expiry"
  - "LLM retry pattern: validation failures added to conversation for correction"
  - "Markdown JSON extraction: try raw JSON first, then ```json blocks, then pattern match"
  - "Interactive loop: gather request → call LLM → validate → apply → confirm continue"

# Metrics
duration: 3min
completed: 2026-01-22
---

# Phase 5 Plan 2: LLM Enhancement Core Summary

**TTL-cached OpenCode docs, validated LLM conversation orchestrator with iterative refinement and automatic retry on validation failures**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-22T05:39:41Z
- **Completed:** 2026-01-22T05:42:32Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- DocsCacheManager fetches OpenCode schema once per 24 hours from GitHub
- Schema validator catches malformed LLM output before applying rules
- LLMEnhancer orchestrates full enhancement loop with conversation history
- Validation errors automatically fed back to LLM for correction
- Rules merged into llm-rules.json with deterministic sorting

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GitHub docs cache manager with TTL** - `1e040e5` (feat)
2. **Task 2: Create schema validator for LLM-generated rules** - `848d4ac` (feat)
3. **Task 3: Build LLM enhancement orchestrator with conversation history** - `2ca941c` (feat)

## Files Created/Modified

- `src/lib/llm/cache-manager.ts` - TTL-based GitHub docs cache with fetchOpenCodeDocs()
- `src/lib/llm/schema-validator.ts` - Manual validation for TransformRule structure
- `src/lib/llm/llm-enhancer.ts` - Full enhancement orchestrator with conversation loop

## Decisions Made

**24-hour cache TTL:** Default 86400 seconds balances freshness with GitHub rate limits. OpenCode schema changes infrequently, daily refresh is appropriate.

**Manual schema validation:** Avoided zod/ajv dependencies for MVP. Custom validation provides clear error messages and keeps bundle size small.

**File-based cache strategy:** Using filesystem mtime for TTL checks is simple and portable. No external cache dependencies required.

**Conversation history accumulation:** Full history preserved across iterations enables LLM to learn from validation failures and user feedback. Critical for iterative refinement quality.

**Validation retry pattern:** Instead of failing on malformed output, validation errors are added to conversation history so LLM can self-correct. Improves success rate without user intervention.

**Simple merge strategy:** For MVP, new rules simply append to existing rules array. Future enhancement could implement deduplication or conflict resolution.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without blockers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 05-03 (CLI Integration):**
- Cache manager ready to provide OpenCode docs on demand
- Schema validator ready to protect against malformed LLM output
- LLM enhancer ready for CLI orchestrator integration
- Conversation history pattern established for multi-turn refinement

**Implementation notes:**
- LLMEnhancer expects opencodeConfigDir parameter for llm-rules.json location
- Cache directory defaults to ~/.cache/docs-opencode (should be gitignored)
- Validation errors are descriptive and user-friendly
- All modules use established ESM import patterns (.js extensions)

---
*Phase: 05-llm-enhancement*
*Completed: 2026-01-22*
