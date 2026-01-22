# Architecture Research

**Project:** gsd-open (gsdo)
**Domain:** CLI config transpilation tool
**Researched:** 2026-01-21
**Confidence:** MEDIUM (patterns synthesized from multiple sources, not copied from identical tools)

## Executive Summary

CLI config transpilation tools follow well-established patterns: a pipeline architecture with discrete stages, the adapter pattern for multi-platform support, and plugin-based extensibility for future growth. For gsdo specifically, the key architectural decision is separating the "core" (config reading, transpilation logic, report generation) from "platform adapters" (OpenCode, Cursor, etc.) so adding new platforms is trivial.

The two-pass architecture (algorithmic + LLM) maps naturally to a pipeline where the LLM pass is an optional enhancement stage that can be skipped or swapped.

---

## Component Structure

### Recommended Components

```
gsdo/
├── bin/
│   └── gsdo.js              # Entry point (shebang, minimal)
├── src/
│   ├── cli/
│   │   ├── index.js        # CLI setup (Commander.js)
│   │   ├── manifesto.js    # Notice display + consent
│   │   └── prompts.js      # User interaction helpers
│   ├── core/
│   │   ├── gsd-reader.js   # Read GSD files from ~/.claude/
│   │   ├── freshness.js    # Check/update GSD installation
│   │   └── config.js       # Internal config management
│   ├── transpiler/
│   │   ├── index.js        # Orchestrates transpilation pipeline
│   │   ├── parser.js       # Parse GSD format into intermediate representation
│   │   └── shortfall.js    # Calculate what can't be transpiled
│   ├── adapters/
│   │   ├── base.js         # Platform adapter interface/base class
│   │   ├── opencode.js     # OpenCode-specific transpilation
│   │   ├── cursor.js       # (Future) Cursor adapter
│   │   └── index.js        # Adapter registry/factory
│   ├── enhancers/
│   │   ├── llm-pass.js     # Optional LLM enhancement logic
│   │   └── api-client.js   # OpenAI-compatible API wrapper
│   └── reporters/
│       ├── console.js      # Terminal output formatting
│       └── markdown.js     # Markdown file generation
├── package.json
└── README.md
```

### Component Responsibilities

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| **bin/gsdo.js** | Entry point, process.argv handoff | cli/index.js |
| **cli/index.js** | Command parsing, orchestration | Commander.js, all other modules |
| **cli/manifesto.js** | Display disclaimer, get consent | prompts.js |
| **cli/prompts.js** | User interaction (Y/N, text input) | inquirer or prompts |
| **core/gsd-reader.js** | Find and read GSD files | fs/promises, path |
| **core/freshness.js** | Check GSD version, trigger updates | child_process |
| **transpiler/index.js** | Pipeline orchestration | parser, adapters, shortfall |
| **transpiler/parser.js** | GSD -> intermediate representation | None (pure logic) |
| **transpiler/shortfall.js** | Calculate non-portable features | None (pure logic) |
| **adapters/base.js** | Define adapter interface contract | None |
| **adapters/opencode.js** | IR -> OpenCode format | adapters/base.js |
| **adapters/index.js** | Adapter factory/registry | All adapter implementations |
| **enhancers/llm-pass.js** | LLM enhancement orchestration | api-client.js |
| **enhancers/api-client.js** | OpenAI-compatible API calls | fetch (Node 18+) |
| **reporters/console.js** | Format output for terminal | chalk (optional) |
| **reporters/markdown.js** | Generate .md report files | fs/promises |

---

## Data Flow

### High-Level Pipeline

```
User Input --> CLI Parser --> Manifesto Gate --> GSD Reader --> Freshness Check
                                                      |
                                                      v
                                            Platform Detection
                                                      |
                                                      v
                                               GSD Parser
                                            (Intermediate Rep)
                                                      |
                                                      v
                                            Shortfall Calculator
                                                      |
                                                      v
                                            Platform Adapter(s)
                                            (OpenCode for MVP)
                                                      |
                                                      v
                                         [Optional LLM Enhancement]
                                                      |
                                                      v
                                              Report Generator
                                                      |
                                                      v
                                         Console Output + File Save
```

### Detailed Data Flow

1. **Entry** (`bin/gsdo.js`)
   - Invoked via `npx gsd-open`
   - Hands off to `cli/index.js`

2. **CLI Parsing** (`cli/index.js`)
   - Uses Commander.js to parse flags/options
   - Determines execution mode (interactive vs. quiet)

3. **Manifesto Gate** (`cli/manifesto.js`)
   - Displays Notice
   - Gets Y/N consent
   - Exits if declined

