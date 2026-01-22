import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadEnhancementContext, backupCommandsJson, writeEnhancedCommands } from './engine.js';
import type { OpenCodeCommand } from '../transpiler/types.js';

// Mock dependencies
vi.mock('../detector.js', () => ({
  detectGsd: vi.fn(() => ({
    found: true,
    path: '/home/user/.claude/get-shit-done'
  })),
  detectOpenCode: vi.fn(() => ({
    found: true,
    path: '/home/user/.config/opencode'
  }))
}));

vi.mock('../installer/commands-manager.js', () => ({
  readCommands: vi.fn(() => []),
  writeCommands: vi.fn()
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn()
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => ''),
  writeFile: vi.fn(async () => {})
}));

vi.mock('../cache/paths.js', () => ({
  getDocsOpenCodeCachePath: vi.fn(() => '/home/user/.gsdo/cache/docs-opencode')
}));

vi.mock('../paths.js', () => ({
  resolveHome: vi.fn((path: string) => path.replace('~', '/home/user'))
}));

describe('Enhancement Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadEnhancementContext', () => {
    it('returns context structure with all required fields', async () => {
      const context = await loadEnhancementContext();

      expect(context).toHaveProperty('installLog');
      expect(context).toHaveProperty('opencodeDocsCache');
      expect(context).toHaveProperty('gsdSkillsPath');
      expect(context).toHaveProperty('opencodeConfigPath');
      expect(context).toHaveProperty('commands');
    });

    it('returns empty strings for missing files', async () => {
      const { existsSync } = await import('node:fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const context = await loadEnhancementContext();

      expect(context.installLog).toBe('');
      expect(context.opencodeDocsCache).toBe('');
    });

    it('reads install.log when it exists', async () => {
      const { existsSync } = await import('node:fs');
      const { readFile } = await import('node:fs/promises');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue('install log content');

      const context = await loadEnhancementContext();

      expect(context.installLog).toBe('install log content');
    });

    it('reads cached OpenCode docs when they exist', async () => {
      const { existsSync } = await import('node:fs');
      const { readFile } = await import('node:fs/promises');

      // Mock existsSync to return true for README.md path
      vi.mocked(existsSync).mockImplementation((path) => {
        return String(path).includes('README.md');
      });

      vi.mocked(readFile).mockResolvedValue('# OpenCode Docs\n\nContent here');

      const context = await loadEnhancementContext();

      expect(context.opencodeDocsCache).toBe('# OpenCode Docs\n\nContent here');
    });

    it('loads current commands from commands.json', async () => {
      const { readCommands } = await import('../installer/commands-manager.js');

      const mockCommands: OpenCodeCommand[] = [
        {
          name: 'gsd-test',
          description: 'Test command',
          promptTemplate: 'Test content'
        }
      ];

      vi.mocked(readCommands).mockReturnValue(mockCommands);

      const context = await loadEnhancementContext();

      expect(context.commands).toEqual(mockCommands);
    });

    it('sets gsdSkillsPath when GSD is detected', async () => {
      const context = await loadEnhancementContext();

      expect(context.gsdSkillsPath).toContain('.claude');
      expect(context.gsdSkillsPath).toContain('get-shit-done');
      expect(context.gsdSkillsPath).toContain('skills');
    });

    it('sets opencodeConfigPath when OpenCode is detected', async () => {
      const context = await loadEnhancementContext();

      expect(context.opencodeConfigPath).toBe('/home/user/.config/opencode');
    });

    it('throws error when OpenCode detection fails', async () => {
      const { detectOpenCode } = await import('../detector.js');

      vi.mocked(detectOpenCode).mockReturnValue({
        found: false,
        error: 'OpenCode not found'
      });

      await expect(loadEnhancementContext()).rejects.toThrow('OpenCode not found');
    });

    it('handles missing GSD gracefully with empty gsdSkillsPath', async () => {
      const { detectGsd, detectOpenCode } = await import('../detector.js');

      vi.mocked(detectGsd).mockReturnValue({
        found: false,
        error: 'GSD not found'
      });

      // Keep OpenCode working
      vi.mocked(detectOpenCode).mockReturnValue({
        found: true,
        path: '/home/user/.config/opencode'
      });

      const context = await loadEnhancementContext();

      expect(context.gsdSkillsPath).toBe('');
    });
  });

  describe('backupCommandsJson', () => {
    it('creates timestamped backup file', async () => {
      const { readCommands } = await import('../installer/commands-manager.js');
      const { writeFile } = await import('node:fs/promises');
      const { existsSync } = await import('node:fs');

      const mockCommands: OpenCodeCommand[] = [
        {
          name: 'gsd-test',
          description: 'Test',
          promptTemplate: 'Content'
        }
      ];

      vi.mocked(readCommands).mockReturnValue(mockCommands);
      vi.mocked(existsSync).mockReturnValue(true);

      const backupFilename = await backupCommandsJson('/home/user/.config/opencode');

      expect(backupFilename).toMatch(/^commands\.json\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.backup$/);
      expect(writeFile).toHaveBeenCalled();
    });

    it('returns empty string when commands.json does not exist', async () => {
      const { readCommands } = await import('../installer/commands-manager.js');
      const { existsSync } = await import('node:fs');

      vi.mocked(readCommands).mockReturnValue([]);
      vi.mocked(existsSync).mockReturnValue(false);

      const backupFilename = await backupCommandsJson('/home/user/.config/opencode');

      expect(backupFilename).toBe('');
    });

    it('writes backup content matching original commands', async () => {
      const { readCommands } = await import('../installer/commands-manager.js');
      const { writeFile } = await import('node:fs/promises');
      const { existsSync } = await import('node:fs');

      const mockCommands: OpenCodeCommand[] = [
        {
          name: 'gsd-test',
          description: 'Test',
          promptTemplate: 'Content'
        }
      ];

      vi.mocked(readCommands).mockReturnValue(mockCommands);
      vi.mocked(existsSync).mockReturnValue(true);

      await backupCommandsJson('/home/user/.config/opencode');

      const expectedJson = JSON.stringify(mockCommands, null, 2);
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.backup'),
        expectedJson,
        'utf-8'
      );
    });

    it('throws error when backup write fails', async () => {
      const { readCommands } = await import('../installer/commands-manager.js');
      const { writeFile } = await import('node:fs/promises');
      const { existsSync } = await import('node:fs');

      vi.mocked(readCommands).mockReturnValue([{ name: 'test', description: 'test', promptTemplate: 'test' }]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFile).mockRejectedValue(new Error('Write failed'));

      await expect(backupCommandsJson('/home/user/.config/opencode')).rejects.toThrow('Failed to create backup');
    });
  });

  describe('writeEnhancedCommands', () => {
    it('delegates to commands-manager writeCommands', async () => {
      const { writeCommands } = await import('../installer/commands-manager.js');

      const mockCommands: OpenCodeCommand[] = [
        {
          name: 'gsd-enhanced',
          description: 'Enhanced command',
          promptTemplate: 'Enhanced content'
        }
      ];

      writeEnhancedCommands('/home/user/.config/opencode', mockCommands);

      expect(writeCommands).toHaveBeenCalledWith(
        '/home/user/.config/opencode',
        mockCommands
      );
    });
  });
});
