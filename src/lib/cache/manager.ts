import { existsSync, mkdirSync, readdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { getGsdoCachePath, getDocsUrlsPath, getDocsCachePath } from './paths.js';

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
 * Checks if documentation cache is available.
 * Documentation is downloaded by writeDocsUrls() to ~/.gsdo/cache/docs/
 * This function simply checks if any HTML documentation files exist.
 *
 * @returns Promise resolving to CacheResult indicating cache status
 */
export async function ensureOpenCodeDocsCache(): Promise<CacheResult> {
  const docsCachePath = getDocsCachePath();

  // Check if cache directory exists and has files
  if (!existsSync(docsCachePath)) {
    return {
      cached: false,
      stale: false
    };
  }

  try {
    const files = readdirSync(docsCachePath);
    const htmlFiles = files.filter(f => f.endsWith('.html'));

    if (htmlFiles.length > 0) {
      return {
        cached: true,
        stale: false
      };
    }

    return {
      cached: false,
      stale: false
    };
  } catch (error) {
    return {
      cached: false,
      stale: false,
      error: 'Failed to check cache directory'
    };
  }
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
