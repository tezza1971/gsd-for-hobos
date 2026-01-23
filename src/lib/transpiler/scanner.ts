/**
 * GSD Command Scanner
 *
 * Scans the GSD workflows directory and extracts command definitions from markdown files.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { GsdCommand } from './types.js';

/**
 * Scans GSD workflows directory for command files
 *
 * @param gsdPath - Base path to GSD installation (e.g., ~/.claude/get-shit-done)
 * @returns Array of GSD commands found in the workflows directory
 */
export function scanGsdCommands(gsdPath: string): GsdCommand[] {
  const workflowsPath = join(gsdPath, 'workflows');

  // Handle missing directory gracefully
  if (!existsSync(workflowsPath)) {
    return [];
  }

  try {
    const files = readdirSync(workflowsPath);

    // Filter for all .md files (Windows can't handle gsd: in filenames)
    const commandFiles = files.filter(
      (file) => file.endsWith('.md')
    );

    // Process each command file
    const commands: GsdCommand[] = commandFiles.map((filename) => {
      const filePath = join(workflowsPath, filename);
      const rawContent = readFileSync(filePath, 'utf-8');

      // Extract name from filename (remove .md extension) and prepend /gsd:
      const baseName = filename.replace(/\.md$/, '');
      const name = '/gsd:' + baseName;

      // Try to extract description from first H1 or H2
      const description = extractDescription(rawContent);

      return {
        name,
        filePath,
        rawContent,
        description,
      };
    });

    return commands;
  } catch (error) {
    // Return empty array on any read errors
    return [];
  }
}

/**
 * Extracts description from markdown content
 *
 * Looks for first H1 (# ) or H2 (## ) heading
 *
 * @param content - Markdown file content
 * @returns Extracted description or undefined
 */
function extractDescription(content: string): string | undefined {
  const match = content.match(/^##?\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}
