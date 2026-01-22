/**
 * GitHub Documentation Cache Manager with TTL
 *
 * Implements file-based caching with time-to-live for external documentation.
 * Used to cache OpenCode schema docs from GitHub to avoid repeated fetches.
 */

import { readFile, writeFile, stat, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { log } from '../logger.js';

/**
 * TTL-based cache manager for GitHub documentation
 *
 * Stores cached content in filesystem with modification time tracking.
 * Automatically invalidates and refetches when TTL expires.
 */
export class DocsCacheManager {
  private cacheDir: string;
  private ttlSeconds: number;

  /**
   * @param cacheDir Directory to store cache files (default: ~/.cache/docs-opencode)
   * @param ttlSeconds Time-to-live in seconds (default: 86400 = 24 hours)
   */
  constructor(cacheDir: string = join(homedir(), '.cache', 'docs-opencode'), ttlSeconds: number = 86400) {
    this.cacheDir = cacheDir;
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Get cached content by key
   *
   * @param key Cache key (used as filename)
   * @returns Cached content or null if expired/missing
   */
  async get(key: string): Promise<string | null> {
    const cachePath = join(this.cacheDir, `${key}.cache`);

    try {
      // Get file modification time
      const stats = await stat(cachePath);
      const ageSeconds = (Date.now() - stats.mtimeMs) / 1000;

      log.verbose(`Cache file ${key}: ${ageSeconds.toFixed(0)}s old (TTL: ${this.ttlSeconds}s)`);

      // Check if cache is still valid
      if (ageSeconds > this.ttlSeconds) {
        log.verbose(`Cache expired for ${key}, deleting stale file`);
        await unlink(cachePath);
        return null;
      }

      // Read and return cached content
      const content = await readFile(cachePath, 'utf-8');
      log.verbose(`Cache hit for ${key} (${content.length} bytes)`);
      return content;
    } catch (error) {
      // File doesn't exist or read error
      if (error instanceof Error && 'code' in error) {
        if (error.code === 'ENOENT') {
          log.verbose(`Cache miss for ${key} (file not found)`);
        } else {
          log.verbose(`Cache read error for ${key}: ${error.message}`);
        }
      }
      return null;
    }
  }

  /**
   * Store content in cache
   *
   * @param key Cache key
   * @param content Content to cache
   */
  async set(key: string, content: string): Promise<void> {
    try {
      // Create cache directory if it doesn't exist
      await mkdir(this.cacheDir, { recursive: true });

      const cachePath = join(this.cacheDir, `${key}.cache`);
      await writeFile(cachePath, content, 'utf-8');

      log.verbose(`Stored ${content.length} bytes in cache: ${key}`);
    } catch (error) {
      if (error instanceof Error) {
        log.verbose(`Cache write error for ${key}: ${error.message}`);
      }
      // Don't throw - cache failures shouldn't break functionality
    }
  }

  /**
   * Fetch OpenCode documentation from GitHub with caching
   *
   * First checks cache, then fetches from GitHub if needed or expired.
   * Caches successful fetches for future use.
   *
   * @returns OpenCode schema documentation content
   * @throws Error if fetch fails
   */
  async fetchOpenCodeDocs(): Promise<string> {
    const cacheKey = 'opencode-docs';

    // Try cache first
    const cached = await this.get(cacheKey);
    if (cached) {
      log.info('Using cached OpenCode documentation');
      return cached;
    }

    // Fetch from GitHub
    log.info('Fetching OpenCode documentation from GitHub...');
    log.verbose('URL: https://raw.githubusercontent.com/sst/opencode/main/docs/schema.md');

    const response = await fetch('https://raw.githubusercontent.com/sst/opencode/main/docs/schema.md');

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenCode docs: HTTP ${response.status} ${response.statusText}`);
    }

    const content = await response.text();
    log.verbose(`Fetched ${content.length} bytes from GitHub`);

    // Cache for future use
    await this.set(cacheKey, content);

    log.success('OpenCode documentation fetched and cached');
    return content;
  }
}
