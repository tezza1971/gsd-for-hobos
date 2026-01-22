# Phase 3: Transpilation - Research

**Researched:** 2026-01-21
**Domain:** GSD to OpenCode configuration transpilation, including parsing, transformation, conflict resolution, and rollback
**Confidence:** HIGH

## Summary

Phase 3 implements the core transpilation engine that converts GSD context files (XML/Markdown) into valid OpenCode JSON configuration. The phase must handle three complex concerns: (1) parsing heterogeneous GSD source formats into a unified intermediate representation without data loss, (2) transforming that IR into OpenCode's specific configuration schema (agents, commands, models, tools, keybindings, etc.), and (3) safely managing existing OpenCode configs through timestamped backups with idempotent operation guarantees and comprehensive rollback on errors.

The standard approach is: implement a three-phase transformation pipeline (parse → validate → transform), use configuration-driven mapping rules (not hardcoded transforms), make backup + overwrite the default behavior (consistent, reversible), implement full rollback on any error during file writing, and ensure idempotency through deterministic output based on source content hash.

**Primary recommendation:** Build an intermediate representation as a plain TypeScript interface (not a class), use Node.js built-in JSON/fs APIs for file operations (no external file management deps), leverage async/await consistently, structure backups as timestamped directories with a manifest for recovery, and implement dry-run as a validation-only mode that reports all potential issues before touching the filesystem.

## Standard Stack

The established libraries/tools for transpilation and configuration management in 2026:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:fs/promises | Built-in | Async file I/O, atomic operations | Zero dependency, async-first, reliable |
| node:path | Built-in | Cross-platform path handling | Already in use via paths.ts, native |
| node:crypto | Built-in | Content hashing for idempotency | Deterministic fingerprinting without dependency |
| JSON.parse/stringify | Built-in | JSON read/write | Universal, built-in, for OpenCode configs |
| @clack/prompts | ^0.11.0 | User prompts (already in use) | For directory detection choices |

### Supporting (for optional format support)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| js-yaml | ^4.1.5 | YAML parsing | If processing YAML-format source files |
| @iarna/toml | ^0.6.0 | TOML parsing | If processing TOML-format source files |

### Why These Choices
- **Node.js built-ins preferred:** fs/promises, path, crypto are zero-dependency, well-documented, production-proven
- **JSON sufficient for phase:** OpenCode ships JSON/JSONC as primary format; YAML/TOML support deferred to if needed
- **@clack/prompts already in use:** No new dependency for user prompts on directory detection
- **No external file-management libraries:** Custom backup/rollback logic is simpler and more transparent than adding fs-extra

### Alternatives NOT Recommended
| Instead of | Could Use | Why We Don't |
|------------|-----------|-------------|
| node:fs/promises | fs-extra | fs-extra adds 1MB+ dependency; built-in handles all use cases |
| node:crypto hashing | crypto-js | crypto-js adds external dep; node:crypto is part of Node.js |
| Manual dir detection | lookpath/which | lookpath adds external dep; simple directory checks are clearer |
| Zod for schema validation | ajv | For this phase, manual validation is transparent; Zod can be added in validation phase |

**Installation:**
```bash
# No new dependencies - use existing stack + optional format parsers if needed
npm install  # Only installs existing dependencies from package.json
# Optional (not required for v1):
# npm install js-yaml @iarna/toml
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── cli.ts                           # Entry point (exists)
├── commands/
│   └── transpile.ts                 # Transpilation orchestration (NEW)
├── lib/
│   ├── paths.ts                     # Cross-platform paths (exists)
│   ├── logger.ts                    # Logging (exists)
│   ├── manifesto.ts                 # Consent (exists)
│   ├── exit-codes.ts                # Exit codes (exists)
│   ├── detection/                   # From Phase 2
│   │   ├── gsd-detector.ts
│   │   └── ...
│   └── transpilation/               # Transpilation logic (NEW)
│       ├── parser.ts                # Parse GSD files → AST
│       ├── transformer.ts           # AST → IR (Intermediate Representation)
│       ├── emitter.ts               # IR → OpenCode JSON
│       ├── ir-types.ts              # IR schema/interfaces
│       ├── backup-manager.ts        # Backup/rollback orchestration
│       ├── idempotency.ts           # Content hashing for idempotency
│       └── error-handler.ts         # Error context, stack traces, recovery
└── types/
    └── index.ts                     # TypeScript types (update)
```

