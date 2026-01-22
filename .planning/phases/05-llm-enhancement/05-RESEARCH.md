# Phase 5: LLM Enhancement - Research

**Researched:** 2026-01-22
**Domain:** LLM-powered iterative refinement of transpilation results with multi-provider API support
**Confidence:** HIGH

## Summary

Phase 5 implements an optional LLM enhancement pass that runs after Phase 4 transpilation completes, allowing users with API access to iteratively refine gap suggestions and generate new transform rules. The phase must detect API keys from environment variables, test endpoints, support OpenAI-compatible APIs (OpenAI, Anthropic, OpenRouter, Azure), cache documentation from GitHub, validate LLM outputs against JSON schemas, and loop until the user exits.

The standard approach is: (1) detect and confirm API keys from a priority list of environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, etc.), (2) test endpoint connectivity before entering the enhancement loop, (3) fetch and cache OpenCode documentation from GitHub with a 24-hour TTL, (4) use OpenAI-compatible chat completions API for LLM calls, (5) validate LLM-generated rules against JSON schema before applying, (6) store LLM-generated rules separately in llm-rules.json from user-written rules, (7) offer "want to try more things?" after each iteration until user exits, and (8) provide fallback messaging for local LLM options (Ollama, LM Studio, llama.cpp) if no API key is available.

**Primary recommendation:** Create a dedicated `llm-enhancer.ts` module that orchestrates the enhancement flow, a separate `api-config.ts` for multi-provider API detection and testing, a `cache-manager.ts` for GitHub docs caching with TTL, and use native Node.js fetch for API calls with exponential backoff for transient failures. Implement schema validation with a lightweight validator (avoid adding zod/ajv dependencies if possible; simple Object type checking sufficient for this MVP). Use conversation history in memory during the session and discard after completion (no disk persistence).

## Standard Stack

The established libraries/tools for LLM integration in Node.js CLI 2026:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:fetch | Built-in (Node 18+) | HTTP requests to LLM APIs | Zero dependency, async-first, native to Node.js |
| @clack/prompts | ^0.11.0 | Interactive prompts (already in use) | Consistent UX with Phase 2/3, supports iteration loops |
| node:fs/promises | Built-in | Async file I/O for cache and config | Zero dependency, established in codebase |
| node:path | Built-in | Path handling for cache/rule storage | Already in use throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| picocolors | ^1.1.1 | Color output for LLM feedback | Existing pattern for UX consistency |
| (schema validation) | Custom | Simple type checking | Keep dependencies minimal for v1 |

### Why These Choices
- **node:fetch:** OpenAI-compatible APIs use standard HTTP/REST; fetch is native to Node 18+ and already used in codebase; avoids openai npm package dependency to minimize surface area
- **@clack/prompts:** Already integrated for Yes/No confirms; provides consistent UX for "want to try more things?" loop
- **Custom schema validation:** JSON schema for transform rules is simple (string, category, suggestion fields); hand-written validation avoids zod/ajv overhead for v1
- **GitHub docs caching:** Simple file-system-based TTL cache (check file modification time) sufficient for 24-hour refresh; node:fs/promises handles all needs

### Not Recommended (Avoided)
| Instead of | Could Use | Why We Don't |
|------------|-----------|-------------|
| node:fetch | openai npm package | openai package adds complexity; fetch is sufficient for OpenAI-compatible endpoints |
| Custom HTTP | axios or node-fetch | node:fetch is native; reduces dependencies |
| Custom cache logic | node-cache or cache-manager | File-system TTL cache is transparent and simpler for this use case |
| zod/ajv | Custom validation | Transform rule schema is simple; manual validation keeps dependencies minimal for MVP |

**Installation:**
```bash
# No new dependencies required
npm install
# All needed libraries already in package.json and Node.js built-ins
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── llm/                          # NEW: LLM enhancement module
│   │   ├── llm-enhancer.ts          # Main enhancement orchestrator
│   │   ├── api-config.ts            # API key detection and testing
│   │   ├── cache-manager.ts         # GitHub docs caching with TTL
│   │   ├── schema-validator.ts      # Simple JSON schema validation
│   │   └── prompt-builder.ts        # LLM prompt engineering
│   └── transpilation/
│       ├── orchestrator.ts          # (exists)
│       └── ...
└── commands/
    ├── transpile.ts                 # (UPDATE: add LLM enhancement hook)
    └── ...
```

