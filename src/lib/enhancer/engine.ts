/**
 * Enhancement Engine Core
 *
 * Handles context loading, backup, and persistence for command enhancement.
 * Coordinates file I/O operations needed for LLM-powered enhancement.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { detectGsd, detectOpenCode } from '../detector.js';
import { readCommands, writeCommands } from '../installer/commands-manager.js';
import { getDocsOpenCodeCachePath } from '../cache/paths.js';
import { resolveHome } from '../paths.js';
import type { EnhancementContext } from './types.js';
import type { OpenCodeCommand } from '../transpiler/types.js';

/**
 * Loads all context required for command enhancement.
 * Returns partial context if some files are missing (graceful degradation).
 *
 * @returns Enhancement context with all available data
 * @throws Error only if critical detection fails (OpenCode config path)
 */
export async function loadEnhancementContext(): Promise<EnhancementContext> {
  // Detect installation paths
  const gsdDetection = detectGsd();
  const opencodeDetection = detectOpenCode();

  if (!opencodeDetection.found || !opencodeDetection.path) {
    throw new Error(
      opencodeDetection.error || 'OpenCode config directory not found'
    );
  }

  const opencodeConfigPath = opencodeDetection.path;
  const gsdSkillsPath = gsdDetection.found && gsdDetection.path
    ? join(gsdDetection.path, 'skills')
    : '';

  // Load install.log (graceful: empty string if missing)
  let installLog = '';
  try {
    const installLogPath = resolveHome('~/.gsdo/install.log');
    if (existsSync(installLogPath)) {
      installLog = await readFile(installLogPath, 'utf-8');
    }
  } catch (error) {
    // Silently continue with empty install log
    console.warn('Failed to read install.log:', error);
  }

  // Load cached OpenCode docs (graceful: empty string if missing)
  let opencodeDocsCache = '';
  try {
    const cachePath = getDocsOpenCodeCachePath();
    const readmePath = join(cachePath, 'README.md');
    if (existsSync(readmePath)) {
      opencodeDocsCache = await readFile(readmePath, 'utf-8');
    }
  } catch (error) {
    // Silently continue with empty docs cache
    console.warn('Failed to read OpenCode docs cache:', error);
  }

  // Load current commands (graceful: empty array if missing)
  let commands: OpenCodeCommand[] = [];
  try {
    commands = readCommands(opencodeConfigPath);
  } catch (error) {
    // Silently continue with empty commands array
    console.warn('Failed to read commands.json:', error);
  }

  return {
    installLog,
    opencodeDocsCache,
    gsdSkillsPath,
    opencodeConfigPath,
    commands,
  };
}

/**
 * Creates timestamped backup of commands.json before modifications.
 * Backup format: commands.json.YYYY-MM-DDTHH-mm-ss.backup
 *
 * @param opencodeConfigPath - Path to OpenCode config directory
 * @returns Backup filename (empty string if commands.json doesn't exist)
 * @throws Error if backup write fails
 */
export async function backupCommandsJson(
  opencodeConfigPath: string
): Promise<string> {
  // Read current commands (returns [] if file doesn't exist)
  const commands = readCommands(opencodeConfigPath);

  // Skip backup if no commands exist
  if (commands.length === 0) {
    const commandsPath = join(opencodeConfigPath, 'commands.json');
    if (!existsSync(commandsPath)) {
      return '';
    }
  }

  // Generate timestamped filename
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, '');
  const backupFilename = `commands.json.${timestamp}.backup`;
  const backupPath = join(opencodeConfigPath, backupFilename);

  // Write backup
  try {
    const json = JSON.stringify(commands, null, 2);
    await writeFile(backupPath, json, 'utf-8');
    return backupFilename;
  } catch (error) {
    throw new Error(
      `Failed to create backup at ${backupPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Writes enhanced commands to commands.json.
 * Wrapper around commands-manager for consistency with enhancement API.
 *
 * @param opencodeConfigPath - Path to OpenCode config directory
 * @param commands - Enhanced commands to persist
 * @throws Error if write fails
 */
export function writeEnhancedCommands(
  opencodeConfigPath: string,
  commands: OpenCodeCommand[]
): void {
  writeCommands(opencodeConfigPath, commands);
}
