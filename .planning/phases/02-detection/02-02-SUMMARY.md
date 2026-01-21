---
phase: 02-detection
plan: 02
subsystem: detection
tags: [opencode, path-detection, cross-platform]
dependency-graph:
  requires: [01-foundation]
  provides: [opencode-detection]
  affects: [02-03-orchestration, 03-transpilation]
tech-stack:
  added: []
  patterns: [filesystem-based-path-detection, no-shell-spawn]
key-files:
  created:
    - src/lib/detection/opencode-detector.ts
  modified: []
decisions:
  - id: 02-02-01
    decision: Use filesystem checks instead of shell spawn (where/which)
    rationale: Faster, more reliable error handling, no process spawn overhead
  - id: 02-02-02
    decision: Use PATHEXT env var on Windows with fallback defaults
    rationale: Respects user's executable extension configuration, covers .exe/.bat/.cmd
  - id: 02-02-03
    decision: Return null for not found instead of throwing exceptions
    rationale: Allows graceful handling upstream, matches gsd-detector pattern
metrics:
  duration: 3 min
  completed: 2026-01-21
---

# Phase 02 Plan 02: OpenCode PATH Detector Summary

**One-liner:** Cross-platform OpenCode PATH detection using filesystem checks with Windows PATHEXT support

## What Was Built

Created `opencode-detector.ts` module that searches system PATH for the `opencode` command with full cross-platform support.

### Core Functions

1. **`findCommandInPath(cmd: string): string | null`**
   - Splits PATH by `path.delimiter` (`;` on Windows, `:` on Unix)
   - On Windows: checks PATHEXT env var for extensions (defaults to `.exe`, `.bat`, `.cmd`)
   - On Unix: checks command without extension
   - Returns full path on first match, null if not found
   - Handles empty PATH, missing PATH env, inaccessible directories

2. **`detectOpenCode(): OpenCodeDetectionResult`**
   - Calls `findCommandInPath('opencode')`
   - Returns `{ found: true, path }` on success
   - Returns `{ found: false, reason }` on failure

### Key Design Choices

- **No shell spawn:** Uses filesystem checks instead of `where`/`which` commands (faster, more reliable)
- **Graceful failures:** Returns null for not found (no exceptions)
- **Verifies files:** Checks that found path is actually a file, not a directory
- **Skips empty entries:** Handles malformed PATH with empty entries gracefully

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 7da4afb | feat | Create OpenCode PATH detector module |

## Files Changed

### Created
- `src/lib/detection/opencode-detector.ts` (77 lines)

### Already Existed (from prior plan)
- `src/types/index.ts` - OpenCodeDetectionResult type was pre-existing

## Verification Results

| Check | Status | Details |
|-------|--------|---------|
| Build | Pass | `npm run build` succeeds |
| Exports | Pass | `detectOpenCode`, `findCommandInPath` exported |
| Type safety | Pass | Uses `OpenCodeDetectionResult` from types |
| Cross-platform | Pass | Uses `path.delimiter` and `PATHEXT` |
| Min lines | Pass | 77 lines (>60 required) |

## Deviations from Plan

### Task 2 Already Complete

The `OpenCodeDetectionResult` type already existed in `src/types/index.ts` from a prior plan. No modification was needed, and no commit was created for Task 2.

This is not a deviation - the task's done criteria was satisfied.

## Integration Points

The module is ready for integration:

```typescript
import { detectOpenCode, findCommandInPath } from './lib/detection/opencode-detector.js';

const result = detectOpenCode();
if (!result.found) {
  console.log(`OpenCode not available: ${result.reason}`);
}
```

## Next Phase Readiness

Ready for:
- **02-03:** Detection orchestration can use `detectOpenCode()` alongside `detectGSD()`
- **03-transpilation:** Can check OpenCode availability before attempting transpilation