### Pattern 1: Three-Phase Transformation Pipeline
**What:** Parse → Validate → Transform → Emit (separate concerns, independently testable)
**When to use:** Complex format conversions with multiple failure modes
**Example:**

```typescript
// Source: Phase 3 implementation pattern
// Each phase is independently testable and can emit diagnostics

async function transpile(gsdPath: string, options: TranspileOptions) {
  // Phase 1: Parse GSD files into AST
  const ast = await parseGSDFiles(gsdPath);
  if (ast.errors.length > 0) {
    reportParseErrors(ast.errors);
    return { success: false, rollbackNeeded: false };
  }

  // Phase 2: Validate and transform AST → IR
  const ir = transformASTToIR(ast);
  if (ir.warnings.length > 0) {
    reportTransformWarnings(ir.warnings);
  }

  // Phase 3: Emit IR → OpenCode config
  const emitted = emitOpenCodeConfig(ir);
  if (emitted.errors.length > 0) {
    reportEmitErrors(emitted.errors);
    return { success: false, rollbackNeeded: false };
  }

  // Phase 4: Write with backup and rollback on error
  try {
    return await writeWithBackup(emitted.files, gsdPath);
  } catch (error) {
    await rollbackLastBackup();
    throw error;
  }
}
```

### Pattern 2: Intermediate Representation (IR) as Bridge
**What:** Platform-agnostic schema representing GSD concepts in normalized form
**When to use:** Supporting multiple output formats (OpenCode now, other platforms future)
**Purpose:** Decouple input parsing from output generation
**Example:**

```typescript
// IR: Platform-neutral representation of GSD concepts
interface GSDIntermediate {
  version: "1.0";
  source: {
    path: string;
    hash: string;  // For idempotency
    timestamp: number;
  };

  // Logical sections
  agents: {
    name: string;
    model: string;
    temperature?: number;
    systemPrompt: string;
    tools?: string[];
  }[];

  commands: {
    name: string;
    description: string;
    template: string;
    variables?: Record<string, any>;
  }[];

  models: {
    name: string;
    provider: string;
    config?: Record<string, any>;
  }[];

  config: {
    theme?: string;
    keybindings?: Record<string, string>;
    permissions?: Record<string, string>;
    [key: string]: any;  // Extensible for future OpenCode fields
  };

  gaps: {
    // Track what couldn't be mapped (for reporting)
    unmappedFields: string[];
    approximations: Array<{
      original: string;
      approximatedAs: string;
      reason: string;
    }>;
  };
}
```

### Pattern 3: Backup Manager for Safe File Operations
**What:** Orchestrates timestamped backups, writes, and rollback
**When to use:** Any destructive file operations (overwrite configs)
**Guarantee:** State is always consistent (either pre-operation or post-operation, never partial)

```typescript
// Backup structure: .opencode-backup/YYYY-MM-DD_HHMMSS/
// Each backup contains:
// - manifest.json (what files were backed up, their hashes)
// - [original files]

interface BackupManifest {
  timestamp: string;  // ISO 8601
  source: string;     // Path to GSD that triggered backup
  files: Array<{
    path: string;
    hash: string;       // SHA256 of original
    size: number;
    preserveMode?: number;  // File permissions
  }>;
}

// Usage:
const backup = new BackupManager(opencodeConfigDir, logger);
await backup.backupExisting(existingConfigFiles);

try {
  // Write new files
  await writeFiles(newConfigFiles);
  // If write succeeds, backup persists (reversible state)
} catch (error) {
  // On error: restore backup, clean up partial writes
  await backup.restore();
  throw error;
}
```

