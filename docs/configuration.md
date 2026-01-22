# Configuration Guide

GSD Open is a **migration tool** that transpiles GSD configuration from Claude Code to other platforms. All GSD Open's configuration and state is stored in `~/.gsdo/` - we never pollute the target platform's configuration space with our files.

## Directory Overview

```
~/.gsdo/                           # All GSD Open configuration and state
├── transforms.json                # Custom transform rule overrides
├── llm-rules.json                 # LLM-generated enhancement rules
├── manifest.json                  # Transpilation state and metadata
├── cache/                         # Documentation caches
│   ├── docs-opencode/            # OpenCode documentation cache
│   │   └── opencode-docs.cache   # Cached schema docs (24hr TTL)
│   ├── docs-antigravity/         # Future: Antigravity docs cache
│   └── docs-cursor/               # Future: Cursor docs cache
└── backup/                        # Backups of platform configs
    └── opencode/                  # OpenCode config backups
        └── {timestamp}/           # Timestamped backup directories
            ├── agents.json        # Backed up files
            └── manifest.json      # Backup metadata

~/.config/opencode/                # OpenCode's configuration (we write here)
├── agents.json                    # Transpiled agents (OpenCode owns this)
├── commands.json                  # Transpiled commands (OpenCode owns this)
└── ...                            # Other OpenCode files
```

## Design Philosophy

**GSD Open is a migration tool, not a project tool.** It migrates GSD configuration from Claude Code to other platforms. Therefore:

1. **All our state goes in `~/.gsdo/`** - Our configuration, manifests, caches, and backups
2. **Target platform's space stays clean** - We only write the transpiled output files where the platform expects them
3. **No project-level pollution** - We don't create `.gsdo-*` files in project directories

## Configuration Files

### ~/.gsdo/transforms.json

**Purpose:** User-defined overrides for default transform rules.

**When to use:**
- You want custom field mappings across all transpilations
- You've found better default values for certain fields
- You need consistent transpilation behavior

**Structure:**

```json
{
  "version": "1.0",
  "description": "Custom transform rules",
  "agents": {
    "fieldMappings": {
      "customField": "mappedField"
    },
    "defaults": {
      "temperature": 0.8
    }
  }
}
```

**Precedence:** These rules override the built-in `transform-rules.json` that ships with GSD Open.

### ~/.gsdo/llm-rules.json

**Purpose:** LLM-generated enhancement rules from interactive refinement sessions.

**When created:** During the optional LLM enhancement pass when you provide refinement suggestions.

**Structure:**

```json
{
  "version": "1.0",
  "rules": [
    {
      "field": "agent.description",
      "category": "platform",
      "suggestion": "Infer description from system prompt"
    }
  ]
}
```

**Behavior:**
- Appends new rules each enhancement session
- Sorted by field name for deterministic output
- Separate from user-defined `transforms.json` to distinguish LLM-generated vs hand-written rules

### ~/.gsdo/manifest.json

**Purpose:** Tracks transpilation state for idempotency checking.

**Structure:**

```json
{
  "version": "1.0",
  "lastRun": {
    "timestamp": "2026-01-22T07:30:00.000Z",
    "sourceHash": "abc123...",
    "outputHash": "def456...",
    "backup": {
      "location": "~/.gsdo/backup/opencode/2026-01-22_073000",
      "timestamp": "2026-01-22T07:30:00.000Z"
    }
  },
  "mappings": [
    {
      "source": "~/.claude/get-shit-done/",
      "target": "~/.config/opencode/agents.json",
      "transformed": true
    }
  ]
}
```

**Purpose:**
- Tracks source and output hashes to skip unnecessary re-transpilation
- Records backup locations for rollback
- Enables `--force` flag to bypass idempotency checks

### ~/.gsdo/cache/docs-{platform}/

**Purpose:** Platform-specific documentation caches for LLM enhancement.

**Pattern:** `~/.gsdo/cache/docs-{platform}/`
- `docs-opencode/` - OpenCode documentation (current)
- `docs-antigravity/` - Antigravity documentation (planned)
- `docs-cursor/` - Cursor documentation (planned)

**TTL:** 24 hours (86400 seconds)

**Management:**

```bash
# Clear OpenCode docs cache
rm -rf ~/.gsdo/cache/docs-opencode/

# Clear all platform caches
rm -rf ~/.gsdo/cache/docs-*/

# Clear entire cache directory
rm -rf ~/.gsdo/cache/
```

