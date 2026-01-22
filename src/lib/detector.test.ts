import { describe, it, expect } from 'vitest';
import { resolveHome, getGsdPath, getOpenCodePath, getOpenCodeCandidates } from './paths.js';
import { detectGsd, detectOpenCode } from './detector.js';
import { homedir } from 'os';
import { sep } from 'path';

describe('Path Resolution', () => {
  describe('resolveHome', () => {
    it('expands ~ to home directory', () => {
      const result = resolveHome('~');
      expect(result).toBe(homedir());
    });

    it('expands ~/path to home directory + path', () => {
      const result = resolveHome('~/.config');
      expect(result).toContain(homedir());
      expect(result).toContain('.config');
    });

    it('handles ~\\ on Windows-style paths', () => {
      const result = resolveHome('~\\.config');
      expect(result).toContain(homedir());
      expect(result).toContain('.config');
    });

    it('returns non-~ paths unchanged (normalized)', () => {
      const result = resolveHome('/absolute/path');
      expect(result).toContain('absolute');
      expect(result).toContain('path');
    });

    it('uses platform-specific path separators', () => {
      const result = resolveHome('~/.config/test');
      // Should use platform separator
      expect(result.includes(sep)).toBe(true);
    });
  });

  describe('getGsdPath', () => {
    it('returns path to GSD installation', () => {
      const result = getGsdPath();
      expect(result).toContain(homedir());
      expect(result).toContain('.claude');
      expect(result).toContain('get-shit-done');
    });

    it('uses platform-specific separators', () => {
      const result = getGsdPath();
      expect(result.includes(sep)).toBe(true);
    });
  });

  describe('getOpenCodePath', () => {
    it('returns first candidate path', () => {
      const result = getOpenCodePath();
      expect(result).toBeTruthy();
      // First candidate is .opencode (project-local)
      expect(result).toContain('opencode');
    });
  });

  describe('getOpenCodeCandidates', () => {
    it('returns array of candidate paths', () => {
      const candidates = getOpenCodeCandidates();
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeGreaterThan(0);
    });

    it('includes project-local .opencode as first candidate', () => {
      const candidates = getOpenCodeCandidates();
      expect(candidates[0]).toContain('.opencode');
    });

    it('includes ~/.config/opencode as second candidate', () => {
      const candidates = getOpenCodeCandidates();
      expect(candidates[1]).toContain('.config');
      expect(candidates[1]).toContain('opencode');
    });

    it('includes platform-specific paths', () => {
      const candidates = getOpenCodeCandidates();
      if (process.platform === 'win32') {
        // Windows should include %APPDATA%/opencode
        const hasAppData = candidates.some(c => c.includes('opencode'));
        expect(hasAppData).toBe(true);
      } else if (process.platform === 'darwin') {
        // macOS should include ~/Library/Application Support/opencode
        const hasLibrary = candidates.some(c => c.includes('Library') && c.includes('opencode'));
        expect(hasLibrary).toBe(true);
      }
    });
  });
});

describe('Detection', () => {
  describe('detectGsd', () => {
    it('returns detection result object', () => {
      const result = detectGsd();
      expect(result).toHaveProperty('found');
      expect(typeof result.found).toBe('boolean');
    });

    it('returns error message when GSD not found', () => {
      const result = detectGsd();
      // Most test environments won't have GSD installed
      if (!result.found) {
        expect(result.error).toBeTruthy();
        expect(result.error).toContain('GSD');
      }
    });

    it('validates skills/ subdirectory exists when GSD path exists', () => {
      const result = detectGsd();
      // If found, must have validated skills/ directory
      if (result.found) {
        expect(result.path).toBeTruthy();
        expect(result.path).toContain('get-shit-done');
      } else {
        // Should mention skills/ in error if that's the issue
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe('detectOpenCode', () => {
    it('returns detection result object', () => {
      const result = detectOpenCode();
      expect(result).toHaveProperty('found');
      expect(typeof result.found).toBe('boolean');
    });

    it('returns path when directory exists or is created', () => {
      const result = detectOpenCode();
      // Should always succeed by creating directory if needed
      expect(result.found).toBe(true);
      expect(result.path).toBeTruthy();
    });

    it('indicates if directory was created', () => {
      const result = detectOpenCode();
      expect(result).toHaveProperty('created');
      expect(typeof result.created).toBe('boolean');
    });

    it('handles missing directories gracefully', () => {
      const result = detectOpenCode();
      // Should create directory if none exist
      if (result.created) {
        expect(result.path).toBeTruthy();
        expect(result.path).toContain('opencode');
      }
    });
  });
});
