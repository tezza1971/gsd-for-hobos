# Roadmap: gsd-open (gsdo)

## Overview

Transform GSD context engineering from Claude Code into OpenCode format through a CLI that any user can run. The journey goes from bare CLI skeleton to full transpilation with optional LLM enhancement, each phase delivering a coherent, testable capability. Five phases, 28 requirements, one frictionless fallback for the rate-limited and stone broke.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - CLI skeleton with Notice and standard flags
- [x] **Phase 2: Detection** - Find GSD and OpenCode installations, validate completeness
- [x] **Phase 3: Transpilation** - Parse GSD, transform to OpenCode, handle conflicts
- [x] **Phase 4: Reports** - Console output with shortfall analysis, markdown export
- [ ] **Phase 5: LLM Enhancement** - Optional API-powered refinement loop

## Phase Details

### Phase 1: Foundation
**Goal**: User can run `npx gsd-open` and interact with a functional CLI
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07
**Success Criteria** (what must be TRUE):
  1. User sees Notice disclaimer and can accept/decline at launch
  2. User can run `--help` and see usage information with all available flags
  3. User can run `--version` and see current version number
  4. User can run with `--dry-run` and see what would happen without changes
  5. CLI exits with appropriate codes (0 success, 1 warnings, 2+ errors)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Project setup with TypeScript toolchain and core CLI skeleton
- [x] 01-02-PLAN.md — Notice consent flow and end-to-end verification

### Phase 2: Detection
**Goal**: User knows if their GSD and OpenCode installations are ready for transpilation
**Depends on**: Phase 1
**Requirements**: GSD-01, GSD-02, GSD-03, GSD-04, GSD-05, PLAT-01, PLAT-02
**Success Criteria** (what must be TRUE):
  1. User with GSD at `~/.claude/` sees it auto-detected without prompts
  2. User without GSD at default path gets prompted for location
  3. User with outdated GSD sees freshness warning with option to update
  4. User sees clear message if OpenCode is not found on system
  5. User with incomplete GSD installation sees validation errors listing missing files
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — GSD detection module (auto-detect, validate, freshness)
- [x] 02-02-PLAN.md — OpenCode detection module (PATH search, cross-platform)
- [x] 02-03-PLAN.md — Detection orchestration and visual reporting
- [x] 02-04-PLAN.md — Gap closure: stale GSD interactive update handler

### Phase 3: Transpilation
**Goal**: GSD context files are transformed into valid OpenCode configuration
**Depends on**: Phase 2
**Requirements**: TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05, TRANS-06
**Success Criteria** (what must be TRUE):
  1. User's GSD files are parsed into intermediate representation without data loss
  2. User's OpenCode config directory contains transformed configuration files
  3. User sees backup location announcement when existing configs are overwritten
  4. User's existing configs are backed up automatically before any overwrite
  5. Running transpilation twice produces identical results (idempotent)
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — GSD parser with IR and comprehensive error handling
- [x] 03-02-PLAN.md — Config-driven transformer with gap tracking and user overrides
- [x] 03-03-PLAN.md — Backup manager, idempotency, and CLI integration

### Phase 4: Reports
**Goal**: User understands what transpiled successfully and what fell short
**Depends on**: Phase 3
**Requirements**: RPT-01, RPT-02, RPT-03
**Success Criteria** (what must be TRUE):
  1. User sees console report showing which GSD commands were/weren't portable
  2. User sees shortfall analysis with specific feature gaps listed
  3. User can save markdown version of report to local file
**Plans**: 4 plans in 2 waves

Plans:
- [x] 04-01-PLAN.md — Enhance gap tracking with source files, categories, suggestions
- [x] 04-02-PLAN.md — Build console reporter with sections, shortfalls, summary
- [x] 04-03-PLAN.md — Add markdown export and integrate into transpile command
- [x] 04-04-PLAN.md — Gap closure: wire orchestrator return with artifact metadata

### Phase 5: LLM Enhancement
**Goal**: Users with API access can improve transpilation quality through LLM refinement
**Depends on**: Phase 4
**Requirements**: RPT-04, RPT-05, RPT-06, RPT-07, RPT-08
**Success Criteria** (what must be TRUE):
  1. User is offered LLM enhancement pass after algorithmic report completes
  2. User can provide OpenAI-compatible API key (used in-memory only)
  3. User can iterate with LLM ("want to try more things?") until satisfied
  4. User without API key sees helpful tip about running local LLM
  5. User's API endpoint is auto-detected or prompted if not found
**Plans**: 3 plans in 3 waves

Plans:
- [ ] 05-01-PLAN.md — API configuration with multi-provider detection and endpoint testing
- [ ] 05-02-PLAN.md — LLM enhancement core (docs cache, LLM calls, orchestration)
- [ ] 05-03-PLAN.md — Command integration with fallback messaging and E2E verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | 2026-01-21 |
| 2. Detection | 4/4 | Complete | 2026-01-22 |
| 3. Transpilation | 3/3 | Complete | 2026-01-22 |
| 4. Reports | 4/4 | Complete | 2026-01-22 |
| 5. LLM Enhancement | 0/3 | Not started | - |

---
*Roadmap created: 2025-01-21*
*Depth: quick (5 phases)*
*Coverage: 28/28 v1 requirements mapped*
