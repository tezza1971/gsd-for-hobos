# gsd-open (gsdo)

## What This Is

A Node.js CLI tool (`npx gsd-open`) that transpiles GSD context engineering from Claude Code into open-source and alternative AI platforms. Built for developers who need flexibility beyond Claude Code — either rate-limited and needing a fallback, or wanting to use structured context engineering on free and open-source alternatives.

## Core Value

Frictionless fallback that just works when you hit the wall. Run one command, get set up on OpenCode (and later, other platforms) with your GSD context — no decisions, no friction, honest expectations.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Display notice/disclaimer screen at launch
- [ ] Detect GSD installation at `~/.claude/`, prompt for location if not found
- [ ] Check GSD freshness and offer to update/install if needed
- [ ] Detect OpenCode installation on user's system
- [ ] Transpile GSD context files to OpenCode configuration format
- [ ] Generate algorithmic shortfall report (which GSD commands aren't portable)
- [ ] Offer optional LLM enhancement pass with OpenAI-compatible API key
- [ ] LLM pass: review algorithmic attempt, improve transpilation, interactive loop
- [ ] If no API key: tip user to run local LLM and exit gracefully
- [ ] Output final report to console
- [ ] Offer to save markdown version of report locally
- [ ] Quiet execution (no prompts during transpilation work)
- [ ] Professional and straightforward tone throughout

### Out of Scope

- Cursor support — deferred to v2
- Windsurf support — deferred to v2
- Antigravity support — deferred to v2
- ChatLLM support — deferred to v2
- VS Code support — experimental/research needed, deferred
- Perfect feature parity — this is "best effort," not a replacement
- Storing API keys — used in-memory only, then discarded
- Automated GSD updates without user consent — always ask first

## Context

**Reference project:** [get-shit-done](https://github.com/glittercowboy/get-shit-done) by glittercowboy — the OG GSD context engineering system for Claude Code. This tool exists to extend GSD's reach to developers who can't always afford Claude Code's rate limits or subscription.

**Target users:**
1. **Rate-limited users** — Has Claude Code, uses GSD, but needs a fallback when hitting usage limits.
2. **Open-source users** — Prefers free and open-source alternatives. Wants to use structured context engineering without proprietary platforms.

**GSD location:** Standard install is `~/.claude/`. Tool defaults there, asks user if not found.

**Two-pass architecture:**
1. **Algorithmic pass** (always runs) — Quiet transpilation, basic shortfall report
2. **LLM pass** (optional) — User provides OpenAI-compatible API key, interactive refinement loop, richer final report

**Tone:** Professional, utilitarian, straightforward. The notice disclaimer provides expectation management about "best effort" transpilation.

## Constraints

- **Tech stack**: Node.js, minimal dependencies (fs/promises, path, child_process built-ins), inquirer/prompts for CLI interaction
- **Distribution**: npx-executable (package.json with `bin` field)
- **MVP platform**: OpenCode only — other platforms are future scope
- **No secrets stored**: API keys used in-memory, never persisted
- **Respect for GSD**: Disclaimer acknowledges original author, sets expectations about "best effort" nature

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| OpenCode as sole MVP target | Focus beats sprawl. Nail one platform before expanding. | — Pending |
| Two-pass (algorithmic + LLM) | Algorithmic gives baseline for free, LLM enhances for those who have API access | — Pending |
| Notice disclaimer stays | Expectation management + courtesy to OG GSD author | — Pending |
| API keys in-memory only | Privacy/security for users, no persistence of secrets | — Pending |
| Local LLM tip as fallback | Users without API keys can still get enhanced reports using local LLMs | — Pending |

---
*Last updated: 2025-01-21 after initialization*