### ~/.gsdo/backup/opencode/{timestamp}/

**Purpose:** Timestamped backups of OpenCode configuration before transpilation.

**Structure:**

```
~/.gsdo/backup/opencode/
├── 2026-01-22_073000/
│   ├── agents.json          # Backed up OpenCode file
│   ├── commands.json         # Backed up OpenCode file
│   └── manifest.json         # Backup metadata (hash, size, permissions)
└── 2026-01-22_080000/
    └── ...
```

**Backup manifest:**

```json
{
  "timestamp": "2026-01-22T07:30:00.000Z",
  "source": "~/.claude/get-shit-done/",
  "files": [
    {
      "path": "agents.json",
      "hash": "abc123...",
      "size": 2048,
      "mode": 420
    }
  ]
}
```

**Purpose:**
- Safe rollback if transpilation produces unexpected results
- Preserves file permissions for accurate restoration
- Automatic cleanup (oldest backups can be manually deleted)

## Environment Variables

GSD Open does not store API keys in configuration files. All API keys must be provided via environment variables:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API access for LLM enhancement |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Google Gemini API access |
| `ANTHROPIC_API_KEY` | Anthropic Claude API access |
| `OPENROUTER_API_KEY` | OpenRouter API access |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name |

See [API Keys Guide](./api-keys.md) for detailed setup instructions.

## Configuration Precedence

When resolving configuration, gsdo uses this precedence (highest to lowest):

1. **Command-line flags** - Override everything
2. **Environment variables** - API keys, endpoints
3. **User overrides** - `~/.gsdo/transforms.json`
4. **LLM-generated rules** - `~/.gsdo/llm-rules.json`
5. **Default rules** - Built-in `transform-rules.json`

## Target Platform Configuration

GSD Open writes transpiled output to wherever the target platform expects it:

### OpenCode

**Auto-detected locations** (in priority order):
1. Project-local: `.opencode/`
2. User config (Linux/Mac): `~/.config/opencode/`
3. User config (Windows): `%APPDATA%/opencode/`

**We write:**
- `agents.json` - Transpiled agents
- `commands.json` - Transpiled commands
- `models.json` - Model configurations
- `settings.json` - General settings

**We DON'T write:**
- Any `.gsdo-*` files (those stay in `~/.gsdo/`)
- Any metadata files (those stay in `~/.gsdo/`)

### Future Platforms

When we add support for Antigravity, Cursor, etc., the same pattern applies:
- Detect where the platform expects its config
- Write transpiled files there
- Keep all our state in `~/.gsdo/`

## Security

- Never commit `.env` files with API keys
- Never store API keys in config files
- API keys are used in-memory only during enhancement
- All config files in `~/.gsdo/` are safe to commit (no secrets)

## Migration from Previous Versions

If you have config from the old `gsd-for-hobos` or if llm-rules were in `.opencode/`:

```bash
# Rename global config directory (if you had ~/.gfh/)
mv ~/.gfh ~/.gsdo

# Move cache to new location
rm -rf ~/.cache/docs-opencode/
# New cache will be created at ~/.gsdo/cache/docs-opencode/

# Move llm-rules if they were in project .opencode/
if [ -f .opencode/llm-rules.json ]; then
  mkdir -p ~/.gsdo
  mv .opencode/llm-rules.json ~/.gsdo/llm-rules.json
fi

# Move manifest if it was in project .opencode/
if [ -f .opencode/.gsdo-manifest.json ]; then
  mv .opencode/.gsdo-manifest.json ~/.gsdo/manifest.json
fi

# Move backups if they were in project
if [ -d .opencode-backup ]; then
  mkdir -p ~/.gsdo/backup/opencode
  mv .opencode-backup/* ~/.gsdo/backup/opencode/
  rm -rf .opencode-backup
fi
```

## Troubleshooting

### Where are my LLM rules?

They're in `~/.gsdo/llm-rules.json`, NOT in `.opencode/llm-rules.json`. GSD Open keeps all its files in one place.

### Where are my backups?

Backups are in `~/.gsdo/backup/opencode/{timestamp}/`, NOT in `.opencode-backup/`.

### I can't find the manifest

It's at `~/.gsdo/manifest.json`, NOT at `.opencode/.gsdo-manifest.json`.

### Why can't I find gsdo files in my project?

By design! GSD Open is a migration tool, not a project tool. All our files are in `~/.gsdo/`, not scattered across your projects.

---

*Back to: [Documentation Home](./README.md)*