### Pattern 4: Idempotency Through Content Hashing
**What:** Track source content hash; running twice with same source produces identical output
**When to use:** CLI tools where users might re-run without realizing
**Implementation:**

```typescript
// Store in .gsdo-manifest.json
interface GSDOManifest {
  version: "1.0";
  lastRun: {
    timestamp: string;
    sourceHash: string;    // SHA256 of input GSD files
    outputHash: string;    // SHA256 of generated config
    backup?: {
      location: string;
      timestamp: string;
    };
  };
  mappings: Array<{
    source: string;
    target: string;
    transformed: boolean;
  }>;
}

// Check before writing:
async function shouldRegenerate(sourceHash: string): Promise<boolean> {
  const manifest = await readManifest();
  return manifest.lastRun.sourceHash !== sourceHash;
}
```

### Anti-Patterns to Avoid
- **Don't stream file writes:** Collect all changes in memory, write atomically or not at all (simpler rollback)
- **Don't hardcode transform rules:** Use configuration files (allow user overrides via ~/.gsdo/transforms.json)
- **Don't lose error context:** Always include stack traces and internal state for debugging
- **Don't skip validation in dry-run:** Dry-run should be as thorough as real run (discovers all issues upfront)

## Don't Hand-Roll

Problems that look simple but have existing proven solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive directory traversal | Custom walkDir() | node:fs.readdirSync(recursive: true) or node:fs/promises + recursion | Built-in, efficient, handles symlinks |
| Content hashing | md5() custom impl | node:crypto.createHash('sha256') | Crypto-grade, audited, native |
| Path joining | String concatenation | node:path.join() | Cross-platform separators, normalization |
| JSON schema validation | Manual if/else | Zod or ajv (when needed) | Schema documentation + validation |
| Directory detection | Manual glob searching | Simple fs checks (OpenCode location is known) | For this phase, OpenCode path is deterministic |
| Timestamp formatting | Manual Date logic | ISO 8601 (Date.toISOString()) | Standards-compliant, parseable |
| File permissions preservation | Ignore them | fs.stat() + chmod() on restore | Important for scriptability and portability |

**Key insight:** The transpilation phase is transformation logic (parse/transform/emit), not file system operations. Use Node.js built-ins for FS; keep transpilation code in TypeScript classes/functions.

## Common Pitfalls

### Pitfall 1: Partial State After Interruption
**What goes wrong:** User interrupts (Ctrl+C) mid-write; OpenCode config dir is partially modified, neither old nor new, rendering config invalid
**Why it happens:** Writing files one-by-one without atomic guarantees
**How to avoid:**
- Collect all output in memory first
- Write all files in single atomic operation (or rolled-back bundle)
- Use backup + restore pattern: always have consistent pre or post state
**Warning signs:**
- Config partially written
- Some files updated, others not
- User can't easily revert

### Pitfall 2: Losing Track of What Was Backed Up
**What goes wrong:** Error during write; user tries to restore backup but doesn't know what files were affected
**Why it happens:** No manifest tracking which files were backed up
**How to avoid:**
- Create backup-manifest.json listing every backed-up file with hash
- Store manifest in timestamped backup directory
- Report manifest location in error message
**Warning signs:**
- Error occurs but user doesn't know which files to restore
- Multiple old backups; unclear which one is relevant

### Pitfall 3: Not Idempotent (Re-running Changes Output)
**What goes wrong:** User runs transpile twice; second run produces different OpenCode config (different hashes, different order)
**Why it happens:** Transform rules use timestamps, randomness, or unsorted iteration
**How to avoid:**
- Hash source content; only regenerate if hash changes
- Sort all object keys before output
- Use Date.now() only for manifest, not config content
- Store fingerprint in manifest
**Warning signs:**
- `--dry-run` shows changes on second run
- Config files differ between runs despite same source

