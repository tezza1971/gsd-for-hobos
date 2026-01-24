/**
 * Commands Manager
 *
 * Writes individual command .md files to OpenCode's command directory.
 */

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadGsdoTemplate, extractPromptTemplate } from './template-loader.js';
import type { OpenCodeCommand } from '../transpiler/types.js';

/**
 * Creates the /gsdo command definition for OpenCode.
 * Loads the template from ./templates/gsdo.md and extracts the prompt content.
 * This allows for easy editing and updating of the gsdo command without code changes.
 *
 * @returns OpenCodeCommand for /gsdo enhancement
 * @throws Error if template cannot be loaded
 */
export function createGsdoCommand(): OpenCodeCommand {
  const templateContent = loadGsdoTemplate();
  const promptTemplate = extractPromptTemplate(templateContent);

  return {
    name: 'gsdo',
    description: 'Enhance transpiled GSD commands for OpenCode compatibility',
    promptTemplate
  };
}

/**
 * Writes individual command .md files to the commands directory
 *
 * Each command is written as a separate .md file with YAML frontmatter.
 * OpenCode automatically picks up these files for command registration.
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
