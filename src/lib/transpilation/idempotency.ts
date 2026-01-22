/**
 * Idempotency checking for GSD transpilation.
 *
 * Tracks source content hashes to detect if re-run is needed,
 * and manages the GSD Open manifest for transpilation metadata.
 */

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { log } from '../logger.js';
import type { GSDOManifest } from '../../types/index.js';

/**
 * Calculate SHA256 hash of all files in a directory (sorted, deterministic).
 *
 * @param dirPath - Directory to hash
 * @returns SHA256 hash of concatenated file contents
 */
export async function hashDirectory(dirPath: string): Promise<string> {
  const hash = createHash('sha256');
  const files = await collectFiles(dirPath);

  // Sort for deterministic ordering
  files.sort();

  for (const file of files) {
    try {
      const content = await readFile(file);
      // Include relative path in hash for structural changes
      const relativePath = file.substring(dirPath.length);
      hash.update(relativePath);
      hash.update(content);
    } catch {
      // Skip unreadable files
      log.verbose(`Skipping unreadable file: ${file}`);
    }
  }

  return hash.digest('hex');
}

/**
 * Recursively collect all files in a directory.
 */
async function collectFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      // Skip hidden files and directories
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await collectFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist or be readable
  }

  return files;
}

/**
 * Check if transpilation should be re-run based on source hash comparison.
 *
 * @param gsdPath - Path to GSD installation
 * @param manifestPath - Path to GSD Open manifest file
 * @returns Whether regeneration is needed and the reason
 */
export async function checkIdempotency(
  gsdPath: string,
  manifestPath: string
): Promise<{ shouldRegenerate: boolean; reason?: string; currentHash?: string }> {
  // Calculate current source hash
  const currentHash = await hashDirectory(gsdPath);

  // Try to read existing manifest
  let manifest: GSDOManifest | null = null;
  try {
    const manifestContent = await readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(manifestContent);
  } catch {
    // Manifest doesn't exist or is invalid
    return {
      shouldRegenerate: true,
      reason: 'No previous transpilation manifest found',
      currentHash,
    };
  }

  // Compare hashes
  if (manifest.lastRun.sourceHash !== currentHash) {
    return {
      shouldRegenerate: true,
      reason: 'GSD source has changed since last transpilation',
      currentHash,
    };
  }

  return {
    shouldRegenerate: false,
    reason: 'Source unchanged, skipping transpilation',
    currentHash,
  };
}

/**
 * Write GSD Open manifest after successful transpilation.
 *
 * @param manifest - Manifest data to write
 * @param manifestPath - Path to write manifest to
 */
export async function writeManifest(
  manifest: GSDOManifest,
  manifestPath: string
): Promise<void> {
  const content = JSON.stringify(manifest, null, 2);
  await writeFile(manifestPath, content, 'utf-8');
  log.verbose(`Manifest written: ${manifestPath}`);
}

/**
 * Read existing GSD Open manifest.
 *
 * @param manifestPath - Path to manifest file
 * @returns Manifest data or null if not found
 */
export async function readManifest(manifestPath: string): Promise<GSDOManifest | null> {
  try {
    const content = await readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
