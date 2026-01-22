# LLM Enhancement

The optional LLM enhancement pass uses AI to improve your transpilation results beyond what algorithmic transformation can achieve.

## Overview

After the algorithmic transpilation completes, gsdo offers an LLM enhancement pass:

```
? Enhance transpilation with LLM? (requires API key) (y/N)
```

If you accept and have a valid API key, you enter an interactive refinement loop where you can iteratively improve the transpilation results.

## How It Works

### 1. API Configuration

First, gsdo detects and confirms your API configuration:

```
? Found OpenAI API key. Use it? (from OPENAI_API_KEY) (Y/n)
Testing OpenAI endpoint...
✓ OpenAI endpoint test passed
```

See [API Keys Guide](./api-keys.md) for supported providers.

### 2. Documentation Caching

gsdo fetches the OpenCode schema documentation from GitHub and caches it locally:

```
Fetching OpenCode documentation...
```

The cache:
- Stored in `~/.cache/docs-opencode/`
- 24-hour TTL (refreshes daily)
- Used to give the LLM accurate OpenCode context

### 3. Interactive Refinement Loop

You enter a conversation loop with the LLM:

```
Starting enhancement loop...
? What would you like to improve?
> Add better descriptions for the agents based on their system prompts

Calling LLM...
[LLM response with suggested rules]

Validating response...
✓ Validation passed

Applied 3 new rules:
- agent.description: Added description inference
- agent.tools: Mapped tool references
- command.args: Added argument parsing

? Want to try more things? (Y/n)
```

### 4. Rule Validation

Before applying any LLM suggestions, gsdo validates them:

```typescript
interface TransformRule {
  field: string;        // Required: field being transformed
  category: string;     // Required: 'unsupported' | 'platform' | 'missing-dependency'
  suggestion: string;   // Required: actionable suggestion
  example?: string;     // Optional: example transformation
  sourceFile?: string;  // Optional: source file reference
}
```

If validation fails, the error is fed back to the LLM for correction:

```
Validation failed: Rule 0: category must be one of [unsupported, platform, missing-dependency]
Retrying with feedback...
```

### 5. Rule Storage

Valid rules are stored in `llm-rules.json`:

```json
{
  "rules": [
    {
      "field": "agent.description",
      "category": "platform",
      "suggestion": "Infer description from system prompt first sentence"
    },
    {
      "field": "agent.tools",
      "category": "unsupported",
      "suggestion": "OpenCode doesn't support tool arrays; use config.tools instead"
    }
  ]
}
```

This file is separate from the default `transform-rules.json` to keep LLM-generated and hand-written rules distinct.

## Conversation History

The LLM maintains conversation history throughout your session:

- Previous refinement requests are remembered
- LLM avoids repeating failed approaches
- Context accumulates for better suggestions

Example multi-turn conversation:

```
? What would you like to improve?
> Focus on agent descriptions

[LLM suggests description improvements]

? Want to try more things? (Y/n) Y

? What would you like to improve?
> Now improve the command mappings

[LLM suggests command improvements, aware of previous agent work]
```

## What LLM Enhancement Can Do

### Improve Gap Suggestions

The algorithmic pass identifies unmapped fields with generic suggestions. The LLM can provide:

- Context-aware alternatives
- Workarounds specific to your use case
- Links to relevant documentation

### Generate New Transform Rules

The LLM can create rules for edge cases not covered by the default transform rules:

- Custom field mappings
- Provider-specific adaptations
- Semantic transformations

### Explain Shortfalls

The LLM can explain why certain features can't be mapped:

- Platform limitations
- Architectural differences
- Missing dependencies

## What LLM Enhancement Cannot Do

### Modify Files Directly

The LLM doesn't directly edit your configuration files. It only generates rules that the transpiler applies on the next run.

### Access External Resources

The LLM cannot:
- Fetch additional documentation
- Access your file system
- Make external API calls

### Guarantee Correctness

LLM suggestions are validated but not guaranteed to work. Always review the generated `llm-rules.json` before relying on it.

