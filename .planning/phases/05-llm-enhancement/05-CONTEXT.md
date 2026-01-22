# Phase 5: LLM Enhancement - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Optional LLM-powered refinement loop that enhances transpilation quality beyond algorithmic transformation. Users with API access can improve gap suggestions, rewrite configs, and generate new transform rules through an iterative process.

</domain>

<decisions>
## Implementation Decisions

### API Configuration
- Check multiple env vars: OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, etc.
- If env var found, ask user to confirm using that key
- Offer option for alternative env var if assumed endpoint doesn't work
- If no env var, prompt user to paste key manually
- If endpoint can't be guessed, prompt for that too
- After successful setup, offer to export to env vars for current shell session (not permanent)
- Test endpoints in order until one works when multiple keys found
- If all tests fail, offer manual entry as final fallback

### Enhancement Scope
- LLM enhances both gap suggestions AND config content
- Fetch OpenCode docs from GitHub raw (sst/opencode repo)
- Cache docs to disk with 24-hour TTL refresh
- LLM can generate new transform rules for unmapped features
- Store LLM-generated rules in separate llm-rules.json
- Apply improved configs automatically (backup already exists from Phase 3)
- Always explain what changed and why
- Works with any OpenAI-compatible model (chat completions API)
- Schema-validate LLM output before applying
- On validation failure, retry with feedback about what was wrong

### Iteration Flow
- Always offer "want to try more things?" after each enhancement
- Guided refinement: LLM suggests what could be improved, user picks
- No maximum iteration limit — user decides when to stop
- Full conversation history passed to inform subsequent iterations

### No-key Experience
- Different messages for: all detection failed vs user declined
- Mention multiple local LLM options: Ollama, LM Studio, llama.cpp
- Include links to getting started docs for each tool
- --no-enhance flag to skip LLM phase entirely

### Claude's Discretion
- Exact prompt engineering for LLM requests
- Schema validation implementation details
- Retry limit for validation failures
- Session env var export mechanism

</decisions>

<specifics>
## Specific Ideas

- Multi-provider scan mirrors how users might have various API keys from different sources
- Session-scoped env export avoids polluting user's permanent environment
- Separate llm-rules.json keeps human-written and LLM-generated rules distinct
- Full iteration history helps LLM avoid repeating failed approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-llm-enhancement*
*Context gathered: 2026-01-22*
