/**
 * Template Extractor
 *
 * Extracts clean prompt templates from GSD markdown files.
 * Removes frontmatter, structural headings, and metadata to produce
 * OpenCode-compatible prompt templates.
 *
 * Phase 4: Enhanced transpilation with template extraction
 */

/**
 * Extracts clean prompt template from GSD markdown content
 *
 * Transformation process:
 * 1. Remove YAML frontmatter (between --- delimiters)
 * 2. Remove top-level structural headings (# and ##)
 * 3. Preserve actual prompt content and nested structure
 * 4. Handle edge cases gracefully (empty files, malformed markdown)
 *
 * @param rawContent - Raw markdown content from GSD command file
 * @returns Clean prompt template suitable for OpenCode
 *
 * @example
 * ```typescript
 * const gsdMarkdown = `---
 * description: Plan a phase
 * ---
 *
 * # Plan Phase Command
 *
 * ## Role
 * You are a GSD planner...
 *
 * ## Task
 * Create a detailed plan for {{phase}}...
 * `;
 *
 * const template = extractPromptTemplate(gsdMarkdown);
 * // Returns: "You are a GSD planner...\n\nCreate a detailed plan for {{phase}}..."
 * ```
 */
export function extractPromptTemplate(rawContent: string): string {
  // Handle empty or whitespace-only input
  if (!rawContent || rawContent.trim().length === 0) {
    return '';
  }

  try {
    // Step 1: Remove YAML frontmatter
    const withoutFrontmatter = removeFrontmatter(rawContent);

    // Step 2: Remove top-level structural headings
    const withoutStructuralHeadings = removeStructuralHeadings(withoutFrontmatter);

    // Step 3: Clean up excessive whitespace while preserving paragraph breaks
    const cleaned = cleanWhitespace(withoutStructuralHeadings);

    return cleaned;
  } catch (error) {
    // Graceful degradation: return trimmed original on any error
    console.warn('Template extraction failed, using original content:', error);
    return rawContent.trim();
  }
}

/**
 * Removes YAML frontmatter from markdown content
 *
 * Frontmatter is content between opening and closing --- delimiters.
 * If no valid frontmatter found, returns original content.
 *
 * @param content - Markdown content that may contain frontmatter
 * @returns Content with frontmatter removed
 */
function removeFrontmatter(content: string): string {
  // Pattern: starts with ---, content, ends with ---
  // Must be at beginning of file (possibly after whitespace)
  const frontmatterPattern = /^\s*---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontmatterPattern);

  if (match) {
    // Remove everything up to and including closing ---
    return content.slice(match[0].length);
  }

  // No frontmatter found, return as-is
  return content;
}

/**
 * Removes top-level structural headings from markdown
 *
 * Structural headings are # and ## level headings that organize
 * the GSD command document but aren't part of the actual prompt.
 *
 * Preserves:
 * - ### and deeper headings (part of prompt structure)
 * - All content that's not a heading line
 *
 * @param content - Markdown content with frontmatter already removed
 * @returns Content with structural headings removed
 */
function removeStructuralHeadings(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    // Match lines that start with # or ## (but not ###, ####, etc.)
    // Must have space after # markers for valid markdown
    const isTopLevelHeading = /^#{1,2}\s+/.test(line);

    if (!isTopLevelHeading) {
      result.push(line);
    }
    // Skip top-level headings (don't add to result)
  }

  return result.join('\n');
}

/**
 * Cleans excessive whitespace while preserving paragraph structure
 *
 * Rules:
 * - Remove leading/trailing whitespace
 * - Collapse 3+ consecutive newlines to 2 (preserve paragraph breaks)
 * - Preserve single and double newlines
 *
 * @param content - Content to clean
 * @returns Cleaned content with normalized whitespace
 */
function cleanWhitespace(content: string): string {
  return content
    .trim()
    // Collapse 3+ consecutive newlines to 2
    .replace(/\n{3,}/g, '\n\n');
}
