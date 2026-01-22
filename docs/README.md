# GSD Open Documentation

Welcome to the GSD Open (gsdo) documentation. This guide covers everything you need to know to transpile your GSD context engineering to OpenCode format.

## Quick Links

| Document | Description |
|----------|-------------|
| [API Keys Guide](./api-keys.md) | Environment variables for LLM enhancement |
| [CLI Reference](./cli-reference.md) | All commands, flags, and exit codes |
| [LLM Enhancement](./llm-enhancement.md) | Optional AI-powered refinement loop |
| [Transpilation](./transpilation.md) | How GSD configs become OpenCode configs |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions |

## Getting Started

### Installation

```bash
# Run directly with npx (recommended)
npx gsd-open

# Or install globally
npm install -g gsd-open
gsdo
```

### First Run

On first run, gsdo will:

1. **Detect your GSD installation** - Usually at `~/.claude/get-shit-done/`
2. **Check for OpenCode** - Scans your PATH for the `opencode` binary
3. **Run transpilation** - Converts GSD configs to OpenCode format
4. **Offer LLM enhancement** - Optional pass to improve results (requires API key)

### Minimum Requirements

- Node.js 20 or later
- GSD installed (typically via Claude Code)
- OpenCode installed (for target platform)

## Architecture Overview

```
GSD Source Files          Intermediate Rep.         OpenCode Config
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ workflows/*.md  │      │                 │      │ agents.json     │
│ templates/*.md  │  =>  │  GSDIntermediate│  =>  │ commands.json   │
│ references/*.md │      │                 │      │ models.json     │
│ skills/*.md     │      │                 │      │ settings.json   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
      PARSE                  TRANSFORM                  EMIT
```

## Two-Pass Architecture

### Pass 1: Algorithmic (Always Runs)

The algorithmic pass performs deterministic transpilation:
- Parses GSD XML/Markdown files
- Applies transform rules from `transform-rules.json`
- Generates OpenCode configuration files
- Creates backup of existing configs
- Produces shortfall report

### Pass 2: LLM Enhancement (Optional)

If you have an API key, you can run an LLM enhancement pass:
- Reviews the algorithmic output
- Suggests improvements based on OpenCode documentation
- Interactive refinement loop until you're satisfied
- Generates additional transform rules in `llm-rules.json`

See [LLM Enhancement](./llm-enhancement.md) for details.

## Output Files

After transpilation, you'll find:

```
.opencode/                    # OpenCode config directory
├── agents.json              # Transpiled agents
├── commands.json            # Transpiled commands
├── models.json              # Model configurations
├── settings.json            # General settings
├── llm-rules.json           # LLM-generated rules (if enhanced)
└── gsdo-manifest.json       # Transpilation metadata

.opencode-backup/            # Backup of previous configs
└── {timestamp}/
    └── ...
```

## Getting Help

- **In the CLI:** `gsdo --help`
- **GitHub Issues:** [Report bugs or request features](https://github.com/glittercowboy/gsd-open/issues)
- **GSD Documentation:** [Original GSD project](https://github.com/glittercowboy/get-shit-done)
- **OpenCode Documentation:** [OpenCode docs](https://opencode.ai/docs)

---

*Next: [API Keys Guide](./api-keys.md)*
