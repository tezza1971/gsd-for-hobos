import { promises as fs } from 'node:fs/promises';
import { spawn } from 'node:child_process';

export interface FreshnessResult {
  status: 'fresh' | 'stale' | 'unknown';
  date: string;
  daysAgo: number | null;
}

export async function checkFreshness(installPath: string): Promise<FreshnessResult> {
  try {
    // Check if .git directory exists
    const gitDirExists = await fs.access(`${installPath}/.git`).then(() => true).catch(() => false);

    if (!gitDirExists) {
      return {
        status: 'unknown',
        date: new Date().toISOString(),
        daysAgo: null
      };
    }

    // Use git log to get latest commit date
    return new Promise<FreshnessResult>((resolve, reject) => {
      const git = spawn('git', ['log', '-1', '--format=%aI'], {
        cwd: installPath,
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';

      git.stdout?.on('data', (data) => {
        stdout += data;
      });

      git.stderr?.on('data', (data) => {
        stderr += data;
      });

      git.on('close', (code) => {
        if (code !== 0 || stderr) {
          // Git failed, fall back to file modification date
          fs.stat(`${installPath}/package.json`).then((stats) => {
            const mtime = stats.mtime.toISOString();
            const daysAgo = Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24));
            resolve({
              status: daysAgo > 90 ? 'stale' : 'fresh',
              date: mtime,
              daysAgo
            });
          });
        });
        } else {
          const match = stdout.trim();
          if (match) {
            const commitDate = new Date(match);
            const daysAgo = Math.floor((Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24));
            resolve({
              status: daysAgo > 90 ? 'stale' : 'fresh',
              date: commitDate.toISOString(),
              daysAgo
            });
          } else {
            reject(new Error('No git output'));
          }
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    return {
      status: 'unknown',
      date: new Date().toISOString(),
      daysAgo: null
    };
  }
}

export async function isGitRepository(dirPath: string): Promise<boolean> {
  try {
    await fs.access(`${dirPath}/.git`);
    return true;
  } catch {
    return false;
  }
}