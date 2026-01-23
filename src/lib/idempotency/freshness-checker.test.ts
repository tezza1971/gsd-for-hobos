import { describe, it, expect } from 'vitest';
import { checkFreshness } from './freshness-checker.js';
import type { ImportState } from './types.js';

describe('checkFreshness', () => {
  // Helper function to create test state
  function createState(skills: Array<{ path: string; mtime: number }>): ImportState {
    return {
      importedAt: new Date().toISOString(),
      docsCachedAt: '',
      skills
    };
  }

  it('returns fresh=false with "First run" reason when previous state is null', () => {
    const current = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 }
    ]);

    const result = checkFreshness(null, current);

    expect(result).toEqual({
      fresh: false,
      reason: 'First run'
    });
  });

  it('returns fresh=true when state is identical', () => {
    const previous = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/plan-phase.md', mtime: 2000 }
    ]);

    const current = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/plan-phase.md', mtime: 2000 }
    ]);

    const result = checkFreshness(previous, current);

    expect(result).toEqual({
      fresh: true
    });
  });

  it('detects file count change (addition)', () => {
    const previous = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 }
    ]);

    const current = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/new-skill.md', mtime: 2000 }
    ]);

    const result = checkFreshness(previous, current);

    expect(result).toEqual({
      fresh: false,
      reason: 'File count changed (1 -> 2)'
    });
  });

  it('detects file count change (deletion)', () => {
    const previous = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/old-skill.md', mtime: 2000 }
    ]);

    const current = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 }
    ]);

    const result = checkFreshness(previous, current);

    expect(result).toEqual({
      fresh: false,
      reason: 'File count changed (2 -> 1)'
    });
  });

  it('detects mtime change (modification)', () => {
    const previous = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/plan-phase.md', mtime: 2000 }
    ]);

    const current = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/plan-phase.md', mtime: 3000 } // Modified
    ]);

    const result = checkFreshness(previous, current);

    expect(result).toEqual({
      fresh: false,
      reason: 'Modified: /gsd/workflows/plan-phase.md'
    });
  });

  it('detects new file even when count stays same (file replacement)', () => {
    const previous = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/old-skill.md', mtime: 2000 }
    ]);

    const current = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/new-skill.md', mtime: 3000 } // Different file, same count
    ]);

    const result = checkFreshness(previous, current);

    expect(result.fresh).toBe(false);
    expect(result.reason).toBe('New file: /gsd/workflows/new-skill.md');
  });

  it('detects deleted file with specific path', () => {
    const previous = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/to-delete.md', mtime: 2000 }
    ]);

    const current = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 }
    ]);

    const result = checkFreshness(previous, current);

    expect(result.fresh).toBe(false);
    // Note: file count check happens first, so we get count change reason
    expect(result.reason).toBe('File count changed (2 -> 1)');
  });

  it('detects multiple modifications (returns first modified file)', () => {
    const previous = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1000 },
      { path: '/gsd/workflows/plan-phase.md', mtime: 2000 },
      { path: '/gsd/workflows/research-topic.md', mtime: 3000 }
    ]);

    const current = createState([
      { path: '/gsd/workflows/execute-plan.md', mtime: 1500 }, // Modified
      { path: '/gsd/workflows/plan-phase.md', mtime: 2500 }, // Modified
      { path: '/gsd/workflows/research-topic.md', mtime: 3000 }
    ]);

    const result = checkFreshness(previous, current);

    expect(result.fresh).toBe(false);
    // Should return first modified file encountered
    expect(result.reason).toMatch(/Modified: .*execute-plan\.md/);
  });

  it('handles empty skill arrays (no files)', () => {
    const previous = createState([]);
    const current = createState([]);

    const result = checkFreshness(previous, current);

    expect(result).toEqual({
      fresh: true
    });
  });

  it('handles paths with special characters', () => {
    const previous = createState([
      { path: '/gsd/workflows/file with spaces.md', mtime: 1000 },
      { path: '/gsd/workflows/file-with-dashes.md', mtime: 2000 }
    ]);

    const current = createState([
      { path: '/gsd/workflows/file with spaces.md', mtime: 1000 },
      { path: '/gsd/workflows/file-with-dashes.md', mtime: 2000 }
    ]);

    const result = checkFreshness(previous, current);

    expect(result).toEqual({
      fresh: true
    });
  });
});