### Pitfall 4: Over-Approximating in Best-Effort Transforms
**What goes wrong:** GSD construct X has no direct OpenCode equivalent; transpiler silently drops it or generates invalid config
**Why it happens:** No tracking of approximations; user loses GSD data
**How to avoid:**
- Track approximations in IR.gaps
- Report what was approximated and how
- Consider failing vs approximating; prefer explicit
- Document mappings in manifest
**Warning signs:**
- User re-runs transpiler; config missing some GSD settings
- Error log shows no warnings about lossy transforms

### Pitfall 5: Rollback Fails, Leaving Broken State
**What goes wrong:** Backup and restore work, but restore leaves files with wrong permissions or partial content
**Why it happens:** Rollback logic doesn't handle all edge cases (symlinks, permissions, large files)
**How to avoid:**
- Test rollback paths (not just backup)
- Verify restored files hash matches pre-operation hash
- Use fs.promises for atomic renames where possible
- Log rollback steps for debugging
**Warning signs:**
- Restored files are corrupted or unreadable
- Permissions are wrong after restore

### Pitfall 6: Dry-Run Doesn't Detect All Issues
**What goes wrong:** User runs `--dry-run`, sees success, then real run fails (e.g., directory permissions, invalid transforms)
**Why it happens:** Dry-run only does partial validation
**How to avoid:**
- Dry-run should execute full transform pipeline
- Validate file write permissions upfront (can I write to config dir?)
- Report all potential issues (parse errors, transform approximations, write failures)
- Don't skip validation in dry-run
**Warning signs:**
- Dry-run succeeds but real run fails
- Error only appears when actually writing files

## Code Examples

Verified patterns from research and standards for transpilation systems:

### Example 1: Three-Phase Transformation Pattern
```typescript
// Source: Compiler design best practices (Strumenta, GeeksforGeeks)
// Implements proven parse → transform → emit pattern

interface TransformResult {
  success: boolean;
  output?: GSDIntermediate;
  errors: Array<{ phase: string; message: string; stack?: string }>;
  warnings: string[];
}

async function transformGSDToOpenCode(gsdPath: string): Promise<TransformResult> {
  const errors: TransformResult['errors'] = [];
  const warnings: TransformResult['warnings'] = [];

  try {
    // Phase 1: Parse GSD files to AST (source → abstract syntax tree)
    const ast = await parseGSDFiles(gsdPath);
    if (ast.errors.length > 0) {
      errors.push({
        phase: 'parse',
        message: `Failed to parse GSD files: ${ast.errors.map(e => e.message).join('; ')}`
      });
      return { success: false, errors };
    }

    // Phase 2: Validate and transform AST to IR (abstract syntax tree → intermediate representation)
    const ir = validateAndTransformToIR(ast);
    if (ir.errors.length > 0) {
      errors.push({
        phase: 'transform',
        message: `Transform failed: ${ir.errors.map(e => e.message).join('; ')}`
      });
    }
    if (ir.warnings.length > 0) {
      warnings.push(...ir.warnings);
    }

    // Phase 3: Emit OpenCode configuration from IR (intermediate representation → target format)
    const emitted = emitOpenCodeConfig(ir);
    if (emitted.errors.length > 0) {
      errors.push({
        phase: 'emit',
        message: `Emit failed: ${emitted.errors.map(e => e.message).join('; ')}`
      });
      return { success: false, errors };
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, output: ir, warnings };
  } catch (error) {
    errors.push({
      phase: 'unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return { success: false, errors };
  }
}
```

