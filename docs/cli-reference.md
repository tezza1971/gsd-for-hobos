# CLI Reference

Complete reference for all gsdo commands, flags, and options.

## Synopsis

```bash
gsdo [options]
gsdo transpile [options]
```

## Global Options

These options apply to all commands:

| Option | Short | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help information |
| `--version` | `-V` | Show version number |
| `--verbose` | `-v` | Enable verbose output for debugging |
| `--quiet` | `-q` | Suppress all output except errors |
| `--dry-run` | | Preview changes without writing files |
| `--detect` | | Run detection only, skip transpilation |

## Commands

### Default Command (no subcommand)

```bash
gsdo [options]
```

Runs the full workflow:
1. Shows notice (requires acceptance)
2. Runs detection (GSD + OpenCode)
3. Runs transpilation (unless `--detect` is set)
4. Offers LLM enhancement (unless `--no-enhance`, `--quiet`, or `--dry-run`)
5. Offers markdown export

### transpile

```bash
gsdo transpile [options]
```

Runs transpilation directly, skipping the default detection display.

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Force re-transpilation even if source unchanged |
| `--no-backup` | Skip backup of existing configs (dangerous) |
| `--no-enhance` | Skip LLM enhancement prompt |

## Option Details

### --verbose / -v

Enables detailed output for debugging. Shows:
- File paths being processed
- Parse/transform steps
- API endpoint testing details
- Cache hits/misses

```bash
gsdo -v
gsdo transpile --verbose
```

### --quiet / -q

Suppresses all output except errors. Useful for scripting.

```bash
gsdo -q
gsdo transpile --quiet
```

**Note:** In quiet mode, LLM enhancement is automatically skipped (interactive prompts require normal output).

### --dry-run

Previews what would happen without making changes. No files are written or modified.

```bash
gsdo --dry-run
gsdo transpile --dry-run
```

Shows:
- What configs would be created
- What backups would be made
- What transformations would occur

**Note:** In dry-run mode, LLM enhancement is automatically skipped.

### --detect

Runs only the detection phase, then exits. Useful to check if GSD and OpenCode are properly installed.

```bash
gsdo --detect
```

Output shows:
- GSD installation status and path
- GSD validity (required files present)
- GSD freshness (days since last update)
- OpenCode installation status and path

### --force

Forces re-transpilation even if the source files haven't changed since the last run.

```bash
gsdo transpile --force
```

Normally, gsdo uses content hashing to skip transpilation when nothing has changed. `--force` bypasses this optimization.

### --no-backup

Skips creating a backup of existing OpenCode configs before overwriting.

```bash
gsdo transpile --no-backup
```

**Warning:** This is dangerous! Without backup, you cannot recover previous configs if transpilation produces unexpected results.

When used without `--quiet`, you'll be prompted to confirm:
```
--no-backup is set. Existing configs will be overwritten without backup. Continue?
```

### --no-enhance

Skips the LLM enhancement prompt entirely.

```bash
gsdo transpile --no-enhance
```

Use this if:
- You don't have an API key and don't want to see the prompt
- You want faster transpilation without the interactive step
- You're running in automation/CI

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| 0 | Success | Transpilation completed without issues |
| 1 | Warning | Partial success (some features couldn't map) |
| 2+ | Error | Transpilation failed |

### Exit Code Examples

```bash
# Check exit code after run
gsdo transpile
echo $?  # 0 = success, 1 = warnings, 2+ = error

# Use in scripts
gsdo transpile --quiet
if [ $? -eq 0 ]; then
  echo "Transpilation succeeded"
elif [ $? -eq 1 ]; then
  echo "Transpilation succeeded with warnings"
else
  echo "Transpilation failed"
fi
```

## Environment Variables

See [API Keys Guide](./api-keys.md) for LLM-related environment variables.

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for enhancement |
| `ANTHROPIC_API_KEY` | Anthropic API key for enhancement |
| `OPENROUTER_API_KEY` | OpenRouter API key for enhancement |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | Azure deployment name |

## Examples

### Basic Usage

```bash
# Run full workflow
gsdo

# Run with verbose output
gsdo -v

# Preview without making changes
gsdo --dry-run
```

### Detection Only

```bash
# Check if GSD and OpenCode are installed
gsdo --detect

# Verbose detection for troubleshooting
gsdo --detect -v
```

### Transpilation

```bash
# Direct transpilation
gsdo transpile

# Force re-transpilation
gsdo transpile --force

# Skip backup (dangerous)
gsdo transpile --no-backup

# Skip LLM enhancement
gsdo transpile --no-enhance

# Combine options
gsdo transpile --force --no-enhance -v
```

### Scripting

```bash
# Silent transpilation for CI
gsdo transpile --quiet --no-enhance

# Dry run to check what would change
gsdo transpile --dry-run --no-enhance

# Check exit code
gsdo transpile --quiet --no-enhance || echo "Failed"
```

### With LLM Enhancement

```bash
# Set API key first
export OPENAI_API_KEY="sk-..."

# Run with enhancement
gsdo transpile

# Or use a different provider
export ANTHROPIC_API_KEY="sk-ant-..."
gsdo transpile
```

## Interactive Prompts

During a normal run, you'll encounter these prompts:

### 1. Notice

```
┌─────────────────────────────────────────────────────┐
│  GSD OPEN NOTICE                                    │
│  ...                                                │
└─────────────────────────────────────────────────────┘
? Accept the notice? (y/N)
```

### 2. No-Backup Warning (if --no-backup)

```
? --no-backup is set. Existing configs will be overwritten without backup. Continue? (y/N)
```

### 3. LLM Enhancement (if success and not skipped)

```
? Enhance transpilation with LLM? (requires API key) (y/N)
```

### 4. API Key Confirmation (if detected)

```
? Found OpenAI API key. Use it? (from OPENAI_API_KEY) (Y/n)
```

### 5. Manual API Key Entry (if no env var)

```
? No API key detected in environment. Enter manually? (y/N)
? Enter API key (will not be saved): ********
? Which provider? (Use arrow keys)
❯ OpenAI
  Anthropic
  OpenRouter
  Other (specify endpoint)
```

### 6. Enhancement Loop

```
? What would you like to improve?
...
? Want to try more things? (Y/n)
```

### 7. Markdown Export

```
? Save report to markdown? (Y/n)
```

---

*Next: [LLM Enhancement](./llm-enhancement.md)*