4. **GSD Discovery** (`core/gsd-reader.js`)
   - Checks `~/.claude/` for GSD files
   - If not found, prompts for custom path
   - Returns: `{ found: boolean, path: string, files: string[] }`

5. **Freshness Check** (`core/freshness.js`)
   - Compares local GSD to remote version
   - If stale, offers to update (executes GSD update script)
   - Returns: `{ isFresh: boolean, updated: boolean }`

6. **Platform Detection** (`adapters/index.js`)
   - Scans system for installed platforms
   - MVP: Only checks for OpenCode
   - Returns: `{ platforms: ['opencode'], missing: [] }`

7. **GSD Parsing** (`transpiler/parser.js`)
   - Reads GSD config files
   - Parses into Intermediate Representation (IR)
   - IR is platform-agnostic data structure:
   ```javascript
   {
     commands: [{ name, trigger, body, ... }],
     rules: [{ type, content, ... }],
     systemPrompts: [{ name, content, ... }],
     metadata: { version, ... }
   }
   ```

8. **Shortfall Calculation** (`transpiler/shortfall.js`)
   - Compares IR against target platform capabilities
   - Identifies non-portable features
   - Returns: `{ portable: [...], shortfall: [...], warnings: [...] }`

9. **Platform Adaptation** (`adapters/opencode.js`)
   - Takes IR + shortfall
   - Transforms to target platform format
   - Writes config files to appropriate location
   - Returns: `{ success: boolean, filesWritten: [...], errors: [...] }`

10. **LLM Enhancement** (optional, `enhancers/llm-pass.js`)
    - Takes algorithmic output + shortfall
    - Sends to LLM for review/improvement
    - Iterates interactively if user wants
    - Returns: `{ enhanced: boolean, improvements: [...] }`

11. **Report Generation** (`reporters/`)
    - Aggregates all results
    - Formats for console and/or markdown
    - Console: professional summary with colors
    - Markdown: detailed technical report

### Data Structures

**Intermediate Representation (IR):**
```typescript
interface GsdIR {
  commands: Array<{
    name: string;
    trigger: string;  // e.g., "/gsd:plan"
    body: string;
    metadata?: Record<string, unknown>;
  }>;
  rules: Array<{
    type: 'system' | 'user' | 'project';
    filename: string;
    content: string;
  }>;
  systemPrompts: Array<{
    name: string;
    content: string;
  }>;
  metadata: {
    version?: string;
    sourcePath: string;
    parsedAt: string;
  };
}
```

**Shortfall Report:**
```typescript
interface ShortfallReport {
  platform: string;
  portable: Array<{
    type: 'command' | 'rule' | 'prompt';
    name: string;
    confidence: 'full' | 'partial' | 'degraded';
  }>;
  shortfall: Array<{
    type: 'command' | 'rule' | 'prompt';
    name: string;
    reason: string;
    suggestion?: string;
  }>;
  warnings: string[];
}
```

**Transpilation Result:**
```typescript
interface TranspilationResult {
  platform: string;
  success: boolean;
  filesWritten: Array<{
    path: string;
    type: string;
  }>;
  errors: string[];
  shortfall: ShortfallReport;
}
```

---

## Extensibility Patterns

### The Adapter Pattern (Primary)

**Why:** The core requirement is supporting multiple platforms (OpenCode now, Cursor/Windsurf/etc. later). The adapter pattern isolates platform-specific logic behind a common interface.

**Implementation:**

```javascript
// adapters/base.js
export class PlatformAdapter {
  constructor(name) {
    this.name = name;
  }

  // Check if platform is installed on system
  async detect() {
    throw new Error('Subclass must implement detect()');
  }

  // Get platform capabilities (what it can/can't do)
  getCapabilities() {
    throw new Error('Subclass must implement getCapabilities()');
  }

  // Transform IR to platform-specific format
  async transpile(ir) {
    throw new Error('Subclass must implement transpile()');
  }

  // Write config to appropriate location
  async write(config) {
    throw new Error('Subclass must implement write()');
  }
}

// adapters/opencode.js
export class OpenCodeAdapter extends PlatformAdapter {
  constructor() {
    super('opencode');
  }

  async detect() {
    // Check if opencode CLI exists, config dir exists, etc.
  }

  getCapabilities() {
    return {
      slashCommands: true,
      systemPrompts: true,
      projectRules: true,
      // ... OpenCode-specific capabilities
    };
  }

  async transpile(ir) {
    // Transform GSD IR to OpenCode format
  }

  async write(config) {
    // Write to ~/.config/opencode/ or wherever
  }
}
```

**Adding a new platform:**
1. Create `adapters/newplatform.js` extending `PlatformAdapter`
2. Register in `adapters/index.js`
3. Done. Core transpiler automatically picks it up.

