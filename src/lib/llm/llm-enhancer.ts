/**
 * LLM Enhancement Orchestrator
 *
 * Orchestrates the LLM enhancement loop: fetches OpenCode docs, maintains conversation
 * history, calls LLM APIs, validates output, and applies validated rules.
 */

import { text, confirm, isCancel } from '@clack/prompts';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import pc from 'picocolors';
import { log } from '../logger.js';
import type { APIConfig } from './types.js';
import { DocsCacheManager } from './cache-manager.js';
import { validateTransformRules, type TransformRule } from './schema-validator.js';
import type { TranspileResult } from '../../types/index.js';

/**
 * Message in conversation history
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Result of enhancement operation
 */
export interface EnhancementResult {
  /** Whether enhancement completed successfully */
  success: boolean;
  /** Number of rules applied */
  appliedRules: number;
  /** Errors encountered during enhancement */
  errors: string[];
}

/**
 * OpenAI-compatible chat completion request
 */
interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
}

/**
 * OpenAI-compatible chat completion response
 */
interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * LLM Enhancement Orchestrator
 *
 * Manages iterative refinement loop with LLM to improve transpilation quality.
 */
export class LLMEnhancer {
  private apiConfig: APIConfig;
  private cacheManager: DocsCacheManager;
  private conversationHistory: ConversationMessage[] = [];

  constructor(apiConfig: APIConfig, cacheManager: DocsCacheManager) {
    this.apiConfig = apiConfig;
    this.cacheManager = cacheManager;
  }

