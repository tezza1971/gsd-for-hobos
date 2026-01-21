import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export type FreshnessStatus = 'fresh' | 'stale' | 'unknown';

export interface FreshnessResult {
  status: FreshnessStatus;
  date: string | null;
  daysAgo: number | null;
}

const FRESHNESS_THRESHOLD_DAYS = 90;

/**
 * Synchronously check if a directory is a git repository.
 * Uses existsSync - acceptable here as it's a quick metadata check.
 */
export function isGitRepository(dirPath: string): boolean {
  return existsSync(join(dirPath, '.git'));
}

/**
 * Check installation freshness using git history (preferred) with fallback to file modification dates.
 *
 * - If .git exists: uses spawnSync to run `git log -1 --format=%aI` with 5 second timeout
 * - If git fails or not a repo: falls back to stat(package.json).mtime
 * - Uses 90-day threshold for stale detection
 * - Never throws - all errors return fallback results
 */
export async function checkFreshness(installPath: string): Promise<FreshnessResult> {
  // Try git first if it's a git repository
  if (isGitRepository(installPath)) {
    const gitResult = getGitLastCommitDate(installPath);
    if (gitResult !== null) {
      const daysAgo = calculateDaysAgo(gitResult);
      return {
        status: daysAgo > FRESHNESS_THRESHOLD_DAYS ? 'stale' : 'fresh',
        date: gitResult.toISOString(),
        daysAgo
      };
    }
    // Git command failed, fall through to file date check
  }

  // Fall back to checking file modification date
  return await getFileDateFallback(installPath);
}

/**
 * Get the date of the last git commit in the repository.
 * Returns null if git command fails or is unavailable.
 */
function getGitLastCommitDate(repoPath: string): Date | null {
  try {
    const result = spawnSync('git', ['log', '-1', '--format=%aI'], {
      cwd: repoPath,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (result.error || result.status !== 0) {
      return null;
    }

    const dateString = result.stdout?.trim();
    if (!dateString) {
      return null;
    }

    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Fallback: check freshness using package.json modification date.
 * Returns 'unknown' status if file cannot be read.
 */
async function getFileDateFallback(installPath: string): Promise<FreshnessResult> {
  try {
    const stat = await fs.stat(join(installPath, 'package.json'));
    const daysAgo = calculateDaysAgo(stat.mtime);
    return {
      status: daysAgo > FRESHNESS_THRESHOLD_DAYS ? 'stale' : 'fresh',
      date: stat.mtime.toISOString(),
      daysAgo
    };
  } catch {
    // Can't determine freshness
    return {
      status: 'unknown',
      date: null,
      daysAgo: null
    };
  }
}

/**
 * Calculate the number of days between a date and now.
 */
function calculateDaysAgo(date: Date): number {
  const age = Date.now() - date.getTime();
  return Math.floor(age / (1000 * 60 * 60 * 24));
}
