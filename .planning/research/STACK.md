# Stack Research: gsd-open (gsdo)

**Domain:** Node.js CLI tool for config transpilation
**Researched:** 2026-01-21
**Overall Confidence:** HIGH

## Executive Summary

For a minimal-dependency CLI tool distributed via npx that handles config file parsing, interactive prompts, and optional API calls, the 2025 Node.js ecosystem offers mature, well-maintained options. The recommended stack prioritizes:

1. **Built-in Node.js APIs** where possible (fs/promises, path, native fetch)
2. **Commander.js** for CLI framework (lightest, most mature)
3. **@clack/prompts** for beautiful interactive prompts
4. **Native fetch** for OpenAI-compatible API calls (no axios needed)
5. **Vitest** for fast, modern testing

---

## Recommended Stack

### CLI Framework

| Package | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `commander` | ^14.0.2 | Command parsing, flags, subcommands | Lightest option (zero deps), 238M weekly downloads, mature API, excellent TypeScript support. Requires Node 20+. |

**Why Commander over alternatives:**
- **vs Yargs**: Commander is lighter, simpler API. Yargs overkill for single-purpose CLI.
- **vs Oclif**: Oclif is enterprise-grade with plugin system. Way too heavy for this project.
- **vs No framework**: Commander saves significant boilerplate for help text, version, flags.

```bash
npm install commander
```

### Interactive Prompts

| Package | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `@clack/prompts` | ^0.11.0 | User prompts, selections, spinners | Beautiful modern design, 2.5M weekly downloads, minimal API, built-in spinners. Perfect for CLI UX. |

**Why @clack/prompts:**
- Modern, beautiful output by default (no styling needed)
- Built-in intro/outro, spinners, multi-select, cancel handling
- Lighter than Inquirer.js
- Clean API: `text()`, `select()`, `confirm()`, `spinner()`

**Alternative considered:**
- `@inquirer/prompts` (^8.2.0): More mature, better docs, larger community. Choose this if @clack/prompts documentation proves insufficient for complex flows.

```bash
npm install @clack/prompts
```

### Terminal Styling

| Package | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `picocolors` | ^1.1.1 | Terminal colors for output | Tiny (6.4kB), fastest for simple use cases, actively maintained. |

**Why picocolors over chalk:**
- Chalk 5 is ESM-only (complicates dual CJS/ESM)
- Picocolors is 7x smaller (6.4kB vs 44.2kB)
- Faster in benchmarks for simple styling
- Actively maintained as of 2025

**Alternative:** `ansis` (^4.2.0) if you need complex chained styles or 256-color support.

```bash
npm install picocolors
```

### HTTP Client (for OpenAI-compatible APIs)

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| Native `fetch` | Built-in (Node 18+) | API calls to OpenAI-compatible endpoints | Zero dependencies, stable since Node 21, powered by Undici for performance. |

**Why native fetch:**
- Built into Node.js 18+ (stable in 21+)
- Zero additional dependencies
- Same API as browser fetch (portable code)
- Undici-powered = 3x faster than axios

**What you lose vs axios:**
- No automatic request/response interceptors
- No built-in timeout (use AbortController)
- No progress events (not needed for API calls)

```typescript
// Example: OpenAI-compatible API call
const response = await fetch('https://api.example.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({ model, messages })
});
```

### Config File Parsing

| Package | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| Built-in `JSON.parse` | N/A | JSON config files | Native, zero deps |
| `yaml` | ^2.7.0 | YAML config files (if needed) | Standard for YAML parsing |
| `@iarna/toml` | ^2.2.5 | TOML config files (if needed) | Best TOML 1.0 compliance |

**Recommendation:** Start with JSON only (native). Add yaml/toml parsing lazily if target platforms use those formats. Check what formats OpenCode actually uses before adding dependencies.

### File Operations

| Technology | Purpose | Rationale |
|------------|---------|-----------|
| `node:fs/promises` | File read/write | Built-in, async, modern API |
| `node:path` | Path manipulation | Built-in, cross-platform |
| `node:os` | Home directory, platform detection | Built-in |
| `node:child_process` | App detection via `which` | Built-in |

**Zero external dependencies needed for file operations.**

```typescript
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const claudeConfigDir = join(homedir(), '.claude');
```

### Validation (Optional)

| Package | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `zod` | ^4.3.5 | Schema validation | TypeScript-first, zero deps, excellent DX. Only add if config validation complexity warrants it. |

**Recommendation:** Start without Zod. Add it if config file validation becomes complex or if you need to provide detailed error messages for malformed configs.

### Testing

| Package | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `vitest` | ^4.0.17 | Unit/integration testing | 10-20x faster than Jest in watch mode, native ESM, TypeScript out-of-box, Jest-compatible API. |

