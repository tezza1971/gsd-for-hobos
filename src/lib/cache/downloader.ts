import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { getDocsOpenCodeCachePath } from './paths.js';
import type { CacheMetadata, DownloadResult } from './types.js';

/**
 * GitHub raw content URL for OpenCode README.
 * Using main branch for latest documentation.
 */
const OPENCODE_README_URL = 'https://raw.githubusercontent.com/OpenAgentsInc/opencode/main/README.md';

/**
 * Downloads OpenCode documentation from GitHub and caches it locally.
 * Creates cache directory if it doesn't exist.
 * Writes both documentation content and metadata.json with timestamp.
 *
 * @returns Promise resolving to DownloadResult indicating success/failure
 */
export async function downloadOpenCodeDocs(): Promise<DownloadResult> {
  try {
    // Fetch README from GitHub
    const response = await fetch(OPENCODE_README_URL);

    // Check HTTP status
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        cached: false
      };
    }

    // Get content
    const content = await response.text();

    // Create cache directory (recursive: true handles parent dirs)
    const cacheDir = getDocsOpenCodeCachePath();
    await mkdir(cacheDir, { recursive: true });

    // Write README content
    const readmePath = join(cacheDir, 'README.md');
    await writeFile(readmePath, content, 'utf-8');

    // Create metadata
    const metadata: CacheMetadata = {
      downloadedAt: new Date().toISOString(),
      source: OPENCODE_README_URL
    };

    // Write metadata.json
    const metadataPath = join(cacheDir, 'metadata.json');
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    return {
      success: true,
      cached: false
    };
  } catch (error) {
    // Network errors, write errors, etc.
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Categorize error type
    if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
      return {
        success: false,
        error: `Network error: ${errorMessage}`,
        cached: false
      };
    }

    if (errorMessage.includes('write') || errorMessage.includes('EACCES') || errorMessage.includes('EPERM')) {
      return {
        success: false,
        error: `Write failed: ${errorMessage}`,
        cached: false
      };
    }

    // Generic error
    return {
      success: false,
      error: errorMessage,
      cached: false
    };
  }
}