### Example 2: Backup and Rollback Pattern
```typescript
// Source: Node.js file backup best practices, custom implementation

class BackupManager {
  private backupDir: string;
  private logger: Logger;

  constructor(opencodeConfigDir: string, logger: Logger) {
    this.backupDir = path.join(opencodeConfigDir, '.opencode-backup');
    this.logger = logger;
  }

  async backupExisting(filePaths: string[]): Promise<string> {
    // Create timestamped backup directory
    const timestamp = new Date().toISOString().replace(/[:.]/g, '');
    const backupPath = path.join(this.backupDir, timestamp);

    await fs.promises.mkdir(backupPath, { recursive: true });

    const manifest: BackupManifest = {
      timestamp: new Date().toISOString(),
      source: 'gsd-transpilation',
      files: []
    };

    // Backup each file
    for (const filePath of filePaths) {
      try {
        const sourceExists = await fileExists(filePath);
        if (!sourceExists) continue;

        const content = await fs.promises.readFile(filePath, 'utf-8');
        const hash = createHash('sha256').update(content).digest('hex');
        const stat = await fs.promises.stat(filePath);

        // Preserve directory structure in backup
        const relativePath = path.relative(path.dirname(this.backupDir), filePath);
        const backupFilePath = path.join(backupPath, relativePath);
        await fs.promises.mkdir(path.dirname(backupFilePath), { recursive: true });

        await fs.promises.writeFile(backupFilePath, content, 'utf-8');

        manifest.files.push({
          path: filePath,
          hash,
          size: stat.size,
          preserveMode: stat.mode
        });

        this.logger.verbose(`Backed up: ${filePath}`);
      } catch (error) {
        this.logger.error(`Failed to backup ${filePath}: ${error}`);
        throw error;
      }
    }

    // Write manifest
    await fs.promises.writeFile(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    this.logger.info(`Backup created: ${backupPath}`);
    return backupPath;
  }

  async restore(backupPath: string): Promise<void> {
    const manifest = JSON.parse(
      await fs.promises.readFile(path.join(backupPath, 'manifest.json'), 'utf-8')
    ) as BackupManifest;

    for (const file of manifest.files) {
      try {
        const backupFilePath = path.join(
          backupPath,
          path.relative(path.dirname(this.backupDir), file.path)
        );
        const content = await fs.promises.readFile(backupFilePath, 'utf-8');

        // Verify hash matches before restoring
        const hash = createHash('sha256').update(content).digest('hex');
        if (hash !== file.hash) {
          throw new Error(`Hash mismatch for ${file.path}: expected ${file.hash}, got ${hash}`);
        }

        // Restore file
        await fs.promises.mkdir(path.dirname(file.path), { recursive: true });
        await fs.promises.writeFile(file.path, content, 'utf-8');

        if (file.preserveMode) {
          await fs.promises.chmod(file.path, file.preserveMode);
        }

        this.logger.verbose(`Restored: ${file.path}`);
      } catch (error) {
        this.logger.error(`Failed to restore ${file.path}: ${error}`);
        throw error;
      }
    }

    this.logger.info(`Restored from backup: ${backupPath}`);
  }
}
```

### Example 3: Idempotency Check
```typescript
// Source: Idempotency best practices (DEV Community, Medium)
// Ensures running twice with same source produces identical output

async function checkIdempotency(gsdPath: string): Promise<{
  shouldRegenerate: boolean;
  reason?: string;
}> {
  try {
    // Hash all GSD source files
    const sourceHash = await hashDirectory(gsdPath);

    // Read last manifest
    const manifest = await readManifestSafe('.gsdo-manifest.json');

    if (!manifest) {
      return { shouldRegenerate: true, reason: 'No previous manifest found' };
    }

    if (manifest.lastRun.sourceHash !== sourceHash) {
      return {
        shouldRegenerate: true,
        reason: 'Source content has changed since last run'
      };
    }

    return { shouldRegenerate: false };
  } catch (error) {
    // On error, be conservative: regenerate
    return {
      shouldRegenerate: true,
      reason: `Could not determine idempotency: ${error}`
    };
  }
}

async function hashDirectory(dirPath: string): Promise<string> {
  const files = await fs.promises.readdir(dirPath, { recursive: true });
  const fileHashes: string[] = [];

  for (const file of files.sort()) {
    const filePath = path.join(dirPath, file);
    const stat = await fs.promises.stat(filePath);
    if (stat.isFile()) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      fileHashes.push(`${file}:${hash}`);
    }
  }

  return createHash('sha256')
    .update(fileHashes.join('\n'))
    .digest('hex');
}
```