## Skipping Enhancement

To skip the enhancement prompt:

```bash
# Use the flag
gfh transpile --no-enhance

# Or decline the prompt
? Enhance transpilation with LLM? (requires API key) (y/N) N
```

Enhancement is also automatically skipped in:
- `--quiet` mode (no interactive prompts)
- `--dry-run` mode (no file writes)
- Failed transpilation (nothing to enhance)

## No API Key? Local LLMs

If you don't have an API key, gfh suggests local alternatives:

```
No API key configured. You can still get enhanced reports by running a local LLM:

• Ollama: https://ollama.ai/docs/getting-started
• LM Studio: https://lmstudio.ai/
• llama.cpp: https://github.com/ggerganov/llama.cpp

Or use --no-enhance to skip this prompt next time.
```

### Using Ollama

1. Install Ollama: `brew install ollama` (macOS) or download from [ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull mistral`
3. Start the server: `ollama serve`
4. Configure gfh:
   ```bash
   export OPENAI_API_KEY="ollama"
   export OPENAI_API_BASE="http://localhost:11434/v1"
   ```
5. Run: `gfh transpile`

### Using LM Studio

1. Download from [lmstudio.ai](https://lmstudio.ai)
2. Download a model (Mistral, Llama 2, etc.)
3. Start the local server (Settings > Local Server)
4. Configure gfh:
   ```bash
   export OPENAI_API_KEY="lm-studio"
   export OPENAI_API_BASE="http://localhost:1234/v1"
   ```
5. Run: `gfh transpile`

## Error Handling

### API Errors

If the LLM API returns an error:

```
LLM API error: 429 Too Many Requests
Enhancement failed. Continuing with algorithmic result.
```

Enhancement errors don't fail the transpilation - you still get the algorithmic result.

### Validation Errors

If the LLM returns invalid JSON:

```
Validation failed: Missing "rules" array
Retrying with feedback...
```

Validation errors are fed back to the LLM for correction.

### Network Errors

If the endpoint is unreachable:

```
✗ OpenAI endpoint test failed: Network error
? Try alternative provider? (Y/n)
```

You can try a different provider or continue without enhancement.

## Best Practices

### 1. Start Specific

Instead of "improve everything," ask for specific improvements:

```
? What would you like to improve?
> Focus on mapping the authentication-related agents
```

### 2. Iterate Incrementally

Make small refinements and verify each one:

```
> Add descriptions to agents
[verify results]
> Now add examples to the suggestions
[verify results]
```

### 3. Review Generated Rules

Always check `llm-rules.json` after enhancement:

```bash
cat .opencode/llm-rules.json
```

Remove any rules that don't make sense for your use case.

### 4. Combine with Manual Editing

LLM enhancement is a starting point. You can:
- Edit `llm-rules.json` manually
- Move validated rules to `transform-rules.json`
- Delete rules that don't work

## Technical Details

### Cache Location

```
~/.cache/docs-opencode/opencode-docs.cache
```

The cache is stored in the user's home directory, making it centrally accessible regardless of where the command is run. Future platform support will use the pattern `~/.cache/docs-{platform}/`, for example:
- `~/.cache/docs-opencode/` (current)
- `~/.cache/docs-antigravity/` (planned)
- `~/.cache/docs-cursor/` (planned)

### TTL

24 hours (86400 seconds). After expiration, docs are re-fetched from GitHub.

### Supported Models

| Provider | Default Model |
|----------|--------------|
| OpenAI | `gpt-4-turbo` |
| Google Gemini | `gemini-2.0-flash` |
| Anthropic | `claude-3-5-sonnet-20241022` |
| OpenRouter | `anthropic/claude-3.5-sonnet` |
| Azure | Configured via `AZURE_OPENAI_DEPLOYMENT` |

### Request Parameters

```json
{
  "model": "gpt-4-turbo",
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 2000
}
```

---

*Next: [Transpilation](./transpilation.md)*
