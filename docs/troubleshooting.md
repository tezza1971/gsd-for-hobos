# Troubleshooting

Common issues and their solutions.

## Detection Issues

### GSD Not Found

```
GSD installation not found.
Run detection first: gsdo --detect
```

**Causes:**
- GSD not installed
- GSD installed in non-standard location
- Permissions issue

**Solutions:**

1. Check if GSD is installed:
   ```bash
   ls ~/.claude/get-shit-done/
   ```

2. If installed elsewhere, gsdo will prompt for location:
   ```
   ? GSD not found at default location. Enter path:
   ```

3. Check permissions:
   ```bash
   ls -la ~/.claude/
   ```

### GSD Installation Invalid

```
GSD installation is invalid.
Missing files: workflows/execute-plan.md, templates/summary.md
```

**Causes:**
- Incomplete GSD installation
- Corrupted files
- Version mismatch

**Solutions:**

1. Update GSD:
   ```bash
   cd ~/.claude/get-shit-done && git pull
   ```

2. Reinstall GSD from scratch

### GSD Installation Stale

```
GSD installation is 95 days old. Consider updating.
```

**Causes:**
- GSD hasn't been updated recently
- Git pull failed silently

**Solutions:**

1. Update manually:
   ```bash
   cd ~/.claude/get-shit-done && git pull
   ```

2. Accept the update prompt when gsdo offers

### OpenCode Not Found

```
OpenCode not found on PATH.
```

**Causes:**
- OpenCode not installed
- OpenCode not in PATH
- Binary has different name

**Solutions:**

1. Install OpenCode:
   ```bash
   # See https://opencode.ai/docs/installation
   ```

2. Add to PATH:
   ```bash
   export PATH="$PATH:/path/to/opencode"
   ```

## API Issues

### API Key Not Detected

```
No API keys detected in environment.
```

**Causes:**
- Environment variable not set
- Variable name typo
- Shell session doesn't have the variable

**Solutions:**

1. Set the variable:
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

2. Verify it's set:
   ```bash
   echo $OPENAI_API_KEY
   ```

3. Check spelling - it must be exactly:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENROUTER_API_KEY`
   - `AZURE_OPENAI_API_KEY`

### Endpoint Test Failed

```
✗ OpenAI endpoint test failed
```

**Causes:**
- Invalid API key
- Network issue
- Rate limiting
- Service outage

**Solutions:**

1. Verify your API key is valid:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

2. Check for rate limits in your provider's dashboard

3. Check service status:
   - OpenAI: https://status.openai.com
   - Anthropic: https://status.anthropic.com

4. Try a different provider

### Azure Missing Endpoint

```
Azure OpenAI requires AZURE_OPENAI_ENDPOINT
```

**Causes:**
- Endpoint variable not set

**Solutions:**

1. Set both required variables:
   ```bash
   export AZURE_OPENAI_API_KEY="your-key"
   export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
   ```

## Transpilation Issues

### Permission Denied

```
Emit error: Permission denied: .opencode/agents.json
```

**Causes:**
- Directory not writable
- File locked by another process
- Insufficient permissions

**Solutions:**

1. Check directory permissions:
   ```bash
   ls -la .opencode/
   ```

2. Fix permissions:
   ```bash
   chmod 755 .opencode/
   chmod 644 .opencode/*.json
   ```

### Backup Failed

```
Backup error: Cannot create .opencode-backup/
```

**Causes:**
- Parent directory not writable
- Disk full
- Path too long

**Solutions:**

1. Check disk space:
   ```bash
   df -h .
   ```

2. Create directory manually:
   ```bash
   mkdir -p .opencode-backup
   ```

3. Use `--no-backup` if you don't need backups (dangerous)

### Transform Rules Error

```
Transform error: Invalid rule in transform-rules.json
```

**Causes:**
- Malformed JSON
- Missing required fields
- Invalid category

**Solutions:**

1. Validate JSON:
   ```bash
   cat .opencode/transform-rules.json | jq .
   ```

2. Check required fields:
   - `field`: string
   - `category`: 'unsupported' | 'platform' | 'missing-dependency'
   - `suggestion`: string

## LLM Enhancement Issues

### Validation Failed

```
Validation failed: Rule 0: category must be one of [unsupported, platform, missing-dependency]
```

**Causes:**
- LLM returned malformed JSON
- Invalid category value
- Missing required fields

**Solutions:**

This is handled automatically - the error is fed back to the LLM for correction. If it persists:

1. Try a different refinement request
2. Be more specific about what you want
3. Skip enhancement with Ctrl+C

### LLM Timeout

```
LLM request timed out
```

**Causes:**
- Slow network
- Provider overloaded
- Request too complex

**Solutions:**

1. Try again (may be transient)
2. Use a different provider
3. Simplify your refinement request

### Cache Stale

```
Warning: Using cached OpenCode docs from 3 days ago
```

**Causes:**
- Cache TTL (24 hours) keeps old docs

**Solutions:**

1. Delete the cache:
   ```bash
   rm -rf ~/.cache/docs-opencode/
   ```

2. Next run will fetch fresh docs

## Exit Code Issues

### Exit Code 1 (Warnings)

Transpilation succeeded but with warnings. Check:

1. The shortfall report for unmapped features
2. Approximations that may need review
3. Missing optional dependencies

### Exit Code 2+ (Errors)

Transpilation failed. Check:

1. Error messages in output
2. File permissions
3. GSD installation validity

## Getting More Information

### Enable Verbose Mode

```bash
gsdo transpile -v
```

Shows detailed information about:
- Files being processed
- Transformation steps
- API calls and responses
- Cache operations

### Check the Manifest

```bash
cat .opencode/gsdo-manifest.json | jq .
```

Shows:
- Last run timestamp
- Source/output hashes
- Backup location
- File mappings

### Check the Report

```bash
cat transpilation-report.md
```

If you saved the markdown report, it contains:
- Full gap analysis
- All unmapped fields
- All approximations
- Configuration preview

## Still Stuck?

1. **Check existing issues:** [GitHub Issues](https://github.com/glittercowboy/gsd-open/issues)
2. **Open a new issue:** Include:
   - gsdo version (`gsdo --version`)
   - Node.js version (`node --version`)
   - Operating system
   - Full error output (with `-v` flag)
   - Steps to reproduce

---

*Back to: [Documentation Home](./README.md)*
