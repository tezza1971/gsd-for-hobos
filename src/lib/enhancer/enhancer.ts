/**
 * Per-Command Enhancement Logic
 *
 * Analyzes each transpiled command individually with focused, context-rich prompts.
 * Applies conservative fixes: naming, references, parameters, templates.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { callLLM } from './llm-client.js';
import type { OpenCodeCommand } from '../transpiler/types.js';
import type { EnhancementContext, EnhancementResult } from './types.js';

/**
 * Builds focused enhancement prompt for a single command.
 * Includes all relevant context: command JSON, GSD source, install.log excerpts, docs.
 *
 * Enhancement coverage:
 * - ENHANCE-05: Naming issues (instruction #4)
 * - ENHANCE-06: Prompt templates (instruction #5)
 * - ENHANCE-07: Missing parameters (instruction #3)
 * - ENHANCE-08: Broken references (instruction #1)
 * - ENHANCE-09: Update in place (handled by caller via writeEnhancedCommands)
 *
 * @param command - OpenCode command to enhance
 * @param gsdSource - Original GSD markdown content
 * @param context - Enhancement context (install.log, docs, etc.)
 * @returns Prompt string for LLM
 */
function buildEnhancementPrompt(
  command: OpenCodeCommand,
  gsdSource: string,
  context: EnhancementContext
): string {
  // Extract relevant excerpts from install.log (warnings/errors for this command)
  const commandLogExcerpts = extractRelevantLogExcerpts(command.name, context.installLog);

  // Extract relevant excerpts from OpenCode docs (command schema, best practices)
  const docsExcerpts = extractRelevantDocsExcerpts(context.opencodeDocsCache);

  return `You are enhancing a transpiled OpenCode command to make it production-ready.

CURRENT COMMAND (JSON):
\`\`\`json
${JSON.stringify(command, null, 2)}
\`\`\`

ORIGINAL GSD SOURCE:
\`\`\`markdown
${gsdSource}
\`\`\`

${commandLogExcerpts ? `RELEVANT INSTALL LOG EXCERPTS:\n${commandLogExcerpts}\n\n` : ''}

${docsExcerpts ? `OPENCODE DOCUMENTATION:\n${docsExcerpts}\n\n` : ''}

ENHANCEMENT INSTRUCTIONS:

Apply CONSERVATIVE fixes only:
1. Fix broken references to GSD-specific files (STATE.md, ROADMAP.md, PROJECT.md) - replace with OpenCode equivalents or remove if not applicable [ENHANCE-08]
2. Improve command description - make it more specific and action-oriented
3. Add missing parameters if obvious from GSD source [ENHANCE-07]
4. Fix naming issues - ensure consistent capitalization and clarity [ENHANCE-05]
5. Improve prompt template clarity - but DO NOT change core functionality [ENHANCE-06]

DO NOT:
- Remove, merge, or restructure commands
- Change core functionality
- Add features not in original GSD source
- Make assumptions about user's workflow

Return ONLY valid JSON in this exact format (no markdown fences, no extra text):
{
  "enhanced": {
    "name": "...",
    "description": "...",
    "promptTemplate": "..."
  },
  "reasoning": "Brief explanation of why changes were made (or why no changes were needed)"
}`;
}

/**
 * Extracts relevant log excerpts for a specific command.
 * Looks for warnings/errors that mention the command name.
 *
 * @param commandName - Name of command to search for
 * @param installLog - Full install.log content
 * @returns Relevant excerpts or empty string
 */
function extractRelevantLogExcerpts(commandName: string, installLog: string): string {
  if (!installLog) return '';

  const lines = installLog.split('\n');
  const relevantLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for lines mentioning this command
    if (line.includes(commandName)) {
      // Include context: 2 lines before and after
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 3);
      relevantLines.push(...lines.slice(start, end));
      i = end; // Skip ahead to avoid duplicates
    }
  }

  return relevantLines.length > 0 ? relevantLines.join('\n') : '';
}

/**
 * Extracts relevant excerpts from OpenCode docs.
 * Focuses on command schema and best practices sections.
 *
 * @param opencodeDocsCache - Full OpenCode README.md content
 * @returns Relevant excerpts or empty string
 */
function extractRelevantDocsExcerpts(opencodeDocsCache: string): string {
  if (!opencodeDocsCache) return '';

  // Extract first 1000 characters (typically contains command schema and overview)
  const excerpt = opencodeDocsCache.substring(0, 1000);

  return excerpt;
}

/**
 * Enhancement response from LLM (new format with reasoning)
 */
interface EnhancementLLMResponse {
  enhanced: OpenCodeCommand;
  reasoning: string;
}

/**
 * Parses LLM response to extract enhanced command JSON and reasoning.
 * Handles both new format (with reasoning) and legacy format (command only).
 * Handles markdown code fences and plain JSON responses.
 *
 * @param response - Raw LLM response text
 * @returns Parsed response with command and reasoning, or null if parse failed
 */