### Pattern 1: API Configuration Detection and Testing
**What:** Multi-provider API key detection with fallback chain and connectivity testing
**When to use:** During LLM enhancement initialization
**Example:**

```typescript
// Source: Phase 5 implementation pattern
// src/lib/llm/api-config.ts

interface APIProvider {
  name: string;
  envVars: string[];
  endpoint: string;
  testEndpoint: () => Promise<boolean>;
}

interface APIConfig {
  provider: string;
  apiKey: string;
  endpoint: string;
}

export async function detectAndConfirmAPIConfig(): Promise<APIConfig | null> {
  // 1. Define provider detection chain
  const providers: APIProvider[] = [
    {
      name: 'OpenAI',
      envVars: ['OPENAI_API_KEY'],
      endpoint: 'https://api.openai.com/v1',
      testEndpoint: async (key, endpoint) => {
        return await testOpenAIEndpoint(key, endpoint);
      }
    },
    {
      name: 'Anthropic',
      envVars: ['ANTHROPIC_API_KEY'],
      endpoint: 'https://api.anthropic.com',
      testEndpoint: async (key, endpoint) => {
        return await testAnthropicEndpoint(key, endpoint);
      }
    },
    {
      name: 'OpenRouter',
      envVars: ['OPENROUTER_API_KEY'],
      endpoint: 'https://openrouter.ai/api/v1',
      testEndpoint: async (key, endpoint) => {
        return await testOpenRouterEndpoint(key, endpoint);
      }
    },
    {
      name: 'Azure OpenAI',
      envVars: ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'],
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      testEndpoint: async (key, endpoint) => {
        return await testAzureEndpoint(key, endpoint);
      }
    },
  ];

  // 2. Try detected env vars first
  for (const provider of providers) {
    const envKey = provider.envVars[0];
    const apiKey = process.env[envKey];
    if (apiKey) {
      const confirm = await prompts.confirm({
        message: `Found ${provider.name} API key. Use it? (${envKey})`,
        initialValue: true,
      });
      if (confirm) {
        // Test endpoint before returning
        const endpoint = await resolveEndpoint(provider);
        const canConnect = await provider.testEndpoint(apiKey, endpoint);
        if (canConnect) {
          return { provider: provider.name, apiKey, endpoint };
        }
        // Endpoint failed, offer to try alternative
        const tryAlternative = await prompts.confirm({
          message: `${provider.name} endpoint test failed. Try alternative?`,
          initialValue: true,
        });
        if (tryAlternative) {
          // Continue to next provider
          continue;
        }
      }
    }
  }

  // 3. If no env var found, ask for manual entry
  const manualEntry = await prompts.confirm({
    message: 'No API key detected in environment. Enter manually?',
    initialValue: false,
  });
  if (manualEntry) {
    const apiKey = await prompts.password({
      message: 'Enter API key (will not be saved):',
    });
    const providerChoice = await prompts.select({
      message: 'Which provider?',
      options: [
        { value: 'openai', label: 'OpenAI' },
        { value: 'anthropic', label: 'Anthropic' },
        { value: 'openrouter', label: 'OpenRouter' },
        { value: 'other', label: 'Other (specify endpoint)' },
      ],
    });
    // ... resolve endpoint, test, return config
  }

  return null;
}
```

### Pattern 2: GitHub Documentation Caching with TTL
**What:** Fetch OpenCode docs from GitHub, cache locally with 24-hour expiration
**When to use:** During LLM context loading
**Purpose:** Avoid repeated GitHub requests, provide LLM with current OpenCode schema/best practices

