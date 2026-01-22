# Transpilation

This document explains how gsdo transforms GSD context files into OpenCode configuration.

## Overview

Transpilation is a three-stage process:

```
GSD Files → PARSE → IR → TRANSFORM → OpenCode → EMIT → JSON Files
```

1. **Parse**: Read GSD files and extract structure
2. **Transform**: Apply rules to convert to OpenCode format
3. **Emit**: Write JSON configuration files

## Source Files

GSD stores context engineering in Markdown and XML files:

```
~/.claude/get-shit-done/
├── workflows/           # Workflow definitions
│   ├── execute-plan.md
│   ├── execute-phase.md
│   └── ...
├── templates/           # Output templates
│   ├── summary.md
│   └── ...
├── references/          # Reference documents
│   ├── checkpoints.md
│   ├── tdd.md
│   └── ...
├── skills/              # Skill definitions
│   ├── gsd:plan-phase.md
│   └── ...
└── config/              # Configuration
    └── agents.xml
    └── commands.xml
```

## Intermediate Representation

The parser creates a GSDIntermediate structure:

```typescript
interface GSDIntermediate {
  version: string;
  source: string;
  parsedAt: string;
  agents: GSDAgent[];
  commands: GSDCommand[];
  workflows: GSDWorkflow[];
  templates: GSDTemplate[];
  references: GSDReference[];
  skills: GSDSkill[];
}
```

This normalized representation makes transformation rules simpler and more reliable.

## Transformation Rules

Rules in `transform-rules.json` define how GSD concepts map to OpenCode:

```json
{
  "rules": [
    {
      "field": "agent.tools",
      "category": "unsupported",
      "suggestion": "OpenCode uses config.tools array format"
    },
    {
      "field": "command.promptTemplate",
      "category": "platform",
      "suggestion": "Use OpenCode's template syntax: {{variable}}"
    }
  ]
}
```

### Rule Categories

| Category | Meaning | Report Color |
|----------|---------|--------------|
| `unsupported` | Feature doesn't exist in OpenCode | Red |
| `platform` | Feature exists but syntax differs | Yellow |
| `missing-dependency` | Requires external plugin/module | Blue |

## Output Files

After transformation, gsdo emits OpenCode configuration:

```
.opencode/
├── agents.json       # Agent definitions
├── commands.json     # Command definitions
├── models.json       # Model configurations
├── settings.json     # General settings
└── gfh-manifest.json # Transpilation metadata
```

### agents.json

```json
[
  {
    "name": "gsd-executor",
    "model": "sonnet",
    "systemMessage": "Execute GSD plans with atomic commits...",
    "description": "Executes phase plans with checkpoints",
    "temperature": 0.7
  }
]
```

### commands.json

```json
[
  {
    "name": "plan-phase",
    "description": "Create detailed execution plan for a phase",
    "promptTemplate": "Create a plan for phase {{phase}}..."
  }
]
```

### models.json

```json
[
  {
    "modelId": "sonnet",
    "provider": "anthropic",
    "endpoint": "https://api.anthropic.com/v1"
  }
]
```

### settings.json

```json
{
  "theme": {},
  "keybindings": {}
}
```

### gfh-manifest.json

Tracks transpilation state for idempotency:

```json
{
  "version": "1.0",
  "lastRun": {
    "timestamp": "2024-01-22T10:30:00Z",
    "sourceHash": "abc123...",
    "outputHash": "def456...",
    "backup": {
      "location": ".opencode-backup/20240122-103000",
      "timestamp": "2024-01-22T10:30:00Z"
    }
  },
  "mappings": [
    {
      "source": "workflows/execute-plan.md",
      "target": "commands.json",
      "transformed": true
    }
  ]
}
```

## Gap Tracking

Features that can't be directly mapped are tracked as "gaps":

### Unmapped Fields

Fields with no OpenCode equivalent:

```typescript
interface UnmappedField {
  field: string;       // Field name
  value: unknown;      // Original value
  reason: string;      // Why it couldn't map
  sourceFile: string;  // Source file path
  category: GapCategory;
  suggestion: string;  // Actionable suggestion
}
```

### Approximations

Fields that required approximation:

```typescript
interface ApproximationEntry {
  original: string;      // Original GSD field
  approximatedAs: string; // What it became
  reason: string;        // Explanation
  sourceFile: string;
  category: GapCategory;
}
```

## Backup System

Before writing new configs, gfh backs up existing files:

```
.opencode-backup/
└── 20240122-103000/
    ├── agents.json
    ├── commands.json
    ├── models.json
    ├── settings.json
    └── manifest.json
```

### Backup Manifest

```json
{
  "timestamp": "2024-01-22T10:30:00Z",
  "source": "~/.claude/get-shit-done",
  "files": [
    {
      "path": "agents.json",
      "hash": "sha256:abc123...",
      "size": 1024,
      "mode": 420
    }
  ]
}
```

### Skipping Backup

Use `--no-backup` to skip (dangerous):

```bash
gfh transpile --no-backup
```

## Idempotency

gfh uses content hashing for idempotent transpilation:

1. Hash all GSD source files (sorted by filename, SHA256)
2. Compare to `gfh-manifest.json` sourceHash
3. If unchanged, skip transpilation (unless `--force`)

This means:
- Running gfh twice produces identical output
- No unnecessary file writes
- Fast subsequent runs

## Dry Run

Preview changes without writing files:

```bash
gfh transpile --dry-run
```

Shows:
- What files would be created
- What backups would be made
- What gaps were detected

## Error Handling

### Parse Errors

If a GSD file can't be parsed:

```
Parse error in workflows/broken.md:
  Line 42: Invalid XML structure
```

Parsing continues with best-effort for remaining files.

### Transform Errors

If transformation fails:

```
Transform error: Unable to map agent.customField
  Reason: Unknown field type
  Suggestion: Add custom rule to transform-rules.json
```

### Emit Errors

If file writing fails:

```
Emit error: Permission denied: .opencode/agents.json
```

Check file permissions and directory access.

## Force Mode

To force re-transpilation even if source unchanged:

```bash
gfh transpile --force
```

Useful when:
- Transform rules have changed
- OpenCode schema has updated
- Manual edits need to be regenerated

## Quiet Mode

For scripting and CI:

```bash
gfh transpile --quiet
```

Only errors are shown. Exit code indicates success (0), warnings (1), or failure (2+).

## Verbose Mode

For debugging:

```bash
gfh transpile -v
```

Shows:
- Files being processed
- Transformation steps
- Hash calculations
- Cache operations

---

*Next: [Troubleshooting](./troubleshooting.md)*
