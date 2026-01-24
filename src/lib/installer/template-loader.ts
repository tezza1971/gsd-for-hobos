/**
 * Template Loader
 *
 * Loads command templates from the ./templates/ directory in the project root.
 * Templates are used to generate commands like /gsdo with current documentation paths.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

/**
 * Get the project root directory (where templates/ is located)
 * Searches upward from current location for package.json to find root
 */
function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  let currentDir = dirname(__filename);

  // Walk up the directory tree looking for package.json
  // This is more reliable than relative path counting
  while (currentDir !== dirname(currentDir)) {
    if (existsSync(join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  // Fallback: assume 3 levels up (src/lib/installer -> project root)
  return resolve(dirname(__filename), '../../../');
}

/**
 * Loads the /gsdo command template from ./templates/gsdo.md
 *
 * @returns Raw markdown content of gsdo.md template
 * @throws Error if template file cannot be read
 */
export function loadGsdoTemplate(): string {
  const projectRoot = getProjectRoot();
  const templatePath = join(projectRoot, 'templates', 'gsdo.md');

  try {
    return readFileSync(templatePath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to load gsdo template from ${templatePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extracts the prompt template content from markdown frontmatter.
 * Removes the YAML frontmatter and returns just the prompt content.
 *
 * @param markdown - Full markdown content with frontmatter
 * @returns Prompt template content without frontmatter
 */
export function extractPromptTemplate(markdown: string): string {
  // Find the second --- that ends the frontmatter
  const lines = markdown.split('\n');
  let frontmatterEndIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      frontmatterEndIndex = i;
      break;
    }
  }

  if (frontmatterEndIndex === -1) {
    throw new Error('Invalid markdown: could not find end of frontmatter');
  }

  // Join everything after the frontmatter
  return lines.slice(frontmatterEndIndex + 1).join('\n').trim();
}