  /**
   * Enhance transpilation result with LLM suggestions
   *
   * Enters interactive loop where user can request refinements,
   * LLM provides suggestions, and validated rules are applied.
   *
   * @param result Transpilation result to enhance
   * @param opencodeConfigDir Directory containing OpenCode config
   * @returns Enhancement result with applied rules count
   */
  async enhanceTranspilationResult(
    result: TranspileResult,
    opencodeConfigDir: string
  ): Promise<EnhancementResult> {
    const errors: string[] = [];
    let totalAppliedRules = 0;

    try {
      // Load OpenCode documentation
      log.info('');
      log.info(pc.cyan('LLM Enhancement'));
      log.info('');

      const opencodeDocs = await this.cacheManager.fetchOpenCodeDocs();

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(opencodeDocs, result);

      log.info('');
      log.info('Starting enhancement loop...');
      log.info(pc.dim('You can iterate multiple times to refine the transpilation.'));
      log.info('');

      // Enter iteration loop
      while (true) {
        // Gather user refinement request
        const userRequest = await this.gatherUserRefinementRequest();
        if (userRequest === null) {
          // User cancelled
          log.info('Enhancement cancelled');
          break;
        }

        // Add to conversation history
        this.conversationHistory.push({
          role: 'user',
          content: userRequest
        });

        // Call LLM
        log.info('Calling LLM...');
        let llmResponse: string;
        try {
          llmResponse = await this.callLLM(systemPrompt, this.conversationHistory);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          log.error(`LLM call failed: ${errorMsg}`);
          errors.push(`LLM call failed: ${errorMsg}`);

          // Ask if user wants to retry
          const retry = await confirm({
            message: 'Retry with a different request?',
            initialValue: true
          });

          if (isCancel(retry) || !retry) {
            break;
          }

          // Remove failed user message and retry
          this.conversationHistory.pop();
          continue;
        }

        log.verbose(`LLM response: ${llmResponse.substring(0, 200)}...`);

        // Add assistant response to history
        this.conversationHistory.push({
          role: 'assistant',
          content: llmResponse
        });

        // Parse response
        let parsedResponse: unknown;
        try {
          parsedResponse = this.parseEnhancementResponse(llmResponse);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Parse error';
          log.error(`Failed to parse LLM response: ${errorMsg}`);

          // Add error feedback to conversation
          this.conversationHistory.push({
            role: 'user',
            content: `Parsing failed: ${errorMsg}. Please provide valid JSON in the format: {"rules": [...]}`
          });

          // Continue loop to allow LLM to fix
          continue;
        }

        // Validate response
        const validation = validateTransformRules(parsedResponse);

        if (!validation.valid) {
          log.error('LLM output validation failed:');
          validation.errors.forEach(err => log.error(`  - ${err}`));

          // Add validation error feedback to conversation
          this.conversationHistory.push({
            role: 'user',
            content: `Validation failed:\n${validation.errors.join('\n')}\n\nPlease fix and try again.`
          });

          // Continue loop to allow LLM to fix
          continue;
        }

        // Apply enhancement
        const rules = (parsedResponse as { rules: TransformRule[] }).rules;
        log.success(`Validation passed! Found ${rules.length} rule(s)`);

        try {
          await this.applyEnhancement(rules, opencodeConfigDir);
          totalAppliedRules += rules.length;

          // Display what changed
          log.info('');
          log.success('Applied rules:');
          rules.forEach((rule, idx) => {
            log.success(`  ${idx + 1}. ${rule.field} (${rule.category}): ${rule.suggestion}`);
          });
          log.info('');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          log.error(`Failed to apply enhancement: ${errorMsg}`);
          errors.push(`Apply failed: ${errorMsg}`);
        }

        // Ask if user wants to continue
        const continueEnhancement = await confirm({
          message: 'Want to try more things?',
          initialValue: true
        });

        if (isCancel(continueEnhancement) || !continueEnhancement) {
          log.info('Enhancement complete');
          break;
        }
      }

      return {
        success: errors.length === 0,
        appliedRules: totalAppliedRules,
        errors
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Enhancement failed: ${errorMsg}`);
      return {
        success: false,
        appliedRules: totalAppliedRules,
        errors: [...errors, errorMsg]
      };
    }
  }

  /**
   * Build system prompt with OpenCode docs and current gaps
   */
  private buildSystemPrompt(opencodeDocs: string, result: TranspileResult): string {
    const gapsSection = result.gaps
      ? `
Current Gaps:
${result.gaps.unmappedFields.map(f => `- ${f.field}: ${f.reason} (${f.category})`).join('\n')}
${result.gaps.approximations.map(a => `- ${a.original} → ${a.approximatedAs}: ${a.reason}`).join('\n')}
`.trim()
      : 'No gaps reported';

    return `You are an expert at transpiling GSD context engineering to OpenCode format.

Review the algorithmic transpilation result and suggest improvements as transformation rules.

OpenCode Schema Documentation:
${opencodeDocs}

${gapsSection}

Respond with JSON in this exact format:
{
  "rules": [
    {
      "field": "field-name",
      "category": "unsupported" | "platform" | "missing-dependency",
      "suggestion": "actionable suggestion for user",
      "example": "optional example",
      "sourceFile": "optional source file reference"
    }
  ]
}

Only suggest rules that address real gaps or improvements. Be specific and actionable.`;
  }

  /**
   * Gather user refinement request interactively
   *
   * @returns User request or null if cancelled
   */
  private async gatherUserRefinementRequest(): Promise<string | null> {
    const request = await text({
      message: 'What would you like to improve?',
      placeholder: 'e.g., "Add better handling for custom tools", "Improve agent descriptions"'
    });

    if (isCancel(request)) {
      return null;
    }

    if (!request || request.trim().length === 0) {
      log.warn('Empty request, please provide specific guidance');
      return this.gatherUserRefinementRequest();
    }

    return request.trim();
  }

  /**
   * Call LLM with system prompt and conversation history
   *
   * @param systemPrompt System message with instructions and context
   * @param messages Conversation history
   * @returns Assistant response content
   * @throws Error if API call fails
   */
  private async callLLM(systemPrompt: string, messages: ConversationMessage[]): Promise<string> {
    const url = `${this.apiConfig.endpoint}/chat/completions`;

    const requestBody: ChatCompletionRequest = {
      model: this.apiConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      temperature: 0.7,
      max_tokens: 2000
    };

    log.verbose(`LLM request to ${url}`);
    log.verbose(`Model: ${this.apiConfig.model}`);
    log.verbose(`Messages: ${messages.length + 1} (including system)`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiConfig.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      log.verbose(`Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        log.verbose(`Error response: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as ChatCompletionResponse;

      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('Invalid response structure: missing choices array');
      }

      const content = data.choices[0].message.content;
      log.verbose(`Response length: ${content.length} chars`);

      return content;
    } catch (error) {
      if (error instanceof Error) {
        log.verbose(`LLM call error: ${error.message}`);
        throw new Error(`LLM API call failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Parse LLM enhancement response
   *
   * Handles both raw JSON and markdown-wrapped JSON blocks.
   *
   * @param response LLM response text
   * @returns Parsed object
   * @throws Error if parsing fails
   */
  private parseEnhancementResponse(response: string): unknown {
    // Try direct JSON parse first
    try {
      return JSON.parse(response);
    } catch {
      // Look for JSON in markdown code block
      const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        const jsonContent = jsonBlockMatch[1];
        try {
          return JSON.parse(jsonContent);
        } catch (error) {
          throw new Error('Invalid JSON in markdown code block');
        }
      }

      // Look for any JSON-like content (starts with { or [)
      const jsonMatch = response.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (error) {
          throw new Error('Found JSON-like content but failed to parse');
        }
      }

      throw new Error('No valid JSON found in response');
    }
  }

  /**
   * Apply validated enhancement rules to ~/.gsdo/llm-rules.json
   *
   * @param rules Validated transformation rules
   * @param _opencodeConfigDir OpenCode config directory (unused, kept for compatibility)
   */
  private async applyEnhancement(rules: TransformRule[], _opencodeConfigDir: string): Promise<void> {
    const gsdoDir = join(homedir(), '.gsdo');
    const rulesPath = join(gsdoDir, 'llm-rules.json');

    // Ensure ~/.gsdo directory exists
    await mkdir(gsdoDir, { recursive: true });

    // Load existing rules if file exists
    let existingRules: TransformRule[] = [];
    try {
      const content = await readFile(rulesPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.rules && Array.isArray(parsed.rules)) {
        existingRules = parsed.rules;
      }
    } catch (error) {
      // File doesn't exist or invalid - start fresh
      log.verbose(`Starting fresh llm-rules.json (previous file read failed)`);
    }

    // Merge new rules with existing (simple append for MVP)
    const allRules = [...existingRules, ...rules];

    // Sort by field name for deterministic output
    allRules.sort((a, b) => a.field.localeCompare(b.field));

    // Write back to file
    const output = {
      version: '1.0',
      rules: allRules
    };

    await writeFile(rulesPath, JSON.stringify(output, null, 2), 'utf-8');

    log.verbose(`Wrote ${allRules.length} rules to ${rulesPath}`);
  }
}
