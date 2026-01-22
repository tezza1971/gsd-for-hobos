# GSD Open (gsdo)

> A context-migration utility for open-source AI platforms.

**GSD Open** is a cross-platform context transporter. It takes the
high-end context engineering of
[Get Shit Done (GSD)](https://github.com/glittercowboy/get-shit-done) and
transpiles it for open-source and alternative AI platforms.

When your Claude Code token usage is high and you need to use alternative
tools, `gsdo` ensures your fallback tools have been briefed on your mission.
This is your gateway to structured context engineering across different AI
platforms.

## The Workflow

1. **GSD Detection:** Finds your GSD installation at `~/.claude/` (or asks where
   it's located). Checks freshness and offers to update if needed.
2. **Platform Detection:** Scans your system for supported platforms.
3. **Transpilation:** Parses your GSD context files into an intermediate
   representation, then transforms them into your target platform's format.
   Detects conflicts, backs up existing configs, asks before overwriting.
4. **Shortfall Report:** An analysis showing what migrated and what
   features couldn't be mapped to your target platform.
5. **LLM Enhancement (Optional):** You can run an optional LLM pass to improve
   the transpilation. Provide an OpenAI-compatible API key (used in-memory,
   then discarded) and iterate until you're satisfied. No API key? We'll provide
   guidance on running a local LLM.

## Supported Targets

| Rank | Platform        | Status       | Notes                                                |
| ---- | --------------- | ------------ | ---------------------------------------------------- |
| 1    | **OpenCode**    | **v1 (MVP)** | The open-source standard for AI coding.              |
| 2    | **Antigravity** | v2 Planned   | High capability, low cost.                           |
| 3    | **Cursor**      | v2 Planned   | Popular AI-powered code editor.                      |
| 4    | **Windsurf**    | v2 Planned   | Flow-state friendly.                                 |
| 5    | **ChatLLM**     | v2 Planned   | Fallback option.                                     |
| ?    | **VS Code**     | Researching  | Can it handle slash commands? We're looking into it. |

## Documentation

Full documentation is available in the [`docs/`](./docs/) folder:

| Guide | Description |
|-------|-------------|
| [API Keys](./docs/api-keys.md) | Environment variables for LLM enhancement |
| [CLI Reference](./docs/cli-reference.md) | All commands, flags, and exit codes |
| [LLM Enhancement](./docs/llm-enhancement.md) | Optional AI-powered refinement |
| [Transpilation](./docs/transpilation.md) | How GSD becomes OpenCode |
| [Troubleshooting](./docs/troubleshooting.md) | Common issues and solutions |

## Usage

Run via npx:

```bash
npx gsd-open
```

### Options

```
--help         Show usage information
--version      Show current version
--dry-run      Preview changes without writing anything
--quiet        Suppress output (except errors)
-v, --verbose  Verbose mode for debugging
--detect       Run detection only (skip transpilation)
--no-enhance   Skip LLM enhancement prompt
```

### Transpile Subcommand

```bash
gsdo transpile [options]

Options:
  --force       Force re-transpilation even if unchanged
  --no-backup   Skip backup (dangerous)
  --no-enhance  Skip LLM enhancement prompt
```

### Exit Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 0    | Success — transpilation complete     |
| 1    | Warnings — partial success           |
| 2+   | Errors — something went wrong        |

## LLM Enhancement

After transpilation, gsdo can optionally enhance results using an LLM. Set one of these environment variables:

| Provider | Environment Variable |
|----------|---------------------|
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` |

See [API Keys Guide](./docs/api-keys.md) for complete setup instructions.

No API key? gsdo will suggest local LLM alternatives (Ollama, LM Studio, llama.cpp).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  ALGORITHMIC PASS (always runs)                     │
│  - Quiet transpilation                              │
│  - Basic shortfall report                           │
└─────────────────────────────────────────────────────┘
                        ↓
          "Want to enhance with LLM?"
                        ↓
┌─────────────────────────────────────────────────────┐
│  LLM PASS (optional)                                │
│  - Reviews algorithmic attempt                      │
│  - Interactive refinement loop                      │
│  - Richer final report                              │
└─────────────────────────────────────────────────────┘
```

## Development Status

This project is under active development. See `.planning/ROADMAP.md` for the
current status and phase breakdown.

**Current phase:** Phase 5 - LLM Enhancement (final phase)
**Requirements:** 28 total across 5 phases
**Progress:** Phases 1-4 complete, Phase 5 in verification

## License

MIT

## Contribute

If you find a bug or have a feature request, please open an issue or submit a
pull request.

## Acknowledgments

- [Get Shit Done (GSD)](https://github.com/glittercowboy/get-shit-done) — The OG
- [OpenCode](https://opencode.ai/) — v1 target platform