### Adapter Registry Pattern

```javascript
// adapters/index.js
import { OpenCodeAdapter } from './opencode.js';
// import { CursorAdapter } from './cursor.js';  // Future

const adapters = {
  opencode: new OpenCodeAdapter(),
  // cursor: new CursorAdapter(),  // Future
};

export function getAdapter(name) {
  return adapters[name];
}

export function getAvailableAdapters() {
  return Object.keys(adapters);
}

export async function detectInstalledPlatforms() {
  const installed = [];
  for (const [name, adapter] of Object.entries(adapters)) {
    if (await adapter.detect()) {
      installed.push(name);
    }
  }
  return installed;
}
```

### Pipeline Pattern for Two-Pass Architecture

The two-pass (algorithmic + LLM) architecture maps naturally to a pipeline where stages can be optional:

```javascript
// transpiler/index.js
export async function transpile(options) {
  const pipeline = [
    readGsdFiles,
    parseToIR,
    calculateShortfall,
    adaptToPlatform,
  ];

  // LLM enhancement is optional
  if (options.llmApiKey) {
    pipeline.push(enhanceWithLLM);
  }

  pipeline.push(generateReport);

  // Execute pipeline
  let context = { options };
  for (const stage of pipeline) {
    context = await stage(context);
  }

  return context.result;
}
```

### Factory Pattern for Adapters

When multiple platforms are supported, the CLI will use a factory to instantiate the right adapter:

```javascript
export function createAdapter(platformName) {
  switch (platformName) {
    case 'opencode':
      return new OpenCodeAdapter();
    case 'cursor':
      return new CursorAdapter();
    default:
      throw new Error(`Unknown platform: ${platformName}`);
  }
}
```

---

## Suggested Build Order

Based on dependencies between components, here's the recommended build sequence:

### Phase 1: Foundation (Must be first)

1. **Project scaffolding** - package.json, ESM setup, bin entry
2. **core/config.js** - Internal configuration management
3. **cli/prompts.js** - User interaction utilities
4. **cli/manifesto.js** - Notice display

**Rationale:** Everything depends on basic project structure and user interaction.

### Phase 2: GSD Reading

5. **core/gsd-reader.js** - Find and read GSD files
6. **core/freshness.js** - Version checking (can be stub initially)
7. **transpiler/parser.js** - Parse GSD into IR

**Rationale:** Can't transpile without reading source. Parser defines the IR that everything else uses.

### Phase 3: Transpilation Core

8. **adapters/base.js** - Platform adapter interface
9. **adapters/opencode.js** - OpenCode implementation
10. **adapters/index.js** - Adapter registry
11. **transpiler/shortfall.js** - Calculate non-portable features
12. **transpiler/index.js** - Pipeline orchestration

**Rationale:** This is the core value. Adapter interface before implementation so the contract is clear.

### Phase 4: Output

13. **reporters/console.js** - Terminal output
14. **reporters/markdown.js** - File output

**Rationale:** Need transpilation working before reporting on it.

### Phase 5: CLI Integration

15. **cli/index.js** - Commander.js setup, tie everything together
16. **bin/gsdo.js** - Entry point

**Rationale:** CLI orchestrates all components, so it comes near the end.

### Phase 6: LLM Enhancement (Optional Pass)

17. **enhancers/api-client.js** - OpenAI-compatible API wrapper
18. **enhancers/llm-pass.js** - Enhancement orchestration

**Rationale:** This is explicitly optional and can be added after MVP core works.

### Dependency Graph

```
                        [bin/gsdo.js]
                             |
                      [cli/index.js]
                      /      |      \
            [manifesto]  [prompts]  [core/*]
                                       |
                                [gsd-reader]
                                       |
                                  [parser]
                                       |
                            [transpiler/index.js]
                           /         |         \
                   [shortfall]  [adapters/*]  [enhancers/*]
                                     |              |
                              [opencode.js]   [llm-pass.js]
                                                   |
                                            [api-client.js]
                                       |
                                [reporters/*]
                               /            \
                        [console.js]    [markdown.js]
```

---

## Anti-Patterns to Avoid

### 1. Monolithic Main Function
**What:** Putting all logic in a single main() function or cli/index.js
**Why bad:** Impossible to test, impossible to extend, impossible to maintain
**Instead:** Small, focused modules with single responsibilities

### 2. Platform Logic in Core
**What:** Putting OpenCode-specific logic in transpiler/index.js
**Why bad:** Adding new platforms requires modifying core code
**Instead:** All platform-specific logic in adapters/