**Why Vitest over Jest:**
- Native ESM support (no transforms needed)
- TypeScript works out-of-box
- Hot module reloading in watch mode
- 95% Jest API compatible

```bash
npm install -D vitest
```

### TypeScript Setup

| Package | Version | Purpose | Rationale |
|---------|---------|---------|-----------|
| `typescript` | ^5.7+ | Type safety | Standard |
| `tsx` | ^4.x | Development execution | Fast TypeScript execution without compilation step |
| `tsup` | ^8.x | Build/bundle | Simple bundler, outputs ESM/CJS |

**Build strategy:**
- Develop with `tsx` (no build step during dev)
- Bundle with `tsup` for distribution
- Output ESM for modern Node.js

```bash
npm install -D typescript tsx tsup @types/node
```

---

## Complete Installation Commands

### Production Dependencies

```bash
npm install commander @clack/prompts picocolors
```

**Total production dependencies: 3**

### Development Dependencies

```bash
npm install -D typescript tsx tsup vitest @types/node
```

### Optional (add when needed)

```bash
# If YAML configs needed
npm install yaml

# If TOML configs needed
npm install @iarna/toml

# If complex validation needed
npm install zod

# For enhanced TypeScript types with Commander
npm install -D @commander-js/extra-typings
```

---

## Package.json Configuration

```json
{
  "name": "gsdo",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "gsdo": "./dist/cli.js"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsup src/cli.ts --format esm --dts",
    "test": "vitest",
    "test:run": "vitest run",
    "prepublishOnly": "npm run build"
  }
}
```

**Critical for npx distribution:**
- `"bin"` field maps command name to entry point
- Entry file MUST start with `#!/usr/bin/env node`
- `"files"` limits what's published to npm
- `"type": "module"` enables ESM

---

## Alternatives Considered

### CLI Frameworks

| Option | Why Not |
|--------|---------|
| **Yargs** | More powerful parsing, but overkill. Better for complex multi-command CLIs with advanced validation. |
| **Oclif** | Enterprise-grade, plugin architecture. Way too heavy for a single-purpose tool. |
| **No framework** | Would require manual argument parsing, help text, version handling. Not worth it. |

### Interactive Prompts

| Option | Why Not |
|--------|---------|
| **@inquirer/prompts** | Excellent alternative. Larger community, better docs. Consider if @clack proves limiting. |
| **enquirer** | Good but less actively maintained than @clack. |
| **prompts** | Lighter but less polished UI than @clack. |

### HTTP Clients

| Option | Why Not |
|--------|---------|
| **axios** | No need for interceptors. Native fetch sufficient and zero deps. |
| **node-fetch** | Deprecated in favor of native fetch (Node 18+). |
| **got** | Feature-rich but unnecessary dependency. |
| **openai** (^6.16.0) | Official SDK adds 5MB. Only use if you need streaming/tools/agents features. Native fetch works for basic chat completions. |

### Terminal Colors

| Option | Why Not |
|--------|---------|
| **chalk** | ESM-only since v5, larger bundle, slower benchmarks. |
| **ansis** | Better if you need complex chaining or 256 colors. Picocolors sufficient for this project. |
| **kleur** | Not actively maintained (last update 3 years ago). |

### Testing

| Option | Why Not |
|--------|---------|
| **Jest** | Works but slower, requires transforms for ESM/TypeScript. |
| **Node test runner** | Built-in but minimal features. Vitest DX much better. |

---

## Anti-Recommendations

### DO NOT Use

| Package | Reason |
|---------|--------|
| `colors` | Abandoned, had supply chain attack in 2022. |
| `chalk` v5+ | ESM-only complicates publishing. Use picocolors. |
| `axios` | Unnecessary dependency. Native fetch works. |
| `node-fetch` | Deprecated. Use native fetch. |
| `inquirer` (legacy) | Old API. Use `@inquirer/prompts` or `@clack/prompts`. |
| `vorpal` | Abandoned, not maintained. |
| `ora` | Good spinner but @clack/prompts includes spinners. |

### Patterns to Avoid

| Anti-Pattern | Why | Do Instead |
|--------------|-----|------------|
| CJS (`require`) | Modern Node.js is ESM | Use `import`/`export` |
| Sync file operations | Blocks event loop | Use `fs/promises` |
| Global installs | Poor DX, version conflicts | Design for `npx` |
| Heavy validation upfront | Adds deps before needed | Add Zod when complexity demands |
| Rolling own arg parsing | Reinventing wheel poorly | Use Commander |

---

## Confidence Levels

