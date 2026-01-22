# API Keys Guide

The LLM enhancement feature requires an API key from a supported provider. This guide covers all supported environment variables, how they're detected, and how to configure them.

## Quick Reference

| Provider | Environment Variable | Endpoint |
|----------|---------------------|----------|
| OpenAI | `OPENAI_API_KEY` | `https://api.openai.com/v1` |
| Google Gemini | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Anthropic | `ANTHROPIC_API_KEY` | `https://api.anthropic.com/v1` |
| OpenRouter | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` | (user-specified) |

## Detection Priority

When you accept the LLM enhancement prompt, gsdo scans for API keys in this order:

1. **OpenAI** (`OPENAI_API_KEY`)
2. **Google Gemini** (`GEMINI_API_KEY`, `GOOGLE_API_KEY`)
3. **Anthropic** (`ANTHROPIC_API_KEY`)
4. **OpenRouter** (`OPENROUTER_API_KEY`)
5. **Azure OpenAI** (`AZURE_OPENAI_API_KEY`)

The first detected key is offered for confirmation. You can decline and try the next provider.

## Provider Details

### OpenAI

The most common choice. Works with GPT-4 Turbo and other OpenAI models.

**Environment Variable:**
```bash
# Linux/macOS
export OPENAI_API_KEY="sk-..."

# Windows PowerShell
$env:OPENAI_API_KEY="sk-..."

# Windows CMD
set OPENAI_API_KEY=sk-...
```

**Default Model:** `gpt-4-turbo`

**Get an API Key:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in or create an account
3. Navigate to API Keys
4. Create a new secret key

### Google Gemini

For Gemini models via Google's OpenAI-compatible API.

**Environment Variable:**
```bash
# Linux/macOS
export GEMINI_API_KEY="your-gemini-key"
# or
export GOOGLE_API_KEY="your-google-key"

# Windows PowerShell
$env:GEMINI_API_KEY="your-gemini-key"
# or
$env:GOOGLE_API_KEY="your-google-key"

# Windows CMD
set GEMINI_API_KEY=your-gemini-key
```

**Default Model:** `gemini-2.0-flash`

**Get an API Key:**
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click "Get API key" in the left sidebar
4. Create a new API key or use an existing one

**Note:** gsdo uses Google's OpenAI-compatible endpoint, so standard chat completions requests work seamlessly.

### Anthropic

For Claude models via the Anthropic API directly.

**Environment Variable:**
```bash
# Linux/macOS
export ANTHROPIC_API_KEY="sk-ant-..."

# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."

# Windows CMD
set ANTHROPIC_API_KEY=sk-ant-...
```

**Default Model:** `claude-3-5-sonnet-20241022`

**Get an API Key:**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign in or create an account
3. Navigate to API Keys
4. Generate a new key

### OpenRouter

A unified API that routes to multiple providers. Great if you want flexibility.

**Environment Variable:**
```bash
# Linux/macOS
export OPENROUTER_API_KEY="sk-or-..."

# Windows PowerShell
$env:OPENROUTER_API_KEY="sk-or-..."

# Windows CMD
set OPENROUTER_API_KEY=sk-or-...
```

**Default Model:** `anthropic/claude-3.5-sonnet`

**Get an API Key:**
1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign in with Google, GitHub, or email
3. Go to Keys in your account
4. Create a new API key

### Azure OpenAI

For enterprise users with Azure OpenAI Service deployments.

**Environment Variables:**
```bash
# Linux/macOS
export AZURE_OPENAI_API_KEY="your-azure-key"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_DEPLOYMENT="gpt-4"  # Optional, defaults to 'gpt-4'

# Windows PowerShell
$env:AZURE_OPENAI_API_KEY="your-azure-key"
$env:AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
$env:AZURE_OPENAI_DEPLOYMENT="gpt-4"

