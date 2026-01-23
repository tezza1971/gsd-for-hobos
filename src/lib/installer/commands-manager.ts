/**
 * Commands Manager
 *
 * Writes individual command .md files to OpenCode's command directory.
 */

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { OpenCodeCommand } from '../transpiler/types.js';

/**
 * Creates the /gsdo command definition for OpenCode.
 * This command allows users to enhance transpiled GSD commands with context from both
 * Claude Code and OpenCode documentation.
 *
 * @returns OpenCodeCommand for /gsdo enhancement
 */
export function createGsdoCommand(): OpenCodeCommand {
  return {
    name: 'gsdo',
    description: 'Enhance transpiled GSD commands for OpenCode compatibility',
    promptTemplate: `<objective>
You are enhancing transpiled GSD commands for OpenCode compatibility.

Purpose: Improve the transpiled \`/gsd-*\` commands to work better with OpenCode patterns, using documentation from both Claude Code and OpenCode to make intelligent mappings.

Output: Enhanced commands written to ~/.config/opencode/command/ as individual .md files, with detailed results logged.
</objective>

<execution_context>
This is an autonomous operation - do not request user input.

You have access to two documentation references:

**Claude Code Documentation URLs** (from ~/.gsdo/cache/docs-urls.json):
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/skills

**OpenCode Documentation URLs** (from ~/.gsdo/cache/docs-urls.json):
- https://opencode.ai/docs/tools/
- https://opencode.ai/docs/commands/
- https://opencode.ai/docs/plugins/
- https://opencode.ai/docs/ecosystem/

**Other context available:**
- Install log: ~/.gsdo/install.log (transpilation warnings/errors)
- Current commands: ~/.config/opencode/command/*.md
- Original GSD source: ~/.claude/get-shit-done/skills/
- Documentation URLs: ~/.gsdo/cache/docs-urls.json
</execution_context>

<process>

**Enhancement scope (conservative fixes only):**
1. Understand Claude Code skill patterns (plugins, variables, etc.)
2. Understand OpenCode command patterns (tools, formats, conventions)
3. Fix command naming issues
4. Fix broken references to GSD-specific files
5. Add missing parameters
6. Improve prompt templates for OpenCode patterns

**Process:**
1. Read documentation URLs from ~/.gsdo/cache/docs-urls.json
2. Review existing command files in ~/.config/opencode/command/
3. For each /gsd-* command, analyze and enhance
4. Update each command's .md file in place
5. Show detailed per-command report of changes
6. Write results to ~/.gsdo/gsdo.log

**Important: DO NOT remove, merge, or restructure commands.**

Always exit with code 0 on success.

</process>

<success_criteria>
- [ ] All /gsd-* commands analyzed
- [ ] Documentation URLs read from ~/.gsdo/cache/docs-urls.json
- [ ] Enhanced commands written to ~/.config/opencode/command/*.md
- [ ] Results logged to ~/.gsdo/gsdo.log
- [ ] Per-command report shown with before/after comparison
</success_criteria>`
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
