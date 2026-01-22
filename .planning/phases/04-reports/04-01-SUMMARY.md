---
phase: "04-reports"
plan: "01"
subsystem: "transpilation"
tags: ["gap-tracking", "reporting", "types"]
dependency-graph:
  requires: ["03-01", "03-02"]
  provides: ["enhanced-gap-tracking", "gap-categorization", "actionable-suggestions"]
  affects: ["04-02", "04-03"]
tech-stack:
  added: []
  patterns: ["enhanced-type-definitions", "config-driven-metadata"]
key-files:
  created: []
  modified:
    - "src/types/index.ts"
    - "src/lib/transpilation/transformer.ts"
    - "src/lib/transpilation/transform-rules.json"
    - "src/lib/transpilation/orchestrator.ts"
    - "src/lib/transpilation/transformer.test.ts"
decisions:
  - id: "04-01-01"
    type: "type-design"
    choice: "Object-based unmappedFields array"
    rationale: "Breaking change from string[] to UnmappedField[] enables rich reporting data"
  - id: "04-01-02"
    type: "categorization"
    choice: "Three gap categories"
    rationale: "unsupported (red), platform (yellow), missing-dependency (blue) provide clear severity indication"
  - id: "04-01-03"
    type: "metadata-location"
    choice: "Categories and suggestions in transform-rules.json"
    rationale: "Config-driven approach allows user customization via ~/.gfh/transforms.json"
metrics:
  duration: "14 min"
  completed: "2026-01-22"
---

# Phase 04 Plan 01: Enhanced Gap Tracking Summary

Enhanced gap tracking to include source attribution, categorization, and actionable suggestions for reporting.

## One-liner

Breaking change to TransformGaps: unmappedFields now object array with field, value, reason, sourceFile, category, suggestion; approximations add sourceFile and category.

## What Was Built

### 1. Enhanced TransformGaps Type (src/types/index.ts)

**New types added:**
- `GapCategory` = 'unsupported' | 'platform' | 'missing-dependency'
- `UnmappedField` interface with 6 fields
- `ApproximationEntry` interface with 5 fields

**Breaking change:** `TransformGaps.unmappedFields` changed from `string[]` to `UnmappedField[]`

```typescript
export interface UnmappedField {
  field: string;
  value: unknown;
  reason: string;
  sourceFile: string;
  category: GapCategory;
  suggestion: string;
}
```

### 2. Transform Rules Metadata (src/lib/transpilation/transform-rules.json)

Added `categories` and `suggestions` objects to each section:

```json
"agents": {
  "categories": {
    "tools": "platform",
    "config": "platform"
  },
  "suggestions": {
    "tools": "OpenCode uses tool registration. Register tools via OpenCode tool API.",
    "config": "OpenCode uses native config. Migrate settings to OpenCode's agent config format."
  }
}
```

Added fallback for unmapped fields:
```json
"fallback": {
  "category": "unsupported",
  "suggestion": "This GSD feature has no direct OpenCode equivalent. Review GSD documentation for alternatives."
}
```

### 3. Transformer Gap Population (src/lib/transpilation/transformer.ts)

- Added `getCategory()` and `getSuggestion()` helper functions
- Extended `SectionRules` interface with categories and suggestions
- Extended `TransformRules` interface with fallback
- All transform functions now populate:
  - `sourceFile` (e.g., 'agents.xml', 'commands.xml', 'models.xml', 'config.xml')
  - `category` (from rules or fallback)
  - `suggestion` (for unmapped fields only)

### 4. Orchestrator Gap Reporting (src/lib/transpilation/orchestrator.ts)

Updated both dry-run and final gap reporting to use new object structure:

```typescript
for (const gap of gaps.unmappedFields) {
  log.warn(`  - Unmapped: ${gap.field} (${gap.category})`);
  log.warn(`    Suggestion: ${gap.suggestion}`);
}
for (const approx of gaps.approximations) {
  log.warn(`  - Approximated: ${approx.original} -> ${approx.approximatedAs} (${approx.category})`);
}
```

## Example Gap Objects

**Unmapped field:**
```json
{
  "field": "config.permissions",
  "value": {"fileAccess": true, "networkAccess": false},
  "reason": "GSD permissions not supported by OpenCode",
  "sourceFile": "config.xml",
  "category": "unsupported",
  "suggestion": "OpenCode does not support GSD permissions. Configure security at the system level."
}
```

**Approximation:**
```json
{
  "original": "agent.myAgent.tools",
  "approximatedAs": "tools array",
  "reason": "Mapped to OpenCode tools array if available",
  "sourceFile": "agents.xml",
  "category": "platform"
}
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 77aa4f7 | feat | Enhance TransformGaps type with reporting fields |
| a7a17bd | feat | Add category and suggestion metadata to transform rules |
| 7f1d11a | feat | Update transformer to populate enhanced gap fields |
| 48f62db | feat | Update orchestrator gap reporting for new object structure |

## Verification Results

- [x] TypeScript compilation succeeds with enhanced types
- [x] transform-rules.json includes categories and suggestions (8 occurrences)
- [x] Transformer creates gap objects with all required fields
- [x] Orchestrator gap reporting works with new object structure
- [x] Tests verify gap tracking includes sourceFile, category, suggestion
- [x] No compilation errors in affected files
- [x] All 36 tests pass

## File Line Counts

| File | Lines | Min Required |
|------|-------|--------------|
| src/types/index.ts | 291 | 250 |
| src/lib/transpilation/transformer.ts | 387 | 100 |
| src/lib/transpilation/transform-rules.json | 101 | 60 |
| src/lib/transpilation/orchestrator.ts | 286 | 285 |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 04-02 (Report Builder) which will:
- Consume enhanced TransformGaps structure
- Build detailed shortfall reports with categorization
- Generate actionable reports showing users what couldn't map and why