### Example 4: Dry-Run Full Validation
```typescript
// Source: Node.js CLI best practices, validator pattern

async function runDryRun(gsdPath: string, opencodeConfigDir: string): Promise<void> {
  logger.info('[DRY RUN] Validating transpilation...');

  // Step 1: Validate source files exist and are readable
  try {
    const files = await fs.promises.readdir(gsdPath, { recursive: true });
    logger.verbose(`Found ${files.length} files in GSD path`);
  } catch (error) {
    throw new Error(`Cannot read GSD path: ${gsdPath}`);
  }

  // Step 2: Validate parser can handle all files
  const parseResult = await parseGSDFiles(gsdPath);
  if (parseResult.errors.length > 0) {
    logger.error('Parse errors found:');
    for (const err of parseResult.errors) {
      logger.error(`  - ${err.message}`);
    }
    return;
  }

  // Step 3: Validate transformer produces valid IR
  const irResult = await transformASTToIR(parseResult.ast);
  if (irResult.errors.length > 0) {
    logger.error('Transform errors found:');
    for (const err of irResult.errors) {
      logger.error(`  - ${err.message}`);
    }
    return;
  }

  // Step 4: Validate emitter can generate OpenCode config
  const emitResult = await emitOpenCodeConfig(irResult.ir);
  if (emitResult.errors.length > 0) {
    logger.error('Emit errors found:');
    for (const err of emitResult.errors) {
      logger.error(`  - ${err.message}`);
    }
    return;
  }

  // Step 5: Validate write permissions to target directory
  try {
    const testFile = path.join(opencodeConfigDir, '.gsdo-write-test');
    await fs.promises.writeFile(testFile, 'test', 'utf-8');
    await fs.promises.unlink(testFile);
  } catch (error) {
    throw new Error(`Cannot write to OpenCode config directory: ${opencodeConfigDir}`);
  }

  // Step 6: Report what would be written
  logger.success('[DRY RUN] Validation complete. Would write:');
  for (const file of Object.keys(emitResult.files)) {
    logger.info(`  - ${file}`);
  }

  if (irResult.warnings.length > 0) {
    logger.warn('Warnings:');
    for (const warning of irResult.warnings) {
      logger.warn(`  - ${warning}`);
    }
  }

  logger.info('[DRY RUN] No files were modified.');
}
```

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|------------------------|--------------|--------|
| Streaming file writes | Atomic write (collect → write all) | Always best practice | Prevents partial state corruption |
| Hardcoded mappings | Config-driven transforms | This phase design | Enables user customization |
| Simple error strings | Error with stack trace + context | Node.js modern patterns | Debugging is faster |
| Manual rollback code | Backup manager pattern | This phase design | Reversible operations guaranteed |
| No idempotency tracking | Manifest + source hash | This phase design | Safe for re-runs |

**Deprecated/outdated:**
- **Manual file permissions:** Use fs.stat/chmod for preservation (not typical in transpilers, but important for scriptability)
- **Synchronous file operations:** Always use async/promises in modern Node.js (non-blocking, better errors)
- **Manual path joining:** Always use node:path.join() (cross-platform separators)

## Open Questions

Things that couldn't be fully resolved during research (planner should clarify):

1. **GSD Source Format Variations**
   - What we know: GSD files are XML/Markdown with semantic tags; Phase 2 detects GSD installation
   - What's unclear: Will Phase 3 parse from ~/.claude/ directly, or does user provide path? Are all GSD constructs we're mapping documented?
   - Recommendation: Task should clarify: (a) input path detection logic, (b) which GSD concepts need mapping, (c) what to do with unmapped concepts (fail vs. approximate)