# Windows CMD
set AZURE_OPENAI_API_KEY=your-azure-key
set AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
set AZURE_OPENAI_DEPLOYMENT=gpt-4
```

**Required Variables:**
- `AZURE_OPENAI_API_KEY` - Your Azure API key
- `AZURE_OPENAI_ENDPOINT` - Your deployment endpoint URL

**Optional Variables:**
- `AZURE_OPENAI_DEPLOYMENT` - Deployment name (defaults to `gpt-4`)

**Get Azure OpenAI Access:**
1. Sign in to [Azure Portal](https://portal.azure.com)
2. Create an Azure OpenAI resource
3. Deploy a model (GPT-4 recommended)
4. Copy the endpoint and key from the resource

## Manual Entry

If no environment variable is detected, gsdo offers manual entry:

```
? No API key detected in environment. Enter manually? (y/N)
```

If you accept:
1. You'll be prompted for your API key (masked input)
2. You'll select your provider from a list
3. The endpoint is resolved automatically
4. Connectivity is tested before proceeding

**Note:** Manually entered keys are used in-memory only and discarded when gsdo exits.

## Endpoint Testing

Before entering the enhancement loop, gsdo tests your API endpoint:

```
Testing OpenAI endpoint...
✓ OpenAI endpoint test passed
```

The test:
- Sends a minimal request (`max_tokens: 10`)
- Uses a simple prompt ("respond with ready")
- Times out after 5 seconds
- Reports success or failure

If the test fails:
- You're offered to try an alternative provider
- Or enter credentials manually
- Or skip enhancement entirely

## No API Key? Use Local LLMs

If you don't have an API key, gsdo suggests local alternatives:

```
No API key configured. You can still get enhanced reports by running a local LLM:

• Ollama: https://ollama.ai/docs/getting-started
• LM Studio: https://lmstudio.ai/
• llama.cpp: https://github.com/ggerganov/llama.cpp

Or use --no-enhance to skip this prompt next time.
```

### Setting Up Ollama

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull llama2`
3. Start the server: `ollama serve`
4. Set the environment variable:
   ```bash
   export OPENAI_API_KEY="ollama"
   export OPENAI_API_BASE="http://localhost:11434/v1"
   ```

### Setting Up LM Studio

1. Download from [lmstudio.ai](https://lmstudio.ai)
2. Download a model (e.g., Mistral, Llama)
3. Start the local server (port 1234 by default)
4. Set the environment variable:
   ```bash
   export OPENAI_API_KEY="lm-studio"
   export OPENAI_API_BASE="http://localhost:1234/v1"
   ```

## Security Notes

- **Keys are never persisted** - gsdo stores API keys in memory only
- **Keys are never logged** - Even in verbose mode, keys are masked
- **Keys are discarded on exit** - No trace remains after gsdo terminates
- **Manual entry is masked** - Password-style input hides your key

## Skipping Enhancement

If you don't want to be prompted for LLM enhancement:

```bash
gsdo transpile --no-enhance
```

This skips the enhancement prompt entirely and goes straight to markdown export.

## Environment Variable Summary

| Variable | Required | Provider | Description |
|----------|----------|----------|-------------|
| `OPENAI_API_KEY` | For OpenAI | OpenAI | API key starting with `sk-` |
| `GEMINI_API_KEY` | For Gemini | Google | Gemini API key from AI Studio |
| `GOOGLE_API_KEY` | For Gemini | Google | Alternative to GEMINI_API_KEY |
| `ANTHROPIC_API_KEY` | For Anthropic | Anthropic | API key starting with `sk-ant-` |
| `OPENROUTER_API_KEY` | For OpenRouter | OpenRouter | API key starting with `sk-or-` |
| `AZURE_OPENAI_API_KEY` | For Azure | Azure | Azure resource API key |
| `AZURE_OPENAI_ENDPOINT` | For Azure | Azure | Full endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | Optional | Azure | Deployment name (default: `gpt-4`) |

---

*Next: [CLI Reference](./cli-reference.md)*
