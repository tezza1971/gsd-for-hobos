/**
 * Backup Manager for OpenCode configuration files.
 *
 * Creates timestamped backups with manifest tracking, supports rollback,
 * and preserves file permissions for restoration.
 */

import { readFile, writeFile, mkdir, readdir, copyFile, stat, chmod, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, relative, basename } from 'node:path';
import { log } from '../logger.js';
import type { BackupManifest, BackupFileEntry } from '../../types/index.js';

/**
 * BackupManager handles safe file operations with timestamped backups and rollback.
 */
export class BackupManager {
  private configDir: string;
  private backupBaseDir: string;

  /**
   * Create a new BackupManager.
   *
   * @param configDir - OpenCode configuration directory to manage
   */
  constructor(configDir: string) {
    this.configDir = configDir;
    this.backupBaseDir = join(configDir, '.opencode-backup');
  }

  /**
   * Calculate SHA256 hash of file contents.
   */
  private async hashFile(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate timestamped backup directory name.
   * Format: YYYY-MM-DD_HHMMSS
   */
  private generateBackupDirName(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
    return `${date}_${time}`;
  }

  /**
   * Create backup of specified files.
   *
   * @param filePaths - Array of file paths to backup (relative to configDir)
   * @param sourcePath - GSD source path that triggered this backup
   * @returns Path to the created backup directory
   */
  async backup(filePaths: string[], sourcePath: string): Promise<string> {
    const backupDirName = this.generateBackupDirName();
    const backupPath = join(this.backupBaseDir, backupDirName);

    log.verbose(`Creating backup at: ${backupPath}`);

    // Create backup directory
    await mkdir(backupPath, { recursive: true });

    const files: BackupFileEntry[] = [];

    for (const filePath of filePaths) {
      const fullPath = join(this.configDir, filePath);

      try {
        // Get file stats (for permissions and size)
        const stats = await stat(fullPath);
        if (!stats.isFile()) {
          log.verbose(`Skipping non-file: ${filePath}`);
          continue;
        }

        // Calculate hash
        const hash = await this.hashFile(fullPath);

        // Create backup directory structure
        const backupFilePath = join(backupPath, filePath);
        await mkdir(dirname(backupFilePath), { recursive: true });

        // Copy file to backup
        await copyFile(fullPath, backupFilePath);

        log.verbose(`Backed up: ${filePath} (${stats.size} bytes, hash: ${hash.substring(0, 8)}...)`);

        files.push({
          path: filePath,
          hash,
          size: stats.size,
          mode: stats.mode,
        });
      } catch (error) {
        // File might not exist (first run), skip it
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          log.verbose(`File does not exist, skipping backup: ${filePath}`);
          continue;
        }
        throw new Error(`Failed to backup ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Create manifest
    const manifest: BackupManifest = {
      timestamp: new Date().toISOString(),
      source: sourcePath,
      files,
    };

    const manifestPath = join(backupPath, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    log.verbose(`Backup manifest created: ${manifestPath}`);
    log.info(`Backup created: ${backupPath} (${files.length} files)`);

    return backupPath;
  }

  /**
   * Restore files from a backup.
   *
   * @param backupPath - Path to the backup directory to restore from
   */
  async restore(backupPath: string): Promise<void> {
    log.info(`Restoring from backup: ${backupPath}`);

    // Read manifest
    const manifestPath = join(backupPath, 'manifest.json');
    let manifest: BackupManifest;

    try {
      const manifestContent = await readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      throw new Error(`Failed to read backup manifest: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Restore each file
    for (const file of manifest.files) {
      const backupFilePath = join(backupPath, file.path);
      const targetPath = join(this.configDir, file.path);

      try {
        // Verify backup file hash
        const currentHash = await this.hashFile(backupFilePath);
        if (currentHash !== file.hash) {
          throw new Error(`Backup file corrupted: ${file.path} (hash mismatch)`);
        }

        // Ensure target directory exists
        await mkdir(dirname(targetPath), { recursive: true });

        // Copy backup file to target
        await copyFile(backupFilePath, targetPath);

        // Restore file permissions if preserved
        if (file.mode !== undefined) {
          await chmod(targetPath, file.mode);
        }

        log.verbose(`Restored: ${file.path}`);
      } catch (error) {
        throw new Error(`Failed to restore ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    log.success(`Restored ${manifest.files.length} files from backup`);
  }

  /**
   * List all available backups, sorted by timestamp (newest first).
   *
   * @returns Array of backup directory paths
   */
  async listBackups(): Promise<string[]> {
    try {
      const entries = await readdir(this.backupBaseDir, { withFileTypes: true });

      const backups = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(this.backupBaseDir, entry.name))
        .sort()
        .reverse(); // Newest first

      return backups;
    } catch (error) {
      // Backup directory might not exist yet
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get the most recent backup.
   *
   * @returns Path to the most recent backup, or null if none exist
   */
  async getLatestBackup(): Promise<string | null> {
    const backups = await this.listBackups();
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Delete files that were written during a failed transpilation.
   * Used for cleanup when rollback is needed.
   *
   * @param filePaths - Array of file paths to delete (relative to configDir)
   */
  async cleanupWrittenFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      const fullPath = join(this.configDir, filePath);
      try {
        await rm(fullPath);
        log.verbose(`Cleaned up: ${filePath}`);
      } catch {
        // File might not exist, ignore
      }
    }
  }
}