### 3. Hardcoded Paths
**What:** `const gsdPath = '/Users/someone/.claude'`
**Why bad:** Won't work on Windows, won't work for non-standard installs
**Instead:** Use `os.homedir()`, `path.join()`, allow user override

### 4. Synchronous File Operations
**What:** Using `fs.readFileSync()` everywhere
**Why bad:** Blocks event loop, poor performance on large files
**Instead:** Use `fs/promises` with async/await throughout

### 5. Error Swallowing
**What:** `try { ... } catch (e) { /* ignore */ }`
**Why bad:** Failures become invisible, debugging nightmares
**Instead:** Bubble errors up, log appropriately, fail gracefully with messages

### 6. Tight Coupling to LLM Provider
**What:** Hardcoding OpenAI API format everywhere
**Why bad:** Can't switch providers, can't use local LLMs easily
**Instead:** Abstract behind api-client.js with OpenAI-compatible interface

---

## Platform-Specific Considerations

### OpenCode (MVP Target)

**Config location:** Needs research - likely `~/.config/opencode/` or project-local
**Format:** Likely YAML or JSON
**Capabilities to verify:**
- Slash command support
- System prompt configuration
- Project-level rules
- Custom instructions

**Research flag:** Needs Context7 or official docs lookup during implementation.

### Future Platforms (Post-MVP)

| Platform | Expected Config Location | Expected Format | Key Challenges |
|----------|-------------------------|-----------------|----------------|
| Cursor | `.cursor/` in project | JSON | Rules vs prompts distinction |
| Windsurf | TBD | TBD | Research needed |
| Antigravity | TBD | TBD | Research needed |
| ChatLLM | TBD | TBD | Research needed |

---

## Technology Decisions

### Why Commander.js for CLI

- Mature, well-documented, widely used
- Subcommand support (future: `gsdo transpile`, `gsdo check`, etc.)
- Auto-generates help
- TypeScript support if we migrate later

### Why ESM over CommonJS

- Modern standard, Node.js native since v14
- Top-level await support (useful for CLI)
- Better tree-shaking for eventual bundling
- Aligns with frontend ecosystem

### Why Minimal Dependencies

Per PROJECT.md constraints: "Node.js, minimal dependencies"

**Core dependencies (essential):**
- `commander` - CLI parsing
- `inquirer` or `prompts` - User interaction

**Optional dependencies:**
- `chalk` - Colored terminal output
- `ora` - Spinners for long operations

**Built-ins only:**
- `fs/promises` - File operations
- `path` - Path manipulation
- `os` - Platform detection, homedir
- `child_process` - Running external commands
- `fetch` - API calls (Node 18+ built-in)

---

## Sources

- [Tao of Node - Design, Architecture & Best Practices](https://alexkondov.com/tao-of-node/) - HIGH confidence (architecture patterns)
- [The Pipeline Pattern](https://dev.to/wallacefreitas/the-pipeline-pattern-streamlining-data-processing-in-software-architecture-44hn) - MEDIUM confidence (pipeline architecture)
- [Plugin-Based Architecture in Node.js](https://www.n-school.com/plugin-based-architecture-in-node-js/) - MEDIUM confidence (extensibility patterns)
- [Adapter Pattern in JavaScript](https://www.geeksforgeeks.org/system-design/adapter-method-javascript-design-patterns/) - HIGH confidence (adapter pattern)
- [Commander.js Best Practices](https://betterstack.com/community/guides/scaling-nodejs/commander-explained/) - HIGH confidence (CLI structure)
- [Node.js Best Practices Repository](https://github.com/goldbergyoni/nodebestpractices) - HIGH confidence (general patterns)
- [Converter Pattern](https://java-design-patterns.com/patterns/converter/) - MEDIUM confidence (transpilation pattern)
- [Building CLI Tools with Node.js 2025](https://www.javacodegeeks.com/2025/03/building-cli-tools-with-node-js.html) - MEDIUM confidence (modern practices)

---

## Open Questions

1. **OpenCode config format**: Need to research exact file format and location during implementation phase
2. **GSD file structure**: Need to inspect actual `~/.claude/` contents to finalize parser
3. **Cross-platform paths**: Windows vs Unix path handling - may need `cross-env` or similar
4. **LLM prompt design**: What prompts work best for enhancement pass?

---

## Recommendations for Roadmap

Based on this architecture:

1. **Phase 1 should include:** Foundation + GSD reading + basic transpilation
2. **Defer LLM pass to Phase 2 or later:** Core algorithmic transpilation is the MVP
3. **Build adapters/base.js first:** Even though only OpenCode is MVP, establishing the interface early prevents rewrite
4. **Create test fixtures early:** Sample GSD configs for testing parser
5. **Console reporter before markdown:** Faster feedback loop during development