2. **OpenCode Config Directory Detection**
   - What we know: OpenCode can be at ~/.config/opencode or project root, detectable via PATH
   - What's unclear: If multiple locations exist, should we prompt user? Should we prefer project-local? What's the default?
   - Recommendation: Task should decide: (a) detection priority order, (b) whether to prompt or auto-select, (c) whether to create if missing

3. **Transform Rule Configuration Format**
   - What we know: Phase context says "config-driven rules in ~/.gsdo/transforms.json"
   - What's unclear: Exact schema of transforms.json (JSON structure, fields, examples)
   - Recommendation: Task should define: (a) transforms.json schema/examples, (b) precedence (shipped defaults vs. user overrides), (c) how to report which rules were applied

4. **Reporting and Manifest Contents**
   - What we know: .gsdo-manifest.json tracks source→output mappings and approximations
   - What's unclear: Should report also go to stdout/file? What level of detail?
   - Recommendation: Task should specify: (a) manifest JSON schema, (b) what gets logged vs. reported, (c) when to emit warnings vs. errors

5. **Backward Compatibility**
   - What we know: Phase context says "backup then overwrite"
   - What's unclear: What if user has manually edited their OpenCode config after we transpiled once? Do we preserve manual edits or overwrite?
   - Recommendation: Task should decide: (a) how to detect manual edits, (b) preserve manual edits or warn, (c) provide recovery options

## Sources

### Primary (HIGH confidence)
- **OpenCode Configuration Docs** - https://opencode.ai/docs/config/ - Verified OpenCode config structure (JSON/JSONC format, precedence, schema, sections)
- **GSD Style Guide** - https://github.com/glittercowboy/get-shit-done/blob/main/GSD-STYLE.md - Confirmed GSD file format (XML/Markdown, semantic tags, task structure)
- **Node.js fs/promises** - Built-in Node.js API - Confirmed for async file operations
- **Node.js crypto** - Built-in Node.js API - Confirmed for content hashing (SHA256)

### Secondary (MEDIUM confidence)
- **Transpiler Architecture Patterns** - https://tomassetti.me/how-to-write-a-transpiler/ - Verified three-phase transformation pattern (parse → transform → emit)
- **Intermediate Representation Best Practices** - https://www.geeksforgeeks.org/intermediate-code-generation-in-compiler-design/ - Confirmed IR design principles and benefits
- **Node.js Idempotency Patterns** - https://dev.to/prabhuvikas/ensuring-reliability-in-web-services-mastering-idempotency-in-nodejs-and-javascript-31cf - Verified idempotency key + hash pattern
- **Configuration Format Comparison** - https://dev.to/jsontoall_tools/json-vs-yaml-vs-toml-which-configuration-format-should-you-use-in-2026-1hlb - Confirmed JSON as primary for this phase
- **Node.js Error Handling 2026** - https://medium.com/@sajal.soni5/the-ultimate-guide-to-error-handling-in-node-js-concepts-patterns-and-best-practices-c1d2542df698 - Verified error class patterns

### Tertiary (LOW confidence, marked for validation)
- **Node.js File Backup Strategies** - https://medium.com/swlh/how-to-backup-files-using-node-js-and-rsync-bbea20701696 - Generic patterns; no specific Node.js CLI standard found
- **JSON/YAML/TOML Library Comparison** - https://npm-compare.com/ - Verified js-yaml and @iarna/toml are most popular, but not required for v1

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH - OpenCode docs confirmed, Node.js built-ins are stable
- **Architecture Patterns:** HIGH - Transpiler patterns are well-established, confirmed with multiple sources
- **Don't Hand-Roll:** MEDIUM-HIGH - Node.js APIs verified, library alternatives researched
- **Common Pitfalls:** MEDIUM - Based on compiler design best practices and Node.js patterns; specific validation during implementation
- **Idempotency:** MEDIUM - Pattern verified; specific implementation depends on exact GSD→OpenCode mapping rules

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days; Node.js APIs are stable; OpenCode config format changes unlikely but possible)

---

*Phase: 03-transpilation*
*Research complete: 2026-01-21*
