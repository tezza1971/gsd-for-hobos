/**
 * Type definitions for enhancement engine
 *
 * Enhancement engine loads context from multiple sources:
 * - install.log (transpilation history, failed commands)
 * - OpenCode docs cache (official command examples and patterns)
 * - Current commands.json (transpiled commands to enhance)
 * - GSD skills path (source markdown files)
 */

import type { OpenCodeCommand } from '../transpiler/types.js';

/**
 * Enhancement context - all data needed for LLM enhancement.
 * Includes transpilation history, documentation, and current commands.
 */
export interface EnhancementContext {
  /** Raw install.log content (transpilation history, errors, warnings) */
  installLog: string;

  /** Cached OpenCode README.md content (official docs and examples) */
  opencodeDocsCache: string;

  /** Path to GSD skills directory (~/.claude/get-shit-done/skills/) */
  gsdSkillsPath: string;

  /** Path to OpenCode config directory (where commands.json lives) */
  opencodeConfigPath: string;

  /** Current commands from commands.json (to be enhanced) */
  commands: OpenCodeCommand[];
}

/**
 * Enhancement result for a single command.
 * Tracks whether command was modified and what changes were made.
 */
export interface EnhancementResult {
  /** Name of the command that was enhanced */
  commandName: string;

  /** True if command was modified, false if no changes needed */
  enhanced: boolean;

  /** List of improvements made (e.g., "Fixed description", "Improved prompt template") */
  changes: string[];

  /** LLM's explanation of why changes were made (or why no changes needed) */
  reasoning: string;

  /** Original command before enhancement */
  before: OpenCodeCommand;

  /** Enhanced command after changes (null if unchanged or failed) */
  after: OpenCodeCommand | null;

  /** Error message if enhancement failed for this command */
  error?: string;
}
