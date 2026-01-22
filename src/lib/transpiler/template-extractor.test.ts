/**
 * Template Extractor Tests
 *
 * Comprehensive test suite for GSD markdown to OpenCode template extraction.
 * Covers standard cases, edge cases, and content preservation requirements.
 */

import { describe, it, expect } from 'vitest';
import { extractPromptTemplate } from './template-extractor.js';

describe('extractPromptTemplate', () => {
  describe('Standard GSD markdown', () => {
    it('removes frontmatter from standard GSD markdown', () => {
      const gsdMarkdown = `---
description: Plan a phase
author: test
---

# Plan Phase Command

## Role
You are a GSD planner...

## Task
Create a detailed plan for {{phase}}...`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).not.toContain('---');
      expect(result).not.toContain('description:');
      expect(result).toContain('You are a GSD planner');
      expect(result).toContain('Create a detailed plan for {{phase}}');
    });

    it('removes top-level headings (# and ##)', () => {
      const gsdMarkdown = `---
description: Test
---

# Main Title

## Section One
Content for section one.

## Section Two
Content for section two.`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).not.toContain('# Main Title');
      expect(result).not.toContain('## Section One');
      expect(result).not.toContain('## Section Two');
      expect(result).toContain('Content for section one');
      expect(result).toContain('Content for section two');
    });

    it('preserves nested headings (### and deeper)', () => {
      const gsdMarkdown = `---
description: Test
---

# Main Title

## Role
You are a planner.

### Subsection A
Important detail A.

#### Deep detail
Very specific info.`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).not.toContain('# Main Title');
      expect(result).not.toContain('## Role');
      expect(result).toContain('### Subsection A');
      expect(result).toContain('#### Deep detail');
      expect(result).toContain('Important detail A');
    });
  });

  describe('Template variables preservation', () => {
    it('preserves template variables in content', () => {
      const gsdMarkdown = `---
description: Test
---

# Command

Create plan for {{phase}} using {{context}} to build {{output}}.`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).toContain('{{phase}}');
      expect(result).toContain('{{context}}');
      expect(result).toContain('{{output}}');
    });

    it('preserves template variables with whitespace', () => {
      const gsdMarkdown = `# Title\n\nUse {{ phase }} and {{context}}.`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).toContain('{{ phase }}');
      expect(result).toContain('{{context}}');
    });
  });

  describe('Code blocks preservation', () => {
    it('preserves code blocks in prompt', () => {
      const gsdMarkdown = `---
description: Test
---

# Command

Example code:

\`\`\`typescript
function hello() {
  return "world";
}
\`\`\`

Use this pattern.`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).toContain('```typescript');
      expect(result).toContain('function hello()');
      expect(result).toContain('return "world"');
      expect(result).toContain('```');
      expect(result).toContain('Use this pattern');
    });

    it('preserves inline code', () => {
      const gsdMarkdown = `# Title\n\nUse \`npm install\` to install.`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).toContain('`npm install`');
    });
  });

  describe('Edge cases', () => {
    it('handles missing frontmatter gracefully', () => {
      const gsdMarkdown = `# Command Title

## Section
Content without frontmatter.`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).toContain('Content without frontmatter');
      expect(result).not.toContain('# Command Title');
    });

    it('returns empty string for empty input', () => {
      expect(extractPromptTemplate('')).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(extractPromptTemplate('   \n\n  ')).toBe('');
    });

    it('handles only frontmatter (no content)', () => {
      const gsdMarkdown = `---
description: Test
author: test
---`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).toBe('');
    });

    it('handles malformed frontmatter (missing closing ---)', () => {
      const gsdMarkdown = `---
description: Test
author: test

# Title
Content here.`;

      const result = extractPromptTemplate(gsdMarkdown);

      // Should return original content trimmed (graceful degradation)
      expect(result).toContain('description: Test');
      expect(result).toContain('Content here');
    });
  });

  describe('Whitespace handling', () => {
    it('trims leading and trailing whitespace', () => {
      const gsdMarkdown = `


# Title

Content


`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result.startsWith('Content')).toBe(true);
      expect(result.endsWith('Content')).toBe(true);
    });

    it('collapses excessive newlines to double newlines', () => {
      const gsdMarkdown = `# Title

Paragraph 1.



Paragraph 2.`;

      const result = extractPromptTemplate(gsdMarkdown);

      // Should have at most 2 consecutive newlines
      expect(result).not.toContain('\n\n\n');
      expect(result).toContain('Paragraph 1');
      expect(result).toContain('Paragraph 2');
    });

    it('preserves paragraph breaks (double newlines)', () => {
      const gsdMarkdown = `# Title

Paragraph 1.

Paragraph 2.`;

      const result = extractPromptTemplate(gsdMarkdown);

      expect(result).toBe('Paragraph 1.\n\nParagraph 2.');
    });
  });

  describe('Real-world examples', () => {
    it('extracts clean prompt from typical GSD command', () => {
      const gsdMarkdown = `---
description: Plan a phase implementation
tags: planning, gsd
---

# Plan Phase Command

This command helps you plan a GSD phase.

## Role
You are a GSD phase planner with expertise in breaking down complex work.

## Context
- Current phase: {{phase}}
- Project context: {{context}}

## Task
Create a detailed execution plan for {{phase}} with:

### Requirements
1. Task breakdown with dependencies
2. Success criteria
3. Verification steps

### Output Format
Provide structured markdown with task list.`;

      const result = extractPromptTemplate(gsdMarkdown);

      // Should not contain metadata
      expect(result).not.toContain('---');
      expect(result).not.toContain('description:');
      expect(result).not.toContain('tags:');
      expect(result).not.toContain('# Plan Phase Command');
      expect(result).not.toContain('## Role');
      expect(result).not.toContain('## Context');
      expect(result).not.toContain('## Task');

      // Should contain actual prompt content
      expect(result).toContain('You are a GSD phase planner');
      expect(result).toContain('Current phase: {{phase}}');
      expect(result).toContain('Project context: {{context}}');
      expect(result).toContain('Create a detailed execution plan');

      // Should preserve nested structure
      expect(result).toContain('### Requirements');
      expect(result).toContain('### Output Format');
      expect(result).toContain('1. Task breakdown');
    });
  });

  describe('Graceful degradation', () => {
    it('handles unclear structure by returning original content', () => {
      const weirdMarkdown = `Some random content
      without clear structure
      {{variable}} present`;

      const result = extractPromptTemplate(weirdMarkdown);

      // Should return trimmed original since no frontmatter/headings to remove
      expect(result).toContain('Some random content');
      expect(result).toContain('{{variable}}');
    });

    it('never throws errors on any input', () => {
      const inputs = [
        '',
        '   ',
        '\n\n\n',
        '---',
        '# # #',
        '{{{{}}}}',
        'Normal text',
        '```code block without closing',
      ];

      for (const input of inputs) {
        expect(() => extractPromptTemplate(input)).not.toThrow();
      }
    });
  });
});
