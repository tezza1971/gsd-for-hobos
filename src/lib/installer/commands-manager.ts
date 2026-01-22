/**
 * Commands Manager
 *
 * Safe read/write operations for OpenCode commands.json.
 * Handles merging new commands with existing ones while preserving user's config.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
