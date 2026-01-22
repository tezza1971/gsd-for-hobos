import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enhanceCommand, enhanceAllCommands } from './enhancer.js';
import type { OpenCodeCommand } from '../transpiler/types.js';
import type { EnhancementContext } from './types.js';

// Mock dependencies
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('./llm-client.js', () => ({
  callLLM: vi.fn()
}));

describe('Enhancement Logic', () => {
  const mockContext: EnhancementContext = {
    installLog: 'Install log content\nWarning: gsd-test-command had issues\n',
    opencodeDocsCache: '# OpenCode Commands\n\nCommand schema: { name, description, promptTemplate }\n\nBest practices...',
    gsdSkillsPath: '/home/user/.claude/get-shit-done/skills',
    opencodeConfigPath: '/home/user/.config/opencode',
    commands: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enhanceCommand', () => {
    it('builds prompt with all context and calls LLM', async () => {
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');
      const { callLLM } = await import('./llm-client.js');

      const command: OpenCodeCommand = {
        name: 'gsd-test-command',
        description: 'Test command',
        promptTemplate: 'Original template'
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue('# GSD Source\n\nOriginal markdown content');

      vi.mocked(callLLM).mockResolvedValue(JSON.stringify({
        name: 'gsd-test-command',
        description: 'Enhanced test command',
        promptTemplate: 'Enhanced template'
      }));

      const result = await enhanceCommand(command, mockContext, '/home/user/.config/opencode');

      expect(callLLM).toHaveBeenCalled();
      const promptArg = vi.mocked(callLLM).mock.calls[0][0];

      // Verify prompt includes all context
      expect(promptArg).toContain('CURRENT COMMAND (JSON)');
      expect(promptArg).toContain('ORIGINAL GSD SOURCE');
      expect(promptArg).toContain('RELEVANT INSTALL LOG EXCERPTS');
      expect(promptArg).toContain('OPENCODE DOCUMENTATION');
      expect(promptArg).toContain('gsd-test-command');
      expect(promptArg).toContain('Original markdown content');

      expect(result.commandName).toBe('gsd-test-command');
      expect(result.enhanced).toBe(true);
      expect(result.changes).toContain('Updated description');
      expect(result.changes).toContain('Improved prompt template');
    });

    it('parses LLM response with markdown code fences', async () => {
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');
      const { callLLM } = await import('./llm-client.js');

      const command: OpenCodeCommand = {
        name: 'gsd-test',
        description: 'Test',
        promptTemplate: 'Original'
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue('# GSD Source');

      // LLM returns JSON wrapped in markdown code fence
      vi.mocked(callLLM).mockResolvedValue(`Here's the enhanced command:

\`\`\`json
{
  "name": "gsd-test",
  "description": "Enhanced description",
  "promptTemplate": "Original"
}
\`\`\`

This improves clarity.`);

      const result = await enhanceCommand(command, mockContext, '/home/user/.config/opencode');

      expect(result.enhanced).toBe(true);
      expect(result.changes).toContain('Updated description');
      expect(result.error).toBeUndefined();
    });

    it('parses LLM response without markdown code fences', async () => {
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');
      const { callLLM } = await import('./llm-client.js');

      const command: OpenCodeCommand = {
        name: 'gsd-test',
        description: 'Test',
        promptTemplate: 'Original'
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue('# GSD Source');

      // LLM returns plain JSON
      vi.mocked(callLLM).mockResolvedValue(`{
  "name": "gsd-test",
  "description": "Enhanced description",
  "promptTemplate": "Original"
}`);

      const result = await enhanceCommand(command, mockContext, '/home/user/.config/opencode');

      expect(result.enhanced).toBe(true);
      expect(result.changes).toContain('Updated description');
    });

    it('handles missing GSD source gracefully', async () => {
      const fs = await import('node:fs');
      const { callLLM } = await import('./llm-client.js');

      const command: OpenCodeCommand = {
        name: 'gsd-test',
        description: 'Test',
        promptTemplate: 'Original'
      };

      vi.mocked(fs.existsSync).mockReturnValue(false); // GSD source file doesn't exist

      vi.mocked(callLLM).mockResolvedValue(JSON.stringify({
        name: 'gsd-test',
        description: 'Test',
        promptTemplate: 'Original'
      }));

      const result = await enhanceCommand(command, mockContext, '/home/user/.config/opencode');

      // Should continue despite missing source
      expect(callLLM).toHaveBeenCalled();
      const promptArg = vi.mocked(callLLM).mock.calls[0][0];
      expect(promptArg).toContain('(Original GSD source file not found)');

      expect(result.commandName).toBe('gsd-test');
      expect(result.error).toBeUndefined();
    });

    it('retries once with refined prompt on LLM failure', async () => {
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');
      const { callLLM } = await import('./llm-client.js');

      const command: OpenCodeCommand = {
        name: 'gsd-test',
        description: 'Test',
        promptTemplate: 'Original'
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue('# GSD Source');

      // First call fails, second succeeds
      vi.mocked(callLLM)
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(JSON.stringify({
          name: 'gsd-test',
          description: 'Enhanced',
          promptTemplate: 'Original'
        }));

      const result = await enhanceCommand(command, mockContext, '/home/user/.config/opencode');

      expect(callLLM).toHaveBeenCalledTimes(2);
      // Second call should have refined prompt
      const secondPrompt = vi.mocked(callLLM).mock.calls[1][0];
      expect(secondPrompt).toContain('IMPORTANT: Return ONLY valid JSON');

      expect(result.enhanced).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns error result when both LLM attempts fail', async () => {
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');
      const { callLLM } = await import('./llm-client.js');

      const command: OpenCodeCommand = {
        name: 'gsd-test',
        description: 'Test',
        promptTemplate: 'Original'
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue('# GSD Source');

      vi.mocked(callLLM).mockRejectedValue(new Error('Persistent API error'));

      const result = await enhanceCommand(command, mockContext, '/home/user/.config/opencode');

      expect(result.commandName).toBe('gsd-test');
      expect(result.enhanced).toBe(false);
      expect(result.changes).toEqual([]);
      expect(result.error).toContain('LLM call failed');
    });

    it('returns error result when LLM response is invalid JSON', async () => {
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');
      const { callLLM } = await import('./llm-client.js');

      const command: OpenCodeCommand = {
        name: 'gsd-test',
        description: 'Test',
        promptTemplate: 'Original'
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue('# GSD Source');

      vi.mocked(callLLM).mockResolvedValue('This is not JSON at all');

      const result = await enhanceCommand(command, mockContext, '/home/user/.config/opencode');

      expect(result.commandName).toBe('gsd-test');
      expect(result.enhanced).toBe(false);
      expect(result.error).toContain('Failed to parse LLM response');
    });

    it('identifies all types of changes', async () => {
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');
      const { callLLM } = await import('./llm-client.js');

      const command: OpenCodeCommand = {
        name: 'gsd-old-name',
        description: 'Old description',
        promptTemplate: 'Old template'
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue('# GSD Source');

      vi.mocked(callLLM).mockResolvedValue(JSON.stringify({
        name: 'gsd-new-name',
        description: 'New description',
        promptTemplate: 'New template'
      }));

      const result = await enhanceCommand(command, mockContext, '/home/user/.config/opencode');

      expect(result.changes).toContain('Renamed: gsd-old-name → gsd-new-name');
      expect(result.changes).toContain('Updated description');
      expect(result.changes).toContain('Improved prompt template');
    });

    it('converts command name to GSD filename correctly', async () => {
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');
      const { callLLM } = await import('./llm-client.js');

      const command: OpenCodeCommand = {
        name: 'gsd-plan-phase',
        description: 'Test',
        promptTemplate: 'Original'
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.readFile).mockResolvedValue('# GSD Source');

      vi.mocked(callLLM).mockResolvedValue(JSON.stringify(command));

      await enhanceCommand(command, mockContext, '/home/user/.config/opencode');

      // Check that readFile was called with correct path: gsd:plan-phase.md
      expect(fsPromises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('gsd:plan-phase.md'),
        'utf-8'
      );
    });
  });

  describe('enhanceAllCommands', () => {
    it('filters to only gsd-* commands', async () => {
      const { callLLM } = await import('./llm-client.js');
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');

      const contextWithMixedCommands: EnhancementContext = {
        ...mockContext,
        commands: [
          { name: 'gsd-test-1', description: 'GSD 1', promptTemplate: 'Template 1' },
          { name: 'other-command', description: 'Other', promptTemplate: 'Other template' },
          { name: 'gsd-test-2', description: 'GSD 2', promptTemplate: 'Template 2' }
        ]
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(callLLM).mockResolvedValue(JSON.stringify({
        name: 'enhanced',
        description: 'Enhanced',
        promptTemplate: 'Enhanced'
      }));

      const results = await enhanceAllCommands(contextWithMixedCommands, '/home/user/.config/opencode');

      // Should only process gsd-* commands (2 out of 3)
      expect(results).toHaveLength(2);
      expect(results[0].commandName).toBe('gsd-test-1');
      expect(results[1].commandName).toBe('gsd-test-2');

      // Should NOT call LLM for 'other-command'
      expect(callLLM).toHaveBeenCalledTimes(2);
    });

    it('processes commands sequentially', async () => {
      const { callLLM } = await import('./llm-client.js');
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');

      const contextWithCommands: EnhancementContext = {
        ...mockContext,
        commands: [
          { name: 'gsd-cmd-1', description: 'Cmd 1', promptTemplate: 'Template 1' },
          { name: 'gsd-cmd-2', description: 'Cmd 2', promptTemplate: 'Template 2' }
        ]
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);

      const callOrder: number[] = [];
      vi.mocked(callLLM).mockImplementation(async () => {
        callOrder.push(Date.now());
        return JSON.stringify({ name: 'enhanced', description: 'Enhanced', promptTemplate: 'Enhanced' });
      });

      await enhanceAllCommands(contextWithCommands, '/home/user/.config/opencode');

      // Verify sequential processing (not parallel)
      expect(callOrder).toHaveLength(2);
      expect(callOrder[1]).toBeGreaterThan(callOrder[0]);
    });

    it('collects all results including errors', async () => {
      const { callLLM } = await import('./llm-client.js');
      const fs = await import('node:fs');
      const fsPromises = await import('node:fs/promises');

      const contextWithCommands: EnhancementContext = {
        ...mockContext,
        commands: [
          { name: 'gsd-success', description: 'Success', promptTemplate: 'Template' },
          { name: 'gsd-fail', description: 'Fail', promptTemplate: 'Template' }
        ]
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);

      // First command succeeds, second fails (both attempts)
      vi.mocked(callLLM)
        .mockResolvedValueOnce(JSON.stringify({
          name: 'gsd-success',
          description: 'Enhanced success',
          promptTemplate: 'Template'
        }))
        .mockRejectedValueOnce(new Error('API error'))
        .mockRejectedValueOnce(new Error('API error on retry'));

      const results = await enhanceAllCommands(contextWithCommands, '/home/user/.config/opencode');

      expect(results).toHaveLength(2);

      // First result: success
      expect(results[0].commandName).toBe('gsd-success');
      expect(results[0].enhanced).toBe(true);
      expect(results[0].error).toBeUndefined();

      // Second result: error
      expect(results[1].commandName).toBe('gsd-fail');
      expect(results[1].enhanced).toBe(false);
      expect(results[1].error).toBeDefined();
    });

    it('returns empty array when no gsd commands exist', async () => {
      const contextWithNoGsdCommands: EnhancementContext = {
        ...mockContext,
        commands: [
          { name: 'other-command-1', description: 'Other 1', promptTemplate: 'Template' },
          { name: 'other-command-2', description: 'Other 2', promptTemplate: 'Template' }
        ]
      };

      const results = await enhanceAllCommands(contextWithNoGsdCommands, '/home/user/.config/opencode');

      expect(results).toEqual([]);
    });
  });
});
