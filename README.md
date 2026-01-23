# GSD Open

A frictionless installer that migrates GSD commands from Claude Code to OpenCode.

## What It Does

GSD Open takes the `/gsd:*` commands from your [Get Shit Done (GSD)](https://github.com/glittercowboy/get-shit-done) installation in Claude Code and transpiles them for OpenCode. Run `npx gsd-open` and your GSD commands become available in OpenCode as `/gsd-*` commands.

This is a **best-effort migration**, not perfect parity. It gets you 80% of the way there. Some commands may need manual adjustment.

## How It Works

```
┌─────────────────────────────────────┐
│  npx gsd-open (Installer)           │
│  ─────────────────────────────────  │
│  1. Detect GSD at ~/.claude/        │
│  2. Cache OpenCode docs             │
│  3. Install /gsdo command           │
│  4. Transpile /gsd:* commands       │
│  5. Write install log               │
│  6. Show success screen             │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  /gsdo (OpenCode Command)           │
│  ─────────────────────────────────  │
│  1. Read install log                │
│  2. Enhance transpiled commands     │
│  3. Update commands in place        │
│  4. Write enhancement log           │
└─────────────────────────────────────┘
```

The installer does algorithmic transpilation (fast, deterministic). The `/gsdo` command uses OpenCode's LLM to enhance and adapt the commands for better usability.

## Installation

```bash
npx gsd-open
```

That's it. No configuration, no prompts, no user input required.

### Requirements

- Node.js 20+
- GSD installed at `~/.claude/get-shit-done/`
- OpenCode installed on your system

### What Gets Installed

- Transpiled `/gsd-*` commands in `~/.config/opencode/commands.json`
- `/gsdo` enhancement command
- Install log at `~/.gsdo/install.log`
- Cached OpenCode docs at `~/.gsdo/cache/`

## Usage

### First Time

```bash
# Install and transpile
npx gsd-open

# Open OpenCode and enhance commands
/gsdo
```

### Updates

Run `npx gsd-open` again anytime you update GSD in Claude Code. The installer checks timestamps and only re-transpiles if source files changed.

## Command Line Options

```
--help         Show usage information
--version      Show current version
--dry-run      Preview changes without writing
--quiet        Suppress output except errors
-v, --verbose  Show detailed progress
--detect       Run detection only (skip transpilation)
--force        Force re-transpilation even if unchanged
--no-backup    Skip backup creation (dangerous)
```

## What Gets Transpiled

| GSD Command | OpenCode Command | Status |
|-------------|------------------|--------|
| `/gsd:plan-phase` | `/gsd-plan-phase` | Transpiled |
| `/gsd:execute-phase` | `/gsd-execute-phase` | Transpiled |
| `/gsd:verify-work` | `/gsd-verify-work` | Transpiled |
| All other `/gsd:*` | `/gsd-*` | Best effort |

Some commands may have warnings (parameter mismatches, unsupported features). Check the install log for details.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — transpilation complete, no errors |
| 1 | Failure — GSD or OpenCode not found, critical errors |
| 2 | Partial success — some commands failed, but installation completed |

## File Locations

All GSD Open state lives in `~/.gsdo/`:

```
~/.gsdo/
├── last-imported-gsd      # Timestamp for idempotency
├── install.log            # Installation log (timestamped)
├── gsdo.log               # Enhancement log (timestamped)
└── cache/
    └── docs-opencode/     # OpenCode docs cache (24hr TTL)
```

## Release Status

**v0.0.1: ✅ SHIPPED (2026-01-23)**

- 54/54 requirements satisfied (100% coverage)
- 7 phases complete (18 plans, 50+ tasks)
- 144/144 tests passing (100% success rate)
- ~6-7s typical install time
- Zero external dependencies
- Cross-platform support (Windows, macOS, Linux)

This is a production-ready initial release. See `.planning/MILESTONES.md` for detailed accomplishments.

For next milestone planning, see the planning directory.

## Current Target

GSD Open currently targets **OpenCode** only. Future versions may support other platforms (Antigravity, Cursor, Windsurf).

## Troubleshooting

### GSD Not Found

If the installer can't find GSD, make sure it's installed at `~/.claude/get-shit-done/`. Custom GSD locations are not supported.

### OpenCode Not Found

The installer looks for OpenCode config at:
1. `.opencode/` (current directory)
2. `~/.config/opencode/` (Linux/Mac)
3. `%APPDATA%/opencode/` (Windows)

If OpenCode is installed elsewhere, the installer will fail. Make sure OpenCode is properly installed first.

### Commands Not Working

After running the installer, run `/gsdo` in OpenCode to enhance the commands. The algorithmic transpilation produces working but rough commands—the LLM enhancement makes them production-ready.

### Force Re-transpilation

To force re-transpilation even if source files haven't changed:

```bash
# Delete timestamp file
rm ~/.gsdo/last-imported-gsd

# Or use --force flag
npx gsd-open --force
```

## Architecture Notes

- **Zero dependencies**: Installer uses only Node.js built-in modules
- **Cross-platform**: Works on Windows, Mac, Linux
- **Idempotent**: Can run multiple times safely
- **Fast**: Completes in < 10 seconds
- **Autonomous**: No user input required

## License

MIT

## Contributing

Found a bug or have a feature request? Open an issue or submit a pull request.

## Acknowledgments

- [Get Shit Done (GSD)](https://github.com/glittercowboy/get-shit-done) — The original context engineering framework
- [OpenCode](https://opencode.ai/) — The open-source AI coding platform