```typescript
// src/lib/llm/cache-manager.ts

export interface CacheEntry {
  content: string;
  timestamp: number;
  ttlSeconds: number;
}

export class DocsCacheManager {
  private cacheDir: string;
  private ttlSeconds: number = 24 * 60 * 60; // 24 hours

  constructor(cacheDir: string = '.cache/llm-docs') {
    this.cacheDir = cacheDir;
  }

  async get(key: string): Promise<string | null> {
    try {
      const cachePath = join(this.cacheDir, `${key}.json`);
      const stat = await fs.stat(cachePath);
      const age = (Date.now() - stat.mtimeMs) / 1000;

      if (age > this.ttlSeconds) {
        // Cache expired
        await fs.unlink(cachePath);
        return null;
      }

      const data = JSON.parse(await fs.readFile(cachePath, 'utf-8')) as CacheEntry;
      return data.content;
    } catch {
      return null;
    }
  }

  async set(key: string, content: string): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    const cachePath = join(this.cacheDir, `${key}.json`);
    const entry: CacheEntry = {
      content,
      timestamp: Date.now(),
      ttlSeconds: this.ttlSeconds,
    };
    await writeFile(cachePath, JSON.stringify(entry), 'utf-8');
  }

  async fetchOpenCodeDocs(): Promise<string> {
    const cacheKey = 'opencode-docs';

    // Try cache first
    const cached = await this.get(cacheKey);
    if (cached) {
      log.verbose('Using cached OpenCode documentation');
      return cached;
    }

    // Fetch from GitHub
    log.info('Fetching OpenCode documentation...');
    const url = 'https://raw.githubusercontent.com/sst/opencode/main/docs/schema.md';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenCode docs: ${response.statusText}`);
    }

    const content = await response.text();
    await this.set(cacheKey, content);
    return content;
  }
}
```

### Pattern 3: Conversation History and Iterative Refinement
**What:** Maintain conversation history in memory during session, pass full history to each LLM call
**When to use:** For multi-turn enhancement loops
**Purpose:** LLM can avoid repeating failed approaches, build on previous refinements

```typescript
// src/lib/llm/llm-enhancer.ts

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class LLMEnhancer {
  private conversationHistory: ConversationMessage[] = [];
  private apiConfig: APIConfig;

  async enhanceTranspilationResult(
    gaps: TransformGaps,
    opencode: OpenCodeConfig,
    rules: TransformRule[]
  ): Promise<EnhancementResult> {
    // Load system context
    const systemPrompt = this.buildSystemPrompt(gaps, opencode, rules);

    // Enter iteration loop
    let continueRefining = true;
    while (continueRefining) {
      // 1. Call LLM with full history
      const userMessage = await this.gatherUserRefinementRequest();
      this.conversationHistory.push({ role: 'user', content: userMessage });

      const response = await this.callLLM(systemPrompt, this.conversationHistory);
      this.conversationHistory.push({ role: 'assistant', content: response });

      // 2. Validate and apply LLM output
      const enhanced = this.parseEnhancementResponse(response);
      const validationResult = await this.validateEnhancement(enhanced);

      if (!validationResult.valid) {
        // Retry with validation feedback
        const feedback = `Validation failed: ${validationResult.errors.join(', ')}. Please fix and try again.`;
        this.conversationHistory.push({ role: 'user', content: feedback });
        continue;
      }

      // 3. Apply changes
      await this.applyEnhancement(enhanced);

      // 4. Ask for more refinements
      continueRefining = await this.askContinueRefining();
    }

    // History is discarded at end of session
    return { success: true, appliedRules: [...] };
  }

  private async callLLM(
    systemPrompt: string,
    messages: ConversationMessage[]
  ): Promise<string> {
    const response = await fetch(`${this.apiConfig.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo', // Configurable, detected from provider
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.statusText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return data.choices[0]?.message?.content || '';
  }
}
```

### Pattern 4: Schema Validation for LLM Output
**What:** Validate JSON schema of LLM-generated rules before persisting
**When to use:** After LLM generates new transform rules or suggestions
**Purpose:** Catch malformed output, retry with feedback

```typescript
// src/lib/llm/schema-validator.ts

export interface TransformRule {
  field: string;
  category: 'unsupported' | 'platform' | 'missing-dependency';
  suggestion: string;
  example?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTransformRules(obj: unknown): ValidationResult {
  const errors: string[] = [];

  // Type check
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, errors: ['Expected object, got ' + typeof obj] };
  }

  // Rules must be an array
  if (!Array.isArray((obj as Record<string, unknown>).rules)) {
    errors.push('Missing "rules" array');
    return { valid: false, errors };
  }

  const rules = (obj as Record<string, unknown>).rules as unknown[];

  // Validate each rule
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule || typeof rule !== 'object') {
      errors.push(`Rule ${i}: Expected object, got ${typeof rule}`);
      continue;
    }

    const ruleObj = rule as Record<string, unknown>;

    // Required fields
    if (typeof ruleObj.field !== 'string') {
      errors.push(`Rule ${i}: field must be string`);
    }
    if (!['unsupported', 'platform', 'missing-dependency'].includes(ruleObj.category as string)) {
      errors.push(`Rule ${i}: category must be one of [unsupported, platform, missing-dependency]`);
    }
    if (typeof ruleObj.suggestion !== 'string') {
      errors.push(`Rule ${i}: suggestion must be string`);
    }

    // Optional fields
    if (ruleObj.example !== undefined && typeof ruleObj.example !== 'string') {
      errors.push(`Rule ${i}: example must be string if provided`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### Anti-Patterns to Avoid
- **Storing API keys on disk after session:** Always discard keys when session ends; user decisions explicitly state "memory-only, discarded after"
- **Retry without backoff:** Direct retries on API failures cause thundering herd; use exponential backoff with jitter
- **Ignoring cache TTL:** GitHub aggressive caching + rate limits mean stale docs are better than repeated requests; respect 24-hour refresh window
- **Not validating LLM output:** LLM can hallucinate invalid JSON; always schema-validate before applying rules
- **Losing conversation history mid-loop:** Store full history in memory for context; discard at end of session
- **Single endpoint test:** Test endpoint before entering loop to fail fast; offer fallback options if test fails

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Multi-provider API detection | Custom env var scanning | Systematic chain (OpenAI → Anthropic → OpenRouter → Azure) with testing | API landscape is fragmented; need explicit provider order and endpoint testing |
| GitHub docs caching | Custom fetch loop | File-system TTL cache with modification time check | GitHub rate limits and CDN caching create gotchas; simple TTL is proven pattern |
| Exponential backoff on failure | Direct retries | Exponential backoff with jitter (base 2, max jitter) | Prevents thundering herd; AWS/Azure/OpenAI all recommend this |
| Conversation management | Recreate context each turn | Pass full history array to LLM | LLM needs previous context to avoid repeating failed approaches |
| JSON schema validation | Assume LLM is correct | Simple manual validation of required fields/types | LLM often returns incomplete or malformed JSON; validation is lightweight enough to hand-roll for MVP |

**Key insight:** This phase touches several fragmented ecosystems (multiple LLM providers, GitHub API, environment configuration). Standard solutions exist for each fragment, but integration requires orchestration. The complexity is in _combining_ known solutions (env var detection, TTL caching, exponential backoff, schema validation), not building them from scratch.

## Common Pitfalls

### Pitfall 1: API Key Not Tested Before Entering Loop
**What goes wrong:** User confirms API key, enhancement loop begins, first LLM call fails with 401/auth error; user confused about what went wrong
**Why it happens:** API key may exist in env var but be stale, wrong endpoint for that key, or insufficient permissions; only discovered when used
**How to avoid:** Call LLM endpoint with a simple test prompt (e.g., "respond with 'ready'") immediately after API config confirmation; if test fails, offer alternative or fallback messaging before entering loop
**Warning signs:** Enhancement loop starts, immediately fails with API error; no test happened before loop
**Validation:** Unit test: confirmAPIConfig → testEndpoint succeeds → enter loop; confirmAPIConfig → testEndpoint fails → offer fallback or exit

### Pitfall 2: GitHub Cache Stale During Active Development
**What goes wrong:** OpenCode schema changes, but user gets old cached docs; LLM generates rules for outdated API
**Why it happens:** 24-hour TTL caching is aggressive; if schema changes mid-development session, cache isn't refreshed
**How to avoid:** Offer `--refresh-docs` flag or manual cache clear via `gfh --clear-llm-cache`; log when cache is used vs freshly fetched; document TTL in verbose output
**Warning signs:** User says "LLM suggested field that doesn't exist in current OpenCode" after schema update
**Validation:** Test: manually touch cache file's mtime to expire it → next enhancement run → fetches fresh docs → logs "Fetching" not "Using cached"

### Pitfall 3: Conversation History Loss Between Iterations
**What goes wrong:** User asks LLM to refine something, LLM suggests change A, user says "try the other approach"; LLM doesn't remember A was tried and suggests A again
**Why it happens:** Each LLM call only sends the latest message, not the full history
**How to avoid:** Maintain `conversationHistory: Message[]` array in LLMEnhancer; append user message before call, append LLM response after; pass entire history to each LLM call
**Warning signs:** LLM repeats same failed suggestion in subsequent iterations; user says "I already told you to try X"
**Validation:** Test with 3+ iteration loop: check that all messages are included in final LLM call via logged request body

### Pitfall 4: Malformed LLM Output Crashes Session
**What goes wrong:** LLM returns incomplete JSON (missing closing brace), validation catches it, but error message is unhelpful; user doesn't know what to fix
**Why it happens:** LLM may truncate response or generate syntactically invalid JSON; validation reports raw error with no guidance
**How to avoid:** Catch JSON parse errors explicitly; on validation failure, include clear feedback to LLM: "The JSON you generated was incomplete. Please generate complete rules with all required fields: field, category, suggestion"
**Warning signs:** Validation error shows raw JSON syntax error; retry doesn't help because LLM doesn't understand what was wrong
**Validation:** Test: mock LLM response with truncated JSON → validation catches it → error message is clear → user can ask LLM to fix it

### Pitfall 5: No Fallback Message When All API Detection Fails
**What goes wrong:** User runs enhancement, all env vars missing, no manual entry offered; user given generic error; opportunity to suggest Ollama/LM Studio lost
**Why it happens:** Detection chain fails, function returns null, caller has no context about what failed or alternatives
**How to avoid:** Offer explicit messaging: "(1) No API key detected in env vars (OpenAI, Anthropic, OpenRouter). (2) Option to enter manually. (3) If all fail, suggest local LLM alternatives with links: Ollama docs, LM Studio setup, llama.cpp. (4) Include --no-enhance flag to skip this phase."
**Warning signs:** Enhancement fails silently; user doesn't see local LLM suggestions
**Validation:** Test without any API keys set → see all three messages (detection attempt, manual entry prompt, fallback suggestions)

### Pitfall 6: API Endpoint Not Guessed Correctly for Multi-Provider Setup
**What goes wrong:** User has ANTHROPIC_API_KEY set but also OPENROUTER_API_KEY; detection confirms Anthropic, but guesses wrong endpoint (uses OpenRouter endpoint for Anthropic key)
**Why it happens:** Endpoint guessing logic uses provider name but doesn't validate endpoint actually works with that key
**How to avoid:** (1) After confirming provider, explicitly test endpoint before loop (pattern 1 above). (2) If test fails, ask user to specify endpoint. (3) For OpenRouter, always use openrouter.ai/api/v1; for Azure, require AZURE_OPENAI_ENDPOINT env var
**Warning signs:** Auth error with endpoint mismatch; user says "I gave you right key but wrong endpoint"
**Validation:** Test with OpenRouter key → detects OpenRouter → uses openrouter.ai/api/v1; test with Azure setup → requires AZURE_OPENAI_ENDPOINT env var

## Code Examples

Verified patterns from official sources and standards:

### Example 1: OpenAI-Compatible Chat Completions API Call
```typescript
// Source: OpenAI API Reference (https://platform.openai.com/docs/api-reference/chat)
// Works with OpenAI, Anthropic (via SDK), OpenRouter, Azure OpenAI (with endpoint override)

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: ChatCompletionMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function callChatCompletions(
  endpoint: string,
  apiKey: string,
  request: ChatCompletionRequest
): Promise<string> {
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data.choices[0]?.message?.content || '';
}
```

### Example 2: Exponential Backoff Retry Logic
```typescript
// Source: AWS Prescriptive Guidance (retry-backoff pattern)
// Recommended for transient API failures

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number; // 0-1
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    jitterFactor: 0.1,
  }
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on last attempt
      if (attempt === options.maxAttempts - 1) {
        break;
      }

      // Calculate backoff with jitter
      const baseDelay = Math.min(
        options.initialDelayMs * Math.pow(2, attempt),
        options.maxDelayMs
      );
      const jitter = baseDelay * options.jitterFactor * Math.random();
      const delay = baseDelay + jitter;

      log.verbose(`Retry attempt ${attempt + 1}/${options.maxAttempts} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
```

### Example 3: Environment Variable Detection Chain
```typescript
// Source: Node.js process.env documentation + best practices

export interface ProviderConfig {
  name: string;
  primaryKey: string;
  alternateKeys?: string[];
  defaultEndpoint: string;
}

export function detectAPIKey(providers: ProviderConfig[]): string | null {
  for (const provider of providers) {
    // Check primary key
    const key = process.env[provider.primaryKey];
    if (key) {
      log.verbose(`Found API key: ${provider.name} (${provider.primaryKey})`);
      return key;
    }

    // Check alternate keys
    if (provider.alternateKeys) {
      for (const altKey of provider.alternateKeys) {
        const altValue = process.env[altKey];
        if (altValue) {
          log.verbose(`Found API key: ${provider.name} (${altKey}, alternate)`);
          return altValue;
        }
      }
    }
  }

  return null;
}

// Usage:
const providers: ProviderConfig[] = [
  {
    name: 'OpenAI',
    primaryKey: 'OPENAI_API_KEY',
    defaultEndpoint: 'https://api.openai.com/v1',
  },
  {
    name: 'Anthropic',
    primaryKey: 'ANTHROPIC_API_KEY',
    alternateKeys: ['CLAUDE_API_KEY'],
    defaultEndpoint: 'https://api.anthropic.com',
  },
  {
    name: 'OpenRouter',
    primaryKey: 'OPENROUTER_API_KEY',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
  },
];

const apiKey = detectAPIKey(providers);
```

### Example 4: File-System TTL Cache Implementation
```typescript
// Source: Standard file system caching pattern with modification time

import { readFile, writeFile, mkdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export class TTLCache {
  constructor(
    private cacheDir: string,
    private ttlSeconds: number = 86400 // 24 hours
  ) {}

  async get(key: string): Promise<string | null> {
    try {
      const filePath = join(this.cacheDir, `${key}.cache`);
      const stats = await stat(filePath);
      const ageSeconds = (Date.now() - stats.mtimeMs) / 1000;

      if (ageSeconds > this.ttlSeconds) {
        // Cache expired, delete it
        await unlink(filePath);
        return null;
      }

      const content = await readFile(filePath, 'utf-8');
      log.verbose(`Cache hit for ${key} (age: ${Math.round(ageSeconds)}s)`);
      return content;
    } catch (error) {
      // File doesn't exist or other error
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    const filePath = join(this.cacheDir, `${key}.cache`);
    await writeFile(filePath, value, 'utf-8');
    log.verbose(`Cached ${key}`);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single LLM provider (OpenAI only) | Multi-provider support with auto-detection | 2025-2026 | Fragmented but flexible ecosystem; users can choose any OpenAI-compatible endpoint |
| Manual API key entry every session | Env var detection with confirmation | 2020s onward | Better UX; secure (keys stay in env, not copied) |
| Fire-and-forget LLM calls | Iterative refinement with conversation history | Recent LLM UI patterns | Users can guide refinements; avoids repeating failures |
| No fallback for missing API key | Suggest local LLM options (Ollama, LM Studio) | 2024-2026 | Democratizes access; power users can run locally |
| Unvalidated LLM output | Schema validation before applying | 2023 onward | LLMs hallucinate; validation is table stakes for production |
| Aggressive re-fetching of docs | TTL-based caching | Rate limit awareness (2020s) | GitHub limits requests; caching is practical necessity |

**Deprecated/outdated:**
- Single-endpoint LLM integration: Ecosystems now support multiple providers via OpenAI-compatible APIs
- Manual API key entry: Environment variables are standard practice
- No conversation history: Iterative UI patterns assume context persistence
- One-shot LLM calls: Users expect multi-turn refinement loops

## Open Questions

Questions that couldn't be fully resolved during research:

1. **Model selection for different providers**
   - What we know: OpenAI uses `gpt-4-turbo`, Anthropic uses `claude-3.5-sonnet`, OpenRouter uses provider namespace (e.g., `anthropic/claude-3.5-sonnet`)
   - What's unclear: Should LLM enhancer auto-detect "best available" model per provider? Or ask user?
   - Recommendation: Start with provider-specific defaults (hardcoded in api-config.ts); if needed later, add `--model` flag for override; document in verbose output which model is used

2. **Conversation history size limits**
   - What we know: Modern LLMs support 100k+ token context; transcription rules + 3-5 iterations is likely <10k tokens
   - What's unclear: Should we implement token counting to warn user if history gets too large? Or just let API handle it?
   - Recommendation: For MVP, no token counting; if user reports context issues after long sessions (10+ iterations), add optional `--reset-history` flag for session start

3. **Local LLM fallback implementation scope**
   - What we know: Phase 5 context says to mention Ollama/LM Studio/llama.cpp with links if API keys fail
   - What's unclear: Should we auto-detect local LLM availability? Try to connect? Or just provide documentation links?
   - Recommendation: For MVP, only provide links and setup instructions; actual local LLM integration deferred to Phase 6/v2

4. **LLM-generated rules persistence and versioning**
   - What we know: LLM rules stored separately in llm-rules.json; backup exists from Phase 3
   - What's unclear: If user generates multiple versions (try, refine, try again), should we version llm-rules.json? Or just overwrite?
   - Recommendation: For MVP, overwrite llm-rules.json each session; backup protects old version; if user wants history, they can `git diff` the file

## Sources

### Primary (HIGH confidence)
- OpenAI Chat Completions API Reference: https://platform.openai.com/docs/api-reference/chat
- Node.js Built-in APIs: https://nodejs.org/api/fetch.html, https://nodejs.org/api/fs.html
- Phase 4 Research document (.planning/phases/04-reports/04-RESEARCH.md) - established patterns for @clack/prompts, logger, picocolors integration
- Codebase review:
  - src/commands/transpile.ts - command integration pattern
  - src/lib/transpilation/orchestrator.ts - pipeline orchestration pattern
  - src/types/index.ts - TranspileResult, TransformGaps structures
  - src/lib/logger.ts - logging API and quiet mode handling
  - package.json - existing dependency stack

### Secondary (MEDIUM confidence)
- AWS Prescriptive Guidance: https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html - exponential backoff pattern verified by AWS
- GitHub API Rate Limiting: https://dev.to/uche_wendy_9f87dcb3b339d0/optimizing-github-as-a-database-solving-rate-limits-with-server-side-caching-2aa5 - caching strategy rationale
- OpenAI SDK GitHub: https://github.com/openai/openai-node - reference for API integration patterns (though we use native fetch)
- OpenRouter Documentation: https://openrouter.ai/docs/guides/guides/claude-code-integration - multi-provider endpoint support verified
- LLM Context Management: https://eval.16x.engineer/blog/llm-context-management-guide - conversation history best practices

### Tertiary (LOW confidence)
- Medium articles on Anthropic/OpenRouter integration (not official, but indicates community patterns)
- GitHub caching behavior from Hacker News discussion (experiential knowledge, not official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - node:fetch is built-in; @clack/prompts and picocolors already integrated; no new dependencies recommended for v1
- Architecture patterns: HIGH - OpenAI-compatible API is well-established standard; conversation history pattern proven in LLM UIs; TTL caching is straightforward
- API detection: MEDIUM - Multiple providers exist, but env var detection strategy from context doc is solid; endpoint testing adds safeguard
- Pitfalls: HIGH - Based on LLM integration experience (hallucination, rate limits, stale cache) and API resilience patterns (backoff, endpoint testing)
- Fallback messaging: MEDIUM - Ollama/LM Studio are real alternatives, but local LLM integration scope is deferred; messaging approach needs validation with users

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (LLM APIs relatively stable; may need refresh if new OpenAI-compatible providers emerge or if phase requirements change)

**Phase prerequisites fulfilled:**
- Phase 4 output (TranspileResult, gaps, rules) - understood from types and Phase 4 research
- Reporter module patterns - confirmed in Phase 4 research and codebase
- Command integration point - confirmed in src/commands/transpile.ts
- Logger and prompt patterns - confirmed working in existing codebase
- File operations - confirmed with node:fs/promises patterns throughout codebase
