# Pitfalls Research: CLI Config Transpilation Tools

**Project:** gsd-open (gsdo)
**Domain:** CLI tools for config file migration/transpilation
**Researched:** 2026-01-21
**Overall Confidence:** MEDIUM-HIGH (verified with official docs and multiple sources)

---

## Critical Pitfalls

Mistakes that will break the tool or cause data loss. Address in Phase 1.

### 1. Cross-Platform Path Handling Failures

**What goes wrong:** Hardcoding path separators (`/` vs `\`), assuming home directory locations, or ignoring drive letters causes the tool to fail silently or crash on Windows or Unix.

**Why it happens:** Developers test on one OS and assume paths work everywhere. Node.js `path` module exists but requires conscious use.

**Consequences:**
- Tool crashes with "file not found" on Windows when using Unix paths
- Config files written to wrong locations
- GSD detection fails because `~/.claude/` doesn't resolve on Windows

**Warning signs:**
- Any hardcoded `/` or `\` in path strings
- Using string concatenation for paths instead of `path.join()`
- Assuming `~` expands automatically (it doesn't in Node.js)

**Prevention:**
```javascript
// ALWAYS use path module
const path = require('path');
const os = require('os');

// Correct: cross-platform home directory
const gsdPath = path.join(os.homedir(), '.claude');

// NEVER: hardcoded paths
const gsdPath = '~/.claude';  // Breaks on Windows
const gsdPath = '/Users/user/.claude';  // Breaks everywhere else
```

**Phase to address:** Phase 1 (Core Setup) - establish path utilities from day one.

**Sources:**
- [Semgrep: Five Considerations for Cross-Platform Tools](https://semgrep.dev/blog/2025/five-considerations-when-building-cross-platform-tools-for-windows-and-macos/)
- [DEV Community: Navigating File Paths Across Windows, Linux/macOS, and WSL](https://dev.to/imperatoroz/navigating-file-paths-across-windows-linux-and-wsl-a-devops-essential-1n03)

---

### 2. Config Format Parsing Bombs

**What goes wrong:** TOML/JSON/YAML parsing fails silently or explosively when encountering edge cases, malformed files, or format-specific gotchas.

**Why it happens:** Each format has hidden traps:
- **JSON:** No comments allowed, trailing commas break entire file
- **TOML:** Verbose for nested structures, implicit type surprises
- **YAML:** Implicit typing causes silent bugs (`no` becomes `false`, `1.10` becomes `1.1`)

**Consequences:**
- User's valid config rejected as invalid
- Silent data corruption during transpilation
- Cryptic error messages that don't help users fix their files

**Warning signs:**
- Using generic `JSON.parse()` without try/catch
- Not validating parsed config against expected schema
- Assuming source format matches documentation exactly

**Prevention:**
```javascript
// Wrap ALL parsing in try/catch with helpful errors
function parseConfig(content, filePath) {
  try {
    const parsed = JSON.parse(content);
    return { success: true, data: parsed };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse ${filePath}: ${error.message}`,
      hint: 'Check for trailing commas or missing quotes'
    };
  }
}

// Validate against expected schema after parsing
function validateGSDConfig(config) {
  const required = ['commands', 'settings'];
  const missing = required.filter(key => !(key in config));
  if (missing.length) {
    return { valid: false, missing };
  }
  return { valid: true };
}
```

**Phase to address:** Phase 2 (GSD Detection) - parsing is core to detection and transpilation.

**Sources:**
- [DEV Community: JSON vs YAML vs TOML 2026](https://dev.to/jsontoall_tools/json-vs-yaml-vs-toml-which-configuration-format-should-you-use-in-2026-1hlb)
- [Node-config Wiki: Configuration Files](https://github.com/node-config/node-config/wiki/Configuration-Files)

---

### 3. API Key Exposure

**What goes wrong:** API keys accidentally logged, persisted to disk, or exposed in error messages.

**Why it happens:** Debugging code logs full request objects, error handlers include sensitive data, or temporary files aren't cleaned up.

**Consequences:**
- User's API key leaked to console output
- Key committed to git via debug logs
- Automated bots scan public repos and drain accounts within minutes
- OpenAI/Anthropic disable compromised keys immediately

**Warning signs:**
- `console.log(request)` or `console.log(config)` anywhere near API calls
- Error handlers that dump full context
- Writing API responses to debug files

**Prevention:**
```javascript
// NEVER log objects that might contain keys
const sanitize = (obj) => {
  const clone = { ...obj };
  const sensitive = ['apiKey', 'api_key', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'];
  sensitive.forEach(key => {
    if (clone[key]) clone[key] = '[REDACTED]';
  });
  return clone;
};

// Use environment variables, never store
const apiKey = process.env.OPENAI_API_KEY;
// After use, don't retain
// apiKey is only in memory, garbage collected after function scope

// Error messages should never include the key
catch (error) {
  console.error('API call failed:', error.message);
  // NOT: console.error('Failed with key:', apiKey);
}
```

**Phase to address:** Phase 4 (LLM Enhancement) - but establish pattern in Phase 1.

**Sources:**
- [OpenAI: Best Practices for API Key Safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
- [OpenAssistantGPT: How to Prevent OpenAI API Key Leaks](https://www.openassistantgpt.io/blogs/how-to-prevent-openai-api-key-leaks)

---

### 4. Slash Command Format Incompatibility

**What goes wrong:** Transpiling GSD slash commands to OpenCode format loses functionality or produces invalid configs because formats differ significantly.

**Why it happens:** Claude Code and OpenCode have different:
- Frontmatter schemas (different supported keys)
- Argument syntax (`$ARGUMENTS` vs `$NAME` patterns)
- File/tool reference mechanisms
- Directory structures

**Claude Code format:**
```markdown
---
allowed-tools: Read, Grep, Glob
description: Security scan
model: claude-sonnet-4-5-20250929
---
Scan for vulnerabilities in $ARGUMENTS
```

**OpenCode format:**
```markdown
---
description: "Security scan"
---
Scan for vulnerabilities in $ARGUMENTS
!security-check $ARGUMENTS
@security-rules.md
```

**Consequences:**
- Commands don't work after transpilation
- Features silently dropped (user doesn't know what's missing)
- Invalid config prevents OpenCode from starting

**Warning signs:**
- 1:1 mapping assumption without studying both formats
- Not testing transpiled commands actually work
- Missing validation of output format

**Prevention:**
- Document explicit mapping table between formats
- Flag unsupported features in shortfall report
- Validate transpiled output against OpenCode schema
- Test transpiled commands in actual OpenCode instance

**Phase to address:** Phase 3 (Transpilation Engine) - core complexity lives here.

**Sources:**
- [Claude Code Docs: Slash Commands](https://code.claude.com/docs/en/slash-commands)
- [OpenCode Docs: Commands](https://opencode.ai/docs/commands/)

---

## Common Mistakes

Frequent errors that hurt UX. Address in Phase 2-3.

### 5. Partial/Broken Install Detection Failures

**What goes wrong:** Tool assumes GSD or OpenCode is "not installed" when it's actually partially installed, in a non-standard location, or has permission issues.

**Why it happens:**
- Only checking one expected path
- Not distinguishing "not found" from "permission denied"
- Assuming installation completeness from single file presence

**Consequences:**
- User told to install GSD when they have it
- Tool can't read existing config due to permissions
- Partial installs cause cryptic failures later

**Warning signs:**
- Single-path checks: `if (!existsSync(expectedPath))`
- Generic "not found" errors without investigation
- No permission checking

**Prevention:**
```javascript
async function detectGSD() {
  const possiblePaths = [
    path.join(os.homedir(), '.claude'),
    path.join(os.homedir(), '.config', 'claude'),
    process.env.CLAUDE_CONFIG_DIR,
  ].filter(Boolean);

  for (const p of possiblePaths) {
    try {
      await fs.access(p, fs.constants.R_OK);
      const stats = await fs.stat(p);
      if (stats.isDirectory()) {
        // Verify it's actually GSD, not just a .claude folder
        const hasCommands = await fs.access(
          path.join(p, 'commands'),
          fs.constants.R_OK
        ).then(() => true).catch(() => false);

        return { found: true, path: p, complete: hasCommands };
      }
    } catch (err) {
      if (err.code === 'EACCES') {
        return { found: true, path: p, error: 'permission_denied' };
      }
      // ENOENT means not found, continue checking
    }
  }
  return { found: false, checkedPaths: possiblePaths };
}
```

**Phase to address:** Phase 2 (GSD Detection).

**Sources:**
- [Honeybadger: Error Handling in Node.js](https://www.honeybadger.io/blog/errors-nodejs/)
- [Semgrep: Cross-Platform Tools](https://semgrep.dev/blog/2025/five-considerations-when-building-cross-platform-tools-for-windows-and-macos/)

---

### 6. Windows Registry vs File-Based Detection Mismatch

**What goes wrong:** On Windows, applications may register differently than on Unix. Checking only file paths misses apps installed via MSI/Winget.

**Why it happens:** Unix installs are file-based (`~/.config/app/`), Windows uses registry + file system.

**Windows registry paths for installed apps:**
- 64-bit: `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\`
- 32-bit: `HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\`

**Consequences:**
- Tool says "OpenCode not installed" when it is
- Detection works on Mac/Linux, fails on Windows

**Warning signs:**
- Detection logic only uses `fs.existsSync()`
- No Windows-specific code paths
- Testing only on Mac/Linux

**Prevention:**
```javascript
async function detectOpenCode() {
  // File-based check (works everywhere)
  const filePaths = [
    path.join(os.homedir(), '.config', 'opencode'),
    path.join(os.homedir(), '.opencode'),
  ];

  // Windows: also check if opencode.exe is in PATH
  if (process.platform === 'win32') {
    try {
      const { stdout } = await exec('where opencode');
      if (stdout.trim()) {
        return { found: true, method: 'path', location: stdout.trim() };
      }
    } catch {
      // Not in PATH, continue checking
    }
  } else {
    // Unix: check PATH
    try {
      const { stdout } = await exec('which opencode');
      if (stdout.trim()) {
        return { found: true, method: 'path', location: stdout.trim() };
      }
    } catch {
      // Not in PATH
    }
  }

  // Check config directories
  for (const p of filePaths) {
    if (await exists(p)) {
      return { found: true, method: 'config', location: p };
    }
  }

  return { found: false };
}
```

**Phase to address:** Phase 2 (Detection).

**Sources:**
- [Techuisitive: Win32 App Detection Rules](https://techuisitive.com/intune-understanding-win32-app-detection-rules/)

---

### 7. Graceful Degradation Failure

**What goes wrong:** Tool crashes or exits entirely when one component fails, instead of continuing with reduced functionality.

**Why it happens:** Fail-fast mentality applied where graceful degradation is better for UX.

**Consequences:**
- User loses all output because one minor feature failed
- Error in LLM pass kills the algorithmic pass results
- Detection failure prevents any useful output

**Warning signs:**
- Unhandled promise rejections
- No fallback paths in code
- Early `process.exit(1)` calls

**Prevention:**
```javascript
// Wrap each phase independently
async function run() {
  const results = {
    detection: null,
    transpilation: null,
    llmEnhancement: null,
  };

  // Phase 1: Detection (required)
  try {
    results.detection = await detectInstallations();
  } catch (err) {
    console.error('Detection failed:', err.message);
    console.log('Falling back to manual path entry...');
    results.detection = await promptForPaths();
  }

  // Phase 2: Transpilation (required)
  try {
    results.transpilation = await transpile(results.detection);
  } catch (err) {
    console.error('Transpilation failed:', err.message);
    // Still generate partial report
    results.transpilation = { partial: true, error: err.message };
  }

  // Phase 3: LLM Enhancement (optional)
  if (apiKey) {
    try {
      results.llmEnhancement = await enhanceWithLLM(results.transpilation);
    } catch (err) {
      console.warn('LLM enhancement failed, using algorithmic results');
      // Don't fail - algorithmic results still valuable
    }
  }

  // Always generate report with whatever we have
  return generateReport(results);
}
```

**Phase to address:** All phases - establish pattern in Phase 1.

**Sources:**
- [SRE School: Graceful Degradation in DevSecOps](https://sreschool.com/blog/graceful-degradation-in-devsecops-a-comprehensive-guide/)
- [GitHub: azd-core Graceful Degradation](https://github.com/jongio/azd-core)

---

### 8. Async/Await Error Handling Trap

**What goes wrong:** Errors in async code escape try/catch blocks, causing unhandled rejections and crashes.

**Why it happens:** Try/catch is synchronous by default. Async code requires `await` for errors to be caught.

**Consequences:**
- Unhandled promise rejection warnings
- Node.js process exits unexpectedly
- Errors appear to be swallowed silently

**Warning signs:**
- `.then()` chains without `.catch()`
- Async functions called without `await`
- Try/catch around non-awaited promises

**Prevention:**
```javascript
// WRONG: Error escapes
try {
  readFileAsync(path);  // Missing await!
} catch (err) {
  // Never catches
}

// CORRECT: Error caught
try {
  await readFileAsync(path);
} catch (err) {
  // Catches properly
}

// For parallel operations
const results = await Promise.allSettled([
  detectGSD(),
  detectOpenCode(),
]);
// Check each result individually
results.forEach((result, i) => {
  if (result.status === 'rejected') {
    console.warn(`Detection ${i} failed:`, result.reason);
  }
});
```

**Phase to address:** Phase 1 - establish async patterns early.

**Sources:**
- [Stackify: Node.js Error Handling Best Practices](https://stackify.com/node-js-error-handling/)
- [Medium: Advanced Error Handling in Node.js](https://medium.com/@sumit-paul/advanced-error-handling-in-node-js-best-practices-and-techniques-b9db03ca8405)

---

## Edge Cases

Scenarios that are easy to miss. Address in Phase 3-4.

### 9. Config Format Schema Drift

**What goes wrong:** GSD or OpenCode updates their config schema, breaking the transpiler.

**Why it happens:** Upstream projects evolve. What worked last month may not work now.

**Real examples:**
- OpenCode 0.5.15 added custom slash commands (format changed)
- Claude Code merged commands into skills (new format option)
- Config field renames between versions

**Consequences:**
- Transpiler produces invalid configs after upstream update
- Users blame gsdo when it's actually a version mismatch
- Silent failures when new fields are required

**Warning signs:**
- No version detection in configs
- Hard-coded field names without validation
- No changelog monitoring for upstream projects

**Prevention:**
```javascript
// Detect and warn about version mismatches
function checkVersionCompatibility(gsdConfig, openCodeVersion) {
  const knownGSDVersions = ['1.0', '1.1', '2.0'];
  const gsdVersion = gsdConfig.version || 'unknown';

  if (!knownGSDVersions.includes(gsdVersion)) {
    console.warn(`Unknown GSD version: ${gsdVersion}`);
    console.warn('Transpilation may be incomplete. Check for gsdo updates.');
  }

  // OpenCode 0.5.15+ supports custom commands differently
  if (semver.lt(openCodeVersion, '0.5.15')) {
    console.warn('OpenCode version < 0.5.15 detected');
    console.warn('Custom slash commands will not be transpiled.');
  }
}
```

**Phase to address:** Phase 3 (Transpilation) - build version awareness into core logic.

---

### 10. Unicode and Encoding Issues

**What goes wrong:** Config files with non-ASCII characters (emoji, non-English text) corrupt during read/write.

**Why it happens:** UTF-8 is default on Linux/Mac, but Windows may use other encodings. Node.js defaults can vary.

**Consequences:**
- User's carefully crafted prompts with emoji become garbage
- Non-English users see corrupted config
- Silent corruption that's only noticed later

**Warning signs:**
- Reading files without explicit encoding
- Writing files without explicit encoding
- No encoding declaration in output

**Prevention:**
```javascript
// Always specify encoding explicitly
const content = await fs.readFile(configPath, { encoding: 'utf8' });

// Write with explicit encoding and BOM for Windows compatibility
await fs.writeFile(outputPath, content, { encoding: 'utf8' });

// When shelling out, set encoding in environment
const { stdout } = await exec('command', {
  env: { ...process.env, LANG: 'en_US.UTF-8' }
});
```

**Phase to address:** Phase 1 - establish encoding patterns early.

**Sources:**
- [Semgrep: Text Encoding Assumptions](https://semgrep.dev/blog/2025/five-considerations-when-building-cross-platform-tools-for-windows-and-macos/)

---

### 11. Spaces in Paths

**What goes wrong:** File paths with spaces break when passed to shell commands or used in certain APIs.

**Why it happens:** Paths like `C:\Program Files\` or `/Users/John Doe/` are common but tricky.

**Consequences:**
- Commands fail with "file not found"
- Partial path interpreted as multiple arguments
- Works on dev machine, fails on user's machine

**Warning signs:**
- String interpolation in shell commands without quoting
- Testing only with paths without spaces
- No escaping when building command strings

**Prevention:**
```javascript
// WRONG: Breaks on spaces
const cmd = `cat ${configPath}`;

// CORRECT: Quote paths
const cmd = `cat "${configPath}"`;

// BETTER: Use execFile with args array (no shell interpolation)
const { execFile } = require('child_process');
execFile('cat', [configPath], callback);

// BEST: Don't shell out for file operations
const content = await fs.readFile(configPath, 'utf8');
```

**Phase to address:** Phase 1 - establish patterns early.

**Sources:**
- [LinuxVox: WSL PATH Broken by Spaces](https://linuxvox.com/blog/wsl-windows-subsystem-linux-breaks-path-when-the-windows-path-has-folder-names-with-spaces/)

---

### 12. Concurrent File Access

**What goes wrong:** Reading config while another process (Claude Code, OpenCode) is writing it causes corruption or stale reads.

**Why it happens:** CLI tools don't typically lock files. If user runs gsdo while also using Claude Code, race conditions occur.

**Consequences:**
- Partial/corrupt config read
- Transpilation based on incomplete state
- Overwriting changes user just made

**Warning signs:**
- No file locking mechanism
- Reading and writing same files used by other apps
- No warning about running alongside target apps

**Prevention:**
```javascript
// Warn users about potential conflicts
console.log('Note: Close Claude Code and OpenCode before running for best results.');

// Use atomic writes (write to temp, then rename)
const tempPath = `${outputPath}.tmp`;
await fs.writeFile(tempPath, content);
await fs.rename(tempPath, outputPath);

// Consider file locking for critical operations
const lockfile = require('proper-lockfile');
const release = await lockfile.lock(configPath);
try {
  // Read and process
} finally {
  await release();
}
```

**Phase to address:** Phase 3 (Transpilation).

---

### 13. Report Generation Character Encoding in Terminal

**What goes wrong:** Report looks fine in file but garbage in terminal, or vice versa.

**Why it happens:** Terminal emulators have varying Unicode/ANSI support. Windows CMD vs PowerShell vs WSL all differ.

**Consequences:**
- Box-drawing characters render as garbage
- Colors don't work
- Report unreadable in certain terminals

**Warning signs:**
- Using fancy Unicode without detection
- ANSI colors without terminal capability check
- No plain-text fallback

**Prevention:**
```javascript
const supportsColor = require('supports-color');
const isUnicodeSupported = require('is-unicode-supported');

function formatReport(report) {
  const useUnicode = isUnicodeSupported();
  const useColor = supportsColor.stdout;

  const bullet = useUnicode ? '  ' : '  *';
  const checkmark = useUnicode ? '  ' : '  [OK]';
  const cross = useUnicode ? '  ' : '  [FAIL]';

  // Build report with appropriate characters
}

// Always offer file output as fallback
console.log('Report saved to ./gsdo-report.md for best viewing');
```

**Phase to address:** Phase 5 (Report Generation).

---

## Prevention Strategies Summary

| Pitfall | Prevention | Phase |
|---------|------------|-------|
| Cross-platform paths | Use `path.join()`, `os.homedir()` everywhere | Phase 1 |
| Config parsing bombs | Try/catch + schema validation + helpful errors | Phase 2 |
| API key exposure | Environment vars only, sanitize logs, memory-only | Phase 1, 4 |
| Slash command incompatibility | Explicit mapping table, validate output, test in target | Phase 3 |
| Partial install detection | Multiple paths, permission checks, completeness verification | Phase 2 |
| Windows detection gaps | Platform-specific detection logic | Phase 2 |
| Graceful degradation | Independent phase error handling, partial results | All phases |
| Async error traps | Always `await`, use `Promise.allSettled()` | Phase 1 |
| Schema drift | Version detection, validation, update warnings | Phase 3 |
| Unicode issues | Explicit UTF-8 encoding everywhere | Phase 1 |
| Spaces in paths | Quote paths, prefer `execFile` over `exec` | Phase 1 |
| Concurrent access | Warn users, atomic writes, consider locks | Phase 3 |
| Terminal encoding | Detect capabilities, plain-text fallback | Phase 5 |

---

## Phase-Specific Warnings

| Phase | Likely Pitfalls | Key Mitigation |
|-------|-----------------|----------------|
| Phase 1 (Core Setup) | Path handling, encoding, async patterns | Establish utility functions early |
| Phase 2 (Detection) | Partial installs, Windows-specific, permissions | Multi-path checking, platform awareness |
| Phase 3 (Transpilation) | Format incompatibility, schema drift, concurrent access | Mapping table, version checks, atomic writes |
| Phase 4 (LLM Enhancement) | API key exposure, graceful degradation | Memory-only keys, independent error handling |
| Phase 5 (Report) | Terminal encoding, character support | Capability detection, file fallback |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Cross-platform paths | HIGH | Verified with official Node.js docs and multiple sources |
| Config parsing | HIGH | Well-documented patterns across multiple frameworks |
| API key security | HIGH | OpenAI official best practices |
| Slash command formats | MEDIUM | Verified both Claude Code and OpenCode docs, but formats may evolve |
| Detection patterns | MEDIUM | Windows registry approach verified, but OpenCode-specific paths need validation |
| Schema drift | MEDIUM | Historical pattern observed, specific versions need ongoing monitoring |

---

## Sources

### Official Documentation
- [OpenAI: Best Practices for API Key Safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
- [Claude Code Docs: Slash Commands](https://code.claude.com/docs/en/slash-commands)
- [OpenCode Docs: Commands](https://opencode.ai/docs/commands/)
- [OpenCode Docs: Config](https://opencode.ai/docs/config/)
- [Node.js Documentation: Errors](https://nodejs.org/api/errors.html)

### Cross-Platform Development
- [Semgrep: Five Considerations for Cross-Platform Tools](https://semgrep.dev/blog/2025/five-considerations-when-building-cross-platform-tools-for-windows-and-macos/)
- [DEV Community: Navigating File Paths Across Platforms](https://dev.to/imperatoroz/navigating-file-paths-across-windows-linux-and-wsl-a-devops-essential-1n03)

### Error Handling
- [Honeybadger: Error Handling in Node.js](https://www.honeybadger.io/blog/errors-nodejs/)
- [Stackify: Node.js Error Handling Best Practices](https://stackify.com/node-js-error-handling/)
- [SRE School: Graceful Degradation](https://sreschool.com/blog/graceful-degradation-in-devsecops-a-comprehensive-guide/)

### Config Formats
- [DEV Community: JSON vs YAML vs TOML 2026](https://dev.to/jsontoall_tools/json-vs-yaml-vs-toml-which-configuration-format-should-you-use-in-2026-1hlb)
- [Medium: Configuration File Formats Explained](https://medium.com/@ayasc/configuration-file-formats-xml-toml-json-yaml-and-ini-explained-a275fd67ee4e)
