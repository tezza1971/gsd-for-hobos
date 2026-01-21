import path from 'node:path';
import fs from 'node:fs';
import type { OpenCodeDetectionResult } from '../../types/index.js';

/**
 * Find a command in the system PATH.
 * Cross-platform: handles Windows executable extensions via PATHEXT,
 * Unix no-extension executables.
 *
 * @param cmd - Command name to find (without extension)
 * @returns Full path to the command if found, null otherwise
 */
export function findCommandInPath(cmd: string): string | null {
  const pathEnv = process.env.PATH;
  if (!pathEnv) {
    return null;
  }

  const pathDirs = pathEnv.split(path.delimiter);
  if (pathDirs.length === 0) {
    return null;
  }

  // Windows: check PATHEXT for executable extensions
  // Unix: no extension needed (empty string)
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT?.split(';') || ['.exe', '.bat', '.cmd', '.EXE', '.BAT', '.CMD'])
      : [''];

  for (const dir of pathDirs) {
    // Skip empty path entries
    if (!dir) {
      continue;
    }

    for (const ext of extensions) {
      const fullPath = path.join(dir, cmd + ext);
      try {
        if (fs.existsSync(fullPath)) {
          // Verify it's a file (not a directory)
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            return fullPath;
          }
        }
      } catch {
        // Skip inaccessible paths
        continue;
      }
    }
  }

  return null;
}

/**
 * Detect OpenCode installation by searching for the opencode command in PATH.
 *
 * @returns Detection result with found status and path or reason for not found
 */
export function detectOpenCode(): OpenCodeDetectionResult {
  const opencodeCommand = 'opencode';
  const foundPath = findCommandInPath(opencodeCommand);

  if (foundPath) {
    return {
      found: true,
      path: foundPath,
    };
  }

  return {
    found: false,
    reason: 'opencode not found in PATH',
  };
}
