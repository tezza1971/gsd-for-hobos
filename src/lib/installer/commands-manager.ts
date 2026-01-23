/**
 * Commands Manager
 *
 * Safe read/write operations for OpenCode commands.json.
 * Handles merging new commands with existing ones while preserving user's config.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { OpenCodeCommand } from '../transpiler/types.js';

/**
 * Reads existing commands from OpenCode commands.json
 *
 * @param opencodePath - Path to OpenCode config directory (e.g., ~/.config/opencode)
 * @returns Array of existing commands (empty array if file doesn't exist)
 * @throws Error if JSON parsing fails
 */
export function readCommands(opencodePath: string): OpenCodeCommand[] {
  const commandsPath = join(opencodePath, 'commands.json');

  // If file doesn't exist, return empty array
  if (!existsSync(commandsPath)) {
    return [];
  }

  try {
    const content = readFileSync(commandsPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle both array and object formats
    if (Array.isArray(parsed)) {
      return parsed;
    }

    // Some configs might wrap commands in an object
    if (parsed && Array.isArray(parsed.commands)) {
      return parsed.commands;
    }

    // If neither format, return empty array
    return [];
  } catch (error) {
    throw new Error(
      `Failed to parse commands.json: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Merges new commands with existing ones
 *
 * Strategy: Replace existing commands with same name, append new commands.
 * Preserves order: existing commands first (updated), then new commands.
 *
 * @param existing - Array of existing OpenCode commands
 * @param newCommands - Array of new commands to merge in
 * @returns Merged array with duplicates resolved
 */
export function mergeCommands(
  existing: OpenCodeCommand[],
  newCommands: OpenCodeCommand[]
): OpenCodeCommand[] {
  // Create map of new commands for O(1) lookup
  const newCommandsMap = new Map<string, OpenCodeCommand>();
  for (const cmd of newCommands) {
    newCommandsMap.set(cmd.name, cmd);
  }

  // Update existing commands or keep as-is
  const updated = existing.map((cmd) => {
    const replacement = newCommandsMap.get(cmd.name);
    if (replacement) {
      // Mark as consumed
      newCommandsMap.delete(cmd.name);
      return replacement;
    }
    return cmd;
  });

  // Append remaining new commands (ones not in existing)
  const remaining = Array.from(newCommandsMap.values());

  return [...updated, ...remaining];
}

/**
 * Writes individual command .md files to the commands directory
 *
 * Each command needs a corresponding .md file with YAML frontmatter.
 * The filename (without .md) becomes the command name in OpenCode.
 *
 * @param opencodePath - Path to OpenCode config directory
 * @param commands - Array of commands to write
 * @throws Error if write fails
 */
export function writeCommandFiles(
  opencodePath: string,
  commands: OpenCodeCommand[]
): void {
  const commandsDir = join(opencodePath, 'command');

  // Ensure commands directory exists
  try {
    if (!existsSync(commandsDir)) {
      mkdirSync(commandsDir, { recursive: true });
    }
  } catch (error) {
    throw new Error(
      `Failed to create command directory: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  for (const cmd of commands) {
    const mdContent = `---
type: prompt
name: ${cmd.name}
description: ${cmd.description || ''}
allowed-tools:
  - Read
  - Write
  - Bash
---

${cmd.promptTemplate}
`;

    // Sanitize filename by replacing invalid characters (colons) with hyphens
    // The command name in frontmatter stays intact for OpenCode's command picker
    const sanitizedName = cmd.name.replace(/:/g, '-');
    const filePath = join(commandsDir, `${sanitizedName}.md`);
    try {
      writeFileSync(filePath, mdContent, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to write command file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Writes commands to OpenCode commands.json
 *
 * Overwrites existing file with formatted JSON (2-space indentation).
 * No backup/rollback - re-run installer for recovery.
 *
 * @param opencodePath - Path to OpenCode config directory
 * @param commands - Array of commands to write
 * @throws Error if write fails
 */
export function writeCommands(
  opencodePath: string,
  commands: OpenCodeCommand[]
): void {
  const commandsPath = join(opencodePath, 'commands.json');

  try {
    const json = JSON.stringify(commands, null, 2);
    writeFileSync(commandsPath, json, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to write commands.json: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Creates /gsdo command definition for OpenCode.
 * This command allows users to manually re-enhance transpiled GSD commands.
 *
 * The command is autonomous - it runs without user input, loading context,
 * creating backups, and enhancing commands with detailed output.
 *
 * @returns OpenCodeCommand for /gsdo enhancement
 */
export function createGsdoCommand(): OpenCodeCommand {
  return {
    name: 'gsdo',
    description: 'Enhance transpiled GSD commands using OpenCode\'s LLM (autonomous, no input required)',
    promptTemplate: `You are enhancing transpiled GSD commands for OpenCode compatibility.

This is an autonomous operation - do not request user input.

Context available:
- Install log: ~/.gsdo/install.log (transpilation warnings/errors)
- OpenCode docs: ~/.gsdo/cache/docs-opencode/README.md
- Current commands: commands.json
- Original GSD source: ~/.claude/get-shit-done/skills/

Enhancement scope (conservative fixes only):
1. Fix command naming issues
2. Fix broken references to GSD-specific files
3. Add missing parameters
4. Improve prompt templates for OpenCode patterns

DO NOT remove, merge, or restructure commands.

Process:
1. Load context from files above
2. For each /gsd-* command, analyze and enhance
3. Create backup: commands.json.TIMESTAMP.backup
4. Write enhanced commands back to commands.json
5. Show detailed per-command report of changes

Always exit with code 0 on success.`
  };
}
