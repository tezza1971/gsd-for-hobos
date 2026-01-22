# Requirements: gsd-open (gsdo)

**Defined:** 2025-01-21
**Core Value:** Frictionless fallback for rate-limited Claude Code users, gateway for the stone broke

## v1 Requirements

### CLI Foundation

- [ ] **CLI-01**: Display Notice disclaimer/agreement at launch
- [ ] **CLI-02**: Support `--help` flag with usage information
- [ ] **CLI-03**: Support `--version` flag showing current version
- [ ] **CLI-04**: Return clear exit codes (0 success, 1 warnings, 2+ errors)
- [ ] **CLI-05**: Support verbose mode (`-v`) for debugging output
- [ ] **CLI-06**: Support `--dry-run` mode to preview changes without writing
- [ ] **CLI-07**: Support `--quiet` mode to suppress all output except errors

### GSD Detection

- [ ] **GSD-01**: Auto-detect GSD installation at `~/.claude/`
- [ ] **GSD-02**: Prompt user for GSD location if not found at default path
- [ ] **GSD-03**: Check GSD freshness and warn if outdated
- [ ] **GSD-04**: Offer to install GSD if not found
- [ ] **GSD-05**: Validate GSD installation completeness (required files present)

### Platform Detection

- [ ] **PLAT-01**: Auto-detect OpenCode installation on user's system
- [ ] **PLAT-02**: Warn user if OpenCode is not found

### Transpilation

- [ ] **TRANS-01**: Parse GSD context files into intermediate representation
- [ ] **TRANS-02**: Transform IR to OpenCode configuration format
- [ ] **TRANS-03**: Detect existing OpenCode configs (conflict detection)
- [ ] **TRANS-04**: Prompt user before overwriting existing configs (non-destructive default)
- [ ] **TRANS-05**: Backup existing configs before overwrite
- [ ] **TRANS-06**: Ensure idempotent operations (running twice produces same result)

### Shortfall Report

- [ ] **RPT-01**: Calculate algorithmic shortfall (which GSD commands aren't portable)
- [ ] **RPT-02**: Output shortfall report to console
- [ ] **RPT-03**: Offer to save markdown version of report locally
- [ ] **RPT-04**: Offer optional LLM enhancement pass after algorithmic report
- [ ] **RPT-05**: Interactive LLM loop ("want to try more things?") until user exits
- [ ] **RPT-06**: Accept OpenAI-compatible API key for LLM pass (memory-only, discarded after)
- [ ] **RPT-07**: Auto-detect API endpoint or prompt user if not detected
- [ ] **RPT-08**: Display local LLM fallback tip if no working API key provided

## v2 Requirements

### Multi-Platform Support

- **PLAT-03**: Detect Cursor installation
- **PLAT-04**: Detect Windsurf installation
- **PLAT-05**: Detect Antigravity installation
- **PLAT-06**: Detect ChatLLM installation
- **PLAT-07**: Detect VS Code installation (experimental)
- **TRANS-07**: Transform IR to Cursor configuration format (.cursorrules)
- **TRANS-08**: Transform IR to Windsurf configuration format
- **TRANS-09**: Transform IR to Antigravity configuration format
- **TRANS-10**: Transform IR to ChatLLM configuration format
- **TRANS-11**: Transform IR to VS Code configuration format (experimental)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Perfect feature parity | This is "best effort" — some GSD features won't translate |
| Storing API keys | Security risk; used in-memory only, then discarded |
| Auto-updating GSD without consent | Always ask user first |
| Telemetry/analytics | Privacy; users don't snitch |
| Interactive wizard mode | Contradicts "frictionless" value prop |
| Auto-installing target platforms | User responsibility; we detect, not install |
| GUI/web interface | CLI only; users travel light |

 ## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 1 | Complete |
| CLI-02 | Phase 1 | Complete |
| CLI-03 | Phase 1 | Complete |
| CLI-04 | Phase 1 | Complete |
| CLI-05 | Phase 1 | Complete |
| CLI-06 | Phase 1 | Complete |
| CLI-07 | Phase 1 | Complete |
| GSD-01 | Phase 2 | Complete |
| GSD-02 | Phase 2 | Complete |
| GSD-03 | Phase 2 | Complete |
| GSD-04 | Phase 2 | Complete |
| GSD-05 | Phase 2 | Complete |
| PLAT-01 | Phase 2 | Complete |
| PLAT-02 | Phase 2 | Complete |
| TRANS-01 | Phase 3 | Complete |
| TRANS-02 | Phase 3 | Complete |
| TRANS-03 | Phase 3 | Complete |
| TRANS-04 | Phase 3 | Complete |
| TRANS-05 | Phase 3 | Complete |
| TRANS-06 | Phase 3 | Complete |
| RPT-01 | Phase 4 | Complete |
| RPT-02 | Phase 4 | Complete |
| RPT-03 | Phase 4 | Complete |
| RPT-04 | Phase 5 | Pending |
| RPT-05 | Phase 5 | Pending |
| RPT-06 | Phase 5 | Pending |
| RPT-07 | Phase 5 | Pending |
| RPT-08 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2025-01-21*
*Last updated: 2025-01-21 after initial definition*
