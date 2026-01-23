/**
 * Integration Test
 *
 * Verifies end-to-end flow: detect -> scan -> convert -> merge -> write
 * Uses mocked filesystem to avoid requiring actual GSD installation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import { detectGsd, detectOpenCode } from './lib/detector.js';
import { scanGsdCommands } from './lib/transpiler/scanner.js';
import { convertBatch } from './lib/transpiler/converter.js';
import { readCommands, mergeCommands, writeCommands } from './lib/installer/commands-manager.js';

describe('Integration Test - End-to-End Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full installer flow with mocked filesystem', () => {
    // Mock GSD detection
    vi.mocked(existsSync).mockImplementation((path: any) => {
      const pathStr = String(path);
      // GSD path and workflows directory exist
      if (pathStr.includes('.claude') && pathStr.includes('get-shit-done')) {
        return true;
      }
      if (pathStr.includes('workflows')) {
        return true;
      }
      // OpenCode doesn't exist yet
      if (pathStr.includes('opencode')) {
        return false;
      }
      return false;
    });

    // Mock OpenCode directory creation
    vi.mocked(mkdirSync).mockReturnValue(undefined);

    // Mock GSD command files
    vi.mocked(readdirSync).mockReturnValue([
      'plan-phase.md',
      'execute-phase.md',
      'readme.md', // Will be converted to /gsd:readme
    ] as any);

    // Mock file reading for GSD commands
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      const pathStr = String(path);
      if (pathStr.includes('plan-phase.md')) {
        return '# Plan a Phase\n\nThis command plans a phase.';
      }
      if (pathStr.includes('execute-phase.md')) {
        return '# Execute a Phase\n\nThis command executes a phase.';
      }
      // commands.json doesn't exist initially
      if (pathStr.includes('commands.json')) {
        throw new Error('ENOENT');
      }
      return '';
    });

    // Step 1: Detect GSD
    const gsdResult = detectGsd();
    expect(gsdResult.found).toBe(true);
    expect(gsdResult.path).toBeTruthy();

    // Step 2: Detect OpenCode (will create)
    const opencodeResult = detectOpenCode();
    expect(opencodeResult.found).toBe(true);
    expect(opencodeResult.created).toBe(true);

    // Step 3: Scan GSD commands
    const gsdCommands = scanGsdCommands(gsdResult.path!);
    expect(gsdCommands).toHaveLength(3);
    expect(gsdCommands[0].name).toBe('/gsd:plan-phase');
    expect(gsdCommands[1].name).toBe('/gsd:execute-phase');

    // Step 4: Transpile commands
    const transpileResult = convertBatch(gsdCommands);
    expect(transpileResult.successful).toHaveLength(3);
    expect(transpileResult.failed).toHaveLength(0);
    expect(transpileResult.successful[0].name).toBe('gsd:plan-phase');
    expect(transpileResult.successful[1].name).toBe('gsd:execute-phase');

    // Step 5: Read existing commands (empty)
    const existingCommands = readCommands(opencodeResult.path!);
    expect(existingCommands).toHaveLength(0);

    // Step 6: Merge commands
    const mergedCommands = mergeCommands(existingCommands, transpileResult.successful);
    expect(mergedCommands).toHaveLength(3);

    // Step 7: Write commands
    writeCommands(opencodeResult.path!, mergedCommands);
    expect(writeFileSync).toHaveBeenCalled();

    // Verify the JSON that would be written
    const writeCall = vi.mocked(writeFileSync).mock.calls[0];
    expect(writeCall[0]).toContain('commands.json');
    const writtenJson = writeCall[1] as string;
    const parsed = JSON.parse(writtenJson);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].name).toBe('gsd:plan-phase');
  });

  it('should merge new commands with existing commands', () => {
    const existing = [
      { name: 'existing-cmd', description: 'Existing', promptTemplate: 'old' },
      { name: 'gsd:plan-phase', description: 'Old version', promptTemplate: 'old' },
    ];

    const newCommands = [
      { name: 'gsd:plan-phase', description: 'New version', promptTemplate: 'new' },
      { name: 'gsd:execute-phase', description: 'New', promptTemplate: 'new' },
    ];

    const merged = mergeCommands(existing, newCommands);

    // Should have 3 commands total
    expect(merged).toHaveLength(3);

    // First command unchanged
    expect(merged[0].name).toBe('existing-cmd');
    expect(merged[0].description).toBe('Existing');

    // Second command updated (same name)
    expect(merged[1].name).toBe('gsd:plan-phase');
    expect(merged[1].description).toBe('New version');
    expect(merged[1].promptTemplate).toBe('new');

    // Third command appended
    expect(merged[2].name).toBe('gsd:execute-phase');
    expect(merged[2].description).toBe('New');
  });

  it('should handle empty command sets gracefully', () => {
    // Mock empty workflows directory
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([]);

    const gsdCommands = scanGsdCommands('/mock/path');
    expect(gsdCommands).toHaveLength(0);

    const transpileResult = convertBatch(gsdCommands);
    expect(transpileResult.successful).toHaveLength(0);
    expect(transpileResult.failed).toHaveLength(0);
  });

  it('should preserve existing commands when merging with empty new commands', () => {
    const existing = [
      { name: 'cmd1', description: 'Command 1', promptTemplate: 'template1' },
      { name: 'cmd2', description: 'Command 2', promptTemplate: 'template2' },
    ];

    const merged = mergeCommands(existing, []);

    expect(merged).toHaveLength(2);
    expect(merged).toEqual(existing);
  });
});