function parseLLMResponse(response: string): EnhancementLLMResponse | null {
  try {
    // Try to extract JSON from markdown code fences
    const codeFenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = codeFenceMatch ? codeFenceMatch[1].trim() : response.trim();

    const parsed = JSON.parse(jsonText);

    // New format: { enhanced: {...}, reasoning: "..." }
    if (parsed.enhanced && typeof parsed.reasoning === 'string') {
      return {
        enhanced: parsed.enhanced,
        reasoning: parsed.reasoning
      };
    }

    // Legacy format: { name: "...", description: "...", promptTemplate: "..." }
    if (parsed.name && parsed.description && parsed.promptTemplate) {
      return {
        enhanced: parsed,
        reasoning: '(No reasoning provided)'
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Compares original and enhanced commands to identify changes.
 *
 * @param original - Original command
 * @param enhanced - Enhanced command
 * @returns List of changes made
 */
function identifyChanges(original: OpenCodeCommand, enhanced: OpenCodeCommand): string[] {
  const changes: string[] = [];

  if (original.name !== enhanced.name) {
    changes.push(`Renamed: ${original.name} → ${enhanced.name}`);
  }

  if (original.description !== enhanced.description) {
    changes.push('Updated description');
  }

  if (original.promptTemplate !== enhanced.promptTemplate) {
    changes.push('Improved prompt template');
  }

  return changes;
}

/**
 * Enhances a single command using LLM analysis.
 * Loads GSD source, builds prompt, calls LLM, parses response, identifies changes.
 *
 * @param command - Command to enhance
 * @param context - Enhancement context
 * @param opencodeConfigPath - Path to OpenCode config directory
 * @returns Enhancement result with changes or error
 */
export async function enhanceCommand(
  command: OpenCodeCommand,
  context: EnhancementContext,
  opencodeConfigPath: string
): Promise<EnhancementResult> {
  try {
    // Load original GSD markdown
    // Convert command name to filename: gsd-plan-phase -> gsd:plan-phase.md
    const gsdFilename = command.name.replace(/^gsd-/, 'gsd:') + '.md';
    const gsdFilePath = join(context.gsdSkillsPath, gsdFilename);

    let gsdSource = '';
    if (existsSync(gsdFilePath)) {
      gsdSource = await readFile(gsdFilePath, 'utf-8');
    } else {
      // Graceful degradation: continue without GSD source
      console.warn(`GSD source not found for ${command.name}: ${gsdFilePath}`);
      gsdSource = '(Original GSD source file not found)';
    }

    // Build enhancement prompt
    const prompt = buildEnhancementPrompt(command, gsdSource, context);

    // Call LLM with prompt (with one internal retry)
    let llmResponse: string;
    try {
      llmResponse = await callLLM(prompt, opencodeConfigPath);
    } catch (firstError) {
      // Retry once with refined prompt emphasizing JSON-only output
      const refinedPrompt = prompt + '\n\nIMPORTANT: Return ONLY valid JSON. No explanations, no markdown fences, just the JSON object.';
      try {
        llmResponse = await callLLM(refinedPrompt, opencodeConfigPath);
      } catch (retryError) {
        // Both attempts failed - return error result
        return {
          commandName: command.name,
          enhanced: false,
          changes: [],
          reasoning: '',
          before: command,
          after: null,
          error: `LLM call failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`
        };
      }
    }

    // Parse LLM response
    const llmResult = parseLLMResponse(llmResponse);
    if (!llmResult) {
      return {
        commandName: command.name,
        enhanced: false,
        changes: [],
        reasoning: '',
        before: command,
        after: null,
        error: 'Failed to parse LLM response as valid JSON'
      };
    }

    const { enhanced: enhancedCommand, reasoning } = llmResult;

    // Compare original vs enhanced to identify changes
    const changes = identifyChanges(command, enhancedCommand);

    return {
      commandName: command.name,
      enhanced: changes.length > 0,
      changes,
      reasoning,
      before: command,
      after: changes.length > 0 ? enhancedCommand : null
    };
  } catch (error) {
    // Unexpected error - return error result
    return {
      commandName: command.name,
      enhanced: false,
      changes: [],
      reasoning: '',
      before: command,
      after: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Enhances all GSD commands in the context.
 * Filters to only /gsd-* commands, processes sequentially, collects all results.
 * Updates context.commands in place with enhanced versions.
 *
 * @param context - Enhancement context with commands to enhance
 * @param opencodeConfigPath - Path to OpenCode config directory
 * @returns Array of enhancement results (successes and failures)
 */
export async function enhanceAllCommands(
  context: EnhancementContext,
  opencodeConfigPath: string
): Promise<EnhancementResult[]> {
  // Filter to only gsd-* commands (skip non-GSD commands)
  const gsdCommands = context.commands.filter(cmd => cmd.name.startsWith('gsd-'));

  const results: EnhancementResult[] = [];

  // Process each command sequentially (avoid rate limits)
  for (const command of gsdCommands) {
    const result = await enhanceCommand(command, context, opencodeConfigPath);
    results.push(result);

    // Update context.commands with enhanced version (if successful)
    if (result.enhanced && result.after) {
      const commandIndex = context.commands.findIndex(cmd => cmd.name === command.name);
      if (commandIndex !== -1) {
        context.commands[commandIndex] = result.after;
      }
    }

    // Small delay between calls to avoid rate limiting
    if (results.length < gsdCommands.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}
