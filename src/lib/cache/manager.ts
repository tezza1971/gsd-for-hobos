import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getDocsOpenCodeCachePath, getGsdoCachePath, getDocsUrlsPath, getDocsCachePath } from './paths.js';
import { downloadOpenCodeDocs } from './downloader.js';
import type { CacheMetadata } from './types.js';

/**
 * Result of cache management operation.
 */
export interface CacheResult {
  /**
   * True if cache is available (fresh or stale), false if no cache exists.
   */
  cached: boolean;

  /**
   * True if cache is stale and download failed (graceful degradation).
   * False if cache is fresh or doesn't exist.
   */
  stale: boolean;

  /**
   * Error message if download failed or metadata couldn't be read.
   * Undefined if operation succeeded.
   */
  error?: string;
}

/**
 * TTL for cached documentation in milliseconds (24 hours).
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours = 86400000ms

/**
 * Ensures OpenCode documentation cache is available and fresh.
 * Implements 24-hour TTL with graceful degradation on download failures.
 *
 * Algorithm:
 * 1. Check if cache exists (metadata.json)
 * 2. If exists, check freshness (<24 hours old)
 * 3. If fresh, return immediately (skip download)
 * 4. If stale or missing, attempt download
 * 5. If download fails with existing cache, use stale cache (graceful degradation)
 * 6. If download fails with no cache, return error
 *
 * @returns Promise resolving to CacheResult indicating cache status
 */
export async function ensureOpenCodeDocsCache(): Promise<CacheResult> {
  const cacheDir = getDocsOpenCodeCachePath();
  const metadataPath = join(cacheDir, 'metadata.json');

  // Step 1: Check cache existence
  if (!existsSync(metadataPath)) {
    // No cache exists, must download
    return await attemptDownload(false);
  }

  // Step 2 & 3: Check cache freshness
  try {
    const metadataContent = await readFile(metadataPath, 'utf-8');
    const metadata: CacheMetadata = JSON.parse(metadataContent);

    // Parse timestamp and calculate age
    const downloadedAt = new Date(metadata.downloadedAt).getTime();
    const now = Date.now();
    const age = now - downloadedAt;

    // Check for invalid timestamps (future dates, NaN, etc.)
    if (isNaN(downloadedAt) || downloadedAt > now) {
      // Treat corrupted timestamp as stale
      console.warn('  ⚠ Invalid timestamp in metadata.json, treating as stale');
      return await attemptDownload(true);
    }

    // If fresh (<24 hours), return immediately
    if (age < CACHE_TTL_MS) {
      return {
        cached: true,
        stale: false
      };
    }

    // Cache is stale (>=24 hours), attempt refresh
    return await attemptDownload(true);
  } catch (error) {
    // Step 3: Handle metadata read/parse errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`  ⚠ Failed to read metadata: ${errorMessage}`);

    // Treat as stale, attempt download
    return await attemptDownload(true);
  }
}

/**
 * Attempts to download fresh documentation.
 * Implements graceful degradation if download fails with existing cache.
 *
 * @param cacheExists - True if stale cache exists, false if first-run
 * @returns Promise resolving to CacheResult
 */
async function attemptDownload(cacheExists: boolean): Promise<CacheResult> {
  const downloadResult = await downloadOpenCodeDocs();

  // Step 4: Download succeeded
  if (downloadResult.success) {
    return {
      cached: true,
      stale: false
    };
  }

  // Step 5: Download failed with existing cache (graceful degradation)
  if (cacheExists) {
    return {
      cached: true,
      stale: true,
      error: downloadResult.error
    };
  }

  // Step 6: Download failed with no cache (first-run failure)
  return {
    cached: false,
    stale: false,
    error: downloadResult.error
  };
}

/**
 * Writes documentation URLs file and downloads documentation for /gsdo to reference.
 * Downloads Claude Code and OpenCode documentation to cache for offline availability.
 *
 * @throws Error if write fails (downloads are non-blocking)
 */
export async function writeDocsUrls(): Promise<void> {
  const gsdoDir = getGsdoCachePath().replace('/cache', ''); // Get ~/.gsdo directory
  const docsUrlsPath = getDocsUrlsPath();
  const docsCachePath = getDocsCachePath();

  // Ensure directories exist
  if (!existsSync(gsdoDir)) {
    mkdirSync(gsdoDir, { recursive: true });
  }
  if (!existsSync(docsCachePath)) {
    mkdirSync(docsCachePath, { recursive: true });
  }

  const docsUrls = {
    claudeCode: [
      'https://code.claude.com/docs/en/plugins',
      'https://code.claude.com/docs/en/skills'
    ],
    opencode: [
      'https://opencode.ai/docs/tools/',
      'https://opencode.ai/docs/commands/',
      'https://opencode.ai/docs/plugins/',
      'https://opencode.ai/docs/ecosystem/'
    ]
  };

  try {
    await writeFile(docsUrlsPath, JSON.stringify(docsUrls, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to write docs URLs file: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Download documentation (non-blocking - don't fail if download fails)
  downloadDocumentation(docsUrls, docsCachePath).catch(() => {
    // Silently fail - documentation URLs file is sufficient fallback
  });
}

/**
 * Downloads documentation from URLs and caches them locally.
 * Non-blocking operation - failures don't affect installation.
 *
 * @param docsUrls - Object containing arrays of URLs to download
 * @param cachePath - Path to cache downloads
 */
async function downloadDocumentation(
  docsUrls: { claudeCode: string[]; opencode: string[] },
  cachePath: string
): Promise<void> {
  const allUrls = [...docsUrls.claudeCode, ...docsUrls.opencode];

  for (const url of allUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue; // Skip failed downloads
      }

      const content = await response.text();

      // Create safe filename from URL
      const urlObj = new URL(url);
      const filename = `${urlObj.hostname}_${urlObj.pathname.replace(/\//g, '_')}.html`;
      const filePath = join(cachePath, filename);

      await writeFile(filePath, content, 'utf-8');
    } catch {
      // Silently skip failed downloads
    }
  }
}