| Area | Confidence | Notes |
|------|------------|-------|
| Commander | HIGH | Industry standard, verified 14.0.2 current, 238M downloads/week |
| @clack/prompts | MEDIUM-HIGH | 2.5M downloads, modern, but docs less mature than Inquirer |
| Native fetch | HIGH | Stable since Node 21, verified working for OpenAI-compatible APIs |
| Vitest | HIGH | Mature at v4.0.17, widely adopted, Jest-compatible |
| picocolors | HIGH | Actively maintained, benchmarked fastest for simple use |
| Built-in fs/path/os | HIGH | Core Node.js, stable, no deps |

---

## Sources

### CLI Frameworks
- [Commander vs Yargs vs Oclif Comparison](https://npm-compare.com/commander,oclif,vorpal,yargs)
- [npm trends: Commander vs Oclif vs Yargs](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- [Commander.js GitHub](https://github.com/tj/commander.js)
- [Building a TypeScript CLI with Node.js and Commander](https://blog.logrocket.com/building-typescript-cli-node-js-commander/)

### Interactive Prompts
- [@clack/prompts npm](https://www.npmjs.com/package/@clack/prompts)
- [Clack Official Site](https://www.clack.cc/)
- [Elevate Your CLI Tools with @clack/prompts](https://www.blacksrc.com/blog/elevate-your-cli-tools-with-clack-prompts)
- [@inquirer/prompts npm](https://www.npmjs.com/package/@inquirer/prompts)
- [Inquirer.js GitHub](https://github.com/SBoudrias/Inquirer.js)

### HTTP Clients
- [Axios vs Fetch 2025 Update](https://blog.logrocket.com/axios-vs-fetch-2025/)
- [Node.js Fetch API Stable](https://blog.logrocket.com/fetch-api-node-js/)
- [Unpacking Node.js Built-in Fetch and Undici](https://leapcell.io/blog/unpacking-node-js-s-built-in-fetch-and-its-undici-foundation)
- [Node.js Official Fetch Documentation](https://nodejs.org/en/learn/getting-started/fetch)

### Terminal Colors
- [Comparison of Node.js Terminal Color Libraries](https://dev.to/webdiscus/comparison-of-nodejs-libraries-to-colorize-text-in-terminal-4j3a)
- [Ansis GitHub](https://github.com/webdiscus/ansis)
- [Chalk GitHub](https://github.com/chalk/chalk)

### Testing
- [Vitest vs Jest 2025](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)
- [Vitest Adoption Guide](https://blog.logrocket.com/vitest-adoption-guide/)
- [Vitest Official Guide](https://vitest.dev/guide/)

### Validation
- [Joi vs Zod Comparison](https://betterstack.com/community/guides/scaling-nodejs/joi-vs-zod/)
- [Zod Explained](https://betterstack.com/community/guides/scaling-nodejs/zod-explained/)
- [Top 6 Validation Libraries 2025](https://devmystify.com/blog/top-6-validation-libraries-for-javascript-in-2025)

### Distribution
- [Package.json bin Field](https://docs.npmjs.com/cli/v7/configuring-npm/package-json/)
- [Creating npx Commands](https://deepgram.com/learn/npx-script)
- [Mastering npm and npx in 2025](https://jewelhuq.medium.com/mastering-npm-npx-in-2025-the-definitive-guide-to-node-js-86b2c8e2a39d)
- [TypeScript ESM/CJS Publishing 2025](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing)

### Config Parsing
- [JSON vs YAML vs TOML 2025](https://dev.to/leapcell/json-vs-yaml-vs-toml-vs-xml-best-data-format-in-2025-5444)
- [js-yaml GitHub](https://github.com/nodeca/js-yaml)
- [@iarna/toml GitHub](https://github.com/iarna/iarna-toml)

---

## Roadmap Implications

### Phase Structure Recommendations

**Phase 1: Core CLI Skeleton**
- Commander + @clack/prompts + picocolors
- Basic command structure, help, version
- No API calls yet

**Phase 2: Detection & Parsing**
- Built-in fs/promises, path, os
- Detect OpenCode installation
- Read and parse ~/.claude/ configs
- Add yaml/toml parsers only if needed

**Phase 3: Transpilation**
- Config transformation logic
- Output to target formats
- File writing

**Phase 4: API Enhancement (Optional)**
- Native fetch for OpenAI-compatible calls
- Only add if user enables enhancement mode

**Phase 5: Reports**
- Console output with picocolors
- Markdown file generation

### Dependencies to Defer

Add these only when needed:
- `yaml` / `@iarna/toml`: When you know target format requirements
- `zod`: When config validation complexity increases
- `openai` SDK: Only if you need advanced features (streaming, tools, agents)
